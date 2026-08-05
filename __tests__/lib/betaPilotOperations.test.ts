import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";
import { BetaHardening, type BetaAnalyticsEvent } from "../../src/lib/betaHardening.ts";
import { BetaPilotOperations, type BetaDecisionReport } from "../../src/lib/betaPilotOperations.ts";
import { FinancialForecastingEngine } from "../../src/lib/financialForecasting.ts";
import { buildFinancialHealthSnapshot } from "../../src/lib/financialHealthEngine.ts";
import { GoalPlanningEngine, createGoal } from "../../src/lib/goalPlanning.ts";
import { PrivateBetaFoundation, type BetaRuntimeConfig, type BetaSession } from "../../src/lib/privateBetaFoundation.ts";

const now = "2026-07-24T00:00:00.000Z";

function betaConfig(overrides: Partial<BetaRuntimeConfig> = {}): BetaRuntimeConfig {
  return {
    mode: "PRIVATE_BETA",
    databaseUrl: "postgres://private-beta",
    supabaseConfigured: true,
    localJsonFallback: false,
    openBankingEnabled: false,
    liveAiEnabled: false,
    migrationVersion: "private-beta-foundation-v1",
    applicationVersion: "0.1.0",
    ...overrides,
  };
}

function gate(config = betaConfig()) {
  return BetaHardening.buildLaunchGate({
    config,
    foundation: PrivateBetaFoundation.buildPrivateBetaReadinessReport(config),
    golden: { passed: true } as never,
    consistency: { passed: true } as never,
    securityFindings: BetaHardening.buildSecurityReview(),
  });
}

function session(userId = "user-a", householdId = "household-a"): BetaSession {
  return { userId, householdId, email: `${userId}@example.test`, expiresAt: "2027-01-01T00:00:00.000Z" };
}

function record(input: Partial<CanonicalFinancialRecord> & { kind: CanonicalFinancialRecord["kind"]; label: string; value: Record<string, unknown> }): CanonicalFinancialRecord {
  return {
    id: input.id ?? `record-${input.kind}-${input.label.replace(/\s+/g, "-").toLowerCase()}`,
    userId: input.userId ?? "user-a",
    kind: input.kind,
    subtype: input.subtype ?? input.kind,
    label: input.label,
    value: input.value,
    provenance: input.provenance ?? { ingestionId: "synthetic-pilot", sourceField: "manual-entry", confidence: 1, userConfirmed: true, sourceType: "MANUAL" },
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    superseded: input.superseded ?? false,
    approximate: input.approximate ?? false,
    history: input.history ?? [],
  };
}

function goldenContext() {
  const source = [
    record({ kind: "income", label: "Salary", value: { monthlyAmount: 12000 } }),
    record({ kind: "account", label: "Offset account", value: { balance: 42000 } }),
    record({ kind: "expense", label: "Household spending", value: { monthlyAmount: 6500 } }),
    record({ kind: "liability", label: "Mortgage", subtype: "mortgage", value: { balance: 720000, interestRate: 5.9, monthlyRepayment: 4200 } }),
    record({ kind: "asset", label: "Home", subtype: "property", value: { marketValue: 1100000 } }),
  ];
  const health = buildFinancialHealthSnapshot({ userId: "user-a", records: source, asOf: now });
  const forecast = FinancialForecastingEngine.generate(FinancialForecastingEngine.buildInput({ userId: "user-a", records: source, startDate: "2026-07-24", horizon: "12m" }));
  const goal = createGoal({ userId: "user-a", type: "EMERGENCY_FUND", title: "Emergency buffer", targetAmount: 30000, currentAmount: 12000, targetDate: "2027-07-24", contributionAmount: 1000, contributionFrequency: "monthly" });
  const goals = GoalPlanningEngine.buildSnapshot({ userId: "user-a", goals: [goal], forecast });
  return { health, forecast, goals };
}

function decision(overrides: Partial<BetaDecisionReport> = {}): BetaDecisionReport {
  return BetaPilotOperations.buildBetaDecisionReport({
    activations: 10,
    onboardingCompletionRate: 90,
    medianTimeToFirstValueMinutes: 12,
    blockingDefects: 0,
    ...overrides,
  });
}

test("pilot operations invitation lifecycle and cohort controls", () => {
  const cohort = BetaPilotOperations.createFoundingBetaCohort({ maximumUsers: 1 });
  const invite = BetaPilotOperations.createInvitation({ email: "Beta.User@example.test", cohort, createdAt: now });
  assert.equal(invite.cohortId, "FOUNDING_BETA_01");
  assert.equal(invite.state, "CREATED");
  assert.notEqual(invite.emailHash, invite.intendedEmail);
  assert.throws(() => BetaPilotOperations.createInvitation({ email: "second@example.test", cohort, existingInvitations: [invite] }), /COHORT_CAPACITY_REACHED/);
  assert.throws(() => BetaPilotOperations.createInvitation({ email: "beta.user@example.test", cohort: BetaPilotOperations.createFoundingBetaCohort(), existingInvitations: [invite] }), /INVITATION_REUSE_BLOCKED/);
  assert.throws(() => BetaPilotOperations.transitionInvitation(invite, "ACCEPTED", now, "other@example.test"), /INVITATION_EMAIL_MISMATCH/);
  assert.throws(() => BetaPilotOperations.transitionInvitation(invite, "ACCEPTED", "2026-08-20T00:00:00.000Z", "beta.user@example.test"), /INVITATION_EXPIRED/);
  const revoked = BetaPilotOperations.transitionInvitation(invite, "REVOKED");
  assert.throws(() => BetaPilotOperations.transitionInvitation(revoked, "OPENED"), /INVITATION_REVOKED/);
});

test("pilot cohort forces deterministic beta restrictions", () => {
  const cohort = BetaPilotOperations.createFoundingBetaCohort();
  assert.equal(cohort.inviteOnly, true);
  assert.equal(cohort.manualApproval, true);
  assert.equal(cohort.deterministicFeaturesOnly, true);
  assert(cohort.disabledFeatures.includes("open-banking"));
  assert(cohort.disabledFeatures.includes("live-ai"));
});

test("synthetic rehearsal covers desktop mobile isolation and recovery", () => {
  const rehearsal = BetaPilotOperations.runSyntheticRehearsal();
  assert.equal(rehearsal.syntheticOnly, true);
  assert.equal(rehearsal.steps.length, 20);
  assert.equal(rehearsal.desktopRun, "PASS");
  assert.equal(rehearsal.mobileRun, "PASS");
  assert.equal(rehearsal.isolatedUsers, 2);
  assert.equal(rehearsal.failedImportRecovery, "PASS");
  assert.equal(rehearsal.expiredSessionRecovery, "PASS");
});

test("support records and operations metrics exclude financial content", () => {
  const support = BetaPilotOperations.createSupportRecord({
    feature: "import",
    errorCategory: "blocking-import",
    safeDiagnostics: { route: "/financial-vault/imports", accountNumber: "123456789012", note: "amount $42000", durationBucket: "slow" },
  });
  assert.equal(support.safeDiagnostics.accountNumber, undefined);
  assert.equal(support.safeDiagnostics.note, undefined);
  assert.equal(support.safeDiagnostics.durationBucket, "slow");

  const config = betaConfig();
  const events: BetaAnalyticsEvent[] = [
    BetaHardening.validateAnalyticsPayload({ name: "onboarding_started", sessionRef: "s1", anonymousUserRef: "u1" }, config),
    BetaHardening.validateAnalyticsPayload({ name: "onboarding_completed", sessionRef: "s1", anonymousUserRef: "u1" }, config),
    BetaHardening.validateAnalyticsPayload({ name: "financial_health_viewed", sessionRef: "s1", anonymousUserRef: "u1" }, config),
    BetaHardening.validateAnalyticsPayload({ name: "import_started", sessionRef: "s1", anonymousUserRef: "u1" }, config),
    BetaHardening.validateAnalyticsPayload({ name: "import_confirmed", sessionRef: "s1", anonymousUserRef: "u1" }, config),
  ];
  const invite = BetaPilotOperations.transitionInvitation(BetaPilotOperations.createInvitation({ email: "metric@example.test", cohort: BetaPilotOperations.createFoundingBetaCohort() }), "ACCEPTED", now, "metric@example.test");
  const dashboard = BetaPilotOperations.buildOperationsDashboard({ invitations: [invite], events, support: [] });
  assert.equal(dashboard.activatedUsers, 1);
  assert.equal(dashboard.importSuccessRate, 100);
  assert.equal(JSON.stringify(dashboard).includes("42000"), false);
});

test("daily check blocks critical beta deployment failures", () => {
  assert.equal(BetaPilotOperations.runDailyCheck({ config: betaConfig(), gate: gate() }).status, "READY");
  assert.equal(BetaPilotOperations.runDailyCheck({ config: betaConfig({ databaseUrl: "" }), gate: gate(betaConfig({ databaseUrl: "" })) }).status, "BLOCKED");
  assert.equal(BetaPilotOperations.runDailyCheck({ config: betaConfig({ localJsonFallback: true }), gate: gate(betaConfig({ localJsonFallback: true })) }).blocked, true);
  assert.equal(BetaPilotOperations.runDailyCheck({ config: betaConfig({ liveAiEnabled: true, featureFlags: { liveAi: true } }), gate: gate(betaConfig({ liveAiEnabled: true, featureFlags: { liveAi: true } })) }).blocked, true);
  assert.equal(BetaPilotOperations.runDailyCheck({ config: betaConfig({ openBankingEnabled: true, featureFlags: { openBanking: true } }), gate: gate(betaConfig({ openBankingEnabled: true, featureFlags: { openBanking: true } })) }).blocked, true);
});

test("incident severity and SEV-1 suspension are deterministic", () => {
  assert.equal(BetaPilotOperations.classifyIncident("cross-user data exposure"), "SEV-1");
  assert.equal(BetaPilotOperations.classifyIncident("database outage"), "SEV-2");
  assert.equal(BetaPilotOperations.classifyIncident("minor display issue"), "SEV-3");
  assert.equal(BetaPilotOperations.sev1SuspendsCohort(BetaPilotOperations.createFoundingBetaCohort(), "external AI transmission").suspended, true);
  assert(BetaPilotOperations.buildIncidentPlans().some((plan) => plan.severity === "SEV-1" && plan.immediateContainment.includes("Suspend")));
});

test("release manifest forces disabled features and preserves rollback state", () => {
  const pass = BetaPilotOperations.createReleaseManifest({ commit: "abc123", approver: "ops", featureFlags: { liveAi: true, openBanking: true } });
  assert.equal(pass.featureFlags.liveAi, false);
  assert.equal(pass.featureFlags.openBanking, false);
  assert.equal(pass.active, true);
  const fail = BetaPilotOperations.createReleaseManifest({ commit: "abc123", approver: "ops", smokeTest: "FAIL" });
  assert.equal(fail.active, false);
  assert.equal(fail.rollbackPoint, "abc123");
});

test("feedback triage decision report and expansion gate use evidence", () => {
  assert.equal(BetaPilotOperations.prioritiseFeedback("privacy", "cross-user risk"), "P0");
  assert.equal(BetaPilotOperations.prioritiseFeedback("bug", "cannot complete onboarding"), "P1");
  assert.equal(BetaPilotOperations.prioritiseFeedback("forecast", "confusing result"), "P2");
  assert.equal(BetaPilotOperations.prioritiseFeedback("performance", "slow page"), "P3");
  assert.equal(BetaPilotOperations.prioritiseFeedback("feature-request", "new view"), "P4");
  assert.equal(BetaPilotOperations.buildBetaDecisionReport({ blockingDefects: 1 }).outcome, "CONTINUE_WITH_REMEDIATION");
  assert.equal(BetaPilotOperations.evaluateExpansionGate({ stage: "Stage 1", decision: decision(), exportsScoped: true, deletionRecorded: true, betaGatePassing: true }).passed, true);
  assert.equal(BetaPilotOperations.evaluateExpansionGate({ stage: "Stage 1", decision: decision({ onboardingCompletionRate: 70 }), exportsScoped: true, deletionRecorded: true, betaGatePassing: true }).passed, false);
});

test("pilot data remains synthetic and user scoped", () => {
  const records = [
    record({ kind: "account", label: "Synthetic cash", value: { balance: 1 } }),
    record({ userId: "user-b", kind: "account", label: "Other synthetic cash", value: { balance: 2 } }),
  ];
  assert(records.every((item) => item.provenance.ingestionId === "synthetic-pilot"));
  assert.throws(() => PrivateBetaFoundation.assertHouseholdAccess(session("user-b"), records[0]), /FORBIDDEN_USER/);
  const exported = PrivateBetaFoundation.buildUserExport({ session: session("user-a"), records });
  assert.equal(exported.financialRecords.length, 1);
  assert.equal(PrivateBetaFoundation.createDeletionRequest(session()).status, "requested");
});

test("deployment verification records true PRIVATE_BETA controls", () => {
  const report = BetaPilotOperations.verifyDeployment({ config: betaConfig(), gate: gate(), commitSha: "abc123", smokeTestPassed: true });
  assert.equal(report.executionMode, "PRIVATE_BETA");
  assert.equal(report.databaseStatus, "active");
  assert.equal(report.migrationStatus, "applied");
  assert.equal(report.authenticationStatus, "configured");
  assert.equal(report.betaGateResult, "READY");
});

test("golden-output approval remains explicit for pilot operations", () => {
  assert.equal(BetaHardening.verifyGoldenCalculations(goldenContext()).approvalRequiredForChanges, true);
});
