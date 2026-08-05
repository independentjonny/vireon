import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  bindSqlParameters,
  classifyDatabaseError,
  createRuntimeDatabaseConfigFromEnv,
  PsqlRuntimeClient,
  queryCanReturnRows,
  redactDatabaseDiagnostics,
  resolvePsqlExecutable,
  resolveRuntimeEnvValue,
  validateRuntimeDatabaseConfig,
} from "../../src/server/db/postgresRuntime.ts";

const source = readFileSync("src/server/db/postgresRuntime.ts", "utf-8");
const operatorPreflightSource = readFileSync("scripts/postgres-operator-preflight.mjs", "utf-8");
const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));

test("runtime transaction no longer delegates callback to the reusable client", () => {
  const runtimeClient = source.slice(source.indexOf("export class PsqlRuntimeClient"), source.indexOf("type TransactionClientInput"));
  assert.doesNotMatch(runtimeClient, /return operation\(this\);/);
  assert.match(source, /class PsqlTransactionClient/);
  assert.match(source, /await session\.commit\(\)/);
  assert.match(source, /await session\.rollback\(\)/);
});

test("runtime client does not keep persistent scoped user state", () => {
  assert.doesNotMatch(source, /private scopedUserId/);
  assert.doesNotMatch(source, /pendingScopedUserId/);
  assert.match(source, /User scope must be set inside a PostgreSQL transaction session/);
});

test("legacy psql executable resolution remains available for operator scripts", () => {
  assert.equal(resolvePsqlExecutable({ explicit: "C:/custom/psql.exe" }), "C:/custom/psql.exe");
  assert.equal(resolvePsqlExecutable({ env: { NODE_ENV: "test", VIREON_PSQL_PATH: "C:/env/psql.exe" } as NodeJS.ProcessEnv }), "C:/env/psql.exe");
  const source = readFileSync("src/server/db/postgresRuntime.ts", "utf-8");
  assert.match(source, /C:\\\\Program Files\\\\PostgreSQL\\\\18\\\\bin\\\\psql\.exe/);
});

test("runtime request path uses serverless PostgreSQL driver instead of spawning psql", () => {
  const runtimeClient = source.slice(source.indexOf("export class PsqlRuntimeClient"), source.indexOf("type TransactionClientInput"));
  assert.match(source, /from "pg"/);
  assert.match(source, /function createPgClient/);
  assert.doesNotMatch(runtimeClient, /spawn\(/);
  assert.doesNotMatch(runtimeClient, /this\.psqlExecutable/);
  assert.doesNotMatch(runtimeClient, /resolvePsqlExecutable/);
  assert.match(source, /operation: "postgres\.transaction"/);
});

test("operator preflight loads repository and Windows user environment without logging secrets", () => {
  assert.match(packageJson.scripts["postgres:operator:preflight"], /scripts\/postgres-operator-preflight\.mjs/);
  assert.match(operatorPreflightSource, /loadRepositoryNextEnv/);
  assert.match(operatorPreflightSource, /resolveRuntimeEnvValue/);
  assert.match(operatorPreflightSource, /assertNoSecretValuesInDiagnostics/);
  assert.match(operatorPreflightSource, /VIREON_PILOT_MIGRATION_DATABASE_URL/);
  assert.match(operatorPreflightSource, /VIREON_PILOT_RESTORE_DATABASE_URL/);
  assert.match(operatorPreflightSource, /VIREON_PILOT_APPLICATION_DATABASE_URL/);
  assert.match(operatorPreflightSource, /VIREON_PILOT_APPLICATION_ROLE_PASSWORD/);
  assert.match(operatorPreflightSource, /windows-user-env/);
  assert.doesNotMatch(operatorPreflightSource, /console\.log\(process\.env/);
  assert.doesNotMatch(operatorPreflightSource, /applicationDatabaseUrl:\s*runtimeConfig\.applicationDatabaseUrl/);
  assert.doesNotMatch(operatorPreflightSource, /applicationRolePassword:\s*runtimeConfig\.applicationRolePassword/);
});

test("runtime database config can use allow-listed Windows user env fallback without overriding process env", () => {
  const reader = (name: string) => ({
    VIREON_PILOT_MIGRATION_DATABASE_URL: "postgres://postgres.project:placeholder@example.test/postgres?sslmode=require",
    VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "fallback-password",
  }[name]);
  assert.equal(resolveRuntimeEnvValue("VIREON_PILOT_APPLICATION_ROLE_PASSWORD", { NODE_ENV: "test" } as NodeJS.ProcessEnv, reader), "fallback-password");
  assert.equal(resolveRuntimeEnvValue("VIREON_PILOT_APPLICATION_ROLE_PASSWORD", { NODE_ENV: "test", VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "process-password" } as NodeJS.ProcessEnv, reader), "process-password");
  assert.equal(resolveRuntimeEnvValue("SUPABASE_SERVICE_ROLE_KEY", { NODE_ENV: "test" } as NodeJS.ProcessEnv, () => "must-not-read"), "");
});

test("non-transaction user scope cannot be cached for a later query", async () => {
  const client = Object.create(PsqlRuntimeClient.prototype) as PsqlRuntimeClient;
  await assert.rejects(
    () => client.query("select set_config('app.current_user_id', $1, true)", ["user-a"]),
    /transaction session/
  );
});

test("transaction session marks itself unusable on timeout and rejects later operations", () => {
  assert.match(source, /private unusable = false/);
  assert.match(source, /query_timeout/);
  assert.match(source, /this\.unusable = true/);
  assert.match(source, /if \(!client \|\| this\.closed \|\| this\.unusable\)/);
  assert.match(source, /if \(this\.closed \|\| this\.unusable\) return;/);
});

test("runtime configures statement timeout through parameterized set_config for pg compatibility", () => {
  assert.match(source, /function statementTimeoutValue/);
  assert.match(source, /select set_config\('statement_timeout', \$1, true\)/);
  assert.doesNotMatch(source, /set local statement_timeout = \$1/);
});

test("transaction session uses one connected client and does not parse stderr/stdout markers", () => {
  const transactionClient = source.slice(source.indexOf("class PsqlTransactionClient"));
  assert.match(transactionClient, /private client: pg\.Client \| null = null/);
  assert.match(transactionClient, /await withDatabaseTimeout\(this\.client\.connect\(\)/);
  assert.doesNotMatch(transactionClient, /__VIREON_TX_START_/);
  assert.doesNotMatch(transactionClient, /stdout/);
  assert.doesNotMatch(transactionClient, /stderr/);
});

test("database diagnostics redact configured secrets recursively", () => {
  const secret = "pg-secret-value";
  const redacted = redactDatabaseDiagnostics({
    message: `password=${secret}`,
    nested: { diagnostic: `connection password ${secret} was rejected` },
  }, [secret]);
  assert.equal(JSON.stringify(redacted).includes(secret), false);
});

test("SQL parameter binding quotes values without caller concatenation", () => {
  const sql = bindSqlParameters("select $1 as value", ["a'b"]);
  assert.equal(sql, "select 'a''b' as value");
});

test("runtime row-returning detection does not wrap plain writes as JSON CTEs", () => {
  assert.equal(queryCanReturnRows("select 1"), true);
  assert.equal(queryCanReturnRows("with rows as (select 1) select * from rows"), true);
  assert.equal(queryCanReturnRows("with upserted as (insert into decisions(id) values ($1) returning id) insert into decision_history(decision_id) select id from upserted"), false);
  assert.equal(queryCanReturnRows("insert into audit_events (id) values ($1) returning id"), true);
  assert.equal(queryCanReturnRows("insert into audit_events (id) values ($1)"), false);
  assert.equal(queryCanReturnRows("update audit_events set event_type = $1 where id = $2"), false);
  assert.equal(queryCanReturnRows("delete from audit_events where id = $1"), false);
});

test("database error classifier handles timeout and permission classes", () => {
  assert.equal(classifyDatabaseError(new Error("statement timeout")), "QUERY_TIMEOUT");
  assert.equal(classifyDatabaseError(new Error("permission denied for table users")), "PERMISSION_DENIED");
});

const pilotConfig = createRuntimeDatabaseConfigFromEnv();
const pilotValidation = validateRuntimeDatabaseConfig(pilotConfig);
const runLivePgRuntimeTest = process.env.VIREON_ENABLE_LIVE_PG_RUNTIME_TESTS === "true";

test(
  "configured PostgreSQL pilot runtime transaction uses restricted role and transaction-local user scope",
  {
    skip: runLivePgRuntimeTest && pilotValidation.ok
      ? false
      : runLivePgRuntimeTest
        ? `PostgreSQL pilot runtime credentials unavailable: ${pilotValidation.blocked.join("; ")}`
        : "Live PostgreSQL driver integration is external-environment gated; hosted Preview smoke verifies deployment runtime.",
  },
  async () => {
    const client = new PsqlRuntimeClient(pilotConfig);
    const rows = await client.transaction(async (tx) => {
      await tx.query("select set_config('app.current_user_id', $1, true)", ["pilot-integration-user"]);
      return tx.query<{ current_user: string; scoped_user: string }>(
        "select current_user, current_setting('app.current_user_id', true) as scoped_user"
      );
    });
    assert.equal(rows.rows[0]?.current_user, "vireon_app");
    assert.equal(rows.rows[0]?.scoped_user, "pilot-integration-user");
  }
);
