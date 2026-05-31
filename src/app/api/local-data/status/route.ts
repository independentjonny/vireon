import { hasLocalData, getStorageMode, getLocalMemory } from "@/lib/localStore";

export async function GET() {
  const counts = hasLocalData();
  const memory = getLocalMemory();

  return Response.json({
    ok: true,
    storageMode: getStorageMode(),
    mode: "Local Persistent Mode",
    dataPath: ".ai/local-data/",
    counts: {
      transactions: counts.transactions,
      subscriptions: counts.subscriptions,
      imports: counts.imports,
      memory: memory.length,
    },
    labels: {
      transactions: "Persisted Transactions",
      subscriptions: "Detected Subscriptions",
      imports: "Import Runs",
      memory: "Memory Nodes",
    },
  });
}
