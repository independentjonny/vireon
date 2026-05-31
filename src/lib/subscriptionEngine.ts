import { getTransactions } from "./transactionEngine";

export type Subscription = {
  merchant: string;
  amount: number;
  cadence: "monthly" | "annual";
  risk: "low" | "medium" | "high";
};

export function detectSubscriptions(): Subscription[] {
  return getTransactions()
    .filter(tx => tx.recurring)
    .map(tx => ({
      merchant: tx.merchant,
      amount: Math.abs(tx.amount),
      cadence: "monthly",
      risk: tx.amount < -50 ? "high" : "medium",
    }));
}

export function subscriptionSummary() {
  const subscriptions = detectSubscriptions();
  const monthlySpend = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);

  return {
    subscriptions,
    monthlySpend,
    annualisedSpend: monthlySpend * 12,
    optimisationCount: subscriptions.length,
  };
}
