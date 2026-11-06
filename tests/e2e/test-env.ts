// Shared between playwright.config.ts (which passes it to the test server) and specs that need to
// mint session tokens. Test-only: it never signs anything outside the browser suite.
export const E2E_NEXTAUTH_SECRET =
  process.env.E2E_NEXTAUTH_SECRET ?? "e2e-only-nextauth-secret-not-used-outside-tests-0001";
