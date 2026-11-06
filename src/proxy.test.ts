import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
// The installed 16.4.5 docs call this helper unstable_doesProxyMatch, but the package still exports it
// under its pre-rename name. Switch to the new name once `next/experimental/testing/server` exports it.
import { getRedirectUrl, unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { config, proxy } from "./proxy";
import { PROTECTED_PAGE_PREFIXES, hasSessionCookie, isProtectedPath } from "./lib/auth/protected-paths";

const origin = "http://localhost:3105";
const request = (path: string, cookie?: string) =>
  new NextRequest(`${origin}${path}`, cookie ? { headers: { cookie } } : undefined);

describe("matcher", () => {
  it.each(["/dashboard", "/invoices/new", "/portal/abc", "/login"])("runs on page %s", (url) => {
    expect(doesProxyMatch({ config, url })).toBe(true);
  });

  it.each(["/api/send-invoice", "/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/robots.txt", "/sitemap.xml"])(
    "skips %s",
    (url) => {
      expect(doesProxyMatch({ config, url })).toBe(false);
    },
  );
});

describe("proxy", () => {
  it.each(PROTECTED_PAGE_PREFIXES.flatMap((prefix) => [prefix, `${prefix}/child`]))(
    "redirects an anonymous visitor from %s to /login with a callback",
    async (path) => {
      const location = getRedirectUrl(await proxy(request(`${path}?tab=1`)));
      expect(location).toBe(`${origin}/login?callbackUrl=${encodeURIComponent(`${path}?tab=1`)}`);
    },
  );

  it("does not carry other query parameters onto the login URL", async () => {
    const location = new URL(getRedirectUrl(await proxy(request("/dashboard?next=https://evil.example")))!);
    expect([...location.searchParams.keys()]).toEqual(["callbackUrl"]);
  });

  it.each(["/login", "/onboarding", "/portal/3f2b", "/dashboards", "/invoicesx"])("lets %s through without a cookie", async (path) => {
    expect(getRedirectUrl(await proxy(request(path)))).toBeNull();
  });

  it("lets a request with a session cookie through (validity is checked by the server, not here)", async () => {
    expect(getRedirectUrl(await proxy(request("/dashboard", "next-auth.session-token=anything")))).toBeNull();
  });

  it("treats an empty session cookie as missing", async () => {
    expect(getRedirectUrl(await proxy(request("/dashboard", "next-auth.session-token=")))).not.toBeNull();
  });
});

describe("helpers", () => {
  it("matches whole path segments only", () => {
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/billing")).toBe(true);
    expect(isProtectedPath("/settingsx")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });

  it("recognises secure and chunked session cookies", () => {
    expect(hasSessionCookie([{ name: "__Secure-next-auth.session-token", value: "x" }])).toBe(true);
    expect(hasSessionCookie([{ name: "next-auth.session-token.0", value: "x" }])).toBe(true);
    expect(hasSessionCookie([{ name: "next-auth.csrf-token", value: "x" }])).toBe(false);
    expect(hasSessionCookie([{ name: "evil-next-auth.session-token", value: "x" }])).toBe(false);
  });
});
