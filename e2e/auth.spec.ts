import { expect, test } from '@playwright/test';

test.describe('auth flows', () => {
  test('unauthenticated visit redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders in Hebrew RTL', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'כניסה למערכת' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('אימייל').fill('wrong@example.com');
    await page.getByLabel('סיסמה').fill('wrongpassword');
    await page.getByRole('button', { name: 'התחבר' }).click();
    await expect(page.getByRole('alert')).toContainText('אימייל או סיסמה שגויים');
  });

  test('reset-password page renders', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'שכחת סיסמה?' })).toBeVisible();
  });

  test('signup page renders', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'יצירת חשבון' })).toBeVisible();
  });
});
