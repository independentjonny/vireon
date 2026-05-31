import { summariseTransactions } from "./transactionEngine";
import { subscriptionSummary } from "./subscriptionEngine";
import { calculateHealthScore } from "./healthEngine";

export function executiveAnalytics() {
  return {
    cashflow: summariseTransactions(),
    subscriptions: subscriptionSummary(),
    health: calculateHealthScore(),
    generatedAt: new Date().toISOString(),
  };
}
