import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  classifyPilotEnvironment,
  comparePostgresTargets,
  inspectApplicationConnectionTarget,
  parsePostgresTarget,
  validatePilotTargets,
} from "../src/lib/postgresPilotBootstrap.ts";
import { redactPostgresPilotText } from "../src/lib/postgresPilotRedaction.ts";

export const REQUIRED_TOOLS = ["psql", "pg_dump", "pg_restore"];
const DEFAULT_WINDOWS_POSTGRES_18_BIN = "C:\\Program Files\\PostgreSQL\\18\\bin";

function envWithToolDirectory(commandPath) {
  if (process.platform !== "win32" || !commandPath) return process.env;
  const directory = commandPath.replace(/\\[^\\]+$/, "");
  const currentPath = process.env.Path || process.env.PATH || "";
  const nextPath = currentPath.toLowerCase().split(";").includes(directory.toLowerCase())
    ? currentPath
    : `${directory};${currentPath}`;
  return {
    ...process.env,
    Path: nextPath,
    PATH: nextPath,
  };
}
let psqlAttemptSequence = 0;

function nextPsqlAttemptId() {
  psqlAttemptSequence += 1;
  const prefix = process.env.VIREON_PILOT_DB_ATTEMPT_PREFIX || "probe";
  return `${prefix}-${String(psqlAttemptSequence).padStart(2, "0")}`;
}

export function commandInfo(command) {
  const locator = process.platform === "win32"
    ? spawnSync("where", [command], { encoding: "utf8" })
    : spawnSync("command", ["-v", command], { encoding: "utf8", shell: true });
  let source = (locator.stdout || "").trim().split(/\r?\n/).filter(Boolean)[0] || "";
  if (!source && process.platform === "win32") {
    const defaultPath = `${DEFAULT_WINDOWS_POSTGRES_18_BIN}\\${command}.exe`;
    if (existsSync(defaultPath)) source = defaultPath;
  }
  if (!source) {
    return { available: false, path: null, version: null, error: "not found on PATH" };
  }

  const versionProbe = spawnSync(source, ["--version"], { encoding: "utf8", timeout: 10_000, env: envWithToolDirectory(source) });
  return {
    available: versionProbe.status === 0,
    path: source,
    version: (versionProbe.stdout || versionProbe.stderr || "").trim() || null,
    error: versionProbe.status === 0 ? null : "version check failed",
  };
}

export function collectTooling() {
  return Object.fromEntries(REQUIRED_TOOLS.map((tool) => [tool, commandInfo(tool)]));
}

export function sanitizeUrlStatus(value) {
  if (!value) return { exists: false };
  const target = parsePostgresTarget(value, "database URL");
  if (!target.ok) return { exists: true, invalid: true, reason: target.reason };
  return {
    exists: true,
    protocol: target.protocol,
    host: Boolean(target.hostname),
    port: target.port,
    database: target.database,
    sslmode: target.sslMode,
    projectRef: target.projectRef,
    connectionMode: target.connectionMode,
  };
}

export function applicationRoleUrlStatus(value) {
  if (!value) return { ok: false, username: null, reason: "missing application database URL" };
  try {
    const applicationTarget = inspectApplicationConnectionTarget(value);
    const target = parsePostgresTarget(value, "VIREON_PILOT_APPLICATION_DATABASE_URL");
    const url = new URL(value.trim());
    const username = decodeURIComponent(url.username || "");
    const expectedDirect = username === "vireon_app";
    const expectedSupabasePooler = username.startsWith("vireon_app.");
    const sslmode = target.sslMode;
    if (!applicationTarget.ok) {
      return {
        ok: false,
        username: username || null,
        sessionPooler: applicationTarget.connectionMode === "SUPABASE_POOLER",
        sslmode,
        statusCode: applicationTarget.status,
        reason: applicationTarget.reason,
      };
    }
    const sslRequired = sslmode === "require" || sslmode === "verify-full";
    if (!expectedDirect && !expectedSupabasePooler) {
      return {
        ok: false,
        username: username || null,
        sessionPooler: target.connectionMode === "SUPABASE_POOLER",
        sslmode,
        reason: "VIREON_PILOT_APPLICATION_DATABASE_URL must use vireon_app or Supabase pooler user vireon_app.<project-ref>",
      };
    }
    if (!sslRequired) {
      return {
        ok: false,
        username,
        sessionPooler: target.connectionMode === "SUPABASE_POOLER",
        sslmode,
        reason: "VIREON_PILOT_APPLICATION_DATABASE_URL must include sslmode=require or sslmode=verify-full",
      };
    }
    return {
      ok: true,
      username,
      sessionPooler: target.connectionMode === "SUPABASE_POOLER",
      sslmode,
      reason: null,
    };
  } catch {
    return { ok: false, username: null, reason: "malformed application database URL" };
  }
}

export function sameDatabase(left, right) {
  return comparePostgresTargets({ primaryUrl: left, restoreUrl: right }).sameLogicalDatabase;
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
    executable: "psql",
    argv: input.argv.map(redact),
    username,
    host: target.hostname,
    database: target.database,
    credentialSource: "URL_USERINFO",
    connectionMode: target.connectionMode,
    timestamp: new Date().toISOString(),
  };
}

function runPsql(url, sql, meta = {}) {
  const id = nextPsqlAttemptId();
  const psqlExecutable = process.env.VIREON_PILOT_PSQL_COMMAND || "psql";
  const argv = [url, "--no-password", "--tuples-only", "--no-align", "--command", sql];
  const result = spawnSync(psqlExecutable, argv, {
    encoding: "utf8",
    timeout: 15_000,
    env: process.env,
  });
  return {
    id,
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    status: result.status,
    attempt: {
      ...databaseAttemptRecord({
      id,
      stage: meta.stage || "database probe",
      caller: meta.caller || "scripts/postgres-pilot-checks.mjs",
      argv,
      url,
      }),
      executable: psqlExecutable,
    },
  };
}

export function probeDatabase(label, url, tooling) {
  if (!url) return { label, reachable: false, skipped: true, reason: "url missing" };
  if (sanitizeUrlStatus(url).invalid) return { label, reachable: false, skipped: true, reason: "url malformed" };
  if (!tooling.psql?.available) return { label, reachable: false, skipped: true, reason: "psql missing" };

  const caller = "scripts/postgres-pilot-checks.mjs:probeDatabase";
  const attempts = [];
  const version = runPsql(url, "select version();", { stage: `${label} version probe`, caller });
  attempts.push(version.attempt);
  const ssl = version.ok ? runPsql(url, "show ssl;", { stage: `${label} SSL probe`, caller }) : null;
  if (ssl) attempts.push(ssl.attempt);
  const identity = version.ok
    ? runPsql(url, "select current_database() || '|' || current_user;", { stage: `${label} identity probe`, caller })
    : null;
  if (identity) attempts.push(identity.attempt);
  const schema = version.ok
    ? runPsql(url, "select coalesce((select id || ':' || checksum from schema_migrations where success is true order by applied_at desc limit 1), 'unmigrated');", { stage: `${label} schema probe`, caller })
    : null;
  if (schema) attempts.push(schema.attempt);
  const privileges = version.ok
    ? runPsql(url, "select rolsuper::text || '|' || rolbypassrls::text || '|' || rolcreaterole::text || '|' || rolcreatedb::text from pg_roles where rolname = current_user;", { stage: `${label} privilege probe`, caller })
    : null;
  if (privileges) attempts.push(privileges.attempt);

  return {
    label,
    psqlAttempts: attempts,
    reachable: version.ok,
    serverVersion: version.ok ? version.stdout : null,
    ssl: ssl?.ok ? ssl.stdout : null,
    identity: identity?.ok ? identity.stdout : null,
    schemaVersion: schema?.ok ? schema.stdout : null,
    roleFlags: privileges?.ok ? privileges.stdout : null,
    error: version.ok ? null : redact(version.stderr || version.stdout || "connection failed"),
  };
}

export function redact(value) {
  return redactPostgresPilotText(value, [process.env.VIREON_PILOT_APPLICATION_ROLE_PASSWORD]);
}

export function collectEnv() {
  const applicationUrl = sanitizeUrlStatus(process.env.VIREON_PILOT_APPLICATION_DATABASE_URL);
  const primaryUrl = process.env.VIREON_PILOT_DATABASE_URL || process.env.VIREON_PILOT_MIGRATION_DATABASE_URL;
  const pilotTargets = validatePilotTargets({
    primaryUrl,
    restoreUrl: process.env.VIREON_PILOT_RESTORE_DATABASE_URL,
    environment: process.env.VIREON_ENVIRONMENT,
    syntheticDataOnly: process.env.VIREON_SYNTHETIC_DATA_ONLY,
    requireSsl: process.env.VIREON_REQUIRE_SSL,
    persistenceMode: process.env.VIREON_PERSISTENCE_MODE,
  });
  const environment = classifyPilotEnvironment(process.env.VIREON_ENVIRONMENT);
  return {
    VIREON_PILOT_DATABASE_URL: sanitizeUrlStatus(process.env.VIREON_PILOT_DATABASE_URL),
    VIREON_PILOT_RESTORE_DATABASE_URL: sanitizeUrlStatus(process.env.VIREON_PILOT_RESTORE_DATABASE_URL),
    VIREON_PILOT_MIGRATION_DATABASE_URL: sanitizeUrlStatus(process.env.VIREON_PILOT_MIGRATION_DATABASE_URL),
    VIREON_PILOT_APPLICATION_DATABASE_URL: {
      ...applicationUrl,
      applicationRole: applicationRoleUrlStatus(process.env.VIREON_PILOT_APPLICATION_DATABASE_URL),
    },
    VIREON_PERSISTENCE_MODE: process.env.VIREON_PERSISTENCE_MODE || "local",
    VIREON_ENVIRONMENT: process.env.VIREON_ENVIRONMENT || null,
    normalizedEnvironment: environment.normalizedEnvironment,
    environmentClassification: environment.environmentClassification,
    VIREON_SYNTHETIC_DATA_ONLY: process.env.VIREON_SYNTHETIC_DATA_ONLY || null,
    VIREON_REQUIRE_SSL: process.env.VIREON_REQUIRE_SSL || null,
    pilotTargets,
  };
}

export function evaluatePreflight({ env, tooling, probes }) {
  const blocked = [];
  const warnings = [];
  const pilotTargets = env.pilotTargets ?? validatePilotTargets({
    primaryUrl: process.env.VIREON_PILOT_DATABASE_URL || process.env.VIREON_PILOT_MIGRATION_DATABASE_URL,
    restoreUrl: process.env.VIREON_PILOT_RESTORE_DATABASE_URL,
    environment: env.VIREON_ENVIRONMENT ?? process.env.VIREON_ENVIRONMENT,
    syntheticDataOnly: env.VIREON_SYNTHETIC_DATA_ONLY ?? process.env.VIREON_SYNTHETIC_DATA_ONLY,
    requireSsl: env.VIREON_REQUIRE_SSL ?? process.env.VIREON_REQUIRE_SSL,
    persistenceMode: env.VIREON_PERSISTENCE_MODE ?? process.env.VIREON_PERSISTENCE_MODE,
  });

  for (const tool of REQUIRED_TOOLS) {
    if (!tooling[tool]?.available) blocked.push(`missing tool: ${tool}`);
  }
  if (!env.VIREON_PILOT_DATABASE_URL.exists) blocked.push("missing VIREON_PILOT_DATABASE_URL");
  if (!env.VIREON_PILOT_RESTORE_DATABASE_URL.exists) blocked.push("missing VIREON_PILOT_RESTORE_DATABASE_URL");
  if (!env.VIREON_PILOT_MIGRATION_DATABASE_URL.exists) blocked.push("missing VIREON_PILOT_MIGRATION_DATABASE_URL");
  if (!env.VIREON_PILOT_APPLICATION_DATABASE_URL.exists) blocked.push("missing VIREON_PILOT_APPLICATION_DATABASE_URL");
  if (env.VIREON_PILOT_APPLICATION_DATABASE_URL.exists && !env.VIREON_PILOT_APPLICATION_DATABASE_URL.applicationRole?.ok) {
    blocked.push(env.VIREON_PILOT_APPLICATION_DATABASE_URL.applicationRole?.reason || "application database URL does not use the restricted application role");
  }
  blocked.push(...pilotTargets.blocked);
  warnings.push(...pilotTargets.warnings);
  if (env.VIREON_REQUIRE_SSL === "true") {
    for (const probe of probes.filter((item) => item.reachable)) {
      if (probe.ssl !== "on") blocked.push(`${probe.label} does not report SSL enabled`);
    }
  }

  for (const probe of probes) {
    if (!probe.reachable) blocked.push(`${probe.label} database is not reachable: ${probe.reason || probe.error || "unknown"}`);
    if (probe.label.includes("application") && probe.roleFlags) {
      const [superuser, bypassRls, createRole, createDb] = probe.roleFlags.split("|");
      if (superuser === "true") blocked.push("application role is superuser");
      if (bypassRls === "true") blocked.push("application role can bypass RLS");
      if (createRole === "true" || createDb === "true") blocked.push("application role has administrative privileges");
    }
    if (probe.label.includes("migration") && probe.roleFlags) {
      const [superuser, bypassRls, createRole, createDb] = probe.roleFlags.split("|");
      if (superuser === "true") warnings.push("migration role is superuser; use a bounded migration-owner role instead");
      if (bypassRls === "true") warnings.push("migration role can bypass RLS; acceptable only for controlled schema administration");
      if (createRole === "false" && createDb === "false") warnings.push("migration role may not have enough administrative capability for schema/RLS management");
    }
  }

  return {
    ready: blocked.length === 0,
    status: blocked.length === 0 ? "READY TO EXECUTE REAL POSTGRESQL PILOT" : "POSTGRESQL PILOT BLOCKED",
    blocked,
    warnings,
    diagnostics: pilotTargets.diagnostics,
  };
}
