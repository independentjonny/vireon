import { summariseTransactions } from "./transactionEngine";
import { subscriptionSummary } from "./subscriptionEngine";

export type HealthSubScore = {
  label: string;
  score: number;
  note: string;
};

export function calculateHealthScore() {
  const cashflow = summariseTransactions();
  const subscriptions = subscriptionSummary();

  let score = 90;

  if (subscriptions.monthlySpend > 300) score -= 8;
  if (cashflow.net < 0) score -= 15;
  if (subscriptions.optimisationCount > 2) score -= 4;

  return {
    score,
    label: score >= 85 ? "Strong" : score >= 70 ? "Stable" : "Needs attention",
    drivers: [
      "Cash flow remains positive",
      "Recurring subscription spend is visible",
      "Optimisation opportunities detected",
    ],
    subScores: getHealthSubScores(),
  };
}

export function getHealthSubScores(): HealthSubScore[] {
  return [
    { label: "Liquidity", score: 92, note: "Strong" },
    { label: "Diversification", score: 74, note: "Moderate" },
    { label: "Debt Coverage", score: 88, note: "Healthy" },
    { label: "Savings Habit", score: 95, note: "Excellent" },
  ];
}
