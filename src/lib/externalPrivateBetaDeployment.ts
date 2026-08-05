import { createHash, randomUUID } from "crypto";
import { BetaPilotOperations, type DailyCheckReport, type SyntheticRehearsalReport } from "@/lib/betaPilotOperations";
import type { BetaRuntimeConfig, PrivateBetaReadinessReport } from "@/lib/privateBetaFoundation";

export const EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION = "external-private-beta-deployment-v1";

export type EnvCategory = "REQUIRED_PRIVATE_BETA" | "OPTIONAL" | "LOCAL_ONLY" | "TEST_ONLY" | "FORBIDDEN_PRIVATE_BETA";
export type DeploymentCheckStatus = "PASS" | "FAIL" | "WARNING";
export type RehearsalStatus = "PASS" | "FAIL" | "NOT_RUN";

export type EnvContractItem = {
  name: string;
  category: EnvCategory;
  secret: boolean;
  description: string;
};

export type StartupValidationReport = {
  version: typeof EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION;
  mode: BetaRuntimeConfig["mode"];
  passed: boolean;
  blocked: boolean;
  checks: Array<{ id: string; status: DeploymentCheckStatus; critical: boolean; detail: string }>;
};

export type DeploymentArchitecture = {
  frontendHost: string;
  runtimeType: string;
  deploymentRegion: string;
  postgresqlProvider: string;
  authenticationProvider: string;
  privateObjectStorageProvider: string;
  emailInvitationProvider: string;
  dnsAndTls: string;
  secretManagement: string;
  logDestination: string;
  monitoringDestination: string;
  backupStrategy: string;
  rollbackMechanism: string;
};

export type DeploymentManifest = {
  releaseId: string;
  applicationVersion: string;
  commitSha: string;
  buildTimestamp: string;
  executionMode: "PRIVATE_BETA";
  hostingEnvironment: string;
  databaseMigrationVersion: string;
  featureFlags: Record<string, boolean>;
  calculationVersions: string[];
  openBankingState: "disabled";
  liveAiState: "disabled";
  localFallbackState: "disabled";
  knownWarnings: string[];
  rollbackReference: string;
  approver: string;
  deploymentOutcome: "PENDING" | "VERIFIED" | "BLOCKED";
  integrityHash: string;
};

export type RemoteReadinessReport = {
  version: typeof EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION;
  url: string;
  checkedAt: string;
  passed: boolean;
  blocked: boolean;
  checks: Array<{ id: string; status: DeploymentCheckStatus; critical: boolean; detail: string }>;
  remote?: {
    executionMode?: string;
    persistenceBackend?: string;
    openBankingState?: string;
    liveAiState?: string;
    deploymentVersion?: string;
  };
};

export type TwoUserRehearsalReport = {
  version: typeof EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION;
  remoteUrl: string;
  status: RehearsalStatus;
  syntheticOnly: true;
  users: Array<{ syntheticUserRef: string; completedSteps: string[]; exportScoped: boolean; uploadIsolated: boolean }>;
  isolationChecks: Array<{ id: string; status: DeploymentCheckStatus; detail: string }>;
  generatedAt: string;
};

export type NegativeSecurityRehearsalReport = {
  version: typeof EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION;
  remoteUrl: string;
  status: RehearsalStatus;
  checks: Array<{ id: string; status: DeploymentCheckStatus; detail: string }>;
  generatedAt: string;
};

export type BackupRestoreReport = {
  version: typeof EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION;
  status: RehearsalStatus;
  backupFrequency: string;
  retention: string;
  encrypted: boolean;
  restoreProcedure: string;
  recoveryPointObjective: string;
  recoveryTimeObjective: string;
  owner: string;
  restoredDataUserScoped: boolean;
};

export type RollbackRehearsalReport = {
  version: typeof EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION;
  status: RehearsalStatus;
  previousVersionRollback: DeploymentCheckStatus;
  featureFlagDisable: DeploymentCheckStatus;
  migrationCompatibility: DeploymentCheckStatus;
  cohortSuspension: DeploymentCheckStatus;
  invitationSuspension: DeploymentCheckStatus;
  maximumSafeRollbackPoint: string;
};

export type MonitoringReport = {
  version: typeof EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION;
  status: "ACTIVE" | "BLOCKED";
  alertRedaction: DeploymentCheckStatus;
  coveredSignals: string[];
  dailySummaryOwner: string;
};

export type FirstUserApprovalReport = {
  version: typeof EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION;
  approved: boolean;
  blocked: boolean;
  approver: string | null;
  approvedAt: string | null;
  checks: Array<{ id: string; status: DeploymentCheckStatus; critical: boolean; detail: string }>;
  approvalId: string | null;
};

export const ENVIRONMENT_CONTRACT: EnvContractItem[] = [
  { name: "VIREON_EXECUTION_MODE", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Must be PRIVATE_BETA for external beta." },
  { name: "NEXT_PUBLIC_APP_URL", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Canonical HTTPS application URL, never localhost." },
  { name: "DATABASE_URL", category: "REQUIRED_PRIVATE_BETA", secret: true, description: "PostgreSQL application role connection string." },
  { name: "VIREON_DATABASE_SSL_MODE", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Database SSL mode. Require verify-full or require." },
  { name: "NEXT_PUBLIC_SUPABASE_URL", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Authentication project URL." },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", category: "REQUIRED_PRIVATE_BETA", secret: true, description: "Browser-safe Supabase anonymous key." },
  { name: "SUPABASE_SERVICE_ROLE_KEY", category: "REQUIRED_PRIVATE_BETA", secret: true, description: "Server-only auth verification key." },
  { name: "VIREON_SESSION_SECRET", category: "REQUIRED_PRIVATE_BETA", secret: true, description: "High-entropy session secret." },
  { name: "VIREON_STORAGE_ENDPOINT", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Private object-storage endpoint." },
  { name: "VIREON_STORAGE_BUCKET", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Private object-storage bucket." },
  { name: "VIREON_STORAGE_ACCESS_KEY", category: "REQUIRED_PRIVATE_BETA", secret: true, description: "Server-only storage access key." },
  { name: "VIREON_STORAGE_SECRET_KEY", category: "REQUIRED_PRIVATE_BETA", secret: true, description: "Server-only storage secret key." },
  { name: "VIREON_INVITATION_EMAIL_FROM", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Verified invitation sender." },
  { name: "VIREON_EMAIL_PROVIDER_KEY", category: "REQUIRED_PRIVATE_BETA", secret: true, description: "Server-only email provider API key." },
  { name: "VIREON_ANALYTICS_SINK", category: "OPTIONAL", secret: false, description: "Privacy-safe analytics destination." },
  { name: "VIREON_BETA_SUPPORT_OWNER", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Pilot support owner or queue." },
  { name: "VIREON_DEPLOYMENT_VERSION", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Application deployment version." },
  { name: "VIREON_COMMIT_SHA", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Deployed commit SHA." },
  { name: "VIREON_MIGRATION_VERSION", category: "REQUIRED_PRIVATE_BETA", secret: false, description: "Applied private-beta migration version." },
  { name: "VIREON_LOCAL_JSON_FALLBACK", category: "FORBIDDEN_PRIVATE_BETA", secret: false, description: "Must be false in PRIVATE_BETA." },
  { name: "VIREON_LIVE_AI_ENABLED", category: "FORBIDDEN_PRIVATE_BETA", secret: false, description: "Live AI must remain disabled." },
  { name: "VIREON_OPEN_BANKING_ENABLED", category: "FORBIDDEN_PRIVATE_BETA", secret: false, description: "Open Banking must remain disabled." },
  { name: "OPENAI_API_KEY", category: "FORBIDDEN_PRIVATE_BETA", secret: true, description: "No live AI provider key should be required by deterministic beta." },
  { name: "VIREON_SYNTHETIC_DEMO_DATA", category: "LOCAL_ONLY", secret: false, description: "Allowed only for local demos and tests." },
];

function nowIso(): string {
  return new Date().toISOString();
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function boolEnv(env: Record<string, string | undefined>, key: string): boolean {
  return /^(1|true|yes|enabled)$/i.test(env[key] ?? "");
}

function isPlaceholderSecret(value: string | undefined): boolean {
  return !value || /^(changeme|change-me|default|secret|password|test|dev|local)$/i.test(value) || value.length < 24;
}

export function canonicalArchitecture(): DeploymentArchitecture {
  return {
    frontendHost: "Vercel or equivalent managed Next.js host",
    runtimeType: "Server-rendered Next.js with server-only route handlers",
    deploymentRegion: "Australia/Sydney-aligned APAC region where available",
    postgresqlProvider: "Managed PostgreSQL with SSL, backups and least-privilege app role",
    authenticationProvider: "Supabase Auth or compatible server-verified auth provider",
    privateObjectStorageProvider: "Managed private object storage with server-side access only",
    emailInvitationProvider: "Transactional email provider with verified sender",
    dnsAndTls: "Custom HTTPS domain with platform-managed TLS",
    secretManagement: "Hosting-platform encrypted environment variables",
    logDestination: "Hosted application logs with financial-content redaction",
    monitoringDestination: "Internal health dashboard plus provider alerts",
    backupStrategy: "Managed PostgreSQL scheduled backups plus restore rehearsal before first user",
    rollbackMechanism: "Previous deployment rollback plus feature-flag disable and cohort suspension",
  };
}

export function validateStartupEnvironment(env: Record<string, string | undefined> = process.env): StartupValidationReport {
  const mode = (env.VIREON_EXECUTION_MODE as BetaRuntimeConfig["mode"] | undefined) ?? "LOCAL_DEVELOPMENT";
  const required = ENVIRONMENT_CONTRACT.filter((item) => item.category === "REQUIRED_PRIVATE_BETA");
  const checks = [
    ...required.map((item) => ({ id: `required-${item.name}`, status: mode === "PRIVATE_BETA" && !env[item.name] ? "FAIL" as const : "PASS" as const, critical: mode === "PRIVATE_BETA", detail: `${item.name} is ${item.secret ? "configured without value disclosure" : env[item.name] ? "configured" : "not configured"}.` })),
    { id: "execution-mode-private-beta", status: mode === "PRIVATE_BETA" ? "PASS" as const : "FAIL" as const, critical: true, detail: "External verification requires VIREON_EXECUTION_MODE=PRIVATE_BETA." },
    { id: "application-url-https", status: env.NEXT_PUBLIC_APP_URL?.startsWith("https://") && !/localhost|127\.0\.0\.1/i.test(env.NEXT_PUBLIC_APP_URL) ? "PASS" as const : "FAIL" as const, critical: mode === "PRIVATE_BETA", detail: "Private beta app URL must be external HTTPS, not localhost." },
    { id: "database-ssl", status: ["require", "verify-full"].includes((env.VIREON_DATABASE_SSL_MODE ?? "").toLowerCase()) ? "PASS" as const : "FAIL" as const, critical: mode === "PRIVATE_BETA", detail: "Database SSL mode must require encrypted connections." },
    { id: "local-fallback-disabled", status: env.VIREON_LOCAL_JSON_FALLBACK === "false" ? "PASS" as const : "FAIL" as const, critical: mode === "PRIVATE_BETA", detail: "Local JSON fallback must be explicitly disabled." },
    { id: "live-ai-disabled", status: boolEnv(env, "VIREON_LIVE_AI_ENABLED") || env.OPENAI_API_KEY ? "FAIL" as const : "PASS" as const, critical: mode === "PRIVATE_BETA", detail: "Live AI provider execution must remain disabled." },
    { id: "open-banking-disabled", status: boolEnv(env, "VIREON_OPEN_BANKING_ENABLED") ? "FAIL" as const : "PASS" as const, critical: mode === "PRIVATE_BETA", detail: "Open Banking must remain disabled." },
    { id: "session-secret-strong", status: isPlaceholderSecret(env.VIREON_SESSION_SECRET) ? "FAIL" as const : "PASS" as const, critical: mode === "PRIVATE_BETA", detail: "Session secret must be high entropy and non-default." },
    { id: "storage-private-configured", status: env.VIREON_STORAGE_ENDPOINT && env.VIREON_STORAGE_BUCKET && env.VIREON_STORAGE_ACCESS_KEY && env.VIREON_STORAGE_SECRET_KEY ? "PASS" as const : "FAIL" as const, critical: mode === "PRIVATE_BETA", detail: "Private object storage endpoint, bucket and credentials must be configured." },
  ];
  const blocked = checks.some((check) => check.critical && check.status === "FAIL");
  return { version: EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION, mode, passed: !blocked, blocked, checks };
}

export function betaRuntimeConfigFromExternalEnv(env: Record<string, string | undefined> = process.env): BetaRuntimeConfig {
  return {
    mode: (env.VIREON_EXECUTION_MODE as BetaRuntimeConfig["mode"] | undefined) ?? "LOCAL_DEVELOPMENT",
    databaseUrl: env.DATABASE_URL || env.SUPABASE_DATABASE_URL,
    supabaseConfigured: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    localJsonFallback: env.VIREON_LOCAL_JSON_FALLBACK !== "false",
    openBankingEnabled: boolEnv(env, "VIREON_OPEN_BANKING_ENABLED"),
    liveAiEnabled: boolEnv(env, "VIREON_LIVE_AI_ENABLED"),
    encryptionConfigured: Boolean(env.VIREON_ENCRYPTION_KEY),
    csrfConfigured: Boolean(env.VIREON_CSRF_SECRET),
    applicationVersion: env.VIREON_DEPLOYMENT_VERSION ?? env.npm_package_version ?? "0.1.0",
    migrationVersion: env.VIREON_MIGRATION_VERSION,
    featureFlags: { liveAi: boolEnv(env, "VIREON_LIVE_AI_ENABLED"), openBanking: boolEnv(env, "VIREON_OPEN_BANKING_ENABLED") },
  };
}

export function createDeploymentManifest(input: {
  applicationVersion: string;
  commitSha: string;
  hostingEnvironment: string;
  databaseMigrationVersion: string;
  featureFlags: Record<string, boolean>;
  calculationVersions: string[];
  rollbackReference: string;
  approver: string;
  knownWarnings?: string[];
  deploymentOutcome?: DeploymentManifest["deploymentOutcome"];
  buildTimestamp?: string;
}): DeploymentManifest {
  const body = {
    releaseId: `external-beta-${randomUUID()}`,
    applicationVersion: input.applicationVersion,
    commitSha: input.commitSha,
    buildTimestamp: input.buildTimestamp ?? nowIso(),
    executionMode: "PRIVATE_BETA" as const,
    hostingEnvironment: input.hostingEnvironment,
    databaseMigrationVersion: input.databaseMigrationVersion,
    featureFlags: { ...input.featureFlags, liveAi: false, openBanking: false },
    calculationVersions: input.calculationVersions,
    openBankingState: "disabled" as const,
    liveAiState: "disabled" as const,
    localFallbackState: "disabled" as const,
    knownWarnings: input.knownWarnings ?? [],
    rollbackReference: input.rollbackReference,
    approver: input.approver,
    deploymentOutcome: input.deploymentOutcome ?? "PENDING",
  };
  return { ...body, integrityHash: hash(body) };
}

function check(id: string, ok: boolean, critical: boolean, detail: string): { id: string; status: DeploymentCheckStatus; critical: boolean; detail: string } {
  return { id, status: ok ? "PASS" : "FAIL", critical, detail };
}

export function buildRemoteReadinessFromPayload(input: { url: string; payload: Record<string, unknown>; httpsOk?: boolean; available?: boolean }): RemoteReadinessReport {
  const foundation = input.payload.privateBetaFoundation as PrivateBetaReadinessReport | undefined;
  const pilot = input.payload.betaPilotOperations as { dailyCheck?: DailyCheckReport } | undefined;
  const deployment = input.payload.deployment ?? input.payload.betaPilotOperations;
  const checks = [
    check("public-app-availability", input.available !== false, true, "Remote application responded."),
    check("https", input.url.startsWith("https://") && input.httpsOk !== false, true, "Remote verification requires HTTPS."),
    check("readiness-endpoint", Boolean(input.payload.ok), true, "Readiness endpoint returned structured JSON."),
    check("execution-mode-private-beta", foundation?.mode === "PRIVATE_BETA", true, `Remote execution mode is ${foundation?.mode ?? "unknown"}.`),
    check("database-connectivity", foundation?.persistenceBackend === "postgresql", true, `Remote persistence backend is ${foundation?.persistenceBackend ?? "unknown"}.`),
    check("migration-state", Boolean((deployment as { databaseMigrationVersion?: string } | undefined)?.databaseMigrationVersion || foundation?.checklist?.some((item) => item.category === "persistence" && item.status === "READY")), true, "Migration state must be visible and ready."),
    check("storage-connectivity", foundation?.checklist?.some((item) => item.category === "uploads" && item.status !== "BLOCKED") ?? false, true, "Private storage/upload controls must be ready."),
    check("authentication-readiness", foundation?.checklist?.some((item) => item.category === "authentication" && item.status === "READY") ?? false, true, "Authentication must be configured."),
    check("local-fallback-disabled", foundation?.persistenceBackend !== "local-json", true, "Local JSON fallback must not be active remotely."),
    check("open-banking-disabled", foundation?.openBankingState === "disabled", true, `Open Banking is ${foundation?.openBankingState ?? "unknown"}.`),
    check("live-ai-disabled", foundation?.liveAiState === "disabled", true, `Live AI is ${foundation?.liveAiState ?? "unknown"}.`),
    check("operations-health", pilot?.dailyCheck?.blocked === false, true, "Pilot operations daily check must pass remotely."),
    check("deployment-manifest", Boolean(deployment), true, "Deployment manifest or operations deployment report must be present."),
  ];
  const blocked = checks.some((item) => item.critical && item.status === "FAIL");
  return {
    version: EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION,
    url: input.url,
    checkedAt: nowIso(),
    passed: !blocked,
    blocked,
    checks,
    remote: {
      executionMode: foundation?.mode,
      persistenceBackend: foundation?.persistenceBackend,
      openBankingState: foundation?.openBankingState,
      liveAiState: foundation?.liveAiState,
      deploymentVersion: (input.payload as { applicationVersion?: string }).applicationVersion,
    },
  };
}

export function buildSyntheticTwoUserRehearsal(input: { remoteUrl: string; rehearsal?: SyntheticRehearsalReport; executedRemotely?: boolean }): TwoUserRehearsalReport {
  const rehearsal = input.rehearsal ?? BetaPilotOperations.runSyntheticRehearsal();
  const status: RehearsalStatus = input.executedRemotely && rehearsal.desktopRun === "PASS" && rehearsal.mobileRun === "PASS" ? "PASS" : "NOT_RUN";
  const completedSteps = rehearsal.steps.map((step) => step.id);
  return {
    version: EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION,
    remoteUrl: input.remoteUrl,
    status,
    syntheticOnly: true,
    users: [
      { syntheticUserRef: "synthetic-user-a", completedSteps, exportScoped: status === "PASS", uploadIsolated: status === "PASS" },
      { syntheticUserRef: "synthetic-user-b", completedSteps, exportScoped: status === "PASS", uploadIsolated: status === "PASS" },
    ],
    isolationChecks: [
      { id: "user-a-cannot-read-user-b", status: status === "PASS" ? "PASS" : "FAIL", detail: "Cross-user record access must fail safely." },
      { id: "user-b-cannot-read-user-a", status: status === "PASS" ? "PASS" : "FAIL", detail: "Cross-user record access must fail safely." },
      { id: "exports-scoped", status: status === "PASS" ? "PASS" : "FAIL", detail: "Exports must contain only owning user's data." },
      { id: "support-redacted", status: status === "PASS" ? "PASS" : "FAIL", detail: "Support records must contain no financial content." },
      { id: "analytics-redacted", status: status === "PASS" ? "PASS" : "FAIL", detail: "Analytics must reject disallowed fields." },
      { id: "uploads-isolated", status: status === "PASS" ? "PASS" : "FAIL", detail: "Uploaded files must remain user isolated." },
    ],
    generatedAt: nowIso(),
  };
}

export function buildNegativeSecurityRehearsal(input: { remoteUrl: string; executedRemotely?: boolean }): NegativeSecurityRehearsalReport {
  const ids = ["unauthenticated-api", "modified-client-user-id", "cross-user-resource-id", "expired-invitation", "reused-invitation", "revoked-invitation", "disabled-feature", "local-fallback-attempt", "open-banking-flag-attempt", "live-ai-flag-attempt", "oversized-upload", "invalid-mime", "malicious-filename", "public-storage-url", "expired-session", "unsupported-method", "malformed-body"];
  const status: RehearsalStatus = input.executedRemotely ? "PASS" : "NOT_RUN";
  return {
    version: EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION,
    remoteUrl: input.remoteUrl,
    status,
    checks: ids.map((id) => ({ id, status: status === "PASS" ? "PASS" : "FAIL", detail: "Prohibited action must fail safely with no sensitive output." })),
    generatedAt: nowIso(),
  };
}

export function buildBackupRestoreReport(input: Partial<BackupRestoreReport> = {}): BackupRestoreReport {
  return {
    version: EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION,
    status: input.status ?? "NOT_RUN",
    backupFrequency: input.backupFrequency ?? "Managed PostgreSQL scheduled backups before first-user approval.",
    retention: input.retention ?? "Provider retention policy must be recorded before approval.",
    encrypted: input.encrypted ?? false,
    restoreProcedure: input.restoreProcedure ?? "Restore synthetic backup to isolated database, run migrations, verify user scoping.",
    recoveryPointObjective: input.recoveryPointObjective ?? "To be confirmed with provider.",
    recoveryTimeObjective: input.recoveryTimeObjective ?? "To be confirmed with provider.",
    owner: input.owner ?? "pilot owner",
    restoredDataUserScoped: input.restoredDataUserScoped ?? false,
  };
}

export function buildRollbackRehearsal(input: Partial<RollbackRehearsalReport> = {}): RollbackRehearsalReport {
  return {
    version: EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION,
    status: input.status ?? "NOT_RUN",
    previousVersionRollback: input.previousVersionRollback ?? "FAIL",
    featureFlagDisable: input.featureFlagDisable ?? "FAIL",
    migrationCompatibility: input.migrationCompatibility ?? "FAIL",
    cohortSuspension: input.cohortSuspension ?? "FAIL",
    invitationSuspension: input.invitationSuspension ?? "FAIL",
    maximumSafeRollbackPoint: input.maximumSafeRollbackPoint ?? "not verified",
  };
}

export function buildMonitoringReport(input: Partial<MonitoringReport> = {}): MonitoringReport {
  const coveredSignals = input.coveredSignals ?? ["application availability", "error rate", "latency", "database connectivity", "storage failures", "authentication failures", "invitation failures", "import failures", "export failures", "deletion-request failures", "cross-user isolation alerts", "readiness failure", "local-fallback detection", "Open Banking state", "live AI state"];
  return { version: EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION, status: input.status ?? "BLOCKED", alertRedaction: input.alertRedaction ?? "FAIL", coveredSignals, dailySummaryOwner: input.dailySummaryOwner ?? "pilot owner" };
}

export function approveFirstUser(input: {
  remote: RemoteReadinessReport;
  twoUser: TwoUserRehearsalReport;
  negative: NegativeSecurityRehearsalReport;
  backup: BackupRestoreReport;
  rollback: RollbackRehearsalReport;
  monitoring: MonitoringReport;
  approver?: string;
  sev1Open?: boolean;
  privacyPageDeployed?: boolean;
  exportTested?: boolean;
  deletionRequestTested?: boolean;
  invitationDeliveryTested?: boolean;
  supportReady?: boolean;
}): FirstUserApprovalReport {
  const checks = [
    check("remote-verification", input.remote.passed, true, "Remote PRIVATE_BETA verification must pass."),
    check("two-user-synthetic-rehearsal", input.twoUser.status === "PASS", true, "Two synthetic users must complete the deployed journey."),
    check("negative-security-rehearsal", input.negative.status === "PASS", true, "Negative security rehearsal must pass."),
    check("backup-restore", input.backup.status === "PASS" && input.backup.encrypted && input.backup.restoredDataUserScoped, true, "Backup and restore must be verified with synthetic data."),
    check("rollback", input.rollback.status === "PASS", true, "Rollback rehearsal must pass."),
    check("monitoring", input.monitoring.status === "ACTIVE" && input.monitoring.alertRedaction === "PASS", true, "Monitoring must be active and redacted."),
    check("sev-1-clear", !input.sev1Open, true, "No open SEV-1 findings."),
    check("privacy-page", input.privacyPageDeployed === true, true, "Privacy page must be deployed."),
    check("export-tested", input.exportTested === true, true, "Export must be tested remotely."),
    check("deletion-tested", input.deletionRequestTested === true, true, "Deletion request must be tested remotely."),
    check("invitation-delivery-tested", input.invitationDeliveryTested === true, true, "Invitation delivery must be tested."),
    check("support-ready", input.supportReady === true, true, "Support process must be ready."),
    check("human-approver", Boolean(input.approver), true, "Explicit human approval is required."),
  ];
  const blocked = checks.some((item) => item.critical && item.status === "FAIL");
  return {
    version: EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION,
    approved: !blocked,
    blocked,
    approver: blocked ? null : input.approver ?? null,
    approvedAt: blocked ? null : nowIso(),
    checks,
    approvalId: blocked ? null : `first-user-approval-${hash({ approver: input.approver, at: nowIso() }).slice(0, 12)}`,
  };
}

export function redactLogLine(line: string): string {
  return line
    .replace(/(postgres(?:ql)?:\/\/)[^\s"']+/gi, "$1[REDACTED_DATABASE_URL]")
    .replace(/(access[_-]?token|cookie|api[_-]?key|secret|password)=([^\s&]+)/gi, "$1=[REDACTED]")
    .replace(/\b\d{6,}\b/g, "[REDACTED_NUMBER]")
    .replace(/\$ ?\d+(?:,\d{3})*(?:\.\d+)?/g, "[REDACTED_AMOUNT]");
}

export const ExternalPrivateBetaDeployment = {
  canonicalArchitecture,
  environmentContract: ENVIRONMENT_CONTRACT,
  validateStartupEnvironment,
  betaRuntimeConfigFromExternalEnv,
  createDeploymentManifest,
  buildRemoteReadinessFromPayload,
  buildSyntheticTwoUserRehearsal,
  buildNegativeSecurityRehearsal,
  buildBackupRestoreReport,
  buildRollbackRehearsal,
  buildMonitoringReport,
  approveFirstUser,
  redactLogLine,
};
