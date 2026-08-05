import { spawnSync } from "node:child_process";
import {
  buildApplicationCredentialDiagnostics,
  buildApplicationDatabaseUrl,
  buildApplicationPsqlInvocation,
  buildSanitizedPsqlEnvironment,
  createPasswordSafetyDiagnostics,
} from "../src/lib/postgresPilotBootstrap.ts";
import {
  buildPostgresPilotRoleProvisioningSql,
  POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS,
  POSTGRES_PILOT_POST_PROVISION_AUTH_RETRY_DELAYS_MS,
  POSTGRES_PILOT_APPLICATION_ROLE,
  POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  summarizePostProvisioningAuthenticationProbe,
} from "../src/lib/postgresPilotRoleProvisioning.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";

function redact(value, secrets = []) {
  return redactPostgresPilotText(value, secrets);
}

function databaseNameFromUrl(value) {
  try {
    const url = new URL(value);
    const database = url.pathname.replace(/^\//, "");
    return database || null;
  } catch {
    return null;
  }
}

function fail(message, details = {}) {
  console.error(stringifyPostgresPilotReport({ ok: false, status: "POSTGRES PILOT ROLE PROVISIONING BLOCKED", message, ...details }, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]));
  process.exit(1);
}

function sleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runAdminRoleAttributeProbe(input) {
  const query = `SELECT rolcanlogin FROM pg_roles WHERE rolname='${POSTGRES_PILOT_APPLICATION_ROLE}';`;
  const result = spawnSync(input.psqlExecutable, [input.migrationUrl, "--no-password", "--set=ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--command", query], {
    encoding: "utf8",
    timeout: 30_000,
    env: process.env,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    rolcanlogin: result.status === 0 ? result.stdout.trim() : null,
    stderr: redact(result.stderr || "", [input.rolePassword]),
    stdout: redact(result.stdout || "", [input.rolePassword]),
  };
}

function runPostProvisioningAuthenticationProbe(input) {
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: input.migrationUrl,
    applicationRolePassword: input.rolePassword,
  });
  const invocation = buildApplicationPsqlInvocation({
    applicationUrl,
    password: input.rolePassword,
    psqlExecutable: input.psqlExecutable,
  });
  const credentialDiagnostics = buildApplicationCredentialDiagnostics({
    provisioningPassword: input.rolePassword,
    applicationUrl,
    verifierPassword: input.rolePassword,
  });
  if (!invocation.ok) {
    return {
      ok: false,
      statusCode: invocation.statusCode,
      message: invocation.reason,
      credentialDiagnostics,
      target: {
        connectionMode: invocation.connectionMode,
        poolerHostname: invocation.host,
        host: invocation.host,
        port: invocation.port,
        database: invocation.database,
        routedUsername: invocation.connectionUsername,
        projectRef: invocation.projectRef,
        sslMode: invocation.sslMode,
      },
      attempts: [],
      summary: summarizePostProvisioningAuthenticationProbe([]),
    };
  }

  const childEnv = buildSanitizedPsqlEnvironment({
    baseEnv: process.env,
    password: input.rolePassword,
    sslMode: invocation.sslMode,
  });
  const attempts = [];
  const query = "select current_user || '|' || session_user;";

  for (let index = 0; index < POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS; index += 1) {
    sleep(POSTGRES_PILOT_POST_PROVISION_AUTH_RETRY_DELAYS_MS[index] ?? 0);
    const attemptStartedAt = Date.now();
    const result = spawnSync(invocation.psqlExecutable, [...invocation.baseArgs, "-c", query], {
      encoding: "utf8",
      timeout: 30_000,
      env: childEnv,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = result.stdout.trim();
    const ok = result.status === 0 && output === `${POSTGRES_PILOT_APPLICATION_ROLE}|${POSTGRES_PILOT_APPLICATION_ROLE}`;
    attempts.push({
      attempt: index + 1,
      ok,
      elapsedMsSinceAlterRole: attemptStartedAt - input.alterRoleCompletedAt,
      psqlExitStatus: result.status,
      signal: result.signal,
      stdout: ok ? output : redact(result.stdout || "", [input.rolePassword]),
      stderr: redact(result.stderr || "", [input.rolePassword]),
    });
    if (ok) break;
  }

  return {
    ok: attempts.some((attempt) => attempt.ok),
    statusCode: attempts.some((attempt) => attempt.ok) ? "POST_PROVISION_AUTHENTICATION_PASSED" : "APPLICATION_ROLE_POST_PROVISION_AUTHENTICATION_FAILED",
    credentialDiagnostics,
    target: {
      connectionMode: invocation.connectionMode,
      poolerHostname: invocation.host,
      host: invocation.host,
      port: invocation.port,
      database: invocation.database,
      routedUsername: invocation.connectionUsername,
      projectRef: invocation.projectRef,
      sslMode: invocation.sslMode,
    },
    attempts,
    summary: summarizePostProvisioningAuthenticationProbe(attempts),
  };
}

const migrationUrl = process.env.VIREON_PILOT_MIGRATION_DATABASE_URL;
const rolePassword = process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV];

if (!migrationUrl) fail("missing VIREON_PILOT_MIGRATION_DATABASE_URL");
if (!rolePassword) fail(`missing ${POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV}`);

const databaseName = databaseNameFromUrl(migrationUrl);
if (!databaseName) fail("VIREON_PILOT_MIGRATION_DATABASE_URL is malformed or has no database name");

const sql = buildPostgresPilotRoleProvisioningSql({ databaseName, rolePassword });
const psqlExecutable = process.env.VIREON_PILOT_PSQL_COMMAND || "psql";
const result = spawnSync(psqlExecutable, [migrationUrl, "--no-password", "--set=ON_ERROR_STOP=1"], {
  input: sql,
  encoding: "utf8",
  timeout: 30_000,
  env: process.env,
});
const alterRoleCompletedAt = Date.now();

if (result.status !== 0) {
  const rawError = result.stderr || result.stdout || "psql failed";
  const unsafeMatch = rawError.match(/EXISTING_ROLE_UNSAFE:([A-Za-z0-9_,]+)/);
  fail("role provisioning failed", {
    database: databaseName,
    role: POSTGRES_PILOT_APPLICATION_ROLE,
    statusCode: unsafeMatch ? "EXISTING_ROLE_UNSAFE" : "ROLE_PROVISIONING_FAILED",
    unsafeAttributes: unsafeMatch?.[1] ? unsafeMatch[1].split(",") : undefined,
    stderr: redact(rawError, [rolePassword]),
  });
}

const roleAttributeProbe = runAdminRoleAttributeProbe({ psqlExecutable, migrationUrl, rolePassword });
if (!roleAttributeProbe.ok) {
  fail("post-provisioning role attribute check failed", {
    database: databaseName,
    role: POSTGRES_PILOT_APPLICATION_ROLE,
    statusCode: "POST_PROVISION_ROLE_ATTRIBUTE_CHECK_FAILED",
    roleAttributeProbe,
    alterRoleExecutedSuccessfully: true,
    grantStatementsSucceeded: true,
  });
}

const postProvisioningAuthenticationProbe = runPostProvisioningAuthenticationProbe({
  psqlExecutable,
  migrationUrl,
  rolePassword,
  alterRoleCompletedAt,
});
if (!postProvisioningAuthenticationProbe.ok) {
  fail("post-provisioning application-role authentication failed", {
    database: databaseName,
    role: POSTGRES_PILOT_APPLICATION_ROLE,
    statusCode: postProvisioningAuthenticationProbe.statusCode,
    roleAttributes: roleAttributeProbe,
    credentialDiagnostics: postProvisioningAuthenticationProbe.credentialDiagnostics,
    effectiveRoutedUsername: postProvisioningAuthenticationProbe.target.routedUsername,
    alterRoleExecutedSuccessfully: true,
    grantStatementsSucceeded: true,
    postProvisioningAuthenticationProbe,
  });
}

console.log(stringifyPostgresPilotReport({
  ok: true,
  status: "POSTGRES PILOT ROLE PROVISIONING COMPLETE",
  database: databaseName,
  role: POSTGRES_PILOT_APPLICATION_ROLE,
  privileges: "restricted runtime grants only",
  passwordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  passwordSource: "environment",
  passwordDiagnostics: createPasswordSafetyDiagnostics(rolePassword),
  roleAttributes: roleAttributeProbe,
  postProvisioningAuthenticationProbe,
}, [rolePassword]));
