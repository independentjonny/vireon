import { spawnSync } from "node:child_process";
import {
  buildApplicationCredentialDiagnostics,
  buildApplicationPsqlInvocation,
  buildSanitizedPsqlEnvironment,
  inspectApplicationConnectionTarget,
} from "../src/lib/postgresPilotBootstrap.ts";
import {
  POSTGRES_PILOT_APPEND_ONLY_TABLES,
  POSTGRES_PILOT_APPLICATION_ROLE,
  POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  POSTGRES_PILOT_READ_ONLY_TABLES,
  POSTGRES_PILOT_READ_WRITE_TABLES,
  expectedRuntimeObjectProbeSql,
  requiredRuntimeObjectList,
  restrictedRoleFlagSql,
  runPostgresPilotApplicationAuthenticationRetry,
} from "../src/lib/postgresPilotRoleProvisioning.ts";
import { createMigrationManifest } from "../src/lib/postgresPilotCompletion.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";

function redact(value) {
  return redactPostgresPilotText(value, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]);
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function valuesList(rows) {
  return rows.map((row) => `(${row.map((value) => typeof value === "boolean" ? String(value) : quoteLiteral(value)).join(", ")})`).join(", ");
}

function runtimePrivilegeExpectations() {
  const rows = [];
  for (const table of POSTGRES_PILOT_READ_WRITE_TABLES) {
    for (const privilege of ["select", "insert", "update", "delete"]) rows.push([table, privilege, true]);
  }
  for (const table of POSTGRES_PILOT_APPEND_ONLY_TABLES) {
    rows.push([table, "select", true], [table, "insert", true], [table, "update", false], [table, "delete", false]);
  }
  for (const table of POSTGRES_PILOT_READ_ONLY_TABLES) {
    rows.push([table, "select", true], [table, "insert", false], [table, "update", false], [table, "delete", false]);
  }
  return rows;
}

function rlsDesignedTables() {
  return [
    ...POSTGRES_PILOT_READ_WRITE_TABLES.filter((table) => table !== "users"),
    ...POSTGRES_PILOT_APPEND_ONLY_TABLES,
    "private_beta_feature_flags",
  ];
}

function forcedRlsDesignedTables() {
  return [
    "private_beta_onboarding",
    "private_beta_feedback",
    "private_beta_deletion_requests",
    "private_beta_audit_events",
    "private_beta_feature_flags",
  ];
}

function runPsql(invocation, sql, env, label, timeout = 30_000) {
  const usePsqlScript = process.env.VIREON_PILOT_ALLOW_PSQL_SCRIPT_OVERRIDE === "true" && Boolean(process.env.VIREON_PILOT_PSQL_SCRIPT);
  const psqlCommand = usePsqlScript ? process.execPath : invocation.psqlExecutable;
  const args = [
    ...(usePsqlScript ? [process.env.VIREON_PILOT_PSQL_SCRIPT] : []),
    ...invocation.baseArgs,
    "-c",
    sql,
  ];
  const effectiveEnv = { ...env };
  if (usePsqlScript) {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("VIREON_FAKE_PSQL_") && value != null) effectiveEnv[key] = value;
    }
  }
  const result = spawnSync(psqlCommand, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    env: effectiveEnv,
    shell: false,
    windowsHide: true,
  });
  return {
    label,
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: redact(result.stderr || result.stdout || ""),
    status: result.status,
    process: {
      stage: label,
      caller: "scripts/postgres-pilot-verify-runtime-access.mjs",
      executable: psqlCommand,
      argv: [...invocation.diagnostics.commandArgumentsRedacted],
      username: invocation.connectionUsername,
      host: invocation.host,
      database: invocation.database,
      credentialSource: "PGPASSWORD",
      connectionMode: invocation.connectionMode,
      timestamp: new Date().toISOString(),
    },
  };
}

function fail(message, details = {}) {
  console.error(stringifyPostgresPilotReport({ ok: false, status: "POSTGRES PILOT RUNTIME ACCESS BLOCKED", message, ...details }, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]));
  process.exit(1);
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

const applicationUrl = process.env.VIREON_PILOT_APPLICATION_DATABASE_URL;
const verifierPassword = process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV];
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
  provisioningPasswordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  runtimeVerifierPasswordEnvName: POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV,
  passwordSource: "environment",
  provisioningPasswordFingerprint: credentialDiagnostics.provisioningPassword.passwordFingerprint,
  verifierPasswordFingerprint: credentialDiagnostics.verifierPassword.passwordFingerprint,
  passwordFingerprintsMatch: credentialDiagnostics.fingerprintsMatch,
  applicationUrlContainsPassword: credentialDiagnostics.applicationUrlContainsPassword,
  credentialTransportContradiction: credentialDiagnostics.credentialTransportContradiction,
  effectiveInvocation: invocation.diagnostics,
};

if (!applicationUrl) fail("missing VIREON_PILOT_APPLICATION_DATABASE_URL");
if (!verifierPassword) fail(`missing ${POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV}`, { applicationDiagnostics });
if (!applicationTarget.ok) fail(applicationTarget.reason || "invalid application database URL", { applicationDiagnostics });
if (credentialDiagnostics.credentialTransportContradiction) {
  fail("application URL contains embedded credentials while runtime verifier uses PGPASSWORD", {
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

const psqlEnv = buildSanitizedPsqlEnvironment({
  baseEnv: process.env,
  password: verifierPassword,
  sslMode: invocation.sslMode,
});
const timeline = [];
const provisionedAtMs = Number(process.env.VIREON_PILOT_ROLE_PROVISIONED_AT_MS || "");

const objectAccess = runPostgresPilotApplicationAuthenticationRetry({
  provisionedAtMs,
  delaysMs: retryDelaysMs(),
  runAttempt: () => {
    const result = runPsql(invocation, expectedRuntimeObjectProbeSql(), psqlEnv, "runtime object access");
    return {
      ...result,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  },
});
timeline.push(objectAccess.process);
if (!objectAccess.ok) fail("application role cannot access required Vireon runtime objects", {
  statusCode: "POSTGRES_PILOT_RUNTIME_ACCESS_BLOCKED",
  stderr: objectAccess.stderr,
  applicationDiagnostics,
  authenticationRetry: objectAccess.authenticationRetry,
  databaseProcessTimeline: timeline,
});

const missingObjects = runPsql(
  invocation,
  [
    "with required(name) as (",
    requiredRuntimeObjectList().map((table) => `select ${quoteLiteral(table)}`).join(" union all "),
    ")",
    "select coalesce(string_agg(name, ',' order by name), '')",
    "from required",
    "where to_regclass(format('public.%I', name)) is null;",
  ].join(" "),
  psqlEnv,
  "required runtime object metadata"
);
timeline.push(missingObjects.process);
if (!missingObjects.ok) fail("required runtime object metadata could not be inspected", { stderr: missingObjects.stderr, databaseProcessTimeline: timeline });
if (missingObjects.stdout) fail("required runtime objects are missing", { missingObjects: missingObjects.stdout.split(","), databaseProcessTimeline: timeline });

const manifest = createMigrationManifest();
const migrationSql = [
  "with expected(id, checksum) as (values",
  valuesList(manifest.map((item) => [item.id, item.checksum])),
  "), mismatches as (",
  "  select e.id",
  "  from expected e",
  "  left join schema_migrations s on s.id = e.id",
  "  where s.id is null or s.success is not true or s.checksum <> e.checksum",
  ")",
  "select coalesce(string_agg(id, ',' order by id), '') from mismatches;",
].join(" ");
const migrationRows = runPsql(invocation, migrationSql, psqlEnv, "schema_migrations checksum verification");
timeline.push(migrationRows.process);
if (!migrationRows.ok) fail("schema_migrations could not be verified", { stderr: migrationRows.stderr, databaseProcessTimeline: timeline });
if (migrationRows.stdout) fail("schema_migrations does not contain the expected successful migration set", { mismatches: migrationRows.stdout.split(","), databaseProcessTimeline: timeline });

const privilegeRows = runtimePrivilegeExpectations();
const privilegeCheck = runPsql(
  invocation,
  [
    "with expected(name, privilege, allowed) as (values",
    valuesList(privilegeRows),
    "), actual as (",
    "  select name, privilege, allowed, has_table_privilege(current_user, format('public.%I', name), privilege) as actual_allowed",
    "  from expected",
    ")",
    "select coalesce(string_agg(name || ':' || privilege || ':' || actual_allowed::text || '!=' || allowed::text, ',' order by name, privilege), '')",
    "from actual where actual_allowed <> allowed;",
  ].join(" "),
  psqlEnv,
  "runtime grant matrix"
);
timeline.push(privilegeCheck.process);
if (!privilegeCheck.ok) fail("runtime grant matrix could not be verified", { stderr: privilegeCheck.stderr, databaseProcessTimeline: timeline });
if (privilegeCheck.stdout) fail("runtime grants do not match the least-privilege matrix", { mismatches: privilegeCheck.stdout.split(","), databaseProcessTimeline: timeline });

const sequenceAccess = runPsql(
  invocation,
  "select coalesce(bool_and(has_sequence_privilege(current_user, format('%I.%I', sequence_schema, sequence_name), 'usage') and has_sequence_privilege(current_user, format('%I.%I', sequence_schema, sequence_name), 'select')), true)::text || '|' || count(*)::text from information_schema.sequences where sequence_schema = 'public';",
  psqlEnv,
  "sequence privilege verification"
);
timeline.push(sequenceAccess.process);
if (!sequenceAccess.ok) fail("application role cannot inspect public sequence metadata", { stderr: sequenceAccess.stderr, databaseProcessTimeline: timeline });
const [sequencePrivilegesOk, sequenceCount] = sequenceAccess.stdout.split("|");
if (sequencePrivilegesOk !== "true") fail("application role lacks required sequence privileges", { sequenceAccess: sequenceAccess.stdout, databaseProcessTimeline: timeline });

const flags = runPsql(invocation, restrictedRoleFlagSql(POSTGRES_PILOT_APPLICATION_ROLE), psqlEnv, "restricted role flags");
timeline.push(flags.process);
if (!flags.ok) fail("application role flags could not be verified", { stderr: flags.stderr, databaseProcessTimeline: timeline });
if (flags.stdout !== "false|false|false|false") fail("application role has prohibited administrative flags", { roleFlags: flags.stdout, databaseProcessTimeline: timeline });

const rlsEnabled = runPsql(
  invocation,
  [
    "with required(name) as (values",
    valuesList(rlsDesignedTables().map((table) => [table])),
    ")",
    "select coalesce(string_agg(r.name, ',' order by r.name), '')",
    "from required r",
    "left join pg_class c on c.oid = to_regclass(format('public.%I', r.name))",
    "where c.oid is null or c.relrowsecurity is not true;",
  ].join(" "),
  psqlEnv,
  "rls enabled verification"
);
timeline.push(rlsEnabled.process);
if (!rlsEnabled.ok) fail("RLS status could not be inspected", { stderr: rlsEnabled.stderr, databaseProcessTimeline: timeline });
if (rlsEnabled.stdout) fail("expected RLS-enabled tables are missing RLS", { tables: rlsEnabled.stdout.split(","), databaseProcessTimeline: timeline });

const rlsForced = runPsql(
  invocation,
  [
    "with required(name) as (values",
    valuesList(forcedRlsDesignedTables().map((table) => [table])),
    ")",
    "select coalesce(string_agg(r.name, ',' order by r.name), '')",
    "from required r",
    "left join pg_class c on c.oid = to_regclass(format('public.%I', r.name))",
    "where c.oid is null or c.relforcerowsecurity is not true;",
  ].join(" "),
  psqlEnv,
  "forced rls verification"
);
timeline.push(rlsForced.process);
if (!rlsForced.ok) fail("forced RLS status could not be inspected", { stderr: rlsForced.stderr, databaseProcessTimeline: timeline });
if (rlsForced.stdout) fail("expected force-RLS tables are not forced", { tables: rlsForced.stdout.split(","), databaseProcessTimeline: timeline });

const ownershipProbe = runPsql(
  invocation,
  [
    "begin;",
    "set local app.current_user_id = 'pilot-runtime-user-a';",
    "insert into private_beta_onboarding (id, user_id, household_id, version, steps, current_step, consent, missing_information)",
    "values ('runtime-rls-probe-a', 'pilot-runtime-user-a', 'pilot-runtime-household-a', 'runtime-test', '[]'::jsonb, 'welcome', '{}'::jsonb, '[]'::jsonb);",
    "select 'ownerVisible|' || count(*)::text from private_beta_onboarding where id = 'runtime-rls-probe-a';",
    "set local app.current_user_id = 'pilot-runtime-user-b';",
    "select 'crossUserVisible|' || count(*)::text from private_beta_onboarding where id = 'runtime-rls-probe-a';",
    "rollback;",
  ].join("\n"),
  psqlEnv,
  "owner-scoped rls probe"
);
timeline.push(ownershipProbe.process);
if (!ownershipProbe.ok) fail("owner-scoped RLS probe failed", { stderr: ownershipProbe.stderr, databaseProcessTimeline: timeline });
const ownerRows = Object.fromEntries(ownershipProbe.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
  const [key, value] = line.split("|");
  return [key, value];
}));
if (ownerRows.ownerVisible !== "1" || ownerRows.crossUserVisible !== "0") {
  fail("owner-scoped RLS probe did not isolate synthetic users", { ownerRows, databaseProcessTimeline: timeline });
}

const auditAppend = runPsql(
  invocation,
  [
    "begin;",
    "set local app.current_user_id = 'pilot-runtime-user-a';",
    "insert into private_beta_audit_events (id, user_id, household_id, event_type, actor, timestamp, affected_resource, outcome, reference_id, safe_metadata)",
    "values ('runtime-audit-probe-a', 'pilot-runtime-user-a', 'pilot-runtime-household-a', 'runtime_probe', 'system', now(), 'runtime', 'success', 'runtime-ref', '{}'::jsonb);",
    "select 'auditInserted|' || count(*)::text from private_beta_audit_events where id = 'runtime-audit-probe-a';",
    "rollback;",
  ].join("\n"),
  psqlEnv,
  "append-only audit insert probe"
);
timeline.push(auditAppend.process);
if (!auditAppend.ok || !auditAppend.stdout.includes("auditInserted|1")) fail("append-only audit insert probe failed", { stderr: auditAppend.stderr, stdout: auditAppend.stdout, databaseProcessTimeline: timeline });

const appendOnlyUpdateProbe = runPsql(
  invocation,
  "begin; set local app.current_user_id = 'pilot-runtime-user-a'; update public.private_beta_audit_events set outcome = outcome where id = 'runtime-audit-probe-a'; rollback;",
  psqlEnv,
  "append-only audit update denial"
);
timeline.push(appendOnlyUpdateProbe.process);
if (appendOnlyUpdateProbe.ok) fail("application role can update append-only audit/runtime tables", { databaseProcessTimeline: timeline });

const readOnlyWriteProbe = runPsql(
  invocation,
  "begin; set local app.current_user_id = 'pilot-runtime-user-a'; update public.private_beta_feature_flags set enabled = enabled where key = 'liveAi'; rollback;",
  psqlEnv,
  "feature flag mutation denial"
);
timeline.push(readOnlyWriteProbe.process);
if (readOnlyWriteProbe.ok) fail("application role can mutate administrative feature flags", { databaseProcessTimeline: timeline });

const protectedSchemaProbe = runPsql(
  invocation,
  [
    "do $$ begin execute 'create role vireon_forbidden_runtime_probe'; execute 'drop role vireon_forbidden_runtime_probe'; raise exception 'CREATE_ROLE_ALLOWED'; exception when insufficient_privilege then null; end $$;",
    "do $$ begin execute 'create schema vireon_forbidden_runtime_probe'; execute 'drop schema vireon_forbidden_runtime_probe'; raise exception 'CREATE_SCHEMA_ALLOWED'; exception when insufficient_privilege then null; end $$;",
    "do $$ begin execute 'alter table public.users add column vireon_forbidden_runtime_probe text'; execute 'alter table public.users drop column vireon_forbidden_runtime_probe'; raise exception 'ALTER_TABLE_ALLOWED'; exception when insufficient_privilege then null; end $$;",
    "select 'protectedSchemaBlocked|true';",
  ].join("\n"),
  psqlEnv,
  "protected schema mutation denial"
);
timeline.push(protectedSchemaProbe.process);
if (!protectedSchemaProbe.ok || !protectedSchemaProbe.stdout.includes("protectedSchemaBlocked|true")) {
  fail("protected schema mutation denial probe failed", { stderr: protectedSchemaProbe.stderr, stdout: protectedSchemaProbe.stdout, databaseProcessTimeline: timeline });
}

console.log(stringifyPostgresPilotReport({
  ok: true,
  status: "POSTGRES PILOT RUNTIME ACCESS VERIFIED",
  verificationPhase: "POST_MIGRATION",
  applicationDiagnostics,
  authenticationRetry: objectAccess.authenticationRetry,
  transientAuthenticationRecovered: objectAccess.authenticationRetry?.transientAuthenticationRecovered ?? false,
  successfulAttemptNumber: objectAccess.authenticationRetry?.successfulAttemptNumber ?? 1,
  runtimeObjectAccess: "passed",
  requiredObjects: requiredRuntimeObjectList().length,
  schemaMigrations: "passed",
  migrationChecksums: manifest.map((item) => ({ id: item.id, checksum: item.checksum })),
  runtimeGrantMatrix: "passed",
  sequenceAccess: "passed",
  sequenceCount: Number(sequenceCount || "0"),
  rlsEnforcement: "RLS enabled and owner-scoped access verified with synthetic records",
  forcedRls: forcedRlsDesignedTables(),
  appendOnlyTables: "protected",
  featureFlagRestrictions: "protected",
  prohibitedAdministrativeActions: "blocked",
  protectedSchemaMutation: "blocked",
  storagePolicyPrerequisites: "checked by 0003 migration/static storage boundary",
  databaseProcessTimeline: timeline,
}, [verifierPassword]));
