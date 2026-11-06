import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext, type Page, type PlaywrightWorkerArgs } from "@playwright/test";

const PASSWORD = "SecurePassphrase-2026!";
const SESSION_COOKIE = "next-auth.session-token";
const uniqueEmail = (label: string) => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function register(page: Page, email: string) {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Get Started/i }).click();
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).first().fill(PASSWORD);
  await page.getByLabel(/confirm password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /Continue to account details/i }).click();
  await page.getByLabel(/first name/i).fill("Sam");
  await page.getByLabel(/last name/i).fill("Berg");
  await page.getByLabel(/^Address/i).fill("Kungsgatan 1");
  await page.getByLabel(/^City/i).fill("Stockholm");
  await page.getByLabel(/postal code/i).fill("111 43");
  await page.getByLabel(/country/i).fill("Sweden");
  await page.getByRole("button", { name: /Continue to business/i }).click();
  await page.getByLabel(/business name/i).fill("Berg Consulting");
  await page.getByRole("button", { name: /Finish and open dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function signInWithPassword(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign In$/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** The session cookie as a Cookie header value, including any chunked parts. */
async function sessionCookieHeader(context: BrowserContext): Promise<string> {
  const parts = (await context.cookies()).filter((c) => c.name === SESSION_COOKIE || c.name.startsWith(`${SESSION_COOKIE}.`));
  expect(parts.length, "a session cookie should be set").toBeGreaterThan(0);
  return parts.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** A separate client that only has a copy of the cookie, like an attacker who copied it. */
async function withCopiedCookie<T>(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string | undefined,
  cookie: string,
  run: (api: APIRequestContext) => Promise<T>,
): Promise<T> {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie } });
  try {
    return await run(api);
  } finally {
    await api.dispose();
  }
}

async function expectSignedIn(api: APIRequestContext, email: string) {
  const session = await (await api.get("/api/auth/session")).json();
  expect(session?.user?.email).toBe(email);
}

async function expectRejected(api: APIRequestContext) {
  expect(await (await api.get("/api/auth/session")).json()).toEqual({});
  const send = await api.post("/api/send-invoice", { data: { invoiceId: randomUUID() } });
  expect(send.status()).toBe(401);
}

test("signing out revokes the session, so a copy of its cookie stops working", async ({ page, context, playwright, baseURL }) => {
  const email = uniqueEmail("signout");
  await register(page, email);
  const copied = await sessionCookieHeader(context);
  await withCopiedCookie(playwright, baseURL, copied, (api) => expectSignedIn(api, email));

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await withCopiedCookie(playwright, baseURL, copied, expectRejected);

  // The browser itself is signed out too.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("sign out of all devices revokes other browsers immediately", async ({ page, browser, playwright, baseURL }) => {
  const email = uniqueEmail("everywhere");
  await register(page, email);

  const otherDevice = await browser.newContext({ baseURL });
  try {
    const otherPage = await otherDevice.newPage();
    await signInWithPassword(otherPage, email);
    const otherCookie = await sessionCookieHeader(otherDevice);
    await withCopiedCookie(playwright, baseURL, otherCookie, (api) => expectSignedIn(api, email));

    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out of all devices" }).click();
    await expect(page).toHaveURL(/\/login/);

    await withCopiedCookie(playwright, baseURL, otherCookie, expectRejected);
  } finally {
    await otherDevice.close();
  }
});

test("signing in again after sign-out starts a fresh, working session", async ({ page, context, playwright, baseURL }) => {
  const email = uniqueEmail("resignin");
  await register(page, email);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await signInWithPassword(page, email);
  await withCopiedCookie(playwright, baseURL, await sessionCookieHeader(context), (api) => expectSignedIn(api, email));
});

test("Google sign-in is not offered, even though Google credentials exist in .env.local", async ({ request, page }) => {
  const providers = await (await request.get("/api/auth/providers")).json();
  expect(Object.keys(providers)).toEqual(["credentials"]);

  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeDisabled();
  await expect(page.getByText(/Google sign-in is not available yet/i)).toBeVisible();
});

test("the sign-in page explains a refused Google account link", async ({ page }) => {
  await page.goto("/login?error=google_not_linked");
  await expect(page.getByRole("alert")).toContainText(/already exists/i);
});
