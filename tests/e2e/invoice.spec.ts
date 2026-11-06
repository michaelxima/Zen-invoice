import { test, expect, type Page } from "@playwright/test";

async function register(page: Page, email: string, businessName: string) {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Get Started/i }).click();
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).first().fill("SecurePassphrase-2026!");
  await page.getByLabel(/confirm password/i).fill("SecurePassphrase-2026!");
  await page.getByRole("button", { name: /Continue to account details/i }).click();
  await page.getByLabel(/first name/i).fill("Alex");
  await page.getByLabel(/last name/i).fill("Morgan");
  await page.getByLabel(/^Address/i).fill("500 Howard Street");
  await page.getByLabel(/^City/i).fill("San Francisco");
  await page.getByLabel(/postal code/i).fill("94105");
  await page.getByLabel(/country/i).fill("United States");
  await page.getByRole("button", { name: /Continue to business/i }).click();
  await page.getByLabel(/business name/i).fill(businessName);
  await page.getByRole("button", { name: /Finish and open dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("creates a tenant-owned invoice, renders its token portal, and keeps Stripe confirmation server-authoritative", async ({ page }) => {
  const unique = Date.now();
  await register(page, `invoice-owner-${unique}@example.test`, "Morgan Advisory");

  await page.goto("/invoices/new");
  await expect(page.getByRole("heading", { name: /Create Invoice/i })).toBeVisible();
  await page.getByPlaceholder("Client Name").fill("Stark Industries");
  await page.getByPlaceholder("Client Email").fill("tony@stark.example");
  await page.getByPlaceholder("Item description").first().fill("Consulting services");
  await page.getByPlaceholder("Price").first().fill("1500");
  await page.getByRole("button", { name: /Save Draft/i }).click();

  await expect(page).toHaveURL(/\/invoices/);
  await expect(page.getByText("Stark Industries").first()).toBeVisible();
  await expect(page.getByText("Draft").first()).toBeVisible();
  await page.getByRole("button", { name: /Send invoice INV-/i }).click();
  await expect(page.getByRole("alert")).toContainText(/email|provider/i);
  const portalHref = await page.locator("a[href^='/portal/']").first().getAttribute("href");
  expect(portalHref).toMatch(/^\/portal\/[0-9a-f-]+$/i);

  await page.goto(portalHref!);
  await expect(page.getByRole("heading", { name: /INV-/i })).toBeVisible();
  await expect(page.getByText("Stark Industries")).toBeVisible();
  await expect(page.getByText(/Open Banking|Instant Bank-to-Bank|milestone deposit/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pay by card/i })).toHaveCount(0);

  // Public token access is intentional; an unrelated signed-in business must not see this invoice in its workspace.
  await page.context().clearCookies();
  await register(page, `other-owner-${unique}@example.test`, "Other Business");
  await page.goto("/invoices");
  await expect(page.getByText("No invoices found")).toBeVisible();
  await expect(page.getByText("Stark Industries")).toHaveCount(0);
});
