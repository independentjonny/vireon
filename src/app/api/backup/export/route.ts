import {
  getLocalTransactions,
  getLocalSubscriptions,
  getLocalImports,
  getLocalMemory,
  getLocalTelemetry,
} from "@/lib/localStore";

export async function GET() {
  const backup = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    source: "liberva-local-backup",
    data: {
      transactions: getLocalTransactions(),
      subscriptions: getLocalSubscriptions(),
      imports: getLocalImports(),
      memory: getLocalMemory(),
      telemetry: getLocalTelemetry().slice(-100),
    },
    counts: {
      transactions: getLocalTransactions().length,
      subscriptions: getLocalSubscriptions().length,
      imports: getLocalImports().length,
    },
  };

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="liberva-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
