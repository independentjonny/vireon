import { spawnSync } from "node:child_process";
import {
  RESTORE_TARGET_NEXT_ACTION,
  classifyPilotEnvironment,
  comparePostgresTargets,
  createSafeUrlDiagnostic,
  evaluateRestoreDisposable,
  validateRestoreTarget,
} from "../src/lib/postgresPilotBootstrap.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";
import { collectTooling } from "./postgres-pilot-checks.mjs";

const DEBUG_ENABLED = process.env.NODE_ENV === "development" || process.env.VIREON_DEBUG === "true";

function redactOutput(value) {
  return redactPostgresPilotText(value, [process.env.VIREON_PILOT_APPLICATION_ROLE_PASSWORD]);
}

function printReport(report) {
  console.log(stringifyPostgresPilotReport(report, [process.env.VIREON_PILOT_APPLICATION_ROLE_PASSWORD]));
}

function runPsql(label, url, sql) {
  const psqlExecutable = process.env.VIREON_PILOT_PSQL_COMMAND || "psql";
  const result = spawnSync(psqlExecutable, [url, "--no-password", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", "--command", sql], {
    encoding: "utf8",
    timeout: 20_000,
    env: process.env,
  });
  return {
    label,
    ok: result.status === 0,
    status: result.status,
    stdout: redactOutput(result.stdout || ""),
    stderr: redactOutput(result.stderr || result.stdout || ""),
  };
}

function emptyResult(target) {
  return {
    command: "postgres:pilot:validate-targets",
    status: "FAIL",
    primaryProjectRef: target.primary.projectRef,
    restoreProjectRef: target.restore.projectRef,
    sameProject: target.sameProject,
    sameLogicalDatabase: target.sameLogicalDatabase,
    ssl: target.ssl,
    primaryReachable: false,
    restoreReachable: false,
    restoreDisposable: false,
    blocked: [...target.blocked],
    warnings: [...target.warnings],
    nextAction: target.sameProject ? RESTORE_TARGET_NEXT_ACTION : "Fix the PostgreSQL pilot restore target configuration and rerun npm run postgres:pilot:validate-targets.",
  };
}

const target = validateRestoreTarget({
  primaryUrl: process.env.VIREON_PILOT_MIGRATION_DATABASE_URL,
  restoreUrl: process.env.VIREON_PILOT_RESTORE_DATABASE_URL,
});
const comparison = comparePostgresTargets({
  primaryUrl: process.env.VIREON_PILOT_MIGRATION_DATABASE_URL,
  restoreUrl: process.env.VIREON_PILOT_RESTORE_DATABASE_URL,
});
const environment = classifyPilotEnvironment(process.env.VIREON_ENVIRONMENT);

const report = emptyResult(target);
report.diagnostics = {
  normalizedEnvironment: environment.normalizedEnvironment,
  environmentClassification: environment.environmentClassification,
  primaryProjectRef: comparison.primary.projectRef,
  restoreProjectRef: comparison.restore.projectRef,
  sameProject: comparison.sameProject,
  sameLogicalDatabase: comparison.sameLogicalDatabase,
  primaryConnectionMode: comparison.primary.connectionMode,
  restoreConnectionMode: comparison.restore.connectionMode,
  comparisonBasis: comparison.comparisonBasis,
};
if (DEBUG_ENABLED) {
  report.urlDiagnostics = {
    primary: createSafeUrlDiagnostic(target.primary),
    restore: createSafeUrlDiagnostic(target.restore),
  };
}

if (!target.ok) {
  if (target.guidance) report.restoreTargetGuidance = target.guidance;
  printReport(report);
  process.exit(1);
}

const tooling = collectTooling();
if (tooling.psql?.path) process.env.VIREON_PILOT_PSQL_COMMAND = tooling.psql.path;
if (!tooling.psql?.available) {
  report.blocked.push("psql is required to verify target reachability and restore disposability.");
  report.nextAction = "Install PostgreSQL client tools, then rerun npm run postgres:pilot:validate-targets.";
  printReport(report);
  process.exit(1);
}

const primaryConnectivity = runPsql("primary connectivity", process.env.VIREON_PILOT_MIGRATION_DATABASE_URL, "select 1;");
const restoreConnectivity = runPsql("restore connectivity", process.env.VIREON_PILOT_RESTORE_DATABASE_URL, "select 1;");
report.primaryReachable = primaryConnectivity.ok;
report.restoreReachable = restoreConnectivity.ok;

if (!primaryConnectivity.ok) {
  report.blocked.push("primary migration target is not reachable.");
  report.primaryErrorCategory = "CONNECTION_FAILED";
}
if (!restoreConnectivity.ok) {
  report.blocked.push("restore target is not reachable.");
  report.restoreErrorCategory = "CONNECTION_FAILED";
}

if (primaryConnectivity.ok && restoreConnectivity.ok) {
  const restoreObjectCount = runPsql(
    "restore empty/disposable check",
    process.env.VIREON_PILOT_RESTORE_DATABASE_URL,
    "select count(*)::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';"
  );
  if (!restoreObjectCount.ok) {
    report.blocked.push("restore target emptiness could not be verified.");
    report.restoreErrorCategory = "RESTORE_EMPTY_CHECK_FAILED";
  } else {
    const restoreTableCount = Number((restoreObjectCount.stdout || "0").trim());
    const disposable = evaluateRestoreDisposable({
      tableCount: restoreTableCount,
      explicitlyDisposable: process.env.VIREON_PILOT_RESTORE_DISPOSABLE === "true",
    });
    report.restoreDisposable = disposable.restoreDisposable;
    report.blocked.push(...disposable.blocked);
    report.warnings.push(...disposable.warnings);
  }
}

if (report.blocked.length === 0) {
  report.status = "PASS";
  report.restoreDisposable = true;
  report.nextAction = "Run npm run postgres:pilot:bootstrap.";
}

printReport(report);
process.exit(report.status === "PASS" ? 0 : 1);
