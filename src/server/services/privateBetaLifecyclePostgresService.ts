import { createHash, randomUUID } from "node:crypto";
import type { Session } from "@/lib/auth/middleware";
import { classifyDatabaseError, createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient } from "@/server/db/postgresRuntime";
import type { PostgresPilotClient } from "@/lib/postgresPilotPersistence";
import { uuidFromTrustedUserId } from "@/server/services/financialVaultPostgresService";

if (typeof window !== "undefined") {
  throw new Error("Private beta lifecycle PostgreSQL service is server-only.");
}

const SOURCE = "private-beta-lifecycle-postgres";
const JOB_TYPES = [
  "document-extraction",
  "import-processing",
  "deterministic-recalculation",
  "digital-twin-simulation",
  "daily-review-generation",
  "user-export",
  "account-deletion-processing",
] as const;

export type PrivateBetaJobType = (typeof JOB_TYPES)[number];
export type LifecycleStatus = "pending" | "queued" | "running" | "retrying" | "completed" | "failed" | "cancelled";

export type BackgroundJobView = {
  id: string;
  type: PrivateBetaJobType;
  status: LifecycleStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  lockedAt: string | null;
  heartbeatAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

export type ExportRequestView = {
  id: string;
  status: LifecycleStatus | "requested" | "processing" | "available" | "expired";
  manifest: Record<string, unknown>;
  storageRef: string | null;
  requestedAt: string;
  expiresAt: string | null;
  createdAt: string;
};

export type DeletionRequestView = {
  id: string;
  status: "requested" | "confirmed" | "scheduled" | "processing" | "completed" | "failed" | "cancelled";
  requestedAt: string;
  confirmedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

type ScopedClient = PostgresPilotClient;

type JobRow = {
  appId: string;
  jobType: PrivateBetaJobType;
  status: LifecycleStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  lockedAt: string | null;
  heartbeatAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

type ExportRow = {
  appId: string;
  status: ExportRequestView["status"];
  manifest: Record<string, unknown> | null;
  storageRef: string | null;
  requestedAt: string;
  expiresAt: string | null;
  createdAt: string;
};

type DeletionRow = {
  appId: string;
  status: DeletionRequestView["status"];
  requestedAt: string;
  confirmedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export class PrivateBetaLifecycleError extends Error {
  public readonly code: "UNAUTHENTICATED" | "DATABASE_UNAVAILABLE" | "VALIDATION_FAILED" | "CONFLICT" | "NOT_FOUND";
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(code: PrivateBetaLifecycleError["code"], message: string, status = 500, retryable = false) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function userId(session: Session): string {
  if (!session.userId) throw new PrivateBetaLifecycleError("UNAUTHENTICATED", "Sign in is required.", 401);
  return uuidFromTrustedUserId(session.userId);
}

function hasSecretShape(value: unknown): boolean {
  const text = JSON.stringify(value ?? {}).toLowerCase();
  return /(api[_-]?key|service[_-]?role|password|pgpassword|bearer\s+[a-z0-9._-]+|token|secret|private[_-]?key)/i.test(text);
}

function boundedPayload(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new PrivateBetaLifecycleError("VALIDATION_FAILED", "Lifecycle payload must be a JSON object.", 400);
  const text = JSON.stringify(value);
  if (text.length > 16_384) throw new PrivateBetaLifecycleError("VALIDATION_FAILED", "Lifecycle payload is too large.", 413);
  if (hasSecretShape(value)) throw new PrivateBetaLifecycleError("VALIDATION_FAILED", "Lifecycle payload cannot contain secrets.", 400);
  return value as Record<string, unknown>;
}

function normalizeJobType(value: string): PrivateBetaJobType {
  if (!JOB_TYPES.includes(value as PrivateBetaJobType)) throw new PrivateBetaLifecycleError("VALIDATION_FAILED", "Unsupported private beta job type.", 400);
  return value as PrivateBetaJobType;
}

function mapJob(row: JobRow): BackgroundJobView {
  return {
    id: row.appId,
    type: row.jobType,
    status: row.status,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.maxAttempts),
    nextRetryAt: row.nextRetryAt,
    lockedAt: row.lockedAt,
    heartbeatAt: row.heartbeatAt,
    completedAt: row.completedAt,
    failedAt: row.failedAt,
    createdAt: row.createdAt,
  };
}

function mapExport(row: ExportRow): ExportRequestView {
  return {
    id: row.appId,
    status: row.status,
    manifest: row.manifest ?? {},
    storageRef: row.storageRef,
    requestedAt: row.requestedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

function mapDeletion(row: DeletionRow): DeletionRequestView {
  return {
    id: row.appId,
    status: row.status,
    requestedAt: row.requestedAt,
    confirmedAt: row.confirmedAt,
    scheduledAt: row.scheduledAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}

export function toPrivateBetaLifecycleSafeError(error: unknown): PrivateBetaLifecycleError {
  if (error instanceof PrivateBetaLifecycleError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid runtime postgresql configuration|missing runtime application database url|missing runtime application role password/i.test(message)) {
    return new PrivateBetaLifecycleError("DATABASE_UNAVAILABLE", "PostgreSQL persistence is unavailable. No local fallback was used.", 503, true);
  }
  const kind = classifyDatabaseError(error);
  if (kind === "CONNECTION" || kind === "QUERY_TIMEOUT") return new PrivateBetaLifecycleError("DATABASE_UNAVAILABLE", "PostgreSQL persistence is unavailable. No local fallback was used.", 503, true);
  if (kind === "UNIQUE_CONSTRAINT") return new PrivateBetaLifecycleError("CONFLICT", "The lifecycle request already exists.", 409);
  return new PrivateBetaLifecycleError("VALIDATION_FAILED", "The private beta lifecycle request could not be completed.", 422);
}

export function createPrivateBetaLifecycleServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return createPrivateBetaLifecyclePostgresService(new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv(env)));
}

export function createPrivateBetaLifecyclePostgresService(client: PostgresPilotClient) {
  async function scoped<T>(session: Session, operation: (tx: ScopedClient, userId: string) => Promise<T>): Promise<T> {
    try {
      return await client.transaction(async (tx) => {
        const scopedUser = userId(session);
        await tx.query("select set_config('app.current_user_id', $1, true)", [scopedUser]);
        await tx.query(
          `insert into users(id, email, display_name, source, correlation_id)
           values ($1, $2, $3, $4, $5)
           on conflict (id) do update set updated_at = now(), correlation_id = excluded.correlation_id`,
          [scopedUser, session.email, session.email, SOURCE, randomUUID()],
        );
        return operation(tx, scopedUser);
      });
    } catch (error) {
      throw toPrivateBetaLifecycleSafeError(error);
    }
  }

  async function appendAudit(tx: ScopedClient, scopedUser: string, action: string, entityType: string, entityId: string, after: unknown): Promise<void> {
    await tx.query(
      `insert into audit_events(user_id, actor, action, entity_type, entity_id, before_hash, after_hash, reason, request_id, source, correlation_id)
       values ($1, 'user', $2, $3, $4, null, $5, $6, $7, $8, $9)`,
      [scopedUser, action, entityType, entityId, sha(after), "private beta lifecycle", randomUUID(), SOURCE, randomUUID()],
    );
  }

  async function enqueueJobTx(tx: ScopedClient, scopedUser: string, session: Session, input: { type: PrivateBetaJobType; payload?: Record<string, unknown>; idempotencyKey?: string; maxAttempts?: number }): Promise<BackgroundJobView> {
    const payload = boundedPayload(input.payload);
    const idempotencyKey = input.idempotencyKey ?? `${input.type}:${sha({ userId: scopedUser, payload }).slice(0, 24)}`;
    const appId = `job-${sha({ scopedUser, idempotencyKey }).slice(0, 28)}`;
    const row = await tx.query<JobRow>(
      `insert into background_jobs(user_id, app_id, workspace_id, job_type, status, attempts, max_attempts, next_retry_at, payload, idempotency_key, source, correlation_id)
       values ($1, $2, $3, $4, 'pending', 0, $5, now(), $6::jsonb, $7, $8, $9)
       on conflict (user_id, app_id) do update
         set updated_at = now()
       returning app_id as "appId", job_type as "jobType", status, attempts, max_attempts as "maxAttempts", next_retry_at as "nextRetryAt", locked_at as "lockedAt", heartbeat_at as "heartbeatAt", completed_at as "completedAt", failed_at as "failedAt", created_at as "createdAt"`,
      [scopedUser, appId, session.workspaceId, input.type, input.maxAttempts ?? 3, JSON.stringify(payload), idempotencyKey, SOURCE, randomUUID()],
    );
    await appendAudit(tx, scopedUser, "background_job.enqueued", "background_job", appId, { type: input.type });
    return mapJob(row.rows[0]);
  }

  return {
    toSafeError: toPrivateBetaLifecycleSafeError,
    async enqueueJob(session: Session, input: { type: string; payload?: unknown; idempotencyKey?: string; maxAttempts?: number }): Promise<BackgroundJobView> {
      const type = normalizeJobType(input.type);
      const payload = boundedPayload(input.payload);
      return scoped(session, (tx, scopedUser) => enqueueJobTx(tx, scopedUser, session, { type, payload, idempotencyKey: input.idempotencyKey, maxAttempts: input.maxAttempts }));
    },
    async claimNextJob(session: Session, workerId: string): Promise<BackgroundJobView | null> {
      if (!/^[a-zA-Z0-9._:-]{1,80}$/.test(workerId)) throw new PrivateBetaLifecycleError("VALIDATION_FAILED", "Invalid worker identifier.", 400);
      return scoped(session, async (tx, scopedUser) => {
        const row = await tx.query<JobRow>(
          `with candidate as (
             select id from background_jobs
              where user_id = $1
                and status in ('pending', 'queued', 'retrying')
                and (next_retry_at is null or next_retry_at <= now())
                and attempts < max_attempts
              order by created_at asc
              for update skip locked
              limit 1
           )
           update background_jobs j
              set status = 'running',
                  attempts = attempts + 1,
                  locked_at = now(),
                  locked_by = $2,
                  heartbeat_at = now(),
                  updated_at = now(),
                  version = version + 1
             from candidate
            where j.id = candidate.id
            returning j.app_id as "appId", j.job_type as "jobType", j.status, j.attempts, j.max_attempts as "maxAttempts", j.next_retry_at as "nextRetryAt", j.locked_at as "lockedAt", j.heartbeat_at as "heartbeatAt", j.completed_at as "completedAt", j.failed_at as "failedAt", j.created_at as "createdAt"`,
          [scopedUser, workerId],
        );
        return row.rows[0] ? mapJob(row.rows[0]) : null;
      });
    },
    async recordJobFailure(session: Session, jobId: string, errorClass: string): Promise<BackgroundJobView> {
      return scoped(session, async (tx, scopedUser) => {
        const row = await tx.query<JobRow>(
          `update background_jobs
              set status = case when attempts >= max_attempts then 'failed' else 'retrying' end,
                  failed_at = case when attempts >= max_attempts then now() else failed_at end,
                  next_retry_at = case when attempts >= max_attempts then null else now() + interval '5 minutes' end,
                  redacted_error = left($3, 256),
                  locked_at = null,
                  locked_by = null,
                  heartbeat_at = null,
                  updated_at = now(),
                  version = version + 1
            where user_id = $1 and app_id = $2
            returning app_id as "appId", job_type as "jobType", status, attempts, max_attempts as "maxAttempts", next_retry_at as "nextRetryAt", locked_at as "lockedAt", heartbeat_at as "heartbeatAt", completed_at as "completedAt", failed_at as "failedAt", created_at as "createdAt"`,
          [scopedUser, jobId, errorClass.replace(/[^a-zA-Z0-9:_-]/g, "_")],
        );
        if (!row.rows[0]) throw new PrivateBetaLifecycleError("NOT_FOUND", "Job was not found.", 404);
        await appendAudit(tx, scopedUser, "background_job.failed", "background_job", jobId, { errorClass });
        return mapJob(row.rows[0]);
      });
    },
    async completeJob(session: Session, jobId: string): Promise<BackgroundJobView> {
      return scoped(session, async (tx, scopedUser) => {
        const row = await tx.query<JobRow>(
          `update background_jobs
              set status = 'completed',
                  completed_at = now(),
                  locked_at = null,
                  locked_by = null,
                  heartbeat_at = null,
                  updated_at = now(),
                  version = version + 1
            where user_id = $1 and app_id = $2
            returning app_id as "appId", job_type as "jobType", status, attempts, max_attempts as "maxAttempts", next_retry_at as "nextRetryAt", locked_at as "lockedAt", heartbeat_at as "heartbeatAt", completed_at as "completedAt", failed_at as "failedAt", created_at as "createdAt"`,
          [scopedUser, jobId],
        );
        if (!row.rows[0]) throw new PrivateBetaLifecycleError("NOT_FOUND", "Job was not found.", 404);
        await appendAudit(tx, scopedUser, "background_job.completed", "background_job", jobId, {});
        return mapJob(row.rows[0]);
      });
    },
    async requestExport(session: Session, idempotencyKey = "default"): Promise<ExportRequestView> {
      return scoped(session, async (tx, scopedUser) => {
        const key = `export:${idempotencyKey}`;
        const appId = `export-${sha({ scopedUser, key }).slice(0, 28)}`;
        const manifest = {
          schemaVersion: "private-beta-export-v1",
          includes: ["profile", "facts", "factHistory", "documentMetadata", "scenarios", "decisions", "workflows", "goals", "aiCfoHistory", "dailyReviews", "transactions", "subscriptions", "preferences", "audit"],
          rawDocumentsIncluded: false,
        };
        const row = await tx.query<ExportRow>(
          `insert into data_exports(user_id, app_id, workspace_id, status, manifest, requested_at, expires_at, idempotency_key, source, correlation_id)
           values ($1, $2, $3, 'requested', $4::jsonb, now(), now() + interval '7 days', $5, $6, $7)
           on conflict (user_id, app_id) do update set updated_at = now()
           returning app_id as "appId", status, manifest, storage_ref as "storageRef", requested_at as "requestedAt", expires_at as "expiresAt", created_at as "createdAt"`,
          [scopedUser, appId, session.workspaceId, JSON.stringify(manifest), key, SOURCE, randomUUID()],
        );
        await enqueueJobTx(tx, scopedUser, session, { type: "user-export", payload: { exportId: appId }, idempotencyKey: `job:${key}` });
        await appendAudit(tx, scopedUser, "data_export.requested", "data_export", appId, manifest);
        return mapExport(row.rows[0]);
      });
    },
    async listExports(session: Session): Promise<ExportRequestView[]> {
      return scoped(session, async (tx, scopedUser) => {
        const rows = await tx.query<ExportRow>(
          `select app_id as "appId", status, manifest, storage_ref as "storageRef", requested_at as "requestedAt", expires_at as "expiresAt", created_at as "createdAt"
             from data_exports
            where user_id = $1
            order by created_at desc
            limit 50`,
          [scopedUser],
        );
        return rows.rows.map(mapExport);
      });
    },
    async requestAccountDeletion(session: Session, confirmation: string, idempotencyKey = "default"): Promise<DeletionRequestView> {
      if (confirmation !== "REQUEST_DELETE") throw new PrivateBetaLifecycleError("VALIDATION_FAILED", "REAUTHENTICATION_OR_CONFIRMATION_REQUIRED", 422);
      return scoped(session, async (tx, scopedUser) => {
        const key = `deletion:${idempotencyKey}`;
        const appId = `deletion-${sha({ scopedUser, key }).slice(0, 28)}`;
        const manifest = { schemaVersion: "private-beta-deletion-v1", destructiveLiveExecutionRequiresHumanApproval: true };
        const row = await tx.query<DeletionRow>(
          `insert into account_deletion_requests(user_id, app_id, workspace_id, status, confirmed_at, scheduled_at, manifest, idempotency_key, source, correlation_id)
           values ($1, $2, $3, 'confirmed', now(), now() + interval '7 days', $4::jsonb, $5, $6, $7)
           on conflict (user_id, app_id) do update set updated_at = now()
           returning app_id as "appId", status, requested_at as "requestedAt", confirmed_at as "confirmedAt", scheduled_at as "scheduledAt", completed_at as "completedAt", created_at as "createdAt"`,
          [scopedUser, appId, session.workspaceId, JSON.stringify(manifest), key, SOURCE, randomUUID()],
        );
        await enqueueJobTx(tx, scopedUser, session, { type: "account-deletion-processing", payload: { deletionRequestId: appId, syntheticOnly: true }, idempotencyKey: `job:${key}` });
        await appendAudit(tx, scopedUser, "account_deletion.confirmed", "account_deletion_request", appId, manifest);
        return mapDeletion(row.rows[0]);
      });
    },
    async listDeletionRequests(session: Session): Promise<DeletionRequestView[]> {
      return scoped(session, async (tx, scopedUser) => {
        const rows = await tx.query<DeletionRow>(
          `select app_id as "appId", status, requested_at as "requestedAt", confirmed_at as "confirmedAt", scheduled_at as "scheduledAt", completed_at as "completedAt", created_at as "createdAt"
             from account_deletion_requests
            where user_id = $1
            order by created_at desc
            limit 20`,
          [scopedUser],
        );
        return rows.rows.map(mapDeletion);
      });
    },
  };
}
