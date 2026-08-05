import { spawnSync } from "node:child_process";
import {
  buildApplicationDatabaseUrl,
  comparePostgresTargets,
  evaluateRestoreDisposable,
  parsePostgresTarget,
  validatePilotTargets,
} from "../src/lib/postgresPilotBootstrap.ts";
import {
  POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  classifyPostgresPilotRuntimeObjectState,
  requiredRuntimeObjectCountSql,
} from "../src/lib/postgresPilotRoleProvisioning.ts";
import {
  createMigrationExecutionPlan,
  createMigrationManifest,
  evaluateRecordedMigrations,
  POSTGRES_PILOT_EXECUTE_CONFIRMATION,
} from "../src/lib/postgresPilotCompletion.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";
import { collectTooling } from "./postgres-pilot-checks.mjs";

function redact(value) {
  return redactPostgresPilotText(value, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]);
}

function runPsql(label, url, sql, env) {
  const psqlExecutable = env.VIREON_PILOT_PSQL_COMMAND || "psql";
  const argv = [url, "--no-password", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", "--command", sql];
  const target = parsePostgresTarget(url, label);
  const result = spawnSync(psqlExecutable, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
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
    process: {
      stage: label,
      executable: psqlExecutable,
      argv: argv.map(redact),
      username: (() => { try { return decodeURIComponent(new URL(url).username || ""); } catch { return null; } })(),
      host: target.hostname,
      database: target.database,
      credentialSource: "URL_USERINFO",
      connectionMode: target.connectionMode,
      timestamp: new Date().toISOString(),
    },
  };
}

function readRecordedMigrations(env) {
  const exists = runPsql(
    "schema_migrations existence",
    env.VIREON_PILOT_MIGRATION_DATABASE_URL,
    "select to_regclass('public.schema_migrations') is not null;",
    env
  );
  if (!exists.ok || exists.stdout !== "t") return { ok: true, rows: [], processes: [exists.process] };
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
    error: rows.ok ? null : rows.stderr,
    processes: [exists.process, rows.process],
  };
}

const baseEnv = { ...process.env };
const tooling = collectTooling();
if (tooling.psql?.path) baseEnv.VIREON_PILOT_PSQL_COMMAND = tooling.psql.path;

const executionPlan = createMigrationExecutionPlan({
  ...baseEnv,
  VIREON_PILOT_EXECUTE_CONFIRM: POSTGRES_PILOT_EXECUTE_CONFIRMATION,
});
const primaryUrl = baseEnv.VIREON_PILOT_DATABASE_URL || baseEnv.VIREON_PILOT_MIGRATION_DATABASE_URL;
const applicationUrl = baseEnv.VIREON_PILOT_MIGRATION_DATABASE_URL && baseEnv[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]
  ? buildApplicationDatabaseUrl({
    migrationDatabaseUrl: baseEnv.VIREON_PILOT_MIGRATION_DATABASE_URL,
    applicationRolePassword: baseEnv[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV],
  })
  : baseEnv.VIREON_PILOT_APPLICATION_DATABASE_URL;
const env = {
  ...baseEnv,
  VIREON_PILOT_DATABASE_URL: primaryUrl,
  VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
  VIREON_ENVIRONMENT: baseEnv.VIREON_ENVIRONMENT || "postgres-pilot-non-production",
  VIREON_SYNTHETIC_DATA_ONLY: baseEnv.VIREON_SYNTHETIC_DATA_ONLY || "true",
  VIREON_REQUIRE_SSL: baseEnv.VIREON_REQUIRE_SSL || "true",
  VIREON_PERSISTENCE_MODE: baseEnv.VIREON_PERSISTENCE_MODE || "postgres-required",
};
const targets = validatePilotTargets({
  primaryUrl,
  restoreUrl: env.VIREON_PILOT_RESTORE_DATABASE_URL,
  environment: env.VIREON_ENVIRONMENT,
  syntheticDataOnly: env.VIREON_SYNTHETIC_DATA_ONLY,
  requireSsl: env.VIREON_REQUIRE_SSL,
  persistenceMode: env.VIREON_PERSISTENCE_MODE,
});
const comparison = comparePostgresTargets({ primaryUrl, restoreUrl: env.VIREON_PILOT_RESTORE_DATABASE_URL });
const report = {
  command: "postgres:pilot:execute:preflight",
  status: "RUNNING",
  ready: false,
  blocked: [...executionPlan.blocked, ...targets.blocked],
  warnings: [...targets.warnings],
  diagnostics: targets.diagnostics,
  migrationManifest: [],
  migrationReview: null,
  migrationStatus: "UNKNOWN",
  applicationRoleVerification: "NOT_RUN",
  databaseProcessTimeline: [],
  requiredExecuteConfirmation: POSTGRES_PILOT_EXECUTE_CONFIRMATION,
};

if (comparison.primary.projectRef !== "bppepkgndukvggggokzy") report.blocked.push("migration URL does not point to expected primary Supabase project bppepkgndukvggggokzy");
if (comparison.restore.projectRef !== "bhnwokrddsacmgbpgzze") report.blocked.push("restore URL does not point to expected restore Supabase project bhnwokrddsacmgbpgzze");
if (comparison.sameProject || comparison.sameLogicalDatabase) report.blocked.push("primary and restore targets must be distinct logical databases");
if (!tooling.psql?.available || !tooling.pg_dump?.available || !tooling.pg_restore?.available) report.blocked.push("PostgreSQL client tools must resolve successfully");

let manifest = [];
try {
  manifest = createMigrationManifest(executionPlan.migrations);
  report.migrationManifest = manifest.map((item) => ({
    id: item.id,
    path: item.path,
    checksum: item.checksum,
    canRunInTransaction: item.canRunInTransaction,
    transactionNotes: item.transactionNotes,
  }));
  for (const item of manifest) {
    if (!item.canRunInTransaction) report.blocked.push(`migration cannot run in a transaction: ${item.id}`);
  }
} catch (error) {
  report.blocked.push(redact(error instanceof Error ? error.message : String(error)));
}

if (report.blocked.length === 0) {
  const restoreCount = runPsql(
    "restore empty/disposable check",
    env.VIREON_PILOT_RESTORE_DATABASE_URL,
    "select count(*)::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';",
    env
  );
  report.databaseProcessTimeline.push(restoreCount.process);
  if (!restoreCount.ok) {
    report.blocked.push("restore disposable check failed");
  } else {
    const disposable = evaluateRestoreDisposable({
      tableCount: Number(restoreCount.stdout || "0"),
      explicitlyDisposable: env.VIREON_PILOT_RESTORE_DISPOSABLE === "true",
    });
    report.blocked.push(...disposable.blocked);
    report.warnings.push(...disposable.warnings);
  }

  const runtimeCount = runPsql(
    "primary runtime object count",
    env.VIREON_PILOT_MIGRATION_DATABASE_URL,
    requiredRuntimeObjectCountSql(),
    env
  );
  report.databaseProcessTimeline.push(runtimeCount.process);
  report.migrationStatus = runtimeCount.ok
    ? classifyPostgresPilotRuntimeObjectState({ presentRuntimeObjectCount: Number(runtimeCount.stdout || "0") })
    : "UNKNOWN";
  if (report.migrationStatus === "UNKNOWN") {
    report.blocked.push(`unsafe migration state: ${report.migrationStatus}`);
  }

  const recorded = readRecordedMigrations(env);
  report.databaseProcessTimeline.push(...recorded.processes);
  if (!recorded.ok) {
    report.blocked.push(`schema_migrations could not be read: ${recorded.error || "unknown"}`);
  } else {
    const migrationReview = evaluateRecordedMigrations({ manifest, recorded: recorded.rows });
    report.migrationReview = {
      applied: migrationReview.applied.map((item) => item.id),
      pending: migrationReview.pending.map((item) => item.id),
      skipped: migrationReview.skipped.map((item) => item.id),
      unexpected: migrationReview.unexpected.map((item) => item.id),
      blocked: migrationReview.blocked,
    };
    report.blocked.push(...migrationReview.blocked);
    if (report.migrationStatus === "MIGRATIONS_PARTIAL") {
      if (migrationReview.ok && migrationReview.pending.length > 0) {
        report.warnings.push("runtime object set is partial because ordered migrations are pending");
      } else {
        report.blocked.push(`unsafe migration state: ${report.migrationStatus}`);
      }
    }
  }

  const verifier = spawnSync(process.execPath, ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    env,
    shell: false,
    windowsHide: true,
  });
  report.applicationRoleVerification = verifier.status === 0 ? "PASS" : "FAIL";
  if (verifier.status !== 0) report.blocked.push("pre-migration application role verification failed");
}

report.status = report.blocked.length === 0 ? "PASS" : "FAIL";
report.ready = report.status === "PASS";
report.next = report.ready
  ? "Run npm run postgres:pilot:execute with VIREON_PILOT_EXECUTE_CONFIRM set."
  : "Resolve blocked items before executing migrations.";
console.log(stringifyPostgresPilotReport(report, [baseEnv[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]));
process.exit(report.ready ? 0 : 1);
