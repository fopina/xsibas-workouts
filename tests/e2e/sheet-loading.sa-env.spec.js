import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
import { mintServiceAccountAccessToken, GOOGLE_PICKER_SCOPES } from '../../scripts/google-auth-utils.mjs';

if (existsSync('.env.test')) {
  dotenv.config({ path: '.env.test' });
}

let cachedServiceAccountToken;

async function getAccessToken() {
  if (process.env.GOOGLE_TOKEN) return process.env.GOOGLE_TOKEN;
  if (cachedServiceAccountToken) return cachedServiceAccountToken;

  const result = await mintServiceAccountAccessToken({
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKeyRaw: process.env.GOOGLE_PRIVATE_KEY,
    scopes: GOOGLE_PICKER_SCOPES,
  });
  cachedServiceAccountToken = result.accessToken;
  return cachedServiceAccountToken;
}

async function primeAuthState(page, token) {
  await page.addInitScript(({ token: accessToken }) => {
    localStorage.setItem('google_access_token', accessToken);
    localStorage.setItem('google_user_name', 'Service Account');
  }, { token });
}

async function expectWorkoutViewLoaded(page, sheetId) {
  await expect(page).toHaveURL(new RegExp(`/workout\\?sheet=${sheetId}`));
  await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();

  // Wait for the workout view (not just the sheet selector) to render.
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Month View' })).toBeVisible();
}

test('loads a shared sheet using service-account token from env', async ({ page }) => {
  const sheetId = process.env.TEST_SPREADSHEET_ID;
  const hasServiceAccountCreds = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );

  test.skip(
    !sheetId || (!process.env.GOOGLE_TOKEN && !hasServiceAccountCreds),
    'Requires TEST_SPREADSHEET_ID and either GOOGLE_TOKEN or service-account credentials in .env.test'
  );

  const token = await getAccessToken();
  await primeAuthState(page, token);

  await page.goto(`/workout?sheet=${sheetId}`);
  await expectWorkoutViewLoaded(page, sheetId);
});

test('loads a shared sheet via the sheet selector form button', async ({ page }) => {
  const sheetId = process.env.TEST_SPREADSHEET_ID;
  const hasServiceAccountCreds = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );

  test.skip(
    !sheetId || (!process.env.GOOGLE_TOKEN && !hasServiceAccountCreds),
    'Requires TEST_SPREADSHEET_ID and either GOOGLE_TOKEN or service-account credentials in .env.test'
  );

  const token = await getAccessToken();
  await primeAuthState(page, token);

  await page.goto('/workout');

  await expect(page.getByRole('heading', { name: 'Load New Sheet' })).toBeVisible();
  await page.getByPlaceholder('Sheet URL or ID').fill(sheetId);
  await page.getByRole('button', { name: 'Load Workout Sheet' }).click();

  await expectWorkoutViewLoaded(page, sheetId);
});
