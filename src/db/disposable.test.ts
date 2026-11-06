import { describe, expect, it } from "vitest";
import { describesSameDatabase, isLocalHost, parseDisposableDatabaseUrl, UnsafeDatabaseError } from "./disposable";

const purpose = "a test";
const ok = (url: string, allowRemote = false) => parseDisposableDatabaseUrl(url, purpose, { allowRemote });

describe("parseDisposableDatabaseUrl", () => {
  it("accepts a local *_test database", () => {
    expect(ok("postgresql://u:p@localhost:5432/invoice_claw_test")).toMatchObject({
      database: "invoice_claw_test",
      host: "localhost",
      port: "5432",
    });
    expect(ok("postgres://u:p@127.0.0.1/app_test").port).toBe("5432");
    expect(ok("postgres://u:p@[::1]:5433/app_test").host).toBe("[::1]");
  });

  it.each([
    ["missing", undefined],
    ["empty", "   "],
    ["not a URL", "not a url"],
    ["wrong protocol", "mysql://u:p@localhost/app_test"],
    ["dev database name", "postgresql://u:p@localhost:5432/invoice_claw"],
    ["suffix only", "postgresql://u:p@localhost/_test"],
    ["test not at the end", "postgresql://u:p@localhost/invoice_claw_test_copy"],
    ["uppercase", "postgresql://u:p@localhost/App_TEST"],
    ["no database", "postgresql://u:p@localhost:5432/"],
    ["query overrides dbname", "postgresql://u:p@localhost/app_test?dbname=prod"],
    ["query overrides host", "postgresql://u:p@localhost/app_test?host=db.example.com"],
  ])("rejects %s", (_label, url) => {
    expect(() => ok(url as string)).toThrow(UnsafeDatabaseError);
  });

  it("rejects a remote host unless explicitly allowed", () => {
    const remote = "postgresql://u:p@db.example.com:5432/app_test";
    expect(() => ok(remote)).toThrow(/not this machine/);
    expect(ok(remote, true).host).toBe("db.example.com");
  });

  it("still requires the _test suffix for allowed remote hosts", () => {
    expect(() => ok("postgresql://u:p@db.example.com/app", true)).toThrow(/must end in _test/);
  });

  it("never puts the password in the error message", () => {
    try {
      ok("postgresql://user:S3cretPassw0rd@db.example.com/prod");
      throw new Error("expected a rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsafeDatabaseError);
      expect((error as Error).message).not.toContain("S3cretPassw0rd");
    }
  });
});

describe("describesSameDatabase", () => {
  it("ignores credentials and treats loopback addresses as the same host", () => {
    expect(describesSameDatabase("postgresql://a:1@localhost/x_test", "postgresql://b:2@127.0.0.1:5432/x_test")).toBe(true);
  });

  it("distinguishes database, port and host", () => {
    const base = "postgresql://u:p@localhost:5432/x_test";
    expect(describesSameDatabase(base, "postgresql://u:p@localhost:5432/y_test")).toBe(false);
    expect(describesSameDatabase(base, "postgresql://u:p@localhost:5433/x_test")).toBe(false);
    expect(describesSameDatabase(base, "postgresql://u:p@db.example.com:5432/x_test")).toBe(false);
  });

  it("returns false for unparsable input", () => {
    expect(describesSameDatabase("nope", "postgresql://u:p@localhost/x_test")).toBe(false);
  });
});

describe("isLocalHost", () => {
  it("recognises loopback names", () => {
    expect(isLocalHost("localhost")).toBe(true);
    expect(isLocalHost("[::1]")).toBe(true);
    expect(isLocalHost("db.example.com")).toBe(false);
  });
});
