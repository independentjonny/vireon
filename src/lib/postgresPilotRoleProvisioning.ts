export const POSTGRES_PILOT_APPLICATION_ROLE = "vireon_app";
export const POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV = "VIREON_PILOT_APPLICATION_ROLE_PASSWORD";
export const POSTGRES_PILOT_ROLE_PROVISIONING_VERSION = "postgres-pilot-role-provisioning-v1";

export const POSTGRES_PILOT_READ_WRITE_TABLES = [
  "users",
  "financial_profiles",
  "financial_facts",
  "documents",
  "document_extractions",
  "evidence",
  "rule_references",
  "digital_twin_scenarios",
  "simulation_runs",
  "decisions",
  "decision_history",
  "workflows",
  "workflow_steps",
  "workflow_evidence",
  "workflow_outcomes",
  "ai_cfo_questions",
  "ai_cfo_answers",
  "daily_reviews",
  "goals",
  "user_preferences",
  "idempotency_keys",
  "background_jobs",
  "data_exports",
  "account_deletion_requests",
  "migration_runs",
  "user_transaction_imports",
  "user_transactions",
  "user_subscriptions",
  "private_beta_onboarding",
  "private_beta_access_requests",
  "private_beta_invitations",
  "private_beta_feedback",
  "private_beta_deletion_requests",
] as const;

export const POSTGRES_PILOT_APPEND_ONLY_TABLES = [
  "fact_versions",
  "calculation_snapshots",
  "timeline_events",
  "audit_events",
  "private_beta_audit_events",
] as const;

export const POSTGRES_PILOT_READ_ONLY_TABLES = [
  "schema_migrations",
  "private_beta_migration_status",
  "private_beta_feature_flags",
] as const;

export const POSTGRES_PILOT_REQUIRED_TABLES = [
  ...POSTGRES_PILOT_READ_WRITE_TABLES,
  ...POSTGRES_PILOT_APPEND_ONLY_TABLES,
  ...POSTGRES_PILOT_READ_ONLY_TABLES,
] as const;

export type PostgresPilotMigrationState =
  | "EMPTY_DATABASE"
  | "MIGRATIONS_PENDING"
  | "MIGRATIONS_APPLIED"
  | "MIGRATIONS_PARTIAL"
  | "UNKNOWN";

export const POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS = 5;
export const POSTGRES_PILOT_POST_PROVISION_AUTH_RETRY_DELAYS_MS = [0, 1_000, 2_000, 3_000, 4_000] as const;
export type PostgresPilotTransientAuthenticationFailureCode =
  | "PASSWORD_AUTHENTICATION_PROPAGATION"
  | "CONNECTION_RESET"
  | "CONNECTION_TIMEOUT"
  | "TEMPORARY_POOLER_OR_TENANT_ROUTING";

export type PostgresPilotPostProvisioningAuthenticationAttempt = {
  attempt: number;
  ok: boolean;
  elapsedMsSinceAlterRole: number;
};

export function summarizePostProvisioningAuthenticationProbe(
  attempts: readonly PostgresPilotPostProvisioningAuthenticationAttempt[]
): {
  authenticationSucceeded: boolean;
  firstSuccessfulAttempt: number | null;
  attempts: number;
  permanentFailure: boolean;
} {
  const firstSuccessfulAttempt = attempts.find((attempt) => attempt.ok)?.attempt ?? null;
  return {
    authenticationSucceeded: firstSuccessfulAttempt != null,
    firstSuccessfulAttempt,
    attempts: attempts.length,
    permanentFailure: firstSuccessfulAttempt == null && attempts.length >= POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS,
  };
}

export function classifyTransientApplicationRoleAuthenticationFailure(input: {
  stdout?: string | null;
  stderr?: string | null;
  status?: number | null;
}): PostgresPilotTransientAuthenticationFailureCode | null {
  const text = `${input.stderr || ""}\n${input.stdout || ""}`.toLowerCase();
  if (!text.trim()) return null;
  if (/permission denied|insufficient privilege|must be owner|create_role_allowed|create_schema_allowed/.test(text)) return null;
  if (/password authentication failed/.test(text)) return "PASSWORD_AUTHENTICATION_PROPAGATION";
  if (/connection reset|econnreset|server closed the connection unexpectedly|terminating connection/.test(text)) return "CONNECTION_RESET";
  if (/timeout|timed out|etimedout|connection timed out/.test(text)) return "CONNECTION_TIMEOUT";
  if (/pooler|tenant|routing|temporar|too many clients|max client connections/.test(text)) return "TEMPORARY_POOLER_OR_TENANT_ROUTING";
  return null;
}

export type PostgresPilotAuthenticationRetryAttemptResult<T> = {
  ok: boolean;
  stdout?: string | null;
  stderr?: string | null;
  status?: number | null;
  signal?: unknown;
  stdoutBytes?: unknown;
  stderrBytes?: unknown;
  stderrExactRedacted?: unknown;
} & T;

export function runPostgresPilotApplicationAuthenticationRetry<T extends Record<string, unknown>>(input: {
  provisionedAtMs?: number | null;
  runAttempt: (attempt: number) => PostgresPilotAuthenticationRetryAttemptResult<T>;
  sleep?: (delayMs: number) => void;
  delaysMs?: readonly number[];
  maxAttempts?: number;
}): PostgresPilotAuthenticationRetryAttemptResult<T> & {
  authenticationRetry: {
    attempts: Array<{
      attempt: number;
      ok: boolean;
      elapsedMsSinceAlterRole: number;
      classifiedFailureCode: PostgresPilotTransientAuthenticationFailureCode | null;
      psqlExitStatus: number | null;
      stdoutBytes?: unknown;
      stderrBytes?: unknown;
      signal?: unknown;
      stderrExactRedacted?: unknown;
    }>;
    transientAuthenticationRecovered: boolean;
    successfulAttemptNumber: number | null;
    recoveredFailureCodes: PostgresPilotTransientAuthenticationFailureCode[];
    nonRetryableFailureCode?: "NON_RETRYABLE_APPLICATION_ROLE_VERIFICATION_FAILURE";
    exhausted?: boolean;
  };
} {
  const maxAttempts = input.maxAttempts ?? POSTGRES_PILOT_POST_PROVISION_AUTH_MAX_ATTEMPTS;
  const delaysMs = input.delaysMs ?? POSTGRES_PILOT_POST_PROVISION_AUTH_RETRY_DELAYS_MS;
  const sleep = input.sleep ?? ((delayMs: number) => {
    if (delayMs <= 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
  });
  const baselineMs = Number.isFinite(input.provisionedAtMs ?? NaN) && Number(input.provisionedAtMs) > 0
    ? Number(input.provisionedAtMs)
    : Date.now();
  const attempts: Array<{
    attempt: number;
    ok: boolean;
    elapsedMsSinceAlterRole: number;
    classifiedFailureCode: PostgresPilotTransientAuthenticationFailureCode | null;
    psqlExitStatus: number | null;
    stdoutBytes?: unknown;
    stderrBytes?: unknown;
    signal?: unknown;
    stderrExactRedacted?: unknown;
  }> = [];
  let lastResult: PostgresPilotAuthenticationRetryAttemptResult<T> | null = null;

  for (let index = 0; index < maxAttempts; index += 1) {
    sleep(delaysMs[index] ?? 0);
    const result = input.runAttempt(index + 1);
    const classifiedFailureCode = result.ok
      ? null
      : classifyTransientApplicationRoleAuthenticationFailure({
        stdout: result.stdout,
        stderr: result.stderr,
        status: result.status,
      });
    attempts.push({
      attempt: index + 1,
      ok: result.ok,
      elapsedMsSinceAlterRole: Date.now() - baselineMs,
      classifiedFailureCode,
      psqlExitStatus: result.status ?? null,
      stdoutBytes: result.stdoutBytes,
      stderrBytes: result.stderrBytes,
      signal: result.signal,
      stderrExactRedacted: result.stderrExactRedacted,
    });
    lastResult = result;
    if (result.ok) {
      return {
        ...result,
        authenticationRetry: {
          attempts,
          transientAuthenticationRecovered: attempts.length > 1,
          successfulAttemptNumber: index + 1,
          recoveredFailureCodes: attempts.slice(0, -1).map((attempt) => attempt.classifiedFailureCode).filter((value): value is PostgresPilotTransientAuthenticationFailureCode => Boolean(value)),
        },
      };
    }
    if (!classifiedFailureCode) {
      return {
        ...result,
        authenticationRetry: {
          attempts,
          transientAuthenticationRecovered: false,
          successfulAttemptNumber: null,
          recoveredFailureCodes: [],
          nonRetryableFailureCode: "NON_RETRYABLE_APPLICATION_ROLE_VERIFICATION_FAILURE",
        },
      };
    }
  }

  if (!lastResult) {
    throw new Error("PostgreSQL pilot authentication retry attempted zero times.");
  }
  return {
    ...lastResult,
    authenticationRetry: {
      attempts,
      transientAuthenticationRecovered: false,
      successfulAttemptNumber: null,
      recoveredFailureCodes: attempts.map((attempt) => attempt.classifiedFailureCode).filter((value): value is PostgresPilotTransientAuthenticationFailureCode => Boolean(value)),
      exhausted: true,
    },
  };
}

type ProvisioningSqlInput = {
  databaseName: string;
  rolePassword: string;
  applicationRole?: string;
};

export type ApplicationUrlValidation = {
  ok: boolean;
  username: string | null;
  database: string | null;
  host: string | null;
  sslmode: string | null;
  sessionPooler: boolean;
  routedUsernameHasProjectRef: boolean;
  routedUsernameProjectRef: string | null;
  reason: string | null;
  statusCode?: "APPLICATION_POOLER_USERNAME_NOT_ROUTED";
};

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function textArray(values: readonly string[]): string {
  return `array[${values.map(quoteLiteral).join(", ")}]`;
}

function grantExistingTablesBlock(input: { label: string; tables: readonly string[]; privileges: string; role: string }): string {
  return [
    `-- Existing ${input.label} table grants are conditional so this script is safe before migrations.`,
    "do $$",
    "declare",
    `  table_name text;`,
    "begin",
    `  foreach table_name in array ${textArray(input.tables)} loop`,
    "    if to_regclass(format('public.%I', table_name)) is not null then",
    `      execute format('grant ${input.privileges} on table public.%I to %I', table_name, ${quoteLiteral(input.role)});`,
    "    end if;",
    "  end loop;",
    "end",
    "$$;",
  ].join("\n");
}

export function buildPostgresPilotRoleProvisioningSql(input: ProvisioningSqlInput): string {
  if (!input.rolePassword) {
    throw new Error(`${POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV} is required.`);
  }
  if (!input.databaseName) {
    throw new Error("Pilot database name is required.");
  }

  const role = input.applicationRole ?? POSTGRES_PILOT_APPLICATION_ROLE;
  const quotedRole = quoteIdentifier(role);
  const roleNameLiteral = quoteLiteral(role);
  const passwordLiteral = quoteLiteral(input.rolePassword);
  const database = quoteIdentifier(input.databaseName);

  return [
    "-- Vireon PostgreSQL pilot application role provisioning.",
    "-- Generated in memory by scripts/postgres-pilot-provision-roles.mjs; do not commit rendered SQL.",
    "begin;",
    "",
    "do $$",
    "declare",
    "  existing record;",
    "  unsafe_attributes text[] := array[]::text[];",
    "begin",
    "  select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls",
    "    into existing",
    "    from pg_roles",
    `    where rolname = ${roleNameLiteral};`,
    "",
    "  if existing is null then",
    `    create role ${quotedRole} with login password ${passwordLiteral};`,
    "  else",
    "    if existing.rolsuper then unsafe_attributes := unsafe_attributes || 'rolsuper'; end if;",
    "    if existing.rolcreatedb then unsafe_attributes := unsafe_attributes || 'rolcreatedb'; end if;",
    "    if existing.rolcreaterole then unsafe_attributes := unsafe_attributes || 'rolcreaterole'; end if;",
    "    if existing.rolbypassrls then unsafe_attributes := unsafe_attributes || 'rolbypassrls'; end if;",
    "",
    "    if array_length(unsafe_attributes, 1) is not null then",
    "      raise exception 'EXISTING_ROLE_UNSAFE:%', array_to_string(unsafe_attributes, ',') using errcode = '42501';",
    "    end if;",
    "",
    `    alter role ${quotedRole} login;`,
    `    alter role ${quotedRole} password ${passwordLiteral};`,
    "  end if;",
    "",
    "  select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls",
    "    into existing",
    "    from pg_roles",
    `    where rolname = ${roleNameLiteral};`,
    "",
    "  if existing is null or not existing.rolcanlogin or existing.rolsuper or existing.rolcreatedb or existing.rolcreaterole or existing.rolbypassrls then",
    "    raise exception 'APPLICATION_ROLE_RESTRICTED_FLAG_VERIFICATION_FAILED' using errcode = '42501';",
    "  end if;",
    "end",
    "$$;",
    "",
    `grant connect on database ${database} to ${quotedRole};`,
    `grant usage on schema public to ${quotedRole};`,
    `revoke create on schema public from ${quotedRole};`,
    "",
    grantExistingTablesBlock({
      label: "read/write",
      tables: POSTGRES_PILOT_READ_WRITE_TABLES,
      privileges: "select, insert, update, delete",
      role,
    }),
    "",
    grantExistingTablesBlock({
      label: "append-only",
      tables: POSTGRES_PILOT_APPEND_ONLY_TABLES,
      privileges: "select, insert",
      role,
    }),
    "",
    grantExistingTablesBlock({
      label: "read-only",
      tables: POSTGRES_PILOT_READ_ONLY_TABLES,
      privileges: "select",
      role,
    }),
    "",
    `grant usage, select on all sequences in schema public to ${quotedRole};`,
    "",
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${quotedRole};`,
    `alter default privileges in schema public grant usage, select on sequences to ${quotedRole};`,
    "",
    "commit;",
    "",
  ].join("\n");
}

export function expectedRuntimeObjectProbeSql(): string {
  return POSTGRES_PILOT_REQUIRED_TABLES
    .map((table) => `select 1 from public.${quoteIdentifier(table)} limit 0;`)
    .join("\n");
}

export function requiredRuntimeObjectList(): readonly string[] {
  return POSTGRES_PILOT_REQUIRED_TABLES;
}

export function classifyPostgresPilotMigrationState(input: {
  schemaMigrationsExists: boolean;
  appliedMigrationIds: readonly string[];
  expectedMigrationIds: readonly string[];
  querySucceeded?: boolean;
}): PostgresPilotMigrationState {
  if (input.querySucceeded === false) return "UNKNOWN";
  if (!input.schemaMigrationsExists) return "EMPTY_DATABASE";
  const applied = new Set(input.appliedMigrationIds);
  if (input.expectedMigrationIds.every((id) => applied.has(id))) return "MIGRATIONS_APPLIED";
  if (input.appliedMigrationIds.length > 0) return "MIGRATIONS_PARTIAL";
  return "MIGRATIONS_PENDING";
}

export function classifyPostgresPilotRuntimeObjectState(input: {
  presentRuntimeObjectCount: number;
  requiredRuntimeObjectCount?: number;
  querySucceeded?: boolean;
}): PostgresPilotMigrationState {
  if (input.querySucceeded === false) return "UNKNOWN";
  if (!Number.isFinite(input.presentRuntimeObjectCount) || input.presentRuntimeObjectCount < 0) return "UNKNOWN";
  const requiredCount = input.requiredRuntimeObjectCount ?? POSTGRES_PILOT_REQUIRED_TABLES.length;
  if (input.presentRuntimeObjectCount === 0) return "MIGRATIONS_PENDING";
  if (input.presentRuntimeObjectCount >= requiredCount) return "MIGRATIONS_APPLIED";
  return "MIGRATIONS_PARTIAL";
}

export function requiredRuntimeObjectCountSql(): string {
  return [
    "with required(name) as (",
    POSTGRES_PILOT_REQUIRED_TABLES.map((table) => `select ${quoteLiteral(table)}`).join(" union all "),
    ")",
    "select count(*)::text",
    "from required",
    "where to_regclass(format('public.%I', name)) is not null;",
  ].join(" ");
}

export function reconcilePostgresPilotRuntimeGrantsSql(role = POSTGRES_PILOT_APPLICATION_ROLE): string {
  const quotedRole = quoteIdentifier(role);
  return [
    "-- Reconcile runtime grants after migrations create the schema.",
    "-- Default privileges are not precise enough for append-only/read-only tables.",
    `revoke all privileges on all tables in schema public from ${quotedRole};`,
    `revoke all privileges on all sequences in schema public from ${quotedRole};`,
    "",
    grantExistingTablesBlock({
      label: "read/write",
      tables: POSTGRES_PILOT_READ_WRITE_TABLES,
      privileges: "select, insert, update, delete",
      role,
    }),
    "",
    grantExistingTablesBlock({
      label: "append-only",
      tables: POSTGRES_PILOT_APPEND_ONLY_TABLES,
      privileges: "select, insert",
      role,
    }),
    "",
    grantExistingTablesBlock({
      label: "read-only",
      tables: POSTGRES_PILOT_READ_ONLY_TABLES,
      privileges: "select",
      role,
    }),
    "",
    `grant usage, select on all sequences in schema public to ${quotedRole};`,
  ].join("\n");
}

export function restrictedRoleFlagSql(role = POSTGRES_PILOT_APPLICATION_ROLE): string {
  return [
    "select rolsuper::text || '|' || rolbypassrls::text || '|' || rolcreaterole::text || '|' || rolcreatedb::text",
    "from pg_roles",
    `where rolname = ${quoteLiteral(role)};`,
  ].join(" ");
}

export function validatePostgresPilotApplicationUrl(value: string | undefined | null): ApplicationUrlValidation {
  if (!value) {
    return { ok: false, username: null, database: null, host: null, sslmode: null, sessionPooler: false, routedUsernameHasProjectRef: false, routedUsernameProjectRef: null, reason: "missing application database URL" };
  }

  try {
    const url = new URL(value.trim());
    const username = decodeURIComponent(url.username || "");
    const sessionPooler = /pooler/i.test(url.hostname);
    const validDirectUser = username === POSTGRES_PILOT_APPLICATION_ROLE;
    const routedPrefix = `${POSTGRES_PILOT_APPLICATION_ROLE}.`;
    const routedUsernameHasProjectRef = username.startsWith(routedPrefix) && username.length > routedPrefix.length;
    const routedUsernameProjectRef = routedUsernameHasProjectRef ? username.slice(routedPrefix.length) : null;
    const validPoolerUser = routedUsernameHasProjectRef;
    const validUser = sessionPooler ? validPoolerUser : validDirectUser;
    let detectedSslMode: string | null = null;
    for (const [key, queryValue] of url.searchParams.entries()) {
      if (key.toLowerCase() === "sslmode") detectedSslMode = queryValue;
    }
    const sslmode = detectedSslMode?.toLowerCase() ?? null;
    const sslRequired = sslmode === "require" || sslmode === "verify-full";

    if (sessionPooler && validDirectUser && !routedUsernameHasProjectRef) {
      return {
        ok: false,
        username,
        database: url.pathname ? url.pathname.replace(/^\//, "") : null,
        host: url.hostname || null,
        sslmode,
        sessionPooler,
        routedUsernameHasProjectRef,
        routedUsernameProjectRef,
        statusCode: "APPLICATION_POOLER_USERNAME_NOT_ROUTED",
        reason: "Supabase Session Pooler application URLs must use routed username vireon_app.<project-ref>.",
      };
    }
    if (!validUser) {
      return {
        ok: false,
        username: username || null,
        database: url.pathname ? url.pathname.replace(/^\//, "") : null,
        host: url.hostname || null,
        sslmode,
        sessionPooler,
        routedUsernameHasProjectRef,
        routedUsernameProjectRef,
        reason: "VIREON_PILOT_APPLICATION_DATABASE_URL must use vireon_app or Supabase pooler user vireon_app.<project-ref>.",
      };
    }
    if (!sslRequired) {
      return {
        ok: false,
        username,
        database: url.pathname ? url.pathname.replace(/^\//, "") : null,
        host: url.hostname || null,
        sslmode,
        sessionPooler,
        routedUsernameHasProjectRef,
        routedUsernameProjectRef,
        reason: "VIREON_PILOT_APPLICATION_DATABASE_URL must require SSL with sslmode=require or sslmode=verify-full.",
      };
    }

    return {
      ok: true,
      username,
      database: url.pathname ? url.pathname.replace(/^\//, "") : null,
      host: url.hostname || null,
      sslmode,
      sessionPooler,
      routedUsernameHasProjectRef,
      routedUsernameProjectRef,
      reason: null,
    };
  } catch {
    return { ok: false, username: null, database: null, host: null, sslmode: null, sessionPooler: false, routedUsernameHasProjectRef: false, routedUsernameProjectRef: null, reason: "malformed application database URL" };
  }
}
