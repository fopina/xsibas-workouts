import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

if (existsSync('.env.test')) {
  dotenv.config({ path: '.env.test' });
}

test('loads a shared sheet using service-account token from env', async ({ page }) => {
  const token = process.env.GOOGLE_TOKEN;
  const sheetId = process.env.TEST_SPREADSHEET_ID;

  test.skip(!token || !sheetId, 'Requires GOOGLE_TOKEN and TEST_SPREADSHEET_ID');

  await page.addInitScript(({ token: accessToken }) => {
    localStorage.setItem('google_access_token', accessToken);
    localStorage.setItem('google_user_name', 'Service Account');
  }, { token });

  await page.goto(`/workout?sheet=${sheetId}`);

  await expect(page).toHaveURL(new RegExp(`/workout\\?sheet=${sheetId}`));
  await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();

  // Wait for the workout view (not just the sheet selector) to render.
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Month View' })).toBeVisible();
});
