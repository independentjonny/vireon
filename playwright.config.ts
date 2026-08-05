import { defineConfig, devices } from "playwright/test";

const localValidationBearer = "__vireon_local_dev_proxy_session__";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: {
      authorization: `Bearer ${localValidationBearer}`,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    env: {
      ...process.env,
      VIREON_DEV_AUTH_BYPASS: "true",
      NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS: "true",
      VIREON_DEV_AUTH_ROLE: process.env.VIREON_DEV_AUTH_ROLE ?? "owner",
      VIREON_DEV_AUTH_USER_ID: process.env.VIREON_DEV_AUTH_USER_ID ?? "00000000-0000-4000-8000-000000000001",
      VIREON_DEV_AUTH_EMAIL: process.env.VIREON_DEV_AUTH_EMAIL ?? "dev@local.test",
    },
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
