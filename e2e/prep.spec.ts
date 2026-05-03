import { expect, test } from '@playwright/test';

import { loginAs } from './helpers/auth';

test.describe('prep tasks', () => {
  test.skip(!process.env.E2E_USER_EMAIL, 'requires E2E_USER_EMAIL env var');

  test('navigates to prep list page', async ({ page }) => {
    await loginAs(page);
    await page.getByRole('link', { name: 'רשימת הכנות' }).click();
    await expect(page).toHaveURL(/\/prep/);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('prep page renders in RTL', async ({ page }) => {
    await loginAs(page);
    await page.getByRole('link', { name: 'רשימת הכנות' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
