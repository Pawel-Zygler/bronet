const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8000";

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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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

