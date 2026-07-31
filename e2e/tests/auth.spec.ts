import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@npha.org.np';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'NphaAdmin@2024!';

test.describe('Admin authentication', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'AeroJudge' })).toBeVisible();

    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/dashboard|competitions|AeroJudge/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/login failed|invalid|credentials/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
