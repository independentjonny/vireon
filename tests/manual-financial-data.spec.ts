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
  await page.route("**/api/addresses/australian?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        suggestions: [{
          id: "GAVIC421193859",
          address: "12 SMITH ST, ALPHINGTON VIC 3078",
          locality: "ALPHINGTON",
          state: "VIC",
          postcode: "3078",
          provider: "geoscape-gnaf",
        }],
      }),
    });
  });
  await page.route("**/api/financial-vault", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        vault: {
          uploaded_documents: [
            { id: "mortgage-1", fileName: "home-loan-statement-july-2026.pdf", documentType: "mortgage_statement", uploadedAt: "2026-08-01T00:00:00.000Z", status: "extracted" },
            { id: "tax-1", fileName: "tax-return-2025.pdf", documentType: "tax_return", uploadedAt: "2026-07-15T00:00:00.000Z", status: "needs_review" },
          ],
        },
      }),
    });
  });
  await page.goto("/financial-profile/add-data");
  await expect(page.getByRole("heading", { name: "Add financial data" })).toBeVisible();
  await page.getByRole("button", { name: /Property & rent/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Add property details" })).toBeVisible();
  await page.getByLabel("Property address").fill("12 Smith Street");
  await page.getByRole("option", { name: "12 SMITH ST, ALPHINGTON VIC 3078" }).click();
  await expect(page.getByText("Australian address selected")).toBeVisible();
  await page.getByLabel("Estimated value").fill("$970,000");
  await page.getByLabel("This property has a mortgage").check();
  await page.getByLabel("Lender").fill("Example Bank");
  await page.getByLabel("Outstanding balance").fill("$270,000");
  await page.getByLabel("Interest rate").fill("5.89");
  await page.getByLabel("Repayment amount").fill("$2,150");
  const workflowUrl = page.url();
  await page.getByRole("button", { name: "Choose from Document Vault" }).click();
  await expect(page).toHaveURL(workflowUrl);
  await expect(page.getByText("Current Document Vault")).toBeVisible();
  await page.getByLabel(/home-loan-statement-july-2026\.pdf/).check();
  await expect(page.getByText("home-loan-statement-july-2026.pdf")).toHaveCount(2);
  await page.getByRole("button", { name: "Review details" }).click();
  await expect(page.getByRole("heading", { name: "Review property information" })).toBeVisible();
  await expect(page.getByText("Geoscape Australia (G-NAF) address selection")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Mortgage balance" })).toBeVisible();
  await expect(page.getByText("Verify in Import Review")).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue to Import Review/ })).toHaveAttribute("href", "/financial-vault/imports");
});
