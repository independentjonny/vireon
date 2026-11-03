import type { RetirementGoals } from "@/lib/retirementGoals";
import type { FinancialPositionReadModel } from "../server/services/financialPositionReadService";
import type { FinancialGoal } from "./goalPlanning";
import type { TrajectorySettings } from "./wealthTrajectory";
import { confirmedBalance, confirmedPositionSummary } from "@/lib/confirmedPositionSummary";
import { buildMonthlyCashFlowModel, monthlyDebtRepayment, monthlyRecurringAmount } from "@/lib/monthlyCashFlow";
import { emptyGoalFunding, type FundingFacts, type FundingPlan, type FundingGoal } from "@/lib/goalFundingModel";

const numeric = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string" || typeof value === "string" && !value.trim()) return null;
  const n = typeof value === "number" ? value : Number(value.replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
function eligibleFundingRecords(position: FinancialPositionReadModel) { return position.confirmedFacts.filter(record => record.userId === position.userId && record.provenance.userConfirmed && !record.superseded && !record.approximate && !position.staleDataSummary.staleRecordIds.includes(record.id)); }
export function confirmedFundingCashFlow(position: FinancialPositionReadModel) {
  const eligible = eligibleFundingRecords(position), ids = new Set(eligible.map(record => record.id));
  const flow = buildMonthlyCashFlowModel(eligible.filter(record => record.kind !== "transaction"), position.userId);
  const pending = position.confirmedFacts.filter(record => record.userId === position.userId && !record.superseded && !ids.has(record.id));
  if (pending.some(record => record.kind === "income")) flow.monthlyIncome = null;
  if (pending.some(record => record.kind === "expense" || record.kind === "liability")) flow.monthlyExpenses = null;
  flow.monthlySurplus = flow.monthlyIncome === null || flow.monthlyExpenses === null ? null : flow.monthlyIncome - flow.monthlyExpenses;
  if (flow.monthlySurplus === null) flow.status = "unavailable";
  if (flow.monthlyIncome === null && !flow.missingInputs.some(input => input.code === "income")) flow.missingInputs.push({ code: "income", recordId: null, title: "Confirm current income", detail: "Only current confirmed recurring records can establish income.", href: "/financial-profile/add-data?category=income" });
  if (flow.monthlyExpenses === null && !flow.missingInputs.some(input => input.code === "expenses")) flow.missingInputs.push({ code: "expenses", recordId: null, title: "Confirm current spending and repayments", detail: "Review missing, stale or estimated spending and loan records.", href: "/financial-profile/add-data?category=expenses" });
  return flow;
}
export function goalFundingFacts(position: FinancialPositionReadModel): FundingFacts {
  const eligible = eligibleFundingRecords(position), eligibleIds = new Set(eligible.map(record => record.id)), cashFlow = confirmedFundingCashFlow(position);
  const pending = position.confirmedFacts.filter(record => record.userId === position.userId && !record.superseded && !eligibleIds.has(record.id));
  const summary = confirmedPositionSummary(position);
  const accounts = eligible.filter(record => record.kind === "account" && !/super|investment|brokerage/i.test(record.subtype)).map(record => {
    const type = String(record.value.accountType ?? record.subtype).toLowerCase();
    const kind = /offset/.test(type) ? "offset" as const : /saving|cash|transaction|everyday|checking|bank/.test(type) ? "savings" as const : "unknown" as const;
    return { id: record.id, title: record.label, balance: confirmedBalance(record), kind,
      accessible: typeof record.value.accessible === "boolean" ? record.value.accessible : kind === "unknown" ? null : true,
      annualRate: numeric(record.value.interestRate ?? record.value.annualRate), loanId: typeof (record.value.linkedMortgageId ?? record.value.loanId) === "string" ? String(record.value.linkedMortgageId ?? record.value.loanId) : null,
      offsetPercent: numeric(record.value.offsetPercent ?? record.value.offsetPercentage) };
  });
  const loans = eligible.filter(record => record.kind === "liability").map(record => {
    const type = String(record.value.repaymentType ?? "").toLowerCase();
    return { id: record.id, title: record.label, isMortgage: /mortgage|home.?loan/i.test(`${record.subtype} ${record.label}`), balance: confirmedBalance(record), annualRate: numeric(record.value.interestRate ?? record.value.annualRate), monthlyPayment: monthlyDebtRepayment(record),
      repaymentType: /interest.only/.test(type) ? "interest-only" as const : /principal.*interest/.test(type) ? "principal-interest" as const : null,
      remainingMonths: numeric(record.value.remainingMonths ?? record.value.remainingTermMonths),
      paymentAccountId: typeof record.value.paymentAccountId === "string" ? record.value.paymentAccountId : null };
  });
  const accountTotal = accounts.some(account => account.balance === null) ? null : accounts.reduce((sum, account) => sum + account.balance!, 0);
  const loanTotal = loans.some(loan => loan.balance === null) ? null : loans.reduce((sum, loan) => sum + loan.balance!, 0);
  const expenses = cashFlow.expenseLines.filter(line => !["mortgage", "loan"].includes(line.category));
  const essentialRecords = eligible.filter(record => record.kind === "expense");
  const essentialsKnown = essentialRecords.length > 0 && essentialRecords.every(record => typeof record.value.essential === "boolean" && monthlyRecurringAmount(record) !== null);
  return { asOf: new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(position.generatedAt)), accounts, loans,
    otherAssets: summary.assets === null || accountTotal === null || pending.some(record => record.kind === "asset") || position.assets.filter(record => eligibleIds.has(record.id) && !accounts.some(account => account.id === record.id)).some(record => confirmedBalance(record) === null) ? null : summary.assets - accountTotal,
    otherLiabilities: summary.liabilities === null || loanTotal === null ? null : summary.liabilities - loanTotal,
    income: cashFlow.monthlyIncome === null ? null : cashFlow.incomeLines.filter(line => !line.sourceRecordIds.some(id => { const record = eligible.find(record => record.id === id); return record && /interest/i.test(`${record.subtype} ${String(record.value.incomeType ?? "")}`); })).reduce((sum, line) => sum + line.monthlyAmount, 0),
    confirmedMonthlySurplus: cashFlow.monthlySurplus,
    confirmedKnownNetPosition: summary.netPosition,
    inputWarnings: [...eligible.filter(record => record.kind === "liability" && (numeric(record.value.offsetBalance) ?? 0) > 0 && !accounts.some(account => account.loanId === record.id)).map(record => `${record.label}: recorded offset money needs its own confirmed account ID and mortgage linkage; it cannot be treated as redraw or inferred cash.`), ...pending.filter(record => record.kind === "account" || record.kind === "liability").map(record => `${record.label}: review its stale, estimated or unconfirmed starting balance before funding projections.`)],
    cashCoverageKnown: !pending.some(record => record.kind === "account"),
    livingExpenses: pending.some(record => record.kind === "expense") ? null : expenses.length ? expenses.reduce((sum, line) => sum + line.monthlyAmount, 0) : null,
    essentialExpenses: !pending.some(record => record.kind === "expense") && essentialsKnown ? essentialRecords.filter(record => record.value.essential).reduce((sum, record) => sum + monthlyRecurringAmount(record)!, 0) : null,
    // Only explicitly scheduled transactions excluded from recurring aggregates are safe to add.
    transactions: eligible.filter(record => record.kind === "transaction" && record.value.scheduled === true && record.value.excludedFromRecurring === true).flatMap(record => {
      const date = typeof record.value.date === "string" ? record.value.date.slice(0, 10) : "", amount = numeric(record.value.amount);
      if (!date || amount === null || typeof record.value.accountId !== "string" || !["income", "expense", "transfer"].includes(String(record.value.type))) return [];
      return [{ id: record.id, date, accountId: record.value.accountId, amount: Math.abs(amount), type: record.value.type as "income" | "expense" | "transfer", destinationId: typeof record.value.destinationAccountId === "string" ? record.value.destinationAccountId : undefined }];
    }) };
}
export function fundingGoalFromSaved(goal: FinancialGoal): FundingGoal {
  return { id: goal.id, title: goal.title, cost: goal.targetAmount, paymentDate: goal.targetDate?.slice(0, 10) ?? null, priority: goal.priority,
    funding: goal.funding ?? emptyGoalFunding() };
}
export function initialFundingPlan(facts: FundingFacts, goals: FinancialGoal[], trajectory: TrajectorySettings | null, retirement?: RetirementGoals | null): FundingPlan {
  const activeGoals = goals.filter(goal => !["ARCHIVED", "PAUSED", "DRAFT", "ACHIEVED"].includes(goal.status));
  const retirementDate = activeGoals.find(goal => goal.type === "RETIREMENT" && goal.targetDate)?.targetDate?.slice(0, 10) ?? null;
  return { goals: activeGoals.filter(goal => goal.type !== "RETIREMENT" || goal.funding).map(fundingGoalFromSaved), assumptions: {
    minimumEmergency: null, income: facts.income, livingExpenses: facts.livingExpenses, essentialExpenses: facts.essentialExpenses,
    settlementAccountId: null, inflation: trajectory?.inflation ?? null, assetGrowth: trajectory?.base ?? null,
    retirementDate: retirement?.retirementDate ?? retirementDate, alreadyRetired: retirement ? retirement.retirementDate <= facts.asOf : null,
    retirementReviewDate: null, retirementIncome: retirement?.monthlyIncome ?? null, retirementSpending: retirement?.monthlyExpenses ?? null, retirementEssential: null, accounts: {}, loans: {},
  } };
}
