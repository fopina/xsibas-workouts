import { test, expect } from '@playwright/test';

test('landing page loads and opens sheet selector', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Workout Planner' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();

  await page.getByRole('button', { name: 'Get Started' }).click();

  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole('heading', { name: 'Load New Sheet' })).toBeVisible();
  await expect(page.getByPlaceholder('Sheet URL or ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load Workout Sheet' })).toBeVisible();
});
