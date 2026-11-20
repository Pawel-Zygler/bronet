const { defineConfig, devices } = require("@playwright/test");

const { baseURL, isRemoteTarget } = require("./e2e/support/env");

const reporters = process.env.CI ? [["list"], ["github"]] : [["list"]];

if (process.env.CURRENTS_RECORD_KEY && process.env.CURRENTS_PROJECT_ID) {
  try {
    const { currentsReporter } = require("@currents/playwright");
    reporters.push(
      currentsReporter({
        projectId: process.env.CURRENTS_PROJECT_ID,
        recordKey: process.env.CURRENTS_RECORD_KEY,
      })
    );
  } catch (_) {}
}

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: process.env.CI ? 2 : 3,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  grepInvert: isRemoteTarget ? /@local-only/ : undefined,
  // Retry zostaje, żeby zebrać trace z drugiej próby, ale w CI test, który przeszedł
  // dopiero za drugim razem (flaky), oblewa cały przebieg zamiast być ukrywany.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: reporters,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
        url: "http://127.0.0.1:8000/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
