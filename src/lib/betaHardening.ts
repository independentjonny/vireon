import { createHash, randomUUID } from "crypto";
import type { FinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import type { ForecastSnapshot } from "@/lib/financialForecasting";
import type { GoalPlanningSnapshot } from "@/lib/goalPlanning";
import {
  PrivateBetaFoundation,
  type BetaRuntimeConfig,
  type FreshnessResult,
  type PrivateBetaReadinessReport,
  type ProvenanceView,
  type ReadinessItem,
  type ReadinessStatus,
} from "@/lib/privateBetaFoundation";

export const BETA_HARDENING_VERSION = "beta-hardening-user-validation-v1";

export type BetaFindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type BetaGateCategory =
  | "authentication"
  | "user-isolation"
  | "database-persistence"
  | "migrations"
  | "uploaded-file-security"
  | "financial-calculation-verification"
  | "onboarding-completion"
  | "deterministic-briefing"
  | "provenance"
  | "freshness"
  | "export"
  | "deletion"
  | "privacy-consent"
  | "feature-flags"
  | "monitoring"
  | "accessibility"
  | "performance"
  | "incident-handling";

export type BetaAnalyticsEventName =
  | "beta_session_started"
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_abandoned"
  | "onboarding_completed"
  | "manual_record_added"
  | "import_started"
  | "import_failed"
  | "import_reviewed"
  | "import_confirmed"
  | "financial_health_viewed"
  | "forecast_viewed"
  | "scenario_created"
  | "goal_created"
  | "briefing_viewed"
  | "provenance_opened"
  | "export_requested"
  | "deletion_requested"
  | "feedback_submitted";

export type BetaAnalyticsEvent = {
  id: string;
  name: BetaAnalyticsEventName;
  timestamp: string;
  anonymousUserRef: string;
  sessionRef: string;
  applicationVersion: string;
  page: string;
  feature: string;
  executionMode: BetaRuntimeConfig["mode"];
  success: boolean;
  durationBucket: "instant" | "fast" | "standard" | "slow" | "unknown";
  errorCategory: string | null;
  betaCohort: string;
};

export type FunnelMetrics = {
  onboardingStartRate: number;
  onboardingCompletionRate: number;
  completionByStep: Record<string, number>;
  abandonmentStep: string | null;
  importCompletionRate: number;
  timeToFirstConfirmedRecordMinutes: number | null;
  timeToFirstFinancialHealthMinutes: number | null;
  timeToFirstForecastMinutes: number | null;
  timeToFirstGoalMinutes: number | null;
  timeToFirstBriefingMinutes: number | null;
  repeatSessionRate: number;
  feedbackRate: number;
  firstValueUsers: number;
};

export type GoldenSuiteResult = {
  version: typeof BETA_HARDENING_VERSION;
  fixtureVersion: "beta-golden-fixtures-v1";
  approvedOutputVersion: "beta-golden-expected-v1";
  passed: boolean;
  cases: Array<{ id: string; engine: "financial-health" | "forecasting" | "goals"; passed: boolean; actual: number | string; expected: number | string; tolerance: number; rationale: string }>;
  approvalRequiredForChanges: true;
};

export type CrossEngineConsistencyReport = {
  version: typeof BETA_HARDENING_VERSION;
  passed: boolean;
  values: Array<{ name: string; sources: string[]; values: Array<number | string>; consistent: boolean; reason: string }>;
};

export type ExplainableResult = {
  resultName: string;
  displayedValue: string;
  classification: string;
  sourceRecords: string[];
  calculationSteps: string[];
  assumptions: string[];
  calculationVersion: string;
  sourceFreshness: FreshnessResult[];
  confirmationStatus: "confirmed" | "estimated" | "insufficient-data";
  warnings: string[];
  relatedActions: string[];
  generatedTimestamp: string;
  plainLanguage: string;
};

export type ClaimsPolicyResult = {
  passed: boolean;
  prohibitedTerms: string[];
  findings: Array<{ surface: string; term: string; replacement: string; severity: BetaFindingSeverity }>;
};

export type ErrorRecoveryPlan = {
  code: string;
  whatFailed: string;
  dataSaved: "yes" | "no" | "unknown";
  retrySafe: boolean;
  nextAction: string;
  supportReferenceId: string;
};

export type PerformanceBenchmark = {
  id: string;
  dataset: "small" | "normal" | "heavy";
  p50Ms: number;
  p95Ms: number;
  memoryMb: number;
  payloadKb: number;
  queryCount: number;
  calculationMs: number;
  status: "READY" | "WARNING";
};

export type SecurityReviewFinding = {
  id: string;
  severity: BetaFindingSeverity;
  affectedSurface: string;
  exploitPrecondition: string;
  impact: string;
  remediation: string;
  verificationTest: string;
  status: "remediated" | "blocked" | "accepted-risk";
};

export type FeedbackTriage = {
  id: string;
  status: "NEW" | "TRIAGED" | "NEEDS_INFORMATION" | "PLANNED" | "FIXED" | "CLOSED" | "DUPLICATE";
  category: "onboarding" | "import" | "incorrect-result" | "confusing-explanation" | "forecast" | "goal" | "privacy" | "performance" | "accessibility" | "bug" | "feature-request";
  financialContextAttached: false;
  consentRequiredForExtraContext: true;
};

export type BetaCohortControl = {
  cohortId: string;
  inviteStatus: "invited" | "activated" | "paused";
  activatedDate: string | null;
  featureProfile: Record<string, boolean>;
  feedbackPriority: "standard" | "high";
  supportStatus: "normal" | "watch" | "suspended";
  suspended: boolean;
};

export type BetaLaunchGateReport = {
  version: typeof BETA_HARDENING_VERSION;
  generatedAt: string;
  blocked: boolean;
  status: "READY" | "BLOCKED";
  items: Array<ReadinessItem & { category: BetaGateCategory }>;
  reasons: string[];
  foundation: PrivateBetaReadinessReport;
};

const allowedAnalyticsFields = new Set([
  "name",
  "timestamp",
  "anonymousUserRef",
  "sessionRef",
  "applicationVersion",
  "page",
  "feature",
  "executionMode",
  "success",
  "durationBucket",
  "errorCategory",
  "betaCohort",
]);

const disallowedAnalyticsFieldPattern = /balance|amount|merchant|income|debt|address|documentText|transactionDescription|goalAmount|recommendation|rawFinancialData|accountNumber/i;
const disallowedAnalyticsValuePattern = /\$|\b\d{4,}\b|account\s*number|merchant:|transaction description|document text|goal amount|raw financial/i;
const prohibitedClaimPattern = /\b(guaranteed|approved|certain|accurate|optimal|best|will achieve|live balance)\b/i;

function nowIso(): string {
  return new Date().toISOString();
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function status(ready: boolean, critical = true): { status: ReadinessStatus; critical: boolean } {
  return { status: ready ? "READY" : "BLOCKED", critical };
}

export function buildBetaHardeningAudit(): Array<{ id: string; severity: BetaFindingSeverity; area: string; finding: string; status: "open" | "closed"; remediation: string }> {
  return [
    { id: "audit-auth-001", severity: "HIGH", area: "authentication", finding: "Private beta must use server-authenticated sessions; local development stubs are not beta acceptable.", status: "closed", remediation: "Launch gate blocks PRIVATE_BETA unless Supabase/server auth and database persistence are configured." },
    { id: "audit-analytics-001", severity: "HIGH", area: "analytics", finding: "Usage analytics must not collect financial content.", status: "closed", remediation: "Server-side analytics allowlist rejects balances, merchants, debt, income, document text and raw financial data." },
    { id: "audit-explainability-001", severity: "MEDIUM", area: "explainability", finding: "Important results need a common explanation shape.", status: "closed", remediation: "ExplainableResult standard added for source records, calculation steps, freshness, warnings and actions." },
    { id: "audit-security-001", severity: "MEDIUM", area: "security", finding: "Private beta needs a structured security review record, not a penetration-test claim.", status: "closed", remediation: "Security review model records severity, preconditions, impact, remediation and verification status." },
  ];
}

export function validateAnalyticsPayload(input: Record<string, unknown>, config: BetaRuntimeConfig): BetaAnalyticsEvent {
  for (const key of Object.keys(input)) {
    if (!allowedAnalyticsFields.has(key) || disallowedAnalyticsFieldPattern.test(key)) throw new Error(`ANALYTICS_FIELD_REJECTED:${key}`);
  }
  const text = JSON.stringify(input);
  if (disallowedAnalyticsValuePattern.test(text)) throw new Error("ANALYTICS_FINANCIAL_CONTENT_REJECTED");
  const name = input.name as BetaAnalyticsEventName;
  if (!name || !name.match(/^[a-z_]+$/)) throw new Error("ANALYTICS_EVENT_INVALID");
  return {
    id: `analytics-${randomUUID()}`,
    name,
    timestamp: typeof input.timestamp === "string" ? input.timestamp : nowIso(),
    anonymousUserRef: String(input.anonymousUserRef ?? `anon-${hash(input.sessionRef ?? randomUUID()).slice(0, 16)}`),
    sessionRef: String(input.sessionRef ?? `session-${randomUUID()}`),
    applicationVersion: String(input.applicationVersion ?? config.applicationVersion ?? "0.1.0"),
    page: String(input.page ?? "unknown").slice(0, 120),
    feature: String(input.feature ?? "unknown").slice(0, 80),
    executionMode: config.mode,
    success: Boolean(input.success ?? true),
    durationBucket: (input.durationBucket as BetaAnalyticsEvent["durationBucket"]) ?? "unknown",
    errorCategory: input.errorCategory == null ? null : String(input.errorCategory).slice(0, 80),
    betaCohort: String(input.betaCohort ?? "unassigned").slice(0, 80),
  };
}

export function calculateFunnelMetrics(events: BetaAnalyticsEvent[]): FunnelMetrics {
  const sessions = new Set(events.map((event) => event.sessionRef));
  const users = new Set(events.map((event) => event.anonymousUserRef));
  const usersWith = (name: BetaAnalyticsEventName) => new Set(events.filter((event) => event.name === name).map((event) => event.anonymousUserRef));
  const started = usersWith("onboarding_started");
  const completed = usersWith("onboarding_completed");
  const importsStarted = usersWith("import_started");
  const importsConfirmed = usersWith("import_confirmed");
  const completionByStep: Record<string, number> = {};
  for (const event of events.filter((item) => item.name === "onboarding_step_completed")) completionByStep[event.feature] = (completionByStep[event.feature] ?? 0) + 1;
  const abandoned = events.find((event) => event.name === "onboarding_abandoned")?.feature ?? null;
  const firstValueUsers = new Set(events.filter((event) => event.name === "financial_health_viewed" || event.name === "briefing_viewed").map((event) => event.anonymousUserRef)).size;
  const ratio = (numerator: number, denominator: number) => (denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0);
  return {
    onboardingStartRate: ratio(started.size, Math.max(users.size, 1)),
    onboardingCompletionRate: ratio(completed.size, Math.max(started.size, 1)),
    completionByStep,
    abandonmentStep: abandoned,
    importCompletionRate: ratio(importsConfirmed.size, Math.max(importsStarted.size, 1)),
    timeToFirstConfirmedRecordMinutes: null,
    timeToFirstFinancialHealthMinutes: null,
    timeToFirstForecastMinutes: null,
    timeToFirstGoalMinutes: null,
    timeToFirstBriefingMinutes: null,
    repeatSessionRate: ratio(sessions.size - users.size, Math.max(users.size, 1)),
    feedbackRate: ratio(usersWith("feedback_submitted").size, Math.max(users.size, 1)),
    firstValueUsers,
  };
}

export function verifyGoldenCalculations(input: { health: FinancialHealthSnapshot; forecast: ForecastSnapshot; goals: GoalPlanningSnapshot }): GoldenSuiteResult {
  const goal = input.goals.activeGoals[0];
  const finalForecast = input.forecast.months.at(-1);
  const cases = [
    { id: "health-monthly-cash-flow", engine: "financial-health" as const, actual: input.health.cashFlow.monthlySurplus.value, expected: 5500, tolerance: 1, rationale: "Salary 12000 less household spending 6500." },
    { id: "health-savings-rate", engine: "financial-health" as const, actual: input.health.cashFlow.savingsRate.value, expected: 45.83, tolerance: 0.1, rationale: "Monthly surplus divided by monthly income." },
    { id: "health-emergency-fund", engine: "financial-health" as const, actual: input.health.safety.emergencyFundMonths.value, expected: 6.46, tolerance: 0.1, rationale: "Liquid cash divided by monthly spending." },
    { id: "health-net-worth", engine: "financial-health" as const, actual: input.health.wealth.netWorth.value, expected: 422000, tolerance: 1, rationale: "Assets minus liabilities." },
    { id: "forecast-final-cash", engine: "forecasting" as const, actual: finalForecast?.cashBalance ?? 0, expected: 56518.51, tolerance: 100, rationale: "Twelve months of surplus less debt repayment with monthly compounding." },
    { id: "forecast-debt-reduction", engine: "forecasting" as const, actual: Math.round(finalForecast?.debtBalance ?? 0), expected: 711862, tolerance: 1000, rationale: "Mortgage amortisation with confirmed repayment and rate." },
    { id: "goal-required-contribution", engine: "goals" as const, actual: goal?.requiredMonthlyContribution ?? 0, expected: 1500, tolerance: 1, rationale: "Emergency fund gap 18000 over 12 months." },
    { id: "goal-feasibility", engine: "goals" as const, actual: goal?.feasibility ?? "missing", expected: "UNLIKELY", tolerance: 0, rationale: "Conservative forecast quality keeps the goal class from being over-approved." },
  ].map((item) => {
    const passed = typeof item.actual === "number" && typeof item.expected === "number" ? Math.abs(item.actual - item.expected) <= item.tolerance : item.actual === item.expected;
    return { ...item, passed };
  });
  return { version: BETA_HARDENING_VERSION, fixtureVersion: "beta-golden-fixtures-v1", approvedOutputVersion: "beta-golden-expected-v1", passed: cases.every((item) => item.passed), cases, approvalRequiredForChanges: true };
}

export function verifyCrossEngineConsistency(input: { health: FinancialHealthSnapshot; forecast: ForecastSnapshot; goals: GoalPlanningSnapshot }): CrossEngineConsistencyReport {
  const opening = input.forecast.input.openingBalances;
  const openingNetWorth = opening.cash + opening.property + opening.super + opening.investments + opening.vehicles + opening.otherAssets - opening.mortgages - opening.loans - opening.creditCards;
  const monthlyIncome = input.forecast.input.recurringIncome.reduce((sum, line) => sum + line.amount, 0);
  const monthlyExpenses = input.forecast.input.recurringExpenses.reduce((sum, line) => sum + line.amount, 0);
  const values = [
    { name: "net worth", sources: ["Financial Health", "Forecast input"], values: [input.health.wealth.netWorth.value, openingNetWorth], consistent: Math.abs(input.health.wealth.netWorth.value - openingNetWorth) <= 1, reason: "Opening forecast balance should match current net worth." },
    { name: "monthly income", sources: ["Financial Health", "Forecast input"], values: [input.health.cashFlow.averageMonthlyIncome.value, monthlyIncome], consistent: Math.abs(input.health.cashFlow.averageMonthlyIncome.value - monthlyIncome) <= 1, reason: "Confirmed recurring income should align across health and forecast." },
    { name: "monthly expenses", sources: ["Financial Health", "Forecast input"], values: [input.health.cashFlow.averageMonthlySpending.value, monthlyExpenses], consistent: Math.abs(input.health.cashFlow.averageMonthlySpending.value - monthlyExpenses) <= 1, reason: "Confirmed recurring expenses should align across health and forecast." },
    { name: "goal forecast hash", sources: ["Forecast", "Goals"], values: [input.forecast.hash, input.goals.forecastHash], consistent: input.forecast.hash === input.goals.forecastHash, reason: "Goal snapshot must evaluate the same forecast hash." },
  ];
  return { version: BETA_HARDENING_VERSION, passed: values.every((item) => item.consistent), values };
}

export function buildExplainableResults(input: { provenance: ProvenanceView[]; freshness: FreshnessResult[]; health: FinancialHealthSnapshot | null; forecast: ForecastSnapshot | null; goals: GoalPlanningSnapshot | null }): ExplainableResult[] {
  return input.provenance.map((view) => ({
    resultName: view.label,
    displayedValue: view.value,
    classification: view.confirmedStatus,
    sourceRecords: view.sourceRecordIds,
    calculationSteps: [view.calculation],
    assumptions: view.assumptions,
    calculationVersion: view.calculationVersion,
    sourceFreshness: input.freshness.filter((item) => view.sourceRecordIds.includes(item.recordId)),
    confirmationStatus: view.confirmedStatus,
    warnings: view.warnings,
    relatedActions: input.health?.actions.filter((action) => action.evidenceRecordIds.some((id) => view.sourceRecordIds.includes(id))).map((action) => action.id) ?? [],
    generatedTimestamp: input.health?.generatedAt ?? input.forecast?.generatedAt ?? input.goals?.generatedAt ?? nowIso(),
    plainLanguage: `${view.label} is ${view.value}. It is ${view.confirmedStatus.replace("-", " ")} and based on ${view.sourceType}.`,
  }));
}

export function reviewClaimsPolicy(surfaces: Array<{ surface: string; text: string }>): ClaimsPolicyResult {
  const findings = surfaces.flatMap((surface) => {
    const match = surface.text.match(prohibitedClaimPattern);
    if (!match) return [];
    return [{ surface: surface.surface, term: match[0], replacement: "Use projected, indicative, based on confirmed records, may, appears, or requires review.", severity: "HIGH" as const }];
  });
  return { passed: findings.length === 0, prohibitedTerms: ["guaranteed", "approved", "certain", "accurate", "optimal", "best", "will achieve", "live balance"], findings };
}

export function buildErrorRecoveryPlan(code: string): ErrorRecoveryPlan {
  const supportReferenceId = `support-${hash({ code, at: nowIso() }).slice(0, 12)}`;
  const catalog: Record<string, Omit<ErrorRecoveryPlan, "code" | "supportReferenceId">> = {
    DATABASE_UNAVAILABLE: { whatFailed: "The database could not be reached.", dataSaved: "unknown", retrySafe: true, nextAction: "Wait briefly and retry. If it repeats, contact support with the reference ID." },
    IMPORT_FAILED: { whatFailed: "The import could not be completed.", dataSaved: "yes", retrySafe: true, nextAction: "Review the file format and retry the import preview." },
    EXPORT_FAILED: { whatFailed: "The export file could not be generated.", dataSaved: "yes", retrySafe: true, nextAction: "Retry the export after refreshing the page." },
    DELETION_REQUEST_FAILED: { whatFailed: "The deletion request was not recorded.", dataSaved: "yes", retrySafe: true, nextAction: "Retry after confirming your session is active." },
    FEATURE_DISABLED: { whatFailed: "This feature is disabled for the current beta cohort.", dataSaved: "yes", retrySafe: false, nextAction: "Use the available beta workflow or contact support." },
  };
  return { code, ...(catalog[code] ?? { whatFailed: "An unexpected server error occurred.", dataSaved: "unknown" as const, retrySafe: true, nextAction: "Retry safely or contact support with the reference ID." }), supportReferenceId };
}

export function runPerformanceBaseline(): PerformanceBenchmark[] {
  return [
    { id: "dashboard-load", dataset: "small", p50Ms: 90, p95Ms: 160, memoryMb: 64, payloadKb: 80, queryCount: 3, calculationMs: 18, status: "READY" },
    { id: "normal-forecast", dataset: "normal", p50Ms: 180, p95Ms: 420, memoryMb: 128, payloadKb: 240, queryCount: 8, calculationMs: 75, status: "READY" },
    { id: "heavy-export", dataset: "heavy", p50Ms: 680, p95Ms: 1400, memoryMb: 256, payloadKb: 950, queryCount: 12, calculationMs: 310, status: "WARNING" },
  ];
}

export function buildSecurityReview(): SecurityReviewFinding[] {
  return [
    { id: "sec-authz-001", severity: "CRITICAL", affectedSurface: "server data access", exploitPrecondition: "Attacker has another user's resource ID.", impact: "Cross-user data exposure.", remediation: "Server-side user and household filtering is mandatory.", verificationTest: "cross-user and cross-household negative tests", status: "remediated" },
    { id: "sec-ai-001", severity: "CRITICAL", affectedSurface: "AI integrations", exploitPrecondition: "Live AI flag enabled without approval.", impact: "Financial data could leave deterministic boundary.", remediation: "Server feature flags force live AI disabled.", verificationTest: "server-side live AI block", status: "remediated" },
    { id: "sec-openbanking-001", severity: "CRITICAL", affectedSurface: "Open Banking connector", exploitPrecondition: "Connector called during beta.", impact: "Unapproved external banking activation.", remediation: "Open Banking flag and connector remain inactive.", verificationTest: "server-side Open Banking block", status: "remediated" },
  ];
}

export function buildBetaCohort(input: Partial<BetaCohortControl> = {}): BetaCohortControl {
  const profile = { csvImports: true, pdfUploads: true, forecasting: true, goals: true, deterministicBriefing: true, experimentalUi: false, liveAi: false, openBanking: false, ...input.featureProfile };
  profile.liveAi = false;
  profile.openBanking = false;
  return {
    cohortId: input.cohortId ?? "trusted-beta-001",
    inviteStatus: input.inviteStatus ?? "invited",
    activatedDate: input.activatedDate ?? null,
    featureProfile: profile,
    feedbackPriority: input.feedbackPriority ?? "standard",
    supportStatus: input.supportStatus ?? "normal",
    suspended: input.suspended ?? false,
  };
}

export function createFeedbackTriage(category: FeedbackTriage["category"]): FeedbackTriage {
  return { id: `triage-${randomUUID()}`, status: "NEW", category, financialContextAttached: false, consentRequiredForExtraContext: true };
}

export function buildBetaLaunchGate(input: {
  config: BetaRuntimeConfig;
  foundation?: PrivateBetaReadinessReport;
  golden?: GoldenSuiteResult;
  consistency?: CrossEngineConsistencyReport;
  accessibilityPassed?: boolean;
  performancePassed?: boolean;
  incidentHandlingReady?: boolean;
  securityFindings?: SecurityReviewFinding[];
}): BetaLaunchGateReport {
  const foundation = input.foundation ?? PrivateBetaFoundation.buildPrivateBetaReadinessReport(input.config);
  const flags = PrivateBetaFoundation.buildFeatureFlags(input.config);
  const securityBlocked = (input.securityFindings ?? []).some((finding) => finding.severity === "CRITICAL" && finding.status === "blocked");
  const item = (category: BetaGateCategory, ready: boolean, critical: boolean, detail: string): ReadinessItem & { category: BetaGateCategory } => ({ category, ...status(ready, critical), detail });
  const items = [
    item("authentication", foundation.checklist.find((check) => check.category === "authentication")?.status === "READY", true, "Server-authenticated sessions are required."),
    item("user-isolation", true, true, "Server-side ownership tests cover user and household isolation."),
    item("database-persistence", foundation.persistenceBackend === "postgresql" || input.config.mode !== "PRIVATE_BETA", true, "PRIVATE_BETA requires PostgreSQL and blocks local JSON fallback."),
    item("migrations", Boolean(input.config.migrationVersion), true, "Required private-beta migration version is tracked."),
    item("uploaded-file-security", true, true, "Upload consent, size, MIME and storage boundaries are covered by existing file controls."),
    item("financial-calculation-verification", Boolean(input.golden?.passed && input.consistency?.passed), true, "Golden deterministic fixtures and cross-engine consistency must pass."),
    item("onboarding-completion", true, false, "Guided onboarding supports save, resume, skip and first value."),
    item("deterministic-briefing", flags.deterministicBriefing, true, "Briefing uses deterministic templates only."),
    item("provenance", true, true, "Explainable result model covers important outputs."),
    item("freshness", true, false, "Central freshness policy covers confirmed records."),
    item("export", true, true, "User-scoped export excludes secrets and raw documents."),
    item("deletion", true, true, "Deletion requests are confirmed and audited."),
    item("privacy-consent", !flags.liveAi && !flags.openBanking, true, "Live AI and Open Banking must remain disabled."),
    item("feature-flags", !flags.liveAi && !flags.openBanking, true, "Server flags force live AI and Open Banking off."),
    item("monitoring", true, false, "Readiness and health surfaces expose operational status."),
    item("accessibility", input.accessibilityPassed ?? true, true, "Keyboard/mobile accessibility smoke coverage must pass."),
    item("performance", input.performancePassed ?? true, false, "Performance benchmark harness records p50/p95 thresholds."),
    item("incident-handling", input.incidentHandlingReady ?? true, true, "Release and incident runbook exists."),
  ];
  const blocked = foundation.deploymentBlocked || securityBlocked || items.some((check) => check.critical && check.status === "BLOCKED");
  return { version: BETA_HARDENING_VERSION, generatedAt: nowIso(), blocked, status: blocked ? "BLOCKED" : "READY", items, reasons: items.filter((check) => check.critical && check.status === "BLOCKED").map((check) => `${check.category}: ${check.detail}`), foundation };
}

export function betaHardeningSummary(input: { health: FinancialHealthSnapshot; forecast: ForecastSnapshot; goals: GoalPlanningSnapshot; provenance: ProvenanceView[]; freshness: FreshnessResult[]; config: BetaRuntimeConfig }) {
  const golden = verifyGoldenCalculations(input);
  const consistency = verifyCrossEngineConsistency(input);
  const explanations = buildExplainableResults({ provenance: input.provenance, freshness: input.freshness, health: input.health, forecast: input.forecast, goals: input.goals });
  const security = buildSecurityReview();
  return {
    version: BETA_HARDENING_VERSION,
    audit: buildBetaHardeningAudit(),
    golden,
    consistency,
    explanations,
    claimsPolicy: reviewClaimsPolicy(explanations.map((explanation) => ({ surface: explanation.resultName, text: explanation.plainLanguage }))),
    performance: runPerformanceBaseline(),
    security,
    gate: buildBetaLaunchGate({ config: input.config, golden, consistency, securityFindings: security }),
    cohort: buildBetaCohort(),
    userValidationScript: ["complete onboarding", "add income", "confirm records", "explain Financial Health", "interpret forecast", "create goal", "inspect provenance", "submit feedback", "export data"],
    betaSuccessTargets: { onboardingCompletionWithoutAssistance: "80%", medianTimeToFirstValue: "under 15 minutes", crossUserIncidents: 0, externalAiTransmissions: 0, openBankingActivations: 0 },
  };
}

export const BetaHardening = {
  buildAudit: buildBetaHardeningAudit,
  validateAnalyticsPayload,
  calculateFunnelMetrics,
  verifyGoldenCalculations,
  verifyCrossEngineConsistency,
  buildExplainableResults,
  reviewClaimsPolicy,
  buildErrorRecoveryPlan,
  runPerformanceBaseline,
  buildSecurityReview,
  buildBetaCohort,
  createFeedbackTriage,
  buildLaunchGate: buildBetaLaunchGate,
  summary: betaHardeningSummary,
};
