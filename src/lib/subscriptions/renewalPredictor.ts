import { detectCadence } from "./cadenceDetector";

export type RenewalPrediction = {
  merchant: string;
  amount: number;
  nextRenewalDate: string;
  confidence: number;
  cadence: string;
  urgency: "today" | "this_week" | "this_month" | "later";
};

export type RenewalForecast = {
  predictions: RenewalPrediction[];
  totalDueThisMonth: number;
  generatedAt: string;
};

export function predictRenewals(
  subscriptions: Array<{ merchant: string; amounts: number[]; dates: string[] }>
): RenewalForecast {
  const predictions: RenewalPrediction[] = [];
  const now = new Date();

  for (const sub of subscriptions) {
    const cadenceResult = detectCadence(sub.amounts, sub.dates);
    if (!cadenceResult.nextExpected || cadenceResult.confidence < 0.5) continue;

    const nextDate = new Date(cadenceResult.nextExpected);
    const daysUntil = Math.round((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const urgency: RenewalPrediction["urgency"] =
      daysUntil <= 0 ? "today" :
      daysUntil <= 7 ? "this_week" :
      daysUntil <= 30 ? "this_month" :
      "later";

    predictions.push({
      merchant: sub.merchant,
      amount: sub.amounts[sub.amounts.length - 1] || 0,
      nextRenewalDate: cadenceResult.nextExpected,
      confidence: cadenceResult.confidence,
      cadence: cadenceResult.cadence,
      urgency,
    });
  }

  predictions.sort((a, b) => new Date(a.nextRenewalDate).getTime() - new Date(b.nextRenewalDate).getTime());

  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const totalDueThisMonth = predictions
    .filter((p) => new Date(p.nextRenewalDate) <= thisMonthEnd)
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    predictions,
    totalDueThisMonth,
    generatedAt: now.toISOString(),
  };
}
