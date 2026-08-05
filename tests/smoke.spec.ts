import { test, expect } from "playwright/test";
import * as path from "path";
import * as fs from "fs";

test.describe("Vireon smoke tests", () => {
  test("1. dashboard loads at localhost:3000", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Vireon/i);
    await expect(page.locator("#overview")).toBeVisible();
    await expect(page.getByText(/Financial command centre|Dashboard partially updated/)).toBeVisible();
  });

  test("database-health-regression: System Health API responds without forcing dashboard diagnostics", async ({ page }) => {
    const response = await page.request.get("/api/system-health");
    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.health).toBeTruthy();

    await page.goto("/");
    const screenshotDir = path.resolve(".ai");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(screenshotDir, "database-health-regression.png"), fullPage: true });
  });

  test("2. database health card does not falsely show DATABASE_URL needed when env exists", async ({ page }) => {
    const response = await page.request.get("/api/env-check");
    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.missingRequired)).toBe(true);
    const dbCheck = (json.checks as { key: string; present: boolean }[]).find((c) => c.key === "DATABASE_URL");
    if (dbCheck && dbCheck.present) {
      expect(json.missingRequired).not.toContain("DATABASE_URL");
    }
  });

  test("daily review timestamp is deterministic and AI CFO entry point stays inline on mobile", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByText(/^Snapshot \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/)).toBeVisible();
    await expect(page.getByRole("link", { name: /open review/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ask Vireon about your position/i })).toBeVisible();
    expect(pageErrors.filter((message) => message.includes("Hydration failed"))).toEqual([]);
  });

  test("dashboard stays compact and suppresses repeated briefing modules", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByText(/Largest actionable impact/i)).toHaveCount(0);
    await expect(page.getByText(/Relevant trend/i)).toHaveCount(0);
    await expect(page.getByText(/Outcome verification separate/i)).toHaveCount(0);
    await expect(page.getByTestId("dashboard-daily-review-row")).toHaveCount(1);
    await expect(page.getByTestId("dashboard-primary-workflow")).toHaveCount(1);
    await expect(page.getByTestId("dashboard-secondary-action")).toHaveCount(3);
    await expect(page.getByTestId("dashboard-ai-cfo-prompt")).toHaveCount(2);
    await expect(page.getByTestId("dashboard-workspace-link")).toHaveCount(2);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test("dashboard primary actions are keyboard focusable", async ({ page }) => {
    await page.goto("/");
    const overview = page.locator("#overview");
    const primaryAction = overview.getByRole("link", { name: /Continue workflow|Ask AI CFO/i }).first();
    const dailyReviewAction = overview.getByRole("link", { name: /Open Daily Review/i }).first();

    await primaryAction.focus();
    await expect(primaryAction).toBeFocused();
    await dailyReviewAction.focus();
    await expect(dailyReviewAction).toBeFocused();
  });

  test("bridge hardening smoke: runtime polling APIs are available and redacted", async ({ page }) => {
    const endpoints = ["/api/runtime/queue", "/api/runtime/status", "/api/runtime/heartbeat"];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);
      expect(response.ok(), `${endpoint} should respond`).toBe(true);
      const json = await response.json();
      const payload = JSON.stringify(json);

      expect(json.ok, `${endpoint} should include ok=true`).toBe(true);
      expect(payload, `${endpoint} should not expose bearer tokens`).not.toMatch(/Bearer\s+(?!<redacted>)[A-Za-z0-9._~+/=-]+/i);
      expect(payload, `${endpoint} should not expose database credentials`).not.toMatch(/postgres(?:ql)?:\/\/[^:\s/'"]+:[^@\s'"]+@/i);
      expect(payload, `${endpoint} should not expose env-style secrets`).not.toMatch(/(?:OPENAI_API_KEY|PGPASSWORD|PASSWORD|DATABASE_URL)=["']?(?!<redacted>)[^"'\s]+/i);
    }
  });

});
