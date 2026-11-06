import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";
import { isLocalHost, parseDisposableDatabaseUrl } from "./disposable";

// Values already present in the environment take precedence over these files.
dotenv.config({ path: ".env.test.local", quiet: true });
dotenv.config({ path: ".env.local", quiet: true });

function resolveTarget(): { connectionString: string; label: string } {
  if (process.argv.includes("--test")) {
    const target = parseDisposableDatabaseUrl(process.env.TEST_DATABASE_URL, "test migrations", {
      allowRemote: process.env.ALLOW_REMOTE_TEST_DATABASE === "1",
    });
    return { connectionString: target.url, label: `disposable test database "${target.database}"` };
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to run database migrations");
  const database = decodeURIComponent(new URL(connectionString).pathname.replace(/^\/+/, ""));
  // Any other database must be named explicitly, so a migration is never applied to it by accident.
  if (process.env.MIGRATE_CONFIRM_DATABASE !== database) {
    throw new Error(
      `Refusing to migrate database "${database}" without confirmation. ` +
        'Use "npm run db:migrate:test" for the disposable test database. For this database, take a backup ' +
        `you have proven you can restore, then set MIGRATE_CONFIRM_DATABASE=${database} for this one command.`,
    );
  }
  return { connectionString, label: `database "${database}" (confirmed)` };
}

async function main() {
  const { connectionString, label } = resolveTarget();
  const isLocalDatabase = isLocalHost(new URL(connectionString).hostname);
  // TLS verification for remote servers is tracked separately (remediation step 1.5).
  const sql = postgres(connectionString, { max: 1, ...(isLocalDatabase ? {} : { ssl: "require" as const }) });
  try {
    console.log(`Applying reviewed database migrations to ${label}...`);
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully!");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Migration failed.", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
