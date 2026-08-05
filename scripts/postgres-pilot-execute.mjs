import { spawnSync } from "node:child_process";
import {
  buildApplicationDatabaseUrl,
  parsePostgresTarget,
} from "../src/lib/postgresPilotBootstrap.ts";
import { reconcilePostgresPilotRuntimeGrantsSql } from "../src/lib/postgresPilotRoleProvisioning.ts";
import {
  createMigrationExecutionPlan,
  createMigrationManifest,
  createPilotHealthReport,
  evaluateRecordedMigrations,
} from "../src/lib/postgresPilotCompletion.ts";
import { POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV } from "../src/lib/postgresPilotRoleProvisioning.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";
import { collectTooling } from "./postgres-pilot-checks.mjs";

function redact(value) {
  return redactPostgresPilotText(value, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]);
}

function printSummary(summary, env = process.env) {
  console.log(stringifyPostgresPilotReport(summary, [env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]));
}

function processRecord(input) {
  const target = parsePostgresTarget(input.url, input.stage);
  return {
    stage: input.stage,
    executable: input.executable,
    argv: input.argv.map(redact),
    username: (() => { try { return decodeURIComponent(new URL(input.url).username || ""); } catch { return null; } })(),
    host: target.hostname,
    database: target.database,
    credentialSource: input.credentialSource,
    connectionMode: target.connectionMode,
    timestamp: new Date().toISOString(),
  };
}

function runScript(label, script, env) {
  const argv = ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", script];
  const result = spawnSync(process.execPath, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180_000,
    env,
    shell: false,
    windowsHide: true,
  });
  return { label, ok: result.status === 0, status: result.status, stdout: redact(result.stdout || ""), stderr: redact(result.stderr || "") };
}

function runPsql(label, url, sql, env) {
  const psqlExecutable = env.VIREON_PILOT_PSQL_COMMAND || "psql";
  const argv = [url, "--no-password", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", "--command", sql];
  const result = spawnSync(psqlExecutable, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    env,
    shell: false,
    windowsHide: true,
  });
  return {
    label,
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: redact(result.stderr || result.stdout || ""),
    process: processRecord({ stage: label, executable: psqlExecutable, argv, url, credentialSource: "URL_USERINFO" }),
  };
}

function runMigration(migration, env) {
  const psqlExecutable = env.VIREON_PILOT_PSQL_COMMAND || "psql";
  const argv = [
    env.VIREON_PILOT_MIGRATION_DATABASE_URL,
    "--no-password",
    "--set=ON_ERROR_STOP=1",
    "--single-transaction",
    "--file",
    migration.path,
  ];
  const started = Date.now();
  const result = spawnSync(psqlExecutable, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180_000,
    env,
    shell: false,
    windowsHide: true,
  });
  return {
    migrationId: migration.id,
    file: migration.path,
    checksum: migration.checksum,
    durationMs: Date.now() - started,
    ok: result.status === 0,
    status: result.status,
    stdout: redact(result.stdout || ""),
    stderr: redact(result.stderr || ""),
    process: processRecord({ stage: `apply migration ${migration.id}`, executable: psqlExecutable, argv, url: env.VIREON_PILOT_MIGRATION_DATABASE_URL, credentialSource: "URL_USERINFO" }),
  };
}

function recordMigrationSuccess(migration, durationMs, env) {
  const sql = [
    "insert into schema_migrations (id, checksum, duration_ms, executor, success, error_details, correlation_id)",
    `values ('${migration.id.replace(/'/g, "''")}', '${migration.checksum}', ${Math.max(0, Math.round(durationMs))}, current_user, true, null, '${migration.id.replace(/'/g, "''")}-execute')`,
    "on conflict (id) do update set",
    "checksum = excluded.checksum,",
    "applied_at = now(),",
    "duration_ms = excluded.duration_ms,",
    "executor = excluded.executor,",
    "success = true,",
    "error_details = null,",
    "correlation_id = excluded.correlation_id;",
  ].join(" ");
  return runPsql(`record migration ${migration.id}`, env.VIREON_PILOT_MIGRATION_DATABASE_URL, sql, env);
}

function reconcileRuntimeGrants(env) {
  return runPsql("reconcile runtime grants", env.VIREON_PILOT_MIGRATION_DATABASE_URL, reconcilePostgresPilotRuntimeGrantsSql(), env);
}

function readRecordedMigrations(env) {
  const exists = runPsql(
    "schema_migrations existence",
    env.VIREON_PILOT_MIGRATION_DATABASE_URL,
    "select to_regclass('public.schema_migrations') is not null;",
    env
  );
  if (!exists.ok || exists.stdout !== "t") return { ok: exists.ok, rows: [], processes: [exists.process], error: exists.stderr };
  const rows = runPsql(
    "schema_migrations rows",
    env.VIREON_PILOT_MIGRATION_DATABASE_URL,
    "select id || '|' || checksum || '|' || success::text from schema_migrations order by id;",
    env
  );
  return {
    ok: rows.ok,
    rows: rows.ok
      ? rows.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
        const [id, checksum, success] = line.split("|");
        return { id, checksum, success: success === "true" };
      })
      : [],
    processes: [exists.process, rows.process],
    error: rows.stderr,
  };
}

const baseEnv = { ...process.env };
const tooling = collectTooling();
if (tooling.psql?.path) baseEnv.VIREON_PILOT_PSQL_COMMAND = tooling.psql.path;
if (baseEnv.VIREON_PILOT_MIGRATION_DATABASE_URL && baseEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD) {
  baseEnv.VIREON_PILOT_APPLICATION_DATABASE_URL = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: baseEnv.VIREON_PILOT_MIGRATION_DATABASE_URL,
    applicationRolePassword: baseEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD,
  });
}
baseEnv.VIREON_PILOT_DATABASE_URL = baseEnv.VIREON_PILOT_DATABASE_URL || baseEnv.VIREON_PILOT_MIGRATION_DATABASE_URL;
baseEnv.VIREON_ENVIRONMENT = baseEnv.VIREON_ENVIRONMENT || "postgres-pilot-non-production";
baseEnv.VIREON_SYNTHETIC_DATA_ONLY = baseEnv.VIREON_SYNTHETIC_DATA_ONLY || "true";
baseEnv.VIREON_REQUIRE_SSL = baseEnv.VIREON_REQUIRE_SSL || "true";
baseEnv.VIREON_PERSISTENCE_MODE = baseEnv.VIREON_PERSISTENCE_MODE || "postgres-required";

const plan = createMigrationExecutionPlan(baseEnv);
const summary = {
  command: "postgres:pilot:execute",
  status: plan.ok ? "RUNNING" : "FAIL",
  requiredConfirmation: "APPLY_MIGRATIONS_TO_PILOT",
  preflight: null,
  migrationsDiscovered: [],
  migrationsApplied: [],
  migrationsSkipped: [],
  schemaMigrationsVerification: null,
  postMigrationRuntimeVerification: "NOT_RUN",
  backupStatus: "NOT_RUN",
  restoreRehearsalStatus: "NOT_RUN",
  databaseProcessTimeline: [],
  healthReport: null,
  blocked: [...plan.blocked],
  warnings: [],
  remainingRisks: [],
};

if (!plan.ok) {
  summary.healthReport = createPilotHealthReport({
    passed: false,
    migrationStatus: "NOT_RUN",
    remainingRisks: plan.blocked,
    recommendedNextStep: "Set required environment variables and typed confirmation, then rerun npm run postgres:pilot:execute.",
  });
  printSummary(summary, baseEnv);
  process.exit(1);
}

const executionPreflight = runScript("execution preflight", "scripts/postgres-pilot-execution-preflight.mjs", baseEnv);
summary.preflight = executionPreflight;
if (!executionPreflight.ok) {
  summary.status = "FAIL";
  summary.blocked.push("non-mutating execution preflight failed");
  summary.healthReport = createPilotHealthReport({
    passed: false,
    migrationStatus: "NOT_RUN",
    remainingRisks: summary.blocked,
    recommendedNextStep: "Resolve execution preflight failures before applying migrations.",
  });
  printSummary(summary, baseEnv);
  process.exit(1);
}

const manifest = createMigrationManifest(plan.migrations);
summary.migrationsDiscovered = manifest.map((item) => ({
  id: item.id,
  path: item.path,
  checksum: item.checksum,
  canRunInTransaction: item.canRunInTransaction,
}));
const recordedBefore = readRecordedMigrations(baseEnv);
summary.databaseProcessTimeline.push(...recordedBefore.processes);
const review = evaluateRecordedMigrations({ manifest, recorded: recordedBefore.rows });
if (!recordedBefore.ok || !review.ok) {
  summary.status = "FAIL";
  summary.blocked.push(recordedBefore.error || "schema_migrations could not be verified", ...review.blocked);
  summary.healthReport = createPilotHealthReport({
    passed: false,
    migrationStatus: "FAIL",
    remainingRisks: summary.blocked,
    recommendedNextStep: "Resolve schema_migrations conflicts before applying migrations.",
  });
  printSummary(summary, baseEnv);
  process.exit(1);
}
summary.migrationsSkipped = review.skipped.map((item) => ({ id: item.id, checksum: item.checksum, reason: "already applied with matching checksum" }));

for (const migration of review.pending) {
  if (!migration.canRunInTransaction) {
    summary.status = "FAIL";
    summary.blocked.push(`migration cannot run in a transaction: ${migration.id}`);
    printSummary(summary, baseEnv);
    process.exit(1);
  }
  const result = runMigration(migration, baseEnv);
  summary.databaseProcessTimeline.push(result.process);
  if (!result.ok) {
    summary.status = "FAIL";
    summary.blocked.push(`migration failed: ${migration.id}`);
    summary.migrationsApplied.push({ ...result, stdout: result.stdout ? "suppressed" : "", stderr: result.stderr });
    summary.healthReport = createPilotHealthReport({
      passed: false,
      migrationStatus: "FAIL",
      remainingRisks: [`migration failed: ${migration.id}`],
      recommendedNextStep: "Inspect the failed migration output, preserve evidence, and do not continue until remediated.",
    });
    printSummary(summary, baseEnv);
    process.exit(1);
  }
  const record = recordMigrationSuccess(migration, result.durationMs, baseEnv);
  summary.databaseProcessTimeline.push(record.process);
  if (!record.ok) {
    summary.status = "FAIL";
    summary.blocked.push(`migration succeeded but schema_migrations recording failed: ${migration.id}`);
    printSummary(summary, baseEnv);
    process.exit(1);
  }
  summary.migrationsApplied.push({
    id: migration.id,
    path: migration.path,
    checksum: migration.checksum,
    durationMs: result.durationMs,
  });
}

const recordedAfter = readRecordedMigrations(baseEnv);
summary.databaseProcessTimeline.push(...recordedAfter.processes);
const afterReview = evaluateRecordedMigrations({ manifest, recorded: recordedAfter.rows });
summary.schemaMigrationsVerification = {
  ok: recordedAfter.ok && afterReview.ok && afterReview.pending.length === 0,
  rows: recordedAfter.rows,
  blocked: afterReview.blocked,
};
if (!summary.schemaMigrationsVerification.ok) {
  summary.status = "FAIL";
  summary.blocked.push("schema_migrations final verification failed", ...afterReview.blocked);
  printSummary(summary, baseEnv);
  process.exit(1);
}

const grants = reconcileRuntimeGrants(baseEnv);
summary.databaseProcessTimeline.push(grants.process);
summary.runtimeGrantReconciliation = grants.ok ? "PASS" : "FAIL";
if (!grants.ok) {
  summary.status = "FAIL";
  summary.blocked.push("runtime grant reconciliation failed");
  summary.healthReport = createPilotHealthReport({
    passed: false,
    migrationStatus: "FAIL",
    remainingRisks: summary.blocked,
    recommendedNextStep: "Do not accept migration completion until runtime grants are reconciled with the restricted application role.",
  });
  printSummary(summary, baseEnv);
  process.exit(1);
}

const runtimeAccess = runScript("post-migration runtime access verification", "scripts/postgres-pilot-verify-runtime-access.mjs", baseEnv);
summary.postMigrationRuntimeVerification = runtimeAccess.ok ? "PASS" : "FAIL";
summary.runtimeAccess = runtimeAccess;
if (!runtimeAccess.ok) {
  summary.status = "FAIL";
  summary.blocked.push("post-migration runtime access verification failed");
  summary.healthReport = createPilotHealthReport({
    passed: false,
    migrationStatus: "FAIL",
    remainingRisks: summary.blocked,
    recommendedNextStep: "Inspect runtime access verification output, preserve evidence, and do not accept migration completion until remediated.",
  });
  printSummary(summary, baseEnv);
  process.exit(1);
}

const rollbackCheck = runScript("rollback capability check", "scripts/postgres-pilot-rollback-check.mjs", baseEnv);
summary.backupStatus = rollbackCheck.ok ? "PASS" : "FAIL";
summary.restoreRehearsalStatus = rollbackCheck.ok ? "PASS" : "FAIL";
summary.rollbackCheck = rollbackCheck;
if (!rollbackCheck.ok) {
  summary.status = "FAIL";
  summary.blocked.push("backup/restore rollback capability check failed");
  summary.healthReport = createPilotHealthReport({
    passed: false,
    migrationStatus: "PASS",
    remainingRisks: ["migrations completed but rollback capability check failed"],
    recommendedNextStep: "Fix backup/restore evidence before accepting pilot completion.",
  });
  printSummary(summary, baseEnv);
  process.exit(1);
}

summary.status = "PASS";
summary.healthReport = createPilotHealthReport({
  passed: true,
  migrationStatus: "PASS",
  recommendedNextStep: "Preserve this execution report, rerun npm run postgres:pilot:bootstrap, then proceed to private-beta remote verification.",
});
printSummary(summary, baseEnv);
