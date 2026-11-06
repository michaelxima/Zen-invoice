import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "./index";
import { users, businesses, clients, invoices, invoiceItems } from "./schema";

export async function seedDemoData() {
  console.log("Seeding demo data for Invoice Claw...");
  console.log("No demo data seeded – clean start.");
}

seedDemoData()
  .then(() => {
    console.log("Done seeding.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

