import { test, expect } from '@playwright/test';

const JUDGE_EMAIL = process.env.SEED_JUDGE_EMAIL ?? 'judge@npha.org.np';
const JUDGE_PASSWORD = process.env.SEED_JUDGE_PASSWORD ?? 'Judge@2024!';

test.describe('Judge scoring UI', () => {
  test('login page loads', async ({ page, request }) => {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    const health = await request.get(`${apiUrl}/api/v1/health`);

    test.skip(!health.ok(), 'API server is not running – skipping judge UI tests');

    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'AeroJudge' })).toBeVisible();
    await expect(page.getByRole('button', { name: /start scoring session/i })).toBeVisible();
  });

  test('judge can sign in and reach round selection', async ({ page, request }) => {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    const health = await request.get(`${apiUrl}/api/v1/health`);

    test.skip(!health.ok(), 'API server is not running – skipping judge UI tests');

    await page.goto('/login');

    await page.getByLabel('Email').fill(JUDGE_EMAIL);
    await page.getByLabel('Password').fill(JUDGE_PASSWORD);
    await page.getByRole('button', { name: /start scoring session/i }).click();

    await expect(page).toHaveURL(/\/rounds/, { timeout: 15_000 });
    await expect(page.getByText(/round|select/i).first()).toBeVisible();
  });
});
