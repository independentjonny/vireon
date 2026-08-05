import type { CanonicalFinancialRecord, FinancialRecordKind } from "@/lib/manualFinancialDataPlatform";

export const FINANCIAL_HEALTH_ENGINE_VERSION = "financial-health-engine-v1";

export type HealthRating = "Strong" | "Stable" | "Needs Attention" | "Insufficient Data";
export type HealthActionPriority = "Critical" | "High" | "Medium" | "Low";
export type HealthActionCategory = "Cash flow" | "Spending" | "Debt" | "Safety" | "Wealth" | "Data quality";

export type FinancialHealthMetric = {
  value: number;
  label: string;
  confidence: "High" | "Medium" | "Low";
  evidenceRecordIds: string[];
};

export type FinancialHealthAction = {
  id: string;
  priority: HealthActionPriority;
  category: HealthActionCategory;
  title: string;
  reason: string;
  recommendedAction: string;
  expectedImpact: string;
  evidenceRecordIds: string[];
  reviewRequired: boolean;
};

export type FinancialHealthSnapshot = {
  engineVersion: typeof FINANCIAL_HEALTH_ENGINE_VERSION;
  generatedAt: string;
  userId: string;
  recordCount: number;
  transactionCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  healthScore: number;
  healthRating: HealthRating;
  cashFlow: {
    averageMonthlyIncome: FinancialHealthMetric;
    averageMonthlySpending: FinancialHealthMetric;
    monthlySurplus: FinancialHealthMetric;
    savingsRate: FinancialHealthMetric;
    incomeStability: FinancialHealthMetric;
    burnRate: FinancialHealthMetric;
  };
  spending: {
    largestCategories: Array<{ category: string; amount: number; share: number; evidenceRecordIds: string[] }>;
    subscriptions: Array<{ merchant: string; monthlyAmount: number; occurrences: number; evidenceRecordIds: string[] }>;
    spendingTrend: FinancialHealthMetric;
    merchantConcentration: FinancialHealthMetric;
  };
  debt: {
    totalDebt: FinancialHealthMetric;
    debtToIncomeRatio: FinancialHealthMetric;
    mortgageUtilisation: FinancialHealthMetric;
    creditCardUtilisation: FinancialHealthMetric;
    estimatedMonthlyInterest: FinancialHealthMetric;
  };
  safety: {
    emergencyFundMonths: FinancialHealthMetric;
    liquidity: FinancialHealthMetric;
    incomeConcentration: FinancialHealthMetric;
    upcomingLargeObligations: Array<{ label: string; amount: number; evidenceRecordIds: string[] }>;
  };
  wealth: {
    netWorth: FinancialHealthMetric;
    assetAllocation: Array<{ category: string; amount: number; share: number; evidenceRecordIds: string[] }>;
    superProportion: FinancialHealthMetric;
    debtRatio: FinancialHealthMetric;
  };
  actions: FinancialHealthAction[];
  aiCfoBriefingFacts: string[];
  missingData: string[];
};

type Tx = {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  merchant: string;
};

type Month = {
  key: string;
  income: number;
  spending: number;
  net: number;
  recordIds: string[];
};

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("en-AU")}`;
}

function pct(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[$,\s]/g, "")) : NaN;
  return Number.isFinite(number) ? number : 0;
}

function metric(value: number, label: string, confidence: FinancialHealthMetric["confidence"], evidenceRecordIds: string[]): FinancialHealthMetric {
  return { value: Math.round(value * 100) / 100, label, confidence, evidenceRecordIds };
}

function recordNumber(record: CanonicalFinancialRecord, keys: string[]): number {
  for (const key of keys) {
    const value = asNumber(record.value[key]);
    if (value !== 0) return value;
  }
  return 0;
}

function recordsByKind(records: CanonicalFinancialRecord[], kind: FinancialRecordKind): CanonicalFinancialRecord[] {
  return records.filter((record) => record.kind === kind && !record.superseded && record.provenance.userConfirmed);
}

function inferCategory(description: string, explicit?: unknown): string {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const text = description.toLowerCase();
  if (/salary|payroll|wage|income/.test(text)) return "Income";
  if (/mortgage|home loan|repayment/.test(text)) return "Mortgage";
  if (/rent/.test(text)) return "Housing";
  if (/coles|woolworths|aldi|grocery|grocer/.test(text)) return "Groceries";
  if (/restaurant|dining|cafe|coffee|uber eats|doordash/.test(text)) return "Dining";
  if (/netflix|spotify|apple|google|subscription|prime|binge|stan/.test(text)) return "Subscriptions";
  if (/insurance|premium/.test(text)) return "Insurance";
  if (/electric|gas|water|internet|phone|utility/.test(text)) return "Utilities";
  if (/fuel|opal|transport|parking/.test(text)) return "Transport";
  if (/super/.test(text)) return "Super";
  return "Other";
}

function merchant(description: string): string {
  return description
    .replace(/\b\d{2,}\b/g, "")
    .replace(/[^a-zA-Z0-9 &'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64) || "Unknown merchant";
}

function transactionRecords(records: CanonicalFinancialRecord[]): Tx[] {
  return recordsByKind(records, "transaction")
    .map((record) => ({
      id: record.id,
      date: typeof record.value.date === "string" ? record.value.date : "",
      amount: recordNumber(record, ["amount"]),
      description: String(record.value.description ?? record.label),
      category: inferCategory(String(record.value.description ?? record.label), record.value.category),
      merchant: merchant(String(record.value.merchant ?? record.value.description ?? record.label)),
    }))
    .filter((tx) => tx.date && Number.isFinite(new Date(tx.date).getTime()) && tx.amount !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function monthKey(date: string): string {
  const parsed = new Date(date);
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthlyTransactions(transactions: Tx[]): Month[] {
  const months = new Map<string, Month>();
  for (const tx of transactions) {
    const key = monthKey(tx.date);
    const current = months.get(key) ?? { key, income: 0, spending: 0, net: 0, recordIds: [] };
    if (tx.amount > 0) current.income += tx.amount;
    if (tx.amount < 0) current.spending += Math.abs(tx.amount);
    current.net = current.income - current.spending;
    current.recordIds.push(tx.id);
    months.set(key, current);
  }
  return [...months.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function coefficientOfVariation(values: number[]): number {
  const mean = average(values);
  if (!mean) return 0;
  const variance = average(values.map((value) => Math.pow(value - mean, 2)));
  return Math.sqrt(variance) / mean;
}

function totalFor(records: CanonicalFinancialRecord[], keys: string[]): { amount: number; ids: string[] } {
  const matching = records.filter((record) => recordNumber(record, keys) !== 0);
  return {
    amount: matching.reduce((sum, record) => sum + Math.abs(recordNumber(record, keys)), 0),
    ids: matching.map((record) => record.id),
  };
}

function confidenceFromCount(count: number): FinancialHealthMetric["confidence"] {
  if (count >= 3) return "High";
  if (count >= 1) return "Medium";
  return "Low";
}

function addAction(actions: FinancialHealthAction[], action: FinancialHealthAction): void {
  if (!actions.some((item) => item.id === action.id)) actions.push(action);
}

const actionPriorityRank: Record<HealthActionPriority, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export function buildFinancialHealthSnapshot(input: {
  userId: string;
  records: CanonicalFinancialRecord[];
  asOf?: string;
}): FinancialHealthSnapshot {
  const generatedAt = input.asOf ?? new Date().toISOString();
  const records = input.records.filter((record) => record.userId === input.userId && !record.superseded && record.provenance.userConfirmed);
  const transactions = transactionRecords(records);
  const months = monthlyTransactions(transactions);
  const transactionEvidence = transactions.map((tx) => tx.id);
  const incomeRecords = recordsByKind(records, "income");
  const expenseRecords = recordsByKind(records, "expense");
  const accountRecords = recordsByKind(records, "account");
  const assetRecords = recordsByKind(records, "asset");
  const liabilityRecords = recordsByKind(records, "liability");

  const transactionIncome = average(months.map((month) => month.income));
  const transactionSpending = average(months.map((month) => month.spending));
  const manualIncome = incomeRecords.reduce((sum, record) => sum + recordNumber(record, ["monthlyAmount", "netMonthlyAmount", "amount", "annualAmount"]) / (record.value.annualAmount ? 12 : 1), 0);
  const manualExpenses = expenseRecords.reduce((sum, record) => sum + recordNumber(record, ["monthlyAmount", "amount"]), 0);
  const averageMonthlyIncome = transactionIncome || manualIncome;
  const averageMonthlySpending = transactionSpending || manualExpenses;
  const monthlySurplus = averageMonthlyIncome - averageMonthlySpending;
  const savingsRate = averageMonthlyIncome > 0 ? (monthlySurplus / averageMonthlyIncome) * 100 : 0;
  const incomeStabilityScore = Math.max(0, 100 - coefficientOfVariation(months.map((month) => month.income).filter(Boolean)) * 100);

  const liquid = totalFor(accountRecords.filter((record) => !/super|retirement|property/i.test(`${record.subtype} ${record.label}`)), ["balance", "amount", "value"]);
  const assets = totalFor([...accountRecords, ...assetRecords], ["balance", "marketValue", "amount", "value"]);
  const liabilities = totalFor(liabilityRecords, ["balance", "amount", "principal"]);
  const mortgage = liabilityRecords.filter((record) => /mortgage|home loan/i.test(`${record.subtype} ${record.label}`));
  const creditCards = liabilityRecords.filter((record) => /credit|card/i.test(`${record.subtype} ${record.label}`));
  const superRecords = [...accountRecords, ...assetRecords].filter((record) => /super|superannuation/i.test(`${record.subtype} ${record.label}`));
  const superTotal = superRecords.reduce((sum, record) => sum + recordNumber(record, ["balance", "marketValue", "amount", "value"]), 0);
  const totalIncomeAnnual = averageMonthlyIncome * 12;
  const estimatedMonthlyInterest = liabilityRecords.reduce((sum, record) => {
    const balance = recordNumber(record, ["balance", "amount", "principal"]);
    const rate = recordNumber(record, ["interestRate", "rate"]);
    return sum + (balance * rate / 100 / 12);
  }, 0);
  const netWorth = assets.amount - liabilities.amount;

  const categoryTotals = new Map<string, { amount: number; evidenceRecordIds: string[] }>();
  for (const tx of transactions.filter((item) => item.amount < 0)) {
    const current = categoryTotals.get(tx.category) ?? { amount: 0, evidenceRecordIds: [] };
    current.amount += Math.abs(tx.amount);
    current.evidenceRecordIds.push(tx.id);
    categoryTotals.set(tx.category, current);
  }
  const totalSpend = [...categoryTotals.values()].reduce((sum, item) => sum + item.amount, 0);
  const largestCategories = [...categoryTotals.entries()]
    .map(([category, item]) => ({ category, amount: Math.round(item.amount), share: totalSpend > 0 ? Math.round((item.amount / totalSpend) * 1000) / 10 : 0, evidenceRecordIds: item.evidenceRecordIds }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const merchantTotals = new Map<string, { amount: number; count: number; evidenceRecordIds: string[]; months: Set<string> }>();
  for (const tx of transactions.filter((item) => item.amount < 0)) {
    const current = merchantTotals.get(tx.merchant) ?? { amount: 0, count: 0, evidenceRecordIds: [], months: new Set<string>() };
    current.amount += Math.abs(tx.amount);
    current.count += 1;
    current.evidenceRecordIds.push(tx.id);
    current.months.add(monthKey(tx.date));
    merchantTotals.set(tx.merchant, current);
  }
  const topMerchant = [...merchantTotals.values()].sort((a, b) => b.amount - a.amount)[0];
  const subscriptions = [...merchantTotals.entries()]
    .filter(([name, item]) => item.months.size >= 2 || /netflix|spotify|subscription|prime|binge|stan|apple|google/i.test(name))
    .map(([merchantName, item]) => ({ merchant: merchantName, monthlyAmount: Math.round(item.amount / Math.max(item.months.size, 1)), occurrences: item.count, evidenceRecordIds: item.evidenceRecordIds }))
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
    .slice(0, 6);

  const last = months.at(-1);
  const previous = months.length >= 2 ? months[months.length - 2] : null;
  const spendingTrend = last && previous && previous.spending > 0 ? ((last.spending - previous.spending) / previous.spending) * 100 : 0;
  const emergencyFundMonths = averageMonthlySpending > 0 ? liquid.amount / averageMonthlySpending : 0;
  const largestIncomeMonth = Math.max(...months.map((month) => month.income), 0);
  const incomeConcentration = averageMonthlyIncome > 0 && largestIncomeMonth > 0 ? (largestIncomeMonth / Math.max(averageMonthlyIncome * Math.max(months.length, 1), 1)) * 100 : incomeRecords.length <= 1 && averageMonthlyIncome > 0 ? 100 : 0;
  const creditLimit = creditCards.reduce((sum, record) => sum + recordNumber(record, ["limit", "creditLimit"]), 0);
  const creditBalance = creditCards.reduce((sum, record) => sum + recordNumber(record, ["balance", "amount"]), 0);
  const mortgageBalance = mortgage.reduce((sum, record) => sum + recordNumber(record, ["balance", "amount", "principal"]), 0);
  const debtToIncome = totalIncomeAnnual > 0 ? (liabilities.amount / totalIncomeAnnual) * 100 : 0;
  const mortgageUtilisation = assets.amount > 0 ? (mortgageBalance / assets.amount) * 100 : 0;
  const creditCardUtilisation = creditLimit > 0 ? (creditBalance / creditLimit) * 100 : 0;
  const debtRatio = assets.amount > 0 ? (liabilities.amount / assets.amount) * 100 : 0;
  const superProportion = assets.amount > 0 ? (superTotal / assets.amount) * 100 : 0;
  const upcomingLargeObligations = [...expenseRecords, ...liabilityRecords]
    .map((record) => ({ label: record.label, amount: recordNumber(record, ["nextPaymentAmount", "monthlyPayment", "monthlyAmount", "minimumPayment"]), evidenceRecordIds: [record.id] }))
    .filter((item) => item.amount >= Math.max(1000, averageMonthlySpending * 0.2))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  let score = 64;
  if (records.length === 0) score = 0;
  if (savingsRate >= 20) score += 12;
  if (savingsRate < 10 && averageMonthlyIncome > 0) score -= 12;
  if (monthlySurplus < 0) score -= 18;
  if (emergencyFundMonths >= 3) score += 10;
  if (emergencyFundMonths > 0 && emergencyFundMonths < 2) score -= 10;
  if (debtToIncome > 400) score -= 8;
  if (creditCardUtilisation > 50) score -= 8;
  if (months.length >= 2) score += 4;
  const healthScore = Math.max(0, Math.min(100, Math.round(score)));
  const healthRating: HealthRating = records.length === 0 ? "Insufficient Data" : healthScore >= 82 ? "Strong" : healthScore >= 62 ? "Stable" : "Needs Attention";
  const actions: FinancialHealthAction[] = [];

  if (!records.length) {
    addAction(actions, {
      id: "complete-financial-vault",
      priority: "High",
      category: "Data quality",
      title: "Complete your Financial Vault",
      reason: "No confirmed records are available for deterministic health calculations.",
      recommendedAction: "Import transactions or add income, account and debt records manually.",
      expectedImpact: "Unlocks cash-flow, debt, safety and wealth health checks.",
      evidenceRecordIds: [],
      reviewRequired: false,
    });
  }
  if (monthlySurplus < 0) {
    addAction(actions, {
      id: "reduce-monthly-deficit",
      priority: "Critical",
      category: "Cash flow",
      title: "Reduce the monthly cash-flow deficit",
      reason: `Average spending exceeds income by ${money(Math.abs(monthlySurplus))} per month.`,
      recommendedAction: "Review the largest spending categories and pause non-essential commitments.",
      expectedImpact: `${money(Math.abs(monthlySurplus))}/month required to break even.`,
      evidenceRecordIds: transactionEvidence,
      reviewRequired: false,
    });
  }
  if (averageMonthlyIncome > 0 && savingsRate < 15) {
    addAction(actions, {
      id: "improve-savings-rate",
      priority: savingsRate < 0 ? "High" : "Medium",
      category: "Cash flow",
      title: "Improve your savings rate",
      reason: `Current savings rate is ${pct(savingsRate)}, below the 15% planning threshold.`,
      recommendedAction: "Set a target surplus and redirect it to savings, offset or debt reduction.",
      expectedImpact: `${money(Math.max(0, averageMonthlyIncome * 0.15 - monthlySurplus))}/month improvement to reach 15%.`,
      evidenceRecordIds: transactionEvidence,
      reviewRequired: false,
    });
  }
  if (emergencyFundMonths > 0 && emergencyFundMonths < 3) {
    addAction(actions, {
      id: "build-emergency-fund",
      priority: emergencyFundMonths < 1 ? "High" : "Medium",
      category: "Safety",
      title: "Build a larger emergency fund",
      reason: `Liquid funds cover approximately ${Math.round(emergencyFundMonths * 10) / 10} months of spending.`,
      recommendedAction: "Build toward at least three months of expenses in liquid accounts.",
      expectedImpact: `${money(Math.max(0, averageMonthlySpending * 3 - liquid.amount))} additional liquid buffer target.`,
      evidenceRecordIds: [...liquid.ids, ...transactionEvidence],
      reviewRequired: false,
    });
  }
  if (subscriptions.length > 0) {
    const totalSubscription = subscriptions.reduce((sum, item) => sum + item.monthlyAmount, 0);
    addAction(actions, {
      id: "review-subscriptions",
      priority: totalSubscription > 250 ? "Medium" : "Low",
      category: "Spending",
      title: "Review recurring subscriptions",
      reason: `${subscriptions.length} recurring merchant pattern${subscriptions.length === 1 ? "" : "s"} detected, totalling about ${money(totalSubscription)}/month.`,
      recommendedAction: "Cancel unused recurring services or move active services to cheaper plans.",
      expectedImpact: `${money(totalSubscription * 0.2)}/month indicative reduction if 20% is removed.`,
      evidenceRecordIds: subscriptions.flatMap((item) => item.evidenceRecordIds),
      reviewRequired: false,
    });
  }
  if (largestCategories[0] && largestCategories[0].share >= 35) {
    addAction(actions, {
      id: "reduce-category-concentration",
      priority: "Medium",
      category: "Spending",
      title: `Review ${largestCategories[0].category.toLowerCase()} spending`,
      reason: `${largestCategories[0].category} represents ${largestCategories[0].share}% of confirmed spending.`,
      recommendedAction: "Inspect the largest transactions and decide whether this category should be capped.",
      expectedImpact: `${money(largestCategories[0].amount * 0.1)} potential one-period reduction at a 10% cut.`,
      evidenceRecordIds: largestCategories[0].evidenceRecordIds,
      reviewRequired: false,
    });
  }
  if (estimatedMonthlyInterest > 0) {
    addAction(actions, {
      id: "review-interest-burden",
      priority: estimatedMonthlyInterest > 500 ? "High" : "Medium",
      category: "Debt",
      title: "Review interest burden",
      reason: `Estimated interest burden is ${money(estimatedMonthlyInterest)}/month from confirmed debt balances and rates.`,
      recommendedAction: "Prioritise high-interest debts and compare refinance or repayment options where appropriate.",
      expectedImpact: "Lower interest cost and improved monthly surplus if a cheaper structure is available.",
      evidenceRecordIds: liabilityRecords.map((record) => record.id),
      reviewRequired: true,
    });
  }
  if (debtToIncome > 350) {
    addAction(actions, {
      id: "reduce-debt-to-income",
      priority: "High",
      category: "Debt",
      title: "Reduce debt-to-income risk",
      reason: `Debt-to-income ratio is approximately ${pct(debtToIncome)}.`,
      recommendedAction: "Avoid new debt and review repayment or refinance options before making large commitments.",
      expectedImpact: "Improves serviceability resilience and borrowing confidence.",
      evidenceRecordIds: [...liabilityRecords.map((record) => record.id), ...incomeRecords.map((record) => record.id), ...transactionEvidence],
      reviewRequired: true,
    });
  }
  if (records.length > 0 && (averageMonthlyIncome === 0 || averageMonthlySpending === 0)) {
    addAction(actions, {
      id: "refresh-missing-health-inputs",
      priority: "Medium",
      category: "Data quality",
      title: "Refresh missing financial information",
      reason: "Income or spending data is missing, so some health checks are lower confidence.",
      recommendedAction: "Import a recent transaction period and confirm income, account, liability and expense records.",
      expectedImpact: "Improves cash-flow, safety and debt calculations.",
      evidenceRecordIds: records.map((record) => record.id),
      reviewRequired: false,
    });
  }

  const missingData = [
    averageMonthlyIncome > 0 ? "" : "Confirmed income or income transactions",
    averageMonthlySpending > 0 ? "" : "Confirmed spending transactions or expense records",
    liquid.ids.length > 0 ? "" : "Confirmed liquid account balances",
    liabilityRecords.length > 0 ? "" : "Confirmed debt balances and interest rates",
    assets.ids.length > 0 ? "" : "Confirmed assets for net worth and allocation",
  ].filter(Boolean);

  const aiCfoBriefingFacts = [
    `Financial health rating is ${healthRating} with score ${healthScore}/100.`,
    averageMonthlyIncome > 0 ? `Average monthly income is ${money(averageMonthlyIncome)}.` : "Average monthly income is not confirmed.",
    averageMonthlySpending > 0 ? `Average monthly spending is ${money(averageMonthlySpending)}.` : "Average monthly spending is not confirmed.",
    averageMonthlyIncome > 0 ? `Savings rate is ${pct(savingsRate)} and monthly surplus is ${money(monthlySurplus)}.` : "Savings rate is unavailable until income is confirmed.",
    emergencyFundMonths > 0 ? `Emergency fund covers approximately ${Math.round(emergencyFundMonths * 10) / 10} months of spending.` : "Emergency fund coverage is unavailable until liquid balances are confirmed.",
    largestCategories[0] ? `Largest spending category is ${largestCategories[0].category} at ${largestCategories[0].share}% of spending.` : "Largest spending category is unavailable until transactions are confirmed.",
  ];

  return {
    engineVersion: FINANCIAL_HEALTH_ENGINE_VERSION,
    generatedAt,
    userId: input.userId,
    recordCount: records.length,
    transactionCount: transactions.length,
    periodStart: transactions[0]?.date ?? null,
    periodEnd: transactions.at(-1)?.date ?? null,
    healthScore,
    healthRating,
    cashFlow: {
      averageMonthlyIncome: metric(averageMonthlyIncome, money(averageMonthlyIncome), confidenceFromCount(months.length || incomeRecords.length), transactionEvidence.length ? transactionEvidence : incomeRecords.map((record) => record.id)),
      averageMonthlySpending: metric(averageMonthlySpending, money(averageMonthlySpending), confidenceFromCount(months.length || expenseRecords.length), transactionEvidence.length ? transactionEvidence : expenseRecords.map((record) => record.id)),
      monthlySurplus: metric(monthlySurplus, money(monthlySurplus), confidenceFromCount(months.length || records.length), transactionEvidence),
      savingsRate: metric(savingsRate, pct(savingsRate), confidenceFromCount(months.length || records.length), transactionEvidence),
      incomeStability: metric(incomeStabilityScore, `${Math.round(incomeStabilityScore)}/100`, confidenceFromCount(months.length), transactionEvidence),
      burnRate: metric(averageMonthlySpending, `${money(averageMonthlySpending)}/mo`, confidenceFromCount(months.length || expenseRecords.length), transactionEvidence.length ? transactionEvidence : expenseRecords.map((record) => record.id)),
    },
    spending: {
      largestCategories,
      subscriptions,
      spendingTrend: metric(spendingTrend, previous ? `${spendingTrend >= 0 ? "+" : ""}${pct(spendingTrend)} vs previous month` : "Needs two periods", confidenceFromCount(months.length), transactionEvidence),
      merchantConcentration: metric(topMerchant && totalSpend > 0 ? (topMerchant.amount / totalSpend) * 100 : 0, topMerchant && totalSpend > 0 ? `${Math.round((topMerchant.amount / totalSpend) * 1000) / 10}% at top merchant` : "Unavailable", confidenceFromCount(transactions.length), topMerchant?.evidenceRecordIds ?? []),
    },
    debt: {
      totalDebt: metric(liabilities.amount, money(liabilities.amount), confidenceFromCount(liabilityRecords.length), liabilities.ids),
      debtToIncomeRatio: metric(debtToIncome, pct(debtToIncome), confidenceFromCount(liabilityRecords.length + (averageMonthlyIncome > 0 ? 1 : 0)), [...liabilities.ids, ...transactionEvidence, ...incomeRecords.map((record) => record.id)]),
      mortgageUtilisation: metric(mortgageUtilisation, pct(mortgageUtilisation), confidenceFromCount(mortgage.length + assetRecords.length), [...mortgage.map((record) => record.id), ...assets.ids]),
      creditCardUtilisation: metric(creditCardUtilisation, creditLimit > 0 ? pct(creditCardUtilisation) : "No confirmed credit limit", confidenceFromCount(creditCards.length), creditCards.map((record) => record.id)),
      estimatedMonthlyInterest: metric(estimatedMonthlyInterest, `${money(estimatedMonthlyInterest)}/mo`, confidenceFromCount(liabilityRecords.filter((record) => recordNumber(record, ["interestRate", "rate"]) > 0).length), liabilityRecords.map((record) => record.id)),
    },
    safety: {
      emergencyFundMonths: metric(emergencyFundMonths, emergencyFundMonths > 0 ? `${Math.round(emergencyFundMonths * 10) / 10} months` : "Unavailable", confidenceFromCount(liquid.ids.length + (averageMonthlySpending > 0 ? 1 : 0)), [...liquid.ids, ...transactionEvidence]),
      liquidity: metric(liquid.amount, money(liquid.amount), confidenceFromCount(liquid.ids.length), liquid.ids),
      incomeConcentration: metric(incomeConcentration, incomeConcentration ? `${Math.round(incomeConcentration * 10) / 10}%` : "Unavailable", confidenceFromCount(months.length || incomeRecords.length), transactionEvidence.length ? transactionEvidence : incomeRecords.map((record) => record.id)),
      upcomingLargeObligations,
    },
    wealth: {
      netWorth: metric(netWorth, money(netWorth), confidenceFromCount(assets.ids.length + liabilities.ids.length), [...assets.ids, ...liabilities.ids]),
      assetAllocation: [...accountRecords, ...assetRecords]
        .map((record) => {
          const amount = recordNumber(record, ["balance", "marketValue", "amount", "value"]);
          return { category: record.subtype || record.kind, amount, share: assets.amount > 0 ? Math.round((amount / assets.amount) * 1000) / 10 : 0, evidenceRecordIds: [record.id] };
        })
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount),
      superProportion: metric(superProportion, pct(superProportion), confidenceFromCount(superRecords.length + assetRecords.length), [...superRecords.map((record) => record.id), ...assets.ids]),
      debtRatio: metric(debtRatio, pct(debtRatio), confidenceFromCount(assets.ids.length + liabilities.ids.length), [...assets.ids, ...liabilities.ids]),
    },
    actions: actions.sort((a, b) => actionPriorityRank[b.priority] - actionPriorityRank[a.priority] || a.title.localeCompare(b.title)),
    aiCfoBriefingFacts,
    missingData,
  };
}
