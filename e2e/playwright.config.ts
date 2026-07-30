import { defineConfig, devices } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3000';
const JUDGE_URL = process.env.JUDGE_URL ?? 'http://localhost:3001';
const PUBLIC_RESULTS_URL = process.env.PUBLIC_RESULTS_URL ?? 'http://localhost:3003';
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL },
    },
    {
      name: 'judge',
      use: { ...devices['Desktop Chrome'], baseURL: JUDGE_URL },
    },
    {
      name: 'public-results',
      use: { ...devices['Desktop Chrome'], baseURL: PUBLIC_RESULTS_URL },
    },
  ],
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: 'npm run dev --workspace=@npha/server',
          url: `${API_URL}/api/v1/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
