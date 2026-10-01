import "dotenv/config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, timeout: 60_000,
  expect: { timeout: 10_000 }, retries: 0,
  use: { baseURL: "http://127.0.0.1:3100", viewport: { width: 1440, height: 1000 }, trace: "off", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" } }],
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/login", reuseExistingServer: false, timeout: 120_000,
    env: { E2E_BUILD: "1", NOTIFICATION_PROVIDER: "mock", APP_URL: "http://127.0.0.1:3100", NEXTAUTH_URL: "http://127.0.0.1:3100", AUTH_SECRET: "local-e2e-only-never-production-secret-3100", RATE_LIMIT_IP_HEADER: "x-e2e-client-ip" },
  },
});
