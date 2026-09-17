import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

/**
 * Browser tests cover what `node --test` cannot: the built page's composition.
 * They encode the design system's quality gate, recorded in
 * `docs/superpowers/specs/2026-09-16-design-system.md`, so it can be re-run
 * rather than re-measured by hand.
 *
 * Uses the installed Chrome rather than a downloaded browser build, so the
 * suite runs without a 150 MB first-run download.
 */
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  reporter: CI ? 'github' : 'list',
  // Locally this drives the Chrome that is already installed, so the suite runs
  // without a 150 MB first-run download. A CI runner has no Chrome, so there it
  // falls back to Playwright's own Chromium, which the workflow installs.
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(CI ? {} : { channel: 'chrome' }),
  },
  // Two retries on CI. These tests drive real scroll and IntersectionObserver
  // timing, which a shared runner can stretch; a retry distinguishes a slow
  // machine from a broken layout.
  retries: CI ? 2 : 0,
  projects: [{
    name: 'chrome',
    use: { ...devices['Desktop Chrome'], ...(CI ? {} : { channel: 'chrome' }) },
  }],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
