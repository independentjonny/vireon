import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";
import { buildFinancialHealthSnapshot } from "../../src/lib/financialHealthEngine.ts";
import { FinancialForecastingEngine } from "../../src/lib/financialForecasting.ts";
import { GoalPlanningEngine, createGoal } from "../../src/lib/goalPlanning.ts";
import { BetaHardening, type BetaAnalyticsEvent } from "../../src/lib/betaHardening.ts";
import { PrivateBetaFoundation, type BetaRuntimeConfig } from "../../src/lib/privateBetaFoundation.ts";

const now = "2026-07-24T00:00:00.000Z";

function record(input: Partial<CanonicalFinancialRecord> & { kind: CanonicalFinancialRecord["kind"]; label: string; value: Record<string, unknown> }): CanonicalFinancialRecord {
  return {
    id: input.id ?? `record-${input.kind}-${input.label.replace(/\s+/g, "-").toLowerCase()}`,
    userId: input.userId ?? "user-a",
    kind: input.kind,
    subtype: input.subtype ?? input.kind,
    label: input.label,
    value: input.value,
    provenance: input.provenance ?? { ingestionId: "manual", sourceField: "manual-entry", confidence: 1, userConfirmed: true, sourceType: "MANUAL" },
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    superseded: input.superseded ?? false,
    approximate: input.approximate ?? false,
    history: input.history ?? [],
  };
}

function records(): CanonicalFinancialRecord[] {
  return [
    record({ kind: "income", label: "Salary", value: { monthlyAmount: 12000 } }),
    record({ kind: "account", label: "Offset account", value: { balance: 42000 } }),
    record({ kind: "expense", label: "Household spending", value: { monthlyAmount: 6500 } }),
    record({ kind: "liability", label: "Mortgage", subtype: "mortgage", value: { balance: 720000, interestRate: 5.9, monthlyRepayment: 4200 } }),
    record({ kind: "asset", label: "Home", subtype: "property", value: { marketValue: 1100000 } }),
  ];
}

function context() {
  const source = records();
  const health = buildFinancialHealthSnapshot({ userId: "user-a", records: source, asOf: now });
  const forecast = FinancialForecastingEngine.generate(FinancialForecastingEngine.buildInput({ userId: "user-a", records: source, startDate: "2026-07-24", horizon: "12m" }));
  const goal = createGoal({ userId: "user-a", type: "EMERGENCY_FUND", title: "Emergency buffer", targetAmount: 30000, currentAmount: 12000, targetDate: "2027-07-24", contributionAmount: 1000, contributionFrequency: "monthly" });
  const goals = GoalPlanningEngine.buildSnapshot({ userId: "user-a", goals: [goal], forecast });
  const provenance = PrivateBetaFoundation.buildProvenanceViews({ health, forecast, goals });
  const freshness = PrivateBetaFoundation.buildFreshnessReport(source, new Date(now));
  return { source, health, forecast, goals, provenance, freshness };
}

function betaConfig(overrides: Partial<BetaRuntimeConfig> = {}): BetaRuntimeConfig {
  return {
    mode: "PRIVATE_BETA",
    databaseUrl: "postgres://private-beta",
    supabaseConfigured: true,
    localJsonFallback: false,
    openBankingEnabled: false,
    liveAiEnabled: false,
    migrationVersion: "private-beta-foundation-v1",
    ...overrides,
  };
}

test("1 analytics event allowlist accepts safe product usage fields", () => {
  const event = BetaHardening.validateAnalyticsPayload({ name: "onboarding_started", sessionRef: "s1", page: "/beta-onboarding", feature: "welcome", success: true, durationBucket: "fast", betaCohort: "trusted" }, betaConfig());
  assert.equal(event.name, "onboarding_started");
  assert.equal(event.executionMode, "PRIVATE_BETA");
});

test("2 financial data is rejected from analytics", () => {
  assert.throws(() => BetaHardening.validateAnalyticsPayload({ name: "financial_health_viewed", accountBalance: 42000 }, betaConfig()), /ANALYTICS_FIELD_REJECTED|ANALYTICS_FINANCIAL_CONTENT_REJECTED/);
  assert.throws(() => BetaHardening.validateAnalyticsPayload({ name: "goal_created", feature: "goal amount 30000" }, betaConfig()), /ANALYTICS_FINANCIAL_CONTENT_REJECTED/);
});

test("3 onboarding funnel event sequence and completion metrics", () => {
  const events: BetaAnalyticsEvent[] = [
    BetaHardening.validateAnalyticsPayload({ name: "beta_session_started", sessionRef: "s1", anonymousUserRef: "u1" }, betaConfig()),
    BetaHardening.validateAnalyticsPayload({ name: "onboarding_started", sessionRef: "s1", anonymousUserRef: "u1" }, betaConfig()),
    BetaHardening.validateAnalyticsPayload({ name: "onboarding_step_completed", sessionRef: "s1", anonymousUserRef: "u1", feature: "income" }, betaConfig()),
    BetaHardening.validateAnalyticsPayload({ name: "onboarding_completed", sessionRef: "s1", anonymousUserRef: "u1" }, betaConfig()),
    BetaHardening.validateAnalyticsPayload({ name: "financial_health_viewed", sessionRef: "s1", anonymousUserRef: "u1" }, betaConfig()),
  ];
  const metrics = BetaHardening.calculateFunnelMetrics(events);
  assert.equal(metrics.onboardingCompletionRate, 100);
  assert.equal(metrics.completionByStep.income, 1);
  assert.equal(metrics.firstValueUsers, 1);
});

test("4 golden Financial Health Forecast and Goal fixtures pass", () => {
  assert.equal(BetaHardening.verifyGoldenCalculations(context()).passed, true);
});

test("5 golden output approval enforcement is explicit", () => {
  assert.equal(BetaHardening.verifyGoldenCalculations(context()).approvalRequiredForChanges, true);
});

test("6 cross-engine net-worth and cash-flow consistency", () => {
  const report = BetaHardening.verifyCrossEngineConsistency(context());
  assert.equal(report.passed, true);
  assert(report.values.some((value) => value.name === "net worth"));
  assert(report.values.some((value) => value.name === "monthly income"));
});

test("7 explanation provenance and stale-source explanation model", () => {
  const ctx = context();
  const explanations = BetaHardening.buildExplainableResults({ provenance: ctx.provenance, freshness: ctx.freshness, health: ctx.health, forecast: ctx.forecast, goals: ctx.goals });
  assert(explanations.some((item) => item.resultName === "Net worth" && item.sourceRecords.length > 0));
  assert(explanations.every((item) => item.calculationVersion.length > 0));
});

test("8 prohibited claim detection blocks overstated wording", () => {
  const result = BetaHardening.reviewClaimsPolicy([{ surface: "forecast", text: "This is guaranteed to be the best result." }]);
  assert.equal(result.passed, false);
  assert.equal(result.findings[0].severity, "HIGH");
});

test("9 approved wording passes the claims policy", () => {
  assert.equal(BetaHardening.reviewClaimsPolicy([{ surface: "forecast", text: "This is projected and based on confirmed records." }]).passed, true);
});

test("10 database outage recovery includes safe support reference", () => {
  const plan = BetaHardening.buildErrorRecoveryPlan("DATABASE_UNAVAILABLE");
  assert.equal(plan.retrySafe, true);
  assert.match(plan.supportReferenceId, /^support-/);
});

test("11 failed export and deletion recovery preserve safe next actions", () => {
  assert.equal(BetaHardening.buildErrorRecoveryPlan("EXPORT_FAILED").dataSaved, "yes");
  assert.equal(BetaHardening.buildErrorRecoveryPlan("DELETION_REQUEST_FAILED").retrySafe, true);
});

test("12 performance benchmark harness includes heavy datasets", () => {
  const results = BetaHardening.runPerformanceBaseline();
  assert(results.some((item) => item.dataset === "heavy"));
});

test("13 security review documents critical controls as remediated", () => {
  const findings = BetaHardening.buildSecurityReview();
  assert(findings.some((finding) => finding.severity === "CRITICAL" && finding.status === "remediated"));
});

test("14 feature cohort enforcement keeps live AI and Open Banking forced off", () => {
  const cohort = BetaHardening.buildBetaCohort({ featureProfile: { liveAi: true, openBanking: true } });
  assert.equal(cohort.featureProfile.liveAi, false);
  assert.equal(cohort.featureProfile.openBanking, false);
});

test("15 feedback triage stores no automatic financial context", () => {
  const triage = BetaHardening.createFeedbackTriage("incorrect-result");
  assert.equal(triage.status, "NEW");
  assert.equal(triage.financialContextAttached, false);
});

test("16 beta gate blocks critical private-beta persistence findings", () => {
  const ctx = context();
  const golden = BetaHardening.verifyGoldenCalculations(ctx);
  const consistency = BetaHardening.verifyCrossEngineConsistency(ctx);
  const gate = BetaHardening.buildLaunchGate({ config: betaConfig({ databaseUrl: "", localJsonFallback: true }), golden, consistency });
  assert.equal(gate.blocked, true);
});

test("17 beta gate is ready when critical controls pass", () => {
  const ctx = context();
  const golden = BetaHardening.verifyGoldenCalculations(ctx);
  const consistency = BetaHardening.verifyCrossEngineConsistency(ctx);
  const gate = BetaHardening.buildLaunchGate({ config: betaConfig(), golden, consistency, securityFindings: BetaHardening.buildSecurityReview() });
  assert.equal(gate.status, "READY");
});

test("18 live AI remains blocked", () => {
  const gate = BetaHardening.buildLaunchGate({ config: betaConfig({ liveAiEnabled: true, featureFlags: { liveAi: true } }) });
  assert.equal(gate.blocked, true);
});

test("19 Open Banking remains blocked", () => {
  const gate = BetaHardening.buildLaunchGate({ config: betaConfig({ openBankingEnabled: true, featureFlags: { openBanking: true } }) });
  assert.equal(gate.blocked, true);
});

test("20 no real-user financial fixtures are used by the golden suite", () => {
  const ctx = context();
  assert(ctx.source.every((item) => item.provenance.ingestionId === "manual"));
  assert.equal(BetaHardening.verifyGoldenCalculations(ctx).fixtureVersion, "beta-golden-fixtures-v1");
});
