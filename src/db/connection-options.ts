import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import type { ConnectionOptions } from "node:tls";
import { isLocalHost } from "./disposable";

// One TLS policy for every PostgreSQL connection: the app (src/db/index.ts), the migrator (src/db/migrate.ts),
// test-database setup (src/db/create-test-database.ts) and Drizzle Kit (drizzle.config.ts).
//
// - A database on another machine is ALWAYS reached over TLS that verifies the server certificate against a
//   trusted CA AND checks that the certificate matches the hostname (like libpq's sslmode=verify-full). There is
//   no setting that turns this off. (The previous ssl: "require" encrypted the connection but, in the postgres
//   driver, set rejectUnauthorized = false, so it never checked who was on the other end.)
// - The only exception is a database on this machine (localhost, 127.0.0.1, ::1). Loopback traffic never leaves
//   the computer, so it may use plain TCP. This is meant for local development and disposable test databases.
// - The trusted CA is DATABASE_SSL_ROOT_CERT (path to a PEM file) when set, otherwise Node's built-in public CA list.

export type DatabaseTls = false | ConnectionOptions;
type Env = Record<string, string | undefined>;

export class DatabaseTlsConfigError extends Error {
  constructor(reason: string) {
    super(`Database TLS configuration error: ${reason}`);
    this.name = "DatabaseTlsConfigError";
  }
}

// sslmode values that encrypt (or not) without proving the server's identity, or that skip the hostname check.
const UNVERIFIED_SSLMODES = new Set(["disable", "allow", "prefer", "require", "no-verify", "verify-ca"]);

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function readRootCert(path: string): string {
  let pem: string;
  try {
    pem = readFileSync(path, "utf8");
  } catch {
    throw new DatabaseTlsConfigError(`DATABASE_SSL_ROOT_CERT points to "${path}", which cannot be read`);
  }
  if (!pem.includes("-----BEGIN CERTIFICATE-----")) {
    throw new DatabaseTlsConfigError(`DATABASE_SSL_ROOT_CERT ("${path}") does not contain a PEM certificate`);
  }
  return pem;
}

/** The `ssl` option to pass to the postgres driver for this connection string. Throws on unsafe configuration. */
export function databaseTlsOptions(connectionString: string, env: Env = process.env): DatabaseTls {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DatabaseTlsConfigError("the database URL is not a valid URL");
  }
  const host = hostOf(url);
  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
  const urlRootCert = url.searchParams.get("sslrootcert");
  const local = isLocalHost(host);

  // On this machine, plain TCP unless verification was asked for explicitly.
  if (local && sslmode !== "verify-full") return false;

  if (sslmode && UNVERIFIED_SSLMODES.has(sslmode)) {
    throw new DatabaseTlsConfigError(
      `sslmode=${sslmode} in the database URL does not verify the server's certificate and hostname. ` +
        "Remove it (verification is always on for remote databases) or use sslmode=verify-full",
    );
  }
  if (urlRootCert && urlRootCert !== "system") {
    throw new DatabaseTlsConfigError("set the CA file with DATABASE_SSL_ROOT_CERT instead of sslrootcert in the URL");
  }

  const caPath = env.DATABASE_SSL_ROOT_CERT?.trim();
  const ip = isIP(host) !== 0;
  return {
    rejectUnauthorized: true,
    ...(caPath ? { ca: readRootCert(caPath) } : {}),
    // A hostname is sent for SNI and checked against the certificate. For an IP address, Node checks the
    // certificate's IP SANs against `host` (SNI does not allow IP addresses).
    ...(ip ? { host } : { servername: host }),
  };
}

/** One line for logs. Never includes credentials. */
export function describeDatabaseTls(tls: DatabaseTls): string {
  if (tls === false) return "no TLS (database on this machine)";
  return tls.ca ? "TLS, certificate and hostname verified (CA from DATABASE_SSL_ROOT_CERT)" : "TLS, certificate and hostname verified";
}
