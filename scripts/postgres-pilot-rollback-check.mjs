import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  comparePostgresTargets,
  buildApplicationDatabaseUrl,
  passwordFingerprint,
  parsePostgresTarget,
} from "../src/lib/postgresPilotBootstrap.ts";
import {
  POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  buildPostgresPilotRoleProvisioningSql,
  reconcilePostgresPilotRuntimeGrantsSql,
} from "../src/lib/postgresPilotRoleProvisioning.ts";
import { createMigrationManifest, createPilotHealthReport, createRollbackCapabilityPlan } from "../src/lib/postgresPilotCompletion.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";
import { collectTooling } from "./postgres-pilot-checks.mjs";

const VIREON_RESTORE_SCHEMA = "public";
const SUPABASE_MANAGED_SCHEMAS = new Set([
  "auth",
  "extensions",
  "graphql",
  "graphql_public",
  "net",
  "pgbouncer",
  "pgsodium",
  "realtime",
  "storage",
  "supabase_functions",
  "supabase_migrations",
  "vault",
]);

function redact(value, secrets = []) {
  return redactPostgresPilotText(value, secrets);
}

function processRecord(command, args, url, stage, secrets = []) {
  const target = parsePostgresTarget(url, stage);
  return {
    stage,
    executable: command,
    argv: args.map((arg) => redact(arg, secrets)),
    username: (() => { try { return url ? decodeURIComponent(new URL(url).username || "") : null; } catch { return null; } })(),
    host: target.hostname,
    database: target.database,
    credentialSource: url ? "URL_USERINFO" : "NONE",
    connectionMode: target.connectionMode,
    timestamp: new Date().toISOString(),
  };
}

function run(command, args, env, stage, url = null, timeout = 120_000, secrets = [], options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    env,
    shell: false,
    windowsHide: true,
  });
  return {
    command,
    ok: result.status === 0,
    status: result.status,
    stdout: result.status === 0 && !options.captureStdout ? "suppressed" : redact(result.stdout || "", secrets),
    stderr: redact(result.stderr || "", secrets),
    process: processRecord(command, args, url, stage, secrets),
  };
}

function runPsqlSql(url, sql, env, stage, secrets = [], options = {}) {
  return run(
    env.VIREON_PILOT_PSQL_COMMAND || "psql",
    [url, "--no-password", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", "--command", sql],
    env,
    stage,
    url,
    120_000,
    secrets,
    options
  );
}

function schemaMigrationRowsSql() {
  return "select id || '|' || success::text || '|' || checksum from schema_migrations order by id;";
}

function parseSchemaMigrationRows(output) {
  return String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, success, checksum] = line.split("|");
      return { id, success: success === "true", checksum };
    });
}

function compareSchemaMigrationRows(rows, manifest = createMigrationManifest()) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const manifestById = new Map(manifest.map((item) => [item.id, item]));
  const mismatches = [];
  for (const item of manifest) {
    const row = rowsById.get(item.id);
    if (!row) mismatches.push({ id: item.id, reason: "missing" });
    else if (!row.success) mismatches.push({ id: item.id, reason: "success_false" });
    else if (row.checksum !== item.checksum) mismatches.push({ id: item.id, reason: "checksum_mismatch", actualChecksum: row.checksum, expectedChecksum: item.checksum });
  }
  for (const row of rows) {
    if (!manifestById.has(row.id)) mismatches.push({ id: row.id, reason: "unexpected" });
  }
  return { ok: mismatches.length === 0, mismatches };
}

function schemaMigrationMetadataExportSql() {
  return [
    "select",
    "  'insert into schema_migrations (id, checksum, applied_at, duration_ms, executor, success, error_details, correlation_id) values (' ||",
    "  quote_literal(id) || ', ' ||",
    "  quote_literal(checksum) || ', ' ||",
    "  quote_literal(applied_at::text) || '::timestamptz, ' ||",
    "  duration_ms::text || ', ' ||",
    "  quote_literal(executor) || ', ' ||",
    "  success::text || ', ' ||",
    "  coalesce(quote_literal(error_details), 'null') || ', ' ||",
    "  quote_literal(correlation_id) ||",
    "  ') on conflict (id) do update set checksum = excluded.checksum, applied_at = excluded.applied_at, duration_ms = excluded.duration_ms, executor = excluded.executor, success = excluded.success, error_details = excluded.error_details, correlation_id = excluded.correlation_id;'",
    "from schema_migrations",
    "order by id;",
  ].join(" ");
}

function buildMetadataRestoreSql(insertStatements) {
  const statements = String(insertStatements)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return [
    "begin;",
    "lock table schema_migrations in exclusive mode;",
    "delete from schema_migrations;",
    ...statements,
    "commit;",
  ].join("\n");
}

function disposableRestorePublicSchemaResetSql() {
  return [
    "drop schema if exists public cascade;",
    "create schema public;",
    "grant usage on schema public to postgres, anon, authenticated, service_role;",
    "grant all on schema public to postgres, service_role;",
  ].join("\n");
}

function buildPasswordFingerprintComparison(input) {
  const provisioningPassword = input.provisioningEnv?.[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV];
  const verifierPassword = input.verifierEnv?.[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV];
  const provisioningPasswordFingerprint = passwordFingerprint(provisioningPassword);
  const runtimeVerifierPasswordFingerprint = passwordFingerprint(verifierPassword);
  return {
    provisioningPasswordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
    runtimeVerifierPasswordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
    provisioningPasswordConfigured: Boolean(provisioningPassword),
    runtimeVerifierPasswordConfigured: Boolean(verifierPassword),
    provisioningPasswordFingerprint,
    runtimeVerifierPasswordFingerprint,
    fingerprintsMatch: Boolean(
      provisioningPasswordFingerprint &&
      provisioningPasswordFingerprint === runtimeVerifierPasswordFingerprint
    ),
    source: "environment",
  };
}

function parseDumpListSchemas(output) {
  const schemas = new Set();
  const candidates = [VIREON_RESTORE_SCHEMA, ...SUPABASE_MANAGED_SCHEMAS];
  for (const line of String(output).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;
    for (const schema of candidates) {
      const escaped = schema.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|\\s|-)${escaped}(?:\\s|$)`).test(trimmed)) {
        schemas.add(schema);
      }
    }
  }
  return schemas;
}

function validateApplicationBackupList(output) {
  const schemas = parseDumpListSchemas(output);
  const managedSchemas = [...schemas].filter((schema) => SUPABASE_MANAGED_SCHEMAS.has(schema));
  const nonApplicationSchemas = [...schemas].filter((schema) => schema !== VIREON_RESTORE_SCHEMA && !SUPABASE_MANAGED_SCHEMAS.has(schema));
  const blocked = [];
  if (!schemas.has(VIREON_RESTORE_SCHEMA)) blocked.push(`backup does not include Vireon application schema: ${VIREON_RESTORE_SCHEMA}`);
  if (managedSchemas.length > 0) blocked.push(`backup includes Supabase-managed schemas: ${managedSchemas.sort().join(", ")}`);
  if (nonApplicationSchemas.length > 0) blocked.push(`backup includes non-application schemas: ${nonApplicationSchemas.sort().join(", ")}`);
  return {
    ok: blocked.length === 0,
    blocked,
    schemas: [...schemas].sort(),
    managedSchemas: managedSchemas.sort(),
    nonApplicationSchemas: nonApplicationSchemas.sort(),
  };
}

function fail(summary, next) {
  summary.status = "FAIL";
  summary.healthReport = createPilotHealthReport({
    passed: false,
    migrationStatus: "NOT_RUN",
    warnings: summary.warnings,
    remainingRisks: summary.blocked,
    recommendedNextStep: next,
  });
  console.log(stringifyPostgresPilotReport(summary, [env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]));
  process.exit(1);
}

const env = { ...process.env };
const tooling = collectTooling();
if (tooling.psql?.path) env.VIREON_PILOT_PSQL_COMMAND = tooling.psql.path;
const primaryUrl = env.VIREON_PILOT_DATABASE_URL || env.VIREON_PILOT_MIGRATION_DATABASE_URL;
const restoreUrl = env.VIREON_PILOT_RESTORE_DATABASE_URL;
const applicationPassword = env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV];
const comparison = comparePostgresTargets({ primaryUrl, restoreUrl });
const plan = createRollbackCapabilityPlan({
  ...env,
  VIREON_PILOT_DATABASE_URL: primaryUrl,
  VIREON_PILOT_MANAGED_BACKUP_CONFIRMED: env.VIREON_PILOT_MANAGED_BACKUP_CONFIRMED || "true",
});
const tempDir = mkdtempSync(join(tmpdir(), "vireon-pilot-restore-"));
const backupFile = env.VIREON_PILOT_BACKUP_FILE || join(tempDir, "vireon-public-schema.backup");
const restoreListFile = join(tempDir, "vireon-public-schema.restore-list");
const summary = {
  command: "postgres:pilot:rollback-check",
  status: plan.ok ? "RUNNING" : "FAIL",
  primaryProjectRef: comparison.primary.projectRef,
  restoreProjectRef: comparison.restore.projectRef,
  sameProject: comparison.sameProject,
  sameLogicalDatabase: comparison.sameLogicalDatabase,
  backupEvidence: env.VIREON_PILOT_BACKUP_FILE ? "operator-file" : "temporary-schema-backup",
  checks: [],
  databaseProcessTimeline: [],
  blocked: [...plan.blocked],
  warnings: [...plan.warnings],
  healthReport: null,
  backupScope: {
    schema: VIREON_RESTORE_SCHEMA,
    excludesSupabaseManagedSchemas: true,
    dataScope: "schema-only plus schema_migrations metadata",
  },
};

if (comparison.sameProject || comparison.sameLogicalDatabase) {
  summary.blocked.push("restore rehearsal refused because restore target is not separate from primary");
}
if (!tooling.pg_dump?.available || !tooling.pg_restore?.available || !tooling.psql?.available) {
  summary.blocked.push("PostgreSQL dump/restore/client tooling is unavailable");
}
if (!applicationPassword) {
  summary.blocked.push(`missing ${POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV} for restored restricted-role verification`);
}
if (summary.blocked.length > 0) {
  fail(summary, "Fix backup/restore configuration before accepting pilot completion.");
}

try {
  const dump = env.VIREON_PILOT_BACKUP_FILE
    ? run(tooling.pg_restore.path || "pg_restore", ["--list", backupFile], env, "inspect supplied backup", null, 120_000, [applicationPassword])
    : run(
      tooling.pg_dump.path || "pg_dump",
      [
        "--format=custom",
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        `--schema=${VIREON_RESTORE_SCHEMA}`,
        "--file",
        backupFile,
        primaryUrl,
      ],
      env,
      "create Vireon public schema backup",
      primaryUrl,
      120_000,
      [applicationPassword]
    );
  summary.checks.push(dump);
  summary.databaseProcessTimeline.push(dump.process);
  if (!dump.ok) {
    summary.blocked.push(env.VIREON_PILOT_BACKUP_FILE ? "supplied backup could not be inspected" : "schema backup could not be created");
    fail(summary, "Fix backup creation before restore rehearsal.");
  }

  const backupList = run(tooling.pg_restore.path || "pg_restore", ["--list", backupFile], env, "inspect Vireon backup object list", null, 120_000, [applicationPassword], { captureStdout: true });
  summary.checks.push(backupList);
  summary.databaseProcessTimeline.push(backupList.process);
  if (!backupList.ok) {
    summary.blocked.push("backup object list could not be inspected");
    fail(summary, "Fix backup inspection before restore rehearsal.");
  }
  const backupListReview = validateApplicationBackupList(backupList.stdout);
  summary.backupListReview = backupListReview;
  if (!backupListReview.ok) {
    summary.blocked.push(...backupListReview.blocked);
    fail(summary, "Create an application-schema-only backup before restore rehearsal.");
  }
  writeFileSync(restoreListFile, backupList.stdout, "utf8");

  const resetRestoreSchema = runPsqlSql(
    restoreUrl,
    disposableRestorePublicSchemaResetSql(),
    env,
    "reset disposable restore public schema",
    [applicationPassword]
  );
  summary.checks.push(resetRestoreSchema);
  summary.databaseProcessTimeline.push(resetRestoreSchema.process);
  if (!resetRestoreSchema.ok) {
    summary.blocked.push("disposable restore public schema reset failed");
    fail(summary, "Fix restore target cleanup before restore rehearsal.");
  }

  const restore = run(
    tooling.pg_restore.path || "pg_restore",
    [
      "--no-owner",
      "--no-privileges",
      `--schema=${VIREON_RESTORE_SCHEMA}`,
      "--use-list",
      restoreListFile,
      "--dbname",
      restoreUrl,
      backupFile,
    ],
    env,
    "restore Vireon public schema backup into restore target",
    restoreUrl,
    180_000,
    [applicationPassword]
  );
  summary.checks.push(restore);
  summary.databaseProcessTimeline.push(restore.process);
  if (!restore.ok) {
    summary.blocked.push("restore rehearsal failed");
    fail(summary, "Fix restore target or backup compatibility before accepting pilot completion.");
  }

  const restoredRowsBeforeMetadata = runPsqlSql(
    restoreUrl,
    schemaMigrationRowsSql(),
    env,
    "inspect schema_migrations immediately after pg_restore",
    [applicationPassword],
    { captureStdout: true }
  );
  summary.checks.push(restoredRowsBeforeMetadata);
  summary.databaseProcessTimeline.push(restoredRowsBeforeMetadata.process);
  if (!restoredRowsBeforeMetadata.ok) {
    summary.blocked.push("restored schema_migrations could not be inspected immediately after pg_restore");
    fail(summary, "Inspect restored schema before accepting pilot completion.");
  }
  summary.restoredSchemaMigrationsImmediatelyAfterPgRestore = parseSchemaMigrationRows(restoredRowsBeforeMetadata.stdout);
  summary.restoredSchemaMigrationComparisonImmediatelyAfterPgRestore = compareSchemaMigrationRows(summary.restoredSchemaMigrationsImmediatelyAfterPgRestore);

  const exportedMigrationMetadata = runPsqlSql(
    primaryUrl,
    schemaMigrationMetadataExportSql(),
    env,
    "export schema_migrations metadata from primary",
    [applicationPassword],
    { captureStdout: true }
  );
  summary.checks.push(exportedMigrationMetadata);
  summary.databaseProcessTimeline.push(exportedMigrationMetadata.process);
  if (!exportedMigrationMetadata.ok) {
    summary.blocked.push("schema_migrations metadata could not be exported from primary");
    fail(summary, "Fix primary migration metadata export before accepting rollback capability.");
  }

  const restoreMigrationMetadata = runPsqlSql(
    restoreUrl,
    buildMetadataRestoreSql(exportedMigrationMetadata.stdout),
    env,
    "restore schema_migrations metadata into restore target",
    [applicationPassword]
  );
  summary.checks.push(restoreMigrationMetadata);
  summary.databaseProcessTimeline.push(restoreMigrationMetadata.process);
  if (!restoreMigrationMetadata.ok) {
    summary.blocked.push("schema_migrations metadata could not be restored into restore target");
    fail(summary, "Fix migration metadata restore before accepting rollback capability.");
  }

  const restoredRowsAfterMetadata = runPsqlSql(
    restoreUrl,
    schemaMigrationRowsSql(),
    env,
    "inspect schema_migrations after metadata restore",
    [applicationPassword],
    { captureStdout: true }
  );
  summary.checks.push(restoredRowsAfterMetadata);
  summary.databaseProcessTimeline.push(restoredRowsAfterMetadata.process);
  if (!restoredRowsAfterMetadata.ok) {
    summary.blocked.push("restored schema_migrations could not be inspected after metadata restore");
    fail(summary, "Inspect restored migration metadata before accepting rollback capability.");
  }
  summary.restoredSchemaMigrationsAfterMetadataRestore = parseSchemaMigrationRows(restoredRowsAfterMetadata.stdout);
  summary.restoredSchemaMigrationComparisonAfterMetadataRestore = compareSchemaMigrationRows(summary.restoredSchemaMigrationsAfterMetadataRestore);
  if (!summary.restoredSchemaMigrationComparisonAfterMetadataRestore.ok) {
    summary.blocked.push("restored schema_migrations does not match the expected migration manifest");
    fail(summary, "Fix restored migration metadata before accepting rollback capability.");
  }

  const restoreTarget = parsePostgresTarget(restoreUrl, "restore");
  const provisionRestoreRole = runPsqlSql(
    restoreUrl,
    buildPostgresPilotRoleProvisioningSql({
      databaseName: restoreTarget.database || "postgres",
      rolePassword: applicationPassword,
    }),
    env,
    "provision restored application role",
    [applicationPassword]
  );
  summary.checks.push(provisionRestoreRole);
  summary.databaseProcessTimeline.push(provisionRestoreRole.process);
  if (!provisionRestoreRole.ok) {
    summary.blocked.push("restored application role provisioning failed");
    fail(summary, "Fix restore-project role provisioning before accepting rollback capability.");
  }
  const restoredRoleProvisionedAtMs = Date.now();

  const reconcileRestoreGrants = runPsqlSql(
    restoreUrl,
    reconcilePostgresPilotRuntimeGrantsSql(),
    env,
    "reconcile restored runtime grants",
    [applicationPassword]
  );
  summary.checks.push(reconcileRestoreGrants);
  summary.databaseProcessTimeline.push(reconcileRestoreGrants.process);
  if (!reconcileRestoreGrants.ok) {
    summary.blocked.push("restored runtime grant reconciliation failed");
    fail(summary, "Fix restored runtime grants before accepting rollback capability.");
  }

  const restoredApplicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: restoreUrl,
    applicationRolePassword: applicationPassword,
  });
  const runtimeEnv = {
    ...env,
    VIREON_PILOT_APPLICATION_DATABASE_URL: restoredApplicationUrl,
    VIREON_PILOT_ROLE_PROVISIONED_AT_MS: String(restoredRoleProvisionedAtMs),
    [POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]: applicationPassword,
  };
  summary.applicationRolePasswordFlow = buildPasswordFingerprintComparison({
    provisioningEnv: env,
    verifierEnv: runtimeEnv,
  });
  if (!summary.applicationRolePasswordFlow.fingerprintsMatch) {
    summary.blocked.push("application role password fingerprint mismatch before restored runtime verification");
    fail(summary, "Fix application-role password propagation before attempting runtime verification.");
  }
  const runtimeVerifier = run(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-runtime-access.mjs"],
    runtimeEnv,
    "verify restored runtime access",
    restoredApplicationUrl,
    180_000,
    [applicationPassword]
  );
  summary.checks.push(runtimeVerifier);
  summary.databaseProcessTimeline.push(runtimeVerifier.process);
  if (!runtimeVerifier.ok) {
    summary.blocked.push("restored runtime access verification failed");
    fail(summary, "Inspect restored runtime verification output before accepting rollback capability.");
  }
  if (runtimeVerifier.json?.transientAuthenticationRecovered) {
    summary.warnings.push("TRANSIENT_APPLICATION_ROLE_AUTHENTICATION_RECOVERED");
    summary.transientApplicationRoleAuthentication = {
      recovered: true,
      successfulAttemptNumber: runtimeVerifier.json.successfulAttemptNumber,
      recoveredFailureCodes: runtimeVerifier.json.authenticationRetry?.recoveredFailureCodes || [],
    };
  }

  summary.status = "PASS";
  summary.healthReport = createPilotHealthReport({
    passed: true,
    migrationStatus: "PASS",
    warnings: summary.warnings,
    recommendedNextStep: "PostgreSQL pilot rollback capability is verified. Preserve this output with pilot evidence.",
  });
  console.log(stringifyPostgresPilotReport(summary, [applicationPassword]));
} finally {
  if (!env.VIREON_PILOT_BACKUP_FILE && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
