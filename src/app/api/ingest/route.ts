import { ingestCSV, type RawCSVRow } from "@/lib/ingestion/csvPipeline";
import { getIngestionHealthReport } from "@/lib/ingestion/healthScorer";
import { getDevSession } from "@/lib/auth/middleware";
import {
  appendLocalTransactions,
  appendLocalImport,
  getStorageMode,
  upsertLocalSubscription,
} from "@/lib/localStore";
import type { TransactionRecord, SubscriptionRecord } from "@/lib/persistence/schema";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rows: RawCSVRow[] = Array.isArray(body.rows) ? (body.rows as RawCSVRow[]) : [];
  const mode: "dryRun" | "persist" = body.mode === "persist" ? "persist" : "dryRun";
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined;
  const userId = typeof body.userId === "string" ? body.userId : undefined;

  const session = getDevSession();
  const resolvedWorkspaceId = workspaceId ?? session.workspaceId;
  const resolvedUserId = userId ?? session.userId;

  if (rows.length === 0) {
    return Response.json(
      { ok: false, error: "No rows provided — send { rows: RawCSVRow[] }" },
      { status: 400 }
    );
  }

  const result = ingestCSV(rows);
  const healthReport = getIngestionHealthReport(result.transactions, result.errors);

  let persisted = false;
  let persistedCount = 0;
  let persistMessage = "dryRun mode — pass mode=persist to write to database";
  const storageMode = getStorageMode();

  if (mode === "persist") {
    if (process.env.DATABASE_URL) {
      persistMessage =
        "DATABASE_URL present — install @prisma/client and call transactionRepository.bulkCreate() to persist";
    } else {
      const transactionRecords: TransactionRecord[] = result.transactions.map((t) => ({
        id: t.id,
        workspaceId: resolvedWorkspaceId,
        userId: resolvedUserId,
        merchant: t.merchant,
        merchantCanonical: t.merchantCanonical,
        amount: t.amount,
        currency: t.currency,
        category: t.category,
        subCategory: t.subCategory,
        date: t.date,
        recurring: t.recurring,
        recurringCadence: (t.recurringCadence as TransactionRecord["recurringCadence"]) ?? null,
        duplicate: t.duplicate,
        confidence: t.confidence,
        rawDescription: t.rawDescription,
        source: "csv",
        createdAt: new Date().toISOString(),
      }));

      persistedCount = appendLocalTransactions(transactionRecords);

      // Create subscription records for recurring transactions
      const cadenceMap: Record<string, SubscriptionRecord["cadence"]> = {
        monthly: "monthly",
        quarterly: "quarterly",
        annual: "annual",
        daily: "monthly",
        weekly: "monthly",
        fortnightly: "monthly",
      };
      const cadenceDays: Record<SubscriptionRecord["cadence"], number> = {
        monthly: 30,
        quarterly: 91,
        annual: 365,
      };
      const recurringTxs = transactionRecords.filter((t) => t.recurring);
      for (const t of recurringTxs) {
        const rawCadence = t.recurringCadence ?? "monthly";
        const cadence = cadenceMap[rawCadence] ?? "monthly";
        const txDate = new Date(t.date);
        const nextRenewal = new Date(txDate.getTime() + cadenceDays[cadence] * 24 * 60 * 60 * 1000);
        const sub: SubscriptionRecord = {
          id: `sub-${t.merchantCanonical}-${resolvedWorkspaceId}`,
          workspaceId: resolvedWorkspaceId,
          transactionId: t.id,
          merchant: t.merchantCanonical,
          merchantCanonical: t.merchantCanonical,
          amount: Math.abs(t.amount),
          cadence,
          nextRenewalDate: nextRenewal.toISOString(),
          cancellationScore: 0,
          pricingAnomalyScore: 0,
          savingsOpportunity: 0,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        upsertLocalSubscription(sub);
      }

      appendLocalImport({
        id: `import-${Date.now()}`,
        workspaceId: resolvedWorkspaceId,
        userId: resolvedUserId,
        rowCount: result.processedRows,
        mode: "persist",
        healthScore: result.healthScore,
        importedAt: new Date().toISOString(),
        transactionIds: transactionRecords.map((t) => t.id),
      });

      persisted = true;
      persistMessage = `local-persistent mode — ${persistedCount} new transactions written to .ai/local-data/transactions.json`;
    }
  }

  const recurringCandidates = result.transactions.filter((t) => t.recurring);
  const duplicateCandidates = result.transactions.filter((t) => t.duplicate);

  return Response.json({
    ok: result.ok,
    mode,
    storageMode,
    context: { workspaceId: resolvedWorkspaceId, userId: resolvedUserId },
    persisted,
    persistedCount,
    persistMessage,
    ingestion: {
      totalRows: result.totalRows,
      processedRows: result.processedRows,
      skippedRows: result.skippedRows,
      duplicateCount: result.duplicateCount,
      recurringCount: result.recurringCount,
      healthScore: result.healthScore,
      healthGrade: healthReport.grade,
      issues: healthReport.issues,
      recommendations: healthReport.recommendations,
      processedAt: result.processedAt,
    },
    transactions: result.transactions,
    recurringCandidates,
    duplicateCandidates,
    errors: result.errors,
  });
}
