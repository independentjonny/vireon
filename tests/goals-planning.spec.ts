import { expect, test } from "@playwright/test";

test("goals planning creates and compares deterministic goals", async ({ page }) => {
  await page.goto("/goals");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Integrated Goals" })).toBeVisible();
  await expect(page.getByText("Retire at 60").first()).toBeVisible();

  await page.getByLabel("Title").fill(`Emergency fund ${Date.now()}`);
  await page.getByLabel("Target amount").fill("30000");
  await page.getByLabel("Current amount").fill("5000");
  await page.getByRole("spinbutton", { name: "Monthly contribution", exact: true }).fill("1000");
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText(/goal created/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Required monthly").first()).toBeVisible();
  await expect(page.getByText("25% funded").first()).toBeVisible();

  await page.getByRole("button", { name: "Home purchase" }).click();
  await page.getByLabel("Title").fill(`Home deposit ${Date.now()}`);
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText(/Home deposit .* goal created/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Indicative loan").first()).toBeVisible();

  await page.getByLabel("Accelerated monthly contribution").fill("1800");
  await page.getByRole("button", { name: "Compare accelerated" }).first().click();
  await expect(page.getByText("Accelerated scenario compared.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Completion change:").first()).toBeVisible();
  await expect(page.getByText("Goal assumptions require review").first()).toBeVisible();

  await page.getByRole("button", { name: "Pause goal" }).first().click();
  await expect(page.getByText("Goal paused.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Archive goal" }).first().click();
  await expect(page.getByText("Goal archived.")).toBeVisible({ timeout: 15_000 });
});

test("goals planning mobile workflow", async ({ page }) => {
  await page.goto("/goals");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Integrated Goals" })).toBeVisible();
  await expect(page.getByText("Scenario comparison")).toBeVisible();
  await expect(page.getByText("AI CFO goal context")).toBeVisible();
});
