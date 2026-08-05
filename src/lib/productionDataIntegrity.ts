import { createHash, randomUUID } from "crypto";

export const PRODUCTION_DATA_SCHEMA_VERSION = "production-data-integrity-v1";

export type DataMode = "live" | "demo" | "test" | "local-development";
export type SensitivityClass =
  | "identity"
  | "financial-account"
  | "income"
  | "asset-debt"
  | "tax-document"
  | "transaction"
  | "adviser-communication"
  | "generated-recommendation"
  | "authentication"
  | "operational";

export type SafeErrorCode =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UNSAFE_CLIENT_FIELD"
  | "DEMO_LIVE_BOUNDARY"
  | "CONFIGURATION_INVALID"
  | "NOT_FOUND"
  | "TRANSACTION_FAILED"
  | "VALIDATION_FAILED";

export class ProductionDataError extends Error {
  public readonly code: SafeErrorCode;
  public readonly retryable: boolean;

  constructor(
    code: SafeErrorCode,
    message: string,
    retryable = false
  ) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export type AuthenticatedSession = {
  userId: string | null;
  expiresAt: string | null;
  revoked?: boolean;
  actor?: "user" | "system" | "admin";
  requestId?: string;
};

export type OwnedRecord = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  source: string;
  correlationId: string;
  immutable?: boolean;
  dataMode?: DataMode;
};

export type FinancialFactRecord = OwnedRecord & {
  type: string;
  value: unknown;
  confidence: number;
  verified: boolean;
  evidenceIds: string[];
};

export type DocumentRecord = OwnedRecord & {
  title: string;
  documentType: string;
  storageRef: string;
  extractionStatus: "pending" | "extracted" | "needs-review" | "failed";
  sensitivity: SensitivityClass;
};

export type CalculationSnapshotRecord = OwnedRecord & {
  immutable: true;
  engineName: string;
  engineVersion: string;
  inputFactVersions: Array<{ factId: string; version: number }>;
  ruleVersions: Array<{ ruleId: string; version: string }>;
  assumptions: Record<string, unknown>;
  outputHash: string;
};

export type DecisionRecord = OwnedRecord & {
  title: string;
  state: string;
  expectedImpact: number | null;
  realisedImpact: number | null;
  professionalReviewRequired: boolean;
};

export type WorkflowRecord = OwnedRecord & {
  title: string;
  executionStatus: string;
  outcomeStatus: string;
  expectedImpact: number | null;
  realisedImpact: number | null;
  baselineSnapshotId: string | null;
  verificationSnapshotId: string | null;
};

export type TimelineEventRecord = OwnedRecord & {
  immutable: true;
  title: string;
  category: string;
  entityType: string;
  entityId: string;
  evidenceIds: string[];
};

export type AuditEventRecord = OwnedRecord & {
  immutable: true;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeHash: string | null;
  afterHash: string | null;
  reason: string;
  requestId: string;
};

export type BackgroundJobRecord = OwnedRecord & {
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  errorClass: string | null;
};

export type UserExport = {
  manifest: {
    exportDate: string;
    schemaVersion: string;
    userIdHash: string;
    includedSections: string[];
    omittedSections: string[];
    checksums: Record<string, string>;
  };
  financialFacts: FinancialFactRecord[];
  documents: Omit<DocumentRecord, "storageRef">[];
  decisions: DecisionRecord[];
  workflows: WorkflowRecord[];
  timelineEvents: TimelineEventRecord[];
  calculationSnapshots: CalculationSnapshotRecord[];
};

export type ProductionConfig = {
  mode: DataMode;
  databaseUrl?: string;
  authProviderConfigured?: boolean;
  encryptionKeyConfigured?: boolean;
  allowedOrigins?: string[];
  applicationUrl?: string;
  backgroundJobsConfigured?: boolean;
  persistenceFallback?: "none" | "local-json" | "memory";
};

export type ProductionReadinessCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type ProductionReadinessReport = {
  ok: boolean;
  schemaVersion: string;
  persistenceMode: DataMode;
  checks: ProductionReadinessCheck[];
  generatedAt: string;
};

export type RepositoryContext = {
  session: AuthenticatedSession;
  correlationId: string;
  source: string;
  dataMode: DataMode;
};

export type VersionedUpdate<T> = {
  id: string;
  expectedVersion: number;
  patch: Partial<T>;
};

export type RepositoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: SafeErrorCode; message: string; retryable: boolean };

export interface FinancialFactRepository {
  getById(ctx: RepositoryContext, id: string): Promise<FinancialFactRecord | null>;
  create(ctx: RepositoryContext, input: Omit<FinancialFactRecord, keyof OwnedRecord>): Promise<FinancialFactRecord>;
  update(ctx: RepositoryContext, update: VersionedUpdate<FinancialFactRecord>): Promise<RepositoryResult<FinancialFactRecord>>;
}

export interface DocumentRepository {
  create(ctx: RepositoryContext, input: Omit<DocumentRecord, keyof OwnedRecord>): Promise<DocumentRecord>;
  list(ctx: RepositoryContext): Promise<DocumentRecord[]>;
}

export interface CalculationSnapshotRepository {
  create(ctx: RepositoryContext, input: Omit<CalculationSnapshotRecord, keyof OwnedRecord | "immutable">): Promise<CalculationSnapshotRecord>;
  getById(ctx: RepositoryContext, id: string): Promise<CalculationSnapshotRecord | null>;
}

export interface DigitalTwinRepository {
  saveScenario(ctx: RepositoryContext, scenario: Record<string, unknown> & { id?: string; version?: number }): Promise<OwnedRecord & { scenario: Record<string, unknown> }>;
}

export interface DecisionRepository {
  create(ctx: RepositoryContext, input: Omit<DecisionRecord, keyof OwnedRecord>): Promise<DecisionRecord>;
  update(ctx: RepositoryContext, update: VersionedUpdate<DecisionRecord>): Promise<RepositoryResult<DecisionRecord>>;
}

export interface WorkflowRepository {
  create(ctx: RepositoryContext, input: Omit<WorkflowRecord, keyof OwnedRecord>): Promise<WorkflowRecord>;
  update(ctx: RepositoryContext, update: VersionedUpdate<WorkflowRecord>): Promise<RepositoryResult<WorkflowRecord>>;
}

export interface TimelineRepository {
  append(ctx: RepositoryContext, input: Omit<TimelineEventRecord, keyof OwnedRecord | "immutable">): Promise<TimelineEventRecord>;
  list(ctx: RepositoryContext): Promise<TimelineEventRecord[]>;
}

export interface AICfoRepository {
  persistQuestionAndAnswer(ctx: RepositoryContext, input: { question: Record<string, unknown>; answer: Record<string, unknown> }): Promise<OwnedRecord & { question: Record<string, unknown>; answer: Record<string, unknown> }>;
}

export interface DailyReviewRepository {
  persistReview(ctx: RepositoryContext, review: Record<string, unknown> & { id?: string }): Promise<OwnedRecord & { review: Record<string, unknown> }>;
}

export type ProductionRepositories = {
  facts: FinancialFactRepository;
  documents: DocumentRepository;
  snapshots: CalculationSnapshotRepository;
  digitalTwin: DigitalTwinRepository;
  decisions: DecisionRepository;
  workflows: WorkflowRepository;
  timeline: TimelineRepository;
  aiCfo: AICfoRepository;
  dailyReview: DailyReviewRepository;
};

type InternalState = {
  facts: Map<string, FinancialFactRecord>;
  documents: Map<string, DocumentRecord>;
  snapshots: Map<string, CalculationSnapshotRecord>;
  decisions: Map<string, DecisionRecord>;
  workflows: Map<string, WorkflowRecord>;
  timelineEvents: Map<string, TimelineEventRecord>;
  auditEvents: AuditEventRecord[];
  idempotency: Map<string, unknown>;
  digitalTwinScenarios: Map<string, OwnedRecord & { scenario: Record<string, unknown> }>;
  aiCfoRuns: Map<string, OwnedRecord & { question: Record<string, unknown>; answer: Record<string, unknown> }>;
  dailyReviews: Map<string, OwnedRecord & { review: Record<string, unknown> }>;
  jobs: Map<string, BackgroundJobRecord>;
  deletionRequests: Map<string, OwnedRecord & { status: "queued" | "cancelled" | "completed" | "failed" }>;
};

function nowIso(clock?: () => string): string {
  return clock ? clock() : new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function hashRecord(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function requireAuthenticatedUser(session: AuthenticatedSession, now = new Date()): string {
  if (!session.userId) throw new ProductionDataError("UNAUTHENTICATED", "Your session has expired or is unavailable.", true);
  if (session.revoked) throw new ProductionDataError("SESSION_EXPIRED", "Your session has been revoked.", true);
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= now.getTime()) {
    throw new ProductionDataError("SESSION_EXPIRED", "Your session has expired.", true);
  }
  return session.userId;
}

export function assertUserOwnsRecord(session: AuthenticatedSession, record: { userId: string }, now = new Date()): void {
  const userId = requireAuthenticatedUser(session, now);
  if (record.userId !== userId) {
    throw new ProductionDataError("FORBIDDEN", "This record is not available for the current user.", false);
  }
}

const SERVER_OWNED_FIELDS = new Set([
  "userId",
  "user_id",
  "verified",
  "verifiedAt",
  "verificationStatus",
  "realisedImpact",
  "calculationOutput",
  "evidenceApproval",
  "professionalReviewCompleted",
  "professionalReviewRequired",
  "auditEvents",
  "immutable",
  "createdAt",
  "updatedAt",
  "version",
]);

export function rejectUnsafeClientFields(payload: Record<string, unknown>): void {
  for (const key of Object.keys(payload)) {
    if (SERVER_OWNED_FIELDS.has(key)) {
      throw new ProductionDataError("UNSAFE_CLIENT_FIELD", `Client input cannot set server-owned field: ${key}`, false);
    }
  }
}

export function assertDemoLiveSeparation(recordMode: DataMode | undefined, repositoryMode: DataMode): void {
  if (repositoryMode === "live" && recordMode === "demo") {
    throw new ProductionDataError("DEMO_LIVE_BOUNDARY", "Demo records cannot be written to live repositories.", false);
  }
  if (repositoryMode === "demo" && recordMode === "live") {
    throw new ProductionDataError("DEMO_LIVE_BOUNDARY", "Live records cannot be written to demo repositories.", false);
  }
}

export function redactSensitiveValues(input: unknown): unknown {
  if (typeof input === "string") {
    return input
      .replace(/\b\d{3}[- ]?\d{3}[- ]?\d{3}\b/g, "[REDACTED_TFN]")
      .replace(/\b\d{6,16}\b/g, "[REDACTED_ACCOUNT]")
      .replace(/(token|secret|password|api[_-]?key)=([^&\s]+)/gi, "$1=[REDACTED]");
  }
  if (Array.isArray(input)) return input.map(redactSensitiveValues);
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => {
        if (/token|secret|password|tfn|accountNumber|rawPayload/i.test(key)) return [key, "[REDACTED]"];
        return [key, redactSensitiveValues(value)];
      })
    );
  }
  return input;
}

function owned<T extends object>(ctx: RepositoryContext, input: T, prefix: string, clock?: () => string): T & OwnedRecord {
  const userId = requireAuthenticatedUser(ctx.session);
  const at = nowIso(clock);
  assertDemoLiveSeparation((input as { dataMode?: DataMode }).dataMode, ctx.dataMode);
  return {
    ...input,
    id: (input as { id?: string }).id ?? id(prefix),
    userId,
    createdAt: at,
    updatedAt: at,
    version: 1,
    source: ctx.source,
    correlationId: ctx.correlationId,
    dataMode: ctx.dataMode,
  };
}

function cloneState(state: InternalState): InternalState {
  return {
    facts: new Map(state.facts),
    documents: new Map(state.documents),
    snapshots: new Map(state.snapshots),
    decisions: new Map(state.decisions),
    workflows: new Map(state.workflows),
    timelineEvents: new Map(state.timelineEvents),
    auditEvents: [...state.auditEvents],
    idempotency: new Map(state.idempotency),
    digitalTwinScenarios: new Map(state.digitalTwinScenarios),
    aiCfoRuns: new Map(state.aiCfoRuns),
    dailyReviews: new Map(state.dailyReviews),
    jobs: new Map(state.jobs),
    deletionRequests: new Map(state.deletionRequests),
  };
}

function emptyInternalState(): InternalState {
  return {
    facts: new Map(),
    documents: new Map(),
    snapshots: new Map(),
    decisions: new Map(),
    workflows: new Map(),
    timelineEvents: new Map(),
    auditEvents: [],
    idempotency: new Map(),
    digitalTwinScenarios: new Map(),
    aiCfoRuns: new Map(),
    dailyReviews: new Map(),
    jobs: new Map(),
    deletionRequests: new Map(),
  };
}

export class InMemoryProductionDataStore implements ProductionRepositories {
  private state = emptyInternalState();
  private readonly clock?: () => string;

  constructor(clock?: () => string) {
    this.clock = clock;
  }

  facts: FinancialFactRepository = {
    getById: async (ctx, factId) => this.getOwned(ctx, this.state.facts, factId),
    create: async (ctx, input) => {
      const record = owned(ctx, input, "fact", this.clock) as FinancialFactRecord;
      this.state.facts.set(record.id, record);
      this.appendAudit(ctx, "financial-fact.created", "financial_fact", record.id, null, record, "Fact created.");
      return record;
    },
    update: async (ctx, update) => this.versionedUpdate(ctx, this.state.facts, "financial_fact", update),
  };

  documents: DocumentRepository = {
    create: async (ctx, input) => {
      const record = owned(ctx, input, "document", this.clock) as DocumentRecord;
      this.state.documents.set(record.id, record);
      this.appendAudit(ctx, "document.created", "document", record.id, null, { ...record, storageRef: "[REDACTED]" }, "Document metadata created.");
      return record;
    },
    list: async (ctx) => {
      const userId = requireAuthenticatedUser(ctx.session);
      return [...this.state.documents.values()].filter((record) => record.userId === userId);
    },
  };

  snapshots: CalculationSnapshotRepository = {
    create: async (ctx, input) => {
      const record = { ...owned(ctx, input, "snapshot", this.clock), immutable: true as const } as CalculationSnapshotRecord;
      this.state.snapshots.set(record.id, record);
      this.appendAudit(ctx, "calculation-snapshot.created", "calculation_snapshot", record.id, null, record, "Calculation snapshot created.");
      return record;
    },
    getById: async (ctx, snapshotId) => this.getOwned(ctx, this.state.snapshots, snapshotId),
  };

  digitalTwin: DigitalTwinRepository = {
    saveScenario: async (ctx, scenario) => {
      const record = owned(ctx, { scenario: { ...scenario } }, "scenario", this.clock);
      this.state.digitalTwinScenarios.set(record.id, record);
      this.appendAudit(ctx, "digital-twin-scenario.saved", "digital_twin_scenario", record.id, null, record, "Scenario saved.");
      return record;
    },
  };

  decisions: DecisionRepository = {
    create: async (ctx, input) => {
      const record = owned(ctx, input, "decision", this.clock) as DecisionRecord;
      this.state.decisions.set(record.id, record);
      this.appendAudit(ctx, "decision.created", "decision", record.id, null, record, "Decision created.");
      return record;
    },
    update: async (ctx, update) => this.versionedUpdate(ctx, this.state.decisions, "decision", update),
  };

  workflows: WorkflowRepository = {
    create: async (ctx, input) => {
      const record = owned(ctx, input, "workflow", this.clock) as WorkflowRecord;
      this.state.workflows.set(record.id, record);
      this.appendAudit(ctx, "workflow.created", "workflow", record.id, null, record, "Workflow created.");
      return record;
    },
    update: async (ctx, update) => this.versionedUpdate(ctx, this.state.workflows, "workflow", update),
  };

  timeline: TimelineRepository = {
    append: async (ctx, input) => {
      const record = { ...owned(ctx, input, "timeline", this.clock), immutable: true as const } as TimelineEventRecord;
      this.state.timelineEvents.set(record.id, record);
      this.appendAudit(ctx, "timeline-event.created", "timeline_event", record.id, null, record, "Timeline event appended.");
      return record;
    },
    list: async (ctx) => {
      const userId = requireAuthenticatedUser(ctx.session);
      return [...this.state.timelineEvents.values()].filter((record) => record.userId === userId);
    },
  };

  aiCfo: AICfoRepository = {
    persistQuestionAndAnswer: async (ctx, input) => {
      const record = owned(ctx, input, "ai-cfo", this.clock);
      this.state.aiCfoRuns.set(record.id, record);
      this.appendAudit(ctx, "ai-cfo-answer.created", "ai_cfo_answer", record.id, null, record, "AI CFO grounded answer persisted.");
      return record;
    },
  };

  dailyReview: DailyReviewRepository = {
    persistReview: async (ctx, review) => {
      const record = owned(ctx, { review }, "daily-review", this.clock);
      this.state.dailyReviews.set(record.id, record);
      this.appendAudit(ctx, "daily-review.created", "daily_review", record.id, null, record, "Daily Review persisted.");
      return record;
    },
  };

  async withIdempotency<T>(ctx: RepositoryContext, key: string, operation: () => Promise<T>): Promise<T> {
    const scopedKey = `${ctx.session.userId}:${key}`;
    if (this.state.idempotency.has(scopedKey)) return this.state.idempotency.get(scopedKey) as T;
    const result = await operation();
    this.state.idempotency.set(scopedKey, result);
    return result;
  }

  async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const before = cloneState(this.state);
    try {
      return await operation();
    } catch (error) {
      this.state = before;
      throw error;
    }
  }

  async verifyWorkflowOutcomeTransaction(ctx: RepositoryContext, input: {
    workflowId: string;
    decisionId: string;
    evidenceIds: string[];
    actualImpact: number;
    snapshotInput: Omit<CalculationSnapshotRecord, keyof OwnedRecord | "immutable">;
  }): Promise<{ workflow: WorkflowRecord; decision: DecisionRecord; snapshot: CalculationSnapshotRecord; timelineEvent: TimelineEventRecord }> {
    return this.withTransaction(async () => {
      const workflow = await this.getOwned(ctx, this.state.workflows, input.workflowId);
      const decision = await this.getOwned(ctx, this.state.decisions, input.decisionId);
      if (!workflow || !decision) throw new ProductionDataError("NOT_FOUND", "Workflow or decision was not found.", false);
      if (input.evidenceIds.length === 0) throw new ProductionDataError("VALIDATION_FAILED", "Verified outcomes require evidence.", false);
      const snapshot = await this.snapshots.create(ctx, input.snapshotInput);
      const updatedWorkflow = await this.workflows.update(ctx, {
        id: workflow.id,
        expectedVersion: workflow.version,
        patch: {
          outcomeStatus: "Verified",
          executionStatus: "Completed",
          realisedImpact: input.actualImpact,
          verificationSnapshotId: snapshot.id,
        },
      });
      const updatedDecision = await this.decisions.update(ctx, {
        id: decision.id,
        expectedVersion: decision.version,
        patch: { state: "Completed", realisedImpact: input.actualImpact },
      });
      if (!updatedWorkflow.ok || !updatedDecision.ok) throw new ProductionDataError("CONFLICT", "Outcome verification encountered a concurrent update.", true);
      const timelineEvent = await this.timeline.append(ctx, {
        title: "Workflow outcome verified",
        category: "Workflow",
        entityType: "workflow",
        entityId: workflow.id,
        evidenceIds: input.evidenceIds,
      });
      return { workflow: updatedWorkflow.value, decision: updatedDecision.value, snapshot, timelineEvent };
    });
  }

  appendOnlyAuditEvents(): readonly AuditEventRecord[] {
    return Object.freeze([...this.state.auditEvents]);
  }

  tryMutateAuditEvent(): never {
    throw new ProductionDataError("FORBIDDEN", "Audit history is append-only. Create a superseding event instead.", false);
  }

  async enqueueJob(ctx: RepositoryContext, input: Pick<BackgroundJobRecord, "type" | "maxAttempts">): Promise<BackgroundJobRecord> {
    const record = owned(ctx, {
      type: input.type,
      status: "queued" as const,
      attempts: 0,
      maxAttempts: input.maxAttempts,
      nextRetryAt: null,
      errorClass: null,
    }, "job", this.clock) as BackgroundJobRecord;
    this.state.jobs.set(record.id, record);
    return record;
  }

  async recordJobFailure(ctx: RepositoryContext, jobId: string, errorClass: string): Promise<BackgroundJobRecord> {
    const job = await this.getOwned(ctx, this.state.jobs, jobId);
    if (!job) throw new ProductionDataError("NOT_FOUND", "Job was not found.", false);
    const next: BackgroundJobRecord = {
      ...job,
      attempts: job.attempts + 1,
      status: job.attempts + 1 >= job.maxAttempts ? "failed" : "queued",
      errorClass,
      nextRetryAt: job.attempts + 1 >= job.maxAttempts ? null : nowIso(this.clock),
      updatedAt: nowIso(this.clock),
      version: job.version + 1,
    };
    this.state.jobs.set(job.id, next);
    return next;
  }

  async requestAccountDeletion(ctx: RepositoryContext): Promise<OwnedRecord & { status: "queued" | "cancelled" | "completed" | "failed" }> {
    const record = owned(ctx, { status: "queued" as const }, "deletion", this.clock);
    this.state.deletionRequests.set(record.id, record);
    this.appendAudit(ctx, "account-deletion.queued", "user", requireAuthenticatedUser(ctx.session), null, { status: "queued" }, "User requested account deletion.");
    return record;
  }

  async executeAccountDeletion(ctx: RepositoryContext): Promise<{ deleted: Record<string, number>; finalRecord: OwnedRecord & { status: "queued" | "cancelled" | "completed" | "failed" } }> {
    const userId = requireAuthenticatedUser(ctx.session);
    const deleteOwned = <T extends OwnedRecord>(map: Map<string, T>): number => {
      let count = 0;
      for (const [recordId, record] of map.entries()) {
        if (record.userId === userId) {
          map.delete(recordId);
          count++;
        }
      }
      return count;
    };
    const deleted = {
      facts: deleteOwned(this.state.facts),
      documents: deleteOwned(this.state.documents),
      snapshots: deleteOwned(this.state.snapshots),
      decisions: deleteOwned(this.state.decisions),
      workflows: deleteOwned(this.state.workflows),
      timelineEvents: deleteOwned(this.state.timelineEvents),
    };
    const finalRecord = owned(ctx, { status: "completed" as const }, "deletion-final", this.clock);
    this.state.deletionRequests.set(finalRecord.id, finalRecord);
    return { deleted, finalRecord };
  }

  exportUserData(ctx: RepositoryContext): UserExport {
    const userId = requireAuthenticatedUser(ctx.session);
    const byUser = <T extends OwnedRecord>(records: Iterable<T>) => [...records].filter((record) => record.userId === userId);
    const documents = byUser(this.state.documents.values()).map((document) => ({
      id: document.id,
      userId: document.userId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      version: document.version,
      source: document.source,
      correlationId: document.correlationId,
      immutable: document.immutable,
      dataMode: document.dataMode,
      title: document.title,
      documentType: document.documentType,
      extractionStatus: document.extractionStatus,
      sensitivity: document.sensitivity,
    }));
    const exportData = {
      financialFacts: byUser(this.state.facts.values()),
      documents,
      decisions: byUser(this.state.decisions.values()),
      workflows: byUser(this.state.workflows.values()),
      timelineEvents: byUser(this.state.timelineEvents.values()),
      calculationSnapshots: byUser(this.state.snapshots.values()),
    };
    const checksums = Object.fromEntries(Object.entries(exportData).map(([key, value]) => [key, hashRecord(value)]));
    return {
      manifest: {
        exportDate: nowIso(this.clock),
        schemaVersion: PRODUCTION_DATA_SCHEMA_VERSION,
        userIdHash: hashRecord(userId),
        includedSections: Object.keys(exportData),
        omittedSections: ["authentication_tokens", "internal_secrets", "raw_application_logs"],
        checksums,
      },
      ...exportData,
    };
  }

  private async getOwned<T extends OwnedRecord>(ctx: RepositoryContext, map: Map<string, T>, recordId: string): Promise<T | null> {
    const record = map.get(recordId);
    if (!record) return null;
    assertUserOwnsRecord(ctx.session, record);
    return record;
  }

  private async versionedUpdate<T extends OwnedRecord>(ctx: RepositoryContext, map: Map<string, T>, entityType: string, update: VersionedUpdate<T>): Promise<RepositoryResult<T>> {
    try {
      const current = await this.getOwned(ctx, map, update.id);
      if (!current) return { ok: false, code: "NOT_FOUND", message: "Record was not found.", retryable: false };
      if (current.immutable) return { ok: false, code: "FORBIDDEN", message: "Immutable records cannot be updated.", retryable: false };
      if (current.version !== update.expectedVersion) {
        return { ok: false, code: "CONFLICT", message: "This record changed in another session.", retryable: true };
      }
      const next = {
        ...current,
        ...update.patch,
        id: current.id,
        userId: current.userId,
        version: current.version + 1,
        updatedAt: nowIso(this.clock),
        source: ctx.source,
        correlationId: ctx.correlationId,
      };
      map.set(current.id, next);
      this.appendAudit(ctx, `${entityType}.updated`, entityType, current.id, current, next, "Record updated with optimistic concurrency.");
      return { ok: true, value: next };
    } catch (error) {
      if (error instanceof ProductionDataError) {
        return { ok: false, code: error.code, message: error.message, retryable: error.retryable };
      }
      return { ok: false, code: "TRANSACTION_FAILED", message: "Repository update failed.", retryable: true };
    }
  }

  private appendAudit(ctx: RepositoryContext, action: string, entityType: string, entityId: string, before: unknown, after: unknown, reason: string): void {
    const userId = requireAuthenticatedUser(ctx.session);
    const at = nowIso(this.clock);
    this.state.auditEvents.push({
      id: id("audit"),
      userId,
      createdAt: at,
      updatedAt: at,
      version: 1,
      source: ctx.source,
      correlationId: ctx.correlationId,
      immutable: true,
      actor: ctx.session.actor ?? "user",
      action,
      entityType,
      entityId,
      beforeHash: before == null ? null : hashRecord(redactSensitiveValues(before)),
      afterHash: after == null ? null : hashRecord(redactSensitiveValues(after)),
      reason,
      requestId: ctx.session.requestId ?? ctx.correlationId,
      dataMode: ctx.dataMode,
    });
  }
}

export class LocalDevelopmentProductionRepository extends InMemoryProductionDataStore {
  readonly storageAdapter = "local-development-json-boundary";
}

export type SqlExecutor = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

export class PostgreSqlProductionRepository {
  private readonly sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.sql = sql;
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    const result = await this.sql<{ ok: number }>("select 1 as ok");
    return { ok: result[0]?.ok === 1, detail: "PostgreSQL executor responded to select 1." };
  }

  scopedQuery<T>(ctx: RepositoryContext, sql: string, params: unknown[] = []): Promise<T[]> {
    const userId = requireAuthenticatedUser(ctx.session);
    return this.sql<T>(
      `select set_config('app.current_user_id', $1, true); ${sql}`,
      [userId, ...params]
    );
  }
}

export type LocalMigrationSource = {
  version: string | null;
  records: Array<{ id: string; type: string; value: unknown; confidence: number; verified: boolean }>;
  checksum?: string;
};

export type MigrationPreview = {
  sourceVersion: string | null;
  targetVersion: string;
  recordCount: number;
  unsupportedFields: string[];
  conflicts: Array<{ id: string; reason: string }>;
  checksum: string;
  safeToImport: boolean;
};

export function buildMigrationPreview(source: LocalMigrationSource, existingFacts: FinancialFactRecord[] = []): MigrationPreview {
  const existingById = new Map(existingFacts.map((fact) => [fact.id, fact]));
  const conflicts = source.records
    .filter((record) => {
      const existing = existingById.get(record.id);
      return Boolean(existing?.verified && existing.confidence > record.confidence);
    })
    .map((record) => ({ id: record.id, reason: "Existing verified fact has higher confidence." }));
  const unsupportedFields = source.records.flatMap((record) =>
    Object.keys(record).filter((key) => !["id", "type", "value", "confidence", "verified"].includes(key))
  );
  return {
    sourceVersion: source.version,
    targetVersion: PRODUCTION_DATA_SCHEMA_VERSION,
    recordCount: source.records.length,
    unsupportedFields: [...new Set(unsupportedFields)],
    conflicts,
    checksum: source.checksum ?? hashRecord(source.records),
    safeToImport: conflicts.length === 0,
  };
}

export async function importMigrationPreview(ctx: RepositoryContext, store: InMemoryProductionDataStore, source: LocalMigrationSource): Promise<MigrationPreview> {
  const preview = buildMigrationPreview(source);
  if (!preview.safeToImport) return preview;
  for (const record of source.records) {
    await store.facts.create(ctx, {
      type: record.type,
      value: record.value,
      confidence: record.confidence,
      verified: record.verified,
      evidenceIds: [],
    });
  }
  return preview;
}

export function validateProductionConfig(config: ProductionConfig): ProductionReadinessReport {
  const checks: ProductionReadinessCheck[] = [];
  const fail = (name: string, detail: string) => checks.push({ name, status: "fail" as const, detail });
  const warn = (name: string, detail: string) => checks.push({ name, status: "warn" as const, detail });
  const pass = (name: string, detail: string) => checks.push({ name, status: "pass" as const, detail });

  if (config.mode === "live") {
    if (config.databaseUrl) pass("Database", "DATABASE_URL configured.");
    else fail("Database", "Production requires a database connection.");
    if (config.authProviderConfigured) pass("Authentication", "Authentication provider configured.");
    else fail("Authentication", "Production requires authenticated server sessions.");
    if (config.encryptionKeyConfigured) pass("Encryption", "Encryption key material configured.");
    else fail("Encryption", "Production requires encryption key configuration.");
    if (config.allowedOrigins?.length) pass("Allowed origins", "Allowed origins configured.");
    else fail("Allowed origins", "Production requires explicit allowed origins.");
    if (config.applicationUrl) pass("Application URL", "Application URL configured.");
    else fail("Application URL", "Production requires canonical application URL.");
    if (config.backgroundJobsConfigured) pass("Background jobs", "Background job runner configured.");
    else warn("Background jobs", "Long-running operations need a configured worker before external beta.");
    if (config.persistenceFallback === "none") pass("Persistence fallback", "Unsafe local fallbacks disabled.");
    else fail("Persistence fallback", "Production cannot fall back to demo, memory or local JSON persistence.");
  } else {
    pass("Mode boundary", `${config.mode} mode is allowed to use non-production persistence.`);
    if (config.persistenceFallback && config.persistenceFallback !== "none") warn("Persistence fallback", `${config.persistenceFallback} fallback is non-production only.`);
  }

  return {
    ok: checks.every((check) => check.status !== "fail"),
    schemaVersion: PRODUCTION_DATA_SCHEMA_VERSION,
    persistenceMode: config.mode,
    checks,
    generatedAt: nowIso(),
  };
}

export function userSafeError(error: unknown): { message: string; code: SafeErrorCode; retryable: boolean } {
  if (error instanceof ProductionDataError) return { message: error.message, code: error.code, retryable: error.retryable };
  return { message: "Data temporarily unavailable.", code: "TRANSACTION_FAILED", retryable: true };
}

export type SourceFileForIntegrityScan = {
  path: string;
  content: string;
};

export type ForbiddenFinancialPersistenceDependency = {
  path: string;
  dependency:
    | "financialVaultStore"
    | "manualFinancialDataRepository"
    | "financialDigitalTwinStore"
    | "actionWorkflowStore"
    | "aiCfoStore"
    | "aiCfoDailyReviewStore"
    | "copilotHistoryLocalStore"
    | "goalPlanningLocalState"
    | ".ai/local-data"
    | "browserStorageAuthoritative";
  reason: string;
};

const DEFAULT_FINANCIAL_PERSISTENCE_ALLOWLIST = [
  "__tests__/",
  "docs/",
  "src/lib/manualFinancialDataPlatform.ts",
  "src/lib/financialVaultEmptyState.ts",
  "src/lib/productionDataIntegrity.ts",
  "src/lib/financialDigitalTwinStore.ts",
  "src/lib/actionWorkflowStore.ts",
  "src/lib/aiCfoStore.ts",
  "src/lib/aiCfoDailyReviewStore.ts",
] as const;

function normalisePathForScan(path: string): string {
  return path.replace(/\\/g, "/");
}

export function findForbiddenFinancialPersistenceDependencies(
  files: SourceFileForIntegrityScan[],
  allowlist: readonly string[] = DEFAULT_FINANCIAL_PERSISTENCE_ALLOWLIST,
): ForbiddenFinancialPersistenceDependency[] {
  return files.flatMap((file) => {
    const path = normalisePathForScan(file.path);
    if (allowlist.some((allowed) => path.includes(allowed))) return [];
    const findings: ForbiddenFinancialPersistenceDependency[] = [];
    if (/financialVaultStore/.test(file.content)) {
      findings.push({ path, dependency: "financialVaultStore", reason: "Active code must use PostgreSQL-backed Financial Vault services." });
    }
    if (/manualFinancialDataRepository/.test(file.content)) {
      findings.push({ path, dependency: "manualFinancialDataRepository", reason: "Active code must not read or write the retired manual platform JSON repository." });
    }
    if (/financialDigitalTwinStore/.test(file.content)) {
      findings.push({ path, dependency: "financialDigitalTwinStore", reason: "Active Digital Twin code must use PostgreSQL-backed scenario and simulation services." });
    }
    if (/actionWorkflowStore/.test(file.content)) {
      findings.push({ path, dependency: "actionWorkflowStore", reason: "Active workflow code must use PostgreSQL-backed workflow services." });
    }
    if (/aiCfoStore/.test(file.content)) {
      findings.push({ path, dependency: "aiCfoStore", reason: "Active AI CFO code must persist conversation history in PostgreSQL." });
    }
    if (/aiCfoDailyReviewStore/.test(file.content)) {
      findings.push({ path, dependency: "aiCfoDailyReviewStore", reason: "Active Daily Review code must persist review history in PostgreSQL." });
    }
    if (/getCopilotHistory|appendCopilotHistory|copilot-history\.json/.test(file.content)) {
      findings.push({ path, dependency: "copilotHistoryLocalStore", reason: "Active Copilot/AI CFO history code must use PostgreSQL-backed AI CFO history services." });
    }
    if (/\.vireon\/goal-planning|goal-state\.json|GoalPlanningEngine\.(readState|saveGoal|archiveGoal|saveScenario|persistSnapshot)/.test(file.content)) {
      findings.push({ path, dependency: "goalPlanningLocalState", reason: "Active Goals code must use PostgreSQL-backed goal services." });
    }
    if (/(localStorage|sessionStorage)/.test(file.content) && /(scenario|simulation|decision|workflow|ai.?cfo|daily.?review|goal)/i.test(file.content)) {
      findings.push({ path, dependency: "browserStorageAuthoritative", reason: "Browser storage cannot be authoritative for converted decisioning domains." });
    }
    if (/\.ai\/local-data/.test(file.content) && /financial|vault|transaction|subscription|import/i.test(file.content)) {
      findings.push({ path, dependency: ".ai/local-data", reason: "Authoritative financial data must not be read from local files in active runtime code." });
    }
    return findings;
  });
}

export const DATA_OWNERSHIP_REGISTRY = [
  { entity: "verified financial facts", owner: "Financial Vault", mutationRule: "Only Vault repositories can create verified facts or change confidence." },
  { entity: "source documents", owner: "Financial Vault", mutationRule: "Documents create evidence and proposed facts; raw payloads stay out of routine logs." },
  { entity: "digital twin scenarios", owner: "Digital Twin", mutationRule: "Scenario assumptions and simulation snapshots are owned by the Digital Twin repository." },
  { entity: "recommendations", owner: "Decision Centre", mutationRule: "Original expected impact and lifecycle state are preserved in decision history." },
  { entity: "workflow execution", owner: "Action Workflows", mutationRule: "Workflow completion and outcome verification are separate states." },
  { entity: "timeline history", owner: "Timeline", mutationRule: "Timeline stores immutable references and before/after values, not mutable fact copies." },
  { entity: "AI CFO answers", owner: "AI CFO", mutationRule: "AI CFO owns grounded question/answer snapshots, not canonical calculations." },
  { entity: "daily reviews", owner: "Daily Review", mutationRule: "Daily Review owns deterministic finding snapshots and suppression decisions." },
  { entity: "tax rules", owner: "Rule Provenance", mutationRule: "GPT cannot create or modify tax rules or calculation classifications." },
] as const;

export const PERSISTENCE_AUDIT_INVENTORY = [
  { subsystem: "Financial Vault", currentLocation: "PostgreSQL financial_profiles/financial_facts/documents/document_extractions/evidence via active Vault APIs and shared financial read model", owner: "Financial Vault", sourceOfTruth: "PostgreSQL for active Financial Vault, dashboard, status and cross-surface financial input consumers", sensitivity: "high" },
  { subsystem: "Digital Twin", currentLocation: "PostgreSQL digital_twin_scenarios/simulation_runs/timeline_events/calculation_snapshots via core decisioning persistence service", owner: "Digital Twin", sourceOfTruth: "PostgreSQL for active Digital Twin routes and UI", sensitivity: "high" },
  { subsystem: "AI CFO", currentLocation: "PostgreSQL ai_cfo_questions/ai_cfo_answers with grounded references", owner: "AI CFO", sourceOfTruth: "PostgreSQL for active AI CFO conversation/history APIs and UI", sensitivity: "high" },
  { subsystem: "Daily Review", currentLocation: "PostgreSQL daily_reviews and calculation_snapshots", owner: "Daily Review", sourceOfTruth: "PostgreSQL for active Daily Review APIs and dashboard cards", sensitivity: "high" },
  { subsystem: "Action Workflows", currentLocation: "PostgreSQL workflows/workflow_steps/workflow_evidence/workflow_outcomes", owner: "Action Workflows", sourceOfTruth: "PostgreSQL for active workflow APIs and UI", sensitivity: "high" },
  { subsystem: "Decision Centre", currentLocation: "PostgreSQL decisions/decision_history", owner: "Decision Centre", sourceOfTruth: "PostgreSQL for active decision status, history and dashboard cards", sensitivity: "high" },
  { subsystem: "Goals", currentLocation: "PostgreSQL goals and calculation_snapshots", owner: "Goals", sourceOfTruth: "PostgreSQL for active goal APIs and UI", sensitivity: "high" },
  { subsystem: "Housing", currentLocation: ".ai/local-data/housing-affordability.json", owner: "Housing", sourceOfTruth: "local JSON today; calculations reference Vault facts and snapshots target", sensitivity: "high" },
  { subsystem: "Transactions", currentLocation: "PostgreSQL user_transactions/user_transaction_imports", owner: "Financial Vault", sourceOfTruth: "PostgreSQL via restricted runtime role", sensitivity: "high" },
  { subsystem: "Subscriptions", currentLocation: "PostgreSQL user_subscriptions", owner: "Financial Vault", sourceOfTruth: "PostgreSQL via restricted runtime role", sensitivity: "medium" },
  { subsystem: "Developer Mode", currentLocation: "browser localStorage:vireon-developer-mode", owner: "User Preferences", sourceOfTruth: "client preference today; user_preferences target", sensitivity: "low" },
] as const;
