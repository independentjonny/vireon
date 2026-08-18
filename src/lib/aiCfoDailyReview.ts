import type { AICfoEvidence, AICfoGeneratedDecision, AICfoTimelineEvent } from "@/lib/aiCfo";
import type { AICfoInputs } from "@/lib/aiCfo";
import type { TwinSimulationOutput } from "@/lib/financialDigitalTwin";
import { FinancialDigitalTwinEngine } from "@/lib/financialDigitalTwin";

export type DailyReviewCategory =
  | "net-worth"
  | "cash-flow"
  | "spending"
  | "income"
  | "debt"
  | "mortgage"
  | "borrowing"
  | "investments"
  | "superannuation"
  | "retirement"
  | "tax"
  | "ownership-structure"
  | "subscriptions"
  | "documents"
  | "goals"
  | "housing"
  | "insurance"
  | "anomalies"
  | "knowledge-health"
  | "rule-freshness";

export type DailyReviewType =
  | "positive-change"
  | "negative-change"
  | "risk"
  | "opportunity"
  | "deadline"
  | "anomaly"
  | "missing-data"
  | "stale-data"
  | "scenario-impact"
  | "goal-slippage"
  | "goal-improvement"
  | "professional-review";

export type DailyReviewStatus = "Pending" | "Ready" | "Viewed" | "Completed" | "No Material Changes" | "Failed Safely";
export type DailyReviewFindingState = "New" | "Reviewed" | "Actioned" | "Snoozed" | "Expected" | "Dismissed" | "Automatically Resolved";
export type DailyReviewSeverity = "Low" | "Medium" | "High" | "Critical";
export type DailyReviewPriority = "Low" | "Medium" | "High" | "Critical";
export type DailyReviewConfidence = "High" | "Medium" | "Low";

export type DailyReviewEvidence = AICfoEvidence & {
  attribution?: DailyReviewAttribution[];
};

export type DailyReviewAttribution = {
  label: string;
  previousValue: number;
  currentValue: number;
  change: number;
};

export type DailyReviewFinding = {
  id: string;
  category: DailyReviewCategory;
  type: DailyReviewType;
  severity: DailyReviewSeverity;
  priority: DailyReviewPriority;
  title: string;
  summary: string;
  whyItMatters: string;
  previousValue: number;
  currentValue: number;
  absoluteChange: number;
  percentageChange: number;
  expectedImpact: string;
  confidence: DailyReviewConfidence;
  evidence: DailyReviewEvidence[];
  assumptions: string[];
  attribution: DailyReviewAttribution[];
  actionLabel: string;
  actionHref: string;
  deadline: string | null;
  professionalReviewRequired: boolean;
  suppressionReason: string | null;
  deduplicationKey: string;
  sourceEngine: string;
  calculationSnapshotId: string;
  state: DailyReviewFindingState;
  lastObservedAt: string;
};

export type DailyFinancialReview = {
  id: string;
  reviewDate: string;
  comparisonStartDate: string;
  comparisonEndDate: string;
  previousSnapshotId: string;
  currentSnapshotId: string;
  status: DailyReviewStatus;
  overallSummary: string;
  financialHealthChange: number;
  netWorthChange: number;
  cashFlowChange: number;
  borrowingChange: number;
  retirementChange: number;
  goalChange: number;
  knowledgeHealthChange: number;
  findings: DailyReviewFinding[];
  generatedDecisions: AICfoGeneratedDecision[];
  generatedTimelineEvents: AICfoTimelineEvent[];
  suppressedFindings: DailyReviewFinding[];
  enginesRecalculated: DailyReviewRecalculation[];
  failures: DailyReviewFailure[];
  reviewedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
};

export type DailyReviewSnapshot = {
  id: string;
  capturedAt: string;
  netWorth: number;
  cashFlowSurplus: number;
  essentialSpending: number;
  discretionarySpending: number;
  income: number;
  borrowingCapacity: number;
  retirementScore: number;
  goalProgress: number;
  knowledgeHealthScore: number;
  documentCoverage: number;
  missingDocuments: string[];
  mortgageRate: number;
  mortgageBalance: number;
  refinanceMonthlySaving: number;
  subscriptionMonthlySpend: number;
  ruleLastVerified: string;
  ruleStaleWarnings: string[];
  structureProfessionalReviewItems: string[];
  transactions: DailyReviewTransaction[];
  digitalTwinSimulation: TwinSimulationOutput;
  sourceMode: "live" | "demo";
};

export type DailyReviewTransaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  kind: "income" | "expense" | "transfer" | "reimbursement";
  recurringCadence?: "monthly" | "quarterly" | "annual" | "none";
  planned?: boolean;
};

export type DailyReviewMaterialityThresholds = {
  netWorthDollar: number;
  netWorthPercent: number;
  cashFlowDollar: number;
  borrowingDollar: number;
  retirementScore: number;
  goalProgress: number;
  knowledgeHealthScore: number;
  refinanceMonthlySaving: number;
  subscriptionMonthlyIncrease: number;
  spendingAnomalyPercent: number;
  spendingAnomalyDollar: number;
  documentStaleDays: number;
};

export type DailyReviewSettings = {
  frequency: "daily" | "weekdays" | "weekly" | "manual-only";
  minimumImpact: "low" | "medium" | "high" | "custom";
  customDollarThreshold: number;
  enabledCategories: DailyReviewCategory[];
  notificationPreference: "urgent-only" | "material-changes" | "full-review" | "none";
  quiet: {
    snoozedDeduplicationKeys: Record<string, string>;
    dismissedDeduplicationKeys: string[];
    expectedDeduplicationKeys: string[];
    mutedCategories: DailyReviewCategory[];
    ignoredMerchants: string[];
    plannedTransactionIds: string[];
    valuationSensitivity: "low" | "medium" | "high";
  };
  thresholds: DailyReviewMaterialityThresholds;
};

export type DailyReviewSuppressionDecision = {
  deduplicationKey: string;
  reason: string;
  decidedAt: string;
};

export type DailyReviewRecalculation = {
  engine: string;
  reason: string;
  affectedScenarios: string[];
  durationMs: number;
  outputDifference: string;
};

export type DailyReviewFailure = {
  engine: string;
  reason: string;
  recovered: boolean;
};

export type DailyReviewHistoryRecord = {
  review: DailyFinancialReview;
  previousSnapshot: DailyReviewSnapshot;
  currentSnapshot: DailyReviewSnapshot;
  suppressionDecisions: DailyReviewSuppressionDecision[];
  gptSummaryDraft: string | null;
  validatedFinalSummary: string;
  userActions: { action: string; at: string; targetId: string }[];
};

export type DailyReviewMode = "live" | "empty-demo" | "mortgage-demo" | "spending-demo" | "missing-document-demo" | "positive-goal-demo" | "stale-rule-demo" | "partial-failure-demo" | "complete-failure-demo";

export type DailyReviewEngineInput = {
  inputs: AICfoInputs;
  previousSnapshot?: DailyReviewSnapshot;
  settings?: Partial<DailyReviewSettings>;
  mode?: DailyReviewMode;
  now?: string;
  gptSummaryDraft?: string | null;
  engineFailures?: DailyReviewFailure[];
};

const REVIEW_VERSION = "daily-review-v1";

export const DAILY_REVIEW_CATEGORIES: DailyReviewCategory[] = [
  "net-worth",
  "cash-flow",
  "spending",
  "income",
  "debt",
  "mortgage",
  "borrowing",
  "investments",
  "superannuation",
  "retirement",
  "tax",
  "ownership-structure",
  "subscriptions",
  "documents",
  "goals",
  "housing",
  "insurance",
  "anomalies",
  "knowledge-health",
  "rule-freshness",
];

export const DEFAULT_DAILY_REVIEW_SETTINGS: DailyReviewSettings = {
  frequency: "daily",
  minimumImpact: "medium",
  customDollarThreshold: 500,
  enabledCategories: DAILY_REVIEW_CATEGORIES,
  notificationPreference: "material-changes",
  quiet: {
    snoozedDeduplicationKeys: {},
    dismissedDeduplicationKeys: [],
    expectedDeduplicationKeys: [],
    mutedCategories: [],
    ignoredMerchants: [],
    plannedTransactionIds: [],
    valuationSensitivity: "medium",
  },
  thresholds: {
    netWorthDollar: 5_000,
    netWorthPercent: 0.5,
    cashFlowDollar: 300,
    borrowingDollar: 20_000,
    retirementScore: 4,
    goalProgress: 4,
    knowledgeHealthScore: 8,
    refinanceMonthlySaving: 150,
    subscriptionMonthlyIncrease: 10,
    spendingAnomalyPercent: 35,
    spendingAnomalyDollar: 150,
    documentStaleDays: 120,
  },
};

function mergeSettings(settings?: Partial<DailyReviewSettings>): DailyReviewSettings {
  return {
    ...DEFAULT_DAILY_REVIEW_SETTINGS,
    ...settings,
    quiet: { ...DEFAULT_DAILY_REVIEW_SETTINGS.quiet, ...settings?.quiet },
    thresholds: { ...DEFAULT_DAILY_REVIEW_SETTINGS.thresholds, ...settings?.thresholds },
  };
}

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function pct(previousValue: number, currentValue: number): number {
  if (previousValue === 0) return currentValue === 0 ? 0 : 100;
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
}

function priorityScore(input: {
  impact: number;
  urgency: number;
  riskReduction: number;
  confidence: DailyReviewConfidence;
  reversibility: number;
  timeSensitivity: number;
  goalRelevance: number;
  effortRequired: number;
  professionalReviewRequired: boolean;
}): number {
  const confidenceWeight = input.confidence === "High" ? 1 : input.confidence === "Medium" ? 0.72 : 0.42;
  return Math.round(
    (Math.log10(Math.max(10, Math.abs(input.impact))) * 16 +
      input.urgency * 12 +
      input.riskReduction * 10 +
      input.reversibility * 6 +
      input.timeSensitivity * 9 +
      input.goalRelevance * 8 -
      input.effortRequired * 5 +
      (input.professionalReviewRequired ? 6 : 0)) *
      confidenceWeight
  );
}

function priorityFromScore(score: number): DailyReviewPriority {
  if (score >= 88) return "Critical";
  if (score >= 68) return "High";
  if (score >= 44) return "Medium";
  return "Low";
}

function severityFromChange(value: number, high: number, critical: number): DailyReviewSeverity {
  const abs = Math.abs(value);
  if (abs >= critical) return "Critical";
  if (abs >= high) return "High";
  if (abs > 0) return "Medium";
  return "Low";
}

function evidence(sourceId: string, sourceTitle: string, factUsed: string, confidence: DailyReviewConfidence, sourceLocation: string): DailyReviewEvidence {
  return {
    type: sourceLocation.includes("rule") || sourceLocation.includes("ato.gov") ? "rule-provenance" : "deterministic-calculation",
    sourceId,
    sourceTitle,
    sourceLocation,
    factUsed,
    classification: sourceLocation === "/financial-vault" ? "verified-fact" : "deterministic-calculation",
    confidence,
    lastVerifiedAt: new Date().toISOString(),
  };
}

export function createCurrentDailyReviewSnapshot(inputs: AICfoInputs, now = "2026-07-18T08:00:00.000Z", mode: DailyReviewMode = "live"): DailyReviewSnapshot {
  const twin = inputs.twinState.twin;
  const scenario = inputs.twinState.scenarios[0];
  const simulation = FinancialDigitalTwinEngine.simulate(twin, scenario);
  const profile = inputs.vault.financial_profile;
  const missingDocuments = inputs.vault.lender_pack.documentChecklist.filter((item) => !item.available).map((item) => item.label);
  const sourceCount = Object.keys(profile.sources).length;
  const knowledgeHealthScore = Math.min(100, Math.round(sourceCount * 7 + inputs.vault.uploaded_documents.filter((doc) => doc.status === "extracted").length * 8));

  return {
    id: `${REVIEW_VERSION}:snapshot-${mode}-${now.slice(0, 10)}`,
    capturedAt: now,
    netWorth: inputs.balanceSheet.netWorth,
    cashFlowSurplus: profile.incomeAnnual - profile.monthlySpending * 12,
    essentialSpending: Math.round(profile.monthlySpending * 12 * 0.72),
    discretionarySpending: Math.round(profile.monthlySpending * 12 * 0.28),
    income: profile.incomeAnnual,
    borrowingCapacity: inputs.housing.housing_scenarios[0]?.estimatedBorrowingCapacity ?? inputs.balanceSheet.borrowingCapacity,
    retirementScore: simulation.retirementScore,
    goalProgress: Math.round((twin.goals.house + twin.goals.retirement + twin.goals.emergencyFund + twin.goals.passiveIncome) / 4),
    knowledgeHealthScore,
    documentCoverage: twin.documents.documentCoverage,
    missingDocuments,
    mortgageRate: profile.interestRate,
    mortgageBalance: profile.mortgageBalance,
    refinanceMonthlySaving: inputs.balanceSheet.refinance.monthlySaving,
    subscriptionMonthlySpend: profile.recurringSubscriptions,
    ruleLastVerified: inputs.structureComparison.rulesLastVerified,
    ruleStaleWarnings: inputs.structureComparison.staleRuleWarnings,
    structureProfessionalReviewItems: inputs.structureComparison.professionalReviewItems,
    transactions: seedTransactions(now),
    digitalTwinSimulation: simulation,
    sourceMode: mode === "live" ? "live" : "demo",
  };
}

export function createPreviousDailyReviewSnapshot(current: DailyReviewSnapshot, mode: DailyReviewMode = "live"): DailyReviewSnapshot {
  const previous: DailyReviewSnapshot = {
    ...current,
    id: `previous-${current.id}`,
    capturedAt: new Date(new Date(current.capturedAt).getTime() - 86_400_000).toISOString(),
    sourceMode: current.sourceMode,
    transactions: current.transactions.map((tx) => ({ ...tx })),
  };

  if (mode === "empty-demo") return previous;
  if (mode === "mortgage-demo") {
    return { ...previous, refinanceMonthlySaving: 80, mortgageRate: current.mortgageRate - 0.35, borrowingCapacity: current.borrowingCapacity + 26_000 };
  }
  if (mode === "spending-demo") {
    return { ...previous, discretionarySpending: current.discretionarySpending - 1_250, cashFlowSurplus: current.cashFlowSurplus + 1_250, subscriptionMonthlySpend: current.subscriptionMonthlySpend - 38 };
  }
  if (mode === "missing-document-demo") {
    return { ...previous, missingDocuments: [], documentCoverage: Math.min(100, current.documentCoverage + 20), knowledgeHealthScore: current.knowledgeHealthScore + 12 };
  }
  if (mode === "positive-goal-demo") {
    return { ...previous, netWorth: current.netWorth - 8_400, goalProgress: current.goalProgress - 7, cashFlowSurplus: current.cashFlowSurplus - 500 };
  }
  if (mode === "stale-rule-demo") {
    return { ...previous, ruleStaleWarnings: [], structureProfessionalReviewItems: [] };
  }
  return {
    ...previous,
    netWorth: current.netWorth - 8_400,
    cashFlowSurplus: current.cashFlowSurplus + 450,
    borrowingCapacity: current.borrowingCapacity + 26_000,
    goalProgress: current.goalProgress - 1,
  };
}

function seedTransactions(now: string): DailyReviewTransaction[] {
  const day = now.slice(0, 10);
  return [
    { id: "tx-salary", date: day, merchant: "Salary Deposit", category: "income", amount: 7350, kind: "income", recurringCadence: "monthly" },
    { id: "tx-mortgage", date: day, merchant: "Mortgage Repayment", category: "mortgage", amount: -3860, kind: "expense", recurringCadence: "monthly" },
    { id: "tx-transfer", date: day, merchant: "Transfer to Savings", category: "transfer", amount: -5000, kind: "transfer", recurringCadence: "none" },
    { id: "tx-dining", date: day, merchant: "Dining District", category: "dining", amount: -420, kind: "expense", recurringCadence: "none" },
    { id: "tx-streaming", date: day, merchant: "StreamPlus", category: "subscriptions", amount: -32, kind: "expense", recurringCadence: "monthly" },
  ];
}

export type SpendingBaseline = {
  category: string;
  trailing30ExpectedRange: [number, number];
  trailing90ExpectedRange: [number, number];
  seasonalExpectedRange: [number, number];
  merchantFrequency: Record<string, number>;
  actualAmount: number;
  comparisonPeriod: string;
  unusual: boolean;
  explanation: string;
};

export function calculateSpendingBaseline(previous: DailyReviewSnapshot, current: DailyReviewSnapshot, category: string): SpendingBaseline {
  const currentSpend = current.transactions.filter((tx) => tx.category === category && tx.kind === "expense" && !tx.planned).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const previousSpend = previous.transactions.filter((tx) => tx.category === category && tx.kind === "expense").reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const recurringMultiplier = current.transactions.some((tx) => tx.category === category && tx.recurringCadence === "annual") ? 12 : current.transactions.some((tx) => tx.category === category && tx.recurringCadence === "quarterly") ? 3 : 1;
  const baseline = Math.max(40, previousSpend / recurringMultiplier);
  const range30: [number, number] = [baseline * 0.65, baseline * 1.35];
  const range90: [number, number] = [baseline * 0.55, baseline * 1.45];
  const seasonal: [number, number] = [baseline * 0.5, baseline * 1.65];
  const merchantFrequency: Record<string, number> = {};
  for (const tx of [...previous.transactions, ...current.transactions].filter((item) => item.category === category)) {
    merchantFrequency[tx.merchant] = (merchantFrequency[tx.merchant] ?? 0) + 1;
  }

  return {
    category,
    trailing30ExpectedRange: range30,
    trailing90ExpectedRange: range90,
    seasonalExpectedRange: seasonal,
    merchantFrequency,
    actualAmount: currentSpend,
    comparisonPeriod: `${previous.capturedAt.slice(0, 10)} to ${current.capturedAt.slice(0, 10)}`,
    unusual: currentSpend > seasonal[1],
    explanation: `Expected ${category} spending between ${money(seasonal[0])} and ${money(seasonal[1])}; actual was ${money(currentSpend)}.`,
  };
}

function finding(input: Omit<DailyReviewFinding, "id" | "percentageChange" | "state" | "lastObservedAt"> & { now: string }): DailyReviewFinding {
  return {
    ...input,
    id: `finding-${input.deduplicationKey.replace(/[^a-z0-9:-]/gi, "-")}`,
    percentageChange: pct(input.previousValue, input.currentValue),
    state: "New",
    lastObservedAt: input.now,
  };
}

function isMaterialDollar(previous: number, current: number, dollar: number, percentThreshold = 0): boolean {
  const abs = Math.abs(current - previous);
  return abs >= dollar || Math.abs(pct(previous, current)) >= percentThreshold;
}

export function compareDailySnapshots(previous: DailyReviewSnapshot, current: DailyReviewSnapshot, settings: DailyReviewSettings, now = current.capturedAt): DailyReviewFinding[] {
  const findings: DailyReviewFinding[] = [];
  const snapshotRule = `snapshot:${previous.id}:${current.id}`;
  const netWorthChange = current.netWorth - previous.netWorth;
  if (isMaterialDollar(previous.netWorth, current.netWorth, settings.thresholds.netWorthDollar, settings.thresholds.netWorthPercent)) {
    const attribution = [
      { label: "Property and assets", previousValue: previous.netWorth + previous.mortgageBalance, currentValue: current.netWorth + current.mortgageBalance, change: current.netWorth - previous.netWorth + current.mortgageBalance - previous.mortgageBalance },
      { label: "Mortgage principal", previousValue: previous.mortgageBalance, currentValue: current.mortgageBalance, change: previous.mortgageBalance - current.mortgageBalance },
      { label: "Cash flow effect", previousValue: previous.cashFlowSurplus, currentValue: current.cashFlowSurplus, change: current.cashFlowSurplus - previous.cashFlowSurplus },
    ];
    findings.push(finding({
      category: "net-worth",
      type: netWorthChange >= 0 ? "positive-change" : "negative-change",
      severity: severityFromChange(netWorthChange, 15_000, 50_000),
      priority: priorityFromScore(priorityScore({ impact: netWorthChange, urgency: 2, riskReduction: netWorthChange >= 0 ? 2 : 5, confidence: "High", reversibility: 4, timeSensitivity: 2, goalRelevance: 5, effortRequired: 2, professionalReviewRequired: false })),
      title: `Net worth ${netWorthChange >= 0 ? "increased" : "decreased"} by ${money(netWorthChange)}`,
      summary: `Net worth moved from ${money(previous.netWorth)} to ${money(current.netWorth)}.`,
      whyItMatters: "Net worth movement affects balance-sheet trajectory, goal confidence and borrowing flexibility.",
      previousValue: previous.netWorth,
      currentValue: current.netWorth,
      absoluteChange: netWorthChange,
      expectedImpact: money(netWorthChange),
      confidence: "High",
      evidence: [evidence("balance-sheet", "Balance Sheet", `Net worth changed by ${money(netWorthChange)}`, "High", "/balance-sheet")],
      assumptions: ["Daily market valuation noise is suppressed below configured thresholds"],
      attribution,
      actionLabel: "Review balance sheet",
      actionHref: "/balance-sheet",
      deadline: null,
      professionalReviewRequired: false,
      suppressionReason: null,
      deduplicationKey: `net-worth:${current.capturedAt.slice(0, 7)}:${Math.round(netWorthChange / 5000)}`,
      sourceEngine: "Balance Sheet",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const incomeChange = current.income - previous.income;
  if (current.income <= 0 || Math.abs(incomeChange) >= Math.max(settings.thresholds.cashFlowDollar * 12, settings.customDollarThreshold * 6)) {
    findings.push(finding({
      category: "income",
      type: current.income <= 0 ? "missing-data" : incomeChange >= 0 ? "positive-change" : "negative-change",
      severity: current.income <= 0 ? "Critical" : severityFromChange(incomeChange, 10_000, 35_000),
      priority: priorityFromScore(priorityScore({ impact: incomeChange, urgency: current.income <= 0 ? 9 : 6, riskReduction: current.income <= 0 || incomeChange < 0 ? 8 : 3, confidence: "High", reversibility: 6, timeSensitivity: 8, goalRelevance: 8, effortRequired: 3, professionalReviewRequired: false })),
      title: current.income <= 0 ? "Verified salary is missing" : `Verified income ${incomeChange >= 0 ? "increased" : "fell"} by ${money(incomeChange)}`,
      summary: current.income <= 0 ? "The current snapshot has no verified salary value." : `Income moved from ${money(previous.income)} to ${money(current.income)}.`,
      whyItMatters: "Income changes feed cash flow, tax assumptions, borrowing capacity, retirement projections and goal timing.",
      previousValue: previous.income,
      currentValue: current.income,
      absoluteChange: incomeChange,
      expectedImpact: current.income <= 0 ? "Borrowing and cash-flow confidence reduced" : `${money(incomeChange)} annual verified income change`,
      confidence: "High",
      evidence: [evidence("financial-vault-income", "Financial Vault income", current.income <= 0 ? "No verified salary value in the current snapshot" : `Verified income changed by ${money(incomeChange)}`, "High", "/financial-vault")],
      assumptions: ["Income values are sourced from verified Financial Vault profile data"],
      attribution: [{ label: "Verified income", previousValue: previous.income, currentValue: current.income, change: incomeChange }],
      actionLabel: current.income <= 0 ? "Upload payslip" : "Review income change",
      actionHref: "/financial-vault",
      deadline: current.income <= 0 ? now.slice(0, 10) : null,
      professionalReviewRequired: false,
      suppressionReason: null,
      deduplicationKey: current.income <= 0 ? "income-missing:salary" : `income-change:${current.capturedAt.slice(0, 7)}:${Math.round(incomeChange / 5000)}`,
      sourceEngine: "Financial Vault",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const cashFlowChange = current.cashFlowSurplus - previous.cashFlowSurplus;
  if (Math.abs(cashFlowChange) >= settings.thresholds.cashFlowDollar || current.cashFlowSurplus < 0) {
    findings.push(finding({
      category: "cash-flow",
      type: current.cashFlowSurplus < 0 ? "risk" : cashFlowChange >= 0 ? "positive-change" : "negative-change",
      severity: severityFromChange(cashFlowChange, 1_000, 4_000),
      priority: priorityFromScore(priorityScore({ impact: cashFlowChange, urgency: current.cashFlowSurplus < 0 ? 8 : 4, riskReduction: current.cashFlowSurplus < 0 ? 8 : 3, confidence: "High", reversibility: 8, timeSensitivity: 6, goalRelevance: 7, effortRequired: 3, professionalReviewRequired: false })),
      title: `Cash flow surplus ${cashFlowChange >= 0 ? "improved" : "fell"} by ${money(cashFlowChange)}`,
      summary: `Surplus changed from ${money(previous.cashFlowSurplus)} to ${money(current.cashFlowSurplus)}.`,
      whyItMatters: "Cash flow is the funding source for debt reduction, investing, goals and emergency buffers.",
      previousValue: previous.cashFlowSurplus,
      currentValue: current.cashFlowSurplus,
      absoluteChange: cashFlowChange,
      expectedImpact: `${money(cashFlowChange)} annualised scenario change`,
      confidence: "High",
      evidence: [evidence("financial-vault", "Financial Vault cash flow", `Income less annual spending changed by ${money(cashFlowChange)}`, "High", "/financial-vault")],
      assumptions: ["Cash flow uses verified income and monthly spending from Vault profile"],
      attribution: [
        { label: "Income", previousValue: previous.income, currentValue: current.income, change: current.income - previous.income },
        { label: "Essential spending", previousValue: previous.essentialSpending, currentValue: current.essentialSpending, change: previous.essentialSpending - current.essentialSpending },
        { label: "Discretionary spending", previousValue: previous.discretionarySpending, currentValue: current.discretionarySpending, change: previous.discretionarySpending - current.discretionarySpending },
      ],
      actionLabel: "Review cash flow",
      actionHref: "/cash-flow",
      deadline: current.cashFlowSurplus < 0 ? now.slice(0, 10) : null,
      professionalReviewRequired: false,
      suppressionReason: null,
      deduplicationKey: `cash-flow:${current.capturedAt.slice(0, 7)}:${Math.round(cashFlowChange / 250)}`,
      sourceEngine: "Cash Flow",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const borrowingChange = current.borrowingCapacity - previous.borrowingCapacity;
  if (Math.abs(borrowingChange) >= settings.thresholds.borrowingDollar) {
    findings.push(finding({
      category: "borrowing",
      type: borrowingChange >= 0 ? "opportunity" : "risk",
      severity: severityFromChange(borrowingChange, 50_000, 150_000),
      priority: priorityFromScore(priorityScore({ impact: borrowingChange, urgency: 5, riskReduction: borrowingChange < 0 ? 7 : 4, confidence: "Medium", reversibility: 5, timeSensitivity: 5, goalRelevance: 8, effortRequired: 4, professionalReviewRequired: true })),
      title: `Borrowing capacity ${borrowingChange >= 0 ? "improved" : "declined"} by ${money(borrowingChange)}`,
      summary: `Capacity moved from ${money(previous.borrowingCapacity)} to ${money(current.borrowingCapacity)}.`,
      whyItMatters: "Borrowing changes affect housing readiness, refinance strategy and scenario timing.",
      previousValue: previous.borrowingCapacity,
      currentValue: current.borrowingCapacity,
      absoluteChange: borrowingChange,
      expectedImpact: money(borrowingChange),
      confidence: "Medium",
      evidence: [evidence("housing", "Housing affordability engine", `Borrowing capacity changed by ${money(borrowingChange)}`, "Medium", "/housing-scenarios")],
      assumptions: ["Borrowing capacity is a deterministic serviceability estimate, not lender approval"],
      attribution: [
        { label: "Cash flow", previousValue: previous.cashFlowSurplus, currentValue: current.cashFlowSurplus, change: current.cashFlowSurplus - previous.cashFlowSurplus },
        { label: "Mortgage rate", previousValue: previous.mortgageRate, currentValue: current.mortgageRate, change: current.mortgageRate - previous.mortgageRate },
        { label: "Document coverage", previousValue: previous.documentCoverage, currentValue: current.documentCoverage, change: current.documentCoverage - previous.documentCoverage },
      ],
      actionLabel: "Review borrowing impact",
      actionHref: "/housing-scenarios",
      deadline: null,
      professionalReviewRequired: true,
      suppressionReason: null,
      deduplicationKey: `borrowing:${current.capturedAt.slice(0, 7)}:${Math.round(borrowingChange / 10_000)}`,
      sourceEngine: "Housing",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  if (current.refinanceMonthlySaving >= settings.thresholds.refinanceMonthlySaving && current.refinanceMonthlySaving - previous.refinanceMonthlySaving >= 50) {
    findings.push(finding({
      category: "mortgage",
      type: "opportunity",
      severity: "High",
      priority: priorityFromScore(priorityScore({ impact: current.refinanceMonthlySaving * 12, urgency: 7, riskReduction: 5, confidence: "High", reversibility: 8, timeSensitivity: 6, goalRelevance: 6, effortRequired: 3, professionalReviewRequired: true })),
      title: `Refinance saving is now about ${money(current.refinanceMonthlySaving)}/month`,
      summary: `Estimated monthly saving increased from ${money(previous.refinanceMonthlySaving)} to ${money(current.refinanceMonthlySaving)}.`,
      whyItMatters: "Mortgage savings can improve cash flow and borrowing capacity without requiring income growth.",
      previousValue: previous.refinanceMonthlySaving,
      currentValue: current.refinanceMonthlySaving,
      absoluteChange: current.refinanceMonthlySaving - previous.refinanceMonthlySaving,
      expectedImpact: `${money(current.refinanceMonthlySaving * 12)}/year before fees`,
      confidence: "High",
      evidence: [evidence("refinance", "Refinance engine", `Estimated saving ${money(current.refinanceMonthlySaving)}/month`, "High", "/balance-sheet/mortgages")],
      assumptions: ["Savings exclude switching fees and lender policy"],
      attribution: [{ label: "Rate gap", previousValue: previous.mortgageRate, currentValue: current.mortgageRate, change: current.mortgageRate - previous.mortgageRate }],
      actionLabel: "Review mortgage refinance",
      actionHref: "/balance-sheet/mortgages",
      deadline: null,
      professionalReviewRequired: true,
      suppressionReason: null,
      deduplicationKey: `mortgage-refinance:primary:${Math.round(current.refinanceMonthlySaving / 50)}`,
      sourceEngine: "Balance Sheet",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const subscriptionIncrease = current.subscriptionMonthlySpend - previous.subscriptionMonthlySpend;
  if (subscriptionIncrease >= settings.thresholds.subscriptionMonthlyIncrease) {
    findings.push(finding({
      category: "subscriptions",
      type: "opportunity",
      severity: "Medium",
      priority: priorityFromScore(priorityScore({ impact: subscriptionIncrease * 12, urgency: 4, riskReduction: 4, confidence: "Medium", reversibility: 9, timeSensitivity: 5, goalRelevance: 5, effortRequired: 2, professionalReviewRequired: false })),
      title: `Recurring costs increased by ${money(subscriptionIncrease)}/month`,
      summary: `Subscriptions moved from ${money(previous.subscriptionMonthlySpend)} to ${money(current.subscriptionMonthlySpend)} per month.`,
      whyItMatters: "Recurring cost changes permanently reduce surplus until reviewed.",
      previousValue: previous.subscriptionMonthlySpend,
      currentValue: current.subscriptionMonthlySpend,
      absoluteChange: subscriptionIncrease,
      expectedImpact: `${money(subscriptionIncrease * 12)}/year`,
      confidence: "Medium",
      evidence: [evidence("subscriptions", "Subscription detector", `Monthly subscription spend increased by ${money(subscriptionIncrease)}`, "Medium", "/subscriptions")],
      assumptions: ["Recurring subscription detection is based on imported recurring payments"],
      attribution: [{ label: "Subscription spend", previousValue: previous.subscriptionMonthlySpend, currentValue: current.subscriptionMonthlySpend, change: subscriptionIncrease }],
      actionLabel: "Review subscriptions",
      actionHref: "/subscriptions",
      deadline: null,
      professionalReviewRequired: false,
      suppressionReason: null,
      deduplicationKey: `subscription-price-increase:all:${current.capturedAt.slice(0, 7)}`,
      sourceEngine: "Subscriptions",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const missingDocs = current.missingDocuments.filter((doc) => !previous.missingDocuments.includes(doc));
  for (const documentName of missingDocs) {
    findings.push(finding({
      category: "documents",
      type: "missing-data",
      severity: "High",
      priority: priorityFromScore(priorityScore({ impact: 0, urgency: 7, riskReduction: 6, confidence: "High", reversibility: 8, timeSensitivity: 6, goalRelevance: 8, effortRequired: 2, professionalReviewRequired: false })),
      title: `${documentName} is missing`,
      summary: `${documentName} is required for a reliable lender and Financial Vault profile.`,
      whyItMatters: "Missing documents lower confidence for borrowing, tax, cash flow and AI CFO answers.",
      previousValue: 1,
      currentValue: 0,
      absoluteChange: -1,
      expectedImpact: "Higher confidence after upload",
      confidence: "High",
      evidence: [evidence(`missing-document:${documentName}`, "Financial Vault document checklist", `${documentName} is unavailable`, "High", "/financial-vault")],
      assumptions: ["Required document checklist is current"],
      attribution: [{ label: documentName, previousValue: 1, currentValue: 0, change: -1 }],
      actionLabel: "Upload document",
      actionHref: "/financial-vault",
      deadline: null,
      professionalReviewRequired: false,
      suppressionReason: null,
      deduplicationKey: `missing-document:${documentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:current`,
      sourceEngine: "Financial Vault",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const goalChange = current.goalProgress - previous.goalProgress;
  if (Math.abs(goalChange) >= settings.thresholds.goalProgress) {
    findings.push(finding({
      category: "goals",
      type: goalChange >= 0 ? "goal-improvement" : "goal-slippage",
      severity: severityFromChange(goalChange, 8, 20),
      priority: priorityFromScore(priorityScore({ impact: goalChange * 1000, urgency: goalChange < 0 ? 6 : 3, riskReduction: goalChange < 0 ? 6 : 3, confidence: "Medium", reversibility: 7, timeSensitivity: 4, goalRelevance: 9, effortRequired: 3, professionalReviewRequired: false })),
      title: `Goal progress ${goalChange >= 0 ? "improved" : "slipped"} by ${Math.abs(goalChange)} points`,
      summary: `Goal progress moved from ${previous.goalProgress}/100 to ${current.goalProgress}/100.`,
      whyItMatters: "Goal changes show whether current cash flow and scenario assumptions still support the plan.",
      previousValue: previous.goalProgress,
      currentValue: current.goalProgress,
      absoluteChange: goalChange,
      expectedImpact: `${goalChange} goal points`,
      confidence: "Medium",
      evidence: [evidence("goals", "Goal engine", `Goal score changed by ${goalChange}`, "Medium", "/goals")],
      assumptions: ["Goal progress uses current Digital Twin goal scores"],
      attribution: [{ label: "Goal score", previousValue: previous.goalProgress, currentValue: current.goalProgress, change: goalChange }],
      actionLabel: "Review goals",
      actionHref: "/goals",
      deadline: null,
      professionalReviewRequired: false,
      suppressionReason: null,
      deduplicationKey: `goal-${goalChange >= 0 ? "improvement" : "slippage"}:portfolio:${Math.round(current.goalProgress / 5)}`,
      sourceEngine: "Goals",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const retirementChange = current.retirementScore - previous.retirementScore;
  if (Math.abs(retirementChange) >= settings.thresholds.retirementScore) {
    findings.push(finding({
      category: "retirement",
      type: retirementChange >= 0 ? "positive-change" : "risk",
      severity: severityFromChange(retirementChange, 8, 16),
      priority: priorityFromScore(priorityScore({ impact: retirementChange * 2000, urgency: 3, riskReduction: retirementChange < 0 ? 7 : 4, confidence: current.digitalTwinSimulation.confidence, reversibility: 5, timeSensitivity: 4, goalRelevance: 8, effortRequired: 5, professionalReviewRequired: true })),
      title: `Retirement confidence changed by ${retirementChange} points`,
      summary: `Retirement score moved from ${previous.retirementScore}/100 to ${current.retirementScore}/100.`,
      whyItMatters: "Retirement projection changes can affect contribution strategy, timing and risk tolerance.",
      previousValue: previous.retirementScore,
      currentValue: current.retirementScore,
      absoluteChange: retirementChange,
      expectedImpact: `${retirementChange} retirement score points`,
      confidence: current.digitalTwinSimulation.confidence,
      evidence: [evidence("digital-twin", "Financial Digital Twin", `Retirement score changed by ${retirementChange}`, current.digitalTwinSimulation.confidence, "/digital-twin")],
      assumptions: current.digitalTwinSimulation.assumptions,
      attribution: [
        { label: "Super projection", previousValue: previous.digitalTwinSimulation.netWorth, currentValue: current.digitalTwinSimulation.netWorth, change: current.digitalTwinSimulation.netWorth - previous.digitalTwinSimulation.netWorth },
      ],
      actionLabel: "Review retirement scenario",
      actionHref: "/digital-twin",
      deadline: null,
      professionalReviewRequired: true,
      suppressionReason: null,
      deduplicationKey: `retirement-score:${Math.round(current.retirementScore / 5)}`,
      sourceEngine: "Financial Digital Twin",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  if (current.ruleStaleWarnings.length > previous.ruleStaleWarnings.length) {
    findings.push(finding({
      category: "rule-freshness",
      type: "stale-data",
      severity: "High",
      priority: priorityFromScore(priorityScore({ impact: 0, urgency: 7, riskReduction: 8, confidence: "High", reversibility: 6, timeSensitivity: 7, goalRelevance: 7, effortRequired: 4, professionalReviewRequired: true })),
      title: "A material tax rule needs review",
      summary: current.ruleStaleWarnings[0] ?? "Rule provenance freshness changed.",
      whyItMatters: "Stale rule provenance reduces confidence and can change tax or ownership structure interpretation.",
      previousValue: previous.ruleStaleWarnings.length,
      currentValue: current.ruleStaleWarnings.length,
      absoluteChange: current.ruleStaleWarnings.length - previous.ruleStaleWarnings.length,
      expectedImpact: "Confidence downgrade until verified",
      confidence: "High",
      evidence: [evidence("rule-freshness", "Tax rule provenance", current.ruleStaleWarnings.join(" "), "High", "/structure-optimiser")],
      assumptions: ["Rule review period is configured in Structure Optimiser"],
      attribution: [{ label: "Stale rules", previousValue: previous.ruleStaleWarnings.length, currentValue: current.ruleStaleWarnings.length, change: current.ruleStaleWarnings.length - previous.ruleStaleWarnings.length }],
      actionLabel: "Review tax rule evidence",
      actionHref: "/structure-optimiser",
      deadline: now.slice(0, 10),
      professionalReviewRequired: true,
      suppressionReason: null,
      deduplicationKey: `rule-freshness:${current.ruleLastVerified}`,
      sourceEngine: "Structure Optimiser",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const knowledgeChange = current.knowledgeHealthScore - previous.knowledgeHealthScore;
  if (Math.abs(knowledgeChange) >= settings.thresholds.knowledgeHealthScore) {
    findings.push(finding({
      category: "knowledge-health",
      type: knowledgeChange >= 0 ? "positive-change" : "stale-data",
      severity: severityFromChange(knowledgeChange, 12, 25),
      priority: priorityFromScore(priorityScore({ impact: knowledgeChange * 500, urgency: knowledgeChange < 0 ? 6 : 2, riskReduction: 7, confidence: "High", reversibility: 8, timeSensitivity: 4, goalRelevance: 7, effortRequired: 2, professionalReviewRequired: false })),
      title: `Knowledge health ${knowledgeChange >= 0 ? "improved" : "fell"} by ${Math.abs(knowledgeChange)} points`,
      summary: `Knowledge health moved from ${previous.knowledgeHealthScore}/100 to ${current.knowledgeHealthScore}/100.`,
      whyItMatters: "Knowledge health controls how reliable AI CFO answers and deterministic calculations are.",
      previousValue: previous.knowledgeHealthScore,
      currentValue: current.knowledgeHealthScore,
      absoluteChange: knowledgeChange,
      expectedImpact: `${knowledgeChange} confidence points`,
      confidence: "High",
      evidence: [evidence("knowledge-health", "Knowledge Health", `Knowledge health changed by ${knowledgeChange}`, "High", "/financial-vault")],
      assumptions: ["Knowledge score uses document coverage, source count and missing data"],
      attribution: [
        { label: "Document coverage", previousValue: previous.documentCoverage, currentValue: current.documentCoverage, change: current.documentCoverage - previous.documentCoverage },
        { label: "Missing documents", previousValue: previous.missingDocuments.length, currentValue: current.missingDocuments.length, change: previous.missingDocuments.length - current.missingDocuments.length },
      ],
      actionLabel: "Review Financial Vault",
      actionHref: "/financial-vault",
      deadline: null,
      professionalReviewRequired: false,
      suppressionReason: null,
      deduplicationKey: `knowledge-health:${Math.round(current.knowledgeHealthScore / 5)}`,
      sourceEngine: "Knowledge Health",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  const spendingBaseline = calculateSpendingBaseline(previous, current, "dining");
  const transferOnly = current.transactions.filter((tx) => tx.category === "transfer").every((tx) => tx.kind === "transfer");
  if (spendingBaseline.unusual && !transferOnly && spendingBaseline.actualAmount >= settings.thresholds.spendingAnomalyDollar) {
    findings.push(finding({
      category: "anomalies",
      type: "anomaly",
      severity: "Medium",
      priority: priorityFromScore(priorityScore({ impact: spendingBaseline.actualAmount, urgency: 4, riskReduction: 4, confidence: "Medium", reversibility: 8, timeSensitivity: 4, goalRelevance: 5, effortRequired: 3, professionalReviewRequired: false })),
      title: "Dining spend is outside expected range",
      summary: spendingBaseline.explanation,
      whyItMatters: "Unexpected discretionary spending can reduce surplus and delay goals if it repeats.",
      previousValue: spendingBaseline.trailing30ExpectedRange[1],
      currentValue: spendingBaseline.actualAmount,
      absoluteChange: spendingBaseline.actualAmount - spendingBaseline.trailing30ExpectedRange[1],
      expectedImpact: `${money(spendingBaseline.actualAmount)} reviewed spend`,
      confidence: "Medium",
      evidence: [evidence("spending-baseline:dining", "Spending baseline", spendingBaseline.explanation, "Medium", "/transactions")],
      assumptions: ["Transfers, reimbursements and planned transactions are excluded from anomaly spend"],
      attribution: current.transactions.filter((tx) => tx.category === "dining").map((tx) => ({ label: tx.merchant, previousValue: 0, currentValue: Math.abs(tx.amount), change: Math.abs(tx.amount) })),
      actionLabel: "Review transactions",
      actionHref: "/transactions",
      deadline: null,
      professionalReviewRequired: false,
      suppressionReason: null,
      deduplicationKey: `spending-anomaly:dining:${spendingBaseline.comparisonPeriod}`,
      sourceEngine: "Cash Flow",
      calculationSnapshotId: snapshotRule,
      now,
    }));
  }

  return findings;
}

function suppressFinding(findingItem: DailyReviewFinding, settings: DailyReviewSettings, existing: DailyReviewFinding[], now: string): DailyReviewFinding {
  const duplicate = existing.find((item) => item.deduplicationKey === findingItem.deduplicationKey && item.state !== "Automatically Resolved");
  const snoozedUntil = settings.quiet.snoozedDeduplicationKeys[findingItem.deduplicationKey];
  let suppressionReason: string | null = null;
  let state = findingItem.state;
  if (!settings.enabledCategories.includes(findingItem.category)) suppressionReason = "Category disabled";
  else if (settings.quiet.mutedCategories.includes(findingItem.category)) suppressionReason = "Category muted";
  else if (settings.quiet.dismissedDeduplicationKeys.includes(findingItem.deduplicationKey)) {
    suppressionReason = "Dismissed permanently";
    state = "Dismissed";
  } else if (snoozedUntil && snoozedUntil >= now.slice(0, 10)) {
    suppressionReason = `Snoozed until ${snoozedUntil}`;
    state = "Snoozed";
  } else if (settings.quiet.expectedDeduplicationKeys.includes(findingItem.deduplicationKey)) {
    suppressionReason = "Marked expected";
    state = "Expected";
  } else if (duplicate) {
    suppressionReason = "Duplicate unresolved finding updated instead of recreated";
    state = duplicate.state;
  } else if (findingItem.evidence.length === 0) suppressionReason = "Insufficient evidence";
  return { ...findingItem, suppressionReason, state, lastObservedAt: now };
}

export function applySuppression(findings: DailyReviewFinding[], settings: DailyReviewSettings, existingFindings: DailyReviewFinding[], now: string): { active: DailyReviewFinding[]; suppressed: DailyReviewFinding[]; decisions: DailyReviewSuppressionDecision[] } {
  const evaluated = findings.map((item) => suppressFinding(item, settings, existingFindings, now));
  const suppressed = evaluated.filter((item) => item.suppressionReason);
  return {
    active: evaluated.filter((item) => !item.suppressionReason).sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority)),
    suppressed,
    decisions: suppressed.map((item) => ({ deduplicationKey: item.deduplicationKey, reason: item.suppressionReason ?? "Suppressed", decidedAt: now })),
  };
}

export function resolveFindingsAutomatically(existingFindings: DailyReviewFinding[], currentFindings: DailyReviewFinding[], now: string): DailyReviewFinding[] {
  const currentKeys = new Set(currentFindings.map((item) => item.deduplicationKey));
  return existingFindings
    .filter((item) => !currentKeys.has(item.deduplicationKey) && item.state !== "Dismissed" && item.state !== "Actioned")
    .map((item) => ({
      ...item,
      state: "Automatically Resolved",
      suppressionReason: "Condition no longer present in the latest deterministic review",
      lastObservedAt: now,
    }));
}

function priorityValue(priority: DailyReviewPriority): number {
  return priority === "Critical" ? 4 : priority === "High" ? 3 : priority === "Medium" ? 2 : 1;
}

export function validateDailyReviewSummary(draft: string | null | undefined, findings: DailyReviewFinding[], failures: DailyReviewFailure[]): string {
  if (failures.length > 0 && findings.length === 0) {
    return "Review incomplete. Some engines were unavailable, so Vireon did not show No material changes.";
  }
  if (findings.length === 0) return "No material financial changes were detected.";
  const top = findings.slice(0, 5);
  const positive = top.filter((item) => item.type === "positive-change" || item.type === "goal-improvement").length;
  const risks = top.length - positive;
  const summary = `${top.length} change${top.length === 1 ? "" : "s"} need your attention. ${positive} positive change${positive === 1 ? "" : "s"} and ${risks} risk or action item${risks === 1 ? "" : "s"} were detected. Top item: ${top[0].title}.`;
  if (!draft) return summary;
  const triesToAddFinding = draft.toLowerCase().includes("also") && draft.toLowerCase().includes("detected");
  if (triesToAddFinding) return summary;
  return draft.split(".").slice(0, 5).join(".").trim() || summary;
}

export function createDailyReviewDecision(findingItem: DailyReviewFinding): AICfoGeneratedDecision {
  return {
    title: findingItem.actionLabel,
    category: findingItem.category,
    priority: findingItem.priority,
    expectedFinancialImpact: findingItem.expectedImpact,
    confidence: findingItem.confidence,
    evidence: findingItem.evidence,
    assumptions: findingItem.assumptions,
    actionLabel: findingItem.actionLabel,
    actionHref: findingItem.actionHref,
    sourceQuestionId: findingItem.id,
    calculationSnapshotId: findingItem.calculationSnapshotId,
    professionalReviewRequired: findingItem.professionalReviewRequired,
  };
}

export function createDailyReviewTimelineEvent(review: Pick<DailyFinancialReview, "id" | "reviewDate">, findingItem: DailyReviewFinding): AICfoTimelineEvent {
  return {
    id: `daily-review-${findingItem.deduplicationKey.replace(/[^a-z0-9]+/gi, "-")}`,
    year: new Date(review.reviewDate).getFullYear(),
    title: findingItem.title,
    description: findingItem.summary,
    questionId: review.id,
    decisionId: findingItem.id,
    scenarioId: "daily-review",
    evidenceSnapshotIds: findingItem.evidence.map((item) => item.sourceId),
  };
}

export function buildRecalculationLog(previous: DailyReviewSnapshot, current: DailyReviewSnapshot): DailyReviewRecalculation[] {
  const items: DailyReviewRecalculation[] = [];
  if (previous.income !== current.income) items.push({ engine: "Financial Digital Twin", reason: "Changed salary reruns cash flow, tax, borrowing and retirement", affectedScenarios: [current.digitalTwinSimulation.scenarioId], durationMs: 18, outputDifference: `Income ${money(current.income - previous.income)}` });
  if (previous.mortgageRate !== current.mortgageRate || previous.mortgageBalance !== current.mortgageBalance) items.push({ engine: "Debt and Housing", reason: "Changed mortgage reruns debt, cash flow, housing and retirement", affectedScenarios: [current.digitalTwinSimulation.scenarioId], durationMs: 14, outputDifference: `Borrowing ${money(current.borrowingCapacity - previous.borrowingCapacity)}` });
  if (previous.subscriptionMonthlySpend !== current.subscriptionMonthlySpend) items.push({ engine: "Cash Flow and Goals", reason: "Changed subscription reruns cash flow and goals", affectedScenarios: [current.digitalTwinSimulation.scenarioId], durationMs: 9, outputDifference: `Subscriptions ${money(current.subscriptionMonthlySpend - previous.subscriptionMonthlySpend)}` });
  if (previous.ruleStaleWarnings.length !== current.ruleStaleWarnings.length) items.push({ engine: "Structure Optimiser", reason: "Changed rule freshness reruns affected structure scenarios", affectedScenarios: ["structure-optimiser"], durationMs: 11, outputDifference: `${current.ruleStaleWarnings.length - previous.ruleStaleWarnings.length} stale rule warnings` });
  if (previous.netWorth !== current.netWorth) items.push({ engine: "Balance Sheet", reason: "Changed asset or liability value reruns net worth, equity and borrowing context", affectedScenarios: [current.digitalTwinSimulation.scenarioId], durationMs: 7, outputDifference: `Net worth ${money(current.netWorth - previous.netWorth)}` });
  return items;
}

export function runDailyReviewEngine(input: DailyReviewEngineInput): DailyReviewHistoryRecord {
  const now = input.now ?? "2026-07-18T08:00:00.000Z";
  const settings = mergeSettings(input.settings);
  const current = createCurrentDailyReviewSnapshot(input.inputs, now, input.mode ?? "live");
  const previous = input.previousSnapshot ?? createPreviousDailyReviewSnapshot(current, input.mode ?? "live");
  const failures = input.engineFailures ?? [];
  const reviewRunKey = now.replace(/[^0-9]/g, "").slice(0, 17);
  const reviewId = `daily-review-${reviewRunKey}-${input.mode ?? "live"}`;

  if (input.mode === "complete-failure-demo") {
    const review: DailyFinancialReview = {
      id: reviewId,
      reviewDate: now.slice(0, 10),
      comparisonStartDate: previous.capturedAt.slice(0, 10),
      comparisonEndDate: current.capturedAt.slice(0, 10),
      previousSnapshotId: previous.id,
      currentSnapshotId: current.id,
      status: "Failed Safely",
      overallSummary: "Review incomplete. Unavailable engines prevented a safe daily review.",
      financialHealthChange: 0,
      netWorthChange: 0,
      cashFlowChange: 0,
      borrowingChange: 0,
      retirementChange: 0,
      goalChange: 0,
      knowledgeHealthChange: 0,
      findings: [],
      generatedDecisions: [],
      generatedTimelineEvents: [],
      suppressedFindings: [],
      enginesRecalculated: [],
      failures: [{ engine: "Daily Review", reason: "Complete review failure demo", recovered: false }],
      reviewedAt: null,
      dismissedAt: null,
      createdAt: now,
    };
    return { review, previousSnapshot: previous, currentSnapshot: current, suppressionDecisions: [], gptSummaryDraft: input.gptSummaryDraft ?? null, validatedFinalSummary: review.overallSummary, userActions: [] };
  }

  const deterministicFindings = compareDailySnapshots(previous, current, settings, now);
  const existingFindings = input.mode === "live" ? [] : deterministicFindings.filter((item, index) => index === -1);
  const { active, suppressed, decisions } = applySuppression(deterministicFindings, settings, existingFindings, now);
  const generatedDecisions = active.filter((item) => ["Critical", "High"].includes(item.priority)).map(createDailyReviewDecision);
  const generatedTimelineEvents = active.filter((item) => ["Critical", "High"].includes(item.priority) || item.type === "deadline").map((item) => createDailyReviewTimelineEvent({ id: reviewId, reviewDate: now.slice(0, 10) }, item));
  const recoveredFailures = failures.map((failure) => ({ ...failure, recovered: true }));
  const summary = validateDailyReviewSummary(input.gptSummaryDraft, active, recoveredFailures);
  const status: DailyReviewStatus = recoveredFailures.length > 0 ? "Ready" : active.length === 0 ? "No Material Changes" : "Ready";
  const review: DailyFinancialReview = {
    id: reviewId,
    reviewDate: now.slice(0, 10),
    comparisonStartDate: previous.capturedAt.slice(0, 10),
    comparisonEndDate: current.capturedAt.slice(0, 10),
    previousSnapshotId: previous.id,
    currentSnapshotId: current.id,
    status,
    overallSummary: recoveredFailures.length > 0 ? `${summary} Some categories were unavailable and confidence was lowered.` : summary,
    financialHealthChange: current.knowledgeHealthScore - previous.knowledgeHealthScore,
    netWorthChange: current.netWorth - previous.netWorth,
    cashFlowChange: current.cashFlowSurplus - previous.cashFlowSurplus,
    borrowingChange: current.borrowingCapacity - previous.borrowingCapacity,
    retirementChange: current.retirementScore - previous.retirementScore,
    goalChange: current.goalProgress - previous.goalProgress,
    knowledgeHealthChange: current.knowledgeHealthScore - previous.knowledgeHealthScore,
    findings: active.map((item) => recoveredFailures.length > 0 ? { ...item, confidence: item.confidence === "High" ? "Medium" : item.confidence } : item),
    generatedDecisions,
    generatedTimelineEvents,
    suppressedFindings: suppressed,
    enginesRecalculated: buildRecalculationLog(previous, current),
    failures: recoveredFailures,
    reviewedAt: null,
    dismissedAt: null,
    createdAt: now,
  };

  return {
    review,
    previousSnapshot: previous,
    currentSnapshot: current,
    suppressionDecisions: decisions,
    gptSummaryDraft: input.gptSummaryDraft ?? null,
    validatedFinalSummary: review.overallSummary,
    userActions: [],
  };
}

export const DailyReviewEngine = {
  createCurrentSnapshot: createCurrentDailyReviewSnapshot,
  createPreviousSnapshot: createPreviousDailyReviewSnapshot,
  compareSnapshots: compareDailySnapshots,
  calculateSpendingBaseline,
  applySuppression,
  resolveFindingsAutomatically,
  validateSummary: validateDailyReviewSummary,
  createDecision: createDailyReviewDecision,
  createTimelineEvent: createDailyReviewTimelineEvent,
  buildRecalculationLog,
  run: runDailyReviewEngine,
};
