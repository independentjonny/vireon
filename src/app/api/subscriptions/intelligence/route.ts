import { detectCadence } from "@/lib/subscriptions/cadenceDetector";
import { predictRenewals } from "@/lib/subscriptions/renewalPredictor";
import { generateSavingsRecommendations } from "@/lib/subscriptions/savingsRecommender";
import { getTransactions } from "@/lib/transactionEngine";
import { getLocalTransactions, getLocalSubscriptions, getStorageMode, hasLocalData } from "@/lib/localStore";

type SubscriptionGroup = {
  merchant: string;
  amounts: number[];
  dates: string[];
  currentAmount: number;
  duplicateOf?: string;
};

function groupFromMockTransactions(): SubscriptionGroup[] {
  const transactions = getTransactions().filter((tx) => tx.recurring);
  const groups: Record<string, SubscriptionGroup> = {};

  for (const tx of transactions) {
    const key = tx.merchant.toLowerCase();
    if (!groups[key]) {
      groups[key] = { merchant: tx.merchant, amounts: [], dates: [], currentAmount: 0 };
    }
    groups[key].amounts.push(Math.abs(tx.amount));
    groups[key].dates.push(tx.date);
    groups[key].currentAmount = Math.abs(tx.amount);
  }

  const grouped = Object.values(groups);
  const seen = new Map<string, string>();
  for (const g of grouped) {
    const amountKey = g.currentAmount.toFixed(2);
    if (seen.has(amountKey)) g.duplicateOf = seen.get(amountKey);
    else seen.set(amountKey, g.merchant);
  }

  return grouped;
}

function groupFromLocalData(): SubscriptionGroup[] {
  const localSubs = getLocalSubscriptions();

  if (localSubs.length > 0) {
    const groups: SubscriptionGroup[] = localSubs.map((s) => {
      const cadenceDays: Record<string, number> = { monthly: 30, quarterly: 90, annual: 365 };
      const days = cadenceDays[s.cadence] ?? 30;
      return {
        merchant: s.merchant,
        amounts: [s.amount, s.amount],
        dates: [
          new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          s.nextRenewalDate,
        ],
        currentAmount: s.amount,
      };
    });

    const seen = new Map<string, string>();
    for (const g of groups) {
      const key = g.currentAmount.toFixed(2);
      if (seen.has(key)) g.duplicateOf = seen.get(key);
      else seen.set(key, g.merchant);
    }

    return groups;
  }

  const localTxs = getLocalTransactions().filter((tx) => tx.recurring);
  if (localTxs.length === 0) return [];

  const groups: Record<string, SubscriptionGroup> = {};
  for (const tx of localTxs) {
    const key = tx.merchantCanonical;
    if (!groups[key]) {
      groups[key] = { merchant: tx.merchant, amounts: [], dates: [], currentAmount: 0 };
    }
    groups[key].amounts.push(Math.abs(tx.amount));
    groups[key].dates.push(tx.date);
    groups[key].currentAmount = Math.abs(tx.amount);
  }

  const grouped = Object.values(groups);
  const seen = new Map<string, string>();
  for (const g of grouped) {
    const key = g.currentAmount.toFixed(2);
    if (seen.has(key)) g.duplicateOf = seen.get(key);
    else seen.set(key, g.merchant);
  }

  return grouped;
}

function detectAnomalies(groups: SubscriptionGroup[]) {
  return groups
    .filter((g) => g.amounts.length >= 2)
    .flatMap((g) => {
      const avg = g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length;
      return g.amounts
        .filter((a) => Math.abs(a - avg) > avg * 0.15)
        .map((a) => ({
          merchant: g.merchant,
          anomalyAmount: a,
          averageAmount: Math.round(avg * 100) / 100,
          deviation: Math.round(((a - avg) / avg) * 100),
          type: a > avg ? "price_increase" : "price_decrease",
        }));
    });
}

export async function GET() {
  const storageMode = getStorageMode();
  const localCounts = hasLocalData();
  const hasLocal = localCounts.transactions > 0 || localCounts.subscriptions > 0;

  const groups = hasLocal ? groupFromLocalData() : groupFromMockTransactions();
  const dataSource = hasLocal ? "local-persistent" : "mock";

  const cadenceResults = groups.map((g) => ({
    merchant: g.merchant,
    currentAmount: g.currentAmount,
    ...detectCadence(g.amounts, g.dates),
  }));

  const renewalForecast = predictRenewals(groups);

  const savingsReport = generateSavingsRecommendations(
    groups.map((g) => ({
      merchant: g.merchant,
      amount: g.currentAmount,
      duplicateOf: g.duplicateOf,
    }))
  );

  const anomalies = detectAnomalies(groups);
  const duplicates = groups.filter((g) => g.duplicateOf);
  const monthlyTotal = groups.reduce((sum, g) => sum + g.currentAmount, 0);

  return Response.json({
    ok: true,
    storageMode,
    dataSource,
    summary: {
      activeSubscriptions: groups.length,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      annualisedTotal: Math.round(monthlyTotal * 12 * 100) / 100,
      duplicateCount: duplicates.length,
      anomalyCount: anomalies.length,
      potentialMonthlySaving: Math.round(savingsReport.totalPotentialSaving * 100) / 100,
    },
    cadences: cadenceResults,
    renewals: renewalForecast,
    duplicates: duplicates.map((g) => ({
      merchant: g.merchant,
      amount: g.currentAmount,
      duplicateOf: g.duplicateOf,
    })),
    anomalies,
    savings: savingsReport,
    generatedAt: new Date().toISOString(),
  });
}
