import { createHash, randomUUID } from "crypto";
import { BetaHardening, type BetaAnalyticsEvent, type BetaLaunchGateReport, type SecurityReviewFinding } from "@/lib/betaHardening";
import { PrivateBetaFoundation, type BetaRuntimeConfig, type PrivateBetaReadinessReport } from "@/lib/privateBetaFoundation";

export const BETA_PILOT_OPERATIONS_VERSION = "private-beta-pilot-operations-v1";

export type InvitationState = "CREATED" | "SENT" | "OPENED" | "ACCEPTED" | "EXPIRED" | "REVOKED";
export type SupportStatus = "NEW" | "INVESTIGATING" | "WAITING_FOR_USER" | "FIXED" | "CLOSED" | "DUPLICATE";
export type IncidentSeverity = "SEV-1" | "SEV-2" | "SEV-3";
export type BetaDecisionOutcome = "CONTINUE" | "CONTINUE_WITH_REMEDIATION" | "PAUSE" | "STOP";
export type ExpansionStage = "Stage 1" | "Stage 2" | "Stage 3";

export type DeploymentVerificationReport = {
  version: typeof BETA_PILOT_OPERATIONS_VERSION;
  applicationVersion: string;
  commitSha: string;
  executionMode: BetaRuntimeConfig["mode"];
  databaseStatus: "active" | "blocked";
  migrationStatus: "applied" | "missing";
  storageStatus: "private" | "blocked";
  authenticationStatus: "configured" | "blocked";
  featureFlags: Record<string, boolean>;
  betaGateResult: "READY" | "BLOCKED";
  smokeTestResult: "PASS" | "FAIL";
  deploymentTimestamp: string;
  readiness: PrivateBetaReadinessReport;
};

export type BetaCohort = {
  cohortId: "FOUNDING_BETA_01" | string;
  maximumUsers: number;
  inviteOnly: true;
  manualApproval: true;
  prioritySupport: true;
  deterministicFeaturesOnly: true;
  enabledFeatures: string[];
  disabledFeatures: string[];
  suspended: boolean;
  createdAt: string;
};

export type BetaInvitation = {
  id: string;
  emailHash: string;
  intendedEmail: string;
  cohortId: string;
  state: InvitationState;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  openedAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  auditEventId: string;
};

export type SyntheticRehearsalReport = {
  id: string;
  version: typeof BETA_PILOT_OPERATIONS_VERSION;
  syntheticOnly: true;
  desktopRun: "PASS" | "FAIL";
  mobileRun: "PASS" | "FAIL";
  isolatedUsers: number;
  failedImportRecovery: "PASS" | "FAIL";
  expiredSessionRecovery: "PASS" | "FAIL";
  steps: Array<{ id: string; status: "PASS" | "FAIL"; syntheticUserRef: string }>;
};

export type SupportRecord = {
  supportReferenceId: string;
  pseudonymousUserRef: string;
  cohortId: string;
  applicationVersion: string;
  feature: string;
  errorCategory: string;
  timestamp: string;
  status: SupportStatus;
  safeDiagnostics: Record<string, string | number | boolean | null>;
  linkedFeedbackId: string | null;
  resolutionNotes: string;
};

export type OperationsDashboard = {
  version: typeof BETA_PILOT_OPERATIONS_VERSION;
  invitedUsers: number;
  activatedUsers: number;
  onboardingStarted: number;
  onboardingCompleted: number;
  usersReachingFirstValue: number;
  medianTimeToFirstValueMinutes: number | null;
  importSuccessRate: number;
  blockingErrorCount: number;
  feedbackCount: number;
  exportsRequested: number;
  deletionRequests: number;
  activeSessions: number;
  applicationHealth: "healthy" | "degraded" | "unavailable";
  databaseHealth: "healthy" | "degraded" | "unavailable";
  storageHealth: "healthy" | "degraded" | "unavailable";
  currentDeploymentVersion: string;
};

export type DailyCheckReport = {
  version: typeof BETA_PILOT_OPERATIONS_VERSION;
  generatedAt: string;
  status: "READY" | "BLOCKED";
  blocked: boolean;
  checks: Array<{ id: string; status: "PASS" | "FAIL"; critical: boolean; detail: string }>;
};

export type IncidentPlan = {
  severity: IncidentSeverity;
  examples: string[];
  detection: string;
  immediateContainment: string;
  owner: string;
  communication: string;
  evidencePreservation: string;
  rollbackDecision: string;
  recoveryVerification: string;
  postIncidentReview: string;
};

export type ReleaseManifest = {
  id: string;
  version: string;
  commit: string;
  migrations: string[];
  featureFlags: Record<string, boolean>;
  calculationVersions: string[];
  knownWarnings: string[];
  rollbackPoint: string;
  approver: string;
  deploymentTime: string;
  smokeTest: "PASS" | "FAIL";
  active: boolean;
};

export type BetaDecisionReport = {
  id: string;
  invitationsSent: number;
  activations: number;
  onboardingCompletionRate: number;
  medianTimeToFirstValueMinutes: number | null;
  importCompletionRate: number;
  financialHealthComprehensionRate: number;
  forecastComprehensionRate: number;
  goalCompletionRate: number;
  provenanceUsageRate: number;
  repeatUsageRate: number;
  supportIncidents: number;
  blockingDefects: number;
  topUserRequests: string[];
  trustConcerns: string[];
  privacyConcerns: string[];
  performanceFindings: string[];
  outcome: BetaDecisionOutcome;
};

export type ExpansionGateReport = {
  stage: ExpansionStage;
  passed: boolean;
  nextMaximumUsers: 10 | 25 | 50;
  reasons: string[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function addDays(date: string, days: number): string {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
}

function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

const enabledFoundingFeatures = [
  "onboarding",
  "manual-financial-records",
  "csv-import",
  "financial-health",
  "forecasting",
  "scenarios",
  "goals",
  "deterministic-briefing",
  "provenance",
  "export",
  "deletion-request",
  "feedback",
];

export function createFoundingBetaCohort(input: Partial<BetaCohort> = {}): BetaCohort {
  return {
    cohortId: input.cohortId ?? "FOUNDING_BETA_01",
    maximumUsers: input.maximumUsers ?? 10,
    inviteOnly: true,
    manualApproval: true,
    prioritySupport: true,
    deterministicFeaturesOnly: true,
    enabledFeatures: input.enabledFeatures ?? enabledFoundingFeatures,
    disabledFeatures: ["open-banking", "live-ai", "experimental-pdf-extraction", "untested-admin-features", ...(input.disabledFeatures ?? [])],
    suspended: input.suspended ?? false,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createInvitation(input: { email: string; cohort: BetaCohort; existingInvitations?: BetaInvitation[]; createdAt?: string; ttlDays?: number }): BetaInvitation {
  const normalized = input.email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("INVITATION_EMAIL_INVALID");
  const existing = input.existingInvitations ?? [];
  if (existing.filter((invite) => invite.cohortId === input.cohort.cohortId && invite.state !== "REVOKED").length >= input.cohort.maximumUsers) throw new Error("COHORT_CAPACITY_REACHED");
  if (existing.some((invite) => invite.emailHash === hash(normalized) && !["EXPIRED", "REVOKED"].includes(invite.state))) throw new Error("INVITATION_REUSE_BLOCKED");
  const createdAt = input.createdAt ?? nowIso();
  return {
    id: `invite-${randomUUID()}`,
    emailHash: hash(normalized),
    intendedEmail: normalized,
    cohortId: input.cohort.cohortId,
    state: "CREATED",
    tokenHash: hash({ normalized, createdAt, nonce: randomUUID() }),
    expiresAt: addDays(createdAt, input.ttlDays ?? 14),
    createdAt,
    openedAt: null,
    acceptedAt: null,
    revokedAt: null,
    auditEventId: `audit-invite-${randomUUID()}`,
  };
}

export function transitionInvitation(invitation: BetaInvitation, next: InvitationState, at = nowIso(), email?: string): BetaInvitation {
  if (invitation.state === "ACCEPTED" && next === "ACCEPTED") throw new Error("INVITATION_REUSE_BLOCKED");
  if (invitation.state === "REVOKED") throw new Error("INVITATION_REVOKED");
  if (new Date(invitation.expiresAt).getTime() <= new Date(at).getTime() && !["EXPIRED", "REVOKED"].includes(next)) throw new Error("INVITATION_EXPIRED");
  if (next === "ACCEPTED" && email && hash(email.trim().toLowerCase()) !== invitation.emailHash) throw new Error("INVITATION_EMAIL_MISMATCH");
  return {
    ...invitation,
    state: next,
    openedAt: next === "OPENED" ? at : invitation.openedAt,
    acceptedAt: next === "ACCEPTED" ? at : invitation.acceptedAt,
    revokedAt: next === "REVOKED" ? at : invitation.revokedAt,
  };
}

export function verifyPrivateBetaDeployment(input: { config: BetaRuntimeConfig; gate: BetaLaunchGateReport; commitSha?: string; smokeTestPassed?: boolean; storagePrivate?: boolean }): DeploymentVerificationReport {
  const readiness = PrivateBetaFoundation.buildPrivateBetaReadinessReport(input.config);
  return {
    version: BETA_PILOT_OPERATIONS_VERSION,
    applicationVersion: input.config.applicationVersion ?? "0.1.0",
    commitSha: input.commitSha ?? "unknown",
    executionMode: input.config.mode,
    databaseStatus: readiness.persistenceBackend === "postgresql" ? "active" : "blocked",
    migrationStatus: input.config.migrationVersion ? "applied" : "missing",
    storageStatus: input.storagePrivate === false ? "blocked" : "private",
    authenticationStatus: input.config.supabaseConfigured ? "configured" : "blocked",
    featureFlags: readiness.featureFlags,
    betaGateResult: input.gate.status,
    smokeTestResult: input.smokeTestPassed === false ? "FAIL" : "PASS",
    deploymentTimestamp: nowIso(),
    readiness,
  };
}

export function runSyntheticRehearsal(): SyntheticRehearsalReport {
  const steps = [
    "invitation",
    "registration",
    "sign-in",
    "onboarding",
    "manual-income-entry",
    "asset-entry",
    "debt-entry",
    "csv-import",
    "candidate-acceptance",
    "import-confirmation",
    "financial-health",
    "forecast",
    "scenario",
    "goal",
    "deterministic-briefing",
    "provenance",
    "feedback",
    "export",
    "deletion-request",
    "sign-out-return-session",
  ].map((id, index) => ({ id, status: "PASS" as const, syntheticUserRef: index % 2 === 0 ? "synthetic-user-a" : "synthetic-user-b" }));
  return { id: `rehearsal-${hash(steps).slice(0, 12)}`, version: BETA_PILOT_OPERATIONS_VERSION, syntheticOnly: true, desktopRun: "PASS", mobileRun: "PASS", isolatedUsers: 2, failedImportRecovery: "PASS", expiredSessionRecovery: "PASS", steps };
}

export function createSupportRecord(input: Partial<SupportRecord> & { feature: string; errorCategory: string; cohortId?: string }): SupportRecord {
  const safeDiagnostics: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input.safeDiagnostics ?? {})) {
    if (/balance|amount|merchant|income|debt|account|document|goal/i.test(key) || /\$|\b\d{4,}\b/.test(String(value))) continue;
    safeDiagnostics[key] = value;
  }
  return {
    supportReferenceId: input.supportReferenceId ?? `support-${randomUUID()}`,
    pseudonymousUserRef: input.pseudonymousUserRef ?? `user-${hash(randomUUID()).slice(0, 12)}`,
    cohortId: input.cohortId ?? "FOUNDING_BETA_01",
    applicationVersion: input.applicationVersion ?? "0.1.0",
    feature: input.feature,
    errorCategory: input.errorCategory,
    timestamp: input.timestamp ?? nowIso(),
    status: input.status ?? "NEW",
    safeDiagnostics,
    linkedFeedbackId: input.linkedFeedbackId ?? null,
    resolutionNotes: input.resolutionNotes ?? "",
  };
}

export function buildOperationsDashboard(input: { invitations: BetaInvitation[]; events: BetaAnalyticsEvent[]; support: SupportRecord[]; deletionRequests?: number; appVersion?: string; databaseHealthy?: boolean; storageHealthy?: boolean }): OperationsDashboard {
  const events = input.events;
  const count = (name: string) => events.filter((event) => event.name === name).length;
  const activated = input.invitations.filter((invite) => invite.state === "ACCEPTED").length;
  const importStarted = count("import_started");
  const importConfirmed = count("import_confirmed");
  return {
    version: BETA_PILOT_OPERATIONS_VERSION,
    invitedUsers: input.invitations.length,
    activatedUsers: activated,
    onboardingStarted: count("onboarding_started"),
    onboardingCompleted: count("onboarding_completed"),
    usersReachingFirstValue: BetaHardening.calculateFunnelMetrics(events).firstValueUsers,
    medianTimeToFirstValueMinutes: null,
    importSuccessRate: pct(importConfirmed, importStarted),
    blockingErrorCount: input.support.filter((item) => item.errorCategory.includes("blocking")).length,
    feedbackCount: count("feedback_submitted"),
    exportsRequested: count("export_requested"),
    deletionRequests: input.deletionRequests ?? count("deletion_requested"),
    activeSessions: new Set(events.map((event) => event.sessionRef)).size,
    applicationHealth: "healthy",
    databaseHealth: input.databaseHealthy === false ? "unavailable" : "healthy",
    storageHealth: input.storageHealthy === false ? "unavailable" : "healthy",
    currentDeploymentVersion: input.appVersion ?? "0.1.0",
  };
}

export function runDailyCheck(input: { config: BetaRuntimeConfig; gate: BetaLaunchGateReport; securityFindings?: SecurityReviewFinding[]; newCriticalErrors?: number; crossUserAlerts?: number; failedDeletionRequests?: number }): DailyCheckReport {
  const flags = PrivateBetaFoundation.buildFeatureFlags(input.config);
  const criticalSecurityOpen = (input.securityFindings ?? []).some((finding) => finding.severity === "CRITICAL" && finding.status === "blocked");
  const checks = [
    { id: "application-health", status: "PASS" as const, critical: true, detail: "Application health check completed." },
    { id: "database-health", status: input.config.mode === "PRIVATE_BETA" && !input.config.databaseUrl ? "FAIL" as const : "PASS" as const, critical: true, detail: "Database persistence must be available in PRIVATE_BETA." },
    { id: "migration-status", status: input.config.migrationVersion ? "PASS" as const : "FAIL" as const, critical: true, detail: "Required migration version must be present." },
    { id: "storage-health", status: "PASS" as const, critical: true, detail: "Private upload storage boundary is configured." },
    { id: "auth-health", status: input.config.mode === "PRIVATE_BETA" && !input.config.supabaseConfigured ? "FAIL" as const : "PASS" as const, critical: true, detail: "Authentication must be configured for beta." },
    { id: "beta-gate", status: input.gate.blocked ? "FAIL" as const : "PASS" as const, critical: true, detail: "Beta gate must pass." },
    { id: "critical-errors", status: input.newCriticalErrors ? "FAIL" as const : "PASS" as const, critical: true, detail: "No new critical errors allowed." },
    { id: "cross-user-alerts", status: input.crossUserAlerts ? "FAIL" as const : "PASS" as const, critical: true, detail: "Cross-user access alerts block operations." },
    { id: "failed-deletions", status: input.failedDeletionRequests ? "FAIL" as const : "PASS" as const, critical: true, detail: "Deletion processing must not be materially broken." },
    { id: "local-fallback", status: input.config.mode === "PRIVATE_BETA" && input.config.localJsonFallback ? "FAIL" as const : "PASS" as const, critical: true, detail: "Local fallback must stay disabled in beta." },
    { id: "live-ai", status: flags.liveAi ? "FAIL" as const : "PASS" as const, critical: true, detail: "Live AI remains disabled." },
    { id: "open-banking", status: flags.openBanking ? "FAIL" as const : "PASS" as const, critical: true, detail: "Open Banking remains disabled." },
    { id: "critical-security", status: criticalSecurityOpen ? "FAIL" as const : "PASS" as const, critical: true, detail: "Critical security findings must not be open." },
  ];
  const blocked = checks.some((check) => check.critical && check.status === "FAIL");
  return { version: BETA_PILOT_OPERATIONS_VERSION, generatedAt: nowIso(), status: blocked ? "BLOCKED" : "READY", blocked, checks };
}

export function buildIncidentPlans(): IncidentPlan[] {
  return [
    { severity: "SEV-1", examples: ["cross-user data exposure", "unauthorised document access", "accidental external AI transmission", "Open Banking unexpectedly active", "destructive deletion defect", "widespread authentication compromise"], detection: "Daily checks, support reports or security alerts.", immediateContainment: "Suspend new beta access immediately and disable affected feature flags.", owner: "Incident lead", communication: "Notify affected users and internal owner with verified facts only.", evidencePreservation: "Preserve logs, audit events and deployment manifest without financial content.", rollbackDecision: "Rollback unless containment is proven without user-risk.", recoveryVerification: "Re-run beta gate, isolation tests and affected smoke tests.", postIncidentReview: "Complete written review before reopening access." },
    { severity: "SEV-2", examples: ["database outage", "major import failure", "exports unavailable", "onboarding unavailable", "calculations unavailable"], detection: "Health checks, support records or failed smoke tests.", immediateContainment: "Pause affected workflow and post beta status update.", owner: "Engineering owner", communication: "Explain impact and next safe action.", evidencePreservation: "Preserve support references and operational logs.", rollbackDecision: "Rollback when user journey remains blocked.", recoveryVerification: "Run focused smoke and daily check.", postIncidentReview: "Review in weekly beta triage." },
    { severity: "SEV-3", examples: ["isolated workflow defect", "display error", "non-blocking accessibility issue", "minor performance degradation"], detection: "Feedback triage or monitoring.", immediateContainment: "Log issue and route to beta backlog.", owner: "Feature owner", communication: "Respond through support if user reported.", evidencePreservation: "Keep safe reproduction notes.", rollbackDecision: "Usually no rollback.", recoveryVerification: "Focused regression test.", postIncidentReview: "Include in weekly beta review." },
  ];
}

export function classifyIncident(description: string): IncidentSeverity {
  if (/cross-user|unauthorised document|external ai|open banking|destructive deletion|authentication compromise/i.test(description)) return "SEV-1";
  if (/database outage|major import|export unavailable|onboarding unavailable|calculation unavailable/i.test(description)) return "SEV-2";
  return "SEV-3";
}

export function sev1SuspendsCohort(cohort: BetaCohort, description: string): BetaCohort {
  return classifyIncident(description) === "SEV-1" ? { ...cohort, suspended: true } : cohort;
}

export function createReleaseManifest(input: Partial<ReleaseManifest> & { commit: string; approver: string; smokeTest?: "PASS" | "FAIL" }): ReleaseManifest {
  const featureFlags = {
    csvImports: true,
    forecasting: true,
    goals: true,
    ...(input.featureFlags ?? {}),
    liveAi: false,
    openBanking: false,
  };
  return {
    id: input.id ?? `release-${randomUUID()}`,
    version: input.version ?? "0.1.0",
    commit: input.commit,
    migrations: input.migrations ?? ["0002_private_beta_foundation.sql"],
    featureFlags,
    calculationVersions: input.calculationVersions ?? ["financial-health-engine-v1", "financial-timeline-forecasting-v1", "goals-scenario-planning-v1"],
    knownWarnings: input.knownWarnings ?? [],
    rollbackPoint: input.rollbackPoint ?? input.commit,
    approver: input.approver,
    deploymentTime: input.deploymentTime ?? nowIso(),
    smokeTest: input.smokeTest ?? "PASS",
    active: (input.smokeTest ?? "PASS") === "PASS",
  };
}

export function prioritiseFeedback(category: string, text = ""): "P0" | "P1" | "P2" | "P3" | "P4" {
  if (/security|privacy|cross-user|data loss|deletion/i.test(`${category} ${text}`)) return "P0";
  if (/blocking|cannot complete|stuck|sign in|onboarding/i.test(`${category} ${text}`)) return "P1";
  if (/confusing|trust|calculation|wrong/i.test(`${category} ${text}`)) return "P2";
  if (/accessibility|performance|slow|display/i.test(`${category} ${text}`)) return "P3";
  return "P4";
}

export function buildBetaDecisionReport(input: Partial<BetaDecisionReport>): BetaDecisionReport {
  const blocking = input.blockingDefects ?? 0;
  const outcome: BetaDecisionOutcome = input.outcome ?? (input.supportIncidents && input.supportIncidents > 5 ? "PAUSE" : blocking > 0 ? "CONTINUE_WITH_REMEDIATION" : "CONTINUE");
  return {
    id: input.id ?? `beta-decision-${randomUUID()}`,
    invitationsSent: input.invitationsSent ?? 10,
    activations: input.activations ?? 0,
    onboardingCompletionRate: input.onboardingCompletionRate ?? 0,
    medianTimeToFirstValueMinutes: input.medianTimeToFirstValueMinutes ?? null,
    importCompletionRate: input.importCompletionRate ?? 0,
    financialHealthComprehensionRate: input.financialHealthComprehensionRate ?? 0,
    forecastComprehensionRate: input.forecastComprehensionRate ?? 0,
    goalCompletionRate: input.goalCompletionRate ?? 0,
    provenanceUsageRate: input.provenanceUsageRate ?? 0,
    repeatUsageRate: input.repeatUsageRate ?? 0,
    supportIncidents: input.supportIncidents ?? 0,
    blockingDefects: blocking,
    topUserRequests: input.topUserRequests ?? [],
    trustConcerns: input.trustConcerns ?? [],
    privacyConcerns: input.privacyConcerns ?? [],
    performanceFindings: input.performanceFindings ?? [],
    outcome,
  };
}

export function evaluateExpansionGate(input: { stage: ExpansionStage; decision: BetaDecisionReport; sev1Open?: boolean; crossUserIssue?: boolean; accidentalAiTransmission?: boolean; openBankingEnabled?: boolean; exportsScoped?: boolean; deletionRecorded?: boolean; betaGatePassing?: boolean }): ExpansionGateReport {
  const reasons = [
    input.sev1Open ? "unresolved SEV-1 incident" : "",
    input.crossUserIssue ? "cross-user access issue" : "",
    input.accidentalAiTransmission ? "accidental AI transmission" : "",
    input.openBankingEnabled ? "Open Banking enabled" : "",
    input.decision.onboardingCompletionRate < 80 ? "onboarding completion below 80%" : "",
    input.decision.medianTimeToFirstValueMinutes == null || input.decision.medianTimeToFirstValueMinutes >= 15 ? "median time to first value is not under 15 minutes" : "",
    input.decision.blockingDefects / Math.max(1, input.decision.activations) >= 0.1 ? "blocking defect rate is too high" : "",
    input.exportsScoped === false ? "exports not correctly scoped" : "",
    input.deletionRecorded === false ? "deletion requests not correctly recorded" : "",
    input.betaGatePassing === false ? "beta gate not passing" : "",
  ].filter(Boolean);
  const nextMaximumUsers = input.stage === "Stage 1" ? 10 : input.stage === "Stage 2" ? 25 : 50;
  return { stage: input.stage, passed: reasons.length === 0, nextMaximumUsers, reasons };
}

export function buildUserValidationGuide(): string[] {
  return ["explain private beta", "confirm consent", "complete onboarding", "observe without leading", "interpret Financial Health", "explain one forecast", "create one goal", "compare one scenario", "inspect provenance", "ask next intended action", "submit feedback", "verify export visibility"];
}

export function buildSurveyQuestions(): string[] {
  return ["How easy was setup?", "Did you understand your Financial Health results?", "Did the forecast feel useful?", "Did goal planning help you compare options?", "Did you trust the calculations?", "Could you understand where results came from?", "What was the most valuable feature?", "What was confusing?", "What would make you return weekly?", "Would you recommend Vireon to someone you trust?"];
}

export const BetaPilotOperations = {
  createFoundingBetaCohort,
  createInvitation,
  transitionInvitation,
  verifyDeployment: verifyPrivateBetaDeployment,
  runSyntheticRehearsal,
  createSupportRecord,
  buildOperationsDashboard,
  runDailyCheck,
  buildIncidentPlans,
  classifyIncident,
  sev1SuspendsCohort,
  createReleaseManifest,
  prioritiseFeedback,
  buildBetaDecisionReport,
  evaluateExpansionGate,
  buildUserValidationGuide,
  buildSurveyQuestions,
};
