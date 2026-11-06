import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to run database migrations");
const parsedDatabaseUrl = new URL(connectionString);
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname);
const sql = postgres(connectionString, { max: 1, ...(isLocalDatabase ? {} : { ssl: "require" as const }) });
const db = drizzle(sql);

async function main() {
  try {
    console.log("Applying reviewed database migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully!");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Migration failed.", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
