import { expect, test } from "playwright/test";

// UI contract rehearsal only: confirmation responses are synthetic. PostgreSQL
// durability and user isolation are validated separately, never claimed here.
test("upload, review and explicit confirmation stay usable on desktop and mobile", async ({ page }, testInfo) => {
  let confirms = 0;
  await page.route("**/api/financial-setup", async route => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: { drafts: [], records: [] } });
    if (request.headers()["content-type"]?.includes("multipart/form-data")) return route.continue();
    const body = request.postDataJSON();
    if (body.action === "confirm") confirms++;
    await route.fulfill({ json: { draft: { ...body.draft, revision: body.draft.revision + 1, updatedAt: "2026-10-31T00:00:00Z", status: body.action === "confirm" ? "confirmed" : "draft", confirmedCount: body.action === "confirm" ? 1 : undefined } } });
  });
  await page.goto("/financial-profile/add-data");
  await expect(page.getByRole("heading", { name: "Build your financial picture" })).toBeVisible();
  if (testInfo.project.name === "desktop") {
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(navigation.getByRole("link", { name: "Add financial data", exact: true })).toHaveAttribute("aria-current", "page");
  }
  await page.getByLabel("Choose financial documents").setInputFiles({ name: "synthetic-statement.txt", mimeType: "text/plain", buffer: Buffer.from("Synthetic bank statement. Closing balance: $2,345.67. Statement date 2026-10-01.") });
  await expect(page.getByText("Document suggestions saved as a draft.", { exact: false })).toBeVisible();
  expect(confirms).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("uploaded.png"), fullPage: true });
  await page.getByRole("button", { name: "Check details", exact: true }).click();
  await expect(page.getByLabel("Balance / value (AUD)")).toHaveValue("2345.67");
  await page.getByLabel("Account or item name").fill("Synthetic everyday account");
  await page.getByLabel("Statement / effective date").fill("2026-10-01");
  await page.getByLabel("Whose amount is this?").selectOption("Sole");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review your changes" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm and update my position" });
  await expect(confirm).toBeDisabled();
  expect(confirms).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("review.png"), fullPage: true });
  await page.getByRole("checkbox", { name: /I have checked these values/ }).check();
  await confirm.click();
  await expect(page.getByRole("heading", { name: "Your position has been updated" })).toBeVisible();
  expect(confirms).toBe(1);
  const viewport = page.viewportSize()!;
  expect(await page.locator("main.fs-page").evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(viewport.width + 1);
  await page.screenshot({ path: testInfo.outputPath("confirmed.png"), fullPage: true });
});

test("failed confirmation keeps reviewed values and permits an explicit retry", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/financial-setup", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { drafts: [], records: [] } });
    const body = route.request().postDataJSON();
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: "Could not save. Try again." } });
    return route.fulfill({ json: { draft: { ...body.draft, revision: 1, status: "confirmed", confirmedCount: 1, updatedAt: "2026-10-31T00:00:00Z" } } });
  });
  await page.goto("/financial-profile/add-data");
  await page.getByRole("button", { name: "Enter details manually" }).click();
  await page.getByLabel("Account or item name").fill("Synthetic emergency savings");
  await page.getByLabel("Balance / value (AUD)").fill("1200");
  await page.getByLabel("Statement / effective date").fill("2026-10-01");
  await page.getByLabel("Whose amount is this?").selectOption("Sole");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("checkbox", { name: /I have checked these values/ }).check();
  const confirm = page.getByRole("button", { name: "Confirm and update my position" });
  await confirm.click();
  await expect(page.locator("main.fs-page").getByRole("alert")).toHaveText("Could not save. Try again.");
  await expect(page.getByRole("heading", { name: "Review your changes" })).toBeVisible();
  await expect(page.getByText("$1,200.00", { exact: true })).toBeVisible();
  await confirm.click();
  await expect(page.getByRole("heading", { name: "Your position has been updated" })).toBeVisible();
  expect(attempts).toBe(2);
});
