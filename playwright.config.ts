import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import { describesSameDatabase, parseDisposableDatabaseUrl, UnsafeDatabaseError } from "./src/db/disposable";
import { E2E_NEXTAUTH_SECRET } from "./tests/e2e/test-env";

// Test-only settings (TEST_DATABASE_URL, optional E2E_PORT) live in the git-ignored .env.test.local.
// Values already present in the environment (for example in CI) take precedence.
dotenv.config({ path: ".env.test.local", quiet: true });

const purpose = "the Playwright browser suite";
const allowRemote = process.env.ALLOW_REMOTE_TEST_DATABASE === "1";
const testDatabase = parseDisposableDatabaseUrl(process.env.TEST_DATABASE_URL, purpose, { allowRemote });

// Never share the developer's everyday database, even if it happens to be named *_test.
const devDatabaseUrl = existsSync(".env.local") ? dotenv.parse(readFileSync(".env.local")).DATABASE_URL : undefined;
if (devDatabaseUrl && describesSameDatabase(devDatabaseUrl, testDatabase.url)) {
  throw new UnsafeDatabaseError(purpose, "TEST_DATABASE_URL points at the same database as DATABASE_URL in .env.local");
}

// A dedicated port, so the suite never talks to a dev server started by hand on 3005.
const port = Number(process.env.E2E_PORT ?? "3105");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("E2E_PORT must be an integer between 1024 and 65535");
}
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    // Always start a fresh server: an already-running one may be connected to a different database.
    reuseExistingServer: false,
    timeout: 120 * 1000,
    // Real environment variables override .env.local in Next.js, so the server uses the test database.
    env: {
      DATABASE_URL: testDatabase.url,
      NEXTAUTH_URL: baseURL,
      // A known test-only secret, so specs can mint expired or foreign tokens and prove they are refused.
      NEXTAUTH_SECRET: E2E_NEXTAUTH_SECRET,
      E2E_DISPOSABLE_DB: "1",
      ...(allowRemote ? { ALLOW_REMOTE_TEST_DATABASE: "1" } : {}),
    },
  },
});
