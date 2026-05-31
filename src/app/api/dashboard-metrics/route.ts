import { NextResponse } from "next/server";
import { getLocalTransactions, getLocalSubscriptions, hasLocalData } from "@/lib/localStore";
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

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const txs = getLocalTransactions();
    const subs = getLocalSubscriptions();
    const counts = hasLocalData();
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
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
