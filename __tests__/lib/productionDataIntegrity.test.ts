import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryProductionDataStore,
  ProductionDataError,
  assertDemoLiveSeparation,
  buildMigrationPreview,
  findForbiddenFinancialPersistenceDependencies,
  hashRecord,
  rejectUnsafeClientFields,
  redactSensitiveValues,
  requireAuthenticatedUser,
  userSafeError,
  validateProductionConfig,
  type AuthenticatedSession,
  type RepositoryContext,
} from "../../src/lib/productionDataIntegrity.ts";

const now = "2026-07-19T00:00:00.000Z";

function session(userId: string): AuthenticatedSession {
  return { userId, expiresAt: "2027-07-20T00:00:00.000Z", actor: "user", requestId: `req-${userId}` };
}

function ctx(userId: string, dataMode: RepositoryContext["dataMode"] = "test"): RepositoryContext {
  return { session: session(userId), correlationId: `corr-${userId}`, source: "test", dataMode };
}

function store() {
  return new InMemoryProductionDataStore(() => now);
}

test("one user can never read another user's financial fact", async () => {
  const repo = store();
  const fact = await repo.facts.create(ctx("user-a"), {
    type: "income.salary",
    value: 145000,
    confidence: 0.96,
    verified: true,
    evidenceIds: ["doc-1"],
  });

  await assert.rejects(() => repo.facts.getById(ctx("user-b"), fact.id), /not available/);
});

test("production integrity detects retired Financial Vault local dependencies", () => {
  const findings = findForbiddenFinancialPersistenceDependencies([
    {
      path: "src/app/page.tsx",
      content: 'import { getFinancialVaultState } from "@/lib/financialVaultStore";\nconst value = getFinancialVaultState();',
    },
    {
      path: "src/app/api/financial-forecast/route.ts",
      content: 'import { readManualPlatform } from "@/lib/manualFinancialDataRepository";',
    },
    {
      path: "__tests__/fixtures/financialVaultStore.fixture.ts",
      content: 'import { getFinancialVaultState } from "@/lib/financialVaultStore";',
    },
  ]);

  assert.deepEqual(findings.map((finding) => finding.dependency), ["financialVaultStore", "manualFinancialDataRepository"]);
});

test("production integrity detects retired core decisioning local dependencies", () => {
  const findings = findForbiddenFinancialPersistenceDependencies([
    {
      path: "src/app/digital-twin/page.tsx",
      content: 'import { getFinancialDigitalTwinState } from "@/lib/financialDigitalTwinStore";',
    },
    {
      path: "src/app/action-workflows/page.tsx",
      content: 'import { getActionWorkflowState } from "@/lib/actionWorkflowStore";',
    },
    {
      path: "src/app/api/ai-cfo/route.ts",
      content: 'import { persistAICfoRun } from "@/lib/aiCfoStore";',
    },
    {
      path: "src/app/api/ai-cfo/daily-review/route.ts",
      content: 'import { getLatestDailyReview } from "@/lib/aiCfoDailyReviewStore";',
    },
    {
      path: "src/app/api/copilot-history/route.ts",
      content: 'import { getCopilotHistory } from "@/lib/localStore"; getCopilotHistory();',
    },
    {
      path: "src/app/api/goals/route.ts",
      content: "GoalPlanningEngine.readState(); GoalPlanningEngine.saveGoal(goal);",
    },
    {
      path: "src/app/components/DecisionState.tsx",
      content: 'window.localStorage.setItem("decision-state", JSON.stringify(state));',
    },
  ]);

  assert.deepEqual(findings.map((finding) => finding.dependency), [
    "financialDigitalTwinStore",
    "actionWorkflowStore",
    "aiCfoStore",
    "aiCfoDailyReviewStore",
    "copilotHistoryLocalStore",
    "goalPlanningLocalState",
    "browserStorageAuthoritative",
  ]);
});

test("cross-user updates are rejected", async () => {
  const repo = store();
  const fact = await repo.facts.create(ctx("user-a"), {
    type: "asset.cash",
    value: 86000,
    confidence: 0.9,
    verified: true,
    evidenceIds: [],
  });

  const result = await repo.facts.update(ctx("user-b"), {
    id: fact.id,
    expectedVersion: fact.version,
    patch: { value: 1 },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "FORBIDDEN");
});

test("forged client-owned fields are rejected at API contract boundary", () => {
  assert.throws(
    () => rejectUnsafeClientFields({ title: "Fake", verified: true }),
    (error) => error instanceof ProductionDataError && error.code === "UNSAFE_CLIENT_FIELD"
  );
  assert.throws(
    () => rejectUnsafeClientFields({ realisedImpact: 9999 }),
    (error) => error instanceof ProductionDataError && error.code === "UNSAFE_CLIENT_FIELD"
  );
});

test("unauthenticated and expired sessions fail safely", () => {
  assert.throws(() => requireAuthenticatedUser({ userId: null, expiresAt: null }), /session/);
  assert.throws(() => requireAuthenticatedUser({ userId: "user-a", expiresAt: "2026-07-18T00:00:00.000Z" }, new Date(now)), /expired/);
});

test("duplicate idempotent requests return the first result", async () => {
  const repo = store();
  const first = await repo.withIdempotency(ctx("user-a"), "decision:create:abc", async () =>
    repo.decisions.create(ctx("user-a"), {
      title: "Upload tax return",
      state: "New",
      expectedImpact: 0,
      realisedImpact: null,
      professionalReviewRequired: false,
    })
  );
  const second = await repo.withIdempotency(ctx("user-a"), "decision:create:abc", async () =>
    repo.decisions.create(ctx("user-a"), {
      title: "Duplicate",
      state: "New",
      expectedImpact: 1,
      realisedImpact: null,
      professionalReviewRequired: false,
    })
  );

  assert.equal(second.id, first.id);
  assert.equal(second.title, "Upload tax return");
});

test("optimistic concurrency surfaces conflicting edits", async () => {
  const repo = store();
  const decision = await repo.decisions.create(ctx("user-a"), {
    title: "Review mortgage",
    state: "New",
    expectedImpact: 2200,
    realisedImpact: null,
    professionalReviewRequired: false,
  });
  const first = await repo.decisions.update(ctx("user-a"), {
    id: decision.id,
    expectedVersion: decision.version,
    patch: { state: "In Progress" },
  });
  const stale = await repo.decisions.update(ctx("user-a"), {
    id: decision.id,
    expectedVersion: decision.version,
    patch: { state: "Completed" },
  });

  assert.equal(first.ok, true);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "CONFLICT");
});

test("failed verified-outcome transaction rolls back workflow and decision changes", async () => {
  const repo = store();
  const workflow = await repo.workflows.create(ctx("user-a"), {
    title: "Refinance mortgage",
    executionStatus: "Awaiting Verification",
    outcomeStatus: "Verification Pending",
    expectedImpact: 312,
    realisedImpact: null,
    baselineSnapshotId: null,
    verificationSnapshotId: null,
  });
  const decision = await repo.decisions.create(ctx("user-a"), {
    title: "Review refinance",
    state: "Awaiting Outcome",
    expectedImpact: 312,
    realisedImpact: null,
    professionalReviewRequired: false,
  });

  await assert.rejects(
    () => repo.verifyWorkflowOutcomeTransaction(ctx("user-a"), {
      workflowId: workflow.id,
      decisionId: decision.id,
      evidenceIds: [],
      actualImpact: 280,
      snapshotInput: {
        engineName: "workflow-outcome",
        engineVersion: "v1",
        inputFactVersions: [],
        ruleVersions: [],
        assumptions: {},
        outputHash: hashRecord({ actualImpact: 280 }),
      },
    }),
    /require evidence/
  );

  const unchangedWorkflow = await repo.workflows.update(ctx("user-a"), {
    id: workflow.id,
    expectedVersion: workflow.version,
    patch: { executionStatus: "In Progress" },
  });
  const unchangedDecision = await repo.decisions.update(ctx("user-a"), {
    id: decision.id,
    expectedVersion: decision.version,
    patch: { state: "In Progress" },
  });

  assert.equal(unchangedWorkflow.ok, true);
  assert.equal(unchangedDecision.ok, true);
});

test("verified outcomes require evidence and before-after snapshot metadata", async () => {
  const repo = store();
  const workflow = await repo.workflows.create(ctx("user-a"), {
    title: "Reduce recurring spending",
    executionStatus: "Awaiting Verification",
    outcomeStatus: "Verification Pending",
    expectedImpact: 58,
    realisedImpact: null,
    baselineSnapshotId: "snapshot-before",
    verificationSnapshotId: null,
  });
  const decision = await repo.decisions.create(ctx("user-a"), {
    title: "Cancel unused subscription",
    state: "Awaiting Outcome",
    expectedImpact: 58,
    realisedImpact: null,
    professionalReviewRequired: false,
  });

  const result = await repo.verifyWorkflowOutcomeTransaction(ctx("user-a"), {
    workflowId: workflow.id,
    decisionId: decision.id,
    evidenceIds: ["evidence-provider-confirmation"],
    actualImpact: 58,
    snapshotInput: {
      engineName: "spending-reduction-verification",
      engineVersion: "v1",
      inputFactVersions: [{ factId: "subscription-netflix", version: 3 }],
      ruleVersions: [],
      assumptions: { billingCycleObserved: true },
      outputHash: hashRecord({ actualImpact: 58 }),
    },
  });

  assert.equal(result.workflow.outcomeStatus, "Verified");
  assert.equal(result.workflow.realisedImpact, 58);
  assert.equal(result.snapshot.inputFactVersions[0].version, 3);
  assert.deepEqual(result.timelineEvent.evidenceIds, ["evidence-provider-confirmation"]);
});

test("audit history is append-only", async () => {
  const repo = store();
  await repo.facts.create(ctx("user-a"), {
    type: "income.salary",
    value: 145000,
    confidence: 0.9,
    verified: true,
    evidenceIds: [],
  });

  const audit = repo.appendOnlyAuditEvents();
  assert.equal(audit.length, 1);
  assert.throws(() => repo.tryMutateAuditEvent(), /append-only/);
});

test("demo records cannot enter live repositories", () => {
  assert.throws(
    () => assertDemoLiveSeparation("demo", "live"),
    (error) => error instanceof ProductionDataError && error.code === "DEMO_LIVE_BOUNDARY"
  );
});

test("export excludes secrets and raw document storage references", async () => {
  const repo = store();
  await repo.documents.create(ctx("user-a"), {
    title: "Tax return",
    documentType: "tax_return",
    storageRef: "s3://private/raw-tax-return.pdf?token=secret",
    extractionStatus: "extracted",
    sensitivity: "tax-document",
  });

  const exported = repo.exportUserData(ctx("user-a"));
  assert.equal(exported.documents[0].title, "Tax return");
  assert.equal("storageRef" in exported.documents[0], false);
  assert(exported.manifest.omittedSections.includes("authentication_tokens"));
});

test("sensitive values are redacted from routine telemetry", () => {
  const redacted = redactSensitiveValues({
    token: "abc123",
    accountNumber: "123456789012",
    note: "TFN 123 456 789 and card 1234567890123456",
  });

  assert.deepEqual(redacted, {
    token: "[REDACTED]",
    accountNumber: "[REDACTED]",
    note: "TFN [REDACTED_TFN] and card [REDACTED_ACCOUNT]",
  });
});

test("account deletion removes only the current user's financial records", async () => {
  const repo = store();
  await repo.facts.create(ctx("user-a"), { type: "cash", value: 1, confidence: 1, verified: true, evidenceIds: [] });
  const other = await repo.facts.create(ctx("user-b"), { type: "cash", value: 2, confidence: 1, verified: true, evidenceIds: [] });

  const deletion = await repo.executeAccountDeletion(ctx("user-a"));

  assert.equal(deletion.deleted.facts, 1);
  assert.equal((await repo.facts.getById(ctx("user-b"), other.id))?.value, 2);
});

test("migration preview cannot overwrite a higher-confidence verified fact", () => {
  const preview = buildMigrationPreview(
    { version: "local-v0", records: [{ id: "fact-1", type: "income.salary", value: 120000, confidence: 0.4, verified: false }] },
    [{
      id: "fact-1",
      userId: "user-a",
      createdAt: now,
      updatedAt: now,
      version: 2,
      source: "vault",
      correlationId: "corr",
      type: "income.salary",
      value: 145000,
      confidence: 0.95,
      verified: true,
      evidenceIds: ["doc-1"],
    }]
  );

  assert.equal(preview.safeToImport, false);
  assert.equal(preview.conflicts[0].reason, "Existing verified fact has higher confidence.");
});

test("historical calculation snapshots retain input and rule versions", async () => {
  const repo = store();
  const snapshot = await repo.snapshots.create(ctx("user-a"), {
    engineName: "digital-twin",
    engineVersion: "1.0.0",
    inputFactVersions: [{ factId: "fact-income", version: 4 }],
    ruleVersions: [{ ruleId: "tax-rule-ato-2026", version: "2026.1" }],
    assumptions: { inflation: 0.03 },
    outputHash: hashRecord({ netWorth: 2_180_000 }),
  });

  assert.equal(snapshot.inputFactVersions[0].version, 4);
  assert.equal(snapshot.ruleVersions[0].version, "2026.1");
});

test("production mode cannot start with unsafe persistence fallback", () => {
  const report = validateProductionConfig({
    mode: "live",
    databaseUrl: "postgres://example",
    authProviderConfigured: true,
    encryptionKeyConfigured: true,
    allowedOrigins: ["https://vireon.example"],
    applicationUrl: "https://vireon.example",
    backgroundJobsConfigured: true,
    persistenceFallback: "local-json",
  });

  assert.equal(report.ok, false);
  assert(report.checks.some((check) => check.name === "Persistence fallback" && check.status === "fail"));
});

test("valid production configuration passes critical checks", () => {
  const report = validateProductionConfig({
    mode: "live",
    databaseUrl: "postgres://example",
    authProviderConfigured: true,
    encryptionKeyConfigured: true,
    allowedOrigins: ["https://vireon.example"],
    applicationUrl: "https://vireon.example",
    backgroundJobsConfigured: true,
    persistenceFallback: "none",
  });

  assert.equal(report.ok, true);
});

test("database failure is surfaced as a safe error, not an empty success", () => {
  const safe = userSafeError(new Error("connection refused"));
  assert.equal(safe.code, "TRANSACTION_FAILED");
  assert.equal(safe.message, "Data temporarily unavailable.");
  assert.equal(safe.retryable, true);
});

test("job retries are bounded and observable", async () => {
  const repo = store();
  const job = await repo.enqueueJob(ctx("user-a"), { type: "daily-review-generation", maxAttempts: 2 });
  const first = await repo.recordJobFailure(ctx("user-a"), job.id, "engine-timeout");
  const second = await repo.recordJobFailure(ctx("user-a"), job.id, "engine-timeout");

  assert.equal(first.status, "queued");
  assert.equal(second.status, "failed");
  assert.equal(second.attempts, 2);
});

test("client cannot set professional-review completion or immutable fields", () => {
  assert.throws(() => rejectUnsafeClientFields({ professionalReviewCompleted: true }), /server-owned/);
  assert.throws(() => rejectUnsafeClientFields({ immutable: true }), /server-owned/);
});
