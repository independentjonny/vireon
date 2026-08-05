import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildApplicationPsqlInvocation,
  buildApplicationCredentialDiagnostics,
  buildSanitizedPsqlEnvironment,
  inspectApplicationConnectionTarget,
} from "../src/lib/postgresPilotBootstrap.ts";
import {
  POSTGRES_PILOT_APPLICATION_ROLE,
  POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  restrictedRoleFlagSql,
  runPostgresPilotApplicationAuthenticationRetry,
  validatePostgresPilotApplicationUrl,
} from "../src/lib/postgresPilotRoleProvisioning.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";

function redact(value) {
  return redactPostgresPilotText(value, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]);
}

function resolvePsqlExecutable(psqlCommand) {
  if (process.platform === "win32") {
    const result = spawnSync("where.exe", [psqlCommand], { encoding: "utf8", timeout: 5_000 });
    return {
      resolver: "where.exe",
      status: result.status,
      stdout: redact(result.stdout || "").trim().split(/\r?\n/).filter(Boolean),
      stderr: redact(result.stderr || "").trim(),
    };
  }
  const result = spawnSync("command", ["-v", psqlCommand], { encoding: "utf8", timeout: 5_000, shell: true });
  return {
    resolver: "command -v",
    status: result.status,
    stdout: redact(result.stdout || "").trim().split(/\r?\n/).filter(Boolean),
    stderr: redact(result.stderr || "").trim(),
  };
}

function resolvedExecutablePath(resolution, fallback) {
  return resolution?.stdout?.[0] || fallback;
}

function selectedEnvironmentDiagnostics(env) {
  const caseInsensitiveCounts = Object.keys(env).reduce((acc, key) => {
    const normalized = key.toUpperCase();
    acc[normalized] = (acc[normalized] || 0) + 1;
    return acc;
  }, {});
  return {
    envKeys: Object.keys(env).sort(),
    caseInsensitiveKeyCounts: {
      PGPASSWORD: caseInsensitiveCounts.PGPASSWORD || 0,
      PGSSLMODE: caseInsensitiveCounts.PGSSLMODE || 0,
      PGUSER: caseInsensitiveCounts.PGUSER || 0,
      PGSERVICE: caseInsensitiveCounts.PGSERVICE || 0,
      PGPASSFILE: caseInsensitiveCounts.PGPASSFILE || 0,
    },
    envValues: {
      PGUSER: env.PGUSER ?? null,
      PGHOST: env.PGHOST ?? null,
      PGPORT: env.PGPORT ?? null,
      PGDATABASE: env.PGDATABASE ?? null,
      PGSSLMODE: env.PGSSLMODE ?? null,
      PGPASSWORD: env.PGPASSWORD ? "<present>" : null,
      PGSERVICE: env.PGSERVICE ?? null,
      PGSERVICEFILE: env.PGSERVICEFILE ?? null,
      PGPASSFILE: env.PGPASSFILE ?? null,
      PATH: env.PATH ?? env.Path ?? null,
    },
  };
}

function passwordByteDiagnostics(value) {
  const buffer = Buffer.from(value || "", "utf8");
  return {
    byteLength: buffer.length,
    utf8HexFingerprint: createHash("sha256").update(buffer).digest("hex").slice(0, 12),
    firstByte: buffer.length > 0 ? buffer[0] : null,
    lastByte: buffer.length > 0 ? buffer[buffer.length - 1] : null,
    containsNullByte: buffer.includes(0),
    containsCR: buffer.includes(13),
    containsLF: buffer.includes(10),
  };
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function maybeWritePowerShellRepro(psqlCommand, psqlArgs, psqlEnv) {
  if (process.env.VIREON_PILOT_WRITE_PSQL_REPRO_SCRIPT !== "true") return null;
  const directory = mkdtempSync(join(tmpdir(), "vireon-psql-repro-"));
  const scriptPath = join(directory, "verify-role-repro.ps1");
  const encodedPassword = Buffer.from(psqlEnv.PGPASSWORD || "", "utf8").toString("base64");
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$env:PGPASSWORD = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(${quotePowerShell(encodedPassword)}))`,
    `$env:PGSSLMODE = ${quotePowerShell(psqlEnv.PGSSLMODE || "require")}`,
    "Remove-Item Env:PGUSER -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGHOST -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGHOSTADDR -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGPORT -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGDATABASE -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGSERVICEFILE -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGPASSFILE -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGAPPNAME -ErrorAction SilentlyContinue",
    "Remove-Item Env:PGTARGETSESSIONATTRS -ErrorAction SilentlyContinue",
    `& ${quotePowerShell(psqlCommand)} ${psqlArgs.map(quotePowerShell).join(" ")}`,
  ].join("\r\n");
  writeFileSync(scriptPath, command, "utf8");
  return scriptPath;
}

function retryDelaysMs() {
  if (process.env.VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE === "true" && process.env.VIREON_PILOT_TEST_AUTH_RETRY_DELAYS_MS) {
    return process.env.VIREON_PILOT_TEST_AUTH_RETRY_DELAYS_MS
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0);
  }
  return undefined;
}

function runPsql(invocation, sql, options = {}) {
  const usePsqlScript = process.env.VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE === "true" && Boolean(process.env.VIREON_PILOT_PSQL_SCRIPT);
  const psqlCommand = usePsqlScript ? process.execPath : process.env.VIREON_PILOT_PSQL_COMMAND || "psql";
  const executableResolution = usePsqlScript
    ? { resolver: "test script override", status: 0, stdout: [process.execPath], stderr: "" }
    : resolvePsqlExecutable(psqlCommand);
  const resolvedPsqlCommand = usePsqlScript ? process.execPath : resolvedExecutablePath(executableResolution, psqlCommand);
  const psqlArgs = [
    ...(usePsqlScript ? [process.env.VIREON_PILOT_PSQL_SCRIPT] : []),
    ...invocation.baseArgs,
    "-c",
    sql,
  ];
  const effectiveEnv = { ...(options.env ?? process.env) };
  if (usePsqlScript) {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("VIREON_FAKE_PSQL_") && value != null) effectiveEnv[key] = value;
    }
  }
  const effectiveInvocation = {
    id: process.env.VIREON_PILOT_DB_ATTEMPT_ID || null,
    stage: "pre-migration application role verification",
    caller: "scripts/postgres-pilot-verify-role.mjs",
    executable: resolvedPsqlCommand,
    executableResolution,
    cwd: process.cwd(),
    argv: psqlArgs,
    shell: false,
    environment: selectedEnvironmentDiagnostics(effectiveEnv),
    passwordByteDiagnostics: {
      childPgPassword: passwordByteDiagnostics(effectiveEnv.PGPASSWORD),
      sourceApplicationPassword: passwordByteDiagnostics(process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]),
    },
    reproScriptPath: maybeWritePowerShellRepro(resolvedPsqlCommand, psqlArgs, effectiveEnv),
  };
  const result = spawnSync(resolvedPsqlCommand, psqlArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
    env: effectiveEnv,
    shell: false,
    windowsHide: true,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  return {
    ok: result.status === 0,
    stdout: stdout.trim(),
    stderr: redact(stderr || stdout || ""),
    stderrExactRedacted: redact(stderr),
    stdoutExactRedacted: redact(stdout),
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
    status: result.status,
    signal: result.signal,
    effectiveInvocation,
  };
}

function runPsqlWithTransientAuthenticationRetry(invocation, sql, options = {}) {
  const provisionedAtMs = Number(process.env.VIREON_PILOT_ROLE_PROVISIONED_AT_MS || "");
  return runPostgresPilotApplicationAuthenticationRetry({
    provisionedAtMs,
    delaysMs: retryDelaysMs(),
    runAttempt: () => {
      const result = runPsql(invocation, sql, options);
      return {
        ...result,
        stdout: result.stdoutExactRedacted || result.stdout,
        stderr: result.stderrExactRedacted || result.stderr,
      };
    },
  });
}

function fail(message, details = {}) {
  console.error(stringifyPostgresPilotReport({ ok: false, status: "POSTGRES PILOT APPLICATION ROLE BLOCKED", message, ...details }, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]));
  process.exit(1);
}

const applicationUrl = process.env.VIREON_PILOT_APPLICATION_DATABASE_URL;
const verifierPassword = process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV];
const forceBadPasswordDiagnostic = process.env.VIREON_PILOT_DIAGNOSTIC_FORCE_BAD_PASSWORD === "true";
const applicationUrlStatus = validatePostgresPilotApplicationUrl(applicationUrl);
const applicationTarget = inspectApplicationConnectionTarget(applicationUrl);
const credentialDiagnostics = buildApplicationCredentialDiagnostics({
  provisioningPassword: verifierPassword,
  applicationUrl,
  verifierPassword,
});
const invocation = buildApplicationPsqlInvocation({
  applicationUrl,
  password: verifierPassword,
  psqlExecutable: process.env.VIREON_PILOT_PSQL_COMMAND || "psql",
});
const applicationDiagnostics = {
  applicationRole: applicationTarget.applicationRole,
  connectionMode: applicationTarget.connectionMode,
  routedUsernameHasProjectRef: applicationTarget.routedUsernameHasProjectRef,
  routedUsernameProjectRef: applicationTarget.routedUsernameProjectRef,
  applicationUrlSource: applicationTarget.applicationUrlSource,
  credentialTransport: credentialDiagnostics.credentialTransport,
  passwordConfigured: credentialDiagnostics.verifierPassword.passwordConfigured,
  passwordLength: credentialDiagnostics.verifierPassword.passwordLength,
  passwordHasLeadingWhitespace: credentialDiagnostics.verifierPassword.passwordHasLeadingWhitespace,
  passwordHasTrailingWhitespace: credentialDiagnostics.verifierPassword.passwordHasTrailingWhitespace,
  passwordContainsNewline: credentialDiagnostics.verifierPassword.passwordContainsNewline,
  passwordAppearsQuoted: credentialDiagnostics.verifierPassword.passwordAppearsQuoted,
  passwordSpecialCharacterCategories: {
    at: credentialDiagnostics.verifierPassword.passwordContainsAt,
    colon: credentialDiagnostics.verifierPassword.passwordContainsColon,
    slash: credentialDiagnostics.verifierPassword.passwordContainsSlash,
    questionMark: credentialDiagnostics.verifierPassword.passwordContainsQuestionMark,
    hash: credentialDiagnostics.verifierPassword.passwordContainsHash,
    percent: credentialDiagnostics.verifierPassword.passwordContainsPercent,
    bang: credentialDiagnostics.verifierPassword.passwordContainsBang,
    space: credentialDiagnostics.verifierPassword.passwordContainsSpace,
    unicode: credentialDiagnostics.verifierPassword.passwordContainsUnicode,
  },
  provisioningPasswordFingerprint: credentialDiagnostics.provisioningPassword.passwordFingerprint,
  applicationUrlPasswordFingerprint: credentialDiagnostics.applicationUrlPassword.passwordFingerprint,
  verifierPasswordFingerprint: credentialDiagnostics.verifierPassword.passwordFingerprint,
  passwordFingerprintsMatch: credentialDiagnostics.fingerprintsMatch,
  applicationUrlContainsPassword: credentialDiagnostics.applicationUrlContainsPassword,
  credentialTransportContradiction: credentialDiagnostics.credentialTransportContradiction,
  forcedBadPasswordDiagnostic: forceBadPasswordDiagnostic,
  effectiveInvocation: invocation.diagnostics,
};

if (!applicationUrl) fail("missing VIREON_PILOT_APPLICATION_DATABASE_URL");
if (!verifierPassword) fail(`missing ${POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV}`, { applicationDiagnostics });
if (applicationTarget.status === "APPLICATION_POOLER_USERNAME_NOT_ROUTED") {
  fail(applicationTarget.reason || "Supabase Session Pooler application username is not routed.", {
    statusCode: "APPLICATION_POOLER_EFFECTIVE_USERNAME_NOT_ROUTED",
    applicationDiagnostics,
  });
}
if (!applicationTarget.ok) {
  fail(applicationTarget.reason || "invalid application database URL", { applicationDiagnostics });
}
if (!applicationUrlStatus.ok) fail(applicationUrlStatus.reason || "invalid application database URL", { applicationUrlStatus });
if (credentialDiagnostics.credentialTransportContradiction) {
  fail("application URL contains embedded credentials while verifier uses PGPASSWORD", {
    statusCode: "APPLICATION_CREDENTIAL_TRANSPORT_CONTRADICTION",
    applicationDiagnostics,
  });
}
if (!credentialDiagnostics.fingerprintsMatch) {
  fail("application role password fingerprints do not match", {
    statusCode: "APPLICATION_ROLE_PASSWORD_MISMATCH",
    applicationDiagnostics,
  });
}
if (!invocation.ok) {
  fail(invocation.reason || "application role psql invocation is invalid", {
    statusCode: invocation.statusCode,
    applicationDiagnostics,
  });
}
if (
  invocation.diagnostics.connectionTargetContainsPassword ||
  invocation.diagnostics.passwordInCommandArguments ||
  !invocation.diagnostics.passwordEnvironmentConfigured
) {
  fail("application role verifier credential transport invariants failed", {
    statusCode: "APPLICATION_ROLE_CREDENTIAL_TRANSPORT_CONFLICT",
    applicationDiagnostics,
  });
}

const psqlEnv = buildSanitizedPsqlEnvironment({
  baseEnv: process.env,
  password: forceBadPasswordDiagnostic ? "__vireon_intentionally_wrong_password__" : verifierPassword,
  sslMode: invocation.sslMode,
});
const psqlEnvironmentDiagnostics = selectedEnvironmentDiagnostics(psqlEnv);
if (
  psqlEnvironmentDiagnostics.caseInsensitiveKeyCounts.PGPASSWORD !== 1 ||
  psqlEnvironmentDiagnostics.caseInsensitiveKeyCounts.PGSSLMODE !== 1 ||
  psqlEnvironmentDiagnostics.caseInsensitiveKeyCounts.PGUSER !== 0 ||
  psqlEnvironmentDiagnostics.caseInsensitiveKeyCounts.PGSERVICE !== 0 ||
  psqlEnvironmentDiagnostics.caseInsensitiveKeyCounts.PGPASSFILE !== 0 ||
  passwordByteDiagnostics(psqlEnv.PGPASSWORD).containsNullByte
) {
  fail("application role verifier environment invariants failed", {
    statusCode: "APPLICATION_ROLE_CHILD_ENVIRONMENT_INVALID",
    psqlEnvironmentDiagnostics,
    passwordByteDiagnostics: {
      childPgPassword: passwordByteDiagnostics(psqlEnv.PGPASSWORD),
      sourceApplicationPassword: passwordByteDiagnostics(verifierPassword),
    },
    applicationDiagnostics,
  });
}

const verificationSql = [
  "select 'identity|' || current_user || '|' || session_user;",
  restrictedRoleFlagSql(POSTGRES_PILOT_APPLICATION_ROLE).replace(/^select /, "select 'flags|' || "),
  "select 'ssl|' || setting from pg_settings where name = 'ssl';",
  "select 'schemaUsage|' || has_schema_privilege(current_user, 'public', 'usage')::text;",
  "do $$ begin execute 'create role vireon_forbidden_probe'; execute 'drop role vireon_forbidden_probe'; raise exception 'CREATE_ROLE_ALLOWED'; exception when insufficient_privilege then null; end $$;",
  "select 'createRoleBlocked|true';",
  "do $$ begin execute 'create schema vireon_forbidden_probe'; execute 'drop schema vireon_forbidden_probe'; raise exception 'CREATE_SCHEMA_ALLOWED'; exception when insufficient_privilege then null; end $$;",
  "select 'createSchemaBlocked|true';",
].join("\n");

const verification = runPsqlWithTransientAuthenticationRetry(invocation, verificationSql, { env: psqlEnv });
if (!verification.ok) {
  fail("application role cannot log in", {
    statusCode: "APPLICATION_ROLE_PASSWORD_VERIFICATION_FAILED",
    stderr: verification.stderr,
    stderrExactRedacted: verification.stderrExactRedacted,
    stdoutExactRedacted: verification.stdoutExactRedacted,
    stdoutBytes: verification.stdoutBytes,
    stderrBytes: verification.stderrBytes,
    psqlSignal: verification.signal,
    psqlExitStatus: verification.status,
    effectiveInvocation: verification.effectiveInvocation,
    authenticationRetry: verification.authenticationRetry,
    applicationDiagnostics,
  });
}
const rows = Object.fromEntries(
  verification.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const [key, ...values] = line.split("|");
    return [key, values.join("|")];
  })
);
const [currentUser, sessionUser] = String(rows.identity || "").split("|");
if (currentUser !== POSTGRES_PILOT_APPLICATION_ROLE || sessionUser !== POSTGRES_PILOT_APPLICATION_ROLE) {
  fail("application role login returned an unexpected database identity", {
    statusCode: "APPLICATION_ROLE_PASSWORD_VERIFICATION_FAILED",
    currentUser,
    sessionUser,
    applicationDiagnostics,
  });
}

const flags = rows.flags;
if (!flags) fail("application role flags could not be read", { stdout: verification.stdoutExactRedacted });
if (flags !== "false|false|false|false") {
  fail("application role has prohibited administrative flags", { roleFlags: flags });
}

const ssl = rows.ssl;
if (!ssl) fail("application role cannot verify SSL state", { stdout: verification.stdoutExactRedacted });
if (ssl !== "on") fail("application role connection does not report SSL enabled", { ssl });

const schemaUsage = rows.schemaUsage;
if (!schemaUsage) fail("application role cannot inspect public schema usage", { stdout: verification.stdoutExactRedacted });
if (schemaUsage !== "true") fail("application role lacks usage on public schema", { schemaUsage });
if (rows.createRoleBlocked !== "true" || rows.createSchemaBlocked !== "true") {
  fail("application role prohibited-action checks did not complete", {
    createRoleBlocked: rows.createRoleBlocked || null,
    createSchemaBlocked: rows.createSchemaBlocked || null,
  });
}

console.log(stringifyPostgresPilotReport({
  ok: true,
  status: "POSTGRES PILOT APPLICATION ROLE VERIFIED",
  role: currentUser,
  sessionUser,
  applicationDiagnostics,
  psqlInvocationEvidence: verification.effectiveInvocation,
  authenticationRetry: verification.authenticationRetry,
  transientAuthenticationRecovered: verification.authenticationRetry?.transientAuthenticationRecovered ?? false,
  successfulAttemptNumber: verification.authenticationRetry?.successfulAttemptNumber ?? 1,
  psqlIdentityResult: {
    exitCode: verification.status,
    signal: verification.signal,
    stdoutBytes: verification.stdoutBytes,
    stderrBytes: verification.stderrBytes,
    stderrExactRedacted: verification.stderrExactRedacted,
  },
  roleFlags: flags,
  verificationPhase: "PRE_MIGRATION",
  ssl: "passed",
  schemaUsage: "passed",
  runtimeObjectAccess: "not checked before migrations",
  sequenceAccess: "not checked before migrations",
  rlsEnforcement: "rolbypassrls=false; table RLS checked after migrations",
  prohibitedAdministrativeActions: "blocked",
  databaseCreation: "blocked by rolcreatedb=false",
}, [verifierPassword]));
