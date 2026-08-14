import { expect, test } from "@playwright/test";

test("manual import review works on desktop and mobile", async ({ page }) => {
  await page.goto("/financial-vault/imports");
  await expect(page.getByRole("heading", { name: "Import review workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Preview and map CSV" }).click();
  await expect(page.getByRole("button", { name: "Accept" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).first().click();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText(/canonical transaction\(s\) created/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Review transactions" })).toBeVisible();
});

test("first-value onboarding explains manual data path", async ({ page }) => {
  await page.goto("/beta-onboarding");
  await expect(page.getByRole("heading", { name: "Set up Vireon safely" })).toBeVisible();
});

test("guided financial data workflow reaches property review without changing Vault authority", async ({ page }) => {
  await page.goto("/financial-profile/add-data");
  await expect(page.getByRole("heading", { name: "Add financial data" })).toBeVisible();
  await page.getByRole("button", { name: /Property & rent/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Add property details" })).toBeVisible();
  await page.getByLabel("Property address").fill("18 Example Street, Hillside VIC 3037");
  await page.getByLabel("Estimated value").fill("$970,000");
  await page.getByRole("button", { name: "Review details" }).click();
  await expect(page.getByRole("heading", { name: "Review property information" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue to Import Review/ })).toHaveAttribute("href", "/financial-vault/imports");
});
