import * as dotenv from "dotenv";
import { parseDisposableDatabaseUrl } from "./disposable";

// Values already present in the environment take precedence over this file.
dotenv.config({ path: ".env.test.local", quiet: true });

// Seed data is test data: it may only ever be written to a disposable *_test database.
export async function seedDemoData() {
  const target = parseDisposableDatabaseUrl(process.env.TEST_DATABASE_URL, "the seed command", {
    allowRemote: process.env.ALLOW_REMOTE_TEST_DATABASE === "1",
  });
  console.log(`Seeding disposable database "${target.database}"...`);
  console.log("No demo data seeded – clean start.");
}

seedDemoData()
  .then(() => {
    console.log("Done seeding.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : "Unknown error");
    process.exit(1);
  });
