import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import dns from "node:dns";
import { promisify } from "node:util";
import { collectTooling } from "./postgres-pilot-checks.mjs";
import {
  RESTORE_TARGET_NEXT_ACTION,
  createSafeUrlDiagnostic,
  createPostgresPilotBootstrapPlan,
  buildApplicationDatabaseUrl,
  buildApplicationCredentialDiagnostics,
  createPasswordSafetyDiagnostics,
  evaluateRestoreDisposable,
  validatePilotTargets,
  validateRestoreTarget,
  parsePostgresTarget,
} from "../src/lib/postgresPilotBootstrap.ts";
import {
  classifyPostgresPilotRuntimeObjectState,
  POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  requiredRuntimeObjectCountSql,
} from "../src/lib/postgresPilotRoleProvisioning.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";

const dnsLookup = promisify(dns.lookup);
const DEFAULT_WINDOWS_POSTGRES_18_BIN = "C:\\Program Files\\PostgreSQL\\18\\bin";
const DEBUG_ENABLED = process.env.NODE_ENV === "development" || process.env.VIREON_DEBUG === "true";
let databaseAttemptSequence = 0;

function nextDatabaseAttemptId() {
  databaseAttemptSequence += 1;
  return `db-${String(databaseAttemptSequence).padStart(2, "0")}`;
}

function parseJsonPayload(value) {
  const text = String(value || "");
  const start = text.indexOf("{");
  if (start === -1) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

function runNodeScript(label, script, env) {
  const args = script.endsWith(".ts")
    ? ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", script]
    : ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", script];
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    timeout: 60_000,
    env,
  });
  return {
    label,
    ok: result.status === 0,
    status: result.status,
    json: parseJsonPayload(result.stdout || result.stderr || ""),
    stdout: redactOutput(result.stdout || ""),
    stderr: redactOutput(result.stderr || ""),
  };
}

function redactOutput(value) {
  return redactPostgresPilotText(value, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]);
}

function printReport(report, env = process.env, error = false) {
  const output = stringifyPostgresPilotReport(report, [env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]);
  if (error) console.error(output);
  else console.log(output);
}

function readSecretWithPowerShell(prompt) {
  if (process.platform !== "win32" || !process.stdin.isTTY) return null;
  const command = [
    `$secure = Read-Host -AsSecureString ${JSON.stringify(prompt)}`,
    "$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)",
    "try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringUni($bstr)) }",
    "finally { if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) } }",
  ].join("; ");
  const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (result.status !== 0) return null;
  return result.stdout || null;
}

function repairWindowsPostgresPath(env) {
  if (process.platform !== "win32") return { repaired: false, reason: "not Windows" };
  if (!existsSync(DEFAULT_WINDOWS_POSTGRES_18_BIN)) return { repaired: false, reason: "PostgreSQL 18 default bin path not found" };
  const delimiter = ";";
  const pathValue = env.Path || env.PATH || "";
  if (pathValue.toLowerCase().split(delimiter).includes(DEFAULT_WINDOWS_POSTGRES_18_BIN.toLowerCase())) {
    return { repaired: false, reason: "PostgreSQL 18 already on PATH" };
  }
  env.Path = `${DEFAULT_WINDOWS_POSTGRES_18_BIN}${delimiter}${pathValue}`;
  env.PATH = env.Path;
  return { repaired: true, reason: "prepended default PostgreSQL 18 bin directory to child PATH" };
}

function databaseAttemptRecord(input) {
  const target = parsePostgresTarget(input.url, input.stage);
  let username = null;
  try {
    username = input.url ? decodeURIComponent(new URL(input.url.trim()).username || "") || null : null;
  } catch {
    username = null;
  }
  return {
    id: input.id,
    stage: input.stage,
    caller: input.caller,
    executable: input.executable,
    argv: input.argv.map(redactOutput),
    username,
    host: target.hostname,
    database: target.database,
    credentialSource: input.credentialSource,
    connectionMode: target.connectionMode,
    timestamp: new Date().toISOString(),
  };
}

function recordPlannedDatabaseAttempt(timeline, input) {
  const id = nextDatabaseAttemptId();
  timeline?.push(databaseAttemptRecord({
    id,
    ...input,
  }));
  return id;
}

function runPsql(label, url, sql, env, timeline) {
  const id = nextDatabaseAttemptId();
  const psqlExecutable = env.VIREON_PILOT_PSQL_COMMAND || "psql";
  const argv = [url, "--no-password", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", "--command", sql];
  timeline?.push(databaseAttemptRecord({
    id,
    stage: label,
    caller: "scripts/postgres-pilot-bootstrap.mjs",
    executable: psqlExecutable,
    argv,
    url,
    credentialSource: "URL_USERINFO",
  }));
  const result = spawnSync(psqlExecutable, argv, {
    encoding: "utf8",
    timeout: 20_000,
    env,
  });
  return {
    id,
    label,
    ok: result.status === 0,
    status: result.status,
    stdout: redactOutput(result.stdout || ""),
    stderr: redactOutput(result.stderr || result.stdout || ""),
  };
}

async function validateDns(label, urlValue) {
  try {
    const url = new URL(urlValue);
    await dnsLookup(url.hostname);
    return { label, ok: true, hostnameConfigured: true };
  } catch (error) {
    return { label, ok: false, hostnameConfigured: true, error: redactOutput(error instanceof Error ? error.message : String(error)) };
  }
}

async function main() {
  const workingEnv = { ...process.env };

  if (!workingEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD) {
    const password = readSecretWithPowerShell("vireon_app password");
    if (password) workingEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD = password;
  }

  const pathRepair = repairWindowsPostgresPath(workingEnv);
  if (pathRepair.repaired) {
    process.env.Path = workingEnv.Path;
    process.env.PATH = workingEnv.PATH;
  }
  const tooling = collectTooling();
  if (tooling.psql?.path) workingEnv.VIREON_PILOT_PSQL_COMMAND = tooling.psql.path;

  const plan = createPostgresPilotBootstrapPlan(workingEnv);
  const restoreTarget = validateRestoreTarget({
    primaryUrl: workingEnv.VIREON_PILOT_DATABASE_URL || workingEnv.VIREON_PILOT_MIGRATION_DATABASE_URL,
    restoreUrl: workingEnv.VIREON_PILOT_RESTORE_DATABASE_URL,
  });
  const targetValidation = validatePilotTargets({
    primaryUrl: plan.childEnv.VIREON_PILOT_DATABASE_URL,
    restoreUrl: plan.childEnv.VIREON_PILOT_RESTORE_DATABASE_URL,
    environment: plan.childEnv.VIREON_ENVIRONMENT,
    syntheticDataOnly: plan.childEnv.VIREON_SYNTHETIC_DATA_ONLY,
    requireSsl: plan.childEnv.VIREON_REQUIRE_SSL,
    persistenceMode: plan.childEnv.VIREON_PERSISTENCE_MODE,
  });
  const report = {
    reportName: "PostgreSQL Pilot Health Report",
    status: plan.ok ? "RUNNING" : "FAIL",
    tooling,
    pathRepair,
    environment: {
      migrationUrlConfigured: Boolean(workingEnv.VIREON_PILOT_MIGRATION_DATABASE_URL),
      restoreUrlConfigured: Boolean(workingEnv.VIREON_PILOT_RESTORE_DATABASE_URL),
      applicationPasswordProvided: Boolean(workingEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD),
      persistenceMode: plan.childEnv.VIREON_PERSISTENCE_MODE,
      syntheticOnly: plan.childEnv.VIREON_SYNTHETIC_DATA_ONLY,
      requireSsl: plan.childEnv.VIREON_REQUIRE_SSL,
    },
    applicationPasswordDiagnostics: createPasswordSafetyDiagnostics(workingEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD),
    steps: [],
    derived: {
      primaryProjectRef: plan.derived.projectRef,
      poolerHost: plan.derived.poolerHost ? "configured" : null,
      restoreProjectRef: plan.derived.restoreProjectRef,
      applicationDatabaseUrl: plan.derived.applicationDatabaseUrl ? "constructed in memory" : null,
      primaryDatabaseUrlSource: plan.derived.primaryDatabaseUrlSource,
    },
    warnings: plan.warnings,
    blocked: plan.blocked,
    remainingRisks: [],
    roleProvisioning: "NOT_RUN",
    preMigrationRoleVerification: "NOT_RUN",
    migrationStatus: "UNKNOWN",
    postMigrationRuntimeVerification: "NOT_RUN",
    diagnostics: targetValidation.diagnostics,
    databaseProcessTimeline: [],
    applicationUrlRebuiltAfterProvisioning: false,
    applicationUrlEnvironmentOverridden: false,
    applicationCredentialDiagnostics: null,
  };
  if (DEBUG_ENABLED) {
    report.urlDiagnostics = {
      primary: createSafeUrlDiagnostic(restoreTarget.primary),
      restore: createSafeUrlDiagnostic(restoreTarget.restore),
    };
  }

  const sameProjectRestoreFailure = plan.blocked.some((item) => item.includes("same Supabase project reference"));
  if (sameProjectRestoreFailure) {
    report.status = "FAIL";
    report.restoreTargetGuidance = {
      primaryProjectRef: plan.derived.projectRef,
      restoreProjectRef: plan.derived.restoreProjectRef,
      message: "Primary and restore database URLs resolve to the same Supabase project. The pilot requires a separate restore project.",
      requirements: [
        "Create a second Supabase project manually.",
        "Keep the restore project empty and disposable.",
        "Use the restore project's Session Pooler connection string.",
        "Set sslmode=require or sslmode=verify-full.",
        "Do not print or commit passwords.",
      ],
    };
    report.nextAction = RESTORE_TARGET_NEXT_ACTION;
    printReport(report, workingEnv);
    process.exit(1);
  }

  if (!tooling.psql?.available || !tooling.pg_dump?.available || !tooling.pg_restore?.available) {
    report.status = "FAIL";
    report.blocked.push("PostgreSQL client tools are missing after PATH repair attempt.");
    report.next = "Install PostgreSQL client tools, or verify PostgreSQL 18 is installed at C:\\Program Files\\PostgreSQL\\18\\bin.";
    printReport(report, workingEnv);
    process.exit(1);
  }

  if (!plan.ok) {
    report.status = "FAIL";
    report.next = [
      "Set VIREON_PILOT_MIGRATION_DATABASE_URL for the Supabase migration/admin connection.",
      "Set VIREON_PILOT_RESTORE_DATABASE_URL for a separate restore database.",
      "Set VIREON_PILOT_APPLICATION_ROLE_PASSWORD or run this command from an interactive PowerShell session.",
    ];
    printReport(report, workingEnv);
    process.exit(1);
  }

  const childEnv = { ...process.env, ...plan.childEnv };
  if (tooling.psql?.path) childEnv.VIREON_PILOT_PSQL_COMMAND = tooling.psql.path;
  const suppliedApplicationUrl = workingEnv.VIREON_PILOT_APPLICATION_DATABASE_URL;
  delete childEnv.VIREON_PILOT_APPLICATION_DATABASE_URL;
  const dnsResults = await Promise.all([
    validateDns("primary", childEnv.VIREON_PILOT_DATABASE_URL),
    validateDns("restore", childEnv.VIREON_PILOT_RESTORE_DATABASE_URL),
  ]);
  report.steps.push({ label: "DNS resolution", ok: dnsResults.every((item) => item.ok), results: dnsResults });
  if (!dnsResults.every((item) => item.ok)) {
    report.status = "FAIL";
    report.next = "Fix DNS/network access for the configured pilot database URLs before provisioning.";
    printReport(report, childEnv);
    process.exit(1);
  }

  const connectivity = [
    runPsql("migration connectivity", childEnv.VIREON_PILOT_MIGRATION_DATABASE_URL, "select 1;", childEnv, report.databaseProcessTimeline),
    runPsql("restore connectivity", childEnv.VIREON_PILOT_RESTORE_DATABASE_URL, "select 1;", childEnv, report.databaseProcessTimeline),
  ];
  report.steps.push(...connectivity);
  if (!connectivity.every((item) => item.ok)) {
    report.status = "FAIL";
    report.next = "Fix database connectivity before provisioning.";
    printReport(report, childEnv);
    process.exit(1);
  }

  const runtimeObjectCount = runPsql(
    "migration status runtime object count",
    childEnv.VIREON_PILOT_MIGRATION_DATABASE_URL,
    requiredRuntimeObjectCountSql(),
    childEnv,
    report.databaseProcessTimeline
  );
  report.steps.push(runtimeObjectCount);
  report.migrationStatus = runtimeObjectCount.ok
    ? classifyPostgresPilotRuntimeObjectState({ presentRuntimeObjectCount: Number(runtimeObjectCount.stdout || "0") })
    : "UNKNOWN";

  const restoreObjectCount = runPsql(
    "restore empty/disposable check",
    childEnv.VIREON_PILOT_RESTORE_DATABASE_URL,
    "select count(*)::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';",
    childEnv,
    report.databaseProcessTimeline
  );
  report.steps.push(restoreObjectCount);
  if (!restoreObjectCount.ok) {
    report.status = "FAIL";
    report.next = "Fix restore database access before provisioning.";
    printReport(report, childEnv);
    process.exit(1);
  }
  const restoreTableCount = Number(restoreObjectCount.stdout || "0");
  const restoreDisposable = evaluateRestoreDisposable({
    tableCount: restoreTableCount,
    explicitlyDisposable: childEnv.VIREON_PILOT_RESTORE_DISPOSABLE === "true",
  });
  if (!restoreDisposable.ok) {
    report.status = "FAIL";
    report.blocked.push(...restoreDisposable.blocked);
    report.next = "Provide an empty restore database or explicitly mark the restore target disposable.";
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  report.warnings.push(...restoreDisposable.warnings);

  const commands = [
    ["provision application role", "scripts/postgres-pilot-provision-roles.mjs"],
    ["pre-migration application role verification", "scripts/postgres-pilot-verify-role.mjs"],
    ["run preflight", "scripts/postgres-pilot-preflight.mjs"],
  ];

  for (const [label, script] of commands) {
    if (label === "provision application role") {
      const attemptId = recordPlannedDatabaseAttempt(report.databaseProcessTimeline, {
        stage: label,
        caller: "scripts/postgres-pilot-bootstrap.mjs -> scripts/postgres-pilot-provision-roles.mjs",
        executable: "psql",
        argv: [childEnv.VIREON_PILOT_MIGRATION_DATABASE_URL, "--no-password", "--set=ON_ERROR_STOP=1"],
        url: childEnv.VIREON_PILOT_MIGRATION_DATABASE_URL,
        credentialSource: "URL_USERINFO",
      });
      childEnv.VIREON_PILOT_DB_ATTEMPT_ID = attemptId;
    }
    if (label === "pre-migration application role verification") {
      const rebuiltApplicationUrl = buildApplicationDatabaseUrl({
        migrationDatabaseUrl: childEnv.VIREON_PILOT_MIGRATION_DATABASE_URL,
        applicationRolePassword: childEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD,
      });
      childEnv.VIREON_PILOT_APPLICATION_DATABASE_URL = rebuiltApplicationUrl;
      const invocationTarget = parsePostgresTarget(rebuiltApplicationUrl, "VIREON_PILOT_APPLICATION_DATABASE_URL");
      const applicationUsername = decodeURIComponent(new URL(rebuiltApplicationUrl).username || "");
      const attemptId = recordPlannedDatabaseAttempt(report.databaseProcessTimeline, {
        stage: label,
        caller: "scripts/postgres-pilot-bootstrap.mjs -> scripts/postgres-pilot-verify-role.mjs",
        executable: childEnv.VIREON_PILOT_PSQL_COMMAND || "psql",
        argv: [
          "-X",
          "-w",
          "-h",
          invocationTarget.hostname || "<missing-host>",
          "-p",
          invocationTarget.port || "5432",
          "-U",
          applicationUsername,
          "-d",
          invocationTarget.database || "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-At",
          "-c",
          "<pre-migration verification sql>",
        ],
        url: rebuiltApplicationUrl,
        credentialSource: "PGPASSWORD",
      });
      childEnv.VIREON_PILOT_DB_ATTEMPT_ID = attemptId;
      report.applicationUrlRebuiltAfterProvisioning = true;
      report.applicationUrlEnvironmentOverridden = Boolean(suppliedApplicationUrl && suppliedApplicationUrl !== rebuiltApplicationUrl);
      report.applicationCredentialDiagnostics = buildApplicationCredentialDiagnostics({
        provisioningPassword: childEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD,
        applicationUrl: rebuiltApplicationUrl,
        verifierPassword: childEnv.VIREON_PILOT_APPLICATION_ROLE_PASSWORD,
      });
    }
    if (label === "run preflight") {
      childEnv.VIREON_PILOT_DB_ATTEMPT_PREFIX = "preflight";
    } else {
      delete childEnv.VIREON_PILOT_DB_ATTEMPT_PREFIX;
    }
    const result = runNodeScript(label, script, childEnv);
    report.steps.push(result);
    if (result.json?.databaseProcessTimeline) {
      report.databaseProcessTimeline.push(...result.json.databaseProcessTimeline);
    } else if (result.json?.databases) {
      for (const probe of result.json.databases) {
        if (Array.isArray(probe.psqlAttempts)) report.databaseProcessTimeline.push(...probe.psqlAttempts);
      }
    }
    if (label === "provision application role") report.roleProvisioning = result.ok ? "PASS" : "FAIL";
    if (label === "pre-migration application role verification") report.preMigrationRoleVerification = result.ok ? "PASS" : "FAIL";
    if (label === "pre-migration application role verification" && result.ok && result.json?.transientAuthenticationRecovered) {
      report.warnings.push(
        `Transient application-role authentication propagation recovered on attempt ${result.json.successfulAttemptNumber}.`
      );
    }
    if (!result.ok) {
      report.status = "FAIL";
      report.next = `Resolve the failed step: ${label}.`;
      printReport(report, childEnv);
      process.exit(1);
    }
  }

  report.status = "PASS";
  report.primaryDb = "connectivity passed";
  report.restoreDb = "connectivity and disposable check passed";
  report.migrationRole = "connectivity passed";
  report.applicationRole = "provisioned and verified";
  report.ssl = "checked by preflight";
  report.rls = "checked by application role verification and preflight";
  report.schema = "checked by preflight";
  report.storage = "not changed by PostgreSQL pilot bootstrap";
  report.nextAction = "Set VIREON_PILOT_EXECUTE_CONFIRM and run npm run postgres:pilot:execute.";
  report.next = report.nextAction;
  printReport(report, childEnv);
}

main().catch((error) => {
  printReport({
    reportName: "PostgreSQL Pilot Health Report",
    status: "FAIL",
    blocked: [redactOutput(error instanceof Error ? error.message : String(error))],
    next: "Resolve the bootstrap exception and rerun npm run postgres:pilot:bootstrap.",
  }, process.env, true);
  process.exit(1);
});
