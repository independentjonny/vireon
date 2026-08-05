import { createHash, randomUUID } from "node:crypto";
import type { NormalizedTransaction } from "@/lib/ingestion/csvPipeline";
import type { AuthenticatedSession, RepositoryContext } from "@/lib/productionDataIntegrity";
import type { SubscriptionRecord, TransactionRecord } from "@/lib/persistence/schema";
import { detectCadence } from "@/lib/subscriptions/cadenceDetector";
import { predictRenewals } from "@/lib/subscriptions/renewalPredictor";
import { generateSavingsRecommendations } from "@/lib/subscriptions/savingsRecommender";
import { createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient, classifyDatabaseError } from "@/server/db/postgresRuntime";
import type { PostgresPilotClient } from "@/lib/postgresPilotPersistence";
import { uuidFromTrustedUserId } from "@/server/services/financialVaultPostgresService";

if (typeof window !== "undefined") {
  throw new Error("Transactions/subscriptions PostgreSQL service is server-only.");
}

const SOURCE = "transactions-subscriptions-postgres";

type ScopedContext = RepositoryContext & { transactionClient?: PostgresPilotClient; workspaceId: string };

export class TransactionsSubscriptionsPersistenceError extends Error {
  public readonly code: "UNAUTHENTICATED" | "DATABASE_UNAVAILABLE" | "VALIDATION_FAILED" | "CONFLICT";
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(code: TransactionsSubscriptionsPersistenceError["code"], message: string, status = 500, retryable = false) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export type TransactionListResult = {
  dataSource: "postgres";
  storageMode: "postgres";
  transactions: TransactionRecord[];
  summary: { income: number; spend: number; net: number; transactionCount: number };
};

export type SubscriptionListResult = {
  dataSource: "postgres";
  storageMode: "postgres";
  subscriptions: SubscriptionRecord[];
  monthlySpend: number;
  annualisedSpend: number;
  optimisationCount: number;
  detectionResults: ReturnType<typeof buildDetectionResults>;
};

export type SubscriptionIntelligenceResult = {
  dataSource: "postgres";
  storageMode: "postgres";
  summary: {
    activeSubscriptions: number;
    monthlyTotal: number;
    annualisedTotal: number;
    duplicateCount: number;
    anomalyCount: number;
    potentialMonthlySaving: number;
  };
  cadences: Array<{ merchant: string; currentAmount: number; cadence: string; confidence: number; averageDaysBetween: number | null; nextExpected: string | null }>;
  renewals: ReturnType<typeof predictRenewals>;
  duplicates: Array<{ merchant: string; amount: number; duplicateOf?: string }>;
  anomalies: ReturnType<typeof detectAnomalies>;
  savings: ReturnType<typeof generateSavingsRecommendations>;
  generatedAt: string;
};

type TransactionRow = {
  appId: string;
  workspaceId: string;
  merchant: string;
  merchantCanonical: string;
  amount: string | number;
  currency: string;
  category: string;
  subCategory: string;
  date: string;
  recurring: boolean;
  recurringCadence: TransactionRecord["recurringCadence"];
  duplicate: boolean;
  confidence: string | number;
  rawDescription: string;
  source: TransactionRecord["source"];
  createdAt: string;
};

type SubscriptionRow = {
  appId: string;
  workspaceId: string;
  transactionId: string | null;
  merchant: string;
  merchantCanonical: string;
  amount: string | number;
  cadence: SubscriptionRecord["cadence"];
  nextRenewalDate: string;
  cancellationScore: string | number;
  pricingAnomalyScore: string | number;
  savingsOpportunity: string | number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type SubscriptionGroup = {
  merchant: string;
  amounts: number[];
  dates: string[];
  currentAmount: number;
  duplicateOf?: string;
};

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

function ctxFromSession(session: AuthenticatedSession, correlationId = randomUUID()): ScopedContext {
  if (!session.userId) throw new TransactionsSubscriptionsPersistenceError("UNAUTHENTICATED", "Sign in is required.", 401);
  const workspaceId = "workspaceId" in session && typeof session.workspaceId === "string" ? session.workspaceId : "";
  if (!workspaceId) throw new TransactionsSubscriptionsPersistenceError("VALIDATION_FAILED", "Workspace membership is required.", 403);
  const userId = uuidFromTrustedUserId(session.userId);
  const scopedSession = { ...session, userId, requestId: session.requestId ?? correlationId };
  return {
    session: scopedSession,
    workspaceId,
    correlationId,
    source: SOURCE,
    dataMode: "live",
  };
}

export function toSafeTransactionsError(error: unknown): TransactionsSubscriptionsPersistenceError {
  if (error instanceof TransactionsSubscriptionsPersistenceError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid runtime postgresql configuration|missing runtime application database url|missing runtime application role password/i.test(message)) {
    return new TransactionsSubscriptionsPersistenceError("DATABASE_UNAVAILABLE", "PostgreSQL persistence is unavailable. No local fallback was used.", 503, true);
  }
  const kind = classifyDatabaseError(error);
  if (kind === "CONNECTION" || kind === "QUERY_TIMEOUT") {
    return new TransactionsSubscriptionsPersistenceError("DATABASE_UNAVAILABLE", "PostgreSQL persistence is unavailable. No local fallback was used.", 503, true);
  }
  if (kind === "UNIQUE_CONSTRAINT") return new TransactionsSubscriptionsPersistenceError("CONFLICT", "The record already exists.", 409);
  return new TransactionsSubscriptionsPersistenceError("VALIDATION_FAILED", "The persisted transaction request could not be completed.", 422);
}

function monthlyAmount(amount: number, cadence: SubscriptionRecord["cadence"]): number {
  if (cadence === "monthly") return amount;
  if (cadence === "quarterly") return amount / 3;
  return amount / 12;
}

function nextRenewalDate(cadence: SubscriptionRecord["cadence"], from = new Date()): string {
  const date = new Date(from);
  if (cadence === "monthly") date.setMonth(date.getMonth() + 1);
  else if (cadence === "quarterly") date.setMonth(date.getMonth() + 3);
  else date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

function stableTransactionAppId(tx: NormalizedTransaction, index: number): string {
  const fingerprint = sha([tx.date.slice(0, 10), tx.merchantCanonical, tx.amount.toFixed(2), tx.currency, index]);
  return `tx-${fingerprint.slice(0, 24)}`;
}

function stableSubscriptionAppId(merchantCanonical: string, workspaceId: string): string {
  return `sub-${sha([workspaceId, merchantCanonical]).slice(0, 24)}`;
}

function mapTransaction(row: TransactionRow, userId: string): TransactionRecord {
  return {
    id: row.appId,
    workspaceId: row.workspaceId,
    userId,
    merchant: row.merchant,
    merchantCanonical: row.merchantCanonical,
    amount: Number(row.amount),
    currency: row.currency,
    category: row.category,
    subCategory: row.subCategory,
    date: row.date,
    recurring: row.recurring,
    recurringCadence: row.recurringCadence,
    duplicate: row.duplicate,
    confidence: Number(row.confidence),
    rawDescription: row.rawDescription,
    source: row.source,
    createdAt: row.createdAt,
  };
}

function mapSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.appId,
    workspaceId: row.workspaceId,
    transactionId: row.transactionId ?? "",
    merchant: row.merchant,
    merchantCanonical: row.merchantCanonical,
    amount: Number(row.amount),
    cadence: row.cadence,
    nextRenewalDate: row.nextRenewalDate,
    cancellationScore: Number(row.cancellationScore),
    pricingAnomalyScore: Number(row.pricingAnomalyScore),
    savingsOpportunity: Number(row.savingsOpportunity),
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildDetectionResults(subs: SubscriptionRecord[]) {
  if (subs.length === 0) return null;
  const cadenceDays: Record<string, number> = { monthly: 30, quarterly: 90, annual: 365 };
  const groups = subscriptionGroups(subs);
  return {
    cadences: subs.map((s) => ({
      merchant: s.merchant,
      cadence: s.cadence,
      confidence: 0.85,
      nextExpected: s.nextRenewalDate,
      averageDaysBetween: cadenceDays[s.cadence] ?? 30,
    })),
    renewals: predictRenewals(groups),
    savings: generateSavingsRecommendations(groups.map((g) => ({ merchant: g.merchant, amount: g.currentAmount, duplicateOf: g.duplicateOf }))),
    duplicateRisks: groups.filter((g) => g.duplicateOf),
    detectedAt: nowIso(),
  };
}

function subscriptionGroups(subs: SubscriptionRecord[]): SubscriptionGroup[] {
  const groups: SubscriptionGroup[] = subs.map((s) => {
    const cadenceDays: Record<string, number> = { monthly: 30, quarterly: 90, annual: 365 };
    const days = cadenceDays[s.cadence] ?? 30;
    return {
      merchant: s.merchant,
      amounts: [s.amount, s.amount],
      dates: [new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(), s.nextRenewalDate],
      currentAmount: s.amount,
    };
  });
  const seen = new Map<string, string>();
  for (const group of groups) {
    const key = group.currentAmount.toFixed(2);
    if (seen.has(key)) group.duplicateOf = seen.get(key);
    else seen.set(key, group.merchant);
  }
  return groups;
}

function detectAnomalies(groups: SubscriptionGroup[]) {
  return groups
    .filter((group) => group.amounts.length >= 2)
    .flatMap((group) => {
      const avg = group.amounts.reduce((a, b) => a + b, 0) / group.amounts.length;
      return group.amounts
        .filter((amount) => Math.abs(amount - avg) > avg * 0.15)
        .map((amount) => ({
          merchant: group.merchant,
          anomalyAmount: amount,
          averageAmount: Math.round(avg * 100) / 100,
          deviation: Math.round(((amount - avg) / avg) * 100),
          type: amount > avg ? "price_increase" : "price_decrease",
        }));
    });
}

export function createTransactionsSubscriptionsServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return createTransactionsSubscriptionsPostgresService(new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv(env)));
}

export function createTransactionsSubscriptionsPostgresService(client: PostgresPilotClient) {
  function scopedDb(ctx: ScopedContext): PostgresPilotClient {
    if (!ctx.transactionClient) throw new TransactionsSubscriptionsPersistenceError("DATABASE_UNAVAILABLE", "Transaction database scope requires a transaction-local client.", 503, true);
    return ctx.transactionClient;
  }

  async function withScopedTransaction<T>(ctx: ScopedContext, operation: (ctx: ScopedContext) => Promise<T>): Promise<T> {
    return client.transaction(async (tx) => {
      const scopedCtx = { ...ctx, transactionClient: tx };
      await scope(scopedCtx);
      return operation(scopedCtx);
    });
  }

  async function scope(ctx: ScopedContext): Promise<string> {
    const userId = ctx.session.userId;
    if (!userId) throw new TransactionsSubscriptionsPersistenceError("UNAUTHENTICATED", "Sign in is required.", 401);
    await scopedDb(ctx).query("select set_config('app.current_user_id', $1, true)", [userId]);
    return userId;
  }

  async function ensureUser(ctx: ScopedContext): Promise<string> {
    const userId = await scope(ctx);
    await scopedDb(ctx).query(
      `insert into users(id, email, display_name, source, correlation_id)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set updated_at = now(), correlation_id = excluded.correlation_id`,
      [userId, `${userId}@users.vireon.local`, "Vireon user", ctx.source, ctx.correlationId],
    );
    return userId;
  }

  async function idempotency(ctx: ScopedContext, operation: string, key: string, payload: unknown): Promise<"new" | "replay"> {
    const userId = await scope(ctx);
    const responseHash = sha(payload);
    const existing = await scopedDb(ctx).query<{ responseHash: string }>(
      `select response_hash as "responseHash" from idempotency_keys where user_id = $1 and operation = $2 and idempotency_key = $3`,
      [userId, operation, key],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].responseHash !== responseHash) {
        throw new TransactionsSubscriptionsPersistenceError("CONFLICT", "Idempotency key was reused with a different payload.", 409);
      }
      return "replay";
    }
    await scopedDb(ctx).query(
      `insert into idempotency_keys(user_id, idempotency_key, operation, response_hash, source, correlation_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [userId, key, operation, responseHash, ctx.source, ctx.correlationId],
    );
    return "new";
  }

  async function listTransactionsInCtx(ctx: ScopedContext): Promise<TransactionListResult> {
    const userId = await scope(ctx);
    const rows = await scopedDb(ctx).query<TransactionRow>(
      `select app_id as "appId", workspace_id as "workspaceId", merchant, merchant_canonical as "merchantCanonical",
              amount, currency, category, sub_category as "subCategory", transaction_date as date, recurring,
              recurring_cadence as "recurringCadence", duplicate, confidence, raw_description as "rawDescription",
              source_kind as source, created_at as "createdAt"
       from user_transactions
       where user_id = $1 and workspace_id = $2 and archived_at is null
       order by transaction_date desc, created_at desc
       limit 500`,
      [userId, ctx.workspaceId],
    );
    const transactions = rows.rows.map((row) => mapTransaction(row, userId));
    const income = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const spend = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return {
      dataSource: "postgres",
      storageMode: "postgres",
      transactions,
      summary: { income, spend, net: income - spend, transactionCount: transactions.length },
    };
  }

  async function listSubscriptionsInCtx(ctx: ScopedContext): Promise<SubscriptionListResult> {
    const userId = await scope(ctx);
    const rows = await scopedDb(ctx).query<SubscriptionRow>(
      `select app_id as "appId", workspace_id as "workspaceId", transaction_app_id as "transactionId",
              merchant, merchant_canonical as "merchantCanonical", amount, cadence,
              next_renewal_date as "nextRenewalDate", cancellation_score as "cancellationScore",
              pricing_anomaly_score as "pricingAnomalyScore", savings_opportunity as "savingsOpportunity",
              active, created_at as "createdAt", updated_at as "updatedAt"
       from user_subscriptions
       where user_id = $1 and workspace_id = $2 and active = true and archived_at is null
       order by next_renewal_date asc, merchant asc
       limit 250`,
      [userId, ctx.workspaceId],
    );
    const subscriptions = rows.rows.map(mapSubscription);
    const monthlySpend = subscriptions.reduce((sum, sub) => sum + monthlyAmount(sub.amount, sub.cadence), 0);
    return {
      dataSource: "postgres",
      storageMode: "postgres",
      subscriptions,
      monthlySpend: Math.round(monthlySpend * 100) / 100,
      annualisedSpend: Math.round(monthlySpend * 12 * 100) / 100,
      optimisationCount: subscriptions.length,
      detectionResults: buildDetectionResults(subscriptions),
    };
  }

  async function upsertSubscriptionFromTransaction(ctx: ScopedContext, tx: NormalizedTransaction, appId: string): Promise<void> {
    if (!tx.recurring) return;
    const userId = await scope(ctx);
    const cadenceMap: Record<string, SubscriptionRecord["cadence"]> = {
      monthly: "monthly",
      quarterly: "quarterly",
      annual: "annual",
      daily: "monthly",
      weekly: "monthly",
      fortnightly: "monthly",
    };
    const cadence = cadenceMap[tx.recurringCadence ?? "monthly"] ?? "monthly";
    const amount = Math.abs(tx.amount);
    const subscriptionAppId = stableSubscriptionAppId(tx.merchantCanonical, ctx.workspaceId);
    await scopedDb(ctx).query(
      `insert into user_subscriptions(user_id, workspace_id, app_id, transaction_app_id, merchant, merchant_canonical, amount, cadence, next_renewal_date, savings_opportunity, payload, source, correlation_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
       on conflict (user_id, app_id) do update
         set transaction_app_id = excluded.transaction_app_id,
             merchant = excluded.merchant,
             amount = excluded.amount,
             cadence = excluded.cadence,
             next_renewal_date = excluded.next_renewal_date,
             active = true,
             archived_at = null,
             payload = excluded.payload,
             version = user_subscriptions.version + 1,
             updated_at = now(),
             source = excluded.source,
             correlation_id = excluded.correlation_id`,
      [
        userId,
        ctx.workspaceId,
        subscriptionAppId,
        appId,
        tx.merchant,
        tx.merchantCanonical,
        amount,
        cadence,
        nextRenewalDate(cadence, new Date(tx.date)),
        Math.round(monthlyAmount(amount, cadence) * 12 * 0.15 * 100) / 100,
        JSON.stringify({ source: "transaction-import", transactionAppId: appId }),
        ctx.source,
        ctx.correlationId,
      ],
    );
  }

  return {
    async listTransactions(session: AuthenticatedSession): Promise<TransactionListResult> {
      const ctx = ctxFromSession(session);
      try {
        return await withScopedTransaction(ctx, listTransactionsInCtx);
      } catch (error) {
        throw toSafeTransactionsError(error);
      }
    },

    async archiveAllTransactions(session: AuthenticatedSession): Promise<{ archivedCount: number }> {
      const ctx = ctxFromSession(session);
      try {
        return await withScopedTransaction(ctx, async (txCtx) => {
          const userId = await ensureUser(txCtx);
          const result = await scopedDb(txCtx).query<{ archivedCount: string }>(
            `with archived as (
               update user_transactions
               set archived_at = now(), updated_at = now(), version = version + 1, source = $3, correlation_id = $4
               where user_id = $1 and workspace_id = $2 and archived_at is null
               returning id
             )
             select count(*)::text as "archivedCount" from archived`,
            [userId, txCtx.workspaceId, txCtx.source, txCtx.correlationId],
          );
          return { archivedCount: Number(result.rows[0]?.archivedCount ?? 0) };
        });
      } catch (error) {
        throw toSafeTransactionsError(error);
      }
    },

    async persistTransactionsFromIngestion(
      session: AuthenticatedSession,
      input: {
        transactions: NormalizedTransaction[];
        ingestion: { totalRows: number; processedRows: number; duplicateCount: number; recurringCount: number; healthScore: number; errors: string[]; processedAt: string };
        idempotencyKey?: string | null;
        sourceChecksum?: string | null;
      },
    ): Promise<TransactionListResult & { persisted: boolean; persistedCount: number; replayed: boolean; importId: string }> {
      const ctx = ctxFromSession(session);
      const sourceChecksum = input.sourceChecksum || sha(input.transactions.map((tx) => [tx.date, tx.merchantCanonical, tx.amount, tx.currency]));
      const idempotencyKey = input.idempotencyKey || `transaction-import:${sourceChecksum}`;
      try {
        return await withScopedTransaction(ctx, async (txCtx) => {
          const userId = await ensureUser(txCtx);
          const replayed = (await idempotency(txCtx, "transactions:import", idempotencyKey, { sourceChecksum, transactions: input.transactions })) === "replay";
          const importAppId = `import-${sourceChecksum.slice(0, 24)}`;
          const importRow = await scopedDb(txCtx).query<{ id: string }>(
            `insert into user_transaction_imports(user_id, workspace_id, app_id, status, source_format, source_checksum, row_count, processed_count, duplicate_count, recurring_count, health_score, payload, source, correlation_id)
             values ($1, $2, $3, 'persisted', 'csv', $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
             on conflict (user_id, source_checksum) do update
               set updated_at = now(), correlation_id = excluded.correlation_id
             returning id`,
            [
              userId,
              txCtx.workspaceId,
              importAppId,
              sourceChecksum,
              input.ingestion.totalRows,
              input.ingestion.processedRows,
              input.ingestion.duplicateCount,
              input.ingestion.recurringCount,
              input.ingestion.healthScore,
              JSON.stringify({ processedAt: input.ingestion.processedAt, errors: input.ingestion.errors.slice(0, 20) }),
              txCtx.source,
              txCtx.correlationId,
            ],
          );
          const importId = importRow.rows[0]?.id;
          if (!importId) throw new TransactionsSubscriptionsPersistenceError("VALIDATION_FAILED", "Transaction import could not be recorded.", 422);

          let persistedCount = 0;
          if (!replayed) {
            for (const [index, transaction] of input.transactions.entries()) {
              const appId = stableTransactionAppId(transaction, index);
              const row = await scopedDb(txCtx).query<{ appId: string }>(
                `insert into user_transactions(user_id, workspace_id, import_id, app_id, merchant, merchant_canonical, amount, currency, category, sub_category, transaction_date, recurring, recurring_cadence, duplicate, confidence, raw_description, source_kind, payload, source, correlation_id)
                 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'csv', $17::jsonb, $18, $19)
                 on conflict (user_id, app_id) do nothing
                 returning app_id as "appId"`,
                [
                  userId,
                  txCtx.workspaceId,
                  importId,
                  appId,
                  transaction.merchant,
                  transaction.merchantCanonical,
                  transaction.amount,
                  transaction.currency,
                  transaction.category,
                  transaction.subCategory,
                  transaction.date,
                  transaction.recurring,
                  transaction.recurringCadence,
                  transaction.duplicate,
                  transaction.confidence,
                  transaction.rawDescription,
                  JSON.stringify({ originalId: transaction.id }),
                  txCtx.source,
                  txCtx.correlationId,
                ],
              );
              if (row.rows[0]) persistedCount += 1;
              await upsertSubscriptionFromTransaction(txCtx, transaction, appId);
            }
          }
          return { ...(await listTransactionsInCtx(txCtx)), persisted: true, persistedCount, replayed, importId };
        });
      } catch (error) {
        throw toSafeTransactionsError(error);
      }
    },

    async listSubscriptions(session: AuthenticatedSession): Promise<SubscriptionListResult> {
      const ctx = ctxFromSession(session);
      try {
        return await withScopedTransaction(ctx, listSubscriptionsInCtx);
      } catch (error) {
        throw toSafeTransactionsError(error);
      }
    },

    async addSubscription(
      session: AuthenticatedSession,
      input: { merchant: string; amount: number; cadence: SubscriptionRecord["cadence"]; transactionId?: string | null; idempotencyKey?: string | null },
    ): Promise<SubscriptionRecord> {
      const ctx = ctxFromSession(session);
      if (!input.merchant.trim() || !Number.isFinite(input.amount) || input.amount <= 0) {
        throw new TransactionsSubscriptionsPersistenceError("VALIDATION_FAILED", "merchant and positive amount are required.", 400);
      }
      try {
        return await withScopedTransaction(ctx, async (txCtx) => {
          const userId = await ensureUser(txCtx);
          const merchantCanonical = input.merchant.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "subscription";
          const appId = stableSubscriptionAppId(merchantCanonical, txCtx.workspaceId);
          await idempotency(txCtx, "subscriptions:upsert", input.idempotencyKey || `subscription:${appId}:${input.amount}:${input.cadence}`, {
            merchantCanonical,
            amount: input.amount,
            cadence: input.cadence,
          });
          const row = await scopedDb(txCtx).query<SubscriptionRow>(
            `insert into user_subscriptions(user_id, workspace_id, app_id, transaction_app_id, merchant, merchant_canonical, amount, cadence, next_renewal_date, savings_opportunity, payload, source, correlation_id)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
             on conflict (user_id, app_id) do update
               set merchant = excluded.merchant,
                   amount = excluded.amount,
                   cadence = excluded.cadence,
                   next_renewal_date = excluded.next_renewal_date,
                   savings_opportunity = excluded.savings_opportunity,
                   active = true,
                   archived_at = null,
                   payload = excluded.payload,
                   version = user_subscriptions.version + 1,
                   updated_at = now(),
                   source = excluded.source,
                   correlation_id = excluded.correlation_id
             returning app_id as "appId", workspace_id as "workspaceId", transaction_app_id as "transactionId",
                       merchant, merchant_canonical as "merchantCanonical", amount, cadence, next_renewal_date as "nextRenewalDate",
                       cancellation_score as "cancellationScore", pricing_anomaly_score as "pricingAnomalyScore",
                       savings_opportunity as "savingsOpportunity", active, created_at as "createdAt", updated_at as "updatedAt"`,
            [
              userId,
              txCtx.workspaceId,
              appId,
              input.transactionId ?? null,
              input.merchant.trim().slice(0, 160),
              merchantCanonical,
              input.amount,
              input.cadence,
              nextRenewalDate(input.cadence),
              Math.round(monthlyAmount(input.amount, input.cadence) * 12 * 0.15 * 100) / 100,
              JSON.stringify({ source: "manual" }),
              txCtx.source,
              txCtx.correlationId,
            ],
          );
          if (!row.rows[0]) throw new TransactionsSubscriptionsPersistenceError("VALIDATION_FAILED", "Subscription could not be saved.", 422);
          return mapSubscription(row.rows[0]);
        });
      } catch (error) {
        throw toSafeTransactionsError(error);
      }
    },

    async archiveAllSubscriptions(session: AuthenticatedSession): Promise<{ archivedCount: number }> {
      const ctx = ctxFromSession(session);
      try {
        return await withScopedTransaction(ctx, async (txCtx) => {
          const userId = await ensureUser(txCtx);
          const result = await scopedDb(txCtx).query<{ archivedCount: string }>(
            `with archived as (
               update user_subscriptions
               set active = false, archived_at = now(), updated_at = now(), version = version + 1, source = $3, correlation_id = $4
               where user_id = $1 and workspace_id = $2 and archived_at is null
               returning id
             )
             select count(*)::text as "archivedCount" from archived`,
            [userId, txCtx.workspaceId, txCtx.source, txCtx.correlationId],
          );
          return { archivedCount: Number(result.rows[0]?.archivedCount ?? 0) };
        });
      } catch (error) {
        throw toSafeTransactionsError(error);
      }
    },

    async subscriptionIntelligence(session: AuthenticatedSession): Promise<SubscriptionIntelligenceResult> {
      const result = await this.listSubscriptions(session);
      const groups = subscriptionGroups(result.subscriptions);
      const cadenceResults = groups.map((group) => ({
        merchant: group.merchant,
        currentAmount: group.currentAmount,
        ...detectCadence(group.amounts, group.dates),
      }));
      const renewals = predictRenewals(groups);
      const savings = generateSavingsRecommendations(groups.map((group) => ({ merchant: group.merchant, amount: group.currentAmount, duplicateOf: group.duplicateOf })));
      const anomalies = detectAnomalies(groups);
      const duplicates = groups.filter((group) => group.duplicateOf);
      const monthlyTotal = groups.reduce((sum, group) => sum + group.currentAmount, 0);
      return {
        dataSource: "postgres",
        storageMode: "postgres",
        summary: {
          activeSubscriptions: groups.length,
          monthlyTotal: Math.round(monthlyTotal * 100) / 100,
          annualisedTotal: Math.round(monthlyTotal * 12 * 100) / 100,
          duplicateCount: duplicates.length,
          anomalyCount: anomalies.length,
          potentialMonthlySaving: Math.round(savings.totalPotentialSaving * 100) / 100,
        },
        cadences: cadenceResults,
        renewals,
        duplicates: duplicates.map((group) => ({ merchant: group.merchant, amount: group.currentAmount, duplicateOf: group.duplicateOf })),
        anomalies,
        savings,
        generatedAt: nowIso(),
      };
    },
  };
}
