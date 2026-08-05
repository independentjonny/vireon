import { NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import {
  computeFinanceSummary,
  computeCategoryMap,
  computeMerchantMap,
  computeMonthSummaries,
  computeCashflowForecast,
  computeAnomalousTransactions,
  generateInsights,
} from "@/lib/services/financeService";
import {
  computeUpcomingRenewals,
  totalMonthlyCost,
  totalSavingsOpportunity,
  findDuplicateRisk,
} from "@/lib/services/subscriptionService";
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
    const counts = { transactions: txs.length, subscriptions: subs.length, imports: 0 };
    const summary = computeFinanceSummary(txs, subs);
    const categories = computeCategoryMap(txs);
    const merchants = computeMerchantMap(txs);
    const months = computeMonthSummaries(txs);
    const forecast = computeCashflowForecast(months);
    const anomalous = computeAnomalousTransactions(txs, categories);
    const insights = generateInsights(txs, subs, summary);

    const subscriptions = {
      totalMonthly: totalMonthlyCost(subs),
      totalYearly: Math.round(totalMonthlyCost(subs) * 12 * 100) / 100,
      savingsOpportunity: totalSavingsOpportunity(subs),
      duplicateRiskCount: findDuplicateRisk(subs).length,
      upcomingRenewals: computeUpcomingRenewals(subs, 5),
    };

    return NextResponse.json({
      ok: true,
      counts,
      summary,
      categories,
      merchants,
      months,
      forecast,
      anomalous,
      insights,
      subscriptions,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    const safe = toSafeTransactionsError(err);
    return NextResponse.json(
      { ok: false, error: safe.message, code: safe.code },
      { status: safe.status }
    );
  }
}
