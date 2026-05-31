import { getTransactions, summariseTransactions } from "@/lib/transactionEngine";
import { getLocalTransactions, hasLocalData, getStorageMode } from "@/lib/localStore";

export async function GET() {
  const storageMode = getStorageMode();
  const localCounts = hasLocalData();

  if (localCounts.transactions > 0) {
    const localTxs = getLocalTransactions();
    const income = localTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const spend = localTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return Response.json({
      ok: true,
      dataSource: "local-persistent",
      storageMode,
      transactions: localTxs,
      summary: {
        income,
        spend,
        net: income - spend,
        transactionCount: localTxs.length,
      },
    });
  }

  return Response.json({
    ok: true,
    dataSource: "mock",
    storageMode,
    transactions: getTransactions(),
    summary: summariseTransactions(),
  });
}
