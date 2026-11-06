import "server-only";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required; refusing to connect to an implicit/default database");
}

const parsedDatabaseUrl = new URL(connectionString);
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname);
const configuredPoolSize = Number(process.env.POSTGRES_POOL_MAX || (process.env.NODE_ENV === "production" ? "1" : "5"));
if (!Number.isInteger(configuredPoolSize) || configuredPoolSize < 1 || configuredPoolSize > 20) {
  throw new Error("POSTGRES_POOL_MAX must be an integer between 1 and 20");
}

const sql = postgres(connectionString, {
  max: configuredPoolSize,
  ...(isLocalDatabase ? {} : { ssl: "require" as const }),
});
export const db = drizzle(sql, { schema });
