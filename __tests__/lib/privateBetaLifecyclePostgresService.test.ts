import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createPrivateBetaLifecyclePostgresService } from "../../src/server/services/privateBetaLifecyclePostgresService.ts";
import type { Session } from "../../src/lib/auth/middleware.ts";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";

type Call = { sql: string; params: unknown[] };

const session: Session = {
  userId: "user-a",
  workspaceId: "workspace-a",
  orgId: "org-a",
  role: "owner",
  email: "owner@example.test",
  expiresAt: "2027-01-01T00:00:00.000Z",
};

function lifecycleClient(calls: Call[]): PostgresPilotClient {
  let transactionDepth = 0;
  const jobRow = {
    appId: "job-abc",
    jobType: "user-export",
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    nextRetryAt: "2026-08-04T00:00:00.000Z",
    lockedAt: null,
    heartbeatAt: null,
    completedAt: null,
    failedAt: null,
    createdAt: "2026-08-04T00:00:00.000Z",
  };
  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      calls.push({ sql, params });
      if (sql.includes("set_config") && transactionDepth === 0) throw new Error("root set_config is forbidden");
      if (sql.includes("insert into background_jobs")) return { rows: [jobRow] as T[] };
      if (sql.includes("with candidate as")) return { rows: [{ ...jobRow, status: "running", attempts: 1, lockedAt: "2026-08-04T00:01:00.000Z", heartbeatAt: "2026-08-04T00:01:00.000Z" }] as T[] };
      if (sql.includes("update background_jobs") && sql.includes("status = 'completed'")) return { rows: [{ ...jobRow, status: "completed", completedAt: "2026-08-04T00:02:00.000Z" }] as T[] };
      if (sql.includes("update background_jobs") && sql.includes("redacted_error")) return { rows: [{ ...jobRow, status: "retrying", attempts: 1, nextRetryAt: "2026-08-04T00:06:00.000Z" }] as T[] };
      if (sql.includes("insert into data_exports")) {
        return {
          rows: [{
            appId: "export-abc",
            status: "requested",
            manifest: { schemaVersion: "private-beta-export-v1" },
            storageRef: null,
            requestedAt: "2026-08-04T00:00:00.000Z",
            expiresAt: "2026-08-11T00:00:00.000Z",
            createdAt: "2026-08-04T00:00:00.000Z",
          }] as T[],
        };
      }
      if (sql.includes("from data_exports")) return { rows: [] };
      if (sql.includes("insert into account_deletion_requests")) {
        return {
          rows: [{
            appId: "deletion-abc",
            status: "confirmed",
            requestedAt: "2026-08-04T00:00:00.000Z",
            confirmedAt: "2026-08-04T00:00:00.000Z",
            scheduledAt: "2026-08-11T00:00:00.000Z",
            completedAt: null,
            createdAt: "2026-08-04T00:00:00.000Z",
          }] as T[],
        };
      }
      if (sql.includes("from account_deletion_requests")) return { rows: [] };
      return { rows: [] };
    },
    async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
      transactionDepth += 1;
      try {
        return await operation(this);
      } finally {
        transactionDepth -= 1;
      }
    },
  };
}

test("private beta background jobs are transaction scoped and claimable", async () => {
  const calls: Call[] = [];
  const service = createPrivateBetaLifecyclePostgresService(lifecycleClient(calls));

  const job = await service.enqueueJob(session, { type: "user-export", payload: { exportId: "export-abc" }, idempotencyKey: "export-once" });
  const claimed = await service.claimNextJob(session, "worker-a");
  const completed = await service.completeJob(session, job.id);

  assert.equal(job.status, "pending");
  assert.equal(claimed?.status, "running");
  assert.equal(completed.status, "completed");
  assert.ok(calls.some((call) => call.sql.includes("for update skip locked")));
  assert.ok(calls.some((call) => call.sql.includes("set_config") && call.sql.includes("app.current_user_id")));
  assert.ok(calls.every((call) => !call.params.includes("user-a")));
});

test("private beta export request persists state and enqueues one user export job", async () => {
  const calls: Call[] = [];
  const service = createPrivateBetaLifecyclePostgresService(lifecycleClient(calls));

  const request = await service.requestExport(session, "export-key");

  assert.equal(request.status, "requested");
  assert.equal(request.manifest.rawDocumentsIncluded, undefined);
  assert.ok(calls.some((call) => call.sql.includes("insert into data_exports")));
  assert.ok(calls.some((call) => call.sql.includes("insert into background_jobs") && call.params.includes("user-export")));
  assert.ok(calls.some((call) => call.sql.includes("insert into audit_events") && call.params.includes("data_export.requested")));
});

test("private beta deletion request is a durable rehearsal and does not delete live data", async () => {
  const calls: Call[] = [];
  const service = createPrivateBetaLifecyclePostgresService(lifecycleClient(calls));

  const request = await service.requestAccountDeletion(session, "REQUEST_DELETE", "delete-key");

  assert.equal(request.status, "confirmed");
  assert.ok(calls.some((call) => call.sql.includes("insert into account_deletion_requests")));
  assert.ok(calls.some((call) => call.sql.includes("insert into background_jobs") && call.params.includes("account-deletion-processing")));
  assert.equal(calls.some((call) => /delete\s+from/i.test(call.sql)), false);
});

test("private beta lifecycle rejects secret-bearing job payloads before SQL", async () => {
  const calls: Call[] = [];
  const service = createPrivateBetaLifecyclePostgresService(lifecycleClient(calls));

  await assert.rejects(
    () => service.enqueueJob(session, { type: "user-export", payload: { token: "secret-token" } }),
    /Lifecycle payload cannot contain secrets/,
  );
  assert.equal(calls.length, 0);
});

test("private beta activation lifecycle migration is additive and indexed", () => {
  const migration = readFileSync(join(process.cwd(), "migrations", "0009_private_beta_activation_lifecycle.sql"), "utf8");

  assert.match(migration, /alter table public\.background_jobs add column if not exists payload jsonb/);
  assert.match(migration, /idx_background_jobs_claimable/);
  assert.match(migration, /alter table public\.data_exports add column if not exists idempotency_key/);
  assert.match(migration, /alter table public\.account_deletion_requests add column if not exists manifest jsonb/);
  assert.doesNotMatch(migration, /\bdrop\s+(table|column|schema)\b/i);
});
