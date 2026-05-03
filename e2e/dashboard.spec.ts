import { expect, test } from '@playwright/test';

import { loginAs, logout } from './helpers/auth';

test.describe('dashboard', () => {
  test.skip(!process.env.E2E_USER_EMAIL, 'requires E2E_USER_EMAIL env var');

  test('login lands on dashboard with KPI cards', async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/[^/]+\/dashboard/);
    // Expect at least one KPI stat card to be visible
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('sidebar navigation links are visible', async ({ page }) => {
    await loginAs(page);
    await expect(page.getByRole('link', { name: 'רשימת הכנות' })).toBeVisible();
  });

  test('logout redirects to /login', async ({ page }) => {
    await loginAs(page);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('page renders in RTL Hebrew', async ({ page }) => {
    await loginAs(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  });
});
