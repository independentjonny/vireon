import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";

export type MonthlyCashFlowStatus = "confirmed" | "estimated" | "unavailable";

export type MonthlyCashFlowLine = {
  id: string;
  label: string;
  kind: "income" | "expense";
  monthlyAmount: number;
  cadence: string;
  sourceRecordIds: string[];
  approximate: boolean;
};

export type MonthlyCashFlowModel = {
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  monthlySurplus: number | null;
  status: MonthlyCashFlowStatus;
  basis: string;
  incomeLines: MonthlyCashFlowLine[];
  expenseLines: MonthlyCashFlowLine[];
  sourceRecordIds: string[];
  excludedRecordIds: string[];
  warnings: string[];
};

type NormalisedAmount = { amount: number; cadence: string };

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstPresentNumber(record: CanonicalFinancialRecord, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in record.value)) continue;
    const parsed = finiteNumber(record.value[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function cadence(record: CanonicalFinancialRecord): string {
  const raw = record.value.cadence ?? record.value.frequency ?? record.value.period ?? record.value.paymentFrequency;
  return typeof raw === "string" ? raw.trim().toLowerCase().replace(/[\s_-]+/g, "") : "";
}

function normaliseExplicitRecord(record: CanonicalFinancialRecord): NormalisedAmount | null {
  const monthly = firstPresentNumber(record, ["monthlyAmount", "netMonthlyAmount", "monthlyIncome", "monthlyExpense"]);
  if (monthly !== null) return { amount: Math.abs(monthly), cadence: "monthly" };

  const annual = firstPresentNumber(record, ["annualAmount", "annualIncome", "annualExpense"]);
  if (annual !== null) return { amount: Math.abs(annual) / 12, cadence: "annual" };

  const amount = firstPresentNumber(record, ["amount"]);
  if (amount === null) return null;
  const recordCadence = cadence(record);
  const multipliers: Record<string, number> = {
    weekly: 52 / 12,
    fortnightly: 26 / 12,
    biweekly: 26 / 12,
    monthly: 1,
    quarterly: 4 / 12,
    annual: 1 / 12,
    annually: 1 / 12,
    yearly: 1 / 12,
  };
  const multiplier = multipliers[recordCadence];
  if (multiplier === undefined) return null;
  return { amount: Math.abs(amount) * multiplier, cadence: recordCadence };
}

function explicitLines(records: CanonicalFinancialRecord[], kind: "income" | "expense") {
  const lines: MonthlyCashFlowLine[] = [];
  const excludedRecordIds: string[] = [];
  for (const record of records.filter((item) => item.kind === kind)) {
    const normalised = normaliseExplicitRecord(record);
    if (!normalised) {
      excludedRecordIds.push(record.id);
      continue;
    }
    lines.push({
      id: record.id,
      label: record.label,
      kind,
      monthlyAmount: normalised.amount,
      cadence: normalised.cadence,
      sourceRecordIds: [record.id],
      approximate: record.approximate,
    });
  }
  return { lines, excludedRecordIds };
}

function transactionFallback(records: CanonicalFinancialRecord[]) {
  const transactions = records.flatMap((record) => {
    if (record.kind !== "transaction") return [];
    const amount = firstPresentNumber(record, ["amount"]);
    const rawDate = record.value.date;
    if (amount === null || typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(rawDate)) return [];
    return [{ record, amount, month: rawDate.slice(0, 7) }];
  });
  const months = [...new Set(transactions.map((item) => item.month))].sort();
  if (!months.length) return { incomeLines: [], expenseLines: [], months: 0 };

  const build = (kind: "income" | "expense") => {
    const selected = transactions.filter((item) => kind === "income" ? item.amount > 0 : item.amount < 0);
    const total = selected.reduce((sum, item) => sum + Math.abs(item.amount), 0);
    if (!selected.length) return [];
    return [{
      id: `transactions-${kind}`,
      label: kind === "income" ? "Observed income transactions" : "Observed expense transactions",
      kind,
      monthlyAmount: total / months.length,
      cadence: `${months.length}-month average`,
      sourceRecordIds: selected.map((item) => item.record.id),
      approximate: true,
    } satisfies MonthlyCashFlowLine];
  };

  return { incomeLines: build("income"), expenseLines: build("expense"), months: months.length };
}

export function buildMonthlyCashFlowModel(records: CanonicalFinancialRecord[], userId: string): MonthlyCashFlowModel {
  const confirmed = records.filter((record) => record.userId === userId && record.provenance.userConfirmed && !record.superseded);
  const income = explicitLines(confirmed, "income");
  const expenses = explicitLines(confirmed, "expense");
  const transactions = transactionFallback(confirmed);
  const incomeLines = income.lines.length ? income.lines : transactions.incomeLines;
  const expenseLines = expenses.lines.length ? expenses.lines : transactions.expenseLines;
  const monthlyIncome = incomeLines.length ? incomeLines.reduce((sum, line) => sum + line.monthlyAmount, 0) : null;
  const monthlyExpenses = expenseLines.length ? expenseLines.reduce((sum, line) => sum + line.monthlyAmount, 0) : null;
  const monthlySurplus = monthlyIncome !== null && monthlyExpenses !== null ? monthlyIncome - monthlyExpenses : null;
  const usedTransactions = (!income.lines.length && incomeLines.length > 0) || (!expenses.lines.length && expenseLines.length > 0);
  const approximate = [...incomeLines, ...expenseLines].some((line) => line.approximate);
  const status: MonthlyCashFlowStatus = monthlySurplus === null ? "unavailable" : usedTransactions || approximate ? "estimated" : "confirmed";
  const excludedRecordIds = [...income.excludedRecordIds, ...expenses.excludedRecordIds];
  const warnings = [
    ...(excludedRecordIds.length ? [`${excludedRecordIds.length} recurring record${excludedRecordIds.length === 1 ? " was" : "s were"} excluded because its monthly cadence could not be established.`] : []),
    ...(monthlyIncome === null ? ["Confirmed monthly income is unavailable."] : []),
    ...(monthlyExpenses === null ? ["Confirmed monthly expenses are unavailable."] : []),
  ];
  const sourceRecordIds = [...new Set([...incomeLines, ...expenseLines].flatMap((line) => line.sourceRecordIds))];
  const basis = status === "confirmed"
    ? "Confirmed recurring income and expense records, normalised to monthly values."
    : status === "estimated"
      ? `Estimated from confirmed records${usedTransactions ? `, including ${transactions.months} month${transactions.months === 1 ? "" : "s"} of transactions` : ""}.`
      : "Add confirmed income and expense records with a monthly amount or payment cadence.";

  return { monthlyIncome, monthlyExpenses, monthlySurplus, status, basis, incomeLines, expenseLines, sourceRecordIds, excludedRecordIds, warnings };
}
