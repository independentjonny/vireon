import { expect, test } from "@playwright/test";

test.describe("Model developer workspaces", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`model evaluation review dashboard renders on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/model-evaluation");

      await expect(page.getByRole("heading", { name: "Evaluation & Trust Framework" })).toBeVisible();
      await expect(page.getByText("Live run review and remediation")).toBeVisible();
      await expect(page.getByText("Reviews").first()).toBeVisible();
      await expect(page.getByText("Expansion blocked; promotion disabled")).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });

    test(`model orchestrator status renders on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/model-orchestrator");

      await expect(page.getByRole("heading", { name: "Model Orchestrator" })).toBeVisible();
      await expect(page.getByText("Live synthetic adapter status")).toBeVisible();
      await expect(page.getByText("Blocked sensitivity levels")).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });
  }
});
