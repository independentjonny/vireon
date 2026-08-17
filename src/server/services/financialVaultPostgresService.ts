import { createHash, randomUUID } from "node:crypto";
import {
  analyzeDocumentText,
  buildLenderPack,
  calculateBorrowingCapacity,
  detectRefinanceOpportunities,
  detectSavingsOpportunities,
  emptyFinancialProfile,
  mergeProfileWithExtraction,
} from "@/lib/financialVaultEngine";
import { FINANCIAL_DOCUMENT_INGESTION_VERSION, type FinancialDocumentIngestionResult } from "@/lib/financialDocumentIngestion";
import type { CanonicalFinancialRecord, CandidateField, FinancialRecordKind, IngestionRecord, IngestionSource, ImportPreview } from "@/lib/manualFinancialDataPlatform";
import { ManualFinancialDataPlatform } from "@/lib/manualFinancialDataPlatform";
import { hashRecord, type AuthenticatedSession, type RepositoryContext } from "@/lib/productionDataIntegrity";
import { createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient, type DatabaseErrorClass, classifyDatabaseError } from "@/server/db/postgresRuntime";
import type { PostgresPilotClient } from "@/lib/postgresPilotPersistence";
import type { DocumentType, FinancialProfile, FinancialVaultState, UploadedDocument } from "@/lib/financialVaultTypes";

if (typeof window !== "undefined") {
  throw new Error("Financial Vault PostgreSQL service is server-only.");
}

export type FinancialVaultService = ReturnType<typeof createFinancialVaultPostgresService>;

export type PropertyPositionInput = {
  address: string;
  addressId?: string;
  addressLocality?: string;
  addressState?: string;
  addressPostcode?: string;
  addressSource: "manual" | "geoscape-gnaf";
  propertyType: string;
  ownership: string;
  primaryUse: string;
  estimatedValue: number;
  purchaseDate?: string;
  rentalIncome: boolean;
  rentalIncomeAmount?: number;
  rentalIncomeFrequency?: string;
  hasMortgage: boolean;
  lender?: string;
  loanBalance?: number;
  interestRate?: number;
  repaymentAmount?: number;
  repaymentFrequency?: string;
  repaymentType?: string;
  rateType?: string;
  offsetBalance?: number;
  documentIds: string[];
  idempotencyKey: string;
};

type VaultImportEnvelope = {
  ingestion: IngestionRecord;
  preview: ImportPreview | null;
  candidates: CandidateField[];
};

type DocumentExtractionPayload = {
  uploadedDocument: UploadedDocument;
  values: Record<string, unknown>;
  warnings: string[];
  ingestion?: Pick<FinancialDocumentIngestionResult, "format" | "status" | "warnings" | "rowCount" | "extractionMethod">;
};

type ScopedRepositoryContext = RepositoryContext & {
  transactionClient?: PostgresPilotClient;
};

export class FinancialVaultPersistenceError extends Error {
  public readonly code: "UNAUTHENTICATED" | "DATABASE_UNAVAILABLE" | "VALIDATION_FAILED" | "CONFLICT" | "NOT_FOUND";
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(
    code: "UNAUTHENTICATED" | "DATABASE_UNAVAILABLE" | "VALIDATION_FAILED" | "CONFLICT" | "NOT_FOUND",
    message: string,
    status = 500,
    retryable = false,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function uuidFromTrustedUserId(value: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value;
  const hex = createHash("sha256").update(`vireon-trusted-user:${value}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function contextFromSession(session: AuthenticatedSession, correlationId: string = randomUUID()): RepositoryContext {
  if (!session.userId) throw new FinancialVaultPersistenceError("UNAUTHENTICATED", "Sign in is required.", 401);
  return {
    session: { ...session, userId: uuidFromTrustedUserId(session.userId), requestId: session.requestId ?? correlationId },
    correlationId,
    source: "financial-vault-postgres",
    dataMode: "live",
  };
}

function maskSensitiveText(text: string): string {
  return text.replace(/\b(\d{4})\d{4,10}(\d{2,4})\b/g, "$1****$2");
}

function statusFromDb(value: string): UploadedDocument["status"] {
  if (value === "needs-review") return "needs_review";
  if (["uploaded", "processing", "extracted", "needs_review", "failed"].includes(value)) return value as UploadedDocument["status"];
  return "needs_review";
}

function dbDocumentStatus(value: UploadedDocument["status"]): string {
  return value === "needs_review" ? "needs-review" : value;
}

function isProfileValueKey(key: string): key is keyof Omit<FinancialProfile, "id" | "lastUpdatedAt" | "sources"> {
  return [
    "incomeMonthly",
    "incomeAnnual",
    "employmentType",
    "employerName",
    "mortgageBalance",
    "mortgageRepaymentMonthly",
    "interestRate",
    "superBalance",
    "monthlySpending",
    "recurringSubscriptions",
    "liabilities",
    "assets",
  ].includes(key);
}

function importIdFromRunId(id: string): string {
  return `ingestion-${id}`;
}

function runIdFromImportId(id: string): string {
  return id.replace(/^ingestion-/, "");
}

function platformSnapshot(input: { ingestion: IngestionRecord; candidates: CandidateField[]; preview: ImportPreview | null; canonical?: CanonicalFinancialRecord[] }) {
  return {
    version: "manual-financial-data-platform-v1",
    ingestions: [[input.ingestion.id, input.ingestion]] as [string, IngestionRecord][],
    candidates: [[input.ingestion.id, input.candidates]] as [string, CandidateField[]][],
    canonical: (input.canonical ?? []).map((record) => [record.id, record]) as [string, CanonicalFinancialRecord][],
    previews: input.preview ? ([[input.ingestion.id, input.preview]] as [string, ImportPreview][]) : [],
    audit: [],
    syncHashes: [],
  };
}

export function toFinancialVaultSafeError(error: unknown): FinancialVaultPersistenceError {
  if (error instanceof FinancialVaultPersistenceError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/Invalid runtime PostgreSQL configuration|runtime application database URL|application role password/i.test(message)) {
    return new FinancialVaultPersistenceError("DATABASE_UNAVAILABLE", "Financial Vault PostgreSQL persistence is not configured. No local fallback was used.", 503, true);
  }
  const kind: DatabaseErrorClass = classifyDatabaseError(error);
  if (kind === "UNIQUE_CONSTRAINT") return new FinancialVaultPersistenceError("CONFLICT", "The record already exists.", 409);
  if (kind === "CONNECTION" || kind === "QUERY_TIMEOUT") return new FinancialVaultPersistenceError("DATABASE_UNAVAILABLE", "Financial Vault persistence is unavailable. No local fallback was used.", 503, true);
  return new FinancialVaultPersistenceError("VALIDATION_FAILED", "The Financial Vault request could not be completed.", 422);
}

export function createFinancialVaultServiceFromEnv(env: NodeJS.ProcessEnv = process.env): FinancialVaultService {
  const client = new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv(env));
  return createFinancialVaultPostgresService(client);
}

export function createFinancialVaultPostgresService(client: PostgresPilotClient) {
  function scopedDb(ctx: RepositoryContext): PostgresPilotClient {
    const db = (ctx as ScopedRepositoryContext).transactionClient;
    if (!db) throw new FinancialVaultPersistenceError("DATABASE_UNAVAILABLE", "Financial Vault database scope requires a transaction-local client.", 503, true);
    return db;
  }

  async function withScopedTransaction<T>(ctx: RepositoryContext, operation: (ctx: ScopedRepositoryContext) => Promise<T>): Promise<T> {
    return client.transaction(async (tx) => {
      const scopedCtx: ScopedRepositoryContext = { ...ctx, transactionClient: tx };
      await scope(scopedCtx);
      return operation(scopedCtx);
    });
  }

  async function scope(ctx: RepositoryContext): Promise<string> {
    const userId = ctx.session.userId;
    if (!userId) throw new FinancialVaultPersistenceError("UNAUTHENTICATED", "Sign in is required.", 401);
    await scopedDb(ctx).query("select set_config('app.current_user_id', $1, true)", [userId]);
    return userId;
  }

  async function ensureUser(ctx: RepositoryContext): Promise<string> {
    const userId = await scope(ctx);
    await scopedDb(ctx).query(
      `insert into users(id, email, display_name, source, correlation_id)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set updated_at = now(), correlation_id = excluded.correlation_id`,
      [userId, `${userId}@users.vireon.local`, "Vireon user", ctx.source, ctx.correlationId],
    );
    return userId;
  }

  async function initializeProfile(ctx: RepositoryContext): Promise<void> {
    const userId = await ensureUser(ctx);
    await scopedDb(ctx).query(
      `insert into financial_profiles(user_id, state, relationship_status, profile_confidence, source, correlation_id)
       select $1, $2, null, 0, $3, $4
       where not exists (select 1 from financial_profiles where user_id = $1)`,
      [userId, JSON.stringify({ profileVersion: "financial-vault-postgres-v1" }), ctx.source, ctx.correlationId],
    );
  }

  async function assertIdempotency(ctx: RepositoryContext, operation: string, key: string, payload: unknown): Promise<"new" | "replay"> {
    const userId = await scope(ctx);
    const requestHash = hashRecord(payload);
    const existing = await scopedDb(ctx).query<{ responseHash: string }>(
      `select response_hash as "responseHash" from idempotency_keys where user_id = $1 and operation = $2 and idempotency_key = $3`,
      [userId, operation, key],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].responseHash !== requestHash) {
        throw new FinancialVaultPersistenceError("CONFLICT", "Idempotency key was reused with a different payload.", 409);
      }
      return "replay";
    }
    await scopedDb(ctx).query(
      `insert into idempotency_keys(user_id, idempotency_key, operation, response_hash, source, correlation_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [userId, key, operation, requestHash, ctx.source, ctx.correlationId],
    );
    return "new";
  }

  async function documentRows(ctx: RepositoryContext): Promise<Array<{ id: string; title: string; documentType: DocumentType; status: string; uploadedAt: string; extraction: DocumentExtractionPayload | null }>> {
    const userId = await scope(ctx);
    const result = await scopedDb(ctx).query<{ id: string; title: string; documentType: DocumentType; status: string; uploadedAt: string; extraction: DocumentExtractionPayload | null }>(
      `select d.id, d.title, d.document_type as "documentType", d.status, d.uploaded_at as "uploadedAt",
        (
          select de.proposed_facts
          from document_extractions de
          where de.document_id = d.id and de.user_id = $1
          order by de.created_at desc
          limit 1
        ) as extraction
       from documents d
       where d.user_id = $1
       order by d.uploaded_at desc`,
      [userId],
    );
    return result.rows;
  }

  function rebuildVaultFromDocuments(rows: Awaited<ReturnType<typeof documentRows>>): FinancialVaultState {
    const uploaded = rows.map((row) => {
      const payload = row.extraction;
      if (payload?.uploadedDocument) return payload.uploadedDocument;
      return {
        id: row.id,
        fileName: row.title,
        documentType: row.documentType,
        uploadedAt: row.uploadedAt,
        status: statusFromDb(row.status),
        extractedText: "",
        extractionConfidence: 0,
        sourcePeriodStart: null,
        sourcePeriodEnd: null,
      };
    });
    let profile = emptyFinancialProfile();
    for (const row of rows.slice().reverse()) {
      const doc = uploaded.find((item) => item.id === row.id);
      const values = row.extraction?.values;
      if (!doc || !values || (doc.status !== "extracted" && doc.status !== "needs_review")) continue;
      profile = mergeProfileWithExtraction(profile, doc, values);
    }
    const currentProfile = { ...profile, id: rows[0]?.id ? `profile-${rows[0].id}` : profile.id };
    const borrowing = calculateBorrowingCapacity(currentProfile);
    const refinance = detectRefinanceOpportunities(currentProfile);
    const savings = detectSavingsOpportunities(currentProfile);
    return {
      uploaded_documents: uploaded,
      financial_profile: currentProfile,
      borrowing_capacity: borrowing,
      refinance_opportunities: refinance,
      savings_opportunities: savings,
      lender_pack: buildLenderPack(uploaded, currentProfile, borrowing, refinance, savings),
    };
  }

  async function listCanonicalRecords(ctx: RepositoryContext): Promise<CanonicalFinancialRecord[]> {
    const userId = await scope(ctx);
    const result = await scopedDb(ctx).query<{ record: CanonicalFinancialRecord }>(
      `select fact_value as record
       from financial_facts
       where user_id = $1 and source in ('financial-vault-import', 'financial-vault-manual')
       order by created_at asc`,
      [userId],
    );
    return result.rows.map((row) => row.record);
  }

  async function getImportEnvelope(ctx: RepositoryContext, ingestionId: string): Promise<VaultImportEnvelope> {
    const userId = await scope(ctx);
    const result = await scopedDb(ctx).query<{ preview: VaultImportEnvelope }>(
      `select preview from migration_runs where user_id = $1 and id = $2`,
      [userId, runIdFromImportId(ingestionId)],
    );
    const envelope = result.rows[0]?.preview;
    if (!envelope) throw new FinancialVaultPersistenceError("NOT_FOUND", "Import was not found.", 404);
    return envelope;
  }

  async function saveImportEnvelope(ctx: RepositoryContext, envelope: VaultImportEnvelope): Promise<void> {
    const userId = await scope(ctx);
    await scopedDb(ctx).query(
      `update migration_runs
       set status = $1, preview = $2::jsonb, record_count = $3, updated_at = now(), source = $4, correlation_id = $5
       where user_id = $6 and id = $7`,
      [envelope.ingestion.status, JSON.stringify(envelope), envelope.candidates.length, ctx.source, ctx.correlationId, userId, runIdFromImportId(envelope.ingestion.id)],
    );
  }

  async function insertFactVersion(ctx: RepositoryContext, factId: string, version: number, value: unknown, confidence: number, verified: boolean, reason: string, evidenceIds: string[] = []): Promise<void> {
    const userId = await scope(ctx);
    await scopedDb(ctx).query(
      `insert into fact_versions(user_id, fact_id, version, fact_value, confidence, verified, evidence_ids, changed_reason, source, correlation_id)
       values ($1, $2, $3, $4::jsonb, $5, $6, $7::uuid[], $8, $9, $10)`,
      [userId, factId, version, JSON.stringify(value), confidence, verified, evidenceIds, reason, ctx.source, ctx.correlationId],
    );
  }

  async function manualFact(ctx: ScopedRepositoryContext, kind: "asset" | "liability", entityKey: string) {
    const userId = await scope(ctx);
    const result = await scopedDb(ctx).query<{ id: string; version: number; record: CanonicalFinancialRecord }>(
      `select id, version, fact_value as record
       from financial_facts
       where user_id = $1
         and fact_type = $2
         and source = 'financial-vault-manual'
         and fact_value->'value'->>'entityKey' = $3
       order by updated_at desc
       limit 1
       for update`,
      [userId, kind, entityKey],
    );
    return result.rows[0] ?? null;
  }

  async function verifiedDocumentIds(ctx: ScopedRepositoryContext, documentIds: string[]): Promise<string[]> {
    const requested = [...new Set(documentIds)].slice(0, 20);
    if (!requested.length) return [];
    if (requested.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
      throw new FinancialVaultPersistenceError("VALIDATION_FAILED", "One or more supporting documents are invalid.", 422);
    }
    const userId = await scope(ctx);
    const result = await scopedDb(ctx).query<{ id: string }>(
      `select id from documents where user_id = $1 and id = any($2::uuid[])`,
      [userId, requested],
    );
    const owned = new Set(result.rows.map((row) => row.id));
    if (requested.some((id) => !owned.has(id))) {
      throw new FinancialVaultPersistenceError("NOT_FOUND", "A selected supporting document is no longer available.", 404);
    }
    return requested;
  }

  async function linkManualEvidence(ctx: ScopedRepositoryContext, factId: string, entityKey: string, documentIds: string[]): Promise<string[]> {
    const userId = await scope(ctx);
    const evidenceIds: string[] = [];
    for (const documentId of documentIds) {
      const result = await scopedDb(ctx).query<{ id: string }>(
        `insert into evidence(user_id, evidence_type, source_ref, document_id, fact_id, verification_status, confidence, immutable, source, correlation_id)
         values ($1, 'manual-profile-support', $2, $3, $4, 'UserLinked', 1, true, 'financial-vault-manual', $5)
         returning id`,
        [userId, `${entityKey}:${documentId}`, documentId, factId, ctx.correlationId],
      );
      if (result.rows[0]) evidenceIds.push(result.rows[0].id);
    }
    return evidenceIds;
  }

  async function upsertManualFact(ctx: ScopedRepositoryContext, input: {
    kind: "asset" | "liability";
    subtype: string;
    label: string;
    entityKey: string;
    value: Record<string, unknown>;
    documentIds: string[];
  }): Promise<CanonicalFinancialRecord> {
    const existing = await manualFact(ctx, input.kind, input.entityKey);
    const userId = await scope(ctx);
    const generated = new ManualFinancialDataPlatform().manualRecord(userId, {
      kind: input.kind,
      subtype: input.subtype,
      label: input.label,
      value: { ...input.value, entityKey: input.entityKey, sourceDocumentIds: input.documentIds },
      approximate: false,
    });
    const at = new Date().toISOString();
    const record: CanonicalFinancialRecord = existing
      ? {
          ...generated,
          id: existing.record.id,
          createdAt: existing.record.createdAt,
          updatedAt: at,
          history: [...existing.record.history, { at, action: "edited", before: existing.record.value, after: generated.value }],
        }
      : generated;
    const fact = existing
      ? await scopedDb(ctx).query<{ id: string; version: number }>(
          `update financial_facts
           set fact_value = $1::jsonb, confidence = $2, verified = true, source_document_id = $3,
               version = version + 1, updated_at = now(), source = 'financial-vault-manual', correlation_id = $4
           where id = $5 and user_id = $6 and version = $7
           returning id, version`,
          [JSON.stringify(record), record.provenance.confidence, input.documentIds[0] ?? null, ctx.correlationId, existing.id, userId, existing.version],
        )
      : await scopedDb(ctx).query<{ id: string; version: number }>(
          `insert into financial_facts(user_id, fact_type, fact_value, confidence, verified, sensitivity, source_document_id, source, correlation_id)
           values ($1, $2, $3::jsonb, $4, true, 'asset-debt', $5, 'financial-vault-manual', $6)
           returning id, version`,
          [userId, input.kind, JSON.stringify(record), record.provenance.confidence, input.documentIds[0] ?? null, ctx.correlationId],
        );
    if (!fact.rows[0]) throw new FinancialVaultPersistenceError("CONFLICT", "This financial record changed in another session. Review it and try again.", 409, true);
    const evidenceIds = await linkManualEvidence(ctx, fact.rows[0].id, input.entityKey, input.documentIds);
    await insertFactVersion(ctx, fact.rows[0].id, fact.rows[0].version, record, record.provenance.confidence, true, existing ? "Current financial position updated by the user." : "Current financial position confirmed by the user.", evidenceIds);
    return record;
  }

  async function retireManualFact(ctx: ScopedRepositoryContext, kind: "asset" | "liability", entityKey: string): Promise<void> {
    const existing = await manualFact(ctx, kind, entityKey);
    if (!existing || existing.record.superseded) return;
    const userId = await scope(ctx);
    const at = new Date().toISOString();
    const record: CanonicalFinancialRecord = {
      ...existing.record,
      updatedAt: at,
      superseded: true,
      history: [...existing.record.history, { at, action: "superseded", before: existing.record.value, after: null }],
    };
    const result = await scopedDb(ctx).query<{ id: string; version: number }>(
      `update financial_facts
       set fact_value = $1::jsonb, version = version + 1, updated_at = now(), correlation_id = $2
       where id = $3 and user_id = $4 and version = $5
       returning id, version`,
      [JSON.stringify(record), ctx.correlationId, existing.id, userId, existing.version],
    );
    if (!result.rows[0]) throw new FinancialVaultPersistenceError("CONFLICT", "This financial record changed in another session. Review it and try again.", 409, true);
    await insertFactVersion(ctx, result.rows[0].id, result.rows[0].version, record, record.provenance.confidence, true, "Mortgage removed from the current financial position.");
  }

  return {
    contextFromSession,
    toSafeError: toFinancialVaultSafeError,
    async getVault(session: AuthenticatedSession, correlationId: string = randomUUID()): Promise<FinancialVaultState> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        await initializeProfile(ctx);
        return rebuildVaultFromDocuments(await documentRows(ctx));
      });
    },
    async addDocument(session: AuthenticatedSession, input: { fileName: string; documentType: DocumentType; extractedText: string; ingestion?: FinancialDocumentIngestionResult; idempotencyKey?: string }, correlationId: string = randomUUID()): Promise<FinancialVaultState> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        await initializeProfile(ctx);
        const text = maskSensitiveText(input.extractedText);
        const analysis = analyzeDocumentText(input.fileName, input.documentType, input.extractedText);
        const contentHash = createHash("sha256").update(input.extractedText).digest("hex");
        const idempotencyKey = input.idempotencyKey || `document:${contentHash}`;
        await assertIdempotency(ctx, "financial-vault.document.register", idempotencyKey, { fileName: input.fileName, documentType: input.documentType, contentHash });
        const existing = await scopedDb(ctx).query<{ id: string }>(
          `select id from documents where user_id = $1 and content_hash = $2 and document_type = $3 limit 1`,
          [ctx.session.userId, contentHash, input.documentType],
        );
        if (existing.rows[0]) return rebuildVaultFromDocuments(await documentRows(ctx));
        const status = input.ingestion?.status === "needs_review" ? "needs_review" : analysis.status;
        const doc: UploadedDocument = {
          id: randomUUID(),
          fileName: input.fileName,
          documentType: analysis.detectedType,
          uploadedAt: new Date().toISOString(),
          status,
          extractedText: text,
          extractionConfidence: analysis.confidence,
          sourcePeriodStart: typeof analysis.values.sourcePeriodStart === "string" ? analysis.values.sourcePeriodStart : null,
          sourcePeriodEnd: typeof analysis.values.sourcePeriodEnd === "string" ? analysis.values.sourcePeriodEnd : null,
          ingestionVersion: input.ingestion ? FINANCIAL_DOCUMENT_INGESTION_VERSION : undefined,
          extractionMethod: input.ingestion?.extractionMethod,
          ingestionWarnings: input.ingestion?.warnings,
          importedRowCount: input.ingestion?.rowCount,
        };
        const userId = await scope(ctx);
        await scopedDb(ctx).query(
          `with inserted_document as (
            insert into documents(id, user_id, title, document_type, storage_ref, content_hash, status, sensitivity, source, correlation_id)
            values ($1, $2, $3, $4, $5, $6, $7, 'tax-document', $8, $9)
            returning id
          ), inserted_extraction as (
            insert into document_extractions(user_id, document_id, extraction_version, proposed_facts, confidence, citations, status, source, correlation_id)
            select $2, id, $10, $11::jsonb, $12, $13::jsonb, $7, $8, $9 from inserted_document
            returning id
          )
          insert into evidence(user_id, evidence_type, source_ref, document_id, fact_id, verification_status, confidence, immutable, source, correlation_id)
          select $2, 'document-extraction', $14, d.id, null, 'Unverified', $12, true, $8, $9 from inserted_document d
          returning id`,
          [
            doc.id,
            userId,
            input.fileName,
            analysis.detectedType,
            `financial-documents/${userId}/${doc.id}`,
            contentHash,
            dbDocumentStatus(status),
            ctx.source,
            ctx.correlationId,
            FINANCIAL_DOCUMENT_INGESTION_VERSION,
            JSON.stringify({ uploadedDocument: doc, values: analysis.values, warnings: analysis.notes, ingestion: input.ingestion }),
            analysis.confidence,
            JSON.stringify([]),
            `${doc.id}:${FINANCIAL_DOCUMENT_INGESTION_VERSION}`,
          ],
        );
        for (const [key, value] of Object.entries(analysis.values)) {
          if (!isProfileValueKey(key) || value == null) continue;
          const fact = await scopedDb(ctx).query<{ id: string; version: number }>(
            `insert into financial_facts(user_id, fact_type, fact_value, confidence, verified, sensitivity, source_document_id, source, correlation_id)
             values ($1, $2, $3::jsonb, $4, true, 'asset-debt', $5, 'financial-vault-document', $6)
             returning id, version`,
            [userId, key, JSON.stringify({ key, value, documentId: doc.id }), analysis.confidence, doc.id, ctx.correlationId],
          );
          if (fact.rows[0]) {
            await insertFactVersion(ctx, fact.rows[0].id, fact.rows[0].version, { key, value, documentId: doc.id }, analysis.confidence, true, "Document extraction approved into Financial Vault.");
          }
        }
        return rebuildVaultFromDocuments(await documentRows(ctx));
      });
    },
    async getImports(session: AuthenticatedSession, correlationId: string = randomUUID()) {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        await initializeProfile(ctx);
        const userId = await scope(ctx);
        const rows = await scopedDb(ctx).query<{ preview: VaultImportEnvelope }>(
          `select preview from migration_runs where user_id = $1 and target_version = 'manual-financial-data-platform-v1' order by created_at desc`,
          [userId],
        );
        const platform = new ManualFinancialDataPlatform();
        const canonical = await listCanonicalRecords(ctx);
        return {
          ingestions: rows.rows.map((row) => row.preview.ingestion),
          canonical,
          decisions: platform.restore({ version: "manual-financial-data-platform-v1", ingestions: [], candidates: [], canonical: canonical.map((record) => [record.id, record]), previews: [], audit: [], syncHashes: [] }).decisions(userId),
          health: platform.restore({ version: "manual-financial-data-platform-v1", ingestions: [], candidates: [], canonical: canonical.map((record) => [record.id, record]), previews: [], audit: [], syncHashes: [] }).financialHealth(userId),
          refresh: platform.restore({ version: "manual-financial-data-platform-v1", ingestions: [], candidates: [], canonical: canonical.map((record) => [record.id, record]), previews: [], audit: [], syncHashes: [] }).refreshStatus(userId),
        };
      });
    },
    async createImport(session: AuthenticatedSession, input: { sourceType: IngestionSource; fileName: string; mimeType: string; text: string; periodStart?: string; periodEnd?: string; idempotencyKey?: string }, correlationId: string = randomUUID()): Promise<IngestionRecord> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        await initializeProfile(ctx);
        const contentHash = createHash("sha256").update(input.text).digest("hex");
        await assertIdempotency(ctx, "financial-vault.import.create", input.idempotencyKey || `import:${contentHash}`, { ...input, text: contentHash });
        const existing = await scopedDb(ctx).query<{ preview: VaultImportEnvelope }>(
          `select preview from migration_runs where user_id = $1 and source_checksum = $2 and target_version = 'manual-financial-data-platform-v1' limit 1`,
          [ctx.session.userId, contentHash],
        );
        if (existing.rows[0]) return existing.rows[0].preview.ingestion;
        const now = new Date().toISOString();
        const runId = randomUUID();
        const ingestion: IngestionRecord = {
          id: importIdFromRunId(runId),
          userId: ctx.session.userId!,
          sourceType: input.sourceType,
          originalFileName: input.fileName,
          mimeType: input.mimeType,
          fileHash: contentHash,
          status: "RECEIVED",
          sourcePeriodStart: input.periodStart ?? null,
          sourcePeriodEnd: input.periodEnd ?? null,
          parserVersion: "manual-financial-data-platform-v1",
          detectedDocumentType: null,
          extractionConfidence: null,
          errors: [],
          receivedAt: now,
          warnings: [],
          metadata: {},
          createdAt: now,
          updatedAt: now,
        };
        const envelope: VaultImportEnvelope = { ingestion, preview: null, candidates: [] };
        await scopedDb(ctx).query(
          `insert into migration_runs(id, user_id, source_version, target_version, status, preview, record_count, source_checksum, rollback_metadata, source, correlation_id)
           values ($1, $2, $3, 'manual-financial-data-platform-v1', $4, $5::jsonb, 0, $6, $7::jsonb, $8, $9)`,
          [runId, ctx.session.userId, input.mimeType, ingestion.status, JSON.stringify(envelope), contentHash, JSON.stringify({ reversible: true }), ctx.source, ctx.correlationId],
        );
        return ingestion;
      });
    },
    async previewCsv(session: AuthenticatedSession, ingestionId: string, text: string, mapping: Record<string, string>, correlationId: string = randomUUID()): Promise<ImportPreview> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        const envelope = await getImportEnvelope(ctx, ingestionId);
        const platform = new ManualFinancialDataPlatform().restore(platformSnapshot(envelope));
        const preview = platform.previewCsv(ctx.session.userId!, ingestionId, text, mapping);
        const next = platform.snapshot();
        await saveImportEnvelope(ctx, { ingestion: next.ingestions[0][1], preview, candidates: next.candidates[0]?.[1] ?? [] });
        return preview;
      });
    },
    async stageCsv(session: AuthenticatedSession, ingestionId: string, mapping: Record<string, string>, correlationId: string = randomUUID()): Promise<CandidateField[]> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        const envelope = await getImportEnvelope(ctx, ingestionId);
        const platform = new ManualFinancialDataPlatform().restore(platformSnapshot(envelope));
        const candidates = platform.stageTransactions(ctx.session.userId!, ingestionId, mapping);
        const next = platform.snapshot();
        await saveImportEnvelope(ctx, { ingestion: next.ingestions[0][1], preview: next.previews[0]?.[1] ?? null, candidates });
        return candidates;
      });
    },
    async reviewImport(session: AuthenticatedSession, ingestionId: string, actions: Array<{ candidateId: string; action: "accept" | "edit" | "reject"; value?: unknown }>, correlationId: string = randomUUID()): Promise<CandidateField[]> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        const envelope = await getImportEnvelope(ctx, ingestionId);
        const platform = new ManualFinancialDataPlatform().restore(platformSnapshot(envelope));
        platform.review(ctx.session.userId!, ingestionId, actions);
        const next = platform.snapshot();
        const candidates = next.candidates[0]?.[1] ?? [];
        await saveImportEnvelope(ctx, { ingestion: next.ingestions[0][1], preview: next.previews[0]?.[1] ?? null, candidates });
        return candidates;
      });
    },
    async confirmImport(session: AuthenticatedSession, ingestionId: string, correlationId: string = randomUUID()): Promise<CanonicalFinancialRecord[]> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        const envelope = await getImportEnvelope(ctx, ingestionId);
        if (envelope.ingestion.status === "CONFIRMED") {
          const existingRecords = (await listCanonicalRecords(ctx)).filter((record) => record.provenance.ingestionId === ingestionId);
          if (existingRecords.length > 0) return existingRecords;
        }
        const platform = new ManualFinancialDataPlatform().restore(platformSnapshot(envelope));
        const records = platform.confirm(ctx.session.userId!, ingestionId);
        const userId = await scope(ctx);
        for (const record of records) {
          const fact = await scopedDb(ctx).query<{ id: string; version: number }>(
            `insert into financial_facts(user_id, fact_type, fact_value, confidence, verified, sensitivity, source, correlation_id)
             values ($1, $2, $3::jsonb, $4, true, $5, 'financial-vault-import', $6)
             returning id, version`,
            [userId, record.kind, JSON.stringify(record), record.provenance.confidence, record.kind === "transaction" ? "transaction" : "asset-debt", ctx.correlationId],
          );
          if (fact.rows[0]) {
            const evidence = await scopedDb(ctx).query<{ id: string }>(
              `insert into evidence(user_id, evidence_type, source_ref, fact_id, verification_status, confidence, immutable, source, correlation_id)
               values ($1, 'manual-import-candidate', $2, $3, 'Verified', $4, true, $5, $6)
               returning id`,
              [userId, `${ingestionId}:${record.id}`, fact.rows[0].id, record.provenance.confidence, ctx.source, ctx.correlationId],
            );
            await insertFactVersion(ctx, fact.rows[0].id, fact.rows[0].version, record, record.provenance.confidence, true, "Manual import confirmed into Financial Vault.", evidence.rows[0] ? [evidence.rows[0].id] : []);
          }
        }
        const next = platform.snapshot();
        await saveImportEnvelope(ctx, { ingestion: next.ingestions[0][1], preview: next.previews[0]?.[1] ?? null, candidates: next.candidates[0]?.[1] ?? [] });
        return records;
      });
    },
    async rollbackImport(session: AuthenticatedSession, ingestionId: string, correlationId: string = randomUUID()): Promise<{ status: "ARCHIVED" }> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        const envelope = await getImportEnvelope(ctx, ingestionId);
        if (envelope.ingestion.status === "CONFIRMED") throw new FinancialVaultPersistenceError("CONFLICT", "Confirmed imports cannot be rolled back.", 409);
        await saveImportEnvelope(ctx, { ...envelope, ingestion: { ...envelope.ingestion, status: "ARCHIVED" } });
        return { status: "ARCHIVED" };
      });
    },
    async manualRecord(session: AuthenticatedSession, input: { kind: Exclude<FinancialRecordKind, "transaction" | "document">; subtype: string; label: string; value: Record<string, unknown>; approximate: boolean; idempotencyKey?: string }, correlationId: string = randomUUID()): Promise<CanonicalFinancialRecord> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        await initializeProfile(ctx);
        await assertIdempotency(ctx, "financial-vault.fact.manual", input.idempotencyKey || `manual:${hashRecord(input)}`, input);
        const platform = new ManualFinancialDataPlatform();
        const record = platform.manualRecord(ctx.session.userId!, input);
        const userId = await scope(ctx);
        const fact = await scopedDb(ctx).query<{ id: string; version: number }>(
          `insert into financial_facts(user_id, fact_type, fact_value, confidence, verified, sensitivity, source, correlation_id)
           values ($1, $2, $3::jsonb, $4, true, 'asset-debt', 'financial-vault-manual', $5)
           returning id, version`,
          [userId, record.kind, JSON.stringify(record), record.provenance.confidence, ctx.correlationId],
        );
        if (fact.rows[0]) await insertFactVersion(ctx, fact.rows[0].id, fact.rows[0].version, record, record.provenance.confidence, true, "Manual Financial Vault fact created.");
        return record;
      });
    },
    async savePropertyPosition(session: AuthenticatedSession, input: PropertyPositionInput, correlationId: string = randomUUID()): Promise<{ property: CanonicalFinancialRecord; mortgage: CanonicalFinancialRecord | null }> {
      return withScopedTransaction(contextFromSession(session, correlationId), async (ctx) => {
        await initializeProfile(ctx);
        if (!input.idempotencyKey.trim()) {
          throw new FinancialVaultPersistenceError("VALIDATION_FAILED", "A save request key is required.", 422);
        }
        const address = input.address.trim();
        if (!address || !Number.isFinite(input.estimatedValue) || input.estimatedValue <= 0) {
          throw new FinancialVaultPersistenceError("VALIDATION_FAILED", "Property address and a positive estimated value are required.", 422);
        }
        if (input.hasMortgage && (!input.lender?.trim() || !Number.isFinite(input.loanBalance) || Number(input.loanBalance) < 0)) {
          throw new FinancialVaultPersistenceError("VALIDATION_FAILED", "Mortgage lender and a valid outstanding balance are required.", 422);
        }
        if (input.rentalIncome && (!Number.isFinite(input.rentalIncomeAmount) || Number(input.rentalIncomeAmount) <= 0 || !input.rentalIncomeFrequency?.trim())) {
          throw new FinancialVaultPersistenceError("VALIDATION_FAILED", "A positive rent amount and payment frequency are required when this property earns rental income.", 422);
        }
        const replay = await assertIdempotency(ctx, "financial-vault.property-position.save", input.idempotencyKey, { ...input, idempotencyKey: undefined });
        const entityKey = `property:${input.addressId?.trim() || createHash("sha256").update(address.toLowerCase()).digest("hex").slice(0, 24)}`;
        const mortgageKey = `mortgage:${entityKey}`;
        await scopedDb(ctx).query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`${ctx.session.userId}:${entityKey}`]);
        if (replay === "replay") {
          const property = await manualFact(ctx, "asset", entityKey);
          const mortgage = await manualFact(ctx, "liability", mortgageKey);
          if (!property) throw new FinancialVaultPersistenceError("NOT_FOUND", "The saved property could not be found.", 404);
          return { property: property.record, mortgage: mortgage?.record.superseded ? null : mortgage?.record ?? null };
        }
        const documentIds = await verifiedDocumentIds(ctx, input.documentIds);
        const property = await upsertManualFact(ctx, {
          kind: "asset",
          subtype: "property",
          label: address,
          entityKey,
          documentIds,
          value: {
            address,
            addressId: input.addressId ?? "",
            locality: input.addressLocality ?? "",
            state: input.addressState ?? "",
            postcode: input.addressPostcode ?? "",
            addressSource: input.addressSource,
            propertyType: input.propertyType,
            ownership: input.ownership,
            primaryUse: input.primaryUse,
            marketValue: input.estimatedValue,
            purchaseDate: input.purchaseDate ?? "",
            rentalIncome: input.rentalIncome,
            rentalIncomeAmount: input.rentalIncome ? Number(input.rentalIncomeAmount) : 0,
            rentalIncomeFrequency: input.rentalIncome ? input.rentalIncomeFrequency : "",
            currency: "AUD",
          },
        });
        let mortgage: CanonicalFinancialRecord | null = null;
        if (input.hasMortgage) {
          mortgage = await upsertManualFact(ctx, {
            kind: "liability",
            subtype: "mortgage",
            label: `${input.lender!.trim()} mortgage – ${address}`,
            entityKey: mortgageKey,
            documentIds,
            value: {
              propertyEntityKey: entityKey,
              lender: input.lender!.trim(),
              balance: Number(input.loanBalance),
              interestRate: Number(input.interestRate ?? 0),
              repaymentAmount: Number(input.repaymentAmount ?? 0),
              repaymentFrequency: input.repaymentFrequency ?? "Monthly",
              repaymentType: input.repaymentType ?? "Principal and interest",
              rateType: input.rateType ?? "Variable",
              offsetBalance: Number(input.offsetBalance ?? 0),
              currency: "AUD",
            },
          });
        } else {
          await retireManualFact(ctx, "liability", mortgageKey);
        }
        return { property, mortgage };
      });
    },
  };
}
