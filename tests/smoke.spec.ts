import { test, expect } from "playwright/test";
import * as path from "path";
import * as fs from "fs";

test.describe("Neven smoke tests", () => {
  test("1. dashboard loads at localhost:3000", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Neven/i);
    await expect(page.locator("#overview")).toBeVisible();
  });

  test("database-health-regression: System Health Database row shows correct message", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.locator("main").waitFor({ timeout: 10000 });

    // UIToggleWrapper defaults to v3 mode. Click "Toggle UI" once to reach v1 (children mode)
    // which renders the System Health panel with systemComponents.
    const toggleBtn = page.locator("button", { hasText: "Toggle UI" }).first();
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
    await toggleBtn.click();

    // Wait for v1 mode label to confirm the toggle worked
    await expect(page.locator("text=UI v1 — Standard Dashboard")).toBeVisible({ timeout: 5000 });

    // Database row must contain the expected message
    const dbText = page.locator("text=Connected database configuration detected");
    await expect(dbText).toBeVisible({ timeout: 5000 });

    // Database row must NOT contain the degraded message
    await expect(page.locator("text=DATABASE_URL needed")).not.toBeVisible();

    // Scroll to make the System Health panel visible and capture screenshot as known-good baseline
    await dbText.scrollIntoViewIfNeeded();
    const screenshotDir = path.resolve(".ai");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(screenshotDir, "database-health-regression.png"), fullPage: false });
  });

  test("2. database health card does not falsely show DATABASE_URL needed when env exists", async ({
    page,
  }) => {
    const response = await page.request.get("/api/env-check");
    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.missingRequired)).toBe(true);
    // If DATABASE_URL is set server-side, it should not appear as missing
    const dbCheck = (json.checks as { key: string; present: boolean }[]).find(
      (c) => c.key === "DATABASE_URL"
    );
    if (dbCheck && dbCheck.present) {
      expect(json.missingRequired).not.toContain("DATABASE_URL");
    }
  });

  test("3. mobile hamburger opens navigation menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const hamburger = page.getByRole("button", { name: /open navigation menu/i });
    await expect(hamburger).toBeVisible();

    await hamburger.click();

    const nav = page.locator("aside").filter({ hasText: "Neven" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Overview" })).toBeVisible();
  });

  test("4. main navigation buttons work", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const hamburger = page.getByRole("button", { name: /open navigation menu/i });
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    const aside = page.locator("aside").filter({ hasText: "Neven" });
    await expect(aside).toBeVisible();

    // All nav items should be present
    const navLabels = ["Overview", "Transactions", "Subscriptions"];
    for (const label of navLabels) {
      await expect(aside.getByRole("link", { name: label })).toBeVisible();
    }

    // Clicking Overview should close the menu
    await aside.getByRole("link", { name: "Overview" }).click();
    await expect(aside).not.toBeVisible();
  });
});
