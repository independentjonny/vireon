import {
  appendLocalTransactions,
  saveLocalSubscriptions,
  getLocalSubscriptions,
  getLocalImports,
  appendLocalImport,
} from "@/lib/localStore";
import type { TransactionRecord, SubscriptionRecord } from "@/lib/persistence/schema";
import type { LocalImportRecord } from "@/lib/localStore";

export async function POST(req: Request) {
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

  const transactions: TransactionRecord[] = Array.isArray(data.transactions) ? data.transactions as TransactionRecord[] : [];
  const subscriptions: SubscriptionRecord[] = Array.isArray(data.subscriptions) ? data.subscriptions as SubscriptionRecord[] : [];
  const imports: LocalImportRecord[] = Array.isArray(data.imports) ? data.imports as LocalImportRecord[] : [];

  const addedTxs = appendLocalTransactions(transactions);

  const existingSubs = getLocalSubscriptions();
  const existingSubIds = new Set(existingSubs.map(s => s.id));
  const newSubs = subscriptions.filter(s => !existingSubIds.has(s.id));
  saveLocalSubscriptions([...existingSubs, ...newSubs]);

  const existingImportIds = new Set(getLocalImports().map(i => i.id));
  for (const imp of imports) {
    if (!existingImportIds.has(imp.id)) {
      appendLocalImport(imp);
    }
  }

  return Response.json({
    ok: true,
    restored: {
      transactions: addedTxs,
      subscriptions: newSubs.length,
      imports: imports.filter(i => !existingImportIds.has(i.id)).length,
    },
    message: `Restored ${addedTxs} transactions, ${newSubs.length} subscriptions, and ${imports.filter(i => !existingImportIds.has(i.id)).length} import records.`,
  });
}
