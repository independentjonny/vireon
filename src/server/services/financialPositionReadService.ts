import { randomUUID } from "node:crypto";
import type { AuthenticatedSession } from "@/lib/productionDataIntegrity";
import type { CanonicalFinancialRecord, FinancialRecordKind } from "@/lib/manualFinancialDataPlatform";
import { buildMonthlyCashFlowModel, type MonthlyCashFlowModel } from "@/lib/monthlyCashFlow";
import type { FinancialVaultState, ProfileValueKey, UploadedDocument } from "@/lib/financialVaultTypes";
import { createFinancialVaultServiceFromEnv, FinancialVaultPersistenceError, uuidFromTrustedUserId } from "@/server/services/financialVaultPostgresService";

if (typeof window !== "undefined") {
  throw new Error("Financial position read service is server-only.");
}

export type FinancialReadModelUnavailable = {
  ok: false;
  code: "UNAUTHENTICATED" | "DATABASE_UNAVAILABLE" | "VALIDATION_FAILED";
  message: string;
  retryable: boolean;
  correlationId: string;
};

export type FinancialPositionReadModel = {
  userId: string;
  correlationId: string;
  generatedAt: string;
  vault: FinancialVaultState;
  profileSummary: {
    profileId: string;
    lastUpdatedAt: string;
    completenessScore: number;
    documentCount: number;
    lenderPackReadyItems: number;
  };
  confirmedFacts: CanonicalFinancialRecord[];
  factsByType: Partial<Record<FinancialRecordKind, CanonicalFinancialRecord[]>>;
  assets: CanonicalFinancialRecord[];
  liabilities: CanonicalFinancialRecord[];
  income: CanonicalFinancialRecord[];
  expenses: CanonicalFinancialRecord[];
  transactions: CanonicalFinancialRecord[];
  monthlyCashFlow: MonthlyCashFlowModel;
  propertyDetails: CanonicalFinancialRecord[];
  mortgageDetails: CanonicalFinancialRecord[];
  superannuation: CanonicalFinancialRecord[];
  cashPosition: {
    confirmedCash: number;
    sourceRecordIds: string[];
  };
  netWorthInputs: {
    assets: number;
    liabilities: number;
    netWorth: number;
    sourceRecordIds: string[];
  };
  documentImportStatus: {
    documents: UploadedDocument[];
    importCount: number;
    activeImportCount: number;
    unresolvedExtractionReviewCount: number;
  };
  provenanceSummary: {
    sourceRecordIds: string[];
    sourceDocumentIds: string[];
    sourceTypes: string[];
  };
  confidenceSummary: {
    averageFactConfidence: number;
    lowConfidenceFactCount: number;
    profileSourceCount: number;
  };
  staleDataSummary: {
    staleFactCount: number;
    staleRecordIds: string[];
  };
};

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function firstNumber(record: CanonicalFinancialRecord, keys: string[]): number {
  for (const key of keys) {
    const value = numberValue(record.value[key]);
    if (value !== 0) return value;
  }
  return 0;
}

function isProperty(record: CanonicalFinancialRecord): boolean {
  return /property|home|house|apartment|unit/i.test(`${record.subtype} ${record.label}`);
}

function isMortgage(record: CanonicalFinancialRecord): boolean {
  return /mortgage|home loan/i.test(`${record.subtype} ${record.label}`);
}

function isSuper(record: CanonicalFinancialRecord): boolean {
  return /super|superannuation/i.test(`${record.subtype} ${record.label}`);
}

function sourceKeys(vault: FinancialVaultState): ProfileValueKey[] {
  return Object.keys(vault.financial_profile.sources) as ProfileValueKey[];
}

export function buildFinancialPositionReadModel(input: {
  userId: string;
  vault: FinancialVaultState;
  canonical: CanonicalFinancialRecord[];
  ingestions: Array<{ status: string }>;
  freshness: Array<{ recordId: string; stale: boolean }>;
  correlationId?: string;
  generatedAt?: string;
}): FinancialPositionReadModel {
  const correlationId = input.correlationId ?? randomUUID();
  const confirmedFacts = input.canonical.filter((record) => record.userId === input.userId && record.provenance.userConfirmed && !record.superseded);
  const factsByType = confirmedFacts.reduce<Partial<Record<FinancialRecordKind, CanonicalFinancialRecord[]>>>((acc, record) => {
    acc[record.kind] = [...(acc[record.kind] ?? []), record];
    return acc;
  }, {});
  const assets = [...(factsByType.asset ?? []), ...(factsByType.account ?? [])];
  const liabilities = factsByType.liability ?? [];
  const income = factsByType.income ?? [];
  const expenses = factsByType.expense ?? [];
  const transactions = factsByType.transaction ?? [];
  const propertyDetails = assets.filter(isProperty);
  const mortgageDetails = liabilities.filter(isMortgage);
  const superannuation = assets.filter(isSuper);
  const cashRecords = (factsByType.account ?? []).filter((record) => !isSuper(record) && !/investment|shares|etf/i.test(`${record.subtype} ${record.label}`));
  const profile = input.vault.financial_profile;
  const assetTotal = assets.reduce((sum, record) => sum + firstNumber(record, ["marketValue", "balance", "amount", "value"]), 0) || profile.assets + profile.superBalance;
  const liabilityTotal = liabilities.reduce((sum, record) => sum + firstNumber(record, ["balance", "amount", "principal", "value"]), 0) || profile.liabilities + profile.mortgageBalance;
  const activeStatuses = new Set(["RECEIVED", "PROCESSING", "NEEDS_REVIEW", "PARTIALLY_ACCEPTED", "FAILED"]);
  const staleRecordIds = input.freshness.filter((item) => item.stale).map((item) => item.recordId);

  return {
    userId: input.userId,
    correlationId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    vault: input.vault,
    profileSummary: {
      profileId: profile.id,
      lastUpdatedAt: profile.lastUpdatedAt,
      completenessScore: Math.min(100, Math.round((sourceKeys(input.vault).length / 10) * 100)),
      documentCount: input.vault.uploaded_documents.length,
      lenderPackReadyItems: input.vault.lender_pack.documentChecklist.filter((item) => item.available).length,
    },
    confirmedFacts,
    factsByType,
    assets,
    liabilities,
    income,
    expenses,
    transactions,
    monthlyCashFlow: buildMonthlyCashFlowModel(confirmedFacts, input.userId),
    propertyDetails,
    mortgageDetails,
    superannuation,
    cashPosition: {
      confirmedCash: cashRecords.reduce((sum, record) => sum + firstNumber(record, ["balance", "amount", "value"]), 0),
      sourceRecordIds: cashRecords.map((record) => record.id),
    },
    netWorthInputs: {
      assets: assetTotal,
      liabilities: liabilityTotal,
      netWorth: assetTotal - liabilityTotal,
      sourceRecordIds: [...assets, ...liabilities].map((record) => record.id),
    },
    documentImportStatus: {
      documents: input.vault.uploaded_documents,
      importCount: input.ingestions.length,
      activeImportCount: input.ingestions.filter((ingestion) => activeStatuses.has(ingestion.status)).length,
      unresolvedExtractionReviewCount: input.vault.uploaded_documents.filter((doc) => doc.status === "needs_review" || doc.status === "processing" || doc.status === "failed").length,
    },
    provenanceSummary: {
      sourceRecordIds: confirmedFacts.map((record) => record.id),
      sourceDocumentIds: [...new Set(input.vault.uploaded_documents.map((doc) => doc.id))],
      sourceTypes: [...new Set(confirmedFacts.map((record) => record.provenance.sourceType))],
    },
    confidenceSummary: {
      averageFactConfidence: confirmedFacts.length ? confirmedFacts.reduce((sum, record) => sum + record.provenance.confidence, 0) / confirmedFacts.length : 0,
      lowConfidenceFactCount: confirmedFacts.filter((record) => record.provenance.confidence < 0.7).length,
      profileSourceCount: sourceKeys(input.vault).length,
    },
    staleDataSummary: {
      staleFactCount: staleRecordIds.length,
      staleRecordIds,
    },
  };
}

export function createFinancialPositionReadServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const vaultService = createFinancialVaultServiceFromEnv(env);
  return {
    async read(session: AuthenticatedSession, correlationId: string = randomUUID()): Promise<FinancialPositionReadModel> {
      const vault = await vaultService.getVault(session, correlationId);
      const imports = await vaultService.getImports(session, correlationId);
      return buildFinancialPositionReadModel({
        userId: session.userId ? uuidFromTrustedUserId(session.userId) : "",
        vault,
        canonical: imports.canonical,
        ingestions: imports.ingestions,
        freshness: imports.refresh,
        correlationId,
      });
    },
  };
}

export function toFinancialReadModelUnavailable(error: unknown, correlationId = randomUUID()): FinancialReadModelUnavailable {
  if (error instanceof FinancialVaultPersistenceError) {
    return { ok: false, code: error.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : error.code === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "VALIDATION_FAILED", message: error.message, retryable: error.retryable, correlationId };
  }
  const message = error instanceof Error ? error.message : "Financial data is unavailable.";
  return { ok: false, code: "DATABASE_UNAVAILABLE", message, retryable: true, correlationId };
}
