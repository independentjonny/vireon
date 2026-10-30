import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./tests/customer",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3127",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3127",
    env: {
      VIREON_DEV_AUTH_BYPASS: "true",
      NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS: "true",
      VIREON_DEV_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
      VIREON_PILOT_APPLICATION_DATABASE_URL: "",
      VIREON_PILOT_DATABASE_URL: "",
      VIREON_PILOT_MIGRATION_DATABASE_URL: "",
      VIREON_PILOT_RESTORE_DATABASE_URL: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    url: "http://127.0.0.1:3127/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
