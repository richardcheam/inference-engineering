import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests cover what `node --test` cannot: the built page's composition.
 * They encode the Phase 8 quality gate from
 * `fashion_engineering_frontend_skill/RESPONSIVE_REFACTOR_TASK.md`, so the gate
 * can be re-run instead of re-measured by hand.
 *
 * Uses the installed Chrome rather than a downloaded browser build, so the
 * suite runs without a 150 MB first-run download.
 */
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
