import { readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import postgres from "postgres";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseTlsConfigError, databaseTlsOptions, describeDatabaseTls } from "./connection-options";

const FIXTURES = path.resolve(__dirname, "../../tests/fixtures/tls");
const fixture = (name: string) => path.join(FIXTURES, name);
const CA = fixture("test-ca.crt");

describe("databaseTlsOptions", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])("uses plain TCP for a database on this machine (%s)", (host) => {
    expect(databaseTlsOptions(`[REDACTED_CONN_STRING]://${host}:5432/app`, {})).toBe(false);
  });

  it("verifies a local database when sslmode=verify-full is asked for", () => {
    expect(databaseTlsOptions("[REDACTED_CONN_STRING]://localhost/app?sslmode=verify-full", {})).toMatchObject({ rejectUnauthorized: true });
  });

  it("always verifies certificate and hostname for a remote database", () => {
    expect(databaseTlsOptions("[REDACTED_CONN_STRING]://db.example.com/app", {})).toEqual({
      rejectUnauthorized: true,
      servername: "db.example.com",
    });
    expect(databaseTlsOptions("[REDACTED_CONN_STRING]://db.example.com/app?sslmode=verify-full&sslrootcert=system", {})).toMatchObject({
      rejectUnauthorized: true,
    });
  });

  it("checks an IP address against the certificate's IP entries instead of sending it as SNI", () => {
    expect(databaseTlsOptions("[REDACTED_CONN_STRING]://10.1.2.3/app", {})).toEqual({ rejectUnauthorized: true, host: "10.1.2.3" });
  });

  it("uses the CA file from DATABASE_SSL_ROOT_CERT", () => {
    const options = databaseTlsOptions("[REDACTED_CONN_STRING]://db.example.com/app", { DATABASE_SSL_ROOT_CERT: CA });
    expect(options && options.ca).toContain("-----BEGIN CERTIFICATE-----");
    expect(describeDatabaseTls(options)).toMatch(/DATABASE_SSL_ROOT_CERT/);
  });

  it.each(["disable", "allow", "prefer", "require", "no-verify", "verify-ca", "REQUIRE"])(
    "refuses sslmode=%s for a remote database instead of silently weakening or ignoring it",
    (mode) => {
      expect(() => databaseTlsOptions(`[REDACTED_CONN_STRING]://db.example.com/app?sslmode=${mode}`, {})).toThrow(DatabaseTlsConfigError);
    },
  );

  it("refuses a CA path in the URL (use DATABASE_SSL_ROOT_CERT)", () => {
    expect(() => databaseTlsOptions("[REDACTED_CONN_STRING]://db.example.com/app?sslrootcert=/tmp/ca.pem", {})).toThrow(/DATABASE_SSL_ROOT_CERT/);
  });

  it("refuses an unreadable or non-certificate CA file", () => {
    expect(() => databaseTlsOptions("[REDACTED_CONN_STRING]://db.example.com/app", { DATABASE_SSL_ROOT_CERT: fixture("missing.crt") })).toThrow(/cannot be read/);
    expect(() => databaseTlsOptions("[REDACTED_CONN_STRING]://db.example.com/app", { DATABASE_SSL_ROOT_CERT: fixture("server.key") })).toThrow(/PEM certificate/);
  });

  it("refuses an invalid URL without echoing it", () => {
    expect(() => databaseTlsOptions("not a url:secret", {})).toThrow(/not a valid URL/);
  });
});

// A stand-in PostgreSQL server: it accepts the driver's SSLRequest, completes a TLS handshake with the given
// certificate, then answers the startup message with an error. Reaching that error proves the handshake succeeded.
const HANDSHAKE_OK = "test server: TLS handshake completed";

function errorResponse(message: string): Buffer {
  const fields = Buffer.from(`SFATAL\0VFATAL\0C28000\0M${message}\0\0`, "utf8");
  const header = Buffer.alloc(5);
  header.write("E", 0);
  header.writeInt32BE(fields.length + 4, 1);
  return Buffer.concat([header, fields]);
}

type FakeServer = { port: number; handshakes: () => number; close: () => Promise<void> };
const servers: FakeServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

async function startFakePostgres(certName: string): Promise<FakeServer> {
  const cert = readFileSync(fixture(`${certName}.crt`));
  const key = readFileSync(fixture(`${certName}.key`));
  let handshakes = 0;
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => undefined);
    socket.once("data", () => {
      socket.write("S"); // "SSL accepted"
      const secure = new tls.TLSSocket(socket, { isServer: true, cert, key });
      secure.on("error", () => secure.destroy());
      secure.on("secure", () => {
        handshakes += 1;
      });
      secure.once("data", () => secure.end(errorResponse(HANDSHAKE_OK)));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.2", resolve));
  const fake: FakeServer = {
    port: (server.address() as net.AddressInfo).port,
    handshakes: () => handshakes,
    close: () =>
      new Promise((resolve) => {
        sockets.forEach((s) => s.destroy());
        server.close(() => resolve());
      }),
  };
  servers.push(fake);
  return fake;
}

/** Connects exactly the way src/db/index.ts and src/db/migrate.ts do: postgres(url, { ssl: databaseTlsOptions(url) }). */
async function connectWithAppPolicy(port: number): Promise<Error & { code?: string }> {
  // 127.0.0.2 is a loopback address the policy treats as remote (only localhost/127.0.0.1/::1 are exempt).
  const url = `[REDACTED_CONN_STRING]://127.0.0.2:${port}/app`;
  const sql = postgres(url, {
    max: 1,
    connect_timeout: 5,
    onnotice: () => undefined,
    ssl: databaseTlsOptions(url, { DATABASE_SSL_ROOT_CERT: CA }),
  });
  try {
    await sql`select 1`;
    throw new Error("expected the connection to end with an error");
  } catch (error) {
    return error as Error & { code?: string };
  } finally {
    await sql.end({ timeout: 0 });
  }
}

describe("app and migrator connections against a TLS server", () => {
  it("connect when the certificate is trusted and matches the host", async () => {
    const server = await startFakePostgres("server");
    const error = await connectWithAppPolicy(server.port);
    expect(error.message).toContain(HANDSHAKE_OK);
    expect(server.handshakes()).toBe(1);
  });

  it("fail when the certificate is not issued by a trusted CA", async () => {
    const server = await startFakePostgres("untrusted");
    const error = await connectWithAppPolicy(server.port);
    expect(error.message).not.toContain(HANDSHAKE_OK);
    expect(error.code).toMatch(/UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_GET_ISSUER_CERT/);
  });

  it("fail when a trusted certificate is for a different host", async () => {
    const server = await startFakePostgres("wrong-host");
    const error = await connectWithAppPolicy(server.port);
    expect(error.message).not.toContain(HANDSHAKE_OK);
    expect(error.code).toBe("ERR_TLS_CERT_ALTNAME_INVALID");
  });
});

describe("every connection uses the shared policy", () => {
  const root = path.resolve(__dirname, "../..");
  it.each(["src/db/index.ts", "src/db/migrate.ts", "src/db/create-test-database.ts", "drizzle.config.ts"])("%s", (file) => {
    const source = readFileSync(path.join(root, file), "utf8");
    expect(source).toContain("databaseTlsOptions(");
    expect(source).not.toMatch(/ssl:\s*["']require["']/);
  });
});
