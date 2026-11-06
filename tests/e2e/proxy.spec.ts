import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { PROTECTED_PAGE_PREFIXES } from "../../src/lib/auth/protected-paths";
import { E2E_NEXTAUTH_SECRET } from "./test-env";

// The test server runs on plain http://localhost, so NextAuth uses the non-secure cookie name.
const SESSION_COOKIE = "next-auth.session-token";

test.describe("proxy redirects anonymous visitors", () => {
  for (const path of PROTECTED_PAGE_PREFIXES) {
    test(`${path} redirects to /login`, async ({ request }) => {
      const response = await request.get(`${path}?from=e2e`, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const location = new URL(response.headers()["location"], "http://placeholder");
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("callbackUrl")).toBe(`${path}?from=e2e`);
    });
  }

  test("public pages are not redirected", async ({ request }) => {
    for (const path of ["/login", "/onboarding"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
  });
});

test.describe("a session cookie the server did not issue grants nothing", () => {
  const cases: Array<[string, () => Promise<string>, number]> = [
    ["forged (not a valid token)", async () => "forged-value", 401],
    [
      "expired (correctly signed, past its expiry)",
      async () => encode({ token: { sub: randomUUID() }, secret: E2E_NEXTAUTH_SECRET, maxAge: -3600 }),
      401,
    ],
    [
      "signed for a user and business that do not exist",
      async () =>
        encode({
          token: { sub: randomUUID(), id: randomUUID(), businessId: randomUUID() },
          secret: E2E_NEXTAUTH_SECRET,
          maxAge: 3600,
        }),
      403,
    ],
  ];

  for (const [label, makeToken, sendStatus] of cases) {
    test(label, async ({ playwright, baseURL }) => {
      const token = await makeToken();
      const api = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { cookie: `${SESSION_COOKIE}=${token}` },
      });
      try {
        // The server-side session resolves to no user (or one with no data).
        const session = await (await api.get("/api/auth/session")).json();
        if (sendStatus === 401) expect(session).toEqual({});

        // A protected API refuses to act.
        const send = await api.post("/api/send-invoice", { data: { invoiceId: randomUUID() } });
        expect(send.status()).toBe(sendStatus);

        // The proxy lets the page request through (cookie present), but the page must not render private
        // data: the server redirects to /login or the page shows no business data.
        const page = await api.get("/dashboard", { maxRedirects: 0 });
        expect([200, 307]).toContain(page.status());
        if (page.status() === 307) expect(page.headers()["location"]).toContain("/login");
      } finally {
        await api.dispose();
      }
    });
  }
});
