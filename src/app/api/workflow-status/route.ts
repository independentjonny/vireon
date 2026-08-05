import { NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import { computeFinanceSummary, generateInsights } from "@/lib/services/financeService";
import { computeCleanupEntries } from "@/lib/services/merchantService";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";
import { createTransactionsSubscriptionsServiceFromEnv, toSafeTransactionsError } from "@/server/services/transactionsSubscriptionsPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "read:transactions");
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const transactionService = createTransactionsSubscriptionsServiceFromEnv();
    const decisioningService = createCoreDecisioningServiceFromEnv();
    const [transactionsResult, subscriptionsResult, workflowState] = await Promise.all([
      transactionService.listTransactions(auth.session),
      transactionService.listSubscriptions(auth.session),
      decisioningService.readWorkflows(auth.session),
    ]);
    const txs = transactionsResult.transactions;
    const subs = subscriptionsResult.subscriptions;
    const summary = computeFinanceSummary(txs, subs);
    const insights = generateInsights(txs, subs, summary);
    const cleanupEntries = computeCleanupEntries(txs);
    const workflowRuns = workflowState.executions.slice(-5).reverse();

    const stages = [
      {
        name: "Import",
        status: txs.length > 0 ? "pass" : "pending",
        detail: `${txs.length} persisted row(s)`,
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
        status: txs.length > 0 ? "pass" : "pending",
        detail: txs.length > 0 ? `Score: ${summary.healthScore}/100` : "Awaiting persisted transactions",
      },
    ] as const;

    const passing = stages.filter((s) => s.status === "pass").length;

    return NextResponse.json({
      ok: true,
      dataSource: "postgres",
      storageMode: "postgres",
      stages,
      passing,
      total: stages.length,
      allPass: passing === stages.length,
      workflowRuns,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    const safe = toSafeTransactionsError(err);
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
