import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "SecurePassphrase-2026!";
const uniqueEmail = (label: string) => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function completeOnboarding(page: Page, email: string, businessName: string) {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: /Build your invoicing workspace/i })).toBeVisible();
  await page.getByRole("button", { name: /Get Started/i }).click();

  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).first().fill(PASSWORD);
  await page.getByLabel(/confirm password/i).fill(PASSWORD);
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
  await completeOnboarding(page, uniqueEmail("onboarding"), "Doe Creative Studio");
  await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByLabel(/Business name/i)).toHaveValue("Doe Creative Studio");
});

test("keyboard only: Tab between fields and Enter to submit keeps the latest values and saves the tax ID", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Get Started/i }).click();

  // Step 1: focus starts in the first field; the last field is submitted with Enter while it still has focus.
  await expect(page.getByLabel(/email address/i)).toBeFocused();
  await page.keyboard.type(uniqueEmail("keyboard"));
  await page.keyboard.press("Tab");
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Tab");
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Enter");

  // Step 2: Tab order follows the visual order; the company field is skipped (optional).
  await expect(page.getByText(/Step 2 of 3/i)).toBeVisible();
  await expect(page.getByLabel(/first name/i)).toBeFocused();
  for (const [value, tabs] of [
    ["Kim", 1],
    ["Lund", 2],
    ["Storgatan 1", 1],
    ["Stockholm", 1],
    ["111 22", 2],
    ["Sweden", 0],
  ] as const) {
    await page.keyboard.type(value);
    for (let i = 0; i < tabs; i += 1) await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");

  // Step 3.
  await expect(page.getByText(/Step 3 of 3/i)).toBeVisible();
  await expect(page.getByLabel(/business name/i)).toBeFocused();
  await page.keyboard.type("Lund Konsult AB");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/tax id/i)).toBeFocused();
  await page.keyboard.type("SE556677889901");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/settings");
  await expect(page.getByLabel(/Business name/i)).toHaveValue("Lund Konsult AB");
  await expect(page.getByLabel(/Tax ID/i)).toHaveValue("SE556677889901");
  await expect(page.getByLabel(/Business address/i)).toHaveValue("Storgatan 1, Stockholm, 111 22, Sweden");
});

test("Back and forward between steps keeps every value", async ({ page }) => {
  const email = uniqueEmail("back");
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Get Started/i }).click();
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).first().fill(PASSWORD);
  await page.getByLabel(/confirm password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /Continue to account details/i }).click();

  await page.getByLabel(/first name/i).fill("Alex");
  await page.getByLabel(/company name/i).fill("Morgan Advisory");
  await page.getByRole("button", { name: /^Back$/ }).click();

  await expect(page.getByLabel(/email address/i)).toHaveValue(email);
  await expect(page.getByLabel(/confirm password/i)).toHaveValue(PASSWORD);
  await page.getByRole("button", { name: /Continue to account details/i }).click();
  await expect(page.getByLabel(/first name/i)).toHaveValue("Alex");
  await expect(page.getByLabel(/company name/i)).toHaveValue("Morgan Advisory");

  // Required fields left empty are reported, and nothing typed so far is lost.
  await page.getByRole("button", { name: /Continue to business/i }).click();
  await expect(page.getByText("Last name is required.")).toBeVisible();
  await expect(page.getByLabel(/last name/i)).toBeFocused();
  await expect(page.getByLabel(/first name/i)).toHaveValue("Alex");
});

test("a duplicate email is reported on the email field", async ({ page, browser, baseURL }) => {
  const email = uniqueEmail("duplicate");
  await completeOnboarding(page, email, "First Owner Ltd");

  // A separate, signed-out browser context for the second registration attempt.
  const context = await browser.newContext({ baseURL });
  const second = await context.newPage();
  try {
    await completeOnboardingExpectingFailure(second, email);
    await expect(second.getByText(/Step 1 of 3/i)).toBeVisible();
    await expect(second.getByText("An account with this email already exists.")).toBeVisible();
    await expect(second.getByLabel(/email address/i)).toHaveValue(email);
  } finally {
    await context.close();
  }
});

async function completeOnboardingExpectingFailure(page: Page, email: string) {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Get Started/i }).click();
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).first().fill(PASSWORD);
  await page.getByLabel(/confirm password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /Continue to account details/i }).click();
  await page.getByLabel(/first name/i).fill("Second");
  await page.getByLabel(/last name/i).fill("Person");
  await page.getByLabel(/^Address/i).fill("1 Other Road");
  await page.getByLabel(/^City/i).fill("Oslo");
  await page.getByLabel(/postal code/i).fill("0150");
  await page.getByLabel(/country/i).fill("Norway");
  await page.getByRole("button", { name: /Continue to business/i }).click();
  await page.getByLabel(/business name/i).fill("Second Owner AS");
  await page.getByRole("button", { name: /Finish and open dashboard/i }).click();
}

test.describe("global shortcuts never eat typed text", () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page, uniqueEmail("shortcuts"), "Shortcut Testers");
  });

  test("n and / typed into a textarea and an input stay in the field", async ({ page }) => {
    await page.goto("/settings");
    const address = page.getByLabel(/Business address/i);
    await address.fill("");
    await address.pressSequentially("1 n/ Main St");
    await expect(address).toHaveValue("1 n/ Main St");
    await expect(page).toHaveURL(/\/settings$/);

    const taxId = page.getByLabel(/Tax ID/i);
    await taxId.fill("");
    await taxId.pressSequentially("n/1");
    await expect(taxId).toHaveValue("n/1");
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("outside a field, / focuses invoice search and n opens a new invoice", async ({ page }) => {
    await page.goto("/invoices");
    await page.getByRole("heading").first().click();
    await page.keyboard.press("/");
    const search = page.getByLabel("Search invoices");
    await expect(search).toBeFocused();
    await page.keyboard.type("n/");
    await expect(search).toHaveValue("n/");
    await expect(page).toHaveURL(/\/invoices$/);

    await page.getByRole("heading").first().click();
    await page.keyboard.press("n");
    await expect(page).toHaveURL(/\/invoices\/new$/);
  });
});
