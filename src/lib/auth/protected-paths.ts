// Pages that send anonymous visitors to /login. This is a navigation convenience only:
// the proxy checks that a session cookie is present, never that it is valid. Every Server Action
// and API route still verifies the signed session and tenant ownership itself.
export const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/invoices",
  "/clients",
  "/estimates",
  "/recurring",
  "/ai-create",
  "/settings",
] as const;

const SESSION_COOKIE_NAMES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** True when a NextAuth session cookie (or one of its chunks) is present with a non-empty value. */
export function hasSessionCookie(cookies: ReadonlyArray<{ name: string; value: string }>): boolean {
  return cookies.some(
    ({ name, value }) =>
      value.length > 0 &&
      SESSION_COOKIE_NAMES.some((base) => name === base || name.startsWith(`${base}.`)),
  );
}
