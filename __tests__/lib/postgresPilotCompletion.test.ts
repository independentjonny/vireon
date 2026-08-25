import assert from "node:assert/strict";
import { existsSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  createMigrationExecutionPlan,
  createMigrationManifest,
  createPilotHealthReport,
  evaluateRecordedMigrations,
  createRollbackCapabilityPlan,
  POSTGRES_PILOT_EXECUTE_CONFIRMATION,
  POSTGRES_PILOT_MIGRATIONS,
} from "../../src/lib/postgresPilotCompletion.ts";

test("PostgreSQL pilot migration execution plan requires confirmation and required URLs", () => {
  const plan = createMigrationExecutionPlan({});
  assert.equal(plan.ok, false);
  assert.ok(plan.blocked.some((item) => item.includes("VIREON_PILOT_MIGRATION_DATABASE_URL")));
  assert.ok(plan.blocked.some((item) => item.includes("VIREON_PILOT_RESTORE_DATABASE_URL")));
  assert.ok(plan.blocked.some((item) => item.includes("operator confirmation required")));
});

test("PostgreSQL pilot migration execution plan selects the canonical migrations in order", () => {
  for (const migration of POSTGRES_PILOT_MIGRATIONS) assert.equal(existsSync(migration), true);
  const plan = createMigrationExecutionPlan({
    VIREON_PILOT_MIGRATION_DATABASE_URL: "postgresql://postgres.primary@aws-0-ap-southeast-2.pooler.supabase.com/postgres?sslmode=require",
    VIREON_PILOT_RESTORE_DATABASE_URL: "postgresql://postgres.restore@aws-0-ap-southeast-2.pooler.supabase.com/postgres_restore?sslmode=require",
    VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "secret",
    VIREON_PILOT_EXECUTE_CONFIRM: POSTGRES_PILOT_EXECUTE_CONFIRMATION,
  });
  assert.equal(plan.ok, true);
  assert.deepEqual([...plan.migrations], [
    "migrations/0001_production_data_integrity.sql",
    "migrations/0002_private_beta_foundation.sql",
    "migrations/0003_supabase_private_beta_security.sql",
    "migrations/0004_core_decisioning_persistence.sql",
    "migrations/0005_daily_review_append_only_history.sql",
    "migrations/0006_transactions_subscriptions_persistence.sql",
    "migrations/0007_private_beta_invitations.sql",
    "migrations/0008_private_beta_access_rls_hardening.sql",
    "migrations/0009_private_beta_activation_lifecycle.sql",
    "migrations/0010_rls_security_findings.sql",
    "migrations/0011_preview_financial_data_reset.sql",
  ]);
});

test("PostgreSQL pilot rollback capability requires backup evidence", () => {
  const plan = createRollbackCapabilityPlan({
    VIREON_PILOT_DATABASE_URL: "postgresql://u@primary/postgres?sslmode=require",
    VIREON_PILOT_RESTORE_DATABASE_URL: "postgresql://u@restore/postgres_restore?sslmode=require",
  });
  assert.equal(plan.ok, false);
  assert.ok(plan.blocked.some((item) => item.includes("missing backup evidence")));
});

test("PostgreSQL pilot rollback capability accepts a local backup file marker", () => {
  const file = ".tmp-postgres-pilot-backup-test.dump";
  writeFileSync(file, "synthetic backup marker");
  try {
    const plan = createRollbackCapabilityPlan({
      VIREON_PILOT_DATABASE_URL: "postgresql://u@primary/postgres?sslmode=require",
      VIREON_PILOT_RESTORE_DATABASE_URL: "postgresql://u@restore/postgres_restore?sslmode=require",
      VIREON_PILOT_BACKUP_FILE: file,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.backupEvidence, "file");
  } finally {
    rmSync(file, { force: true });
  }
});

test("PostgreSQL Pilot Health Report includes required sections and next step", () => {
  const report = createPilotHealthReport({
    passed: true,
    warnings: ["storage checked separately"],
    recommendedNextStep: "Run rollback check.",
  });
  assert.equal(report.title, "PostgreSQL Pilot Health Report");
  assert.equal(report.status, "PASS");
  assert.equal(report.tooling, "PASS");
  assert.equal(report.environment, "PASS");
  assert.equal(report.primaryDb, "PASS");
  assert.equal(report.restoreDb, "PASS");
  assert.equal(report.migrationRole, "PASS");
  assert.equal(report.applicationRole, "PASS");
  assert.equal(report.ssl, "PASS");
  assert.equal(report.rls, "PASS");
  assert.equal(report.schema, "PASS");
  assert.equal(report.storage, "WARNING");
  assert.equal(report.migrationStatus, "PASS");
  assert.equal(report.recommendedNextStep, "Run rollback check.");
});

test("PostgreSQL pilot execute runs post-migration runtime verification after migrations", () => {
  const source = readFileSync("scripts/postgres-pilot-execute.mjs", "utf8");
  const migrationLoopIndex = source.indexOf("for (const migration of review.pending)");
  const grantIndex = source.indexOf("reconcileRuntimeGrants(baseEnv)");
  const runtimeVerificationIndex = source.indexOf("scripts/postgres-pilot-verify-runtime-access.mjs");
  assert.ok(migrationLoopIndex > -1);
  assert.ok(grantIndex > migrationLoopIndex);
  assert.ok(runtimeVerificationIndex > migrationLoopIndex);
  assert.ok(runtimeVerificationIndex > grantIndex);
  assert.match(source, /postMigrationRuntimeVerification = runtimeAccess\.ok \? "PASS" : "FAIL"/);
});

test("PostgreSQL pilot execute fails when post-migration runtime verification fails", () => {
  const source = readFileSync("scripts/postgres-pilot-execute.mjs", "utf8");
  assert.match(source, /post-migration runtime access verification failed/);
  assert.match(source, /process\.exit\(1\)/);
});

test("PostgreSQL pilot rollback check verifies restored runtime access with restricted role", () => {
  const source = readFileSync("scripts/postgres-pilot-rollback-check.mjs", "utf8");
  assert.match(source, /buildPostgresPilotRoleProvisioningSql/);
  assert.match(source, /reconcilePostgresPilotRuntimeGrantsSql/);
  assert.match(source, /buildApplicationDatabaseUrl/);
  assert.match(source, /VIREON_PILOT_ROLE_PROVISIONED_AT_MS/);
  assert.match(source, /TRANSIENT_APPLICATION_ROLE_AUTHENTICATION_RECOVERED/);
  assert.match(source, /scripts\/postgres-pilot-verify-runtime-access\.mjs/);
  assert.match(source, /restored runtime access verification failed/);
  assert.match(source, /sameProject \|\| comparison\.sameLogicalDatabase/);
});

test("PostgreSQL pilot rollback backup is scoped to Vireon application schema", () => {
  const source = readFileSync("scripts/postgres-pilot-rollback-check.mjs", "utf8");
  assert.match(source, /const VIREON_RESTORE_SCHEMA = "public"/);
  assert.match(source, /SUPABASE_MANAGED_SCHEMAS/);
  assert.match(source, /`--schema=\$\{VIREON_RESTORE_SCHEMA\}`/);
  assert.match(source, /"--use-list"/);
  assert.match(source, /inspect Vireon backup object list/);
  assert.match(source, /backup includes Supabase-managed schemas/);
  assert.match(source, /backup does not include Vireon application schema/);
  assert.match(source, /schema-only plus schema_migrations metadata/);
  assert.doesNotMatch(source, /\["--format=custom", "--schema-only", "--no-owner", "--no-privileges", "--file"/);
});

test("PostgreSQL pilot rollback restores schema_migrations metadata after schema-only restore", () => {
  const source = readFileSync("scripts/postgres-pilot-rollback-check.mjs", "utf8");
  assert.match(source, /inspect schema_migrations immediately after pg_restore/);
  assert.match(source, /export schema_migrations metadata from primary/);
  assert.match(source, /restore schema_migrations metadata into restore target/);
  assert.match(source, /inspect schema_migrations after metadata restore/);
  assert.match(source, /compareSchemaMigrationRows/);
  assert.match(source, /schemaMigrationMetadataExportSql/);
  assert.match(source, /delete from schema_migrations/);
  assert.match(source, /on conflict \(id\) do update/);
});

test("PostgreSQL pilot rollback compares provisioning and runtime verifier password fingerprints before verification", () => {
  const source = readFileSync("scripts/postgres-pilot-rollback-check.mjs", "utf8");
  assert.match(source, /buildPasswordFingerprintComparison/);
  assert.match(source, /provisioningPasswordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV/);
  assert.match(source, /runtimeVerifierPasswordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV/);
  assert.match(source, /application role password fingerprint mismatch before restored runtime verification/);
  assert.ok(source.indexOf("applicationRolePasswordFlow") < source.indexOf("scripts/postgres-pilot-verify-runtime-access.mjs"));
});

test("PostgreSQL pilot rollback redaction handles map callback indexes and iterable secrets", () => {
  const source = [
    readFileSync("scripts/postgres-pilot-rollback-check.mjs", "utf8"),
    readFileSync("src/lib/postgresPilotRedaction.ts", "utf8"),
  ].join("\n");
  assert.match(source, /function normalizePostgresPilotSecrets\(secrets: unknown\)/);
  assert.match(source, /typeof secrets === "string"/);
  assert.match(source, /Array\.isArray\(secrets\)/);
  assert.match(source, /Array\.from\(secrets as Iterable<unknown>\)/);
  assert.match(source, /args\.map\(\(arg\) => redact\(arg, secrets\)\)/);
  assert.doesNotMatch(source, /args\.map\(redact\)/);
});

test("PostgreSQL pilot execution preflight does not require the final execute confirmation", () => {
  const source = readFileSync("scripts/postgres-pilot-execution-preflight.mjs", "utf8");
  assert.match(source, /requiredExecuteConfirmation: POSTGRES_PILOT_EXECUTE_CONFIRMATION/);
  assert.match(source, /VIREON_PILOT_EXECUTE_CONFIRM: POSTGRES_PILOT_EXECUTE_CONFIRMATION/);
});

test("PostgreSQL pilot migration manifest produces deterministic checksums", () => {
  const first = createMigrationManifest();
  const second = createMigrationManifest();
  assert.deepEqual(first, second);
  assert.equal(first.length, POSTGRES_PILOT_MIGRATIONS.length);
  for (const item of first) {
    assert.match(item.checksum, /^[a-f0-9]{64}$/);
    assert.equal(item.canRunInTransaction, true);
  }
});

test("PostgreSQL pilot recorded migration review blocks checksum mismatch and unexpected rows", () => {
  const manifest = createMigrationManifest();
  const review = evaluateRecordedMigrations({
    manifest,
    recorded: [
      { id: manifest[0].id, checksum: "wrong", success: true },
      { id: "9999_unexpected", checksum: "synthetic", success: true },
    ],
  });
  assert.equal(review.ok, false);
  assert.ok(review.blocked.some((item) => item.includes("checksum mismatch")));
  assert.ok(review.blocked.some((item) => item.includes("unexpected schema_migrations rows")));
});
