import { expect, test } from "@playwright/test";

test("financial timeline baseline and scenario workflow", async ({ page }) => {
  await page.goto("/digital-twin/timeline");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Forward financial timeline" })).toBeVisible();
  await expect(page.getByText("Forecast quality", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming events")).toBeVisible();

  await page.getByRole("button", { name: "Compare extra repayment" }).click();
  await expect(page.getByText("Extra repayment scenario calculated")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Debt change:")).toBeVisible();

  await page.getByLabel("One-off expense in month 2").fill("50000");
  await page.getByRole("button", { name: "Compare one-off expense" }).click();
  await expect(page.getByText("One-off expense scenario calculated")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Projected cash shortfall").first()).toBeVisible();

  await page.getByRole("button", { name: "Reset scenario" }).click();
  await expect(page.getByText("Scenario reset to baseline.")).toBeVisible();
});

test("financial timeline mobile workflow", async ({ page }) => {
  await page.goto("/digital-twin/timeline");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Forward financial timeline" })).toBeVisible();
  await expect(page.getByText("Scenario manager")).toBeVisible();
  await expect(page.getByText("AI CFO forecast context")).toBeVisible();
});
