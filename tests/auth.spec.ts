import { test, expect } from '@playwright/test';

test('home loads and shows Zen-Invoice', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Zen-Invoice/);
});

test('onboarding page loads', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page.locator('h1')).toBeVisible();
});
