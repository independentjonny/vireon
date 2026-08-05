import { test, expect } from "@playwright/test";

test("private beta onboarding shows deterministic first value and provenance", async ({ page }) => {
  await page.goto("/beta-onboarding");
  await expect(page.getByRole("heading", { name: "Set up Vireon safely" })).toBeVisible();
  await expect(page.getByText("Most beta users can reach their first deterministic insight")).toBeVisible();
  await expect(page.getByRole("heading", { name: "First-value summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why am I seeing this?" })).toBeVisible();
  await page.getByText("Net worth:").click();
  await expect(page.getByText("Calculation: assets minus liabilities")).toBeVisible();
});

test("private beta onboarding can save and skip progress", async ({ page }) => {
  await page.goto("/beta-onboarding");
  const save = page.getByRole("button", { name: "Save" }).first();
  await expect(save).toBeVisible();
  await save.click();
  await expect(page.getByText("complete").first()).toBeVisible();
  const skip = page.getByRole("button", { name: "Skip" }).first();
  if (await skip.isVisible()) {
    await skip.click();
    await expect(page.getByText("skipped").first()).toBeVisible();
  }
});

test("private beta export feedback deletion and privacy controls are visible", async ({ page }) => {
  await page.goto("/beta-onboarding");
  await expect(page.getByRole("link", { name: "Export" })).toHaveAttribute("href", "/api/private-beta/export");
  await expect(page.getByRole("button", { name: "Feedback" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  const feedback = await page.request.post("/api/private-beta/feedback", { data: { type: "general", page: "/beta-onboarding", feature: "playwright" } });
  await expect(feedback).toBeOK();
  const deletion = await page.request.post("/api/private-beta/deletion", { data: { confirmation: "REQUEST_DELETE" } });
  await expect(deletion).toBeOK();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy controls" })).toBeVisible();
  await expect(page.getByText("User financial data is not sent to external AI providers")).toBeVisible();
});

test("private beta mobile workflow renders core controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/beta-onboarding");
  await expect(page.getByRole("heading", { name: "Guided onboarding" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "First-value summary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Feedback" })).toBeVisible();
});

test("private beta hardening gate and analytics safety are visible", async ({ page }) => {
  await page.goto("/production-readiness");
  await expect(page.getByRole("heading", { name: "Beta Hardening Gate" })).toBeVisible();
  await expect(page.getByText("Launch controls for analytics safety")).toBeVisible();
  const safe = await page.request.post("/api/private-beta/analytics", { data: { name: "briefing_viewed", sessionRef: "browser-session", page: "/beta-onboarding", feature: "briefing", success: true, durationBucket: "fast", betaCohort: "trusted" } });
  await expect(safe).toBeOK();
  const rejected = await page.request.post("/api/private-beta/analytics", { data: { name: "goal_created", goalAmount: 30000 } });
  expect(rejected.status()).toBe(400);
});

test("private beta pilot operations are visible and privacy-safe", async ({ page }) => {
  await page.goto("/production-readiness");
  await expect(page.getByRole("heading", { name: "Private Beta Pilot Operations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "External Private Beta Deployment" })).toBeVisible();
  await expect(page.getByText("FOUNDING_BETA_01")).toBeVisible();
  await expect(page.getByText("10 invite-only users")).toBeVisible();

  const operations = await page.request.get("/api/private-beta/operations");
  await expect(operations).toBeOK();
  const body = await operations.json();
  expect(body.cohort.cohortId).toBe("FOUNDING_BETA_01");
  expect(body.rehearsal.syntheticOnly).toBe(true);
  expect(body.externalStartup.version).toBe("external-private-beta-deployment-v1");
  expect(JSON.stringify(body)).not.toContain("123456789012");

  const support = await page.request.post("/api/private-beta/support", {
    data: {
      feature: "import",
      errorCategory: "blocking-import",
      safeDiagnostics: { route: "/financial-vault/imports", accountNumber: "123456789012", amount: "$42000", durationBucket: "slow" },
    },
  });
  await expect(support).toBeOK();
  const supportBody = await support.json();
  expect(JSON.stringify(supportBody)).not.toContain("123456789012");
  expect(JSON.stringify(supportBody)).not.toContain("$42000");
  expect(supportBody.record.safeDiagnostics.durationBucket).toBe("slow");
});
