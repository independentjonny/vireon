import assert from "node:assert/strict";
import test from "node:test";
import {
  PostgresMigrationRunner,
  compareDualRun,
  createPilotContractAdapter,
  defaultBlockedPilotGates,
  enforcePersistenceMode,
  evaluatePilotReadiness,
  executePilotMigration,
  previewPilotMigration,
  requireSyntheticPilotUser,
  userContextToRepositoryContext,
  verifyBackupManifest,
  verifyCalculationReproduction,
  type PostgresPilotClient,
  type QueryResult,
  type UserContext,
} from "../../src/lib/postgresPilotPersistence.ts";
import { ProductionDataError, hashRecord, rejectUnsafeClientFields } from "../../src/lib/productionDataIntegrity.ts";

function user(userId = "pilot-user-a"): UserContext {
  return {
    userId,
    sessionId: `session-${userId}`,
    requestId: `request-${userId}`,
    correlationId: `correlation-${userId}`,
    authenticationMethod: "test",
    issuedAt: "2026-07-19T00:00:00.000Z",
    expiresAt: "2027-07-20T00:00:00.000Z",
  };
}

function ctx(userId = "pilot-user-a") {
  return userContextToRepositoryContext(user(userId), "postgres-pilot");
}

async function runContractSuite(name: string, adapterKind: "memory" | "local" | "postgres-harness") {
  await test(`${name}: create, read, update, conflict and cross-user denial`, async () => {
    const repo = createPilotContractAdapter(adapterKind);
    const fact = await repo.facts.create(ctx("pilot-user-a"), {
      type: "income.salary",
      value: 145000,
      confidence: 0.96,
      verified: true,
      evidenceIds: [],
    });
    assert.equal((await repo.facts.getById(ctx("pilot-user-a"), fact.id))?.value, 145000);
    await assert.rejects(() => repo.facts.getById(ctx("pilot-user-b"), fact.id), /not available/);

    const updated = await repo.facts.update(ctx("pilot-user-a"), {
      id: fact.id,
      expectedVersion: fact.version,
      patch: { value: 150000 },
    });
    assert.equal(updated.ok, true);

    const stale = await repo.facts.update(ctx("pilot-user-a"), {
      id: fact.id,
      expectedVersion: fact.version,
      patch: { value: 1 },
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.equal(stale.code, "CONFLICT");
  });

  await test(`${name}: idempotent create returns one canonical decision`, async () => {
    const repo = createPilotContractAdapter(adapterKind);
    const first = await repo.withIdempotency(ctx(), "decision:review-tax", () =>
      repo.decisions.create(ctx(), {
        title: "Review tax return",
        state: "New",
        expectedImpact: 0,
        realisedImpact: null,
        professionalReviewRequired: false,
      })
    );
    const second = await repo.withIdempotency(ctx(), "decision:review-tax", () =>
      repo.decisions.create(ctx(), {
        title: "Duplicate",
        state: "New",
        expectedImpact: 1,
        realisedImpact: null,
        professionalReviewRequired: false,
      })
    );
    assert.equal(second.id, first.id);
    assert.equal(second.title, "Review tax return");
  });

  await test(`${name}: verified outcome rollback injection leaves no contradictory state`, async () => {
    const repo = createPilotContractAdapter(adapterKind);
    const workflow = await repo.workflows.create(ctx(), {
      title: "Mortgage refinance",
      executionStatus: "Awaiting Verification",
      outcomeStatus: "Verification Pending",
      expectedImpact: 312,
      realisedImpact: null,
      baselineSnapshotId: null,
      verificationSnapshotId: null,
    });
    const decision = await repo.decisions.create(ctx(), {
      title: "Review refinance",
      state: "Awaiting Outcome",
      expectedImpact: 312,
      realisedImpact: null,
      professionalReviewRequired: false,
    });

    await assert.rejects(
      Promise.resolve().then(() => repo.verifyWorkflowOutcomeTransaction(ctx(), {
        workflowId: workflow.id,
        decisionId: decision.id,
        evidenceIds: ["evidence-confirmed"],
        actualImpact: 280,
        injectFailureAt: "decision",
        snapshotInput: {
          engineName: "workflow-outcome",
          engineVersion: "pilot-v1",
          inputFactVersions: [],
          ruleVersions: [],
          assumptions: {},
          outputHash: hashRecord({ actualImpact: 280 }),
        },
      })),
      /Injected decision failure/
    );

    const stillVersionOne = await repo.workflows.update(ctx(), {
      id: workflow.id,
      expectedVersion: workflow.version,
      patch: { executionStatus: "In Progress" },
    });
    assert.equal(stillVersionOne.ok, true);
  });
}

await runContractSuite("in-memory adapter", "memory");
await runContractSuite("local adapter", "local");
await runContractSuite("PostgreSQL pilot harness", "postgres-harness");

test("synthetic pilot identities are enforced", () => {
  assert.doesNotThrow(() => requireSyntheticPilotUser(user("pilot-user-a")));
  assert.throws(
    () => requireSyntheticPilotUser(user("real-customer")),
    (error) => error instanceof ProductionDataError && error.code === "VALIDATION_FAILED"
  );
});

test("postgres-required never falls back to local data", () => {
  assert.deepEqual(enforcePersistenceMode("postgres-required", false), {
    ok: false,
    adapter: "postgres",
    fallbackUsed: false,
    error: "postgres-required cannot fall back to local data.",
  });
  assert.equal(enforcePersistenceMode("postgres-pilot", false).fallbackUsed, true);
});

test("migration preview rejects lower-confidence overwrite of verified facts", () => {
  const preview = previewPilotMigration(
    {
      sourceName: "local-vault",
      sourceVersion: "local",
      facts: [{ id: "fact-income", type: "income.salary", value: 120000, confidence: 0.3, verified: false }],
      decisions: [],
      timelineEvents: [],
    },
    [{
      id: "fact-income",
      userId: "pilot-user-a",
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      version: 2,
      source: "vault",
      correlationId: "corr",
      type: "income.salary",
      value: 145000,
      confidence: 0.96,
      verified: true,
      evidenceIds: ["evidence-payslip"],
    }]
  );
  assert.equal(preview.executable, false);
  assert.deepEqual(preview.conflicts, ["fact-income"]);
});

test("migration safe rerun uses idempotency and does not duplicate imported facts", async () => {
  const repo = createPilotContractAdapter();
  const source = {
    sourceName: "local-vault",
    sourceVersion: "local",
    facts: [{ id: "fact-income", type: "income.salary", value: 145000, confidence: 0.96, verified: true }],
    decisions: [{ id: "decision-tax", title: "Upload tax return", expectedImpact: 0, confidence: "High" }],
    timelineEvents: [{ id: "timeline-tax", title: "Tax return migrated", calculationSnapshotId: "snapshot-1", ruleVersions: ["rule-1"] }],
  };
  const first = await executePilotMigration(ctx(), repo, source);
  const second = await executePilotMigration(ctx(), repo, source);
  assert.equal(first.created, 3);
  assert.equal(second.created, 0);
  assert.equal(second.checksum, first.checksum);
});

test("client requests cannot set verified evidence or realised impact", () => {
  assert.throws(() => rejectUnsafeClientFields({ realisedImpact: 100 }), /server-owned/);
  assert.throws(() => rejectUnsafeClientFields({ verificationStatus: "Verified" }), /server-owned/);
});

test("backup verification requires successful restore", () => {
  const result = verifyBackupManifest({
    backupTimestamp: "2026-07-19T00:00:00.000Z",
    schemaVersion: "production-data-integrity-v1",
    databaseSizeBytes: 4096,
    checksum: "abc",
    encryptionStatus: "encrypted",
    storageLocation: "non-production/backups/pilot.dump",
    retentionDays: 7,
    exists: true,
    readable: true,
    restored: false,
  });
  assert.equal(result.ok, false);
  assert(result.reasons.includes("Backup is unproven until restore succeeds."));
});

test("restore readiness gates do not report Pilot Ready with failed gates", () => {
  const readiness = evaluatePilotReadiness(defaultBlockedPilotGates("No disposable PostgreSQL environment configured."));
  assert.equal(readiness.pilotReady, false);
  assert(readiness.failedGates.some((gate) => gate.id === "schema"));
});

test("dual-run differences are visible and auditable", () => {
  const comparison = compareDualRun({ facts: 2, snapshots: ["a"] }, { facts: 3, snapshots: ["a"] });
  assert.equal(comparison.recordCountsMatch, false);
  assert.equal(comparison.differences[0].area, "facts");
});

test("calculation reproduction does not claim success when engine version is unavailable", () => {
  const result = verifyCalculationReproduction({
    id: "snapshot-1",
    userId: "pilot-user-a",
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    version: 1,
    source: "test",
    correlationId: "corr",
    immutable: true,
    engineName: "digital-twin",
    engineVersion: "missing-v0",
    inputFactVersions: [],
    ruleVersions: [],
    assumptions: {},
    outputHash: "abc",
  }, {});
  assert.equal(result.status, "unavailable-engine-version");
});

test("migration runner refuses modified already-applied migrations", async () => {
  const applied = {
    id: "0001_production_data_integrity",
    checksum: "old",
    appliedAt: "2026-07-19T00:00:00.000Z",
    durationMs: 1,
    executor: "test",
    success: true,
    errorDetails: null,
    correlationId: "corr",
  };
  const client: PostgresPilotClient = {
    async query<T>(sql: string): Promise<QueryResult<T>> {
      if (sql.includes("from schema_migrations")) return { rows: [applied as T] };
      return { rows: [] };
    },
    async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
      return operation(this);
    },
  };
  const runner = new PostgresMigrationRunner(client);
  await assert.rejects(
    () => runner.apply({ migrationSql: "select 1", executor: "test", correlationId: "corr" }),
    /Refusing modified already-applied migration/
  );
});

test("SQL adapter scopes queries using user context before repository access", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const client: PostgresPilotClient = {
    async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
      calls.push({ sql, params });
      return { rows: [] };
    },
    async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
      return operation(this);
    },
  };
  const { PostgresPilotRepositories } = await import("../../src/lib/postgresPilotPersistence.ts");
  const repo = new PostgresPilotRepositories(client);
  await repo.facts.getById(ctx(), "missing");
  assert(calls[0].sql.includes("set_config('app.current_user_id'"));
  assert.equal(calls[0].params?.[0], "pilot-user-a");
  assert(calls[1].sql.includes("where id = $1 and user_id = $2"));
});
