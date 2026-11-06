/**
 * Guards for commands that write throwaway data: the browser suite, the seed command and test migrations.
 *
 * A database counts as disposable only when its name ends in "_test" and it runs on this machine.
 * A remote throwaway database (for example a temporary cloud branch) is allowed only when the caller
 * opts in explicitly with ALLOW_REMOTE_TEST_DATABASE=1, and its name must still end in "_test".
 *
 * Error messages never include credentials.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DISPOSABLE_NAME = /^[a-z0-9_]+_test$/;
// Connection parameters that could silently point the client at a different database or host.
const OVERRIDE_PARAMS = ["db", "dbname", "database", "host", "hostaddr"];

export type DisposableDatabase = { url: string; database: string; host: string; port: string };

export class UnsafeDatabaseError extends Error {
  constructor(purpose: string, reason: string) {
    super(
      `Refusing to run ${purpose}: ${reason}. ` +
        "Point TEST_DATABASE_URL at a throwaway database whose name ends in _test (see README, Testing).",
    );
    this.name = "UnsafeDatabaseError";
  }
}

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase().replace(/^\[|\]$/g, ""));
}

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
}

export function parseDisposableDatabaseUrl(
  raw: string | undefined,
  purpose: string,
  options: { allowRemote?: boolean } = {},
): DisposableDatabase {
  const value = raw?.trim();
  if (!value) throw new UnsafeDatabaseError(purpose, "TEST_DATABASE_URL is not set");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeDatabaseError(purpose, "the database URL is not a valid URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new UnsafeDatabaseError(purpose, "only postgres:// or postgresql:// URLs are supported");
  }
  for (const param of OVERRIDE_PARAMS) {
    if (url.searchParams.has(param)) {
      throw new UnsafeDatabaseError(purpose, `the URL sets "${param}" in its query string, which could override the target`);
    }
  }

  let database: string;
  try {
    database = databaseName(url);
  } catch {
    throw new UnsafeDatabaseError(purpose, "the database name in the URL is not valid");
  }
  if (!DISPOSABLE_NAME.test(database)) {
    throw new UnsafeDatabaseError(
      purpose,
      `database "${database || "(none)"}" must end in _test and use only lowercase letters, digits and _`,
    );
  }

  const host = url.hostname.toLowerCase();
  if (!isLocalHost(host) && !options.allowRemote) {
    throw new UnsafeDatabaseError(
      purpose,
      `host "${host}" is not this machine (set ALLOW_REMOTE_TEST_DATABASE=1 only for a throwaway remote database)`,
    );
  }

  return { url: value, database, host, port: url.port || "5432" };
}

/** True when both URLs name the same database on the same server (credentials ignored). */
export function describesSameDatabase(a: string, b: string): boolean {
  const key = (raw: string): string => {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return [isLocalHost(host) ? "localhost" : host, url.port || "5432", databaseName(url)].join("|");
  };
  try {
    return key(a) === key(b);
  } catch {
    return false;
  }
}
