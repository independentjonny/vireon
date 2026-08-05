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
