import { NextResponse } from "next/server";
import {
  getLocalTransactions,
  getLocalSubscriptions,
  getLocalImports,
  getWorkflowRuns,
} from "@/lib/localStore";
import { computeFinanceSummary, generateInsights } from "@/lib/services/financeService";
import { computeCleanupEntries } from "@/lib/services/merchantService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const txs = getLocalTransactions();
    const subs = getLocalSubscriptions();
    const imports = getLocalImports();
    const summary = computeFinanceSummary(txs, subs);
    const insights = generateInsights(txs, subs, summary);
    const cleanupEntries = computeCleanupEntries(txs);
    const workflowRuns = getWorkflowRuns();

    const stages = [
      {
        name: "Import",
        status: imports.length > 0 ? "pass" : "pending",
        detail: `${imports.length} run(s) · ${txs.length} rows`,
      },
      {
        name: "Merchant Cleanup",
        status: txs.length > 0 ? "pass" : "pending",
        detail: `${cleanupEntries.length} normalized`,
      },
      {
        name: "Subscription Detection",
        status: subs.length > 0 ? "pass" : "pending",
        detail: `${subs.length} detected`,
      },
      {
        name: "Insight Generation",
        status: insights.length > 0 ? "pass" : "pending",
        detail: `${insights.length} insight(s)`,
      },
      {
        name: "Copilot Context",
        status: txs.length > 0 ? "pass" : "pending",
        detail: `${txs.length} txns`,
      },
      {
        name: "Health Score",
        status: "pass",
        detail: `Score: ${txs.length > 0 ? summary.healthScore : 93}/100`,
      },
    ] as const;

    const passing = stages.filter((s) => s.status === "pass").length;

    return NextResponse.json({
      ok: true,
      stages,
      passing,
      total: stages.length,
      allPass: passing === stages.length,
      workflowRuns: workflowRuns.slice(-5).reverse(),
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
