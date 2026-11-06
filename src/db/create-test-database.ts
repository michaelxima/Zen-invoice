import postgres from "postgres";
import * as dotenv from "dotenv";
import { parseDisposableDatabaseUrl } from "./disposable";
import { databaseTlsOptions } from "./connection-options";

// Values already present in the environment take precedence over this file.
dotenv.config({ path: ".env.test.local", quiet: true });

// Creates (or with --reset, drops and recreates) the disposable test database named in TEST_DATABASE_URL.
async function main() {
  const reset = process.argv.includes("--reset");
  const target = parseDisposableDatabaseUrl(
    process.env.TEST_DATABASE_URL,
    reset ? "a test database reset" : "test database creation",
    { allowRemote: process.env.ALLOW_REMOTE_TEST_DATABASE === "1" },
  );

  // Connect to the server's maintenance database, because the target may not exist yet.
  const admin = new URL(target.url);
  admin.pathname = "/postgres";
  const sql = postgres(admin.toString(), { max: 1, ssl: databaseTlsOptions(admin.toString()) });
  try {
    // The name already matched ^[a-z0-9_]+_test$, and sql(name) quotes it as an identifier.
    const name = sql(target.database);
    if (reset) {
      await sql`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`;
      console.log(`Dropped "${target.database}".`);
    }
    const existing = await sql`SELECT 1 FROM pg_database WHERE datname = ${target.database}`;
    if (existing.length > 0) {
      console.log(`"${target.database}" already exists. Next: npm run db:migrate:test`);
      return;
    }
    await sql`CREATE DATABASE ${name}`;
    console.log(`Created "${target.database}". Next: npm run db:migrate:test`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Test database setup failed.", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
