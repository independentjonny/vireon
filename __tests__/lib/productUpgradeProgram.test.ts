import assert from "node:assert/strict";
import test from "node:test";
import { createDemoFinancialVaultState } from "../../src/lib/financialVaultEmptyState.ts";
import { buildFinancialDigitalTwinFromVault, buildDefaultTwinScenarios, simulateDigitalTwinScenario } from "../../src/lib/financialDigitalTwin.ts";
import { buildAdviserWorkspace, buildAICfoWorkflow, buildBetaOnboarding, buildPerformanceBudget, buildPrivateBetaReadiness, buildSecurityHeaders, buildTwinResilienceReport, buildVaultCompletion, SlidingWindowRateLimiter, verifyCsrfToken } from "../../src/lib/productUpgradeProgram.ts";

const vault = createDemoFinancialVaultState("2026-07-31T00:00:00.000Z");
const twin = buildFinancialDigitalTwinFromVault(vault);

test("Vault completion ranks missing high-impact facts and exposes one next action", () => {
  const result = buildVaultCompletion(vault);
  assert(result.score >= 0 && result.score <= 100);
  assert(result.nextBestAction.length > 0);
  assert.deepEqual([...result.missing].sort((a, b) => b.impact - a.impact), result.missing);
});

test("Digital Twin resilience applies deterministic downside shocks", () => {
  const baseline = simulateDigitalTwinScenario(twin, buildDefaultTwinScenarios(twin)[0]);
  const report = buildTwinResilienceReport(baseline);
  assert.equal(report.shocks.length, 3);
  assert.equal(report.calculationType, "deterministic");
  assert(report.worstCase.stressedNetWorth <= baseline.netWorth);
});

test("AI CFO workflows keep indicative and realised impact separate", () => {
  const workflow = buildAICfoWorkflow("prepare-refinance", vault);
  assert.equal(workflow.realisedImpact, null);
  assert.equal(workflow.verificationRequired, true);
  assert.equal(workflow.professionalReviewRequired, true);
  assert(workflow.evidence.length > 0);
});

test("Adviser workspace is evidence-backed and cannot mutate verified facts", () => {
  const workspace = buildAdviserWorkspace(vault, twin);
  assert.equal(workspace.permissions.canViewEvidence, true);
  assert.equal(workspace.permissions.canEditVerifiedFacts, false);
  assert.equal(workspace.permissions.canExecuteFinancialActions, false);
});

test("beta onboarding restricts access until legal, privacy and identity gates pass", () => {
  const blocked = buildBetaOnboarding({ acceptedTerms: true, privacyAcknowledged: false, identityVerified: true, dataModeConfirmed: false, vaultStarted: false, goalsCaptured: false, firstReviewCompleted: false });
  assert.equal(blocked.productAccess, "restricted");
  const enabled = buildBetaOnboarding({ acceptedTerms: true, privacyAcknowledged: true, identityVerified: true, dataModeConfirmed: true, vaultStarted: false, goalsCaptured: false, firstReviewCompleted: false });
  assert.equal(enabled.productAccess, "enabled");
});

test("performance budgets fail on regressions", () => {
  assert.equal(buildPerformanceBudget({ lcpMs: 2400, inpMs: 180, cls: 0.08, initialJsKb: 220, apiP95Ms: 450 }).ok, true);
  assert.equal(buildPerformanceBudget({ lcpMs: 3000, inpMs: 180, cls: 0.08, initialJsKb: 220, apiP95Ms: 450 }).ok, false);
});

test("security controls provide hardened headers, constant-time CSRF checks and rate limits", () => {
  const headers = buildSecurityHeaders("nonce-1");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(headers["Cache-Control"], "private, no-store");
  assert.equal(verifyCsrfToken("token", "token"), true);
  assert.equal(verifyCsrfToken("token", "other"), false);
  const limiter = new SlidingWindowRateLimiter();
  assert.equal(limiter.allow("user-a", 0, 2, 1000), true);
  assert.equal(limiter.allow("user-a", 1, 2, 1000), true);
  assert.equal(limiter.allow("user-a", 2, 2, 1000), false);
  assert.equal(limiter.allow("user-b", 2, 2, 1000), true);
});

test("private beta gate cannot pass by averaging away a critical blocker", () => {
  const input = { openBankingReady: true, documentIngestionReady: true, vaultScore: 90, digitalTwinReady: true, aiCfoReady: true, adviserWorkspaceReady: true, onboardingReady: true, performanceReady: true, securityReady: true, productionPersistenceReady: true, supportOwnerConfigured: true, incidentRunbookConfigured: true };
  assert.equal(buildPrivateBetaReadiness(input).decision, "READY FOR PRIVATE BETA");
  assert.equal(buildPrivateBetaReadiness({ ...input, securityReady: false }).decision, "PRIVATE BETA BLOCKED");
});
