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
  category: "employment" | "rental" | "investment" | "other-income" | "living-expense" | "mortgage" | "transactions";
  period: {
    basis: "current-recurring" | "observed-period";
    startDate: string | null;
    endDate: string | null;
    asOfDate: string;
  };
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
  missingInputs: MonthlyCashFlowMissingInput[];
};

export type MonthlyCashFlowMissingInput = {
  code: "rental-income" | "mortgage-repayment" | "income-cadence" | "expense-cadence" | "income" | "expenses";
  recordId: string | null;
  title: string;
  detail: string;
  href: string;
};

type NormalisedAmount = { amount: number; cadence: string };

function dateValue(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function recordPeriod(record: CanonicalFinancialRecord): MonthlyCashFlowLine["period"] {
  const startDate = dateValue(record.value.periodStart ?? record.value.sourcePeriodStart ?? record.value.startDate);
  const endDate = dateValue(record.value.periodEnd ?? record.value.sourcePeriodEnd ?? record.value.endDate);
  const asOfDate = dateValue(record.value.asOfDate ?? record.value.effectiveDate ?? record.value.statementDate ?? record.updatedAt) ?? record.updatedAt;
  return { basis: startDate || endDate ? "observed-period" : "current-recurring", startDate, endDate, asOfDate };
}

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
  if (!recordCadence && /\bmonthly\b/i.test(`${record.subtype} ${record.label}`)) {
    return { amount: Math.abs(amount), cadence: "monthly" };
  }
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

function normaliseAmount(amount: unknown, rawCadence: unknown): NormalisedAmount | null {
  const parsed = finiteNumber(amount);
  if (parsed === null) return null;
  const valueCadence = typeof rawCadence === "string" ? rawCadence.trim().toLowerCase().replace(/[\s_-]+/g, "") : "";
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
  const multiplier = multipliers[valueCadence];
  return multiplier === undefined ? null : { amount: Math.abs(parsed) * multiplier, cadence: valueCadence };
}

function incomeCategory(record: CanonicalFinancialRecord): MonthlyCashFlowLine["category"] {
  const text = `${record.subtype} ${record.label}`.toLowerCase();
  if (/rent|property/.test(text)) return "rental";
  if (/dividend|distribution|interest|investment|shares|etf|fund/.test(text)) return "investment";
  if (/salary|wage|employment|payroll|bonus|commission/.test(text)) return "employment";
  return "other-income";
}

function recurringIdentity(record: CanonicalFinancialRecord): string | null {
  const label = record.label.trim().toLowerCase().replace(/\s+/g, " ");
  if (record.kind === "income" && (label === "monthly income" || /usual monthly household income after tax/.test(label))) return "income:household-monthly";
  if (record.kind === "expense" && (label === "essential monthly spending" || /usual monthly household expenses?/.test(label))) return "expense:household-monthly";
  const explicitIdentity = record.value.cashFlowKey ?? record.value.questionId ?? record.value.entityKey;
  return typeof explicitIdentity === "string" && explicitIdentity.trim() ? `${record.kind}:${explicitIdentity.trim()}` : null;
}

function selectCurrentRecurringRecords(records: CanonicalFinancialRecord[]) {
  const ungrouped: CanonicalFinancialRecord[] = [];
  const groups = new Map<string, CanonicalFinancialRecord[]>();
  for (const record of records) {
    const identity = recurringIdentity(record);
    if (!identity) {
      ungrouped.push(record);
      continue;
    }
    groups.set(identity, [...(groups.get(identity) ?? []), record]);
  }
  const selected = [...ungrouped];
  const replacedRecordIds: string[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    selected.push(ordered[0]);
    replacedRecordIds.push(...ordered.slice(1).map((record) => record.id));
  }
  return { selected, replacedRecordIds };
}

function explicitLines(records: CanonicalFinancialRecord[], kind: "income" | "expense") {
  const lines: MonthlyCashFlowLine[] = [];
  const excludedRecordIds: string[] = [];
  const incompleteRecordIds: string[] = [];
  const current = selectCurrentRecurringRecords(records.filter((item) => item.kind === kind));
  for (const record of current.selected) {
    const normalised = normaliseExplicitRecord(record);
    if (!normalised) {
      excludedRecordIds.push(record.id);
      if (cadence(record) !== "oneoff") incompleteRecordIds.push(record.id);
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
      category: kind === "income" ? incomeCategory(record) : "living-expense",
      period: recordPeriod(record),
    });
  }
  return { lines, excludedRecordIds, incompleteRecordIds, replacedRecordIds: current.replacedRecordIds };
}

function propertyRentalLines(records: CanonicalFinancialRecord[]) {
  const lines: MonthlyCashFlowLine[] = [];
  const excludedRecordIds: string[] = [];
  for (const record of records.filter((item) => item.kind === "asset" && /property/i.test(`${item.subtype} ${item.label}`) && item.value.rentalIncome === true)) {
    const normalised = firstPresentNumber(record, ["monthlyRentalIncome"]) !== null
      ? { amount: Math.abs(firstPresentNumber(record, ["monthlyRentalIncome"])!), cadence: "monthly" }
      : firstPresentNumber(record, ["annualRentalIncome"]) !== null
        ? { amount: Math.abs(firstPresentNumber(record, ["annualRentalIncome"])!) / 12, cadence: "annual" }
        : normaliseAmount(record.value.rentalIncomeAmount, record.value.rentalIncomeFrequency);
    if (!normalised || normalised.amount <= 0) {
      excludedRecordIds.push(record.id);
      continue;
    }
    lines.push({ id: `rental-${record.id}`, label: `Rental income — ${record.label}`, kind: "income", monthlyAmount: normalised.amount, cadence: normalised.cadence, sourceRecordIds: [record.id], approximate: record.approximate, category: "rental", period: recordPeriod(record) });
  }
  return { lines, excludedRecordIds };
}

function investmentIncomeLines(records: CanonicalFinancialRecord[]) {
  const lines: MonthlyCashFlowLine[] = [];
  for (const record of records.filter((item) => item.kind === "asset" && /investment|shares|etf|fund|term deposit|savings/i.test(`${item.subtype} ${item.label}`))) {
    const monthlyInvestmentIncome = finiteNumber(record.value.monthlyInvestmentIncome);
    const candidates = [
      monthlyInvestmentIncome !== null
        ? { label: "Investment income", amount: monthlyInvestmentIncome, cadence: "monthly" }
        : { label: "Investment income", amount: record.value.annualInvestmentIncome, cadence: "annual" },
      { label: "Dividend income", amount: record.value.dividendAmount, cadence: record.value.dividendFrequency },
      { label: "Distribution income", amount: record.value.distributionAmount, cadence: record.value.distributionFrequency },
      { label: "Interest income", amount: record.value.interestIncomeAmount, cadence: record.value.interestIncomeFrequency },
    ];
    const seen = new Set<string>();
    candidates.forEach((candidate, index) => {
      const normalised = normaliseAmount(candidate.amount, candidate.cadence);
      if (!normalised || normalised.amount <= 0) return;
      const key = `${candidate.label}:${normalised.amount}`;
      if (seen.has(key)) return;
      seen.add(key);
      lines.push({ id: `investment-${record.id}-${index}`, label: `${candidate.label} — ${record.label}`, kind: "income", monthlyAmount: normalised.amount, cadence: normalised.cadence, sourceRecordIds: [record.id], approximate: record.approximate, category: "investment", period: recordPeriod(record) });
    });
  }
  return lines;
}

function mortgageRepaymentLines(records: CanonicalFinancialRecord[]) {
  const lines: MonthlyCashFlowLine[] = [];
  const excludedRecordIds: string[] = [];
  for (const record of records.filter((item) => item.kind === "liability" && /mortgage|home loan/i.test(`${item.subtype} ${item.label}`))) {
    const normalised = normaliseAmount(record.value.repaymentAmount, record.value.repaymentFrequency);
    if (!normalised || normalised.amount <= 0) {
      excludedRecordIds.push(record.id);
      continue;
    }
    lines.push({ id: `mortgage-${record.id}`, label: `Mortgage repayment — ${record.label}`, kind: "expense", monthlyAmount: normalised.amount, cadence: normalised.cadence, sourceRecordIds: [record.id], approximate: record.approximate, category: "mortgage", period: recordPeriod(record) });
  }
  return { lines, excludedRecordIds };
}

function transactionText(record: CanonicalFinancialRecord) {
  return [record.value.kind, record.value.category, record.value.type, record.value.transactionType, record.value.flowType, record.value.description, record.value.merchant, record.subtype, record.label].filter((value) => typeof value === "string").join(" ").toLowerCase();
}

function isExcludedTransaction(record: CanonicalFinancialRecord) {
  return /transfer|reimbursement|refund|reversal|redraw|loan proceeds|loan draw|asset sale|sale proceeds|sell shares|cash advance|internal/.test(transactionText(record));
}

function isIncomeTransaction(record: CanonicalFinancialRecord) {
  return /salary|wage|payroll|rent|rental|dividend|distribution|interest credit|pension|annuity|bonus|commission|income/.test(transactionText(record));
}

function transactionFallback(records: CanonicalFinancialRecord[]) {
  const excludedRecordIds: string[] = [];
  const transactions = records.flatMap((record) => {
    if (record.kind !== "transaction") return [];
    const amount = firstPresentNumber(record, ["amount"]);
    const rawDate = record.value.date;
    if (amount === null || typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(rawDate)) return [];
    if (isExcludedTransaction(record) || (amount > 0 && !isIncomeTransaction(record))) {
      excludedRecordIds.push(record.id);
      return [];
    }
    return [{ record, amount, month: rawDate.slice(0, 7) }];
  });
  const months = [...new Set(transactions.map((item) => item.month))].sort();
  if (!months.length) return { incomeLines: [], expenseLines: [], months: 0, excludedRecordIds };

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
      category: "transactions",
      period: {
        basis: "observed-period",
        startDate: selected.map((item) => String(item.record.value.date).slice(0, 10)).sort()[0] ?? null,
        endDate: selected.map((item) => String(item.record.value.date).slice(0, 10)).sort().at(-1) ?? null,
        asOfDate: selected.map((item) => item.record.updatedAt).sort().at(-1) ?? new Date().toISOString(),
      },
    } satisfies MonthlyCashFlowLine];
  };

  return { incomeLines: build("income"), expenseLines: build("expense"), months: months.length, excludedRecordIds };
}

export function buildMonthlyCashFlowModel(records: CanonicalFinancialRecord[], userId: string): MonthlyCashFlowModel {
  const confirmed = records.filter((record) => record.userId === userId && record.provenance.userConfirmed && !record.superseded);
  const income = explicitLines(confirmed, "income");
  const expenses = explicitLines(confirmed, "expense");
  const rental = income.lines.some((line) => line.category === "rental") ? { lines: [], excludedRecordIds: [] } : propertyRentalLines(confirmed);
  const investment = income.lines.some((line) => line.category === "investment") ? [] : investmentIncomeLines(confirmed);
  const mortgages = expenses.lines.some((line) => /mortgage|home loan/i.test(line.label)) ? { lines: [], excludedRecordIds: [] } : mortgageRepaymentLines(confirmed);
  const transactions = transactionFallback(confirmed);
  const recurringIncomeLines = [...income.lines, ...rental.lines, ...investment];
  const recurringExpenseLines = [...expenses.lines, ...mortgages.lines];
  const incomeLines = recurringIncomeLines.length ? recurringIncomeLines : transactions.incomeLines;
  const expenseLines = recurringExpenseLines.length ? recurringExpenseLines : transactions.expenseLines;
  const transactionIncomeFallback = !recurringIncomeLines.length && transactions.incomeLines.length > 0;
  const transactionExpenseFallback = !recurringExpenseLines.length && transactions.expenseLines.length > 0;
  const incomeIncomplete = !transactionIncomeFallback && (income.incompleteRecordIds.length > 0 || rental.excludedRecordIds.length > 0);
  const expenseIncomplete = !transactionExpenseFallback && (expenses.incompleteRecordIds.length > 0 || mortgages.excludedRecordIds.length > 0);
  const monthlyIncome = incomeLines.length && !incomeIncomplete ? incomeLines.reduce((sum, line) => sum + line.monthlyAmount, 0) : null;
  const monthlyExpenses = expenseLines.length && !expenseIncomplete ? expenseLines.reduce((sum, line) => sum + line.monthlyAmount, 0) : null;
  const monthlySurplus = monthlyIncome !== null && monthlyExpenses !== null ? monthlyIncome - monthlyExpenses : null;
  const usedTransactions = (!recurringIncomeLines.length && incomeLines.length > 0) || (!recurringExpenseLines.length && expenseLines.length > 0);
  const approximate = [...incomeLines, ...expenseLines].some((line) => line.approximate);
  const status: MonthlyCashFlowStatus = monthlySurplus === null ? "unavailable" : usedTransactions || approximate ? "estimated" : "confirmed";
  const cadenceExcludedRecordIds = [...income.excludedRecordIds, ...expenses.excludedRecordIds];
  const replacedRecordIds = [...income.replacedRecordIds, ...expenses.replacedRecordIds];
  const excludedRecordIds = [...new Set([...income.excludedRecordIds, ...expenses.excludedRecordIds, ...replacedRecordIds, ...rental.excludedRecordIds, ...mortgages.excludedRecordIds, ...transactions.excludedRecordIds])];
  const warnings = [
    ...(replacedRecordIds.length ? [`${replacedRecordIds.length} older overlapping recurring record${replacedRecordIds.length === 1 ? " was" : "s were"} excluded; only the latest current value for each household item is used.`] : []),
    ...(cadenceExcludedRecordIds.length ? [`${cadenceExcludedRecordIds.length} record${cadenceExcludedRecordIds.length === 1 ? " was" : "s were"} excluded because it is one-off or its monthly cadence could not be established.`] : []),
    ...(monthlyIncome === null ? ["Confirmed monthly income is unavailable."] : []),
    ...(monthlyExpenses === null ? ["Confirmed monthly expenses are unavailable."] : []),
    ...(rental.excludedRecordIds.length ? ["A property is marked as earning rent but has no confirmed rent amount and frequency."] : []),
    ...(mortgages.excludedRecordIds.length ? ["A confirmed mortgage has no usable repayment amount and frequency."] : []),
    ...(transactions.excludedRecordIds.length ? [`${transactions.excludedRecordIds.length} transfer, reimbursement, sale, refund or unclassified positive transaction${transactions.excludedRecordIds.length === 1 ? " was" : "s were"} excluded from cash flow.`] : []),
  ];
  const recordById = new Map(confirmed.map((record) => [record.id, record]));
  const propertyByEntityKey = new Map(confirmed.filter((record) => record.kind === "asset" && /property/i.test(`${record.subtype} ${record.label}`)).map((record) => [String(record.value.entityKey ?? ""), record]));
  const missingInputs: MonthlyCashFlowMissingInput[] = [
    ...rental.excludedRecordIds.map((recordId) => {
      const record = recordById.get(recordId);
      return { code: "rental-income" as const, recordId, title: `Add rent received for ${record?.label ?? "the rental property"}`, detail: "This property is marked as earning rent, but its amount and payment frequency were never saved.", href: `/financial-profile/add-data?category=property&propertyId=${encodeURIComponent(recordId)}` };
    }),
    ...mortgages.excludedRecordIds.map((recordId) => {
      const record = recordById.get(recordId);
      const property = propertyByEntityKey.get(String(record?.value.propertyEntityKey ?? ""));
      return { code: "mortgage-repayment" as const, recordId, title: `Add repayment details for ${record?.label ?? "the mortgage"}`, detail: "The mortgage balance is confirmed, but its repayment amount or frequency is missing.", href: property ? `/financial-profile/add-data?category=property&propertyId=${encodeURIComponent(property.id)}` : "/financial-profile/property" };
    }),
    ...income.incompleteRecordIds.map((recordId) => ({ code: "income-cadence" as const, recordId, title: `Add payment frequency for ${recordById.get(recordId)?.label ?? "income"}`, detail: "The income amount is confirmed but cannot be converted to a monthly value without its cadence.", href: "/cash-flow" })),
    ...expenses.incompleteRecordIds.map((recordId) => ({ code: "expense-cadence" as const, recordId, title: `Add payment frequency for ${recordById.get(recordId)?.label ?? "expense"}`, detail: "The expense amount is confirmed but cannot be converted to a monthly value without its cadence.", href: "/cash-flow" })),
    ...(monthlyIncome === null && !incomeIncomplete && !incomeLines.length ? [{ code: "income" as const, recordId: null, title: "Add confirmed monthly income", detail: "No confirmed recurring income or classified income transactions are available.", href: "/financial-vault" }] : []),
    ...(monthlyExpenses === null && !expenseIncomplete && !expenseLines.length ? [{ code: "expenses" as const, recordId: null, title: "Add confirmed monthly expenses", detail: "No confirmed recurring expenses or classified expense transactions are available.", href: "/financial-vault" }] : []),
  ];
  const sourceRecordIds = [...new Set([...incomeLines, ...expenseLines].flatMap((line) => line.sourceRecordIds))];
  const basis = status === "confirmed"
    ? "Current confirmed recurring income and expenses, converted to monthly equivalents. These are ongoing values, not transactions from one calendar month."
    : status === "estimated"
      ? usedTransactions
        ? `Estimated from confirmed records across ${transactions.months} observed transaction month${transactions.months === 1 ? "" : "s"}.`
        : "Current recurring values converted to monthly equivalents; at least one source is estimated. These are ongoing values, not one calendar month."
      : "Add confirmed income and expense records with a monthly amount or payment cadence.";

  return { monthlyIncome, monthlyExpenses, monthlySurplus, status, basis, incomeLines, expenseLines, sourceRecordIds, excludedRecordIds, warnings, missingInputs };
}
