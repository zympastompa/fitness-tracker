import { defineConfig } from "@playwright/test";

const port = 8000;
const baseURL = `http://127.0.0.1:${port}`;
const e2eDataDir = "e2e/.tmp";
const e2eDbPath = "e2e/.tmp/fitness_tracker_e2e.sqlite3";
const startCommand = [
  `rm -rf ${e2eDataDir}`,
  `mkdir -p ${e2eDataDir}`,
  `touch ${e2eDbPath}`,
  `FITNESS_TRACKER_DB_PATH=${e2eDbPath} FITNESS_TRACKER_HOST=127.0.0.1 FITNESS_TRACKER_PORT=${port} python3 main.py`
].join(" && ");

export default defineConfig({
  testDir: "e2e/tests",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: startCommand,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe"
  }
});
