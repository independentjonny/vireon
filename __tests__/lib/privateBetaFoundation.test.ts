import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";
import { buildFinancialHealthSnapshot } from "../../src/lib/financialHealthEngine.ts";
import { FinancialForecastingEngine } from "../../src/lib/financialForecasting.ts";
import { GoalPlanningEngine, createGoal } from "../../src/lib/goalPlanning.ts";
import {
  DEFAULT_PRIVATE_BETA_FLAGS,
  ONBOARDING_STEPS,
  PrivateBetaFoundation,
  type BetaSession,
  type BetaRuntimeConfig,
} from "../../src/lib/privateBetaFoundation.ts";

const now = "2026-07-24T00:00:00.000Z";

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
  const health = buildFinancialHealthSnapshot({ userId: "user-a", records: records(), asOf: now });
  const forecast = FinancialForecastingEngine.generate(FinancialForecastingEngine.buildInput({ userId: "user-a", records: records(), startDate: "2026-07-24", horizon: "12m" }));
  const goal = createGoal({ userId: "user-a", type: "EMERGENCY_FUND", title: "Emergency buffer", targetAmount: 30000, currentAmount: 12000, targetDate: "2027-07-24", contributionAmount: 1000, contributionFrequency: "monthly" });
  const goals = GoalPlanningEngine.buildSnapshot({ userId: "user-a", goals: [goal], forecast });
  const briefing = PrivateBetaFoundation.buildDeterministicBriefing({ userId: "user-a", householdId: "household-a", records: records(), health, forecast, goals, asOf: now });
  return { health, forecast, goals, briefing };
}

function betaConfig(overrides: Partial<BetaRuntimeConfig> = {}): BetaRuntimeConfig {
  return {
    mode: "PRIVATE_BETA",
    databaseUrl: "postgres://private-beta",
    supabaseConfigured: true,
    localJsonFallback: false,
    openBankingEnabled: false,
    liveAiEnabled: false,
    ...overrides,
  };
}

test("1 unauthenticated access blocked", () => {
  assert.throws(() => PrivateBetaFoundation.filterOwnedRecords({ userId: null, householdId: null }, records()), /UNAUTHENTICATED/);
});

test("2 cross-user data access blocked", () => {
  assert.throws(() => PrivateBetaFoundation.assertHouseholdAccess(session("user-b"), records()[0]), /FORBIDDEN_USER/);
});

test("3 cross-household data access blocked", () => {
  assert.throws(() => PrivateBetaFoundation.assertHouseholdAccess(session("user-a", "household-b"), { userId: "user-a", householdId: "household-a" }), /FORBIDDEN_HOUSEHOLD/);
});

test("4 client-supplied user ID ignored by server filtering", () => {
  const visible = PrivateBetaFoundation.filterOwnedRecords(session("user-a"), [...records(), record({ userId: "user-b", kind: "account", label: "Other cash", value: { balance: 999 } })]);
  assert.equal(visible.every((item) => item.userId === "user-a"), true);
});

test("5 private-beta mode requires database", () => {
  assert.equal(PrivateBetaFoundation.evaluatePersistenceBoundary(betaConfig({ databaseUrl: "" })).ok, false);
});

test("6 local JSON fallback blocked in beta mode", () => {
  assert.equal(PrivateBetaFoundation.evaluatePersistenceBoundary(betaConfig({ localJsonFallback: true })).ok, false);
});

test("7 onboarding save and resume", () => {
  const base = PrivateBetaFoundation.defaultOnboardingState("user-a", "household-a");
  const updated = PrivateBetaFoundation.updateOnboardingState(base, { step: "income", status: "complete" });
  assert.equal(updated.steps.income, "complete");
  assert.equal(updated.userId, base.userId);
});

test("8 onboarding optional-step skip", () => {
  const updated = PrivateBetaFoundation.updateOnboardingState(PrivateBetaFoundation.defaultOnboardingState("user-a", "household-a"), { step: "csv-import", status: "skipped" });
  assert.equal(updated.steps["csv-import"], "skipped");
});

test("9 first-value briefing generation", () => {
  assert.equal(context().briefing.presentation, "deterministic-template");
  assert(context().briefing.sections.some((section) => section.id === "current-position"));
});

test("10 briefing provenance", () => {
  assert(context().briefing.sourceSnapshotIds.length >= 2);
  assert(context().briefing.calculationVersions.some((version) => version.includes("financial")));
});

test("11 stale data classification", () => {
  const stale = PrivateBetaFoundation.classifyFreshness(record({ kind: "account", label: "Old cash", updatedAt: "2025-01-01T00:00:00.000Z", value: { balance: 1 } }), new Date(now));
  assert.equal(stale.class, "STALE");
});

test("12 refresh actions", () => {
  const freshness = PrivateBetaFoundation.classifyFreshness(record({ kind: "transaction", label: "Old transaction", updatedAt: "2025-01-01T00:00:00.000Z", value: { amount: -10 } }), new Date(now));
  assert.equal(freshness.refreshAction, "import newer transactions");
});

test("13 user export", () => {
  const exported = PrivateBetaFoundation.buildUserExport({ session: session(), records: records(), briefing: context().briefing });
  assert(exported.manifest.includedSections.includes("financialRecords"));
});

test("14 export ownership", () => {
  const exported = PrivateBetaFoundation.buildUserExport({ session: session("user-a"), records: [...records(), record({ userId: "user-b", kind: "account", label: "Other", value: { balance: 9 } })] });
  assert.equal(exported.financialRecords.some((item) => item.userId === "user-b"), false);
});

test("15 export sensitive-field exclusion", () => {
  const exported = PrivateBetaFoundation.buildUserExport({ session: session(), records: records() });
  assert(exported.manifest.omittedSections.includes("secrets"));
  assert(!JSON.stringify(exported).includes("super-secret-password-hash"));
});

test("16 import deletion represented by audit action", () => {
  const audit = PrivateBetaFoundation.createAuditEvent(session(), { eventType: "import.deleted", affectedResource: "ingestion-1", outcome: "success" });
  assert.equal(audit.eventType, "import.deleted");
});

test("17 document deletion represented by audit action", () => {
  const audit = PrivateBetaFoundation.createAuditEvent(session(), { eventType: "document.deleted", affectedResource: "document-1", outcome: "success" });
  assert.equal(audit.affectedResource, "document-1");
});

test("18 full-account deletion request", () => {
  const deletion = PrivateBetaFoundation.createDeletionRequest(session());
  assert.equal(deletion.reauthenticationRequired, true);
  assert.equal(deletion.status, "requested");
});

test("19 session revocation after deletion is explicit policy boundary", () => {
  const deletion = PrivateBetaFoundation.createDeletionRequest(session());
  assert.equal(deletion.deletedContentRetained, "security-audit-only");
});

test("20 upload consent", () => {
  const onboarding = PrivateBetaFoundation.updateOnboardingState(PrivateBetaFoundation.defaultOnboardingState("user-a", "household-a"), { step: "csv-import", status: "complete", consent: { uploadConsent: true } });
  assert.equal(onboarding.consent.uploadConsent, true);
});

test("21 privacy-state persistence", () => {
  const onboarding = PrivateBetaFoundation.updateOnboardingState(PrivateBetaFoundation.defaultOnboardingState("user-a", "household-a"), { step: "welcome", status: "complete", consent: { betaTermsAccepted: true, financialDataStorage: true } });
  assert.equal(onboarding.consent.betaTermsAccepted, true);
  assert.equal(onboarding.consent.financialDataStorage, true);
});

test("22 sensitive log redaction", () => {
  const feedback = PrivateBetaFoundation.createFeedback(session(), { type: "privacy-concern", page: "/settings", feature: "privacy", description: "token=abc account 123456789012" });
  assert(!feedback.description.includes("abc"));
  assert(feedback.description.includes("[REDACTED_ACCOUNT]"));
});

test("23 error reference IDs via audit reference", () => {
  assert.match(PrivateBetaFoundation.createAuditEvent(session(), { eventType: "error", affectedResource: "api", outcome: "failed" }).referenceId, /^ref-/);
});

test("24 audit-event creation", () => {
  const audit = PrivateBetaFoundation.createAuditEvent(session(), { eventType: "goal.changed", affectedResource: "goal-1", outcome: "success" });
  assert.equal(audit.userId, "user-a");
});

test("25 audit financial-content exclusion", () => {
  const audit = PrivateBetaFoundation.createAuditEvent(session(), { eventType: "manual-edit", affectedResource: "record-1", outcome: "success", metadata: { accountNumber: "123456789012" } });
  assert.equal(audit.safeMetadata.accountNumber, "[REDACTED]");
});

test("26 feature-flag enforcement", () => {
  assert.equal(PrivateBetaFoundation.buildFeatureFlags(betaConfig()).liveAi, false);
  assert.equal(PrivateBetaFoundation.buildFeatureFlags(betaConfig()).openBanking, false);
});

test("27 server-side live-AI block", () => {
  assert.throws(() => PrivateBetaFoundation.assertServerFeatureAllowed(betaConfig({ liveAiEnabled: true, featureFlags: { liveAi: true } }), "liveAi"), /LIVE_AI_DISABLED/);
});

test("28 server-side Open Banking block", () => {
  assert.throws(() => PrivateBetaFoundation.assertServerFeatureAllowed(betaConfig({ openBankingEnabled: true, featureFlags: { openBanking: true } }), "openBanking"), /OPEN_BANKING_INACTIVE/);
});

test("29 deterministic briefing works without AI", () => {
  assert(!JSON.stringify(context().briefing).toLowerCase().includes("openai"));
});

test("30 private-beta readiness blocking", () => {
  assert.equal(PrivateBetaFoundation.buildPrivateBetaReadinessReport(betaConfig({ databaseUrl: "" })).deploymentBlocked, true);
});

test("31 database-unavailable handling", () => {
  const report = PrivateBetaFoundation.buildPrivateBetaReadinessReport(betaConfig({ databaseUrl: "" }));
  assert(report.checklist.some((item) => item.category === "persistence" && item.status === "BLOCKED"));
});

test("32 support feedback creation", () => {
  const feedback = PrivateBetaFoundation.createFeedback(session(), { type: "bug-report", page: "/goals", feature: "scenario", description: "Button did not respond" });
  assert.match(feedback.diagnosticReference, /^support-/);
});

test("33 feedback excludes financial context by default", () => {
  const feedback = PrivateBetaFoundation.createFeedback(session(), { type: "general", page: "/cash-flow", feature: "briefing" });
  assert.equal(feedback.safeMetadata.financialContextAttached, false);
});

test("34 admin access restrictions", () => {
  const admin = session("admin", "household-admin");
  admin.role = "admin";
  assert.throws(() => PrivateBetaFoundation.assertHouseholdAccess(admin, { userId: "user-a", householdId: "household-a" }), /FORBIDDEN_USER/);
});

test("35 mobile onboarding model includes all required steps", () => {
  assert.equal(ONBOARDING_STEPS.length, 12);
  assert(ONBOARDING_STEPS.some((step) => step.id === "first-results"));
});

test("36 accessibility basics have labelled onboarding steps", () => {
  assert(ONBOARDING_STEPS.every((step) => step.label.length > 0 && step.why.length > 0));
});

test("private beta default flags keep deterministic product surfaces enabled", () => {
  assert.equal(DEFAULT_PRIVATE_BETA_FLAGS.financialHealth, true);
  assert.equal(DEFAULT_PRIVATE_BETA_FLAGS.forecasting, true);
  assert.equal(DEFAULT_PRIVATE_BETA_FLAGS.goals, true);
  assert.equal(DEFAULT_PRIVATE_BETA_FLAGS.liveAi, false);
});
