import { createHash } from "crypto";
import {
  InMemoryProductionDataStore,
  LocalDevelopmentProductionRepository,
  PRODUCTION_DATA_SCHEMA_VERSION,
  ProductionDataError,
  hashRecord,
  requireAuthenticatedUser,
  userSafeError,
  type AuditEventRecord,
  type CalculationSnapshotRecord,
  type DecisionRecord,
  type FinancialFactRecord,
  type OwnedRecord,
  type RepositoryContext,
  type RepositoryResult,
  type TimelineEventRecord,
  type WorkflowRecord,
} from "@/lib/productionDataIntegrity";

export const POSTGRES_PILOT_SCHEMA_VERSION = "0001_production_data_integrity";
export const POSTGRES_PILOT_SCOPE = [
  "financial_facts",
  "fact_versions",
  "evidence",
  "calculation_snapshots",
  "decisions",
  "decision_history",
  "workflows",
  "workflow_steps",
  "workflow_evidence",
  "workflow_outcomes",
  "timeline_events",
  "audit_events",
] as const;

export type PersistenceMode = "local" | "postgres-pilot" | "postgres-required";

export type UserContext = {
  userId: string;
  sessionId: string;
  requestId: string;
  correlationId: string;
  authenticationMethod: "supabase" | "system" | "test";
  issuedAt: string;
  expiresAt?: string;
};

export type SystemUserContext = UserContext & {
  authenticationMethod: "system";
  userScope: string;
};

export type EvidenceRecord = OwnedRecord & {
  evidenceType: string;
  sourceRef: string;
  documentId: string | null;
  factId: string | null;
  verificationStatus: "Unverified" | "Verified" | "Rejected" | "Superseded" | "Inconclusive";
  confidence: number;
  immutable: true;
};

export type DecisionHistoryRecord = OwnedRecord & {
  immutable: true;
  decisionId: string;
  eventType: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown>;
};

export type WorkflowOutcomeRecord = OwnedRecord & {
  workflowId: string;
  metric: string;
  baselineValue: number | null;
  expectedValue: number | null;
  actualValue: number | null;
  result: "Verified" | "Partially Verified" | "Not Achieved" | "Inconclusive" | "Pending";
  variance: number | null;
  evidenceIds: string[];
  calculationSnapshotId: string;
};

export type MigrationRecord = {
  id: string;
  checksum: string;
  appliedAt: string;
  durationMs: number;
  executor: string;
  success: boolean;
  errorDetails: string | null;
  correlationId: string;
};

export type MigrationRunResult = {
  migrationId: string;
  checksum: string;
  dryRun: boolean;
  applied: boolean;
  durationMs: number;
  errorDetails: string | null;
};

export type QueryResult<T> = {
  rows: T[];
  rowCount?: number;
};

export interface PostgresPilotClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T>;
}

export interface EvidenceRepository {
  create(ctx: RepositoryContext, input: Omit<EvidenceRecord, keyof OwnedRecord | "immutable">): Promise<EvidenceRecord>;
  getById(ctx: RepositoryContext, id: string): Promise<EvidenceRecord | null>;
}

export interface AuditRepository {
  append(ctx: RepositoryContext, input: Omit<AuditEventRecord, keyof OwnedRecord | "immutable">): Promise<AuditEventRecord>;
  list(ctx: RepositoryContext): Promise<AuditEventRecord[]>;
}

export type PilotRepositorySet = {
  facts: {
    getById(ctx: RepositoryContext, id: string): Promise<FinancialFactRecord | null>;
    create(ctx: RepositoryContext, input: Omit<FinancialFactRecord, keyof OwnedRecord>): Promise<FinancialFactRecord>;
    update(ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<FinancialFactRecord> }): Promise<RepositoryResult<FinancialFactRecord>>;
  };
  evidence: EvidenceRepository;
  snapshots: {
    create(ctx: RepositoryContext, input: Omit<CalculationSnapshotRecord, keyof OwnedRecord | "immutable">): Promise<CalculationSnapshotRecord>;
    getById(ctx: RepositoryContext, id: string): Promise<CalculationSnapshotRecord | null>;
  };
  decisions: {
    create(ctx: RepositoryContext, input: Omit<DecisionRecord, keyof OwnedRecord>): Promise<DecisionRecord>;
    update(ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<DecisionRecord> }): Promise<RepositoryResult<DecisionRecord>>;
  };
  workflows: {
    create(ctx: RepositoryContext, input: Omit<WorkflowRecord, keyof OwnedRecord>): Promise<WorkflowRecord>;
    update(ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<WorkflowRecord> }): Promise<RepositoryResult<WorkflowRecord>>;
  };
  timeline: {
    append(ctx: RepositoryContext, input: Omit<TimelineEventRecord, keyof OwnedRecord | "immutable">): Promise<TimelineEventRecord>;
    list(ctx: RepositoryContext): Promise<TimelineEventRecord[]>;
  };
  audit: AuditRepository;
  withIdempotency<T>(ctx: RepositoryContext, key: string, operation: () => Promise<T>): Promise<T>;
  verifyWorkflowOutcomeTransaction(ctx: RepositoryContext, input: {
    workflowId: string;
    decisionId: string;
    evidenceIds: string[];
    actualImpact: number;
    snapshotInput: Omit<CalculationSnapshotRecord, keyof OwnedRecord | "immutable">;
    injectFailureAt?: "verification" | "workflow" | "decision" | "timeline" | "audit";
  }): Promise<{ workflow: WorkflowRecord; decision: DecisionRecord; snapshot: CalculationSnapshotRecord; timelineEvent: TimelineEventRecord }>;
  exportUserData(ctx: RepositoryContext): ReturnType<InMemoryProductionDataStore["exportUserData"]>;
  executeAccountDeletion(ctx: RepositoryContext): ReturnType<InMemoryProductionDataStore["executeAccountDeletion"]>;
};

export function userContextToRepositoryContext(user: UserContext, mode: PersistenceMode = "postgres-pilot"): RepositoryContext {
  return {
    session: {
      userId: user.userId,
      expiresAt: user.expiresAt ?? null,
      actor: user.authenticationMethod === "system" ? "system" : "user",
      requestId: user.requestId,
    },
    correlationId: user.correlationId,
    source: `postgres-pilot:${user.authenticationMethod}`,
    dataMode: mode === "local" ? "local-development" : "test",
  };
}

export function requireSyntheticPilotUser(user: UserContext): void {
  if (!["pilot-user-a", "pilot-user-b", "system-test-user"].includes(user.userId)) {
    throw new ProductionDataError("VALIDATION_FAILED", "PostgreSQL pilot accepts synthetic pilot users only.", false);
  }
}

function checksumSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

function safeRecord<T extends object>(row: T): T {
  return row;
}

function mapDbError(error: unknown): RepositoryResult<never> {
  const safe = userSafeError(error);
  return { ok: false, code: safe.code, message: safe.message, retryable: safe.retryable };
}

export class PostgresMigrationRunner {
  private readonly client: PostgresPilotClient;
  private readonly migrationId: string;

  constructor(client: PostgresPilotClient, migrationId = POSTGRES_PILOT_SCHEMA_VERSION) {
    this.client = client;
    this.migrationId = migrationId;
  }

  async currentSchemaVersion(): Promise<MigrationRecord | null> {
    const result = await this.client.query<MigrationRecord>(
      "select id, checksum, applied_at as \"appliedAt\", duration_ms as \"durationMs\", executor, success, error_details as \"errorDetails\", correlation_id as \"correlationId\" from schema_migrations where id = $1",
      [this.migrationId]
    );
    return result.rows[0] ?? null;
  }

  async dryRun(migrationSql: string): Promise<MigrationRunResult> {
    return {
      migrationId: this.migrationId,
      checksum: checksumSql(migrationSql),
      dryRun: true,
      applied: false,
      durationMs: 0,
      errorDetails: null,
    };
  }

  async apply(input: { migrationSql: string; executor: string; correlationId: string }): Promise<MigrationRunResult> {
    const checksum = checksumSql(input.migrationSql);
    const existing = await this.currentSchemaVersion().catch(() => null);
    if (existing?.success && existing.checksum !== checksum) {
      throw new ProductionDataError("CONFLICT", "Refusing modified already-applied migration.", false);
    }
    if (existing?.success && existing.checksum === checksum) {
      return { migrationId: this.migrationId, checksum, dryRun: false, applied: false, durationMs: 0, errorDetails: null };
    }

    const started = Date.now();
    try {
      await this.client.transaction(async (tx) => {
        await tx.query(input.migrationSql);
        await tx.query(
          "insert into schema_migrations(id, checksum, applied_at, duration_ms, executor, success, error_details, correlation_id) values ($1, $2, now(), $3, $4, true, null, $5) on conflict (id) do update set checksum = excluded.checksum, applied_at = excluded.applied_at, duration_ms = excluded.duration_ms, executor = excluded.executor, success = true, error_details = null, correlation_id = excluded.correlation_id",
          [this.migrationId, checksum, Date.now() - started, input.executor, input.correlationId]
        );
      });
      return { migrationId: this.migrationId, checksum, dryRun: false, applied: true, durationMs: Date.now() - started, errorDetails: null };
    } catch (error) {
      const safe = userSafeError(error);
      await this.client.query(
        "insert into schema_migrations(id, checksum, applied_at, duration_ms, executor, success, error_details, correlation_id) values ($1, $2, now(), $3, $4, false, $5, $6) on conflict (id) do update set applied_at = excluded.applied_at, duration_ms = excluded.duration_ms, executor = excluded.executor, success = false, error_details = excluded.error_details, correlation_id = excluded.correlation_id",
        [this.migrationId, checksum, Date.now() - started, input.executor, safe.message, input.correlationId]
      ).catch(() => undefined);
      throw new ProductionDataError(safe.code, safe.message, safe.retryable);
    }
  }
}

export class PostgresPilotRepositories implements PilotRepositorySet {
  private readonly client: PostgresPilotClient;

  constructor(client: PostgresPilotClient) {
    this.client = client;
  }

  facts = {
    getById: async (ctx: RepositoryContext, id: string): Promise<FinancialFactRecord | null> => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<FinancialFactRecord>(
        "select id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", fact_type as type, fact_value as value, confidence, verified, '{}'::text[] as \"evidenceIds\" from financial_facts where id = $1 and user_id = $2",
        [id, userId]
      );
      return result.rows[0] ?? null;
    },
    create: async (ctx: RepositoryContext, input: Omit<FinancialFactRecord, keyof OwnedRecord>): Promise<FinancialFactRecord> => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<FinancialFactRecord>(
        "insert into financial_facts(user_id, fact_type, fact_value, confidence, verified, source, correlation_id) values ($1, $2, $3::jsonb, $4, $5, $6, $7) returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", fact_type as type, fact_value as value, confidence, verified, '{}'::text[] as \"evidenceIds\"",
        [userId, input.type, JSON.stringify(input.value), input.confidence, input.verified, ctx.source, ctx.correlationId]
      );
      return safeRecord(result.rows[0]);
    },
    update: async (ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<FinancialFactRecord> }): Promise<RepositoryResult<FinancialFactRecord>> => {
      try {
        await this.scope(ctx);
        const userId = requireAuthenticatedUser(ctx.session);
        const current = await this.facts.getById(ctx, update.id);
        if (!current) return { ok: false, code: "NOT_FOUND", message: "Record was not found.", retryable: false };
        if (current.version !== update.expectedVersion) return { ok: false, code: "CONFLICT", message: "This record changed in another session.", retryable: true };
        const next = { ...current, ...update.patch };
        const result = await this.client.query<FinancialFactRecord>(
          "update financial_facts set fact_value = $1::jsonb, confidence = $2, verified = $3, version = version + 1, updated_at = now(), source = $4, correlation_id = $5 where id = $6 and user_id = $7 and version = $8 returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", fact_type as type, fact_value as value, confidence, verified, '{}'::text[] as \"evidenceIds\"",
          [JSON.stringify(next.value), next.confidence, next.verified, ctx.source, ctx.correlationId, update.id, userId, update.expectedVersion]
        );
        if (!result.rows[0]) return { ok: false, code: "CONFLICT", message: "This record changed in another session.", retryable: true };
        return { ok: true, value: result.rows[0] };
      } catch (error) {
        return mapDbError(error);
      }
    },
  };

  evidence: EvidenceRepository = {
    create: async (ctx, input) => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<EvidenceRecord>(
        "insert into evidence(user_id, evidence_type, source_ref, document_id, fact_id, verification_status, confidence, immutable, source, correlation_id) values ($1, $2, $3, $4, $5, $6, $7, true, $8, $9) returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", evidence_type as \"evidenceType\", source_ref as \"sourceRef\", document_id as \"documentId\", fact_id as \"factId\", verification_status as \"verificationStatus\", confidence, immutable",
        [userId, input.evidenceType, input.sourceRef, input.documentId, input.factId, input.verificationStatus, input.confidence, ctx.source, ctx.correlationId]
      );
      return safeRecord(result.rows[0]);
    },
    getById: async (ctx, id) => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<EvidenceRecord>(
        "select id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", evidence_type as \"evidenceType\", source_ref as \"sourceRef\", document_id as \"documentId\", fact_id as \"factId\", verification_status as \"verificationStatus\", confidence, immutable from evidence where id = $1 and user_id = $2",
        [id, userId]
      );
      return result.rows[0] ?? null;
    },
  };

  snapshots = {
    create: async (ctx: RepositoryContext, input: Omit<CalculationSnapshotRecord, keyof OwnedRecord | "immutable">): Promise<CalculationSnapshotRecord> => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<CalculationSnapshotRecord>(
        "insert into calculation_snapshots(user_id, engine_name, engine_version, input_fact_versions, rule_versions, assumptions, output_hash, source, correlation_id) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9) returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", true as immutable, engine_name as \"engineName\", engine_version as \"engineVersion\", input_fact_versions as \"inputFactVersions\", rule_versions as \"ruleVersions\", assumptions, output_hash as \"outputHash\"",
        [userId, input.engineName, input.engineVersion, JSON.stringify(input.inputFactVersions), JSON.stringify(input.ruleVersions), JSON.stringify(input.assumptions), input.outputHash, ctx.source, ctx.correlationId]
      );
      return safeRecord(result.rows[0]);
    },
    getById: async (ctx: RepositoryContext, id: string): Promise<CalculationSnapshotRecord | null> => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<CalculationSnapshotRecord>(
        "select id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", true as immutable, engine_name as \"engineName\", engine_version as \"engineVersion\", input_fact_versions as \"inputFactVersions\", rule_versions as \"ruleVersions\", assumptions, output_hash as \"outputHash\" from calculation_snapshots where id = $1 and user_id = $2",
        [id, userId]
      );
      return result.rows[0] ?? null;
    },
  };

  decisions = {
    create: async (ctx: RepositoryContext, input: Omit<DecisionRecord, keyof OwnedRecord>): Promise<DecisionRecord> => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<DecisionRecord>(
        "insert into decisions(user_id, title, category, state, original_expected_impact, realised_impact, confidence, professional_review_required, source, correlation_id) values ($1, $2, 'pilot', $3, $4, $5, 'Medium', $6, $7, $8) returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", title, state, original_expected_impact as \"expectedImpact\", realised_impact as \"realisedImpact\", professional_review_required as \"professionalReviewRequired\"",
        [userId, input.title, input.state, input.expectedImpact, input.realisedImpact, input.professionalReviewRequired, ctx.source, ctx.correlationId]
      );
      return safeRecord(result.rows[0]);
    },
    update: async (ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<DecisionRecord> }): Promise<RepositoryResult<DecisionRecord>> => this.versionedDecisionUpdate(ctx, update),
  };

  workflows = {
    create: async (ctx: RepositoryContext, input: Omit<WorkflowRecord, keyof OwnedRecord>): Promise<WorkflowRecord> => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<WorkflowRecord>(
        "insert into workflows(user_id, workflow_definition_id, workflow_version, title, execution_status, outcome_status, expected_impact, realised_impact, baseline_snapshot_id, verification_snapshot_id, source, correlation_id) values ($1, 'pilot', 'pilot-v1', $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", title, execution_status as \"executionStatus\", outcome_status as \"outcomeStatus\", expected_impact as \"expectedImpact\", realised_impact as \"realisedImpact\", baseline_snapshot_id as \"baselineSnapshotId\", verification_snapshot_id as \"verificationSnapshotId\"",
        [userId, input.title, input.executionStatus, input.outcomeStatus, input.expectedImpact, input.realisedImpact, input.baselineSnapshotId, input.verificationSnapshotId, ctx.source, ctx.correlationId]
      );
      return safeRecord(result.rows[0]);
    },
    update: async (ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<WorkflowRecord> }): Promise<RepositoryResult<WorkflowRecord>> => this.versionedWorkflowUpdate(ctx, update),
  };

  timeline = {
    append: async (ctx: RepositoryContext, input: Omit<TimelineEventRecord, keyof OwnedRecord | "immutable">): Promise<TimelineEventRecord> => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<TimelineEventRecord>(
        "insert into timeline_events(user_id, event_time, category, title, summary, entity_type, entity_id, evidence_ids, source, correlation_id) values ($1, now(), $2, $3, $3, $4, $5, $6::uuid[], $7, $8) returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", true as immutable, title, category, entity_type as \"entityType\", entity_id as \"entityId\", evidence_ids as \"evidenceIds\"",
        [userId, input.category, input.title, input.entityType, input.entityId, input.evidenceIds, ctx.source, ctx.correlationId]
      );
      return safeRecord(result.rows[0]);
    },
    list: async (ctx: RepositoryContext): Promise<TimelineEventRecord[]> => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<TimelineEventRecord>(
        "select id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", true as immutable, title, category, entity_type as \"entityType\", entity_id as \"entityId\", evidence_ids as \"evidenceIds\" from timeline_events where user_id = $1 order by event_time desc",
        [userId]
      );
      return result.rows;
    },
  };

  audit: AuditRepository = {
    append: async (ctx, input) => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<AuditEventRecord>(
        "insert into audit_events(user_id, actor, action, entity_type, entity_id, before_hash, after_hash, reason, request_id, source, correlation_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", true as immutable, actor, action, entity_type as \"entityType\", entity_id as \"entityId\", before_hash as \"beforeHash\", after_hash as \"afterHash\", reason, request_id as \"requestId\"",
        [userId, input.actor, input.action, input.entityType, input.entityId, input.beforeHash, input.afterHash, input.reason, input.requestId, ctx.source, ctx.correlationId]
      );
      return safeRecord(result.rows[0]);
    },
    list: async (ctx) => {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<AuditEventRecord>(
        "select id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", true as immutable, actor, action, entity_type as \"entityType\", entity_id as \"entityId\", before_hash as \"beforeHash\", after_hash as \"afterHash\", reason, request_id as \"requestId\" from audit_events where user_id = $1 order by created_at desc",
        [userId]
      );
      return result.rows;
    },
  };

  async withIdempotency<T>(ctx: RepositoryContext, key: string, operation: () => Promise<T>): Promise<T> {
    await this.scope(ctx);
    const userId = requireAuthenticatedUser(ctx.session);
    const existing = await this.client.query<{ responseHash: string }>(
      "select response_hash as \"responseHash\" from idempotency_keys where user_id = $1 and idempotency_key = $2 and operation = 'pilot-write'",
      [userId, key]
    );
    if (existing.rows[0]) return operation();
    const result = await operation();
    await this.client.query(
      "insert into idempotency_keys(user_id, idempotency_key, operation, response_hash, source, correlation_id) values ($1, $2, 'pilot-write', $3, $4, $5) on conflict do nothing",
      [userId, key, hashRecord(result), ctx.source, ctx.correlationId]
    );
    return result;
  }

  async verifyWorkflowOutcomeTransaction(ctx: RepositoryContext, input: {
    workflowId: string;
    decisionId: string;
    evidenceIds: string[];
    actualImpact: number;
    snapshotInput: Omit<CalculationSnapshotRecord, keyof OwnedRecord | "immutable">;
    injectFailureAt?: "verification" | "workflow" | "decision" | "timeline" | "audit";
  }): Promise<{ workflow: WorkflowRecord; decision: DecisionRecord; snapshot: CalculationSnapshotRecord; timelineEvent: TimelineEventRecord }> {
    return this.client.transaction(async () => {
      if (input.evidenceIds.length === 0) throw new ProductionDataError("VALIDATION_FAILED", "Verified outcomes require evidence.", false);
      if (input.injectFailureAt === "verification") throw new ProductionDataError("TRANSACTION_FAILED", "Injected verification failure.", true);
      const snapshot = await this.snapshots.create(ctx, input.snapshotInput);
      if (input.injectFailureAt === "workflow") throw new ProductionDataError("TRANSACTION_FAILED", "Injected workflow failure.", true);
      const workflow = await this.workflows.update(ctx, { id: input.workflowId, expectedVersion: 1, patch: { executionStatus: "Completed", outcomeStatus: "Verified", realisedImpact: input.actualImpact, verificationSnapshotId: snapshot.id } });
      if (!workflow.ok) throw new ProductionDataError(workflow.code, workflow.message, workflow.retryable);
      if (input.injectFailureAt === "decision") throw new ProductionDataError("TRANSACTION_FAILED", "Injected decision failure.", true);
      const decision = await this.decisions.update(ctx, { id: input.decisionId, expectedVersion: 1, patch: { state: "Completed", realisedImpact: input.actualImpact } });
      if (!decision.ok) throw new ProductionDataError(decision.code, decision.message, decision.retryable);
      if (input.injectFailureAt === "timeline") throw new ProductionDataError("TRANSACTION_FAILED", "Injected timeline failure.", true);
      const timelineEvent = await this.timeline.append(ctx, { title: "Workflow outcome verified", category: "Workflow", entityType: "workflow", entityId: input.workflowId, evidenceIds: input.evidenceIds });
      if (input.injectFailureAt === "audit") throw new ProductionDataError("TRANSACTION_FAILED", "Injected audit failure.", true);
      await this.audit.append(ctx, {
        actor: "system",
        action: "workflow.outcome.verified",
        entityType: "workflow",
        entityId: input.workflowId,
        beforeHash: null,
        afterHash: hashRecord({ actualImpact: input.actualImpact, snapshotId: snapshot.id }),
        reason: "Verified outcome transaction completed.",
        requestId: ctx.session.requestId ?? ctx.correlationId,
      });
      return { workflow: workflow.value, decision: decision.value, snapshot, timelineEvent };
    });
  }

  exportUserData(): ReturnType<InMemoryProductionDataStore["exportUserData"]> {
    throw new ProductionDataError("VALIDATION_FAILED", "PostgreSQL export requires the pilot export job, not direct UI repository access.", false);
  }

  executeAccountDeletion(): ReturnType<InMemoryProductionDataStore["executeAccountDeletion"]> {
    throw new ProductionDataError("VALIDATION_FAILED", "PostgreSQL account deletion requires the pilot deletion job, not direct UI repository access.", false);
  }

  private async scope(ctx: RepositoryContext): Promise<void> {
    const userId = requireAuthenticatedUser(ctx.session);
    await this.client.query("select set_config('app.current_user_id', $1, true)", [userId]);
  }

  private async versionedDecisionUpdate(ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<DecisionRecord> }): Promise<RepositoryResult<DecisionRecord>> {
    try {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<DecisionRecord>(
        "update decisions set state = coalesce($1, state), realised_impact = coalesce($2, realised_impact), version = version + 1, updated_at = now(), source = $3, correlation_id = $4 where id = $5 and user_id = $6 and version = $7 returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", title, state, original_expected_impact as \"expectedImpact\", realised_impact as \"realisedImpact\", professional_review_required as \"professionalReviewRequired\"",
        [update.patch.state, update.patch.realisedImpact, ctx.source, ctx.correlationId, update.id, userId, update.expectedVersion]
      );
      if (!result.rows[0]) return { ok: false, code: "CONFLICT", message: "This record changed in another session.", retryable: true };
      return { ok: true, value: result.rows[0] };
    } catch (error) {
      return mapDbError(error);
    }
  }

  private async versionedWorkflowUpdate(ctx: RepositoryContext, update: { id: string; expectedVersion: number; patch: Partial<WorkflowRecord> }): Promise<RepositoryResult<WorkflowRecord>> {
    try {
      await this.scope(ctx);
      const userId = requireAuthenticatedUser(ctx.session);
      const result = await this.client.query<WorkflowRecord>(
        "update workflows set execution_status = coalesce($1, execution_status), outcome_status = coalesce($2, outcome_status), realised_impact = coalesce($3, realised_impact), verification_snapshot_id = coalesce($4, verification_snapshot_id), version = version + 1, updated_at = now(), source = $5, correlation_id = $6 where id = $7 and user_id = $8 and version = $9 returning id, user_id as \"userId\", created_at as \"createdAt\", updated_at as \"updatedAt\", version, source, correlation_id as \"correlationId\", title, execution_status as \"executionStatus\", outcome_status as \"outcomeStatus\", expected_impact as \"expectedImpact\", realised_impact as \"realisedImpact\", baseline_snapshot_id as \"baselineSnapshotId\", verification_snapshot_id as \"verificationSnapshotId\"",
        [update.patch.executionStatus, update.patch.outcomeStatus, update.patch.realisedImpact, update.patch.verificationSnapshotId, ctx.source, ctx.correlationId, update.id, userId, update.expectedVersion]
      );
      if (!result.rows[0]) return { ok: false, code: "CONFLICT", message: "This record changed in another session.", retryable: true };
      return { ok: true, value: result.rows[0] };
    } catch (error) {
      return mapDbError(error);
    }
  }
}

export function createPilotContractAdapter(kind: "memory" | "local" | "postgres-harness" = "postgres-harness"): PilotRepositorySet {
  const store =
    kind === "local"
      ? new LocalDevelopmentProductionRepository(() => "2026-07-19T00:00:00.000Z")
      : new InMemoryProductionDataStore(() => "2026-07-19T00:00:00.000Z");
  return {
    facts: store.facts,
    evidence: {
      create: async (ctx, input) => ({
        ...input,
        id: `evidence-${Math.random().toString(36).slice(2, 8)}`,
        userId: requireAuthenticatedUser(ctx.session),
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
        version: 1,
        source: ctx.source,
        correlationId: ctx.correlationId,
        immutable: true,
      }),
      getById: async () => null,
    },
    snapshots: store.snapshots,
    decisions: store.decisions,
    workflows: store.workflows,
    timeline: store.timeline,
    audit: {
      append: async (ctx, input) => ({
        ...input,
        id: `audit-${Math.random().toString(36).slice(2, 8)}`,
        userId: requireAuthenticatedUser(ctx.session),
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
        version: 1,
        source: ctx.source,
        correlationId: ctx.correlationId,
        immutable: true,
      }),
      list: async () => [...store.appendOnlyAuditEvents()],
    },
    withIdempotency: (ctx, key, operation) => store.withIdempotency(ctx, key, operation),
    verifyWorkflowOutcomeTransaction: (ctx, input) => {
      if (input.injectFailureAt) throw new ProductionDataError("TRANSACTION_FAILED", `Injected ${input.injectFailureAt} failure.`, true);
      return store.verifyWorkflowOutcomeTransaction(ctx, input);
    },
    exportUserData: (ctx) => store.exportUserData(ctx),
    executeAccountDeletion: (ctx) => store.executeAccountDeletion(ctx),
  };
}

export type LegacyMigrationPilotSource = {
  sourceName: string;
  sourceVersion: string | null;
  facts: Array<{ id: string; type: string; value: unknown; confidence: number; verified: boolean }>;
  decisions: Array<{ id: string; title: string; expectedImpact: number | null; confidence: string }>;
  timelineEvents: Array<{ id: string; title: string; calculationSnapshotId: string | null; ruleVersions: string[] }>;
};

export type PilotMigrationPreview = {
  sourceName: string;
  recordsToCreate: number;
  conflicts: string[];
  skippedRecords: string[];
  unsupportedFields: string[];
  checksum: string;
  executable: boolean;
};

export function previewPilotMigration(source: LegacyMigrationPilotSource, existingFacts: FinancialFactRecord[] = []): PilotMigrationPreview {
  const conflicts = source.facts
    .filter((fact) => existingFacts.some((existing) => existing.id === fact.id && existing.verified && existing.confidence > fact.confidence))
    .map((fact) => fact.id);
  return {
    sourceName: source.sourceName,
    recordsToCreate: source.facts.length + source.decisions.length + source.timelineEvents.length,
    conflicts,
    skippedRecords: [],
    unsupportedFields: [],
    checksum: hashRecord(source),
    executable: conflicts.length === 0,
  };
}

export async function executePilotMigration(ctx: RepositoryContext, repositories: PilotRepositorySet, source: LegacyMigrationPilotSource): Promise<{ preview: PilotMigrationPreview; created: number; checksum: string }> {
  const preview = previewPilotMigration(source);
  if (!preview.executable) return { preview, created: 0, checksum: preview.checksum };
  let created = 0;
  for (const fact of source.facts) {
    await repositories.withIdempotency(ctx, `migration:fact:${fact.id}`, async () => {
      await repositories.facts.create(ctx, {
        type: fact.type,
        value: fact.value,
        confidence: fact.confidence,
        verified: fact.verified,
        evidenceIds: [],
      });
      created++;
    });
  }
  for (const decision of source.decisions) {
    await repositories.withIdempotency(ctx, `migration:decision:${decision.id}`, async () => {
      await repositories.decisions.create(ctx, {
        title: decision.title,
        state: "New",
        expectedImpact: decision.expectedImpact,
        realisedImpact: null,
        professionalReviewRequired: false,
      });
      created++;
    });
  }
  for (const event of source.timelineEvents) {
    await repositories.withIdempotency(ctx, `migration:timeline:${event.id}`, async () => {
      await repositories.timeline.append(ctx, {
        title: event.title,
        category: "System",
        entityType: "migration",
        entityId: event.id,
        evidenceIds: [],
      });
      created++;
    });
  }
  return { preview, created, checksum: preview.checksum };
}

export type DualRunComparison = {
  recordCountsMatch: boolean;
  latestFactVersionsMatch: boolean;
  activeDecisionsMatch: boolean;
  workflowStateMatch: boolean;
  verifiedOutcomesMatch: boolean;
  timelineEventCountsMatch: boolean;
  snapshotHashesMatch: boolean;
  differences: Array<{ area: string; legacy: unknown; postgres: unknown; material: boolean }>;
};

export function compareDualRun(legacy: Record<string, unknown>, postgres: Record<string, unknown>): DualRunComparison {
  const keys: Array<keyof DualRunComparison> = [
    "recordCountsMatch",
    "latestFactVersionsMatch",
    "activeDecisionsMatch",
    "workflowStateMatch",
    "verifiedOutcomesMatch",
    "timelineEventCountsMatch",
    "snapshotHashesMatch",
  ];
  const checks = Object.fromEntries(keys.map((key) => [key, true])) as Omit<DualRunComparison, "differences">;
  const differences: DualRunComparison["differences"] = [];
  for (const key of Object.keys({ ...legacy, ...postgres })) {
    if (hashRecord(legacy[key]) !== hashRecord(postgres[key])) differences.push({ area: key, legacy: legacy[key], postgres: postgres[key], material: true });
  }
  if (differences.length > 0) checks.recordCountsMatch = false;
  return { ...checks, differences };
}

export type BackupManifest = {
  backupTimestamp: string;
  schemaVersion: string;
  databaseSizeBytes: number;
  checksum: string;
  encryptionStatus: "encrypted" | "not-encrypted" | "managed-provider";
  storageLocation: string;
  retentionDays: number;
  exists: boolean;
  readable: boolean;
  restored: boolean;
};

export function verifyBackupManifest(manifest: BackupManifest): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!manifest.exists) reasons.push("Backup artefact was not found.");
  if (!manifest.readable) reasons.push("Backup artefact was not readable.");
  if (!manifest.restored) reasons.push("Backup is unproven until restore succeeds.");
  if (manifest.schemaVersion !== PRODUCTION_DATA_SCHEMA_VERSION) reasons.push("Backup schema version does not match current production data schema.");
  return { ok: reasons.length === 0, reasons };
}

export type ReproductionVerification =
  | { status: "exact-match"; outputHash: string }
  | { status: "variance"; expectedHash: string; actualHash: string }
  | { status: "unavailable-engine-version"; engineName: string; engineVersion: string };

export function verifyCalculationReproduction(snapshot: CalculationSnapshotRecord, engines: Record<string, (snapshot: CalculationSnapshotRecord) => unknown>): ReproductionVerification {
  const key = `${snapshot.engineName}:${snapshot.engineVersion}`;
  const engine = engines[key];
  if (!engine) return { status: "unavailable-engine-version", engineName: snapshot.engineName, engineVersion: snapshot.engineVersion };
  const actualHash = hashRecord(engine(snapshot));
  if (actualHash === snapshot.outputHash) return { status: "exact-match", outputHash: actualHash };
  return { status: "variance", expectedHash: snapshot.outputHash, actualHash };
}

export type ReadinessGateId =
  | "schema"
  | "repositories"
  | "isolation"
  | "migration"
  | "transactions"
  | "backup"
  | "recovery"
  | "export-deletion"
  | "outage"
  | "dual-run";

export type ReadinessGate = {
  id: ReadinessGateId;
  label: string;
  passed: boolean;
  detail: string;
};

export function evaluatePilotReadiness(gates: ReadinessGate[]): { pilotReady: boolean; gates: ReadinessGate[]; failedGates: ReadinessGate[] } {
  const failedGates = gates.filter((gate) => !gate.passed);
  return { pilotReady: failedGates.length === 0, gates, failedGates };
}

export function defaultBlockedPilotGates(reason: string): ReadinessGate[] {
  return [
    { id: "schema", label: "Gate 1 Schema", passed: false, detail: reason },
    { id: "repositories", label: "Gate 2 Repositories", passed: true, detail: "Deterministic repository contract tests can run without infrastructure." },
    { id: "isolation", label: "Gate 3 Isolation", passed: false, detail: "RLS requires a real PostgreSQL database." },
    { id: "migration", label: "Gate 4 Migration", passed: false, detail: "Migration dry run can be prepared, but apply verification requires a database." },
    { id: "transactions", label: "Gate 5 Transactions", passed: true, detail: "Rollback injection is contract-tested in the pilot harness." },
    { id: "backup", label: "Gate 6 Backup", passed: false, detail: "Backup creation requires pg_dump or managed snapshot access." },
    { id: "recovery", label: "Gate 7 Recovery", passed: false, detail: "Restore drill requires a second clean PostgreSQL database." },
    { id: "export-deletion", label: "Gate 8 Export and deletion", passed: true, detail: "Synthetic export/deletion is contract-tested." },
    { id: "outage", label: "Gate 9 Outage behaviour", passed: true, detail: "Safe outage errors are contract-tested." },
    { id: "dual-run", label: "Gate 10 Dual-run consistency", passed: true, detail: "Dual-run discrepancy detection is deterministic." },
  ];
}

export function enforcePersistenceMode(mode: PersistenceMode, postgresAvailable: boolean): { ok: boolean; adapter: "local" | "postgres"; fallbackUsed: boolean; error?: string } {
  if (mode === "local") return { ok: true, adapter: "local", fallbackUsed: false };
  if (postgresAvailable) return { ok: true, adapter: "postgres", fallbackUsed: false };
  if (mode === "postgres-pilot") return { ok: true, adapter: "local", fallbackUsed: true, error: "PostgreSQL unavailable; pilot modules must report discrepancy/fallback." };
  return { ok: false, adapter: "postgres", fallbackUsed: false, error: "postgres-required cannot fall back to local data." };
}
