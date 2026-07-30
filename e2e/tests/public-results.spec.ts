import { test, expect } from '@playwright/test';

test.describe('Public results', () => {
  test('leaderboard page loads and shows competition title', async ({ page, request }) => {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    const health = await request.get(`${apiUrl}/api/v1/health`);

    test.skip(!health.ok(), 'API server is not running');

    await page.goto('/?slug=npha-acc-2024');

    await expect(page.getByTestId('public-results-title')).toBeVisible();
    await expect(page.getByTestId('competition-name')).toBeVisible({ timeout: 15_000 });
  });

  test('public API returns competition data', async ({ request }) => {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    const health = await request.get(`${apiUrl}/api/v1/health`);

    test.skip(!health.ok(), 'API server is not running');

    const response = await request.get(`${apiUrl}/api/v1/public/npha-acc-2024`);
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toContain('NPHA');
  });
});
