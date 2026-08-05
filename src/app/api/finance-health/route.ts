import { NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import {
  computeFinanceSummary,
  computeCategoryMap,
  computeMonthSummaries,
  computeCashflowForecast,
  generateInsights,
} from "@/lib/services/financeService";
import { totalSavingsOpportunity } from "@/lib/services/subscriptionService";
import { createTransactionsSubscriptionsServiceFromEnv, toSafeTransactionsError } from "@/server/services/transactionsSubscriptionsPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "read:transactions");
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const service = createTransactionsSubscriptionsServiceFromEnv();
    const [transactionsResult, subscriptionsResult] = await Promise.all([
      service.listTransactions(auth.session),
      service.listSubscriptions(auth.session),
    ]);
    const txs = transactionsResult.transactions;
    const subs = subscriptionsResult.subscriptions;
    const summary = computeFinanceSummary(txs, subs);
    const categories = computeCategoryMap(txs);
    const months = computeMonthSummaries(txs);
    const forecast = computeCashflowForecast(months);
    const insights = generateInsights(txs, subs, summary);
    const savingsOpportunity = totalSavingsOpportunity(subs);

    const subScores = [
      {
        label: "Cash Flow",
        score: summary.net >= 0 ? 88 : 45,
        note: summary.net >= 0 ? "Positive" : "Negative",
      },
      {
        label: "Recurring Burden",
        score: summary.subsMonthly < 200 ? 90 : summary.subsMonthly < 400 ? 75 : 58,
        note: summary.subsMonthly < 200 ? "Efficient" : "Review needed",
      },
      {
        label: "Data Coverage",
        score: txs.length > 20 ? 90 : txs.length > 5 ? 75 : 60,
        note: txs.length > 20 ? "Rich dataset" : "More data helpful",
      },
      {
        label: "Diversification",
        score: categories.length >= 4 ? 85 : categories.length >= 2 ? 70 : 55,
        note: categories.length >= 4 ? "Well spread" : "Limited categories",
      },
      {
        label: "Savings Opportunity",
        score: savingsOpportunity > 0 ? Math.min(95, 70 + Math.round(savingsOpportunity / 50)) : 80,
        note: savingsOpportunity > 0 ? `$${savingsOpportunity.toFixed(0)}/yr potential` : "No subs flagged",
      },
    ];

    return NextResponse.json({
      ok: true,
      summary,
      subScores,
      forecast,
      insights,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    const safe = toSafeTransactionsError(err);
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
