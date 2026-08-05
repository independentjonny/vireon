import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import {
  getLocalImports,
  getLocalSubscriptions,
  getLocalTransactions,
  replaceLocalBackupCollections,
} from "@/lib/localStore";
import type { LocalImportRecord } from "@/lib/localStore";
import type { SubscriptionRecord, TransactionRecord } from "@/lib/persistence/schema";

const MAX_BACKUP_BYTES = 2_000_000;
const MAX_COLLECTION_SIZE = 10_000;

function limitCollection<T>(value: unknown, name: string): T[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_COLLECTION_SIZE) throw new Error(`${name} exceeds import limits.`);
  return value as T[];
}

function stringValue(value: unknown, field: string, max = 256): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw new Error(`Invalid ${field}.`);
  return value;
}

function isoDateValue(value: unknown, field: string): string {
  const text = stringValue(value, field, 64);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`Invalid ${field}.`);
  return text;
}

function validateTransaction(input: TransactionRecord): void {
  stringValue(input.id, "transaction id");
  stringValue(input.merchant, "transaction merchant");
  stringValue(input.merchantCanonical, "transaction merchant canonical");
  if (!Number.isFinite(input.amount) || Math.abs(input.amount) > 100_000_000) throw new Error("Invalid transaction amount.");
  stringValue(input.currency, "transaction currency", 3);
  isoDateValue(input.date, "transaction date");
  isoDateValue(input.createdAt, "transaction createdAt");
}

function validateSubscription(input: SubscriptionRecord): void {
  stringValue(input.id, "subscription id");
  stringValue(input.merchant, "subscription merchant");
  stringValue(input.merchantCanonical, "subscription merchant canonical");
  if (!Number.isFinite(input.amount) || Math.abs(input.amount) > 100_000_000) throw new Error("Invalid subscription amount.");
  if (!["monthly", "quarterly", "annual"].includes(input.cadence)) throw new Error("Invalid subscription cadence.");
  isoDateValue(input.nextRenewalDate, "subscription nextRenewalDate");
}

function validateImport(input: LocalImportRecord): void {
  stringValue(input.id, "import id");
  if (!Number.isInteger(input.rowCount) || input.rowCount < 0 || input.rowCount > MAX_COLLECTION_SIZE) throw new Error("Invalid import rowCount.");
  if (!Number.isFinite(input.healthScore) || input.healthScore < 0 || input.healthScore > 100) throw new Error("Invalid import healthScore.");
  isoDateValue(input.importedAt, "import importedAt");
  if (!Array.isArray(input.transactionIds) || input.transactionIds.length > MAX_COLLECTION_SIZE) throw new Error("Invalid import transactionIds.");
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BACKUP_BYTES) {
    return Response.json({ ok: false, error: "Backup import is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Expected JSON object" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const version = typeof payload.version === "string" ? payload.version : "";
  if (version !== "1.0.0") {
    return Response.json({ ok: false, error: "Unsupported backup version." }, { status: 400 });
  }

  let transactions: TransactionRecord[];
  let subscriptions: SubscriptionRecord[];
  let imports: LocalImportRecord[];
  try {
    transactions = limitCollection<TransactionRecord>(data.transactions, "transactions");
    subscriptions = limitCollection<SubscriptionRecord>(data.subscriptions, "subscriptions");
    imports = limitCollection<LocalImportRecord>(data.imports, "imports");
    transactions.forEach(validateTransaction);
    subscriptions.forEach(validateSubscription);
    imports.forEach(validateImport);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid backup." },
      { status: 400 }
    );
  }

  const scopedTransactions = transactions.map((transaction) => ({
    ...transaction,
    userId: auth.session.userId,
    workspaceId: auth.session.workspaceId,
  }));
  const scopedSubscriptions = subscriptions.map((subscription) => ({
    ...subscription,
    workspaceId: auth.session.workspaceId,
  }));
  const scopedImports = imports.map((record) => ({
    ...record,
    userId: auth.session.userId,
    workspaceId: auth.session.workspaceId,
  }));

  const existingTransactions = getLocalTransactions();
  const existingTxIds = new Set(existingTransactions.map((transaction) => transaction.id));
  const newTxs = scopedTransactions.filter((transaction) => !existingTxIds.has(transaction.id));
  const existingSubs = getLocalSubscriptions();
  const existingSubIds = new Set(existingSubs.map((subscription) => subscription.id));
  const newSubs = scopedSubscriptions.filter((subscription) => !existingSubIds.has(subscription.id));

  const existingImportIds = new Set(getLocalImports().map((record) => record.id));
  const newImports = scopedImports.filter((record) => !existingImportIds.has(record.id));

  try {
    replaceLocalBackupCollections({
      transactions: [...existingTransactions, ...newTxs],
      subscriptions: [...existingSubs, ...newSubs],
      imports: [...getLocalImports(), ...newImports],
    });
  } catch {
    return Response.json({ ok: false, error: "Backup import could not be persisted." }, { status: 503 });
  }

  return Response.json({
    ok: true,
    restored: {
      transactions: newTxs.length,
      subscriptions: newSubs.length,
      imports: newImports.length,
    },
    message: `Restored ${newTxs.length} transactions, ${newSubs.length} subscriptions, and ${newImports.length} import records.`,
  });
}
