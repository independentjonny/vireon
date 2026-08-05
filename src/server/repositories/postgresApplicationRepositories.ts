import type {
  CalculationSnapshotRecord,
  DocumentRecord,
  FinancialFactRecord,
  OwnedRecord,
  RepositoryContext,
  RepositoryResult,
} from "@/lib/productionDataIntegrity";
import { ProductionDataError, requireAuthenticatedUser, hashRecord } from "@/lib/productionDataIntegrity";
import { PostgresPilotRepositories, type PostgresPilotClient } from "@/lib/postgresPilotPersistence";

export type FinancialProfileRecord = OwnedRecord & {
  state: string | null;
  relationshipStatus: string | null;
  profileConfidence: number;
};

export type FactVersionRecord = OwnedRecord & {
  factId: string;
  factVersion: number;
  value: unknown;
  confidence: number;
  verified: boolean;
  evidenceIds: string[];
  changedReason: string;
};

export type ApplicationRepositorySet = ReturnType<typeof createPostgresApplicationRepositories>;
type ScopedRepositoryContext = RepositoryContext & { transactionClient?: PostgresPilotClient };

function ownedFields(row: Record<string, unknown>): OwnedRecord {
  return {
    id: String(row.id),
    userId: String(row.userId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    version: Number(row.version),
    source: String(row.source),
    correlationId: String(row.correlationId),
  };
}

function notFound<T>(): RepositoryResult<T> {
  return { ok: false, code: "NOT_FOUND", message: "Record was not found.", retryable: false };
}

function conflict<T>(): RepositoryResult<T> {
  return { ok: false, code: "CONFLICT", message: "This record changed in another session.", retryable: true };
}

export function createPostgresApplicationRepositories(client: PostgresPilotClient) {
  const pilot = new PostgresPilotRepositories(client);

  function scopedDb(ctx: RepositoryContext): PostgresPilotClient {
    const db = (ctx as ScopedRepositoryContext).transactionClient;
    if (!db) throw new ProductionDataError("TRANSACTION_FAILED", "PostgreSQL repository scope requires a transaction-local client.", true);
    return db;
  }

  async function withScopedTransaction<T>(ctx: RepositoryContext, operation: (ctx: ScopedRepositoryContext) => Promise<T>): Promise<T> {
    if ((ctx as ScopedRepositoryContext).transactionClient) {
      await scope(ctx);
      return operation(ctx as ScopedRepositoryContext);
    }
    return client.transaction(async (tx) => {
      const scopedCtx: ScopedRepositoryContext = { ...ctx, transactionClient: tx };
      await scope(scopedCtx);
      return operation(scopedCtx);
    });
  }

  async function scope(ctx: RepositoryContext): Promise<string> {
    const userId = requireAuthenticatedUser(ctx.session);
    await scopedDb(ctx).query("select set_config('app.current_user_id', $1, true)", [userId]);
    return userId;
  }

  return {
    ...pilot,
    profiles: {
      async initialize(ctx: RepositoryContext, input: { state?: string | null; relationshipStatus?: string | null; profileConfidence?: number } = {}): Promise<FinancialProfileRecord> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const userId = await scope(scopedCtx);
          const result = await scopedDb(scopedCtx).query<FinancialProfileRecord>(
            `insert into financial_profiles(user_id, state, relationship_status, profile_confidence, source, correlation_id)
             values ($1, $2, $3, $4, $5, $6)
             on conflict do nothing
             returning id, user_id as "userId", created_at as "createdAt", updated_at as "updatedAt", version, source, correlation_id as "correlationId", state, relationship_status as "relationshipStatus", profile_confidence as "profileConfidence"`,
            [userId, input.state ?? null, input.relationshipStatus ?? null, input.profileConfidence ?? 0, scopedCtx.source, scopedCtx.correlationId]
          );
          if (result.rows[0]) return result.rows[0];
          const current = await this.current(scopedCtx);
          if (!current) throw new ProductionDataError("TRANSACTION_FAILED", "Profile initialization did not return a record.", true);
          return current;
        });
      },
      async current(ctx: RepositoryContext): Promise<FinancialProfileRecord | null> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const userId = await scope(scopedCtx);
          const result = await scopedDb(scopedCtx).query<FinancialProfileRecord>(
            `select id, user_id as "userId", created_at as "createdAt", updated_at as "updatedAt", version, source, correlation_id as "correlationId", state, relationship_status as "relationshipStatus", profile_confidence as "profileConfidence"
             from financial_profiles where user_id = $1 order by created_at asc limit 1`,
            [userId]
          );
          return result.rows[0] ?? null;
        });
      },
      async updateMetadata(ctx: RepositoryContext, update: { id: string; expectedVersion: number; state?: string | null; relationshipStatus?: string | null; profileConfidence?: number }): Promise<RepositoryResult<FinancialProfileRecord>> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const userId = await scope(scopedCtx);
          const result = await scopedDb(scopedCtx).query<FinancialProfileRecord>(
            `update financial_profiles
             set state = coalesce($1, state), relationship_status = coalesce($2, relationship_status), profile_confidence = coalesce($3, profile_confidence), version = version + 1, updated_at = now(), source = $4, correlation_id = $5
             where id = $6 and user_id = $7 and version = $8
             returning id, user_id as "userId", created_at as "createdAt", updated_at as "updatedAt", version, source, correlation_id as "correlationId", state, relationship_status as "relationshipStatus", profile_confidence as "profileConfidence"`,
            [update.state ?? null, update.relationshipStatus ?? null, update.profileConfidence ?? null, scopedCtx.source, scopedCtx.correlationId, update.id, userId, update.expectedVersion]
          );
          return result.rows[0] ? { ok: true, value: result.rows[0] } : conflict();
        });
      },
    },
    factsV2: {
      ...pilot.facts,
      async createWithVersion(ctx: RepositoryContext, input: Omit<FinancialFactRecord, keyof OwnedRecord>): Promise<{ fact: FinancialFactRecord; version: FactVersionRecord }> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const txPilot = new PostgresPilotRepositories(scopedDb(scopedCtx));
          const fact = await txPilot.facts.create(scopedCtx, input);
          const version = await this.recordVersion(scopedCtx, fact, "Initial confirmed fact creation.");
          return { fact, version };
        });
      },
      async updateWithVersion(ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<FinancialFactRecord>; reason: string }): Promise<RepositoryResult<{ fact: FinancialFactRecord; version: FactVersionRecord }>> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const txPilot = new PostgresPilotRepositories(scopedDb(scopedCtx));
          const current = await txPilot.facts.getById(scopedCtx, update.id);
          if (!current) return notFound();
          if (current.version !== update.expectedVersion) return conflict();
          const result = await txPilot.facts.update(scopedCtx, update);
          if (!result.ok) return result as RepositoryResult<{ fact: FinancialFactRecord; version: FactVersionRecord }>;
          const version = await this.recordVersion(scopedCtx, result.value, update.reason);
          return { ok: true, value: { fact: result.value, version } };
        });
      },
      async recordVersion(ctx: RepositoryContext, fact: FinancialFactRecord, reason: string): Promise<FactVersionRecord> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const userId = await scope(scopedCtx);
          const result = await scopedDb(scopedCtx).query<FactVersionRecord>(
            `insert into fact_versions(user_id, fact_id, version, fact_value, confidence, verified, evidence_ids, changed_reason, source, correlation_id)
             values ($1, $2, $3, $4::jsonb, $5, $6, $7::uuid[], $8, $9, $10)
             returning id, user_id as "userId", created_at as "createdAt", updated_at as "updatedAt", version as "factVersion", version, source, correlation_id as "correlationId", fact_id as "factId", fact_value as value, confidence, verified, evidence_ids as "evidenceIds", changed_reason as "changedReason"`,
            [userId, fact.id, fact.version, JSON.stringify(fact.value), fact.confidence, fact.verified, fact.evidenceIds, reason, scopedCtx.source, scopedCtx.correlationId]
          );
          return { ...ownedFields(result.rows[0] as Record<string, unknown>), ...result.rows[0] };
        });
      },
    },
    documentsV2: {
      async create(ctx: RepositoryContext, input: Omit<DocumentRecord, keyof OwnedRecord>): Promise<DocumentRecord> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const userId = await scope(scopedCtx);
          const result = await scopedDb(scopedCtx).query<DocumentRecord>(
            `insert into documents(user_id, title, document_type, storage_ref, status, sensitivity, source, correlation_id)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             returning id, user_id as "userId", created_at as "createdAt", updated_at as "updatedAt", version, source, correlation_id as "correlationId", title, document_type as "documentType", storage_ref as "storageRef", status as "extractionStatus", sensitivity`,
            [userId, input.title, input.documentType, input.storageRef, input.extractionStatus, input.sensitivity, scopedCtx.source, scopedCtx.correlationId]
          );
          return result.rows[0];
        });
      },
      async list(ctx: RepositoryContext): Promise<DocumentRecord[]> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const userId = await scope(scopedCtx);
          const result = await scopedDb(scopedCtx).query<DocumentRecord>(
            `select id, user_id as "userId", created_at as "createdAt", updated_at as "updatedAt", version, source, correlation_id as "correlationId", title, document_type as "documentType", storage_ref as "storageRef", status as "extractionStatus", sensitivity
             from documents where user_id = $1 order by uploaded_at desc`,
            [userId]
          );
          return result.rows;
        });
      },
    },
    snapshotsV2: {
      ...pilot.snapshots,
      async createForResult(ctx: RepositoryContext, input: Omit<CalculationSnapshotRecord, keyof OwnedRecord | "immutable"> & { resultPayload: unknown }): Promise<CalculationSnapshotRecord> {
        return withScopedTransaction(ctx, async (scopedCtx) => {
          const txPilot = new PostgresPilotRepositories(scopedDb(scopedCtx));
          return txPilot.snapshots.create(scopedCtx, {
            ...input,
            outputHash: input.outputHash || hashRecord(input.resultPayload),
          });
        });
      },
    },
  };
}
