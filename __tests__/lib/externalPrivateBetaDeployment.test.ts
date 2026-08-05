import assert from "node:assert/strict";
import test from "node:test";
import { BetaPilotOperations } from "../../src/lib/betaPilotOperations.ts";
import { ExternalPrivateBetaDeployment } from "../../src/lib/externalPrivateBetaDeployment.ts";

function goodEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    VIREON_EXECUTION_MODE: "PRIVATE_BETA",
    NEXT_PUBLIC_APP_URL: "https://beta.vireon.example",
    DATABASE_URL: "postgres://app:[REDACTED]@db.example/vireon",
    VIREON_DATABASE_SSL_MODE: "verify-full",
    NEXT_PUBLIC_SUPABASE_URL: "https://auth.example",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-long-enough-for-beta",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-long-enough-for-beta",
    VIREON_SESSION_SECRET: "session-secret-with-at-least-twenty-four-chars",
    VIREON_STORAGE_ENDPOINT: "https://storage.example",
    VIREON_STORAGE_BUCKET: "vireon-private-beta",
    VIREON_STORAGE_ACCESS_KEY: "storage-access-key",
    VIREON_STORAGE_SECRET_KEY: "storage-secret-key",
    VIREON_INVITATION_EMAIL_FROM: "beta@vireon.example",
    VIREON_EMAIL_PROVIDER_KEY: "email-provider-key-long-enough",
    VIREON_BETA_SUPPORT_OWNER: "support@vireon.example",
    VIREON_DEPLOYMENT_VERSION: "0.1.0",
    VIREON_COMMIT_SHA: "abc123",
    VIREON_MIGRATION_VERSION: "private-beta-foundation-v1",
    VIREON_LOCAL_JSON_FALLBACK: "false",
    VIREON_LIVE_AI_ENABLED: "false",
    VIREON_OPEN_BANKING_ENABLED: "false",
    ...overrides,
  };
}

function remotePayload(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    privateBetaFoundation: {
      mode: "PRIVATE_BETA",
      persistenceBackend: "postgresql",
      openBankingState: "disabled",
      liveAiState: "disabled",
      checklist: [
        { category: "authentication", status: "READY" },
        { category: "uploads", status: "READY" },
        { category: "persistence", status: "READY" },
      ],
    },
    betaPilotOperations: {
      dailyCheck: { blocked: false },
    },
    deployment: {
      databaseMigrationVersion: "private-beta-foundation-v1",
    },
    applicationVersion: "0.1.0",
    ...overrides,
  };
}

test("1 required PRIVATE_BETA variables pass only when complete", () => {
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv()).passed, true);
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ DATABASE_URL: undefined })).blocked, true);
});

test("2 forbidden local and insecure values fail closed", () => {
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).blocked, true);
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ VIREON_SESSION_SECRET: "changeme" })).blocked, true);
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ VIREON_LOCAL_JSON_FALLBACK: "true" })).blocked, true);
});

test("3 database SSL and private storage are required", () => {
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ VIREON_DATABASE_SSL_MODE: "disable" })).blocked, true);
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ VIREON_STORAGE_BUCKET: undefined })).blocked, true);
});

test("4 live AI Open Banking and provider keys block deterministic beta", () => {
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ VIREON_LIVE_AI_ENABLED: "true" })).blocked, true);
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ VIREON_OPEN_BANKING_ENABLED: "true" })).blocked, true);
  assert.equal(ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ OPENAI_API_KEY: "provider-key" })).blocked, true);
});

test("5 environment contract categorises required forbidden and secret variables", () => {
  const contract = ExternalPrivateBetaDeployment.environmentContract;
  assert(contract.some((item) => item.name === "DATABASE_URL" && item.category === "REQUIRED_PRIVATE_BETA" && item.secret));
  assert(contract.some((item) => item.name === "VIREON_LOCAL_JSON_FALLBACK" && item.category === "FORBIDDEN_PRIVATE_BETA"));
  assert(contract.some((item) => item.name === "VIREON_SYNTHETIC_DEMO_DATA" && item.category === "LOCAL_ONLY"));
});

test("6 remote readiness succeeds only for true external PRIVATE_BETA", () => {
  assert.equal(ExternalPrivateBetaDeployment.buildRemoteReadinessFromPayload({ url: "https://beta.vireon.example", payload: remotePayload() }).passed, true);
  assert.equal(ExternalPrivateBetaDeployment.buildRemoteReadinessFromPayload({ url: "https://beta.vireon.example", payload: remotePayload({ privateBetaFoundation: { ...remotePayload().privateBetaFoundation, mode: "LOCAL_DEVELOPMENT" } }) }).blocked, true);
});

test("7 remote readiness blocks local fallback Open Banking and live AI", () => {
  assert.equal(ExternalPrivateBetaDeployment.buildRemoteReadinessFromPayload({ url: "https://beta.vireon.example", payload: remotePayload({ privateBetaFoundation: { ...remotePayload().privateBetaFoundation, persistenceBackend: "local-json" } }) }).blocked, true);
  assert.equal(ExternalPrivateBetaDeployment.buildRemoteReadinessFromPayload({ url: "https://beta.vireon.example", payload: remotePayload({ privateBetaFoundation: { ...remotePayload().privateBetaFoundation, openBankingState: "enabled" } }) }).blocked, true);
  assert.equal(ExternalPrivateBetaDeployment.buildRemoteReadinessFromPayload({ url: "https://beta.vireon.example", payload: remotePayload({ privateBetaFoundation: { ...remotePayload().privateBetaFoundation, liveAiState: "enabled" } }) }).blocked, true);
});

test("8 invitation and secure cookie configuration are represented in startup contract", () => {
  const report = ExternalPrivateBetaDeployment.validateStartupEnvironment(goodEnv({ VIREON_INVITATION_EMAIL_FROM: undefined }));
  assert.equal(report.blocked, true);
  assert(report.checks.some((check) => check.id === "session-secret-strong" && check.status === "PASS"));
});

test("9 deployment manifest forces disabled platform states", () => {
  const manifest = ExternalPrivateBetaDeployment.createDeploymentManifest({
    applicationVersion: "0.1.0",
    commitSha: "abc123",
    hostingEnvironment: "vercel-private-beta",
    databaseMigrationVersion: "private-beta-foundation-v1",
    featureFlags: { liveAi: true, openBanking: true, csvImports: true },
    calculationVersions: ["financial-health-engine-v1"],
    rollbackReference: "prev",
    approver: "pilot-owner",
  });
  assert.equal(manifest.executionMode, "PRIVATE_BETA");
  assert.equal(manifest.openBankingState, "disabled");
  assert.equal(manifest.liveAiState, "disabled");
  assert.equal(manifest.localFallbackState, "disabled");
  assert.equal(manifest.featureFlags.liveAi, false);
  assert.equal(manifest.featureFlags.openBanking, false);
  assert.equal(manifest.integrityHash.length, 64);
});

test("10 synthetic two-user rehearsal must be explicitly executed remotely", () => {
  const blocked = ExternalPrivateBetaDeployment.buildSyntheticTwoUserRehearsal({ remoteUrl: "https://beta.vireon.example", rehearsal: BetaPilotOperations.runSyntheticRehearsal() });
  assert.equal(blocked.status, "NOT_RUN");
  const passed = ExternalPrivateBetaDeployment.buildSyntheticTwoUserRehearsal({ remoteUrl: "https://beta.vireon.example", rehearsal: BetaPilotOperations.runSyntheticRehearsal(), executedRemotely: true });
  assert.equal(passed.status, "PASS");
  assert.equal(passed.users.length, 2);
  assert(passed.isolationChecks.every((check) => check.status === "PASS"));
});

test("11 negative security rehearsal covers prohibited deployed actions", () => {
  const report = ExternalPrivateBetaDeployment.buildNegativeSecurityRehearsal({ remoteUrl: "https://beta.vireon.example", executedRemotely: true });
  assert.equal(report.status, "PASS");
  assert(report.checks.some((check) => check.id === "public-storage-url"));
  assert(report.checks.some((check) => check.id === "malicious-filename"));
});

test("12 backup restore and rollback reports block until rehearsed", () => {
  assert.equal(ExternalPrivateBetaDeployment.buildBackupRestoreReport().status, "NOT_RUN");
  assert.equal(ExternalPrivateBetaDeployment.buildRollbackRehearsal().status, "NOT_RUN");
  assert.equal(ExternalPrivateBetaDeployment.buildBackupRestoreReport({ status: "PASS", encrypted: true, restoredDataUserScoped: true }).restoredDataUserScoped, true);
  assert.equal(ExternalPrivateBetaDeployment.buildRollbackRehearsal({ status: "PASS", previousVersionRollback: "PASS", featureFlagDisable: "PASS", migrationCompatibility: "PASS", cohortSuspension: "PASS", invitationSuspension: "PASS" }).status, "PASS");
});

test("13 monitoring alert and log redaction exclude sensitive content", () => {
  const monitoring = ExternalPrivateBetaDeployment.buildMonitoringReport({ status: "ACTIVE", alertRedaction: "PASS" });
  assert.equal(monitoring.coveredSignals.includes("Open Banking state"), true);
  const redacted = ExternalPrivateBetaDeployment.redactLogLine("DATABASE_URL=postgres://u:p@host/db cookie=session account 123456789012 amount $42000");
  assert(!redacted.includes("postgres://u:p@host/db"));
  assert(!redacted.includes("123456789012"));
  assert(!redacted.includes("$42000"));
});

test("14 first-user approval gate requires all external evidence and human approver", () => {
  const remote = ExternalPrivateBetaDeployment.buildRemoteReadinessFromPayload({ url: "https://beta.vireon.example", payload: remotePayload() });
  const twoUser = ExternalPrivateBetaDeployment.buildSyntheticTwoUserRehearsal({ remoteUrl: "https://beta.vireon.example", executedRemotely: true });
  const negative = ExternalPrivateBetaDeployment.buildNegativeSecurityRehearsal({ remoteUrl: "https://beta.vireon.example", executedRemotely: true });
  const backup = ExternalPrivateBetaDeployment.buildBackupRestoreReport({ status: "PASS", encrypted: true, restoredDataUserScoped: true });
  const rollback = ExternalPrivateBetaDeployment.buildRollbackRehearsal({ status: "PASS", previousVersionRollback: "PASS", featureFlagDisable: "PASS", migrationCompatibility: "PASS", cohortSuspension: "PASS", invitationSuspension: "PASS" });
  const monitoring = ExternalPrivateBetaDeployment.buildMonitoringReport({ status: "ACTIVE", alertRedaction: "PASS" });
  assert.equal(ExternalPrivateBetaDeployment.approveFirstUser({ remote, twoUser, negative, backup, rollback, monitoring, privacyPageDeployed: true, exportTested: true, deletionRequestTested: true, invitationDeliveryTested: true, supportReady: true }).blocked, true);
  const approved = ExternalPrivateBetaDeployment.approveFirstUser({ remote, twoUser, negative, backup, rollback, monitoring, approver: "pilot-owner", privacyPageDeployed: true, exportTested: true, deletionRequestTested: true, invitationDeliveryTested: true, supportReady: true });
  assert.equal(approved.approved, true);
  assert.match(approved.approvalId ?? "", /^first-user-approval-/);
});

test("15 first-user approval blocks without rehearsal or with SEV-1", () => {
  const remote = ExternalPrivateBetaDeployment.buildRemoteReadinessFromPayload({ url: "https://beta.vireon.example", payload: remotePayload() });
  const monitoring = ExternalPrivateBetaDeployment.buildMonitoringReport({ status: "ACTIVE", alertRedaction: "PASS" });
  const blocked = ExternalPrivateBetaDeployment.approveFirstUser({
    remote,
    twoUser: ExternalPrivateBetaDeployment.buildSyntheticTwoUserRehearsal({ remoteUrl: "https://beta.vireon.example" }),
    negative: ExternalPrivateBetaDeployment.buildNegativeSecurityRehearsal({ remoteUrl: "https://beta.vireon.example" }),
    backup: ExternalPrivateBetaDeployment.buildBackupRestoreReport(),
    rollback: ExternalPrivateBetaDeployment.buildRollbackRehearsal(),
    monitoring,
    approver: "pilot-owner",
    sev1Open: true,
  });
  assert.equal(blocked.blocked, true);
});

test("16 no real financial fixtures or paid provider calls are part of deployment validation", () => {
  const rehearsal = ExternalPrivateBetaDeployment.buildSyntheticTwoUserRehearsal({ remoteUrl: "https://beta.vireon.example", executedRemotely: true });
  assert.equal(rehearsal.syntheticOnly, true);
  assert.equal(JSON.stringify(ExternalPrivateBetaDeployment.environmentContract).includes("OPENAI_API_KEY"), true);
  assert(ExternalPrivateBetaDeployment.environmentContract.some((item) => item.name === "OPENAI_API_KEY" && item.category === "FORBIDDEN_PRIVATE_BETA"));
});
