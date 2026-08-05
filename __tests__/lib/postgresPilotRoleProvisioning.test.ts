import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  buildApplicationPsqlInvocation,
  buildApplicationCredentialDiagnostics,
  buildApplicationDatabaseUrl,
  buildSanitizedPsqlEnvironment,
  decodeUrlPassword,
  passwordFingerprint,
  validatePilotTargets,
} from "../../src/lib/postgresPilotBootstrap.ts";
import {
  buildPostgresPilotRoleProvisioningSql,
  classifyPostgresPilotRuntimeObjectState,
  classifyPostgresPilotMigrationState,
  expectedRuntimeObjectProbeSql,
  POSTGRES_PILOT_APPEND_ONLY_TABLES,
  POSTGRES_PILOT_APPLICATION_ROLE,
  POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS,
  POSTGRES_PILOT_REQUIRED_TABLES,
  POSTGRES_PILOT_READ_ONLY_TABLES,
  POSTGRES_PILOT_READ_WRITE_TABLES,
  requiredRuntimeObjectCountSql,
  reconcilePostgresPilotRuntimeGrantsSql,
  classifyTransientApplicationRoleAuthenticationFailure,
  summarizePostProvisioningAuthenticationProbe,
  validatePostgresPilotApplicationUrl,
} from "../../src/lib/postgresPilotRoleProvisioning.ts";
import { applicationRoleUrlStatus, evaluatePreflight } from "../../scripts/postgres-pilot-checks.mjs";

const sql = buildPostgresPilotRoleProvisioningSql({
  databaseName: "vireon_pilot",
  rolePassword: "offline-test-password-only",
});

test("PostgreSQL pilot role provisioning is idempotent and updates an existing role safely", () => {
  assert.match(sql, /select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls/);
  assert.match(sql, /where rolname = 'vireon_app';/);
  assert.match(sql, /if existing is null then/);
  assert.match(sql, /create role "vireon_app" with login password 'offline-test-password-only';/);
  assert.match(sql, /alter role "vireon_app" login;/);
  assert.match(sql, /alter role "vireon_app" password 'offline-test-password-only';/);
  assert.doesNotMatch(sql, /alter role "vireon_app" with login password 'offline-test-password-only' nosuperuser/i);
});

test("PostgreSQL pilot role provisioning source does not commit an application-role password", () => {
  const sources = [
    "src/lib/postgresPilotRoleProvisioning.ts",
    "scripts/postgres-pilot-provision-roles.mjs",
    "scripts/postgres-pilot-verify-role.mjs",
  ].map((file) => readFileSync(file, "utf8").toLowerCase());

  for (const source of sources) {
    assert.equal(source.includes("offline-test-password-only"), false);
    assert.equal(source.includes("changeme"), false);
    assert.equal(source.includes("set-outside-source-control"), false);
  }
});

test("PostgreSQL pilot role provisioning enforces restricted role flags", () => {
  assert.match(sql, /login password/);
  assert.match(sql, /existing\.rolsuper/);
  assert.match(sql, /existing\.rolcreatedb/);
  assert.match(sql, /existing\.rolcreaterole/);
  assert.match(sql, /existing\.rolbypassrls/);
  assert.match(sql, /APPLICATION_ROLE_RESTRICTED_FLAG_VERIFICATION_FAILED/);
  assert.doesNotMatch(sql, /\screatedb\b/i);
  assert.doesNotMatch(sql, /\screaterole\b/i);
  assert.doesNotMatch(sql, /\ssuperuser\b/i);
  assert.doesNotMatch(sql, /\sbypassrls\b/i);
});

test("PostgreSQL pilot existing safe role rotation does not issue protected flag changes", () => {
  const existingBranchStart = sql.indexOf("else");
  const existingBranchEnd = sql.indexOf("select rolcanlogin", existingBranchStart + 1);
  const existingBranch = sql.slice(existingBranchStart, existingBranchEnd);
  assert.match(existingBranch, /alter role "vireon_app" login;/);
  assert.match(existingBranch, /alter role "vireon_app" password 'offline-test-password-only';/);
  assert.doesNotMatch(existingBranch, /nosuperuser|nocreatedb|nocreaterole|nobypassrls/i);
});

test("PostgreSQL pilot existing unsafe role is blocked before password rotation", () => {
  const unsafeBlockIndex = sql.indexOf("EXISTING_ROLE_UNSAFE");
  const passwordRotationIndex = sql.indexOf("alter role \"vireon_app\" password");
  assert.ok(unsafeBlockIndex > -1);
  assert.ok(passwordRotationIndex > unsafeBlockIndex);
  assert.match(sql, /unsafe_attributes := unsafe_attributes \|\| 'rolsuper'/);
  assert.match(sql, /unsafe_attributes := unsafe_attributes \|\| 'rolcreatedb'/);
  assert.match(sql, /unsafe_attributes := unsafe_attributes \|\| 'rolcreaterole'/);
  assert.match(sql, /unsafe_attributes := unsafe_attributes \|\| 'rolbypassrls'/);
});

test("PostgreSQL pilot newly created role is verified as restricted after creation", () => {
  const createIndex = sql.indexOf("create role \"vireon_app\" with login password");
  const verifyIndex = sql.indexOf("APPLICATION_ROLE_RESTRICTED_FLAG_VERIFICATION_FAILED");
  assert.ok(createIndex > -1);
  assert.ok(verifyIndex > createIndex);
  assert.match(sql, /not existing\.rolcanlogin or existing\.rolsuper or existing\.rolcreatedb or existing\.rolcreaterole or existing\.rolbypassrls/);
});

test("PostgreSQL pilot provisioning script redacts supplied password from failures", () => {
  const source = readFileSync("scripts/postgres-pilot-provision-roles.mjs", "utf8");
  assert.match(source, /redact\(rawError, \[rolePassword\]\)/);
  assert.match(source, /statusCode: unsafeMatch \? "EXISTING_ROLE_UNSAFE" : "ROLE_PROVISIONING_FAILED"/);
  assert.doesNotMatch(source, /console\.log\(sql\)|console\.error\(sql\)/);
});

test("PostgreSQL pilot provisioning and runtime verifier report env-based password fingerprints", () => {
  const provisioningSource = readFileSync("scripts/postgres-pilot-provision-roles.mjs", "utf8");
  const runtimeSource = readFileSync("scripts/postgres-pilot-verify-runtime-access.mjs", "utf8");
  assert.match(provisioningSource, /passwordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV/);
  assert.match(provisioningSource, /passwordSource: "environment"/);
  assert.match(runtimeSource, /provisioningPasswordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV/);
  assert.match(runtimeSource, /runtimeVerifierPasswordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV/);
  assert.match(runtimeSource, /passwordSource: "environment"/);
  assert.match(runtimeSource, /passwordFingerprintsMatch: credentialDiagnostics\.fingerprintsMatch/);
});

test("PostgreSQL pilot provisioning probes immediate post-ALTER application-role authentication", () => {
  const source = readFileSync("scripts/postgres-pilot-provision-roles.mjs", "utf8");
  assert.match(source, /runAdminRoleAttributeProbe/);
  assert.match(source, /SELECT rolcanlogin FROM pg_roles WHERE rolname='\$\{POSTGRES_PILOT_APPLICATION_ROLE\}';/);
  assert.match(source, /runPostProvisioningAuthenticationProbe/);
  assert.match(source, /buildApplicationDatabaseUrl/);
  assert.match(source, /buildApplicationPsqlInvocation/);
  assert.match(source, /buildSanitizedPsqlEnvironment/);
  assert.match(source, /POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS/);
  assert.match(source, /APPLICATION_ROLE_POST_PROVISION_AUTHENTICATION_FAILED/);
});

test("PostgreSQL pilot post-provisioning authentication summary records immediate success", () => {
  const summary = summarizePostProvisioningAuthenticationProbe([
    { attempt: 1, ok: true, elapsedMsSinceAlterRole: 25 },
  ]);
  assert.equal(summary.authenticationSucceeded, true);
  assert.equal(summary.firstSuccessfulAttempt, 1);
  assert.equal(summary.attempts, 1);
  assert.equal(summary.permanentFailure, false);
});

test("PostgreSQL pilot post-provisioning authentication summary records delayed success", () => {
  const summary = summarizePostProvisioningAuthenticationProbe([
    { attempt: 1, ok: false, elapsedMsSinceAlterRole: 15 },
    { attempt: 2, ok: false, elapsedMsSinceAlterRole: 520 },
    { attempt: 3, ok: true, elapsedMsSinceAlterRole: 1_535 },
  ]);
  assert.equal(summary.authenticationSucceeded, true);
  assert.equal(summary.firstSuccessfulAttempt, 3);
  assert.equal(summary.attempts, 3);
  assert.equal(summary.permanentFailure, false);
});

test("PostgreSQL pilot post-provisioning authentication summary records permanent failure", () => {
  const attempts = Array.from({ length: POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS }, (_, index) => ({
    attempt: index + 1,
    ok: false,
    elapsedMsSinceAlterRole: index * 500,
  }));
  const summary = summarizePostProvisioningAuthenticationProbe(attempts);
  assert.equal(summary.authenticationSucceeded, false);
  assert.equal(summary.firstSuccessfulAttempt, null);
  assert.equal(summary.attempts, POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS);
  assert.equal(summary.permanentFailure, true);
});

test("PostgreSQL pilot bootstrap uses provisioning before pre-migration verification", () => {
  const source = readFileSync("scripts/postgres-pilot-bootstrap.mjs", "utf8");
  const provisionIndex = source.indexOf("[\"provision application role\", \"scripts/postgres-pilot-provision-roles.mjs\"]");
  const verifyIndex = source.indexOf("[\"pre-migration application role verification\", \"scripts/postgres-pilot-verify-role.mjs\"]");
  assert.ok(provisionIndex > -1);
  assert.ok(verifyIndex > provisionIndex);
});

test("PostgreSQL pilot bootstrap rebuilds canonical application URL before verify-role child process", () => {
  const source = readFileSync("scripts/postgres-pilot-bootstrap.mjs", "utf8");
  const verifyBranchIndex = source.indexOf('label === "pre-migration application role verification"');
  const rebuildIndex = source.indexOf("buildApplicationDatabaseUrl", verifyBranchIndex);
  const runChildIndex = source.indexOf("runNodeScript(label, script, childEnv)", verifyBranchIndex);
  assert.ok(verifyBranchIndex > -1);
  assert.ok(rebuildIndex > verifyBranchIndex);
  assert.ok(runChildIndex > rebuildIndex);
});

test("PostgreSQL pilot bootstrap reports recovered transient application authentication as a warning", () => {
  const source = readFileSync("scripts/postgres-pilot-bootstrap.mjs", "utf8");
  assert.match(source, /transientAuthenticationRecovered/);
  assert.match(source, /Transient application-role authentication propagation recovered on attempt/);
});

test("PostgreSQL pilot role provisioning grants required runtime privileges", () => {
  assert.match(sql, /grant connect on database "vireon_pilot" to "vireon_app";/);
  assert.match(sql, /grant usage on schema public to "vireon_app";/);
  assert.match(sql, /to_regclass\(format\('public.%I', table_name\)\) is not null/);
  assert.match(sql, /execute format\('grant select, insert, update, delete on table public.%I to %I'/);
  assert.match(sql, /execute format\('grant select, insert on table public.%I to %I'/);
  assert.match(sql, /execute format\('grant select on table public.%I to %I'/);
  for (const table of POSTGRES_PILOT_READ_WRITE_TABLES) {
    assert.match(sql, new RegExp(`'${table}'`));
  }
  for (const table of POSTGRES_PILOT_APPEND_ONLY_TABLES) {
    assert.match(sql, new RegExp(`'${table}'`));
  }
  for (const table of POSTGRES_PILOT_READ_ONLY_TABLES) {
    assert.match(sql, new RegExp(`'${table}'`));
  }
  assert.match(sql, /alter default privileges in schema public grant select, insert, update, delete on tables to "vireon_app";/);
  assert.match(sql, /alter default privileges in schema public grant usage, select on sequences to "vireon_app";/);
});

test("PostgreSQL pilot role provisioning does not grant prohibited privileges", () => {
  assert.match(sql, /revoke create on schema public from "vireon_app";/);
  assert.doesNotMatch(sql, /grant all/i);
  assert.doesNotMatch(sql, /grant create on schema/i);
  assert.doesNotMatch(sql, /alter .* owner to "vireon_app"/i);
  assert.doesNotMatch(sql, /grant .* to "vireon_app" with grant option/i);
});

test("PostgreSQL pilot runtime grant reconciliation restores least privilege after migrations", () => {
  const grantSql = reconcilePostgresPilotRuntimeGrantsSql();
  assert.match(grantSql, /revoke all privileges on all tables in schema public from "vireon_app";/);
  assert.match(grantSql, /grant select, insert, update, delete/);
  assert.match(grantSql, /grant select, insert/);
  assert.match(grantSql, /grant select on table/);
  assert.match(grantSql, /grant usage, select on all sequences in schema public to "vireon_app";/);
  assert.doesNotMatch(grantSql, /grant all/i);
  assert.doesNotMatch(grantSql, /grant create on schema/i);
});

test("PostgreSQL pilot runtime object probe includes every required table", () => {
  const probeSql = expectedRuntimeObjectProbeSql();
  for (const table of [...POSTGRES_PILOT_READ_WRITE_TABLES, ...POSTGRES_PILOT_APPEND_ONLY_TABLES, ...POSTGRES_PILOT_READ_ONLY_TABLES]) {
    assert.match(probeSql, new RegExp(`select 1 from public\\."${table}" limit 0;`));
  }
});

test("PostgreSQL pilot pre-migration role verification does not query migration-created runtime tables", () => {
  const source = readFileSync("scripts/postgres-pilot-verify-role.mjs", "utf8");
  assert.equal(source.includes("expectedRuntimeObjectProbeSql"), false);
  assert.equal(source.includes("public.users"), false);
  assert.equal(source.includes("runtimeObjectAccess: \"not checked before migrations\""), true);
});

test("PostgreSQL pilot post-migration verification owns runtime object access checks", () => {
  const source = readFileSync("scripts/postgres-pilot-verify-runtime-access.mjs", "utf8");
  assert.equal(source.includes("expectedRuntimeObjectProbeSql"), true);
  assert.equal(source.includes("POSTGRES PILOT RUNTIME ACCESS"), true);
  assert.equal(source.includes("POST_MIGRATION"), true);
  assert.equal(source.includes("buildApplicationPsqlInvocation"), true);
  assert.equal(source.includes("buildSanitizedPsqlEnvironment"), true);
  assert.equal(source.includes("URL_USERINFO"), false);
  assert.equal(source.includes("schema_migrations checksum verification"), true);
  assert.equal(source.includes("runtime grant matrix"), true);
  assert.equal(source.includes("owner-scoped rls probe"), true);
  assert.equal(source.includes("feature flag mutation denial"), true);
});

test("PostgreSQL pilot preflight does not perform a second application-role authentication", () => {
  const source = readFileSync("scripts/postgres-pilot-preflight.mjs", "utf8");
  assert.equal(source.includes('probeDatabase("application-role-primary"'), false);
  assert.equal(source.includes("VIREON_PILOT_APPLICATION_DATABASE_URL, tooling"), false);
});

test("PostgreSQL pilot bootstrap reports live database process timeline instead of stale auth attempts", () => {
  const source = readFileSync("scripts/postgres-pilot-bootstrap.mjs", "utf8");
  assert.ok(source.includes("databaseProcessTimeline: []"));
  assert.ok(source.includes("recordPlannedDatabaseAttempt(report.databaseProcessTimeline"));
  assert.ok(source.includes("VIREON_PILOT_DB_ATTEMPT_ID"));
  assert.ok(source.includes("VIREON_PILOT_DB_ATTEMPT_PREFIX"));
  assert.equal(source.includes("authenticationAttempts:"), false);
  assert.equal(source.includes("safeAuthAttempt("), false);
});

test("PostgreSQL pilot preflight emits psql attempts for bootstrap timeline correlation", () => {
  const preflightSource = readFileSync("scripts/postgres-pilot-preflight.mjs", "utf8");
  const checksSource = readFileSync("scripts/postgres-pilot-checks.mjs", "utf8");
  assert.ok(preflightSource.includes("databaseProcessTimeline"));
  assert.ok(preflightSource.includes("probes.flatMap((probe) => probe.psqlAttempts || [])"));
  assert.ok(checksSource.includes("psqlAttempts: attempts"));
  assert.ok(checksSource.includes("nextPsqlAttemptId"));
});

test("PostgreSQL pilot migration state classifies pending applied partial and unknown states", () => {
  assert.equal(
    classifyPostgresPilotRuntimeObjectState({ presentRuntimeObjectCount: 0, requiredRuntimeObjectCount: POSTGRES_PILOT_REQUIRED_TABLES.length }),
    "MIGRATIONS_PENDING"
  );
  assert.equal(
    classifyPostgresPilotRuntimeObjectState({ presentRuntimeObjectCount: POSTGRES_PILOT_REQUIRED_TABLES.length, requiredRuntimeObjectCount: POSTGRES_PILOT_REQUIRED_TABLES.length }),
    "MIGRATIONS_APPLIED"
  );
  assert.equal(
    classifyPostgresPilotRuntimeObjectState({ presentRuntimeObjectCount: 4, requiredRuntimeObjectCount: POSTGRES_PILOT_REQUIRED_TABLES.length }),
    "MIGRATIONS_PARTIAL"
  );
  assert.equal(classifyPostgresPilotRuntimeObjectState({ presentRuntimeObjectCount: 0, querySucceeded: false }), "UNKNOWN");
  assert.equal(classifyPostgresPilotMigrationState({ schemaMigrationsExists: false, appliedMigrationIds: [], expectedMigrationIds: ["0001"] }), "EMPTY_DATABASE");
});

test("PostgreSQL pilot runtime object count query uses the canonical required object list", () => {
  const query = requiredRuntimeObjectCountSql();
  for (const table of POSTGRES_PILOT_REQUIRED_TABLES) {
    assert.match(query, new RegExp(`'${table}'`));
  }
});

test("PostgreSQL pilot application URL accepts Supabase session pooler user format", () => {
  const direct = validatePostgresPilotApplicationUrl("postgresql://vireon_app:secret@db.example.com:5432/postgres?sslmode=require");
  assert.equal(direct.ok, true);
  assert.equal(direct.username, POSTGRES_PILOT_APPLICATION_ROLE);

  const pooler = validatePostgresPilotApplicationUrl("postgresql://vireon_app.projectref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require");
  assert.equal(pooler.ok, true);
  assert.equal(pooler.sessionPooler, true);
  assert.equal(pooler.username, "vireon_app.projectref");
  assert.equal(pooler.routedUsernameHasProjectRef, true);
  assert.equal(pooler.routedUsernameProjectRef, "projectref");
});

test("PostgreSQL pilot application URL rejects postgres pooler and non-SSL application users", () => {
  const postgresPooler = validatePostgresPilotApplicationUrl("postgresql://postgres.projectref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require");
  assert.equal(postgresPooler.ok, false);
  assert.match(postgresPooler.reason ?? "", /vireon_app/);

  const noSsl = validatePostgresPilotApplicationUrl("postgresql://vireon_app.projectref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres");
  assert.equal(noSsl.ok, false);
  assert.match(noSsl.reason ?? "", /sslmode/);
});

test("PostgreSQL pilot application URL rejects bare vireon_app on Supabase pooler before authentication", () => {
  const result = validatePostgresPilotApplicationUrl("postgresql://vireon_app:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?SSLMode=require");
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, "APPLICATION_POOLER_USERNAME_NOT_ROUTED");
  assert.equal(result.routedUsernameHasProjectRef, false);

  const preflightStatus = applicationRoleUrlStatus("postgresql://vireon_app:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require");
  assert.equal(preflightStatus.ok, false);
  assert.equal(preflightStatus.statusCode, "APPLICATION_POOLER_USERNAME_NOT_ROUTED");
});

test("PostgreSQL pilot application URL builder uses routed pooler user without embedding password", () => {
  const migrationUrl = "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
  const oldUrl = buildApplicationDatabaseUrl({ migrationDatabaseUrl: migrationUrl, applicationRolePassword: "old secret" });
  const newUrl = buildApplicationDatabaseUrl({ migrationDatabaseUrl: migrationUrl, applicationRolePassword: "new secret" });

  assert.equal(decodeURIComponent(new URL(newUrl).username), "vireon_app.bppepkgndukvggggokzy");
  assert.equal(new URL(oldUrl).password, "");
  assert.equal(new URL(newUrl).password, "");
  assert.equal(oldUrl, newUrl);
  assert.equal(oldUrl.includes("old%20secret"), false);
  assert.equal(newUrl.includes("new%20secret"), false);
});

test("PostgreSQL pilot direct endpoint application URL uses bare vireon_app", () => {
  const url = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres:migration-secret@db.bppepkgndukvggggokzy.supabase.co:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  assert.equal(decodeURIComponent(new URL(url).username), "vireon_app");
});

function createFakePsqlBin(): { binDir: string; markerFile: string; scriptFile: string } {
  const binDir = mkdtempSync(join(tmpdir(), "vireon-fake-psql-"));
  const markerFile = join(binDir, "psql-called.txt");
  const scriptFile = join(binDir, "fake-psql.cjs");
  writeFileSync(scriptFile, `
const fs = require("node:fs");
const marker = ${JSON.stringify(markerFile)};
fs.appendFileSync(marker, JSON.stringify({
  argv: process.argv.slice(2),
  env: {
    PGUSER: process.env.PGUSER || null,
    PGHOST: process.env.PGHOST || null,
    PGPORT: process.env.PGPORT || null,
    PGDATABASE: process.env.PGDATABASE || null,
    PGSERVICE: process.env.PGSERVICE || null,
    PGSERVICEFILE: process.env.PGSERVICEFILE || null,
    PGPASSFILE: process.env.PGPASSFILE || null,
    PGSSLMODE: process.env.PGSSLMODE || null,
    PGPASSWORD: process.env.PGPASSWORD ? "<configured>" : null,
  },
}) + "\\n");
if (process.env.PGPASSWORD === "__vireon_intentionally_wrong_password__") {
  console.error("FATAL: password authentication failed");
  process.exit(2);
}
const commandIndex = process.argv.indexOf("-c");
const sql = commandIndex >= 0 ? process.argv.slice(commandIndex + 1).join(" ") : "";
if (/current_user/i.test(sql)) {
  const transientFailures = Number(process.env.VIREON_FAKE_PSQL_TRANSIENT_AUTH_FAILURES_BEFORE_SUCCESS || "0");
  const countFile = marker + ".count";
  const currentCount = fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, "utf8") || "0") : 0;
  if (transientFailures > 0) fs.writeFileSync(countFile, String(currentCount + 1), "utf8");
  if (currentCount < transientFailures) {
    console.error('FATAL: password authentication failed for user "vireon_app"');
    process.exit(2);
  }
  if (process.env.VIREON_FAKE_PSQL_PERMISSION_FAILURE === "true") {
    console.error("ERROR: permission denied for schema public");
    process.exit(1);
  }
  console.log("identity|vireon_app|vireon_app");
  console.log("flags|false|false|false|false");
  console.log("ssl|on");
  console.log("schemaUsage|true");
  console.log("createRoleBlocked|true");
  console.log("createSchemaBlocked|true");
  process.exit(0);
}
if (/from pg_roles/i.test(sql)) {
  console.log("false|false|false|false");
  process.exit(0);
}
if (/show ssl/i.test(sql)) {
  console.log("on");
  process.exit(0);
}
if (/has_schema_privilege/i.test(sql)) {
  console.log("true");
  process.exit(0);
}
if (/create role|create schema/i.test(sql)) {
  console.error("permission denied");
  process.exit(1);
}
console.log("ok");
`, "utf8");
  if (process.platform === "win32") {
    writeFileSync(join(binDir, "psql.cmd"), `@echo off\r\n"${process.execPath}" "%~dp0fake-psql.cjs" %*\r\n`, "utf8");
  } else {
    writeFileSync(join(binDir, "psql"), `#!/usr/bin/env sh\n"${process.execPath}" "$(dirname "$0")/fake-psql.cjs" "$@"\n`, { mode: 0o755 });
  }
  return { binDir, markerFile, scriptFile };
}

function createFakeRuntimePsqlBin(): { binDir: string; markerFile: string; scriptFile: string } {
  const binDir = mkdtempSync(join(tmpdir(), "vireon-fake-runtime-psql-"));
  const markerFile = join(binDir, "psql-called.txt");
  const scriptFile = join(binDir, "fake-runtime-psql.cjs");
  writeFileSync(scriptFile, `
const fs = require("node:fs");
const marker = ${JSON.stringify(markerFile)};
fs.appendFileSync(marker, JSON.stringify({
  argv: process.argv.slice(2),
  env: {
    PGSSLMODE: process.env.PGSSLMODE || null,
    PGPASSWORD: process.env.PGPASSWORD ? "<configured>" : null,
    PGUSER: process.env.PGUSER || null,
    PGSERVICE: process.env.PGSERVICE || null,
    PGPASSFILE: process.env.PGPASSFILE || null,
  },
}) + "\\n");
const countFile = marker + ".count";
const currentCount = fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, "utf8") || "0") : 0;
fs.writeFileSync(countFile, String(currentCount + 1), "utf8");
const commandIndex = process.argv.indexOf("-c");
const sql = commandIndex >= 0 ? process.argv.slice(commandIndex + 1).join(" ") : "";
const transientFailures = Number(process.env.VIREON_FAKE_PSQL_TRANSIENT_AUTH_FAILURES_BEFORE_SUCCESS || "0");
if (currentCount < transientFailures) {
  console.error('FATAL: password authentication failed for user "vireon_app"');
  process.exit(2);
}
if (process.env.VIREON_FAKE_PSQL_PERMISSION_FAILURE === "true") {
  console.error("ERROR: permission denied for schema public");
  process.exit(1);
}
if (process.env.VIREON_FAKE_PSQL_MISSING_OBJECT === "true" && /select 1 from public/i.test(sql)) {
  console.error('ERROR: relation "public.users" does not exist');
  process.exit(1);
}
if (/select 1 from public/i.test(sql)) {
  process.exit(0);
}
if (/to_regclass\\(format\\('public.%I', name\\)\\) is null/i.test(sql)) {
  process.exit(0);
}
if (/schema_migrations/i.test(sql) && /mismatches/i.test(sql)) {
  process.exit(0);
}
if (/has_table_privilege/i.test(sql)) {
  process.exit(0);
}
if (/information_schema\\.sequences/i.test(sql)) {
  console.log("true|3");
  process.exit(0);
}
if (/from pg_roles/i.test(sql)) {
  console.log("false|false|false|false");
  process.exit(0);
}
if (/relrowsecurity/i.test(sql) || /relforcerowsecurity/i.test(sql)) {
  process.exit(0);
}
if (/ownerVisible/i.test(sql)) {
  console.log("ownerVisible|1");
  console.log("crossUserVisible|0");
  process.exit(0);
}
if (/auditInserted/i.test(sql)) {
  console.log("auditInserted|1");
  process.exit(0);
}
if (/update public\\.private_beta_audit_events/i.test(sql) || /update public\\.private_beta_feature_flags/i.test(sql)) {
  console.error("ERROR: permission denied for table");
  process.exit(1);
}
if (/protectedSchemaBlocked/i.test(sql)) {
  console.log("protectedSchemaBlocked|true");
  process.exit(0);
}
console.log("ok");
`, "utf8");
  if (process.platform === "win32") {
    writeFileSync(join(binDir, "psql.cmd"), `@echo off\r\n"${process.execPath}" "%~dp0fake-runtime-psql.cjs" %*\r\n`, "utf8");
  } else {
    writeFileSync(join(binDir, "psql"), `#!/usr/bin/env sh\n"${process.execPath}" "$(dirname "$0")/fake-runtime-psql.cjs" "$@"\n`, { mode: 0o755 });
  }
  return { binDir, markerFile, scriptFile };
}

function runFakeRuntimeVerifier(extraEnv: Record<string, string> = {}) {
  const fake = createFakeRuntimePsqlBin();
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bhnwokrddsacmgbpgzze:restore-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-runtime-access.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_TEST_AUTH_RETRY_DELAYS_MS: "0,0,0,0,0",
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
        ...extraEnv,
      },
      timeout: 20_000,
    }
  );
  return { result, fake, applicationUrl };
}

test("PostgreSQL pilot verify-role fails bare pooler username before invoking psql", () => {
  const fake = createFakePsqlBin();
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: "postgresql://vireon_app:application-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
      },
      timeout: 20_000,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.ok(output.includes("APPLICATION_POOLER_EFFECTIVE_USERNAME_NOT_ROUTED"));
  assert.equal(existsSync(fake.markerFile), false);
  assert.equal(output.includes("application-secret"), false);
  assert.equal(output.includes("postgresql://"), false);
});

test("PostgreSQL pilot verify-role child process uses explicit routed pooler psql arguments", () => {
  const fake = createFakePsqlBin();
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
        PGUSER: "vireon_app",
        PGSERVICE: "conflicting-service",
        PGPASSFILE: join(fake.binDir, "conflicting-pgpass"),
      },
      timeout: 20_000,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0);
  assert.ok(existsSync(fake.markerFile));
  assert.ok(output.includes("\"routedUsernameHasProjectRef\": true"));
  assert.ok(output.includes("\"routedUsernameProjectRef\": \"bppepkgndukvggggokzy\""));
  assert.ok(output.includes("\"applicationUrlSource\": \"VIREON_PILOT_APPLICATION_DATABASE_URL\""));
  assert.ok(output.includes("\"connectionStyle\": \"EXPLICIT_FLAGS\""));
  assert.ok(output.includes("\"effectiveUsername\": \"vireon_app.bppepkgndukvggggokzy\""));
  assert.ok(output.includes("\"connectionTargetContainsPassword\": false"));
  assert.ok(output.includes("\"passwordInCommandArguments\": false"));
  assert.ok(output.includes("\"passwordEnvironmentConfigured\": true"));
  assert.ok(output.includes("\"effectiveInvocation\""));
  assert.ok(output.includes("\"executableResolution\""));
  assert.ok(output.includes("\"stdoutBytes\""));
  assert.ok(output.includes("\"stderrBytes\""));
  assert.equal(output.includes("application-secret"), false);
  assert.equal(output.includes("migration-secret"), false);
  assert.equal(output.includes("postgresql://"), false);
  const records = readFileSync(fake.markerFile, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
  const first = records[0];
  assert.deepEqual(first.argv.slice(0, 14), [
    "-X",
    "-w",
    "-h",
    "aws-0-ap-southeast-2.pooler.supabase.com",
    "-p",
    "5432",
    "-U",
    "vireon_app.bppepkgndukvggggokzy",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
  ]);
  assert.equal(first.argv.includes("--no-password"), false);
  assert.equal(first.argv.includes("sslmode=require"), false);
  assert.equal(first.argv.join(" ").includes("postgresql://"), false);
  assert.equal(first.argv.join(" ").includes("application-secret"), false);
  assert.equal(first.env.PGPASSWORD, "<configured>");
  assert.equal(first.env.PGSSLMODE, "require");
  assert.equal(first.env.PGUSER, null);
  assert.equal(first.env.PGSERVICE, null);
  assert.equal(first.env.PGPASSFILE, null);
});

test("PostgreSQL pilot application URL round-trips special-character passwords without double encoding", () => {
  const passwords = [
    "pa@ss",
    "pa:ss",
    "pa/ss",
    "pa?ss",
    "pa#ss",
    "pa%ss",
    "pa!ss",
    "pa ss",
    "paß字ss",
    " @:/?#%!ß ",
  ];
  const migrationUrl = "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
  for (const applicationRolePassword of passwords) {
    const url = buildApplicationDatabaseUrl({ migrationDatabaseUrl: migrationUrl, applicationRolePassword });
    assert.equal(decodeUrlPassword(url), null);
    assert.equal(new URL(url).password, "");
    const encodedOnce = encodeURIComponent(applicationRolePassword);
    const encodedTwice = encodeURIComponent(encodedOnce);
    assert.equal(url.includes(encodedOnce), false);
    if (encodedOnce !== encodedTwice) assert.equal(url.includes(encodedTwice), false);
    assert.equal(buildApplicationDatabaseUrl({ migrationDatabaseUrl: url, applicationRolePassword }), url);
  }
});

test("PostgreSQL pilot password diagnostics match provisioning URL and verifier fingerprints", () => {
  const password = "complex @:/?#%!ß password";
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: password,
  });
  const diagnostics = buildApplicationCredentialDiagnostics({
    provisioningPassword: password,
    applicationUrl,
    verifierPassword: password,
  });
  assert.equal(diagnostics.fingerprintsMatch, true);
  assert.equal(diagnostics.provisioningPassword.passwordFingerprint, passwordFingerprint(password));
  assert.equal(diagnostics.applicationUrlPassword.passwordFingerprint, null);
  assert.equal(diagnostics.verifierPassword.passwordFingerprint, passwordFingerprint(password));
  assert.equal(diagnostics.applicationUrlContainsPassword, false);
  assert.equal(diagnostics.credentialTransportContradiction, false);
  assert.equal(diagnostics.verifierPassword.passwordContainsAt, true);
  assert.equal(diagnostics.verifierPassword.passwordContainsColon, true);
  assert.equal(diagnostics.verifierPassword.passwordContainsSlash, true);
  assert.equal(diagnostics.verifierPassword.passwordContainsQuestionMark, true);
  assert.equal(diagnostics.verifierPassword.passwordContainsHash, true);
  assert.equal(diagnostics.verifierPassword.passwordContainsPercent, true);
  assert.equal(diagnostics.verifierPassword.passwordContainsBang, true);
  assert.equal(diagnostics.verifierPassword.passwordContainsSpace, true);
  assert.equal(diagnostics.verifierPassword.passwordContainsUnicode, true);
});

test("PostgreSQL pilot password diagnostics expose mismatches without secrets", () => {
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "provision-password",
  });
  const diagnostics = buildApplicationCredentialDiagnostics({
    provisioningPassword: "provision-password",
    applicationUrl,
    verifierPassword: "verifier-password",
  });
  const output = JSON.stringify(diagnostics);
  assert.equal(diagnostics.fingerprintsMatch, false);
  assert.equal(diagnostics.applicationUrlContainsPassword, false);
  assert.equal(output.includes("url-password"), false);
  assert.equal(output.includes("provision-password"), false);
  assert.equal(output.includes("verifier-password"), false);
});

test("PostgreSQL pilot password diagnostics flag embedded application URL credentials as a transport contradiction", () => {
  const diagnostics = buildApplicationCredentialDiagnostics({
    provisioningPassword: "application-secret",
    applicationUrl: "postgresql://vireon_app.bppepkgndukvggggokzy:application-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    verifierPassword: "application-secret",
  });
  const output = JSON.stringify(diagnostics);
  assert.equal(diagnostics.credentialTransport, "PGPASSWORD");
  assert.equal(diagnostics.applicationUrlContainsPassword, true);
  assert.equal(diagnostics.credentialTransportContradiction, true);
  assert.equal(output.includes("application-secret"), false);
});

test("PostgreSQL pilot verifier uses explicit flags with PGPASSWORD transport", () => {
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const invocation = buildApplicationPsqlInvocation({
    applicationUrl,
    password: "application-secret",
  });
  const env = buildSanitizedPsqlEnvironment({
    baseEnv: {
      PGUSER: "wrong-user",
      PGSERVICE: "wrong-service",
      PGPASSFILE: "wrong-passfile",
    },
    password: "application-secret",
    sslMode: invocation.sslMode,
  });
  assert.equal(invocation.ok, true);
  assert.equal(invocation.connectionUsername, "vireon_app.bppepkgndukvggggokzy");
  assert.equal(invocation.baseArgs.includes("-U"), true);
  assert.equal(invocation.baseArgs[invocation.baseArgs.indexOf("-U") + 1], "vireon_app.bppepkgndukvggggokzy");
  assert.equal(invocation.baseArgs.join(" ").includes("postgresql://"), false);
  assert.equal(invocation.baseArgs.join(" ").includes("application-secret"), false);
  assert.equal(invocation.diagnostics.connectionTargetContainsPassword, false);
  assert.equal(invocation.diagnostics.passwordInCommandArguments, false);
  assert.equal(env.PGPASSWORD, "application-secret");
  assert.equal(env.PGSSLMODE, "require");
  assert.equal(env.PGUSER, undefined);
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.PGPASSFILE, undefined);
});

test("PostgreSQL pilot verify-role diagnostic repro script contains the effective command without secrets", () => {
  const fake = createFakePsqlBin();
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_WRITE_PSQL_REPRO_SCRIPT: "true",
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
      },
      timeout: 20_000,
    }
  );
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  const scriptPath = parsed.psqlInvocationEvidence.reproScriptPath;
  assert.ok(scriptPath);
  const script = readFileSync(scriptPath, "utf8");
  assert.match(script, /\$env:PGPASSWORD = \[Text\.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String/);
  assert.equal(script.includes("VIREON_PILOT_APPLICATION_ROLE_PASSWORD"), false);
  assert.match(script, /'-U' 'vireon_app\.bppepkgndukvggggokzy'/);
  assert.match(script, /'-X' '-w'/);
  assert.equal(script.includes("application-secret"), false);
  assert.equal(script.includes("postgresql://"), false);
});

test("PostgreSQL pilot verify-role bad-password diagnostic uses the same invocation path", () => {
  const fake = createFakePsqlBin();
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_DIAGNOSTIC_FORCE_BAD_PASSWORD: "true",
        VIREON_PILOT_TEST_AUTH_RETRY_DELAYS_MS: "0,0,0,0,0",
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
      },
      timeout: 20_000,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.ok(output.includes("APPLICATION_ROLE_PASSWORD_VERIFICATION_FAILED"));
  assert.ok(output.includes("\"forcedBadPasswordDiagnostic\": true"));
  assert.ok(output.includes("\"effectiveUsername\": \"vireon_app.bppepkgndukvggggokzy\""));
  assert.ok(output.includes("\"psqlExitStatus\": 2"));
  assert.equal(output.includes("application-secret"), false);
  assert.equal(output.includes("__vireon_intentionally_wrong_password__"), false);
  assert.equal(output.includes("postgresql://"), false);
});

test("PostgreSQL pilot transient application-role auth classifier is narrow", () => {
  assert.equal(
    classifyTransientApplicationRoleAuthenticationFailure({ stderr: 'FATAL: password authentication failed for user "vireon_app"' }),
    "PASSWORD_AUTHENTICATION_PROPAGATION"
  );
  assert.equal(
    classifyTransientApplicationRoleAuthenticationFailure({ stderr: "server closed the connection unexpectedly" }),
    "CONNECTION_RESET"
  );
  assert.equal(
    classifyTransientApplicationRoleAuthenticationFailure({ stderr: "connection timed out" }),
    "CONNECTION_TIMEOUT"
  );
  assert.equal(
    classifyTransientApplicationRoleAuthenticationFailure({ stderr: "temporary pooler tenant routing failure" }),
    "TEMPORARY_POOLER_OR_TENANT_ROUTING"
  );
  assert.equal(
    classifyTransientApplicationRoleAuthenticationFailure({ stderr: "ERROR: permission denied for schema public" }),
    null
  );
});

test("PostgreSQL pilot verify-role records immediate authentication success without retry warning", () => {
  const fake = createFakePsqlBin();
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
      },
      timeout: 20_000,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0);
  assert.ok(output.includes("\"transientAuthenticationRecovered\": false"));
  assert.ok(output.includes("\"successfulAttemptNumber\": 1"));
  assert.equal(output.includes("application-secret"), false);
});

test("PostgreSQL pilot verify-role retries transient authentication failure then succeeds", () => {
  const fake = createFakePsqlBin();
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_TEST_AUTH_RETRY_DELAYS_MS: "0,0,0,0,0",
        VIREON_FAKE_PSQL_TRANSIENT_AUTH_FAILURES_BEFORE_SUCCESS: "2",
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
      },
      timeout: 20_000,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0);
  assert.ok(output.includes("\"transientAuthenticationRecovered\": true"));
  assert.ok(output.includes("\"successfulAttemptNumber\": 3"));
  assert.ok(output.includes("PASSWORD_AUTHENTICATION_PROPAGATION"));
  assert.equal(output.includes("application-secret"), false);
});

test("PostgreSQL pilot verify-role exhausts transient authentication retries and redacts every attempt", () => {
  const fake = createFakePsqlBin();
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_TEST_AUTH_RETRY_DELAYS_MS: "0,0,0,0,0",
        VIREON_FAKE_PSQL_TRANSIENT_AUTH_FAILURES_BEFORE_SUCCESS: "9",
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
      },
      timeout: 20_000,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.ok(output.includes("APPLICATION_ROLE_PASSWORD_VERIFICATION_FAILED"));
  assert.ok(output.includes("\"exhausted\": true"));
  assert.ok(output.includes("\"attempt\": 5"));
  assert.ok(output.includes("PASSWORD_AUTHENTICATION_PROPAGATION"));
  assert.equal(output.includes("application-secret"), false);
  assert.equal(output.includes("postgresql://"), false);
});

test("PostgreSQL pilot verify-role does not retry non-retryable permission failures", () => {
  const fake = createFakePsqlBin();
  const applicationUrl = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.bppepkgndukvggggokzy:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "application-secret",
  });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "scripts/postgres-pilot-verify-role.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
        Path: `${fake.binDir}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE: "true",
        VIREON_PILOT_PSQL_SCRIPT: fake.scriptFile,
        VIREON_PILOT_TEST_AUTH_RETRY_DELAYS_MS: "0,0,0,0,0",
        VIREON_FAKE_PSQL_PERMISSION_FAILURE: "true",
        VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
        VIREON_PILOT_APPLICATION_DATABASE_URL: applicationUrl,
      },
      timeout: 20_000,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.ok(output.includes("NON_RETRYABLE_APPLICATION_ROLE_VERIFICATION_FAILURE"));
  assert.ok(output.includes("\"attempt\": 1"));
  assert.equal(output.includes("\"attempt\": 2"), false);
  assert.equal(output.includes("application-secret"), false);
});

test("PostgreSQL pilot restored runtime login succeeds immediately", () => {
  const { result } = runFakeRuntimeVerifier();
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0);
  assert.ok(output.includes("POSTGRES PILOT RUNTIME ACCESS VERIFIED"));
  assert.ok(output.includes("\"transientAuthenticationRecovered\": false"));
  assert.ok(output.includes("\"successfulAttemptNumber\": 1"));
  assert.ok(output.includes("\"routedUsernameProjectRef\": \"bhnwokrddsacmgbpgzze\""));
  assert.equal(output.includes("application-secret"), false);
  assert.equal(output.includes("restore-secret"), false);
  assert.equal(output.includes("postgresql://"), false);
});

test("PostgreSQL pilot restored runtime login retries once then succeeds", () => {
  const { result } = runFakeRuntimeVerifier({
    VIREON_FAKE_PSQL_TRANSIENT_AUTH_FAILURES_BEFORE_SUCCESS: "1",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0);
  assert.ok(output.includes("\"transientAuthenticationRecovered\": true"));
  assert.ok(output.includes("\"successfulAttemptNumber\": 2"));
  assert.ok(output.includes("PASSWORD_AUTHENTICATION_PROPAGATION"));
  assert.ok(output.includes("\"effectiveUsername\": \"vireon_app.bhnwokrddsacmgbpgzze\""));
});

test("PostgreSQL pilot restored runtime login retries multiple transient failures then succeeds", () => {
  const { result } = runFakeRuntimeVerifier({
    VIREON_FAKE_PSQL_TRANSIENT_AUTH_FAILURES_BEFORE_SUCCESS: "3",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0);
  assert.ok(output.includes("\"successfulAttemptNumber\": 4"));
  assert.ok(output.includes("\"transientAuthenticationRecovered\": true"));
});

test("PostgreSQL pilot restored runtime login fails closed after transient retries are exhausted", () => {
  const { result } = runFakeRuntimeVerifier({
    VIREON_FAKE_PSQL_TRANSIENT_AUTH_FAILURES_BEFORE_SUCCESS: "9",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.ok(output.includes("POSTGRES_PILOT_RUNTIME_ACCESS_BLOCKED"));
  assert.ok(output.includes("\"exhausted\": true"));
  assert.ok(output.includes("\"attempt\": 5"));
  assert.equal(output.includes("application-secret"), false);
  assert.equal(output.includes("postgresql://"), false);
});

test("PostgreSQL pilot restored runtime permission failure is not retried", () => {
  const { result } = runFakeRuntimeVerifier({
    VIREON_FAKE_PSQL_PERMISSION_FAILURE: "true",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.ok(output.includes("NON_RETRYABLE_APPLICATION_ROLE_VERIFICATION_FAILURE"));
  assert.ok(output.includes("\"attempt\": 1"));
  assert.equal(output.includes("\"attempt\": 2"), false);
});

test("PostgreSQL pilot restored runtime missing object failure is not retried", () => {
  const { result } = runFakeRuntimeVerifier({
    VIREON_FAKE_PSQL_MISSING_OBJECT: "true",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.ok(output.includes("relation"));
  assert.ok(output.includes("NON_RETRYABLE_APPLICATION_ROLE_VERIFICATION_FAILURE"));
  assert.equal(output.includes("\"attempt\": 2"), false);
});

test("PostgreSQL pilot wrong identity output is not classified for transient retry", () => {
  assert.equal(classifyTransientApplicationRoleAuthenticationFailure({ stdout: "identity|postgres|postgres" }), null);
});

test("PostgreSQL pilot preflight blocks application URLs that do not use vireon_app", () => {
  const appRole = applicationRoleUrlStatus("postgresql://postgres.projectref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require");
  assert.equal(appRole.ok, false);

  const result = evaluatePreflight({
    env: {
      VIREON_PILOT_DATABASE_URL: { exists: true },
      VIREON_PILOT_RESTORE_DATABASE_URL: { exists: true },
      VIREON_PILOT_MIGRATION_DATABASE_URL: { exists: true },
      VIREON_PILOT_APPLICATION_DATABASE_URL: { exists: true, applicationRole: appRole },
      VIREON_PERSISTENCE_MODE: "postgres-required",
      VIREON_ENVIRONMENT: "postgres-pilot-non-production",
      VIREON_SYNTHETIC_DATA_ONLY: "true",
      VIREON_REQUIRE_SSL: "true",
    },
    tooling: {
      psql: { available: true },
      pg_dump: { available: true },
      pg_restore: { available: true },
    },
    probes: [],
  });

  assert.equal(result.ready, false);
  assert.ok(result.blocked.some((item) => item.includes("VIREON_PILOT_APPLICATION_DATABASE_URL must use Supabase pooler user vireon_app.<project-ref>")));
});

test("PostgreSQL pilot preflight uses canonical target and environment classification", () => {
  const primaryUrl = "postgresql://postgres.bppepkgndukvggggokzy:primary-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
  const restoreUrl = "postgresql://postgres.bhnwokrddsacmgbpgzze:restore-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
  const pilotTargets = validatePilotTargets({
    primaryUrl,
    restoreUrl,
    environment: "postgres-pilot-non-production",
    syntheticDataOnly: "true",
    requireSsl: "true",
    persistenceMode: "postgres-required",
  });
  const result = evaluatePreflight({
    env: {
      VIREON_PILOT_DATABASE_URL: { exists: true },
      VIREON_PILOT_RESTORE_DATABASE_URL: { exists: true },
      VIREON_PILOT_MIGRATION_DATABASE_URL: { exists: true },
      VIREON_PILOT_APPLICATION_DATABASE_URL: {
        exists: true,
        applicationRole: applicationRoleUrlStatus(
          "postgresql://vireon_app.bppepkgndukvggggokzy:application-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?SSLMode=require"
        ),
      },
      VIREON_PERSISTENCE_MODE: "postgres-required",
      VIREON_ENVIRONMENT: "postgres-pilot-non-production",
      VIREON_SYNTHETIC_DATA_ONLY: "true",
      VIREON_REQUIRE_SSL: "true",
      pilotTargets,
    },
    tooling: {
      psql: { available: true },
      pg_dump: { available: true },
      pg_restore: { available: true },
    },
    probes: [
      { label: "primary", reachable: true, ssl: "on" },
      { label: "restore", reachable: true, ssl: "on" },
      { label: "application", reachable: true, ssl: "on", roleFlags: "false|false|false|false" },
    ],
  });

  assert.equal(pilotTargets.ok, true);
  assert.equal(result.ready, true);
  assert.equal(result.diagnostics.sameProject, false);
  assert.equal(result.diagnostics.sameLogicalDatabase, false);
  assert.equal(result.diagnostics.environmentClassification, "POSTGRES_PILOT_NON_PRODUCTION");
  assert.equal(JSON.stringify(result).includes("primary-secret"), false);
  assert.equal(JSON.stringify(result).includes("restore-secret"), false);
  assert.equal(JSON.stringify(result).includes("application-secret"), false);
});
