import { type Page } from '@playwright/test';

export async function loginAs(
  page: Page,
  email = process.env.E2E_USER_EMAIL ?? '',
  password = process.env.E2E_USER_PASSWORD ?? '',
) {
  await page.goto('/login');
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill(password);
  await page.getByRole('button', { name: 'התחבר' }).click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'יציאה' }).click();
  await page.waitForURL('**/login');
}
