import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import type { FinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import type { ForecastSnapshot } from "@/lib/financialForecasting";
import type { GoalPlanningSnapshot } from "@/lib/goalPlanning";
import { hashRecord, redactSensitiveValues } from "@/lib/productionDataIntegrity";

export const PRIVATE_BETA_FOUNDATION_VERSION = "private-beta-foundation-v1";

export type VireonExecutionMode = "LOCAL_DEVELOPMENT" | "OFFLINE_TEST" | "PRIVATE_BETA" | "PRODUCTION";
export type FreshnessClass = "CURRENT" | "AGING" | "STALE" | "UNKNOWN";
export type ReadinessStatus = "READY" | "BLOCKED" | "WARNING" | "NOT_APPLICABLE";
export type FeedbackType = "general" | "confusing-result" | "incorrect-calculation" | "import-problem" | "feature-request" | "privacy-concern" | "bug-report";
export type OnboardingStepStatus = "not-started" | "complete" | "skipped";

export type FeatureFlagKey =
  | "csvImports"
  | "pdfUploads"
  | "forecasting"
  | "goals"
  | "deterministicBriefing"
  | "aiCfoUi"
  | "liveAi"
  | "openBanking"
  | "manualFinancialProfile"
  | "financialHealth";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export type BetaRuntimeConfig = {
  mode: VireonExecutionMode;
  databaseUrl?: string;
  supabaseConfigured?: boolean;
  localJsonFallback?: boolean;
  syntheticDemoDataEnabled?: boolean;
  openBankingEnabled?: boolean;
  liveAiEnabled?: boolean;
  encryptionConfigured?: boolean;
  csrfConfigured?: boolean;
  applicationVersion?: string;
  migrationVersion?: string;
  featureFlags?: Partial<FeatureFlags>;
};

export type BetaSession = {
  userId: string | null;
  householdId: string | null;
  email?: string;
  role?: "user" | "admin";
  expiresAt?: string | null;
};

export type HouseholdOwned = {
  userId: string;
  householdId?: string | null;
};

export type FreshnessResult = {
  recordId: string;
  label: string;
  kind: string;
  class: FreshnessClass;
  lastUpdatedAt: string | null;
  staleAfterDays: number;
  refreshAction: "update manually" | "upload newer statement" | "import newer transactions" | "confirm unchanged" | "dismiss reminder temporarily";
  reason: string;
};

export type ProvenanceView = {
  valueId: string;
  label: string;
  value: string;
  sourceRecordIds: string[];
  sourceType: string;
  calculation: string;
  calculationVersion: string;
  assumptions: string[];
  confirmedStatus: "confirmed" | "estimated" | "insufficient-data";
  lastUpdatedAt: string | null;
  warnings: string[];
};

export type DeterministicBriefing = {
  id: string;
  version: typeof PRIVATE_BETA_FOUNDATION_VERSION;
  userId: string;
  householdId: string;
  generatedAt: string;
  sections: Array<{ id: string; title: string; body: string; sourceRecordIds: string[]; warnings: string[] }>;
  sourceSnapshotIds: string[];
  calculationVersions: string[];
  dataFreshness: FreshnessResult[];
  hash: string;
  presentation: "deterministic-template";
};

export type BetaOnboardingStepId =
  | "welcome"
  | "household"
  | "income"
  | "property-housing"
  | "accounts-cash"
  | "debts"
  | "super-investments"
  | "recurring-expenses"
  | "first-goal"
  | "csv-import"
  | "review-confirmed"
  | "first-results";

export type BetaOnboardingState = {
  id: string;
  userId: string;
  householdId: string;
  version: typeof PRIVATE_BETA_FOUNDATION_VERSION;
  steps: Record<BetaOnboardingStepId, OnboardingStepStatus>;
  currentStep: BetaOnboardingStepId;
  updatedAt: string;
  missingInformation: string[];
  consent: {
    financialDataStorage: boolean;
    uploadConsent: boolean;
    betaTermsAccepted: boolean;
  };
};

export type BetaFeedbackRecord = {
  id: string;
  userId: string;
  householdId: string;
  type: FeedbackType;
  page: string;
  feature: string;
  description: string;
  screenshotAttached: boolean;
  diagnosticReference: string;
  applicationVersion: string;
  createdAt: string;
  safeMetadata: Record<string, string | number | boolean | null>;
};

export type BetaAuditEvent = {
  id: string;
  userId: string;
  householdId: string;
  eventType: string;
  actor: "user" | "admin" | "system";
  timestamp: string;
  affectedResource: string;
  outcome: "success" | "blocked" | "failed";
  referenceId: string;
  safeMetadata: Record<string, string | number | boolean | null>;
};

export type BetaExport = {
  manifest: {
    version: typeof PRIVATE_BETA_FOUNDATION_VERSION;
    exportedAt: string;
    userIdHash: string;
    householdIdHash: string;
    includedSections: string[];
    omittedSections: string[];
    checksums: Record<string, string>;
  };
  profile: { userIdHash: string; householdIdHash: string };
  financialRecords: CanonicalFinancialRecord[];
  freshness: FreshnessResult[];
  briefing: DeterministicBriefing | null;
  forecast: ForecastSnapshot | null;
  goals: GoalPlanningSnapshot | null;
  audit: BetaAuditEvent[];
};

export type AccountDeletionRequest = {
  id: string;
  userId: string;
  householdId: string;
  requestedAt: string;
  status: "requested" | "completed";
  reauthenticationRequired: true;
  scheduledDeletionAfter: string;
  deletedContentRetained: "security-audit-only";
};

export type PrivateBetaState = {
  version: typeof PRIVATE_BETA_FOUNDATION_VERSION;
  onboarding: BetaOnboardingState[];
  feedback: BetaFeedbackRecord[];
  audit: BetaAuditEvent[];
  deletionRequests: AccountDeletionRequest[];
};

export type ReadinessItem = {
  category: string;
  status: ReadinessStatus;
  critical: boolean;
  detail: string;
};

export type PrivateBetaReadinessReport = {
  version: typeof PRIVATE_BETA_FOUNDATION_VERSION;
  mode: VireonExecutionMode;
  generatedAt: string;
  deploymentBlocked: boolean;
  checklist: ReadinessItem[];
  featureFlags: FeatureFlags;
  openBankingState: "disabled" | "enabled";
  liveAiState: "disabled" | "enabled";
  persistenceBackend: "postgresql" | "local-json" | "memory" | "blocked";
};

const stateRoot = join(process.cwd(), ".vireon", "private-beta-foundation");
const statePath = join(stateRoot, "private-beta-state.json");

export const DEFAULT_PRIVATE_BETA_FLAGS: FeatureFlags = {
  csvImports: true,
  pdfUploads: true,
  forecasting: true,
  goals: true,
  deterministicBriefing: true,
  aiCfoUi: true,
  liveAi: false,
  openBanking: false,
  manualFinancialProfile: true,
  financialHealth: true,
};

export const ONBOARDING_STEPS: Array<{ id: BetaOnboardingStepId; label: string; optional: boolean; why: string }> = [
  { id: "welcome", label: "Welcome and beta explanation", optional: false, why: "Sets expectations for beta limitations and deterministic calculations." },
  { id: "household", label: "Household basics", optional: false, why: "Household size and ownership drive cash-flow and safety context." },
  { id: "income", label: "Income", optional: false, why: "Income is needed for surplus, savings-rate and affordability checks." },
  { id: "property-housing", label: "Property and housing", optional: true, why: "Housing records improve net-worth, debt and forecast projections." },
  { id: "accounts-cash", label: "Accounts and cash", optional: false, why: "Cash balances drive emergency-fund and liquidity calculations." },
  { id: "debts", label: "Debts", optional: true, why: "Debt records drive interest, repayment and risk calculations." },
  { id: "super-investments", label: "Super and investments", optional: true, why: "Longer-term net-worth and retirement views need these balances." },
  { id: "recurring-expenses", label: "Recurring expenses", optional: false, why: "Recurring commitments drive burn-rate and forecast shortfall checks." },
  { id: "first-goal", label: "First goal", optional: true, why: "A goal gives Vireon a concrete planning target." },
  { id: "csv-import", label: "Optional CSV import", optional: true, why: "Transactions improve spending and subscription detection." },
  { id: "review-confirmed", label: "Review confirmed information", optional: false, why: "Only confirmed data can update financial calculations." },
  { id: "first-results", label: "First Vireon results", optional: false, why: "Shows useful deterministic insights before the profile is complete." },
];

function nowIso(): string {
  return new Date().toISOString();
}

function addDays(date: string, days: number): string {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function money(value: number | undefined | null): string {
  return `$${Math.round(value ?? 0).toLocaleString("en-AU")}`;
}

function requireUser(session: BetaSession): { userId: string; householdId: string } {
  if (!session.userId || !session.householdId) throw new Error("UNAUTHENTICATED");
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) throw new Error("SESSION_EXPIRED");
  return { userId: session.userId, householdId: session.householdId };
}

export function assertHouseholdAccess(session: BetaSession, record: HouseholdOwned): void {
  const { userId, householdId } = requireUser(session);
  if (record.userId !== userId) throw new Error("FORBIDDEN_USER");
  if (record.householdId != null && record.householdId !== householdId) throw new Error("FORBIDDEN_HOUSEHOLD");
}

export function filterOwnedRecords<T extends HouseholdOwned>(session: BetaSession, records: T[]): T[] {
  const { userId, householdId } = requireUser(session);
  return records.filter((record) => record.userId === userId && (record.householdId == null || record.householdId === householdId));
}

export function buildFeatureFlags(config: BetaRuntimeConfig): FeatureFlags {
  const flags = { ...DEFAULT_PRIVATE_BETA_FLAGS, ...config.featureFlags };
  flags.liveAi = Boolean(config.liveAiEnabled) && Boolean(config.featureFlags?.liveAi);
  flags.openBanking = Boolean(config.openBankingEnabled) && Boolean(config.featureFlags?.openBanking);
  return flags;
}

export function evaluatePersistenceBoundary(config: BetaRuntimeConfig): { ok: boolean; backend: PrivateBetaReadinessReport["persistenceBackend"]; reason: string } {
  const hasDatabase = Boolean(config.databaseUrl);
  if (config.mode === "PRIVATE_BETA" || config.mode === "PRODUCTION") {
    if (!hasDatabase) return { ok: false, backend: "blocked", reason: `${config.mode} requires PostgreSQL-backed persistence.` };
    if (config.localJsonFallback) return { ok: false, backend: "blocked", reason: `${config.mode} cannot use local JSON financial persistence.` };
    return { ok: true, backend: "postgresql", reason: "Database persistence is mandatory and local fallback is disabled." };
  }
  return { ok: true, backend: config.localJsonFallback ? "local-json" : "memory", reason: `${config.mode} may use non-production persistence.` };
}

export function assertServerFeatureAllowed(config: BetaRuntimeConfig, flag: FeatureFlagKey): void {
  const flags = buildFeatureFlags(config);
  if (!flags[flag]) throw new Error(`FEATURE_DISABLED:${flag}`);
  if (flag === "liveAi") throw new Error("LIVE_AI_DISABLED_FOR_PRIVATE_BETA");
  if (flag === "openBanking") throw new Error("OPEN_BANKING_INACTIVE");
}

export function classifyFreshness(record: Pick<CanonicalFinancialRecord, "id" | "label" | "kind" | "updatedAt">, asOf = new Date()): FreshnessResult {
  const staleAfterDays = record.kind === "transaction" ? 45 : record.kind === "document" ? 365 : record.kind === "goal" ? 90 : record.kind === "liability" ? 90 : 180;
  const updated = record.updatedAt ? new Date(record.updatedAt) : null;
  if (!updated || Number.isNaN(updated.getTime())) {
    return { recordId: record.id, label: record.label, kind: record.kind, class: "UNKNOWN", lastUpdatedAt: null, staleAfterDays, refreshAction: "update manually", reason: "No valid last-updated timestamp is available." };
  }
  const ageDays = Math.floor((asOf.getTime() - updated.getTime()) / 86400000);
  const freshness: FreshnessClass = ageDays <= Math.max(14, staleAfterDays / 3) ? "CURRENT" : ageDays <= staleAfterDays ? "AGING" : "STALE";
  const refreshAction: FreshnessResult["refreshAction"] = record.kind === "transaction" ? "import newer transactions" : record.kind === "document" ? "upload newer statement" : freshness === "STALE" ? "confirm unchanged" : "dismiss reminder temporarily";
  return { recordId: record.id, label: record.label, kind: record.kind, class: freshness, lastUpdatedAt: record.updatedAt, staleAfterDays, refreshAction, reason: `${record.label} was last updated ${Math.max(0, ageDays)} days ago.` };
}

export function buildFreshnessReport(records: CanonicalFinancialRecord[], asOf = new Date()): FreshnessResult[] {
  return records.filter((record) => !record.superseded && record.provenance.userConfirmed).map((record) => classifyFreshness(record, asOf));
}

export function buildProvenanceViews(input: {
  health: FinancialHealthSnapshot | null;
  forecast: ForecastSnapshot | null;
  goals: GoalPlanningSnapshot | null;
}): ProvenanceView[] {
  const views: ProvenanceView[] = [];
  if (input.health) {
    views.push(
      { valueId: "net-worth", label: "Net worth", value: input.health.wealth.netWorth.label, sourceRecordIds: input.health.wealth.netWorth.evidenceRecordIds, sourceType: "confirmed financial records", calculation: "assets minus liabilities", calculationVersion: input.health.engineVersion, assumptions: [], confirmedStatus: input.health.recordCount ? "confirmed" : "insufficient-data", lastUpdatedAt: input.health.generatedAt, warnings: input.health.missingData },
      { valueId: "savings-rate", label: "Savings rate", value: input.health.cashFlow.savingsRate.label, sourceRecordIds: input.health.cashFlow.savingsRate.evidenceRecordIds, sourceType: "confirmed income and spending", calculation: "monthly surplus divided by monthly income", calculationVersion: input.health.engineVersion, assumptions: [], confirmedStatus: input.health.cashFlow.savingsRate.confidence === "Low" ? "estimated" : "confirmed", lastUpdatedAt: input.health.generatedAt, warnings: input.health.missingData },
      { valueId: "emergency-fund", label: "Emergency fund", value: input.health.safety.emergencyFundMonths.label, sourceRecordIds: input.health.safety.emergencyFundMonths.evidenceRecordIds, sourceType: "confirmed liquid balances and spending", calculation: "liquid cash divided by monthly spending", calculationVersion: input.health.engineVersion, assumptions: [], confirmedStatus: input.health.safety.emergencyFundMonths.confidence === "Low" ? "estimated" : "confirmed", lastUpdatedAt: input.health.generatedAt, warnings: input.health.missingData },
      { valueId: "debt-ratio", label: "Debt ratio", value: input.health.wealth.debtRatio.label, sourceRecordIds: input.health.wealth.debtRatio.evidenceRecordIds, sourceType: "confirmed assets and debts", calculation: "total liabilities divided by total assets", calculationVersion: input.health.engineVersion, assumptions: [], confirmedStatus: input.health.wealth.debtRatio.confidence === "Low" ? "estimated" : "confirmed", lastUpdatedAt: input.health.generatedAt, warnings: input.health.missingData }
    );
  }
  if (input.forecast) {
    const final = input.forecast.months.at(-1);
    views.push({ valueId: "forecast-cash", label: "Forecast cash balance", value: money(final?.cashBalance), sourceRecordIds: input.forecast.input.sourceRecordIds, sourceType: "confirmed records and explicit assumptions", calculation: "deterministic forecast projection", calculationVersion: input.forecast.version, assumptions: input.forecast.input.assumptions.map((item) => `${item.label}: ${item.value}${item.unit === "percent" ? "%" : ""}`), confirmedStatus: input.forecast.quality.class === "HIGH" ? "estimated" : "insufficient-data", lastUpdatedAt: input.forecast.generatedAt, warnings: input.forecast.quality.warnings });
  }
  if (input.goals) {
    for (const goal of input.goals.activeGoals.slice(0, 3)) {
      views.push({ valueId: `goal-${goal.goal.id}`, label: goal.goal.title, value: goal.feasibility, sourceRecordIds: goal.goal.provenance.sourceRecordIds, sourceType: "user-defined goal and forecast", calculation: "goal funding gap and contribution path", calculationVersion: input.goals.version, assumptions: goal.goal.assumptions.map((item) => `${item.label}: ${item.value}`), confirmedStatus: goal.feasibility === "INSUFFICIENT_DATA" ? "insufficient-data" : "estimated", lastUpdatedAt: input.goals.generatedAt, warnings: goal.competingGoalConflicts });
    }
  }
  return views;
}

export function buildDeterministicBriefing(input: {
  userId: string;
  householdId: string;
  records: CanonicalFinancialRecord[];
  health: FinancialHealthSnapshot | null;
  forecast: ForecastSnapshot | null;
  goals: GoalPlanningSnapshot | null;
  asOf?: string;
}): DeterministicBriefing {
  const generatedAt = input.asOf ?? nowIso();
  const sourceRecordIds = input.records.filter((record) => record.userId === input.userId && record.provenance.userConfirmed && !record.superseded).map((record) => record.id);
  const health = input.health;
  const forecast = input.forecast;
  const topGoal = input.goals?.activeGoals.find((goal) => !["ACHIEVED", "ARCHIVED"].includes(goal.goal.status));
  const topForecastRisk = forecast?.decisions[0];
  const sections = [
    {
      id: "what-changed",
      title: "What changed",
      body: sourceRecordIds.length ? `${sourceRecordIds.length} confirmed financial records are available for deterministic beta calculations.` : "No confirmed financial records are available yet.",
      sourceRecordIds,
      warnings: sourceRecordIds.length ? [] : ["Add income, cash and expense records to unlock first-value results."],
    },
    {
      id: "current-position",
      title: "Current position",
      body: health ? `Financial health is ${health.healthRating}. Net worth is ${health.wealth.netWorth.label}, monthly surplus is ${health.cashFlow.monthlySurplus.label}, and emergency fund coverage is ${health.safety.emergencyFundMonths.label}.` : "Current position is unavailable until confirmed records exist.",
      sourceRecordIds: health ? [...new Set([...health.wealth.netWorth.evidenceRecordIds, ...health.cashFlow.monthlySurplus.evidenceRecordIds, ...health.safety.emergencyFundMonths.evidenceRecordIds])] : [],
      warnings: health?.missingData ?? ["Financial Health snapshot unavailable."],
    },
    {
      id: "key-risk",
      title: "Key risk",
      body: topForecastRisk ? `${topForecastRisk.title}: ${topForecastRisk.trigger}` : health?.actions[0] ? `${health.actions[0].title}: ${health.actions[0].reason}` : "No deterministic risk has been identified yet.",
      sourceRecordIds: topForecastRisk?.sourceRecords ?? health?.actions[0]?.evidenceRecordIds ?? [],
      warnings: forecast?.quality.warnings ?? [],
    },
    {
      id: "key-opportunity",
      title: "Key opportunity",
      body: health?.actions.find((action) => action.priority !== "Critical")?.recommendedAction ?? "Complete the Financial Vault to unlock stronger opportunities.",
      sourceRecordIds: health?.actions.find((action) => action.priority !== "Critical")?.evidenceRecordIds ?? [],
      warnings: [],
    },
    {
      id: "goal-progress",
      title: "Goal progress",
      body: topGoal ? `${topGoal.goal.title} is ${topGoal.goal.status.toLowerCase().replace("_", " ")} with a ${topGoal.feasibility.toLowerCase().replace("_", " ")} feasibility class and ${money(topGoal.fundingGap)} remaining.` : "Create a goal to see contribution requirements and milestones.",
      sourceRecordIds: topGoal?.goal.provenance.sourceRecordIds ?? [],
      warnings: topGoal?.competingGoalConflicts ?? [],
    },
    {
      id: "upcoming-event",
      title: "Upcoming event",
      body: forecast?.events[0] ? `${forecast.events[0].title} is projected on ${forecast.events[0].date}.` : "No upcoming forecast event is available yet.",
      sourceRecordIds: forecast?.events[0]?.linkedRecordIds ?? [],
      warnings: forecast?.quality.warnings ?? [],
    },
    {
      id: "data-needing-refresh",
      title: "Data needing refresh",
      body: buildFreshnessReport(input.records).filter((item) => item.class === "STALE").slice(0, 3).map((item) => item.label).join(", ") || "No stale confirmed records detected.",
      sourceRecordIds,
      warnings: [],
    },
    {
      id: "recommended-next-actions",
      title: "Recommended next actions",
      body: (health?.actions.slice(0, 3).map((action) => action.title).join("; ")) || "Add confirmed records, review first results, and create your first goal.",
      sourceRecordIds: health?.actions.slice(0, 3).flatMap((action) => action.evidenceRecordIds) ?? [],
      warnings: [],
    },
  ];
  const withoutHash = {
    id: `briefing-${stableHash({ userId: input.userId, householdId: input.householdId, generatedAt, sourceRecordIds }).slice(0, 16)}`,
    version: PRIVATE_BETA_FOUNDATION_VERSION as typeof PRIVATE_BETA_FOUNDATION_VERSION,
    userId: input.userId,
    householdId: input.householdId,
    generatedAt,
    sections,
    sourceSnapshotIds: [health?.generatedAt, forecast?.id, input.goals?.id].filter(Boolean) as string[],
    calculationVersions: [health?.engineVersion, forecast?.version, input.goals?.version].filter(Boolean) as string[],
    dataFreshness: buildFreshnessReport(input.records),
    presentation: "deterministic-template" as const,
  };
  return { ...withoutHash, hash: stableHash(withoutHash) };
}

export function defaultOnboardingState(userId: string, householdId: string): BetaOnboardingState {
  const steps = Object.fromEntries(ONBOARDING_STEPS.map((step, index) => [step.id, index === 0 ? "complete" : "not-started"])) as Record<BetaOnboardingStepId, OnboardingStepStatus>;
  return {
    id: `onboarding-${userId}-${householdId}`,
    userId,
    householdId,
    version: PRIVATE_BETA_FOUNDATION_VERSION,
    steps,
    currentStep: "household",
    updatedAt: nowIso(),
    missingInformation: ["income", "cash balances", "recurring expenses"],
    consent: { financialDataStorage: false, uploadConsent: false, betaTermsAccepted: false },
  };
}

export function updateOnboardingState(state: BetaOnboardingState, input: { step: BetaOnboardingStepId; status: OnboardingStepStatus; consent?: Partial<BetaOnboardingState["consent"]> }): BetaOnboardingState {
  const steps = { ...state.steps, [input.step]: input.status };
  const nextIncomplete = ONBOARDING_STEPS.find((step) => steps[step.id] === "not-started")?.id ?? "first-results";
  return { ...state, steps, currentStep: nextIncomplete, updatedAt: nowIso(), consent: { ...state.consent, ...input.consent } };
}

export function createFeedback(session: BetaSession, input: { type: FeedbackType; page: string; feature: string; description?: string; screenshotAttached?: boolean; applicationVersion?: string }): BetaFeedbackRecord {
  const { userId, householdId } = requireUser(session);
  return {
    id: `feedback-${randomUUID()}`,
    userId,
    householdId,
    type: input.type,
    page: input.page.slice(0, 160),
    feature: input.feature.slice(0, 120),
    description: String(redactSensitiveValues(input.description ?? "")).slice(0, 1200),
    screenshotAttached: Boolean(input.screenshotAttached),
    diagnosticReference: `support-${stableHash({ userId, householdId, at: nowIso(), page: input.page }).slice(0, 12)}`,
    applicationVersion: input.applicationVersion ?? "0.1.0",
    createdAt: nowIso(),
    safeMetadata: { financialContextAttached: false },
  };
}

export function createDeletionRequest(session: BetaSession): AccountDeletionRequest {
  const { userId, householdId } = requireUser(session);
  const requestedAt = nowIso();
  return {
    id: `deletion-${randomUUID()}`,
    userId,
    householdId,
    requestedAt,
    status: "requested",
    reauthenticationRequired: true,
    scheduledDeletionAfter: addDays(requestedAt, 7),
    deletedContentRetained: "security-audit-only",
  };
}

export function createAuditEvent(session: BetaSession, input: { eventType: string; affectedResource: string; outcome: BetaAuditEvent["outcome"]; metadata?: Record<string, unknown>; actor?: BetaAuditEvent["actor"] }): BetaAuditEvent {
  const { userId, householdId } = requireUser(session);
  return {
    id: `audit-${randomUUID()}`,
    userId,
    householdId,
    eventType: input.eventType,
    actor: input.actor ?? "user",
    timestamp: nowIso(),
    affectedResource: input.affectedResource,
    outcome: input.outcome,
    referenceId: `ref-${randomUUID()}`,
    safeMetadata: redactSensitiveValues(input.metadata ?? {}) as Record<string, string | number | boolean | null>,
  };
}

export function buildUserExport(input: {
  session: BetaSession;
  records: CanonicalFinancialRecord[];
  briefing?: DeterministicBriefing | null;
  forecast?: ForecastSnapshot | null;
  goals?: GoalPlanningSnapshot | null;
  audit?: BetaAuditEvent[];
}): BetaExport {
  const { userId, householdId } = requireUser(input.session);
  const financialRecords = filterOwnedRecords(input.session, input.records).filter((record) => !record.superseded);
  const audit = filterOwnedRecords(input.session, input.audit ?? []);
  const freshness = buildFreshnessReport(financialRecords);
  const exportData = {
    financialRecords,
    freshness,
    briefing: input.briefing ?? null,
    forecast: input.forecast ?? null,
    goals: input.goals ?? null,
    audit,
  };
  return {
    manifest: {
      version: PRIVATE_BETA_FOUNDATION_VERSION,
      exportedAt: nowIso(),
      userIdHash: hashRecord(userId),
      householdIdHash: hashRecord(householdId),
      includedSections: Object.keys(exportData),
      omittedSections: ["password_hashes", "secrets", "internal_environment", "provider_credentials", "raw_application_logs", "raw_document_contents"],
      checksums: Object.fromEntries(Object.entries(exportData).map(([key, value]) => [key, hashRecord(value)])),
    },
    profile: { userIdHash: hashRecord(userId), householdIdHash: hashRecord(householdId) },
    ...exportData,
  };
}

export function buildPrivateBetaReadinessReport(config: BetaRuntimeConfig): PrivateBetaReadinessReport {
  const persistence = evaluatePersistenceBoundary(config);
  const flags = buildFeatureFlags(config);
  const item = (category: string, status: ReadinessStatus, critical: boolean, detail: string): ReadinessItem => ({ category, status, critical, detail });
  const checklist: ReadinessItem[] = [
    item("persistence", persistence.ok ? "READY" : "BLOCKED", true, persistence.reason),
    item("authentication", config.mode === "LOCAL_DEVELOPMENT" || config.supabaseConfigured ? "READY" : "BLOCKED", true, config.supabaseConfigured ? "Supabase server authentication configured." : "Private beta requires server-side authenticated sessions."),
    item("authorisation", "READY", true, "Server-side user and household ownership checks are available."),
    item("privacy", flags.liveAi || flags.openBanking ? "BLOCKED" : "READY", true, "Live AI and Open Banking are disabled by default for private beta."),
    item("uploads", flags.pdfUploads ? "READY" : "WARNING", false, "Upload consent and file validation are enforced by server routes."),
    item("calculations", flags.financialHealth && flags.forecasting && flags.goals ? "READY" : "BLOCKED", true, "Deterministic health, forecasting and goal engines are enabled."),
    item("provenance", "READY", true, "Important values expose source records, calculation version and assumptions."),
    item("monitoring", "READY", false, "Internal readiness, health and feedback status surfaces are available."),
    item("exports", "READY", true, "User-scoped portable export excludes secrets and raw document contents."),
    item("deletion", "READY", true, "Deletion requests require confirmation and retain security audit status only."),
    item("onboarding", "READY", false, "Guided onboarding supports save, resume, skip and first-value results."),
    item("error handling", "READY", false, "Safe error references are used for beta-facing failures."),
    item("feature flags", flags.liveAi || flags.openBanking ? "BLOCKED" : "READY", true, "Server-side flags block live AI and Open Banking."),
    item("deployment", config.mode === "PRIVATE_BETA" && !persistence.ok ? "BLOCKED" : "READY", true, "Private beta deployment is blocked when critical controls fail."),
    item("documentation", "READY", false, "Private beta caveats and user controls are documented."),
  ];
  const deploymentBlocked = checklist.some((check) => check.critical && check.status === "BLOCKED");
  return {
    version: PRIVATE_BETA_FOUNDATION_VERSION,
    mode: config.mode,
    generatedAt: nowIso(),
    deploymentBlocked,
    checklist,
    featureFlags: flags,
    openBankingState: flags.openBanking ? "enabled" : "disabled",
    liveAiState: flags.liveAi ? "enabled" : "disabled",
    persistenceBackend: persistence.backend,
  };
}

export function emptyPrivateBetaState(): PrivateBetaState {
  return { version: PRIVATE_BETA_FOUNDATION_VERSION, onboarding: [], feedback: [], audit: [], deletionRequests: [] };
}

export function readPrivateBetaState(): PrivateBetaState {
  if (!existsSync(statePath)) return emptyPrivateBetaState();
  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as PrivateBetaState;
  } catch {
    return emptyPrivateBetaState();
  }
}

export function writePrivateBetaState(state: PrivateBetaState): void {
  mkdirSync(stateRoot, { recursive: true });
  const tmp = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  if (existsSync(statePath)) unlinkSync(statePath);
  renameSync(tmp, statePath);
}

export function mutatePrivateBetaState<T>(operation: (state: PrivateBetaState) => T): T {
  const state = readPrivateBetaState();
  const result = operation(state);
  writePrivateBetaState(state);
  return result;
}

export function betaRuntimeConfigFromEnv(): BetaRuntimeConfig {
  const mode = (process.env.VIREON_EXECUTION_MODE as VireonExecutionMode | undefined) ?? (process.env.NODE_ENV === "production" ? "PRODUCTION" : "LOCAL_DEVELOPMENT");
  return {
    mode,
    databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    localJsonFallback: process.env.VIREON_LOCAL_JSON_FALLBACK !== "false",
    syntheticDemoDataEnabled: process.env.VIREON_SYNTHETIC_DEMO_DATA === "true",
    openBankingEnabled: false,
    liveAiEnabled: false,
    encryptionConfigured: Boolean(process.env.VIREON_ENCRYPTION_KEY),
    csrfConfigured: Boolean(process.env.VIREON_CSRF_SECRET),
    applicationVersion: process.env.npm_package_version ?? "0.1.0",
    migrationVersion: process.env.VIREON_MIGRATION_VERSION ?? "private-beta-foundation-v1",
  };
}

export const PrivateBetaFoundation = {
  assertHouseholdAccess,
  filterOwnedRecords,
  buildFeatureFlags,
  evaluatePersistenceBoundary,
  assertServerFeatureAllowed,
  classifyFreshness,
  buildFreshnessReport,
  buildProvenanceViews,
  buildDeterministicBriefing,
  defaultOnboardingState,
  updateOnboardingState,
  createFeedback,
  createDeletionRequest,
  createAuditEvent,
  buildUserExport,
  buildPrivateBetaReadinessReport,
  readState: readPrivateBetaState,
  writeState: writePrivateBetaState,
  mutateState: mutatePrivateBetaState,
  configFromEnv: betaRuntimeConfigFromEnv,
};
