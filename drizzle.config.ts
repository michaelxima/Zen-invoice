import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import { databaseTlsOptions } from "./src/db/connection-options";

dotenv.config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Drizzle Kit operations");

// Drizzle Kit only accepts an `ssl` option with explicit credentials, so the URL is split up here and gets the
// same TLS policy as the app and the migrator (src/db/connection-options.ts).
const url = new URL(databaseUrl);
const ssl = databaseTlsOptions(databaseUrl);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
    ssl,
  },
});
