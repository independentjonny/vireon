import assert from "node:assert/strict";
import test from "node:test";
import {
  bindSqlParameters,
  classifyDatabaseError,
  createRuntimeDatabaseConfigFromEnv,
  redactDatabaseDiagnostics,
  validateRuntimeDatabaseConfig,
} from "@/server/db/postgresRuntime";
import { createPostgresApplicationRepositories } from "@/server/repositories/postgresApplicationRepositories";
import type { PostgresPilotClient, QueryResult } from "@/lib/postgresPilotPersistence";
import type { RepositoryContext } from "@/lib/productionDataIntegrity";

class FakeClient implements PostgresPilotClient {
  queries: Array<{ sql: string; params: unknown[] }> = [];
  rollback = false;
  profileRows: unknown[] = [];
  factRows: unknown[] = [];

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    this.queries.push({ sql, params });
    if (sql.includes("from financial_profiles")) return { rows: this.profileRows as T[] };
    if (sql.includes("insert into financial_profiles")) {
      const row = {
        id: "profile-1",
        userId: params[0],
        createdAt: "2026-07-31T00:00:00.000Z",
        updatedAt: "2026-07-31T00:00:00.000Z",
        version: 1,
        source: params[4],
        correlationId: params[5],
        state: params[1],
        relationshipStatus: params[2],
        profileConfidence: params[3],
      };
      this.profileRows = [row];
      return { rows: [row] as T[] };
    }
    if (sql.includes("insert into financial_facts")) {
      const row = {
        id: "fact-1",
        userId: params[0],
        createdAt: "2026-07-31T00:00:00.000Z",
        updatedAt: "2026-07-31T00:00:00.000Z",
        version: 1,
        source: params[5],
        correlationId: params[6],
        type: params[1],
        value: JSON.parse(String(params[2])),
        confidence: params[3],
        verified: params[4],
        evidenceIds: [],
      };
      this.factRows = [row];
      return { rows: [row] as T[] };
    }
    if (sql.includes("from financial_facts")) return { rows: this.factRows as T[] };
    if (sql.includes("insert into fact_versions")) {
      return {
        rows: [{
          id: "fact-version-1",
          userId: params[0],
          createdAt: "2026-07-31T00:00:00.000Z",
          updatedAt: "2026-07-31T00:00:00.000Z",
          version: params[2],
          source: params[8],
          correlationId: params[9],
          factId: params[1],
          factVersion: params[2],
          value: JSON.parse(String(params[3])),
          confidence: params[4],
          verified: params[5],
          evidenceIds: params[6],
          changedReason: params[7],
        }] as T[],
      };
    }
    return { rows: [] };
  }

  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    try {
      return await operation(this);
    } catch (error) {
      this.rollback = true;
      throw error;
    }
  }
}

const ctx: RepositoryContext = {
  session: { userId: "11111111-1111-4111-8111-111111111111", expiresAt: null, actor: "user", requestId: "req-1" },
  correlationId: "corr-1",
  source: "phase2-test",
  dataMode: "test",
};

test("Phase 2 runtime config rejects administrative URLs and requires SSL", () => {
  const validation = validateRuntimeDatabaseConfig({
    applicationDatabaseUrl: "postgresql://postgres.primaryref@example.test:5432/postgres",
    applicationRolePassword: "secret",
  });

  assert.equal(validation.ok, false);
  assert.ok(validation.blocked.includes("runtime database URL uses an administrative database role"));
  assert.ok(validation.blocked.includes("runtime database URL must require SSL"));
  assert.equal(JSON.stringify(validation).includes("secret"), false);
});

test("Phase 2 runtime config accepts restricted Supabase pooler routed username", () => {
  const validation = validateRuntimeDatabaseConfig({
    applicationDatabaseUrl: "postgresql://vireon_app.primaryref@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "secret",
  });

  assert.equal(validation.ok, true);
  assert.equal(validation.username, "vireon_app.primaryref");
  assert.equal(validation.projectRef, "primaryref");
  assert.equal(validation.passwordInUrl, false);
});

test("Phase 2 runtime env derives a passwordless application URL from migration URL", () => {
  const config = createRuntimeDatabaseConfigFromEnv({
    VIREON_PILOT_MIGRATION_DATABASE_URL: "postgresql://postgres.primaryref:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
  } as unknown as NodeJS.ProcessEnv);

  assert.ok(config.applicationDatabaseUrl.includes("vireon_app.primaryref@"));
  assert.equal(config.applicationDatabaseUrl.includes("application-secret"), false);
});

test("Phase 2 SQL binding escapes literals and rejects missing parameters", () => {
  assert.equal(bindSqlParameters("select $1, $2", ["O'Brien", 4]), "select 'O''Brien', 4");
  assert.throws(() => bindSqlParameters("select $2", ["only-one"]), /Missing SQL parameter/);
});

test("Phase 2 error classification covers common PostgreSQL failures", () => {
  assert.equal(classifyDatabaseError(new Error("23505 duplicate key value violates unique constraint")), "UNIQUE_CONSTRAINT");
  assert.equal(classifyDatabaseError(new Error("23503 violates foreign key constraint")), "FOREIGN_KEY");
  assert.equal(classifyDatabaseError(new Error("40P01 deadlock detected")), "DEADLOCK");
  assert.equal(classifyDatabaseError(new Error("permission denied for table users")), "PERMISSION_DENIED");
});

test("Phase 2 redaction removes URLs and passwords from nested diagnostics", () => {
  const redacted = redactDatabaseDiagnostics({
    argv: ["postgresql://postgres:admin-secret@example.test/postgres"],
    env: { PGPASSWORD: "runtime-secret" },
    sql: "ALTER ROLE vireon_app PASSWORD 'runtime-secret';",
  }, ["runtime-secret", "admin-secret"]);

  const text = JSON.stringify(redacted);
  assert.equal(text.includes("runtime-secret"), false);
  assert.equal(text.includes("admin-secret"), false);
  assert.equal(text.includes("postgresql://postgres:"), false);
});

test("Phase 2 repositories scope profile operations by authenticated user", async () => {
  const client = new FakeClient();
  const repositories = createPostgresApplicationRepositories(client);

  const profile = await repositories.profiles.initialize(ctx, { state: "NSW", profileConfidence: 0.8 });

  assert.equal(profile.userId, ctx.session.userId);
  const scopeIndex = client.queries.findIndex((query) => query.sql === "select set_config('app.current_user_id', $1, true)");
  const insertIndex = client.queries.findIndex((query) => query.sql.includes("insert into financial_profiles"));
  assert.notEqual(scopeIndex, -1);
  assert.notEqual(insertIndex, -1);
  assert.ok(scopeIndex < insertIndex);
  assert.deepEqual(client.queries[scopeIndex], {
    sql: "select set_config('app.current_user_id', $1, true)",
    params: [ctx.session.userId],
  });
  assert.equal(client.queries[insertIndex].params[0], ctx.session.userId);
});

test("Phase 2 fact create records append-only fact version in one transaction", async () => {
  const client = new FakeClient();
  const repositories = createPostgresApplicationRepositories(client);

  const result = await repositories.factsV2.createWithVersion(ctx, {
    type: "cash_balance",
    value: { amount: 25000 },
    confidence: 1,
    verified: true,
    evidenceIds: [],
  });

  assert.equal(result.fact.userId, ctx.session.userId);
  assert.equal(result.version.factId, "fact-1");
  assert.equal(result.version.changedReason, "Initial confirmed fact creation.");
  assert.ok(client.queries.some((query) => query.sql.includes("insert into fact_versions")));
});
