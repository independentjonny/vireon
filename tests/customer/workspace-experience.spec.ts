import { test, expect } from "playwright/test";

test.skip(process.env.VIREON_UI_TEST_ACCOUNT !== "boardn@hotmail.com", "Opt-in account test; use the dedicated workspace configuration.");

const prefix = "QA UI 20261102";
let cleanAtStart = false;
test.beforeAll(async ({ request, playwright }) => {
  if (process.env.VIREON_UI_TEST_BASE?.startsWith("https://")) {
    const cookieOnly = await playwright.request.newContext({ baseURL: process.env.VIREON_UI_TEST_BASE, storageState: process.env.VIREON_UI_TEST_STATE });
    try { expect((await cookieOnly.get("/api/auth/session")).status()).toBe(200); } finally { await cookieOnly.dispose(); }
  }
  const session = await (await request.get("/api/auth/session")).json();
  expect(session.session.email).toBe("boardn@hotmail.com");
  expect(session.session.userId).toBe("3c57a67e-01cf-4fdf-9c34-7236f9be1598");
  const setup = await (await request.get("/api/financial-setup")).json();
  expect(setup.records).toHaveLength(0);
  expect(setup.drafts).toHaveLength(0);
  cleanAtStart = true;
});
test.afterAll(async ({ request }) => {
  if (!cleanAtStart) return;
  const setup = await (await request.get("/api/financial-setup")).json();
  // Remove only this run's disposable financial state, never an existing balance.
  expect(setup.records.every((record: { label: string }) => record.label.startsWith(prefix))).toBe(true);
  expect(setup.drafts.every((draft: { entries: { label: string }[] }) => draft.entries.every(entry => entry.label.startsWith(prefix)))).toBe(true);
  if (setup.records.length || setup.drafts.length) {
    const reset = await request.post(`${process.env.VIREON_UI_TEST_RESET_ORIGIN ?? ""}/api/private-beta/financial-data-reset`, { data: { confirmation: "DELETE MY FINANCIAL DATA" } });
    expect(reset.ok()).toBe(true);
  }
  const after = await (await request.get("/api/financial-setup")).json();
  expect(after.records).toHaveLength(0);
  expect(after.drafts).toHaveLength(0);
});

test("Hotmail user can set up, resume, confirm and navigate the refreshed workspace", async ({ page, request }, testInfo) => {
  test.setTimeout(360_000);
  page.setDefaultTimeout(20_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your financial picture starts here" })).toBeVisible();
  await expect(page.getByText("0 of 3 areas recorded")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await page.screenshot({ path: testInfo.outputPath("empty-desktop.png"), fullPage: true, caret: "initial" });
  await page.getByRole("link", { name: "Start with income" }).click();
  await expect(page.getByLabel("Information type")).toHaveValue("income");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.locator("main.fs-page").getByRole("alert")).toContainText("Give each item");
  await page.getByLabel("Account or item name").fill(`${prefix} income`);
  await page.getByLabel("Take-home amount (AUD)").fill("3000");
  await page.getByLabel("How often?").selectOption("fortnightly");
  await expect(page.getByText("Monthly equivalent: $6,500.00")).toBeVisible();
  await page.getByLabel("Statement / effective date").fill("2026-11-01");
  await page.getByLabel("Whose amount is this?").selectOption("Sole");
  await page.getByRole("button", { name: "Save and finish later" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved to your account" })).toBeVisible();
  await page.getByRole("link", { name: "Return to Dashboard" }).click();
  await expect(page.getByText("0 of 3 areas recorded")).toBeVisible();
  await page.getByRole("link", { name: "Start with income" }).click();
  // A targeted category starts a new entry; saved updates are accessible from Back.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Continue saved setup" }).click();
  await expect(page.getByLabel("Account or item name")).toHaveValue(`${prefix} income`);
  for (const item of [{ category: "expenses", label: "living costs", amount: "3000" }, { category: "bank", label: "savings", amount: "12000" }, { category: "loans", label: "no debts", amount: "0" }]) {
    await page.getByRole("button", { name: "Add another item" }).click();
    const entry = page.locator(".fs-entry").last();
    await entry.getByLabel("Information type").selectOption(item.category);
    await entry.getByLabel("Account or item name").fill(`${prefix} ${item.label}`);
    await entry.getByLabel(item.category === "expenses" ? "Expense amount (AUD)" : "Balance / value (AUD)").fill(item.amount);
    if (item.category === "expenses") await entry.getByLabel("How often?").selectOption("monthly");
    await entry.getByLabel("Statement / effective date").fill("2026-11-01");
    await entry.getByLabel("Whose amount is this?").selectOption("Sole");
  }
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review your changes", exact: true })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm and update my position" });
  await expect(confirm).toBeDisabled();
  expect((await (await request.get("/api/financial-setup")).json()).records).toHaveLength(0);
  await page.getByRole("checkbox", { name: /I have checked these values/ }).check();
  await confirm.click();
  await expect(page.getByRole("heading", { name: "4 items confirmed" })).toBeVisible();
  await page.getByRole("link", { name: "View Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Your money, with a clearer next step" })).toBeVisible();
  await expect(page.locator(".workspace-metric")).toHaveCount(4);
  await expect(page.locator(".workspace-metric").filter({ hasText: "Monthly surplus" })).toContainText("$3,500");
  await expect(page.locator(".workspace-metric").filter({ hasText: "Known net position" })).toContainText("$12,000");
  await expect(page.locator(".workspace-metric").filter({ hasText: "Cash buffer" })).toContainText("4.0 months");
  await expect(page.locator(".setup-checklist")).toHaveCount(0);
  await page.locator("#financial-evidence summary").click();
  await expect(page.locator("#financial-evidence")).toContainText("Manual entry");
  await expect(page.locator("#financial-evidence")).toContainText("1 Nov 2026");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("populated-desktop.png"), fullPage: true });
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(navigation.locator(":scope > details")).toHaveCount(5);
  await navigation.getByText("Planning", { exact: true }).click();
  await navigation.getByRole("link", { name: "Financial scenarios" }).click();
  await expect(page.getByRole("heading", { name: "Explore financial scenarios", exact: true })).toBeVisible();
  await expect(page.locator('nav[aria-label="Primary navigation"] [aria-current=page]')).toHaveCount(1);
  await navigation.getByRole("link", { name: "Ownership structures", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Compare ownership structures" })).toBeVisible();
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("populated-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Navigation" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close navigation menu" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "Settings & privacy" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close navigation menu" })).toBeFocused();
  await dialog.getByText("Documents", { exact: true }).click();
  await dialog.getByRole("link", { name: "Document vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Document vault", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeFocused();
  await page.goto("/financial-profile/add-data?category=expenses");
  await expect(page.getByLabel("Information type")).toHaveValue("expenses");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("entry-mobile.png"), fullPage: true });
  await page.getByLabel("New or existing item?").selectOption({ label: `Update: ${prefix} living costs` });
  await expect(page.getByLabel("Expense amount (AUD)")).toHaveValue("3000");
  await page.getByLabel("Expense amount (AUD)").fill("9000");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.locator("main.fs-page").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Review your changes", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /I have checked these values/ }).check();
  await page.getByRole("button", { name: "Confirm and update my position" }).click();
  await page.getByRole("link", { name: "View Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Review the gap in your monthly cash flow" })).toBeVisible();
  await expect(page.locator(".workspace-metric").filter({ hasText: "Monthly surplus" })).toContainText("-$2,500");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Review the gap in your monthly cash flow" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("deficit-small-mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});
