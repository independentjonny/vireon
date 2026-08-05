import type { TransactionRecord, SubscriptionRecord } from "@/lib/persistence/schema";

export interface FinanceSummary {
  income: number;
  spend: number;
  net: number;
  recurringSpend: number;
  subsMonthly: number;
  savingsRate: number;
  healthScore: number;
  healthLabel: "Strong" | "Stable" | "Needs Attention";
}

export interface CategorySummary {
  cat: string;
  spend: number;
  count: number;
}

export interface MerchantSummary {
  merchant: string;
  total: number;
  count: number;
}

export interface MonthSummary {
  month: string;
  income: number;
  spend: number;
  net: number;
}

export interface FinanceInsight {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  impact: string;
  actions: string[];
}

export function computeFinanceSummary(
  txs: TransactionRecord[],
  subs: SubscriptionRecord[]
): FinanceSummary {
  const income = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spend = Math.abs(txs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const net = income - spend;
  const recurringSpend = Math.abs(
    txs.filter((t) => t.recurring && t.amount < 0).reduce((s, t) => s + t.amount, 0)
  );
  const subsMonthly = subs.reduce((s, sub) => s + sub.amount, 0);
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  let healthScore = 78;
  if (savingsRate >= 30) healthScore += 12;
  else if (savingsRate >= 20) healthScore += 6;
  else if (savingsRate < 0 && txs.length > 0) healthScore -= 15;
  if (subsMonthly > 500) healthScore -= 8;
  else if (subsMonthly > 300) healthScore -= 4;
  if (txs.length > 20) healthScore += 5;
  healthScore = Math.min(100, Math.max(0, Math.round(healthScore)));

  const healthLabel =
    healthScore >= 85 ? "Strong" : healthScore >= 70 ? "Stable" : "Needs Attention";

  return { income, spend, net, recurringSpend, subsMonthly, savingsRate, healthScore, healthLabel };
}

export function computeCategoryMap(txs: TransactionRecord[]): CategorySummary[] {
  const catMap: Record<string, { spend: number; count: number }> = {};
  txs
    .filter((t) => t.amount < 0)
    .forEach((t) => {
      const c = t.category || "Other";
      if (!catMap[c]) catMap[c] = { spend: 0, count: 0 };
      catMap[c].spend += Math.abs(t.amount);
      catMap[c].count++;
    });
  return Object.entries(catMap)
    .map(([cat, v]) => ({ cat, spend: v.spend, count: v.count }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6);
}

export function computeMerchantMap(txs: TransactionRecord[]): MerchantSummary[] {
  const map: Record<string, { total: number; count: number }> = {};
  txs
    .filter((t) => t.amount < 0)
    .forEach((t) => {
      const m = t.merchantCanonical || t.merchant || "Unknown";
      if (!map[m]) map[m] = { total: 0, count: 0 };
      map[m].total += Math.abs(t.amount);
      map[m].count++;
    });
  return Object.entries(map)
    .map(([merchant, v]) => ({ merchant, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

export function computeMonthSummaries(txs: TransactionRecord[]): MonthSummary[] {
  const monthMap: Record<string, { income: number; spend: number }> = {};
  txs.forEach((t) => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { income: 0, spend: 0 };
    if (t.amount > 0) monthMap[key].income += t.amount;
    else monthMap[key].spend += Math.abs(t.amount);
  });
  return Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, v]) => ({ month, income: v.income, spend: v.spend, net: v.income - v.spend }));
}

export function computeCashflowForecast(
  months: MonthSummary[]
): { month: string; forecastNet: number; forecastIncome: number; forecastSpend: number }[] {
  if (months.length < 2) return [];
  const avgIncome = months.reduce((s, m) => s + m.income, 0) / months.length;
  const avgSpend = months.reduce((s, m) => s + m.spend, 0) / months.length;
  const last = months[months.length - 1];
  const lastDate = new Date(last.month + "-01");
  return [1, 2, 3].map((offset) => {
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + offset);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      month,
      forecastIncome: Math.round(avgIncome),
      forecastSpend: Math.round(avgSpend),
      forecastNet: Math.round(avgIncome - avgSpend),
    };
  });
}

export function generateInsights(
  txs: TransactionRecord[],
  subs: SubscriptionRecord[],
  summary: FinanceSummary
): FinanceInsight[] {
  const insights: FinanceInsight[] = [];
  if (txs.length === 0) {
    insights.push({
      id: "import-data",
      title: "Import transaction data",
      description:
        "No transactions imported yet. Import a CSV file to unlock insights.",
      severity: "medium",
      confidence: 100,
      impact: "Unlocks all finance features",
      actions: ["Use the Import section", "Paste CSV data", "Click Persist to Local Storage"],
    });
    return insights;
  }
  if (summary.subsMonthly > 100) {
    insights.push({
      id: "sub-spend",
      title: "Subscription spend detected",
      description: `$${summary.subsMonthly.toFixed(0)}/month across ${subs.length} subscription(s). Consider reviewing annual plans.`,
      severity: summary.subsMonthly > 300 ? "high" : "medium",
      confidence: 92,
      impact: `~$${(summary.subsMonthly * 0.2 * 12).toFixed(0)}/year savings potential`,
      actions: ["Review subscription list", "Cancel unused services", "Look for annual plan discounts"],
    });
  }
  if (summary.income > 0) {
    insights.push({
      id: "savings-rate",
      title: summary.savingsRate >= 20 ? "Strong savings rate" : "Savings rate opportunity",
      description: `Savings rate: ${summary.savingsRate.toFixed(1)}%. ${summary.savingsRate >= 20 ? "Above 20% target." : "Below 20% — review discretionary spend."}`,
      severity: summary.savingsRate >= 20 ? "low" : "medium",
      confidence: 88,
      impact:
        summary.savingsRate < 20
          ? `$${((0.2 - summary.savingsRate / 100) * summary.income).toFixed(0)} additional savings potential`
          : "On track",
      actions:
        summary.savingsRate < 20
          ? ["Review dining & entertainment", "Automate savings transfers", "Set a monthly budget"]
          : ["Maintain savings habits"],
    });
  }
  const finSavingsOpp = subs.reduce((s, sub) => s + (sub.savingsOpportunity || 0), 0);
  if (finSavingsOpp > 0) {
    insights.push({
      id: "savings-opp",
      title: "Subscription savings opportunity",
      description: `VIREON estimates ~$${finSavingsOpp.toFixed(0)}/year savings across current subscriptions.`,
      severity: "medium",
      confidence: 80,
      impact: `$${finSavingsOpp.toFixed(0)}/year`,
      actions: ["Review flagged subscriptions", "Accept/reject recommendations"],
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "cashflow-ok",
      title: "Positive cash flow",
      description:
        "Your imports show a net-positive cash flow. Keep up the consistent savings habit.",
      severity: "low",
      confidence: 85,
      impact: "Healthy trajectory",
      actions: ["Continue monitoring monthly"],
    });
  }
  return insights;
}

export function computeAnomalousTransactions(
  txs: TransactionRecord[],
  categories: CategorySummary[]
): TransactionRecord[] {
  const catAvgs: Record<string, number> = {};
  categories.forEach(({ cat, spend, count }) => {
    catAvgs[cat] = spend / Math.max(count, 1);
  });
  return txs
    .filter((t) => {
      if (t.amount >= 0) return false;
      const avg = catAvgs[t.category || "Other"] || 0;
      return avg > 0 && Math.abs(t.amount) > avg * 2.5;
    })
    .slice(0, 6);
}
