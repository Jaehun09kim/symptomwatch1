import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
const baseURL = `http://localhost:${PORT}`;

/**
 * End-to-end tests run against a production build with a throwaway PGlite
 * database in .data/e2e (wiped before each run). Tests share one database and
 * run serially.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: `rm -rf .data/e2e .data/e2e.lock && npm run build && npx next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      PGLITE_DATA_DIR: ".data/e2e",
      SESSION_SECRET: "e2e-only-session-secret-0123456789abcdef",
      SEED_SHARED_DEMO_ACCOUNTS: "true",
      DEMO_ACCOUNT_PASSWORD: "SymptomWatch-Demo-2026",
      APP_BASE_URL: baseURL,
      RATE_LIMIT_SCALE: "50",
      DEV_OUTBOX_ENABLED: "true",
    },
  },
});
