import { readFileSync } from "node:fs";
import { defineConfig } from "playwright/test";

if (!process.env.VIREON_UI_TEST_BASE || !process.env.VIREON_UI_TEST_STATE) throw new Error("Provide the approved Preview URL and a private Hotmail browser session file.");
const state = JSON.parse(readFileSync(process.env.VIREON_UI_TEST_STATE, "utf8"));
const cookie = state.cookies.find((item: { name: string }) => item.name === "vireon_access_token");
if (!cookie) throw new Error("The test session must contain the existing Vireon login cookie.");
const output = process.env.VIREON_UI_TEST_OUTPUT_DIR ?? ".tmp-ui-browser";
export default defineConfig({
  testDir: "./tests/customer", testMatch: "workspace-experience.spec.ts", workers: 1, retries: 0,
  timeout: 360_000, expect: { timeout: 30_000 }, outputDir: output,
  reporter: [["list"], ["json", { outputFile: `${output}/results.json` }]],
  use: {
    baseURL: process.env.VIREON_UI_TEST_BASE, storageState: process.env.VIREON_UI_TEST_STATE,
    extraHTTPHeaders: { authorization: `Bearer ${decodeURIComponent(cookie.value)}` },
    viewport: { width: 1440, height: 1000 },
    channel: process.env.VIREON_TEST_BROWSER_CHANNEL ?? "chromium",
    actionTimeout: 20_000, navigationTimeout: 60_000,
  },
});
