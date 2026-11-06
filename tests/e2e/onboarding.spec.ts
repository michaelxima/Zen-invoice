import { test, expect } from "@playwright/test";

async function completeOnboarding(page: import("@playwright/test").Page, email: string, businessName: string) {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: /Build your invoicing workspace/i })).toBeVisible();
  await page.getByRole("button", { name: /Get Started/i }).click();

  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).first().fill("SecurePassphrase-2026!");
  await page.getByLabel(/confirm password/i).fill("SecurePassphrase-2026!");
  await page.getByRole("button", { name: /Continue to account details/i }).click();

  await expect(page.getByText(/Step 2 of 3/i)).toBeVisible();
  await page.getByLabel(/first name/i).fill("Jane");
  await page.getByLabel(/last name/i).fill("Doe");
  await page.getByLabel(/company name/i).fill(businessName);
  await page.getByLabel(/^Address/i).fill("123 Market Street");
  await page.getByLabel(/^City/i).fill("San Francisco");
  await page.getByLabel(/postal code/i).fill("94105");
  await page.getByLabel(/country/i).fill("United States");
  await page.getByRole("button", { name: /Continue to business/i }).click();

  await expect(page.getByText(/Step 3 of 3/i)).toBeVisible();
  await page.getByLabel(/business name/i).fill(businessName);
  await page.getByLabel(/default currency/i).selectOption("USD");
  await page.getByRole("button", { name: /Finish and open dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("public onboarding creates a user/business and reaches the protected dashboard", async ({ page }) => {
  const email = `onboarding-${Date.now()}@example.test`;
  await completeOnboarding(page, email, "Doe Creative Studio");
  await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByLabel(/Business name/i)).toHaveValue("Doe Creative Studio");
});
