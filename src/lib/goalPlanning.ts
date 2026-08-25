import { createHash, randomUUID } from "crypto";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import type { ForecastEvent, ForecastQuality, ForecastSnapshot } from "@/lib/financialForecasting";

export const GOAL_PLANNING_VERSION = "goals-scenario-planning-v1";

export type GoalType =
  | "EMERGENCY_FUND"
  | "DEBT_REPAYMENT"
  | "HOME_PURCHASE"
  | "VEHICLE_PURCHASE"
  | "EDUCATION"
  | "TRAVEL"
  | "RETIREMENT"
  | "INVESTMENT"
  | "INCOME"
  | "SAVINGS"
  | "CUSTOM";
export type GoalStatus = "DRAFT" | "ACTIVE" | "AT_RISK" | "ON_TRACK" | "ACHIEVED" | "PAUSED" | "ARCHIVED";
export type GoalPriority = "critical" | "high" | "medium" | "low";
export type FeasibilityClass = "ACHIEVABLE" | "STRETCHED" | "UNLIKELY" | "INSUFFICIENT_DATA";

export type GoalAssumption = {
  id: string;
  label: string;
  value: number | string;
  unit: "currency" | "percent" | "months" | "years" | "text";
  source: "confirmed-record" | "user-defined" | "default" | "scenario";
  effectiveDate: string;
  certainty: "confirmed" | "estimated" | "assumption" | "low-confidence";
  userEditable: boolean;
  lastUpdatedAt: string;
};

export type FinancialGoal = {
  id: string;
  userId: string;
  type: GoalType;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  linkedAccounts: string[];
  linkedAssets: string[];
  linkedLiabilities: string[];
  linkedScenario: string | null;
  contributionAmount: number;
  contributionFrequency: "weekly" | "fortnightly" | "monthly" | "one-off";
  assumptions: GoalAssumption[];
  provenance: { source: "manual" | "confirmed-record"; sourceRecordIds: string[]; confidence: number };
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type GoalScenarioVariant = {
  id: string;
  goalId: string;
  name: "conservative" | "baseline" | "accelerated" | "delayed" | "custom";
  contributionAmount: number;
  oneOffDeposit: number;
  startDelayMonths: number;
  incomeChange: number;
  expenseReduction: number;
  createdAt: string;
  archived: boolean;
};

export type GoalMilestone = {
  id: string;
  goalId: string;
  date: string;
  title: string;
  thresholdPercent: number;
  amount: number;
  event: ForecastEvent;
};

export type GoalDecision = {
  id: string;
  title: string;
  triggeringCalculation: Record<string, number | string | null>;
  linkedGoalId: string;
  assumptions: string[];
  forecastQuality: ForecastQuality;
  timelineImpact: string;
  nextAction: string;
  professionalReviewBoundary: string | null;
};

export type HomePurchasePlan = {
  depositGap: number;
  estimatedPurchaseCosts: number;
  indicativeLoanAmount: number;
  indicativeMonthlyRepayment: number;
  projectedDepositDate: string | null;
  cashRemainingAfterPurchase: number;
  emergencyFundMonthsAfterPurchase: number;
  debtToIncomeIndicator: number | null;
  monthlyCashFlowEffect: number;
  warnings: string[];
};

export type RetirementPlan = {
  projectedBalance: number;
  contributionGap: number;
  targetDateGap: number;
  additionalMonthlyContributionEffect: number;
  assumptions: string[];
};

export type DebtRepaymentPlan = {
  requiredRepayment: number;
  projectedPayoffDate: string | null;
  interestSaved: number;
  cashFlowImpact: number;
  emergencyFundImpact: number;
  conflictingGoals: string[];
};

export type GoalEvaluation = {
  goal: FinancialGoal;
  requiredMonthlyContribution: number;
  projectedCompletionDate: string | null;
  fundingGap: number;
  currentProgress: number;
  feasibility: FeasibilityClass;
  contributionShortfall: number;
  delayedStartImpact: number;
  increasedContributionImpact: number;
  oneOffDepositImpact: number;
  cashFlowImpact: number;
  emergencyFundImpact: number;
  debtImpact: number;
  competingGoalConflicts: string[];
  forecastQuality: ForecastQuality;
  milestones: GoalMilestone[];
  decisions: GoalDecision[];
  homePurchase?: HomePurchasePlan;
  retirement?: RetirementPlan;
  debtRepayment?: DebtRepaymentPlan;
};

export type GoalComparison = {
  goalId: string;
  baselineScenarioId: string;
  comparedScenarioId: string;
  projectedCompletionDeltaMonths: number | null;
  requiredContributionDelta: number;
  cashFlowDelta: number;
  emergencyFundDelta: number;
  risk: "reduced" | "unchanged" | "increased";
};

export type GoalPlanningSnapshot = {
  id: string;
  version: typeof GOAL_PLANNING_VERSION;
  userId: string;
  generatedAt: string;
  forecastHash: string;
  activeGoals: GoalEvaluation[];
  archivedGoalIds: string[];
  timelineEvents: ForecastEvent[];
  decisions: GoalDecision[];
  aiCfoContext: {
    activeGoals: Array<{ id: string; title: string; progress: number; feasibility: FeasibilityClass; targetDate: string | null; fundingGap: number; requiredMonthlyContribution: number }>;
    conflicts: string[];
    scenarioComparisons: GoalComparison[];
    milestones: GoalMilestone[];
    dataQualityWarnings: string[];
    instruction: string;
  };
  hash: string;
};

export type GoalPlanningState = {
  version: typeof GOAL_PLANNING_VERSION;
  goals: FinancialGoal[];
  scenarios: GoalScenarioVariant[];
  snapshots: GoalPlanningSnapshot[];
  statusHistory: Array<{ id: string; goalId: string; from: GoalStatus; to: GoalStatus; at: string; reason: string }>;
};

const now = () => new Date().toISOString();

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthsBetween(start: string, end: string): number {
  const a = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  const b = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
  return Math.max(0, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth());
}

function addMonths(date: string, months: number): string {
  const value = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

function monthlyContribution(goal: FinancialGoal): number {
  if (goal.contributionFrequency === "weekly") return goal.contributionAmount * 52 / 12;
  if (goal.contributionFrequency === "fortnightly") return goal.contributionAmount * 26 / 12;
  if (goal.contributionFrequency === "one-off") return 0;
  return goal.contributionAmount;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assumption(id: string, label: string, value: number | string, unit: GoalAssumption["unit"], source: GoalAssumption["source"], date: string): GoalAssumption {
  return { id, label, value, unit, source, effectiveDate: date, certainty: source === "confirmed-record" ? "confirmed" : "assumption", userEditable: source !== "confirmed-record", lastUpdatedAt: date };
}

function numberValue(record: CanonicalFinancialRecord, keys: string[]): number {
  for (const key of keys) {
    const raw = record.value[key];
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[$,\s]/g, "")) : NaN;
    if (Number.isFinite(parsed) && parsed !== 0) return parsed;
  }
  return 0;
}

export function createGoal(input: {
  userId: string;
  type: GoalType;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string | null;
  priority?: GoalPriority;
  contributionAmount?: number;
  contributionFrequency?: FinancialGoal["contributionFrequency"];
  assumptions?: GoalAssumption[];
  linkedAccounts?: string[];
  linkedAssets?: string[];
  linkedLiabilities?: string[];
}): FinancialGoal {
  const at = now();
  return {
    id: `goal-${randomUUID()}`,
    userId: input.userId,
    type: input.type,
    title: input.title,
    description: input.description ?? "",
    targetAmount: Math.max(0, input.targetAmount),
    currentAmount: Math.max(0, input.currentAmount ?? 0),
    targetDate: input.targetDate ?? null,
    priority: input.priority ?? "medium",
    status: "ACTIVE",
    linkedAccounts: input.linkedAccounts ?? [],
    linkedAssets: input.linkedAssets ?? [],
    linkedLiabilities: input.linkedLiabilities ?? [],
    linkedScenario: null,
    contributionAmount: Math.max(0, input.contributionAmount ?? 0),
    contributionFrequency: input.contributionFrequency ?? "monthly",
    assumptions: input.assumptions ?? defaultGoalAssumptions(input.type, at.slice(0, 10)),
    provenance: { source: "manual", sourceRecordIds: [], confidence: 1 },
    createdAt: at,
    updatedAt: at,
    archivedAt: null,
  };
}

export function goalFromRecord(record: CanonicalFinancialRecord): FinancialGoal {
  const at = record.updatedAt;
  return {
    id: `goal-${record.id}`,
    userId: record.userId,
    type: (String(record.value.type ?? record.subtype ?? "CUSTOM").toUpperCase() as GoalType) || "CUSTOM",
    title: record.label,
    description: String(record.value.description ?? ""),
    targetAmount: numberValue(record, ["targetAmount", "target", "amount"]),
    currentAmount: numberValue(record, ["currentAmount", "current", "balance"]),
    targetDate: typeof record.value.targetDate === "string" ? record.value.targetDate : null,
    priority: (record.value.priority as GoalPriority) ?? "medium",
    status: ((record.value.status as GoalStatus) ?? "ACTIVE") === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
    linkedAccounts: [],
    linkedAssets: [],
    linkedLiabilities: [],
    linkedScenario: null,
    contributionAmount: numberValue(record, ["contributionAmount", "monthlyContribution", "monthlyAmount"]),
    contributionFrequency: "monthly",
    assumptions: defaultGoalAssumptions((String(record.value.type ?? record.subtype ?? "CUSTOM").toUpperCase() as GoalType) || "CUSTOM", at.slice(0, 10)),
    provenance: { source: "confirmed-record", sourceRecordIds: [record.id], confidence: record.provenance.confidence },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: null,
  };
}

function defaultGoalAssumptions(type: GoalType, date: string): GoalAssumption[] {
  const common = [assumption("inflation", "Inflation assumption", 3, "percent", "default", date)];
  if (type === "HOME_PURCHASE") return [...common, assumption("purchase-cost-rate", "Purchase costs", 5, "percent", "default", date), assumption("home-loan-rate", "Indicative home-loan rate", 6.25, "percent", "default", date), assumption("loan-term-years", "Indicative loan term", 30, "years", "default", date)];
  if (type === "RETIREMENT") return [...common, assumption("super-return", "Super return assumption", 5.5, "percent", "default", date), assumption("super-fees", "Super fee assumption", 0.7, "percent", "default", date)];
  if (type === "DEBT_REPAYMENT") return [...common, assumption("extra-repayment-test", "Extra repayment test", 250, "currency", "default", date)];
  return common;
}

function cashSurplus(forecast: ForecastSnapshot): number {
  const firstYear = forecast.months.slice(0, 12);
  return firstYear.length ? firstYear.reduce((sum, month) => sum + month.surplus, 0) / firstYear.length : 0;
}

function completionDate(goal: FinancialGoal, monthly: number, startDate: string, oneOffDeposit = 0, delay = 0): string | null {
  const gap = Math.max(0, goal.targetAmount - goal.currentAmount - oneOffDeposit);
  if (gap === 0) return addMonths(startDate, delay);
  if (monthly <= 0) return null;
  return addMonths(startDate, delay + Math.ceil(gap / monthly));
}

function feasibility(goal: FinancialGoal, requiredMonthly: number, availableSurplus: number, quality: ForecastQuality): FeasibilityClass {
  if (quality === "INSUFFICIENT" || goal.targetAmount <= 0 || (goal.targetDate == null && monthlyContribution(goal) <= 0)) return "INSUFFICIENT_DATA";
  if (requiredMonthly <= Math.max(1, availableSurplus * 0.5)) return "ACHIEVABLE";
  if (requiredMonthly <= Math.max(1, availableSurplus)) return "STRETCHED";
  return "UNLIKELY";
}

function milestoneEvents(goal: FinancialGoal, startDate: string, monthly: number): GoalMilestone[] {
  return [25, 50, 75, 100].flatMap((threshold) => {
    const amount = round(goal.targetAmount * threshold / 100);
    const remaining = Math.max(0, amount - goal.currentAmount);
    if (remaining === 0) return [];
    if (monthly <= 0) return [];
    const date = addMonths(startDate, Math.ceil(remaining / monthly));
    const event: ForecastEvent = {
      id: `goal-event-${goal.id}-${threshold}`,
      date,
      type: "goal-milestone",
      title: `${goal.title} ${threshold}% funded`,
      amount,
      source: goal.provenance.source === "confirmed-record" ? "confirmed-record" : "assumption",
      certainty: goal.provenance.confidence >= 0.9 ? "estimated" : "low-confidence",
      recurring: false,
      linkedRecordIds: goal.provenance.sourceRecordIds,
      affectedCalculations: ["goals", "cash-flow"],
      userEditable: false,
      generated: true,
    };
    return [{ id: event.id, goalId: goal.id, date, title: event.title, thresholdPercent: threshold, amount, event }];
  });
}

function homePurchasePlan(goal: FinancialGoal, forecast: ForecastSnapshot): HomePurchasePlan {
  const costRate = Number(goal.assumptions.find((item) => item.id === "purchase-cost-rate")?.value ?? 5);
  const rate = Number(goal.assumptions.find((item) => item.id === "home-loan-rate")?.value ?? 6.25) / 100 / 12;
  const termMonths = Number(goal.assumptions.find((item) => item.id === "loan-term-years")?.value ?? 30) * 12;
  const purchaseCosts = goal.targetAmount * costRate / 100;
  const depositTarget = Math.max(goal.targetAmount * 0.2, Number(goal.assumptions.find((item) => item.id === "deposit-target")?.value ?? 0));
  const depositGap = Math.max(0, depositTarget + purchaseCosts - goal.currentAmount);
  const loanAmount = Math.max(0, goal.targetAmount - depositTarget);
  const repayment = rate > 0 ? loanAmount * rate / (1 - Math.pow(1 + rate, -termMonths)) : loanAmount / termMonths;
  const completion = completionDate(goal, monthlyContribution(goal), forecast.input.startDate);
  const finalEmergency = forecast.months.at(-1)?.emergencyFundMonths ?? 0;
  const income = forecast.months[0]?.projectedIncome ?? 0;
  return {
    depositGap: round(depositGap),
    estimatedPurchaseCosts: round(purchaseCosts),
    indicativeLoanAmount: round(loanAmount),
    indicativeMonthlyRepayment: round(repayment),
    projectedDepositDate: completion,
    cashRemainingAfterPurchase: round((forecast.months.at(-1)?.cashBalance ?? 0) - depositGap),
    emergencyFundMonthsAfterPurchase: round(Math.max(0, finalEmergency - depositGap / Math.max(1, forecast.months[0]?.variableExpenses ?? 1))),
    debtToIncomeIndicator: income > 0 ? round(loanAmount / (income * 12)) : null,
    monthlyCashFlowEffect: round(-repayment),
    warnings: ["Borrowing figures are indicative only and are not approval or credit advice."],
  };
}

function retirementPlan(goal: FinancialGoal, forecast: ForecastSnapshot): RetirementPlan {
  const years = Math.max(0, monthsBetween(forecast.input.startDate, goal.targetDate ?? addMonths(forecast.input.startDate, 12 * 20)) / 12);
  const rate = (Number(goal.assumptions.find((item) => item.id === "super-return")?.value ?? 5.5) - Number(goal.assumptions.find((item) => item.id === "super-fees")?.value ?? 0.7)) / 100 / 12;
  const months = Math.round(years * 12);
  let balance = goal.currentAmount;
  for (let i = 0; i < months; i += 1) balance = balance * (1 + rate) + monthlyContribution(goal);
  return {
    projectedBalance: round(balance),
    contributionGap: round(Math.max(0, goal.targetAmount - balance)),
    targetDateGap: round(Math.max(0, goal.targetAmount - balance)),
    additionalMonthlyContributionEffect: round(250 * ((Math.pow(1 + rate, months) - 1) / Math.max(rate, 0.00001))),
    assumptions: goal.assumptions.map((item) => item.label),
  };
}

function debtRepaymentPlan(goal: FinancialGoal, forecast: ForecastSnapshot): DebtRepaymentPlan {
  const debt = forecast.input.debts.find((item) => goal.linkedLiabilities.includes(item.id) || goal.title.toLowerCase().includes(item.label.toLowerCase())) ?? forecast.input.debts[0];
  if (!debt) return { requiredRepayment: 0, projectedPayoffDate: null, interestSaved: 0, cashFlowImpact: 0, emergencyFundImpact: 0, conflictingGoals: [] };
  const months = goal.targetDate ? Math.max(1, monthsBetween(forecast.input.startDate, goal.targetDate)) : 0;
  const monthlyRate = (debt.annualInterestRate ?? 0) / 100 / 12;
  const required = months > 0 ? (monthlyRate > 0 ? debt.openingBalance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)) : debt.openingBalance / months) : debt.monthlyRepayment ?? 0;
  const currentInterest = forecast.months.reduce((sum, month) => sum + month.interest, 0);
  const acceleratedInterest = months > 0 ? Math.max(0, required * months - debt.openingBalance) : currentInterest;
  return {
    requiredRepayment: round(required),
    projectedPayoffDate: months > 0 ? goal.targetDate : forecast.events.find((event) => event.type === "debt-payoff")?.date ?? null,
    interestSaved: round(Math.max(0, currentInterest - acceleratedInterest)),
    cashFlowImpact: round(-(required - (debt.monthlyRepayment ?? 0))),
    emergencyFundImpact: round(-(required - (debt.monthlyRepayment ?? 0)) / Math.max(1, forecast.months[0]?.variableExpenses ?? 1)),
    conflictingGoals: [],
  };
}

function goalDecisions(goal: FinancialGoal, evaluation: Omit<GoalEvaluation, "decisions">): GoalDecision[] {
  const assumptions = goal.assumptions.map((item) => item.label);
  const decisions: GoalDecision[] = [];
  if (evaluation.feasibility === "UNLIKELY") decisions.push({ id: `goal-decision-${goal.id}-miss`, title: "Goal target date likely to be missed", triggeringCalculation: { requiredMonthlyContribution: evaluation.requiredMonthlyContribution, currentContribution: monthlyContribution(goal), fundingGap: evaluation.fundingGap }, linkedGoalId: goal.id, assumptions, forecastQuality: evaluation.forecastQuality, timelineImpact: evaluation.projectedCompletionDate ?? "No completion date", nextAction: "Reduce the target, extend the date, add a one-off deposit, or increase the monthly contribution.", professionalReviewBoundary: null });
  if (evaluation.cashFlowImpact < 0 && Math.abs(evaluation.cashFlowImpact) > Math.max(0, cashSurplusLike(evaluation))) decisions.push({ id: `goal-decision-${goal.id}-cash`, title: "Goal conflicts with cash-flow safety", triggeringCalculation: { cashFlowImpact: evaluation.cashFlowImpact, emergencyFundImpact: evaluation.emergencyFundImpact }, linkedGoalId: goal.id, assumptions, forecastQuality: evaluation.forecastQuality, timelineImpact: "Monthly surplus reduced", nextAction: "Prioritise immediate cash safety and minimum obligations before discretionary goal acceleration.", professionalReviewBoundary: null });
  if (goal.type === "EMERGENCY_FUND" && evaluation.feasibility !== "ACHIEVABLE") decisions.push({ id: `goal-decision-${goal.id}-emergency`, title: "Emergency fund should precede discretionary goals", triggeringCalculation: { progress: evaluation.currentProgress, fundingGap: evaluation.fundingGap }, linkedGoalId: goal.id, assumptions, forecastQuality: evaluation.forecastQuality, timelineImpact: evaluation.projectedCompletionDate ?? "No completion date", nextAction: "Allocate repeatable surplus to emergency savings before adding optional commitments.", professionalReviewBoundary: null });
  if (goal.type === "DEBT_REPAYMENT" && evaluation.debtRepayment && evaluation.debtRepayment.interestSaved > 0) decisions.push({ id: `goal-decision-${goal.id}-interest`, title: "Debt repayment scenario improves interest outcome", triggeringCalculation: { interestSaved: evaluation.debtRepayment.interestSaved, requiredRepayment: evaluation.debtRepayment.requiredRepayment }, linkedGoalId: goal.id, assumptions, forecastQuality: evaluation.forecastQuality, timelineImpact: evaluation.debtRepayment.projectedPayoffDate ?? "Payoff not calculated", nextAction: "Review whether the higher repayment remains affordable before changing commitments.", professionalReviewBoundary: "Credit decisions require lender/product review." });
  if (evaluation.forecastQuality !== "HIGH") decisions.push({ id: `goal-decision-${goal.id}-quality`, title: "Goal assumptions require review", triggeringCalculation: { forecastQuality: evaluation.forecastQuality, warningCount: 1 }, linkedGoalId: goal.id, assumptions, forecastQuality: evaluation.forecastQuality, timelineImpact: "Forecast confidence limited", nextAction: "Refresh confirmed balances, debt terms and recurring spending before relying on long-term dates.", professionalReviewBoundary: null });
  return decisions;
}

function cashSurplusLike(evaluation: Omit<GoalEvaluation, "decisions">): number {
  return Math.max(0, evaluation.requiredMonthlyContribution - evaluation.contributionShortfall);
}

export function evaluateGoal(goal: FinancialGoal, forecast: ForecastSnapshot, variant?: GoalScenarioVariant): GoalEvaluation {
  const baseMonthly = monthlyContribution(goal);
  const monthly = variant ? variant.contributionAmount + variant.expenseReduction + variant.incomeChange : baseMonthly;
  const oneOffDeposit = variant?.oneOffDeposit ?? 0;
  const startDelay = variant?.startDelayMonths ?? 0;
  const gap = Math.max(0, goal.targetAmount - goal.currentAmount - oneOffDeposit);
  const targetMonths = goal.targetDate ? Math.max(1, monthsBetween(forecast.input.startDate, goal.targetDate)) : null;
  const required = targetMonths ? gap / Math.max(1, targetMonths - startDelay) : 0;
  const surplus = cashSurplus(forecast);
  const projected = completionDate(goal, monthly, forecast.input.startDate, oneOffDeposit, startDelay);
  const baseProjected = completionDate(goal, baseMonthly, forecast.input.startDate);
  const bare: Omit<GoalEvaluation, "decisions"> = {
    goal: variant ? { ...goal, contributionAmount: variant.contributionAmount, linkedScenario: variant.id } : goal,
    requiredMonthlyContribution: round(required),
    projectedCompletionDate: projected,
    fundingGap: round(gap),
    currentProgress: goal.targetAmount > 0 ? round(Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)) : 0,
    feasibility: feasibility(goal, required || monthly, surplus, forecast.quality.class),
    contributionShortfall: round(Math.max(0, required - monthly)),
    delayedStartImpact: projected && baseProjected ? monthsBetween(baseProjected, projected) : startDelay,
    increasedContributionImpact: monthly > baseMonthly && projected && baseProjected ? -monthsBetween(projected, baseProjected) : 0,
    oneOffDepositImpact: oneOffDeposit,
    cashFlowImpact: round(-monthly),
    emergencyFundImpact: round(-monthly / Math.max(1, forecast.months[0]?.variableExpenses + forecast.months[0]?.fixedExpenses + forecast.months[0]?.debtRepayments)),
    debtImpact: goal.type === "DEBT_REPAYMENT" ? round(-monthly) : 0,
    competingGoalConflicts: [],
    forecastQuality: forecast.quality.class,
    milestones: milestoneEvents(goal, forecast.input.startDate, monthly),
    ...(goal.type === "HOME_PURCHASE" ? { homePurchase: homePurchasePlan(goal, forecast) } : {}),
    ...(goal.type === "RETIREMENT" ? { retirement: retirementPlan(goal, forecast) } : {}),
    ...(goal.type === "DEBT_REPAYMENT" ? { debtRepayment: debtRepaymentPlan(goal, forecast) } : {}),
  };
  return { ...bare, goal: { ...bare.goal, status: statusFor(bare) }, decisions: goalDecisions(goal, bare) };
}

function statusFor(evaluation: Omit<GoalEvaluation, "decisions">): GoalStatus {
  if (evaluation.goal.status === "PAUSED" || evaluation.goal.status === "ARCHIVED" || evaluation.goal.status === "DRAFT") return evaluation.goal.status;
  if (evaluation.currentProgress >= 100 || evaluation.fundingGap === 0) return "ACHIEVED";
  if (evaluation.feasibility === "ACHIEVABLE") return "ON_TRACK";
  if (evaluation.feasibility === "STRETCHED" || evaluation.feasibility === "UNLIKELY") return "AT_RISK";
  return "ACTIVE";
}

export function compareGoalScenarios(goal: FinancialGoal, forecast: ForecastSnapshot, baseline: GoalScenarioVariant, compared: GoalScenarioVariant): GoalComparison {
  const a = evaluateGoal(goal, forecast, baseline);
  const b = evaluateGoal(goal, forecast, compared);
  const completionDelta = a.projectedCompletionDate && b.projectedCompletionDate ? monthsBetween(a.projectedCompletionDate, b.projectedCompletionDate) : null;
  return {
    goalId: goal.id,
    baselineScenarioId: baseline.id,
    comparedScenarioId: compared.id,
    projectedCompletionDeltaMonths: completionDelta,
    requiredContributionDelta: round(b.requiredMonthlyContribution - a.requiredMonthlyContribution),
    cashFlowDelta: round(b.cashFlowImpact - a.cashFlowImpact),
    emergencyFundDelta: round(b.emergencyFundImpact - a.emergencyFundImpact),
    risk: b.feasibility === "ACHIEVABLE" && a.feasibility !== "ACHIEVABLE" ? "reduced" : b.feasibility === "UNLIKELY" && a.feasibility !== "UNLIKELY" ? "increased" : "unchanged",
  };
}

export function buildGoalSnapshot(input: { userId: string; goals: FinancialGoal[]; scenarios?: GoalScenarioVariant[]; forecast: ForecastSnapshot }): GoalPlanningSnapshot {
  const activeGoals = input.goals.filter((goal) => goal.userId === input.userId && goal.status !== "ARCHIVED").map((goal) => evaluateGoal(goal, input.forecast));
  const conflicts = conflictLabels(activeGoals);
  activeGoals.forEach((evaluation) => { evaluation.competingGoalConflicts = conflicts.filter((item) => item.includes(evaluation.goal.title)); });
  const scenarioComparisons = activeGoals.flatMap((evaluation) => {
    const variants = (input.scenarios ?? []).filter((scenario) => scenario.goalId === evaluation.goal.id && !scenario.archived);
    const baseline = variants.find((variant) => variant.name === "baseline") ?? { id: `scenario-${evaluation.goal.id}-baseline`, goalId: evaluation.goal.id, name: "baseline" as const, contributionAmount: evaluation.goal.contributionAmount, oneOffDeposit: 0, startDelayMonths: 0, incomeChange: 0, expenseReduction: 0, createdAt: input.forecast.generatedAt, archived: false };
    return variants.filter((variant) => variant.id !== baseline.id).map((variant) => compareGoalScenarios(evaluation.goal, input.forecast, baseline, variant));
  });
  const milestones = activeGoals.flatMap((evaluation) => evaluation.milestones);
  const decisions = activeGoals.flatMap((evaluation) => evaluation.decisions);
  const timelineEvents = milestones.map((milestone) => milestone.event).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const withoutHash: Omit<GoalPlanningSnapshot, "hash"> = {
    id: `goal-snapshot-${input.userId}-${input.forecast.hash.slice(0, 12)}`,
    version: GOAL_PLANNING_VERSION,
    userId: input.userId,
    generatedAt: input.forecast.generatedAt,
    forecastHash: input.forecast.hash,
    activeGoals,
    archivedGoalIds: input.goals.filter((goal) => goal.status === "ARCHIVED").map((goal) => goal.id),
    timelineEvents,
    decisions,
    aiCfoContext: {
      activeGoals: activeGoals.map((evaluation) => ({ id: evaluation.goal.id, title: evaluation.goal.title, progress: evaluation.currentProgress, feasibility: evaluation.feasibility, targetDate: evaluation.goal.targetDate, fundingGap: evaluation.fundingGap, requiredMonthlyContribution: evaluation.requiredMonthlyContribution })),
      conflicts,
      scenarioComparisons,
      milestones,
      dataQualityWarnings: input.forecast.quality.warnings,
      instruction: "Explain only deterministic goal facts. Do not invent inputs, guarantee achievement, imply borrowing approval, or present tax/investment outcomes as certain.",
    },
  };
  return { ...withoutHash, hash: hash(withoutHash) };
}

function conflictLabels(evaluations: GoalEvaluation[]): string[] {
  const active = evaluations.filter((evaluation) => !["ACHIEVED", "PAUSED", "ARCHIVED"].includes(evaluation.goal.status));
  const totalRequired = active.reduce((sum, evaluation) => sum + Math.max(evaluation.requiredMonthlyContribution, monthlyContribution(evaluation.goal)), 0);
  const available = Math.max(0, ...active.map((evaluation) => evaluation.requiredMonthlyContribution - evaluation.contributionShortfall));
  const conflicts: string[] = [];
  if (totalRequired > available && active.length > 1) conflicts.push(`Combined goal contributions exceed repeatable surplus by $${Math.round(totalRequired - available).toLocaleString("en-AU")}.`);
  const emergency = active.find((evaluation) => evaluation.goal.type === "EMERGENCY_FUND" && evaluation.feasibility !== "ACHIEVABLE");
  const discretionary = active.find((evaluation) => !["EMERGENCY_FUND", "DEBT_REPAYMENT"].includes(evaluation.goal.type));
  if (emergency && discretionary) conflicts.push(`${emergency.goal.title} should be reviewed before accelerating ${discretionary.goal.title}.`);
  return conflicts;
}

export function defaultGoalState(): GoalPlanningState {
  return { version: GOAL_PLANNING_VERSION, goals: [], scenarios: [], snapshots: [], statusHistory: [] };
}

export const GoalPlanningEngine = {
  createGoal,
  goalFromRecord,
  evaluateGoal,
  buildSnapshot: buildGoalSnapshot,
  compareScenarios: compareGoalScenarios,
};
