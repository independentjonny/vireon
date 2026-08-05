import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";

export const FINANCIAL_FORECAST_VERSION = "financial-timeline-forecasting-v1";

export type ForecastHorizon = "30d" | "90d" | "12m" | "3y" | "5y" | "custom";
export type ForecastQuality = "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";
export type Certainty = "confirmed" | "estimated" | "assumption" | "low-confidence";
export type ForecastEventType =
  | "salary-payment"
  | "expense-payment"
  | "debt-repayment"
  | "interest-charge"
  | "super-contribution"
  | "investment-contribution"
  | "one-off-event"
  | "goal-milestone"
  | "debt-payoff"
  | "emergency-fund-threshold"
  | "cash-shortfall";

export type ForecastAssumption = {
  id: string;
  label: string;
  value: number;
  unit: "percent" | "currency" | "months" | "text";
  source: "default" | "confirmed-record" | "user-defined" | "scenario";
  effectiveDate: string;
  certainty: Certainty;
  userEditable: boolean;
  lastUpdatedAt: string;
};

export type ForecastInput = {
  id: string;
  userId: string;
  generatedAt: string;
  startDate: string;
  horizon: ForecastHorizon;
  horizonMonths: number;
  granularity: "daily" | "weekly" | "monthly";
  openingBalances: {
    cash: number;
    property: number;
    super: number;
    investments: number;
    vehicles: number;
    otherAssets: number;
    mortgages: number;
    loans: number;
    creditCards: number;
  };
  recurringIncome: ForecastLine[];
  recurringExpenses: ForecastLine[];
  debts: ForecastDebt[];
  goals: ForecastGoal[];
  oneOffEvents: ForecastLine[];
  assumptions: ForecastAssumption[];
  sourceRecordIds: string[];
};

export type ForecastLine = {
  id: string;
  label: string;
  amount: number;
  frequency: "monthly" | "fortnightly" | "weekly" | "one-off";
  startDate: string;
  endDate: string | null;
  category: string;
  sourceRecordIds: string[];
  certainty: Certainty;
  userEditable: boolean;
};

export type ForecastDebt = {
  id: string;
  label: string;
  type: "mortgage" | "credit-card" | "personal-loan" | "vehicle-loan" | "help" | "other";
  openingBalance: number;
  annualInterestRate: number | null;
  monthlyRepayment: number | null;
  extraMonthlyRepayment: number;
  sourceRecordIds: string[];
  certainty: Certainty;
};

export type ForecastGoal = {
  id: string;
  label: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  sourceRecordIds: string[];
};

export type ForecastEvent = {
  id: string;
  date: string;
  type: ForecastEventType;
  title: string;
  amount: number;
  source: "confirmed-record" | "assumption" | "scenario";
  certainty: Certainty;
  recurring: boolean;
  linkedRecordIds: string[];
  affectedCalculations: string[];
  userEditable: boolean;
  generated: boolean;
};

export type ForecastMonth = {
  month: string;
  projectedIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  debtRepayments: number;
  interest: number;
  surplus: number;
  cashBalance: number;
  debtBalance: number;
  netWorth: number;
  emergencyFundMonths: number;
};

export type ForecastScenarioDelta = {
  kind:
    | "increase-mortgage-repayment"
    | "reduce-discretionary-spending"
    | "change-salary"
    | "lose-income-temporarily"
    | "refinance-mortgage"
    | "buy-vehicle"
    | "increase-super-contribution"
    | "add-recurring-expense"
    | "add-one-off-expense"
    | "change-investment-contribution";
  amount: number;
  startMonth?: number;
  durationMonths?: number;
  rate?: number;
};

export type ForecastScenario = {
  id: string;
  name: string;
  createdAt: string;
  archived: boolean;
  deltas: ForecastScenarioDelta[];
};

export type ForecastComparison = {
  scenarioId: string;
  scenarioName: string;
  projectedNetWorthDelta: number;
  projectedCashDelta: number;
  projectedDebtDelta: number;
  interestDelta: number;
  payoffMonthsDelta: number | null;
  emergencyFundMonthsDelta: number;
  risk: "reduced" | "unchanged" | "increased";
};

export type ForecastDecision = {
  id: string;
  title: string;
  trigger: string;
  calculation: Record<string, number | string | null>;
  affectedHorizon: ForecastHorizon;
  sourceRecords: string[];
  assumptions: string[];
  forecastQuality: ForecastQuality;
  recommendedNextAction: string;
  professionalReviewBoundary: string | null;
};

export type ForecastSnapshot = {
  id: string;
  version: typeof FINANCIAL_FORECAST_VERSION;
  generatedAt: string;
  input: ForecastInput;
  months: ForecastMonth[];
  events: ForecastEvent[];
  quality: { class: ForecastQuality; warnings: string[] };
  decisions: ForecastDecision[];
  aiCfoContext: {
    baselineFacts: string[];
    upcomingEvents: ForecastEvent[];
    materialRisks: string[];
    assumptionProvenance: ForecastAssumption[];
    decisionIds: string[];
  };
  hash: string;
};

export type ForecastState = {
  version: typeof FINANCIAL_FORECAST_VERSION;
  scenarios: ForecastScenario[];
  snapshots: ForecastSnapshot[];
  archivedScenarioIds: string[];
};

const root = join(process.cwd(), ".vireon", "financial-forecasting");
const statePath = join(root, "forecast-state.json");

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: string, months: number): string {
  const next = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString().slice(0, 10);
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[$,\s]/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(record: CanonicalFinancialRecord, keys: string[]): number {
  for (const key of keys) {
    const value = asNumber(record.value[key]);
    if (value !== 0) return value;
  }
  return 0;
}

function classifyDebt(record: CanonicalFinancialRecord): ForecastDebt["type"] {
  const text = `${record.subtype} ${record.label}`.toLowerCase();
  if (text.includes("mortgage") || text.includes("home loan")) return "mortgage";
  if (text.includes("credit") || text.includes("card")) return "credit-card";
  if (text.includes("vehicle") || text.includes("car")) return "vehicle-loan";
  if (text.includes("help") || text.includes("hecs")) return "help";
  if (text.includes("personal")) return "personal-loan";
  return "other";
}

function frequencyMultiplier(frequency: ForecastLine["frequency"]): number {
  if (frequency === "weekly") return 52 / 12;
  if (frequency === "fortnightly") return 26 / 12;
  return 1;
}

function monthlyAmount(line: ForecastLine): number {
  return line.frequency === "one-off" ? 0 : line.amount * frequencyMultiplier(line.frequency);
}

function assumption(id: string, label: string, value: number, unit: ForecastAssumption["unit"], source: ForecastAssumption["source"], date: string, certainty: Certainty, userEditable = true): ForecastAssumption {
  return { id, label, value, unit, source, effectiveDate: date, certainty, userEditable, lastUpdatedAt: date };
}

export function buildForecastInput(input: {
  userId: string;
  records: CanonicalFinancialRecord[];
  startDate?: string;
  horizon?: ForecastHorizon;
  customMonths?: number;
  assumptions?: Partial<Record<"inflation" | "assetReturn" | "superReturn" | "salaryGrowth", number>>;
}): ForecastInput {
  const startDate = input.startDate ?? new Date().toISOString().slice(0, 10);
  const horizon = input.horizon ?? "12m";
  const horizonMonths = input.customMonths ?? ({ "30d": 1, "90d": 3, "12m": 12, "3y": 36, "5y": 60, custom: 12 }[horizon]);
  const granularity = horizon === "30d" ? "daily" : horizon === "90d" ? "weekly" : "monthly";
  const records = input.records.filter((record) => record.userId === input.userId && !record.superseded && record.provenance.userConfirmed);
  const accounts = records.filter((record) => record.kind === "account");
  const assets = records.filter((record) => record.kind === "asset");
  const liabilities = records.filter((record) => record.kind === "liability");
  const incomes = records.filter((record) => record.kind === "income");
  const expenses = records.filter((record) => record.kind === "expense");
  const transactions = records.filter((record) => record.kind === "transaction");
  const incomeTxs = transactions.filter((record) => firstNumber(record, ["amount"]) > 0);
  const expenseTxs = transactions.filter((record) => firstNumber(record, ["amount"]) < 0);
  const incomeMonths = new Set(incomeTxs.map((record) => String(record.value.date ?? "").slice(0, 7))).size || 1;
  const expenseMonths = new Set(expenseTxs.map((record) => String(record.value.date ?? "").slice(0, 7))).size || 1;
  const monthlyIncomeFromTx = incomeTxs.reduce((sum, record) => sum + firstNumber(record, ["amount"]), 0) / incomeMonths;
  const monthlyExpenseFromTx = Math.abs(expenseTxs.reduce((sum, record) => sum + firstNumber(record, ["amount"]), 0)) / expenseMonths;
  const recurringIncome: ForecastLine[] = incomes.map((record) => ({
    id: `income-${record.id}`,
    label: record.label,
    amount: firstNumber(record, ["monthlyAmount", "netMonthlyAmount", "amount", "annualAmount"]) / (record.value.annualAmount ? 12 : 1),
    frequency: "monthly",
    startDate,
    endDate: null,
    category: record.subtype || "income",
    sourceRecordIds: [record.id],
    certainty: "confirmed",
    userEditable: false,
  }));
  if (!recurringIncome.length && monthlyIncomeFromTx > 0) {
    recurringIncome.push({ id: "income-from-transactions", label: "Average confirmed income", amount: round(monthlyIncomeFromTx), frequency: "monthly", startDate, endDate: null, category: "income", sourceRecordIds: incomeTxs.map((record) => record.id), certainty: incomeMonths >= 3 ? "confirmed" : "estimated", userEditable: true });
  }
  const recurringExpenses: ForecastLine[] = expenses.map((record) => ({
    id: `expense-${record.id}`,
    label: record.label,
    amount: firstNumber(record, ["monthlyAmount", "amount"]),
    frequency: "monthly",
    startDate,
    endDate: null,
    category: record.subtype || "expense",
    sourceRecordIds: [record.id],
    certainty: "confirmed",
    userEditable: false,
  }));
  if (!recurringExpenses.length && monthlyExpenseFromTx > 0) {
    recurringExpenses.push({ id: "expenses-from-transactions", label: "Average confirmed spending", amount: round(monthlyExpenseFromTx), frequency: "monthly", startDate, endDate: null, category: "variable", sourceRecordIds: expenseTxs.map((record) => record.id), certainty: expenseMonths >= 3 ? "confirmed" : "estimated", userEditable: true });
  }
  const debts = liabilities.map((record): ForecastDebt => ({
    id: `debt-${record.id}`,
    label: record.label,
    type: classifyDebt(record),
    openingBalance: firstNumber(record, ["balance", "amount", "principal"]),
    annualInterestRate: firstNumber(record, ["interestRate", "rate"]) || null,
    monthlyRepayment: firstNumber(record, ["monthlyRepayment", "monthlyPayment", "minimumPayment"]) || null,
    extraMonthlyRepayment: firstNumber(record, ["extraMonthlyRepayment"]),
    sourceRecordIds: [record.id],
    certainty: record.provenance.confidence >= 0.9 ? "confirmed" : "estimated",
  }));
  const goals = records.filter((record) => record.kind === "goal").map((record): ForecastGoal => ({
    id: `goal-${record.id}`,
    label: record.label,
    targetAmount: firstNumber(record, ["target", "targetAmount"]),
    currentAmount: firstNumber(record, ["current", "currentAmount", "balance"]),
    monthlyContribution: firstNumber(record, ["monthlyContribution", "monthlyAmount"]),
    sourceRecordIds: [record.id],
  }));
  const openingBalances = {
    cash: accounts.filter((record) => !/super|investment/i.test(`${record.subtype} ${record.label}`)).reduce((sum, record) => sum + firstNumber(record, ["balance", "amount", "value"]), 0),
    property: assets.filter((record) => /property|home|house/i.test(`${record.subtype} ${record.label}`)).reduce((sum, record) => sum + firstNumber(record, ["marketValue", "balance", "amount", "value"]), 0),
    super: [...accounts, ...assets].filter((record) => /super|superannuation/i.test(`${record.subtype} ${record.label}`)).reduce((sum, record) => sum + firstNumber(record, ["balance", "marketValue", "amount", "value"]), 0),
    investments: [...accounts, ...assets].filter((record) => /investment|etf|shares/i.test(`${record.subtype} ${record.label}`)).reduce((sum, record) => sum + firstNumber(record, ["balance", "marketValue", "amount", "value"]), 0),
    vehicles: assets.filter((record) => /vehicle|car/i.test(`${record.subtype} ${record.label}`)).reduce((sum, record) => sum + firstNumber(record, ["marketValue", "amount", "value"]), 0),
    otherAssets: assets.filter((record) => !/property|home|house|super|superannuation|investment|etf|shares|vehicle|car/i.test(`${record.subtype} ${record.label}`)).reduce((sum, record) => sum + firstNumber(record, ["marketValue", "balance", "amount", "value"]), 0),
    mortgages: debts.filter((debt) => debt.type === "mortgage").reduce((sum, debt) => sum + debt.openingBalance, 0),
    loans: debts.filter((debt) => debt.type !== "mortgage" && debt.type !== "credit-card").reduce((sum, debt) => sum + debt.openingBalance, 0),
    creditCards: debts.filter((debt) => debt.type === "credit-card").reduce((sum, debt) => sum + debt.openingBalance, 0),
  };
  const assumptions = [
    assumption("inflation", "Inflation assumption", input.assumptions?.inflation ?? 3, "percent", input.assumptions?.inflation == null ? "default" : "user-defined", startDate, "assumption"),
    assumption("asset-return", "Investment return assumption", input.assumptions?.assetReturn ?? 5, "percent", input.assumptions?.assetReturn == null ? "default" : "user-defined", startDate, "assumption"),
    assumption("super-return", "Super return assumption", input.assumptions?.superReturn ?? 5.5, "percent", input.assumptions?.superReturn == null ? "default" : "user-defined", startDate, "assumption"),
    assumption("salary-growth", "Salary growth assumption", input.assumptions?.salaryGrowth ?? 2.5, "percent", input.assumptions?.salaryGrowth == null ? "default" : "user-defined", startDate, "assumption"),
  ];
  return {
    id: `forecast-input-${input.userId}-${startDate}-${horizon}`,
    userId: input.userId,
    generatedAt: `${startDate}T00:00:00.000Z`,
    startDate,
    horizon,
    horizonMonths,
    granularity,
    openingBalances,
    recurringIncome,
    recurringExpenses,
    debts,
    goals,
    oneOffEvents: [],
    assumptions,
    sourceRecordIds: records.map((record) => record.id),
  };
}

function applyScenario(base: ForecastInput, scenario?: ForecastScenario): ForecastInput {
  if (!scenario || scenario.archived) return base;
  const next: ForecastInput = JSON.parse(JSON.stringify(base)) as ForecastInput;
  for (const delta of scenario.deltas) {
    if (delta.kind === "change-salary") next.recurringIncome.forEach((line) => { line.amount += delta.amount; line.certainty = "assumption"; });
    if (delta.kind === "lose-income-temporarily") next.oneOffEvents.push({ id: `scenario-${scenario.id}-income-loss`, label: "Temporary income loss", amount: -Math.abs(delta.amount), frequency: "one-off", startDate: addMonths(next.startDate, delta.startMonth ?? 0), endDate: addMonths(next.startDate, (delta.startMonth ?? 0) + (delta.durationMonths ?? 1)), category: "income-risk", sourceRecordIds: [], certainty: "assumption", userEditable: true });
    if (delta.kind === "reduce-discretionary-spending") next.recurringExpenses.forEach((line) => { if (/variable|dining|subscription|other|expense/i.test(line.category)) line.amount = Math.max(0, line.amount - Math.abs(delta.amount)); });
    if (delta.kind === "increase-mortgage-repayment") next.debts.filter((debt) => debt.type === "mortgage").forEach((debt) => { debt.extraMonthlyRepayment += Math.abs(delta.amount); });
    if (delta.kind === "refinance-mortgage") next.debts.filter((debt) => debt.type === "mortgage").forEach((debt) => { debt.annualInterestRate = delta.rate ?? debt.annualInterestRate; });
    if (delta.kind === "buy-vehicle") {
      next.openingBalances.vehicles += Math.abs(delta.amount);
      next.oneOffEvents.push({ id: `scenario-${scenario.id}-vehicle`, label: "Vehicle purchase", amount: -Math.abs(delta.amount), frequency: "one-off", startDate: addMonths(next.startDate, delta.startMonth ?? 1), endDate: null, category: "vehicle", sourceRecordIds: [], certainty: "assumption", userEditable: true });
    }
    if (delta.kind === "increase-super-contribution") next.recurringExpenses.push({ id: `scenario-${scenario.id}-super`, label: "Extra super contribution", amount: Math.abs(delta.amount), frequency: "monthly", startDate: addMonths(next.startDate, delta.startMonth ?? 0), endDate: null, category: "super", sourceRecordIds: [], certainty: "assumption", userEditable: true });
    if (delta.kind === "add-recurring-expense") next.recurringExpenses.push({ id: `scenario-${scenario.id}-expense`, label: "Scenario recurring expense", amount: Math.abs(delta.amount), frequency: "monthly", startDate: addMonths(next.startDate, delta.startMonth ?? 0), endDate: null, category: "scenario", sourceRecordIds: [], certainty: "assumption", userEditable: true });
    if (delta.kind === "add-one-off-expense") next.oneOffEvents.push({ id: `scenario-${scenario.id}-one-off`, label: "Scenario one-off expense", amount: -Math.abs(delta.amount), frequency: "one-off", startDate: addMonths(next.startDate, delta.startMonth ?? 0), endDate: null, category: "scenario", sourceRecordIds: [], certainty: "assumption", userEditable: true });
    if (delta.kind === "change-investment-contribution") next.recurringExpenses.push({ id: `scenario-${scenario.id}-investment`, label: "Investment contribution", amount: Math.abs(delta.amount), frequency: "monthly", startDate: addMonths(next.startDate, delta.startMonth ?? 0), endDate: null, category: "investment", sourceRecordIds: [], certainty: "assumption", userEditable: true });
  }
  next.id = `${base.id}-${scenario.id}`;
  return next;
}

function quality(input: ForecastInput): ForecastSnapshot["quality"] {
  const warnings = [
    input.recurringIncome.length ? "" : "Missing recurring income.",
    input.recurringExpenses.length ? "" : "Missing recurring expenses.",
    input.openingBalances.cash ? "" : "Missing confirmed liquid cash balance.",
    input.debts.some((debt) => debt.annualInterestRate == null) ? "One or more debts are missing interest rates." : "",
    input.debts.some((debt) => debt.monthlyRepayment == null) ? "One or more debts are missing repayment amounts." : "",
    input.sourceRecordIds.length < 5 ? "Short confirmed record history." : "",
  ].filter(Boolean);
  if (!input.recurringIncome.length || !input.recurringExpenses.length) return { class: "INSUFFICIENT", warnings };
  if (warnings.length >= 3) return { class: "LOW", warnings };
  if (warnings.length > 0 || input.horizonMonths > 36) return { class: "MODERATE", warnings };
  return { class: "HIGH", warnings };
}

function hashSnapshot(value: Omit<ForecastSnapshot, "hash">): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function generateForecast(baseInput: ForecastInput, scenario?: ForecastScenario): ForecastSnapshot {
  const input = applyScenario(baseInput, scenario);
  const q = quality(input);
  const months: ForecastMonth[] = [];
  const events: ForecastEvent[] = [];
  let cash = input.openingBalances.cash;
  let investments = input.openingBalances.investments;
  let superBalance = input.openingBalances.super;
  const debtBalances = new Map(input.debts.map((debt) => [debt.id, debt.openingBalance]));
  const inflationMonthly = (input.assumptions.find((item) => item.id === "inflation")?.value ?? 0) / 100 / 12;
  const investmentReturnMonthly = (input.assumptions.find((item) => item.id === "asset-return")?.value ?? 0) / 100 / 12;
  const superReturnMonthly = (input.assumptions.find((item) => item.id === "super-return")?.value ?? 0) / 100 / 12;
  let firstShortfall: string | null = null;

  for (let index = 0; index < input.horizonMonths; index += 1) {
    const date = addMonths(input.startDate, index);
    const month = monthKey(new Date(`${date}T00:00:00.000Z`));
    const income = input.recurringIncome.reduce((sum, line) => sum + monthlyAmount(line), 0);
    const fixedExpenses = input.recurringExpenses.filter((line) => !/variable|dining|other/i.test(line.category)).reduce((sum, line) => sum + monthlyAmount(line), 0) * Math.pow(1 + inflationMonthly, index);
    const variableExpenses = input.recurringExpenses.filter((line) => /variable|dining|other/i.test(line.category)).reduce((sum, line) => sum + monthlyAmount(line), 0) * Math.pow(1 + inflationMonthly, index);
    const oneOff = input.oneOffEvents.filter((line) => monthKey(new Date(`${line.startDate}T00:00:00.000Z`)) === month).reduce((sum, line) => sum + line.amount, 0);
    let debtRepayments = 0;
    let interest = 0;
    for (const debt of input.debts) {
      let balance = debtBalances.get(debt.id) ?? 0;
      if (balance <= 0) continue;
      const monthlyRate = (debt.annualInterestRate ?? 0) / 100 / 12;
      const debtInterest = balance * monthlyRate;
      const payment = Math.min(balance + debtInterest, (debt.monthlyRepayment ?? Math.max(balance * 0.02, 25)) + debt.extraMonthlyRepayment);
      balance = Math.max(0, balance + debtInterest - payment);
      debtBalances.set(debt.id, balance);
      debtRepayments += payment;
      interest += debtInterest;
      events.push({ id: `event-${debt.id}-${month}`, date, type: "debt-repayment", title: `${debt.label} repayment`, amount: round(payment), source: "confirmed-record", certainty: debt.certainty, recurring: true, linkedRecordIds: debt.sourceRecordIds, affectedCalculations: ["cash", "debt", "interest"], userEditable: false, generated: true });
      if (balance === 0) events.push({ id: `event-${debt.id}-payoff-${month}`, date, type: "debt-payoff", title: `${debt.label} payoff`, amount: 0, source: "assumption", certainty: debt.certainty, recurring: false, linkedRecordIds: debt.sourceRecordIds, affectedCalculations: ["debt"], userEditable: false, generated: true });
    }
    cash += income - fixedExpenses - variableExpenses - debtRepayments + oneOff;
    investments *= 1 + investmentReturnMonthly;
    superBalance = superBalance * (1 + superReturnMonthly) + income * 0.115;
    const totalDebt = [...debtBalances.values()].reduce((sum, value) => sum + value, 0);
    const netWorth = cash + input.openingBalances.property + investments + superBalance + input.openingBalances.vehicles + input.openingBalances.otherAssets - totalDebt;
    const monthlySpend = fixedExpenses + variableExpenses + debtRepayments;
    const emergencyFundMonths = monthlySpend > 0 ? cash / monthlySpend : 0;
    const surplus = income - fixedExpenses - variableExpenses - debtRepayments + oneOff;
    if (cash < 0 && !firstShortfall) {
      firstShortfall = date;
      events.push({ id: `event-cash-shortfall-${month}`, date, type: "cash-shortfall", title: "Projected cash shortfall", amount: round(cash), source: "assumption", certainty: q.class === "HIGH" ? "estimated" : "low-confidence", recurring: false, linkedRecordIds: input.sourceRecordIds, affectedCalculations: ["cash", "runway"], userEditable: false, generated: true });
    }
    if (emergencyFundMonths < 3) events.push({ id: `event-emergency-fund-${month}`, date, type: "emergency-fund-threshold", title: "Emergency fund below target", amount: round(emergencyFundMonths), source: "assumption", certainty: q.class === "HIGH" ? "estimated" : "low-confidence", recurring: false, linkedRecordIds: input.sourceRecordIds, affectedCalculations: ["safety"], userEditable: false, generated: true });
    for (const line of input.recurringIncome) events.push({ id: `event-${line.id}-${month}`, date, type: "salary-payment", title: line.label, amount: round(monthlyAmount(line)), source: "confirmed-record", certainty: line.certainty, recurring: true, linkedRecordIds: line.sourceRecordIds, affectedCalculations: ["cash", "income"], userEditable: line.userEditable, generated: true });
    for (const line of input.oneOffEvents.filter((item) => monthKey(new Date(`${item.startDate}T00:00:00.000Z`)) === month)) events.push({ id: `event-${line.id}-${month}`, date, type: "one-off-event", title: line.label, amount: line.amount, source: "scenario", certainty: line.certainty, recurring: false, linkedRecordIds: line.sourceRecordIds, affectedCalculations: ["cash", "net-worth"], userEditable: line.userEditable, generated: true });
    months.push({ month, projectedIncome: round(income), fixedExpenses: round(fixedExpenses), variableExpenses: round(variableExpenses), debtRepayments: round(debtRepayments), interest: round(interest), surplus: round(surplus), cashBalance: round(cash), debtBalance: round(totalDebt), netWorth: round(netWorth), emergencyFundMonths: round(emergencyFundMonths) });
  }
  for (const goal of input.goals) {
    const monthsToGoal = goal.monthlyContribution > 0 ? Math.ceil((goal.targetAmount - goal.currentAmount) / goal.monthlyContribution) : null;
    if (monthsToGoal != null && monthsToGoal >= 0 && monthsToGoal < input.horizonMonths) events.push({ id: `event-${goal.id}-milestone`, date: addMonths(input.startDate, monthsToGoal), type: "goal-milestone", title: `${goal.label} goal reached`, amount: goal.targetAmount, source: "confirmed-record", certainty: "estimated", recurring: false, linkedRecordIds: goal.sourceRecordIds, affectedCalculations: ["goals"], userEditable: false, generated: true });
  }
  const uniqueEvents = [...new Map(events.map((event) => [event.id, event])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const decisions = forecastDecisions(input, months, uniqueEvents, q, firstShortfall);
  const withoutHash: Omit<ForecastSnapshot, "hash"> = {
    id: `forecast-${input.id}-${scenario?.id ?? "baseline"}`,
    version: FINANCIAL_FORECAST_VERSION,
    generatedAt: input.generatedAt,
    input,
    months,
    events: uniqueEvents,
    quality: q,
    decisions,
    aiCfoContext: {
      baselineFacts: [
        `Forecast quality is ${q.class}.`,
        `Projected cash after ${input.horizonMonths} months is $${Math.round(months.at(-1)?.cashBalance ?? 0).toLocaleString("en-AU")}.`,
        `Projected debt after ${input.horizonMonths} months is $${Math.round(months.at(-1)?.debtBalance ?? 0).toLocaleString("en-AU")}.`,
        `Projected net worth after ${input.horizonMonths} months is $${Math.round(months.at(-1)?.netWorth ?? 0).toLocaleString("en-AU")}.`,
      ],
      upcomingEvents: uniqueEvents.slice(0, 12),
      materialRisks: decisions.map((decision) => decision.title),
      assumptionProvenance: input.assumptions,
      decisionIds: decisions.map((decision) => decision.id),
    },
  };
  return { ...withoutHash, hash: hashSnapshot(withoutHash) };
}

function forecastDecisions(input: ForecastInput, months: ForecastMonth[], events: ForecastEvent[], q: ForecastSnapshot["quality"], firstShortfall: string | null): ForecastDecision[] {
  const final = months.at(-1);
  const decisions: ForecastDecision[] = [];
  if (firstShortfall) decisions.push({ id: "forecast-cash-shortfall", title: "Projected cash shortfall", trigger: `Cash balance falls below zero on ${firstShortfall}.`, calculation: { firstShortfall, lowestCash: Math.min(...months.map((month) => month.cashBalance)) }, affectedHorizon: input.horizon, sourceRecords: input.sourceRecordIds, assumptions: input.assumptions.map((item) => item.label), forecastQuality: q.class, recommendedNextAction: "Reduce discretionary expenses, move the one-off obligation, or increase liquid buffer before the shortfall date.", professionalReviewBoundary: null });
  if (months.some((month) => month.emergencyFundMonths < 3)) decisions.push({ id: "forecast-emergency-fund-risk", title: "Emergency fund falls below target", trigger: "Emergency fund coverage is below three months in the forecast.", calculation: { lowestEmergencyFundMonths: Math.min(...months.map((month) => month.emergencyFundMonths)) }, affectedHorizon: input.horizon, sourceRecords: input.sourceRecordIds, assumptions: input.assumptions.map((item) => item.label), forecastQuality: q.class, recommendedNextAction: "Build or preserve a larger cash buffer before increasing optional commitments.", professionalReviewBoundary: null });
  const totalInterest = months.reduce((sum, month) => sum + month.interest, 0);
  if (totalInterest > 1000) decisions.push({ id: "forecast-interest-burden", title: "High projected interest burden", trigger: `Projected interest is $${Math.round(totalInterest).toLocaleString("en-AU")} over the horizon.`, calculation: { totalInterest: round(totalInterest), finalDebt: final?.debtBalance ?? 0 }, affectedHorizon: input.horizon, sourceRecords: input.debts.flatMap((debt) => debt.sourceRecordIds), assumptions: input.assumptions.map((item) => item.label), forecastQuality: q.class, recommendedNextAction: "Review repayment acceleration or refinancing assumptions before acting.", professionalReviewBoundary: "Credit and refinance decisions require lender/product review." });
  if (final && final.netWorth < input.openingBalances.cash + input.openingBalances.property + input.openingBalances.super + input.openingBalances.investments + input.openingBalances.vehicles + input.openingBalances.otherAssets - input.openingBalances.mortgages - input.openingBalances.loans - input.openingBalances.creditCards) decisions.push({ id: "forecast-net-worth-decline", title: "Net worth declines under baseline", trigger: "Projected final net worth is below opening net worth.", calculation: { finalNetWorth: final.netWorth }, affectedHorizon: input.horizon, sourceRecords: input.sourceRecordIds, assumptions: input.assumptions.map((item) => item.label), forecastQuality: q.class, recommendedNextAction: "Inspect cash-flow leakage, one-off events and debt assumptions.", professionalReviewBoundary: null });
  if (q.class === "LOW" || q.class === "INSUFFICIENT") decisions.push({ id: "forecast-data-quality", title: "Stale or missing data weakens forecast", trigger: q.warnings.join(" "), calculation: { warningCount: q.warnings.length, quality: q.class }, affectedHorizon: input.horizon, sourceRecords: input.sourceRecordIds, assumptions: input.assumptions.map((item) => item.label), forecastQuality: q.class, recommendedNextAction: "Refresh confirmed income, spending, balance and debt records before relying on long-horizon projections.", professionalReviewBoundary: null });
  return decisions;
}

export function compareForecasts(baseline: ForecastSnapshot, scenario: ForecastSnapshot, scenarioName = "Scenario"): ForecastComparison {
  const base = baseline.months.at(-1);
  const next = scenario.months.at(-1);
  const basePayoff = baseline.events.find((event) => event.type === "debt-payoff")?.date ?? null;
  const scenarioPayoff = scenario.events.find((event) => event.type === "debt-payoff")?.date ?? null;
  const monthDelta = basePayoff && scenarioPayoff ? (new Date(scenarioPayoff).getUTCFullYear() - new Date(basePayoff).getUTCFullYear()) * 12 + new Date(scenarioPayoff).getUTCMonth() - new Date(basePayoff).getUTCMonth() : null;
  const projectedCashDelta = (next?.cashBalance ?? 0) - (base?.cashBalance ?? 0);
  const projectedDebtDelta = (next?.debtBalance ?? 0) - (base?.debtBalance ?? 0);
  return {
    scenarioId: scenario.id,
    scenarioName,
    projectedNetWorthDelta: round((next?.netWorth ?? 0) - (base?.netWorth ?? 0)),
    projectedCashDelta: round(projectedCashDelta),
    projectedDebtDelta: round(projectedDebtDelta),
    interestDelta: round(scenario.months.reduce((sum, month) => sum + month.interest, 0) - baseline.months.reduce((sum, month) => sum + month.interest, 0)),
    payoffMonthsDelta: monthDelta,
    emergencyFundMonthsDelta: round((next?.emergencyFundMonths ?? 0) - (base?.emergencyFundMonths ?? 0)),
    risk: projectedCashDelta < 0 || projectedDebtDelta > 0 ? "increased" : projectedCashDelta > 0 || projectedDebtDelta < 0 ? "reduced" : "unchanged",
  };
}

export function defaultForecastState(): ForecastState {
  return { version: FINANCIAL_FORECAST_VERSION, scenarios: [], snapshots: [], archivedScenarioIds: [] };
}

export function readForecastState(): ForecastState {
  if (!existsSync(statePath)) return defaultForecastState();
  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as ForecastState;
  } catch {
    return defaultForecastState();
  }
}

export function writeForecastState(state: ForecastState): void {
  mkdirSync(root, { recursive: true });
  const tmp = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  if (existsSync(statePath)) unlinkSync(statePath);
  renameSync(tmp, statePath);
}

export function persistForecastSnapshot(snapshot: ForecastSnapshot, scenario?: ForecastScenario): ForecastState {
  const state = readForecastState();
  const scenarios = scenario && !state.scenarios.some((item) => item.id === scenario.id) ? [...state.scenarios, scenario] : state.scenarios;
  const snapshots = [...state.snapshots.filter((item) => item.hash !== snapshot.hash), snapshot];
  const next = { ...state, scenarios, snapshots };
  writeForecastState(next);
  return next;
}

export const FinancialForecastingEngine = {
  buildInput: buildForecastInput,
  generate: generateForecast,
  compare: compareForecasts,
  readState: readForecastState,
  writeState: writeForecastState,
  persist: persistForecastSnapshot,
};
