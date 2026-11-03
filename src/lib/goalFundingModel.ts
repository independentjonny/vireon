import { addControlMonths, controlDate } from "@/lib/controlCentreProjection";

export const FUNDING_MODEL_VERSION = "goal-funding-v1";
export const FUNDING_HORIZON_MONTHS = 720;
const DAY = 86_400_000;
export function fundingPeriodRange(start: string, end: string) {
  const from = controlDate(start), to = controlDate(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return { days: 0, wholeMonths: 0, extraDays: 0 };
  const s = new Date(from), e = new Date(to);
  let wholeMonths = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + e.getUTCMonth() - s.getUTCMonth();
  if (controlDate(addControlMonths(start, wholeMonths)) > to) wholeMonths--;
  return { days: Math.round((to - from) / DAY), wholeMonths, extraDays: Math.round((to - controlDate(addControlMonths(start, wholeMonths))) / DAY) };
}
const PRIORITY = { critical: 0, high: 1, medium: 2, low: 3 } as const;
export type FundingAccount = { id: string; title: string; balance: number | null; kind: "savings" | "offset" | "unknown"; accessible: boolean | null; annualRate: number | null; loanId: string | null; offsetPercent: number | null };
export type FundingLoan = { id: string; title: string; isMortgage: boolean; balance: number | null; annualRate: number | null; monthlyPayment: number | null; repaymentType: "principal-interest" | "interest-only" | null; remainingMonths: number | null; paymentAccountId: string | null };
export type FundingFacts = { asOf: string; accounts: FundingAccount[]; loans: FundingLoan[]; otherAssets: number | null; otherLiabilities: number | null; income: number | null; livingExpenses: number | null; essentialExpenses: number | null; cashCoverageKnown?: boolean; confirmedKnownNetPosition?: number | null; confirmedMonthlySurplus?: number | null; inputWarnings?: string[]; transactions: Array<{ id: string; date: string; accountId: string; amount: number; type: "income" | "expense" | "transfer"; destinationId?: string }> };
export type GoalFunding = { sources: Array<{ accountId: string; amount: number }>; surplus: { amount: number; monthly: number; useAllSurplus?: boolean; accountId: string | null; startDate: string | null }; replenish: { monthly: number; accountId: string | null; startDate: string | null } | null };
export type FundingGoal = { id: string; title: string; cost: number; paymentDate: string | null; priority: keyof typeof PRIORITY; funding: GoalFunding };
export type FundingAssumptions = {
  minimumEmergency: number | null; income: number | null; livingExpenses: number | null; essentialExpenses: number | null;
  settlementAccountId: string | null; inflation: number | null; assetGrowth: number | null;
  retirementDate: string | null; alreadyRetired: boolean | null; retirementReviewDate: string | null;
  retirementIncome: number | null; retirementSpending: number | null; retirementEssential: number | null;
  accounts: Record<string, Partial<Omit<FundingAccount, "id" | "title" | "balance">>>;
  loans: Record<string, Partial<Omit<FundingLoan, "id" | "title" | "balance" | "isMortgage">>>;
};
export type FundingPlan = { goals: FundingGoal[]; assumptions: FundingAssumptions };
export type FundingMetric = { netPosition: number | null; monthlySurplus: number | null; cash: number | null; availableCash: number | null; commitments: number | null; cashBuffer: number | null; essentialExpenses: number | null; mortgageBalance: number | null; mortgageInterest: number | null; savingsInterest: number | null; accounts: Array<{ id: string; title: string; balance: number | null; committed: number | null; available: number | null }> };
export type FundingAssessment = { id: string; title: string; date: string | null; cost: number; instructionShortfall: number; funded: number | null; shortfall: number | null; paid: boolean; replenishmentShortfall: number | null };
export type FundingEvent = { date: string; type: "goal" | "retirement" | "payoff" | "emergency"; title: string };
export type FundingRun = { points: Array<{ date: string; value: FundingMetric }>; selected: FundingMetric; retirement: FundingMetric; start: FundingMetric; goals: FundingAssessment[]; missing: string[]; events: FundingEvent[]; payoffDates: Record<string, string | null>; feasibleDates: Record<string, string | null>; lowest: { date: string; amount: number } | null; emergencyDays: number | null };
export type FundingComparison = { today: FundingMetric; current: FundingRun; proposed: FundingRun; selectedDifference: FundingMetric; retirementDifference: FundingMetric; summary: string[]; differences: { interest: number | null; savingsInterest: number | null; loanBalance: number | null; retirementNet: number | null; retirementSurplus: number | null }; retirementDate: string | null };
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const all = (values: Array<number | null>) => values.some(v => v === null) ? null : cents(values.reduce<number>((s, n) => s + n!, 0));
const delta = (a: number | null, b: number | null) => a === null || b === null ? null : cents(a - b);
const money = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
export function fundingGoalOrder(a: FundingGoal, b: FundingGoal) { return PRIORITY[a.priority] - PRIORITY[b.priority] || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1); }
export function emptyGoalFunding(): GoalFunding { return { sources: [], surplus: { amount: 0, monthly: 0, accountId: null, startDate: null }, replenish: null }; }
export function validateFundingPlan(plan: FundingPlan, facts: FundingFacts) {
  const keys = (object: object, allowed: string[]) => { if (!object || typeof object !== "object" || Array.isArray(object) || Object.keys(object).some(key => !allowed.includes(key))) throw new Error("Unsupported plan fields; confirmed facts and ownership cannot be changed here."); };
  if (!plan || !Array.isArray(plan.goals) || !plan.assumptions || plan.goals.length > 100) throw new Error("Enter a plan with at most 100 goals.");
  keys(plan, ["goals", "assumptions"]);
  keys(plan.assumptions, ["minimumEmergency", "income", "livingExpenses", "essentialExpenses", "settlementAccountId", "inflation", "assetGrowth", "retirementDate", "alreadyRetired", "retirementReviewDate", "retirementIncome", "retirementSpending", "retirementEssential", "accounts", "loans"]);
  const ids = new Set<string>(), accountIds = new Set(facts.accounts.map(a => a.id)), loanIds = new Set(facts.loans.map(l => l.id));
  const amount = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e10;
  const moneyAmount = (n: number) => amount(n) && Math.abs(n * 100 - Math.round(n * 100)) <= Number.EPSILON * Math.max(1, Math.abs(n * 100)) * 4;
  const date = (s: unknown) => s === null || typeof s === "string" && Number.isFinite(controlDate(s));
  for (const g of plan.goals) {
    if (!g || typeof g.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,159}$/.test(g.id) || ["constructor", "prototype"].includes(g.id) || ids.has(g.id) || typeof g.title !== "string" || !g.title.trim() || g.title.length > 160 || !amount(g.cost) || !Object.hasOwn(PRIORITY, g.priority) || !date(g.paymentDate)) throw new Error("Check goal titles, amounts, dates and priorities.");
    if (!moneyAmount(g.cost)) throw new Error("Goal costs and funding amounts must use whole cents.");
    keys(g, ["id", "title", "cost", "paymentDate", "priority", "funding"]);
    ids.add(g.id);
    if (!g.funding || !Array.isArray(g.funding.sources) || !g.funding.surplus) throw new Error("Goal funding instructions are required.");
    keys(g.funding, ["sources", "surplus", "replenish"]);
    keys(g.funding.surplus, ["amount", "monthly", "useAllSurplus", "accountId", "startDate"]);
    if (g.funding.replenish) keys(g.funding.replenish, ["monthly", "accountId", "startDate"]);
    const sources = new Set<string>();
    for (const s of g.funding.sources) { keys(s, ["accountId", "amount"]); if (!accountIds.has(s.accountId) || sources.has(s.accountId) || !moneyAmount(s.amount)) throw new Error("Choose distinct workspace accounts and funding amounts in whole cents."); sources.add(s.accountId); }
    const s = g.funding.surplus;
    if (s.useAllSurplus !== undefined && typeof s.useAllSurplus !== "boolean") throw new Error("Confirm the future-surplus allocation mode.");
    if (![s.amount, s.monthly].every(moneyAmount) || !date(s.startDate) || s.accountId !== null && !accountIds.has(s.accountId)) throw new Error("Check surplus funding amounts in whole cents and its destination account.");
    if (cents(g.funding.sources.reduce((sum, source) => sum + source.amount, s.amount)) > cents(g.cost)) throw new Error("Funding instructions exceed the goal cost. Reduce the funding split.");
    const r = g.funding.replenish;
    if (r && (!moneyAmount(r.monthly) || !date(r.startDate) || r.accountId !== null && !accountIds.has(r.accountId) || r.startDate && g.paymentDate && r.startDate <= g.paymentDate)) throw new Error("Replenishment must use whole cents, start after payment, and use a valid account.");
  }
  const a = plan.assumptions;
  for (const key of ["minimumEmergency", "income", "livingExpenses", "essentialExpenses", "retirementIncome", "retirementSpending", "retirementEssential"] as const) if (a[key] !== null && !amount(a[key])) throw new Error("Assumed amounts must be finite, non-negative, and at most $10 billion.");
  for (const key of ["retirementDate", "retirementReviewDate"] as const) if (!date(a[key])) throw new Error("Choose a valid retirement or review date.");
  if (a.alreadyRetired !== null && typeof a.alreadyRetired !== "boolean") throw new Error("Confirm your retirement state.");
  if (a.inflation !== null && (!Number.isFinite(a.inflation) || a.inflation < 0 || a.inflation > 25) || a.assetGrowth !== null && (!Number.isFinite(a.assetGrowth) || a.assetGrowth < -50 || a.assetGrowth > 50)) throw new Error("Inflation must be 0–25% and asset growth −50–50%.");
  if (a.essentialExpenses !== null && a.livingExpenses !== null && a.essentialExpenses > a.livingExpenses || a.retirementEssential !== null && a.retirementSpending !== null && a.retirementEssential > a.retirementSpending) throw new Error("Essential living expenses cannot exceed total living expenses.");
  if (a.settlementAccountId !== null && !accountIds.has(a.settlementAccountId)) throw new Error("Choose a workspace account for surplus.");
  for (const [id, overrides] of Object.entries(a.accounts)) {
    if (!accountIds.has(id) || Object.keys(overrides).some(k => !["kind", "accessible", "annualRate", "loanId", "offsetPercent"].includes(k))) throw new Error("Invalid account assumptions.");
    if (overrides.annualRate != null && (!Number.isFinite(overrides.annualRate) || overrides.annualRate < 0 || overrides.annualRate > 50) || overrides.offsetPercent != null && (!Number.isFinite(overrides.offsetPercent) || overrides.offsetPercent < 0 || overrides.offsetPercent > 100) || overrides.loanId != null && !loanIds.has(overrides.loanId) || "kind" in overrides && !["savings", "offset", "unknown"].includes(overrides.kind!) || overrides.accessible != null && typeof overrides.accessible !== "boolean") throw new Error("Check account rates and offset linkage.");
  }
  for (const [id, overrides] of Object.entries(a.loans)) {
    if (!loanIds.has(id) || Object.keys(overrides).some(k => !["annualRate", "monthlyPayment", "repaymentType", "remainingMonths", "paymentAccountId"].includes(k))) throw new Error("Invalid loan assumptions.");
    if (overrides.annualRate != null && (!amount(overrides.annualRate) || overrides.annualRate > 50) || overrides.monthlyPayment != null && !amount(overrides.monthlyPayment) || overrides.remainingMonths != null && (!Number.isInteger(overrides.remainingMonths) || overrides.remainingMonths < 1 || overrides.remainingMonths > 720) || overrides.paymentAccountId != null && !accountIds.has(overrides.paymentAccountId) || overrides.repaymentType != null && !["principal-interest", "interest-only"].includes(overrides.repaymentType)) throw new Error("Check loan rate, scheduled repayment, type and remaining term.");
  }
}

function resolved(facts: FundingFacts, a: FundingAssumptions) { return { accounts: facts.accounts.map(account => ({ ...account, ...a.accounts[account.id] })), loans: facts.loans.map(loan => ({ ...loan, ...a.loans[loan.id] })) }; }
function unavailable(): FundingMetric { return { netPosition: null, monthlySurplus: null, cash: null, availableCash: null, commitments: null, cashBuffer: null, essentialExpenses: null, mortgageBalance: null, mortgageInterest: null, savingsInterest: null, accounts: [] }; }
export function emptyFundingMetric(): FundingMetric { return unavailable(); }

/** Daily event ledger. Monthly net cash flow/contributions accrue evenly; loan payments remain scheduled. */
export function runFundingPlan(facts: FundingFacts, plan: FundingPlan, period: { start: string; end: string }, forecastEnd?: string): FundingRun {
  validateFundingPlan(plan, facts);
  const origin = controlDate(facts.asOf), start = controlDate(period.start), end = controlDate(period.end), max = controlDate(addControlMonths(facts.asOf, FUNDING_HORIZON_MONTHS));
  if (![origin, start, end].every(Number.isFinite) || start < origin || end < start || end > max) throw new Error("Select a period from today to 60 years ahead, with end on or after start.");
  const a = plan.assumptions, data = resolved(facts, a), goals = [...plan.goals].sort(fundingGoalOrder);
  const retirementDate = a.alreadyRetired ? a.retirementReviewDate : a.retirementDate;
  const retirementTime = a.alreadyRetired ? origin : a.retirementDate ? controlDate(a.retirementDate) : Infinity;
  const retirePoint = retirementDate ? controlDate(retirementDate) : NaN;
  const until = Math.min(max, Math.max(end, Number.isFinite(retirePoint) ? retirePoint : end, forecastEnd ? controlDate(forecastEnd) : end));
  const missing: string[] = [...(facts.inputWarnings ?? [])];
  if (facts.otherLiabilities === null) missing.push("Confirm all debt balances, including an explicit zero if there is no debt.");
  if (!data.accounts.length) missing.push("Add confirmed savings or offset account balances.");
  for (const account of data.accounts) {
    if (account.balance === null) missing.push(`${account.title}: confirm balance.`);
    if (account.balance !== null && account.balance < 0) missing.push(`${account.title}: an overdrawn starting balance needs debt/fee inputs outside this savings/offset release.`);
    if (account.accessible === null || account.kind === "unknown") missing.push(`${account.title}: confirm account type and accessibility.`);
    if (account.annualRate === null || account.annualRate < 0 || account.annualRate > 50) missing.push(`${account.title}: enter account interest rate from 0% to 50%, including an explicit 0%.`);
    if (account.kind === "offset" && (!data.loans.some(loan => loan.id === account.loanId && loan.isMortgage) || account.offsetPercent === null || account.offsetPercent < 0 || account.offsetPercent > 100)) missing.push(`${account.title}: select a valid linked mortgage and offset percentage from 0% to 100%.`);
  }
  for (const loan of data.loans.filter(l => l.balance !== 0)) if (loan.balance === null || loan.balance < 0 || loan.annualRate === null || loan.annualRate < 0 || loan.annualRate > 50 || loan.monthlyPayment === null || !loan.repaymentType || !loan.remainingMonths || !Number.isInteger(loan.remainingMonths) || loan.remainingMonths > 720 || !loan.paymentAccountId) missing.push(`${loan.title}: confirm non-negative balance, rate (0–50%), repayment amount/type, remaining term (1–720 months) and payment account.`);
  if (a.income === null || a.livingExpenses === null || a.inflation === null || !a.settlementAccountId) missing.push("Enter regular income, living expenses, inflation and the surplus account.");
  if (a.alreadyRetired === null) missing.push("Confirm whether you are already retired.");
  if (a.alreadyRetired === false && a.retirementDate && retirementTime < origin) missing.push("Retirement is in the past: confirm already retired and choose a future review date.");
  if (retirementDate && (retirePoint < origin || retirePoint > max)) missing.push("Choose a retirement/review date within the supported future horizon.");
  for (const g of goals) {
    if (!g.paymentDate) missing.push(`${g.title}: enter one payment date.`);
    else if (controlDate(g.paymentDate) < origin || controlDate(g.paymentDate) > max) missing.push(`${g.title}: payment date must be within the future horizon.`);
    if (g.funding.surplus.amount > 0 && (!g.funding.surplus.accountId || !g.funding.surplus.startDate)) missing.push(`${g.title}: choose a surplus destination and start date.`);
    if (g.funding.replenish?.monthly && (!g.funding.replenish.accountId || !g.funding.replenish.startDate)) missing.push(`${g.title}: choose replenishment destination and start date.`);
    for (const id of [...g.funding.sources.map(s => s.accountId), g.funding.surplus.accountId, g.funding.replenish?.accountId].filter(Boolean)) if (!data.accounts.find(account => account.id === id && account.accessible === true && account.kind !== "unknown")) missing.push(`${g.title}: funding requires accessible savings or linked offset accounts.`);
  }
  if (a.settlementAccountId && !data.accounts.find(account => account.id === a.settlementAccountId && account.accessible === true)) missing.push("The surplus account must be accessible.");
  for (const loan of data.loans) if (loan.paymentAccountId && !data.accounts.find(account => account.id === loan.paymentAccountId && account.accessible === true)) missing.push(`${loan.title}: payment account must be accessible.`);
  const balances = Object.fromEntries(data.accounts.map(account => [account.id, account.balance ?? 0]));
  const principal = Object.fromEntries(data.loans.map(loan => [loan.id, loan.balance ?? 0]));
  const accrued = Object.fromEntries(data.loans.map(loan => [loan.id, 0]));
  const contributed = Object.fromEntries(goals.map(g => [g.id, 0]));
  const restored = Object.fromEntries(goals.map(g => [g.id, 0]));
  const replenishmentDue = Object.fromEntries(goals.map(g => [g.id, 0]));
  const assessments: Record<string, FundingAssessment> = Object.fromEntries(goals.map(g => [g.id, { id: g.id, title: g.title, date: g.paymentDate, cost: g.cost, instructionShortfall: Math.max(0, cents(g.cost - g.funding.surplus.amount - g.funding.sources.reduce((sum, source) => sum + source.amount, 0))), funded: null, shortfall: null, paid: false, replenishmentShortfall: null }]));
  const locks: Record<string, Record<string, number>> = {};
  function reserve() {
    const used: Record<string, number> = {};
    for (const goal of goals) {
      locks[goal.id] = {};
      if (assessments[goal.id].paid) continue;
      const entries = [...goal.funding.sources, ...(goal.funding.surplus.accountId ? [{ accountId: goal.funding.surplus.accountId, amount: contributed[goal.id] }] : [])];
      for (const s of entries) { const amount = Math.min(s.amount, Math.max(0, balances[s.accountId] - (used[s.accountId] ?? 0))); used[s.accountId] = (used[s.accountId] ?? 0) + amount; locks[goal.id][s.accountId] = (locks[goal.id][s.accountId] ?? 0) + amount; }
    }
    return used;
  }
  let otherAssets = facts.otherAssets, mortgageInterest = 0, savingsInterest = 0, emergencyDays = 0;
  let lowest: FundingRun["lowest"] = null, wasBreached = false, periodKnown = true;
  const events: FundingEvent[] = [], points: FundingRun["points"] = [], payoffDates: Record<string, string | null> = Object.fromEntries(data.loans.map(l => [l.id, null]));
  const feasibleDates: Record<string, string | null> = Object.fromEntries(goals.map(g => [g.id, null]));
  let cashKnown = missing.length === 0;
  function offsetRelief(loanId: string) { return Math.min(principal[loanId], data.accounts.filter(account => account.kind === "offset" && account.loanId === loanId).reduce((sum, account) => sum + Math.max(0, balances[account.id]) * account.offsetPercent! / 100, 0)); }
  function flow(time: number) {
    const retired = time >= retirementTime, factor = a.inflation === null ? null : Math.pow(1 + a.inflation / 100, (time - origin) / DAY / 365);
    const income = retired ? a.retirementIncome === null || factor === null ? null : a.retirementIncome * factor : a.income;
    const living = retired ? a.retirementSpending : a.livingExpenses, essential = retired ? a.retirementEssential : a.essentialExpenses;
    const payments = all(data.loans.map(l => principal[l.id] <= 0 ? 0 : l.repaymentType === "interest-only" && l.annualRate !== null && l.monthlyPayment !== null ? Math.min(l.monthlyPayment, Math.max(0, principal[l.id] - offsetRelief(l.id)) * l.annualRate / 100 / 12) : l.monthlyPayment));
    const spending = living === null || factor === null || payments === null ? null : living * factor + payments;
    const interestIncome = data.accounts.reduce((sum, account) => sum + Math.max(0, balances[account.id]) * (account.annualRate ?? 0) / 100 / 12, 0);
    return { interestIncome, surplus: income === null || spending === null ? null : income + interestIncome - spending, essential: essential === null || factor === null || payments === null ? null : essential * factor + payments,
      nonLoanSurplus: income === null || living === null || factor === null ? null : income - living * factor };
  }
  function metric(time: number): FundingMetric {
    const used = reserve(), f = flow(time);
    const accountRows = data.accounts.map(account => ({ id: account.id, title: account.title, balance: cashKnown ? cents(balances[account.id]) : null, committed: cashKnown ? cents(used[account.id] ?? 0) : null, available: cashKnown ? cents(balances[account.id] - (used[account.id] ?? 0)) : null }));
    const cash = cashKnown ? all(data.accounts.filter(account => account.accessible).map(account => balances[account.id])) : null;
    const commitments = cashKnown ? cents(Object.values(used).reduce((sum, n) => sum + n, 0)) : null;
    const debt = all(data.loans.map(loan => loan.balance === null ? null : principal[loan.id] + accrued[loan.id]));
    const mortgageDebt = all(data.loans.filter(loan => loan.isMortgage).map(loan => loan.balance === null ? null : principal[loan.id] + accrued[loan.id]));
    const availableCash = delta(cash, commitments);
    return { cash, commitments, availableCash, cashBuffer: availableCash === null || f.essential === null || f.essential <= 0 ? null : availableCash / f.essential,
      essentialExpenses: f.essential, netPosition: !cashKnown || otherAssets === null || facts.otherLiabilities === null || debt === null ? null : cents(otherAssets + Object.values(balances).reduce((sum, n) => sum + n, 0) - debt - facts.otherLiabilities),
      monthlySurplus: cashKnown ? f.surplus === null ? null : cents(f.surplus) : null, mortgageBalance: cashKnown ? mortgageDebt : null, mortgageInterest: cashKnown ? cents(mortgageInterest) : null, savingsInterest: cashKnown ? cents(savingsInterest) : null, accounts: accountRows };
  }
  if (!cashKnown) {
    const empty = unavailable();
    return { points: [{ date: period.start, value: empty }, { date: period.end, value: empty }], selected: empty, start: empty, retirement: empty, goals: Object.values(assessments), missing: [...new Set(missing)], events, payoffDates, feasibleDates, lowest, emergencyDays: null };
  }
  const captured: Record<string, FundingMetric> = {};
  for (let time = origin; time <= until; time += DAY) {
    const date = new Date(time).toISOString().slice(0, 10);
    const months = (new Date(time).getUTCFullYear() - new Date(origin).getUTCFullYear()) * 12 + new Date(time).getUTCMonth() - new Date(origin).getUTCMonth();
    const paymentDay = months > 0 && date === addControlMonths(facts.asOf, months);
    let maturityReached = false;
    if (time === retirementTime) events.push({ date, type: "retirement", title: "Retirement income and spending start" });
    for (const tx of facts.transactions.filter(tx => tx.date === date && time > origin)) {
      if (!(tx.accountId in balances) || tx.type === "transfer" && (!tx.destinationId || !(tx.destinationId in balances))) { cashKnown = false; missing.push(`Transaction ${tx.id}: link its owned accounts.`); continue; }
      if (tx.type === "transfer") { if (balances[tx.accountId] < tx.amount || !data.accounts.find(account => account.id === tx.accountId)?.accessible) { cashKnown = false; missing.push(`Transfer ${tx.id}: insufficient accessible source funds; no borrowing or partial transfer is assumed.`); } else { balances[tx.accountId] -= tx.amount; balances[tx.destinationId!] += tx.amount; } }
      else balances[tx.accountId] += tx.type === "income" ? tx.amount : -tx.amount;
    }
    if (paymentDay && cashKnown) for (const loan of data.loans) {
      if (principal[loan.id] <= 0 && accrued[loan.id] <= 0) continue;
      const scheduled = loan.monthlyPayment!;
      const requiredPayment = loan.repaymentType === "interest-only" ? Math.min(scheduled, accrued[loan.id]) : Math.min(scheduled, principal[loan.id] + accrued[loan.id]);
      const payment = Math.min(requiredPayment, Math.max(0, balances[loan.paymentAccountId!]));
      if (payment < requiredPayment - 0.005) { maturityReached = true; missing.push(`${loan.title}: ${money(requiredPayment - payment)} scheduled repayment funding shortfall on ${date}; later arrears terms are unavailable.`); }
      balances[loan.paymentAccountId!] -= payment;
      const principalPaid = Math.max(0, payment - accrued[loan.id]);
      if (payment < accrued[loan.id] - 0.005) { maturityReached = true; missing.push(`${loan.title}: scheduled repayment does not cover accrued interest; later arrears terms are unavailable.`); }
      principal[loan.id] = cents(Math.max(0, principal[loan.id] - principalPaid) + Math.max(0, accrued[loan.id] - payment)); accrued[loan.id] = 0;
      if (principal[loan.id] <= 0) { payoffDates[loan.id] = date; events.push({ date, type: "payoff", title: `${loan.title} paid off` }); }
      else if (months >= loan.remainingMonths!) { maturityReached = true; missing.push(`${loan.title}: balance remains at term end ${date}; future maturity funding is unavailable.`); }
    }
    reserve();
    for (const goal of goals) if (cashKnown && !feasibleDates[goal.id] && Object.values(locks[goal.id]).reduce((sum, n) => sum + n, 0) >= goal.cost - 0.005) feasibleDates[goal.id] = date;
    for (const goal of goals.filter(g => g.paymentDate === date)) {
      if (!cashKnown) { events.push({ date, type: "goal", title: `${goal.title}: payment assessment unavailable` }); continue; }
      const funded = cents(Object.values(locks[goal.id]).reduce((sum, n) => sum + n, 0)), assessment = assessments[goal.id];
      assessment.funded = funded; assessment.shortfall = Math.max(0, cents(goal.cost - funded));
      if (assessment.shortfall <= 0 && cashKnown) { for (const [id, amount] of Object.entries(locks[goal.id])) balances[id] -= amount; assessment.paid = true; }
      events.push({ date, type: "goal", title: `${goal.title}: ${assessment.paid ? "paid as spending" : `${money(assessment.shortfall)} shortfall; not paid`}` });
      reserve();
    }
    const value = metric(time);
    if (time >= start && time <= end && value.availableCash === null) periodKnown = false;
    if (date === period.start || date === period.end || date === retirementDate) captured[date] = value;
    if (time >= start && time <= end && value.availableCash !== null) {
      if (!lowest || value.availableCash < lowest.amount) lowest = { date, amount: value.availableCash };
      const breach = a.minimumEmergency !== null && value.availableCash < a.minimumEmergency;
      if (breach && time < end) emergencyDays++;
      if (breach && !wasBreached) events.push({ date, type: "emergency", title: "Available cash falls below your emergency minimum" });
      wasBreached = breach;
    }
    if (paymentDay || time === origin || time === start || time === end || date === retirementDate || events.some(event => event.date === date)) points.push({ date, value });
    if (time === until) break;
    if (maturityReached) { cashKnown = false; continue; }
    const f = flow(time);
    if (f.nonLoanSurplus === null && cashKnown) { cashKnown = false; missing.push("Enter retirement income and spending to project beyond retirement."); }
    if (cashKnown) {
      const currentDate = new Date(time), monthDays = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0)).getUTCDate();
      const dailySurplus = f.nonLoanSurplus! / monthDays;
      balances[a.settlementAccountId!] += dailySurplus;
      let interestEarnedToday = 0;
      for (const account of data.accounts) { const interest = Math.max(0, balances[account.id]) * account.annualRate! / 100 / 365; balances[account.id] += interest; savingsInterest += interest; interestEarnedToday += interest; }
      for (const loan of data.loans) {
        const relief = offsetRelief(loan.id);
        const interest = Math.max(0, principal[loan.id] - relief) * loan.annualRate! / 100 / 365;
        accrued[loan.id] += interest; if (loan.isMortgage) mortgageInterest += interest;
      }
      // Only net surplus after scheduled repayments is available for new allocations.
      let budget = Math.max(0, ((f.surplus ?? 0) - f.interestIncome) / monthDays + interestEarnedToday);
      const used = reserve();
      for (const goal of goals) {
        const s = goal.funding.surplus;
        if (!assessments[goal.id].paid && goal.paymentDate && date < goal.paymentDate && s.startDate && date >= s.startDate && s.accountId) {
          const amount = Math.min(Math.max(0, s.amount - contributed[goal.id]), s.useAllSurplus ? budget : s.monthly / monthDays, budget, Math.max(0, balances[a.settlementAccountId!] - (used[a.settlementAccountId!] ?? 0)));
          balances[a.settlementAccountId!] -= amount; balances[s.accountId] += amount; contributed[goal.id] += amount; budget -= amount;
          used[s.accountId] = (used[s.accountId] ?? 0) + amount;
        }
        const r = goal.funding.replenish;
        if (assessments[goal.id].paid && r?.startDate && date >= r.startDate && r.accountId) {
          const target = goal.funding.sources.reduce((sum, source) => sum + source.amount, 0), request = Math.min(Math.max(0, target - restored[goal.id]), r.monthly / monthDays);
          replenishmentDue[goal.id] = Math.min(target, replenishmentDue[goal.id] + r.monthly / monthDays);
          const amount = Math.min(request, budget, Math.max(0, balances[a.settlementAccountId!] - (used[a.settlementAccountId!] ?? 0)));
          balances[a.settlementAccountId!] -= amount; balances[r.accountId] += amount; restored[goal.id] += amount; budget -= amount;
          if (time < end) assessments[goal.id].replenishmentShortfall = cents(Math.max(0, replenishmentDue[goal.id] - restored[goal.id]));
        }
      }
    }
    if (otherAssets !== null && otherAssets !== 0) otherAssets = a.assetGrowth === null ? null : otherAssets * Math.pow(1 + a.assetGrowth / 100, 1 / 365);
  }
  for (const goal of goals) if (assessments[goal.id].funded === null && goal.paymentDate && controlDate(goal.paymentDate) > until) { assessments[goal.id].funded = null; }
  if (a.essentialExpenses === null) missing.push("Enter essential living expenses to calculate cash buffer; missing is not zero.");
  if (facts.otherAssets === null) missing.push("Confirm non-cash asset balances to calculate future net position.");
  if (a.assetGrowth === null && facts.otherAssets !== 0) missing.push("Enter non-cash asset growth to calculate future net position; other funded cash-flow results remain separate.");
  if (a.minimumEmergency === null) missing.push("Enter your minimum emergency cash balance to assess breaches.");
  if (!retirementDate) missing.push(a.alreadyRetired ? "Choose a future retirement-review date." : "Enter your saved retirement date.");
  if (a.retirementIncome === null || a.retirementSpending === null || a.retirementEssential === null) missing.push("Complete retirement income, living spending and essential spending.");
  return { points, selected: captured[period.end] ?? unavailable(), start: captured[period.start] ?? unavailable(), retirement: retirementDate ? captured[retirementDate] ?? unavailable() : unavailable(), goals: Object.values(assessments), missing: [...new Set(missing)], events, payoffDates, feasibleDates, lowest: periodKnown ? lowest : null, emergencyDays: a.minimumEmergency === null || !periodKnown ? null : emergencyDays };
}

export function confirmedFundingToday(facts: FundingFacts, currentPlan: FundingPlan): FundingMetric {
  // Today is confirmed balances, with only saved reservations. Never execute a payment against facts.
  const data = { accounts: facts.accounts, loans: facts.loans }, today = unavailable();
  const balances = data.accounts.map(account => account.balance), cash = facts.cashCoverageKnown === false || !data.accounts.length || data.accounts.some(account => account.accessible === null) ? null : all(data.accounts.filter(account => account.accessible).map(account => account.balance));
  const committedByAccount: Record<string, number> = {};
  const reservationsKnown = currentPlan.goals.every(goal => goal.funding.sources.every(source => source.amount === 0 || data.accounts.some(account => account.id === source.accountId && account.balance !== null && account.accessible === true)));
  for (const goal of [...currentPlan.goals].sort(fundingGoalOrder)) for (const source of goal.funding.sources) { const balance = data.accounts.find(account => account.id === source.accountId)?.balance; if (balance !== null && balance !== undefined) committedByAccount[source.accountId] = (committedByAccount[source.accountId] ?? 0) + Math.min(source.amount, Math.max(0, balance - (committedByAccount[source.accountId] ?? 0))); }
  const totalLoans = all(data.loans.map(l => l.balance)), payments = all(data.loans.map(l => l.balance === 0 ? 0 : l.monthlyPayment));
  today.cash = cash; today.commitments = reservationsKnown ? cents(Object.values(committedByAccount).reduce((sum, n) => sum + n, 0)) : null; today.availableCash = delta(cash, today.commitments);
  today.netPosition = facts.confirmedKnownNetPosition !== undefined ? facts.confirmedKnownNetPosition : all([facts.otherAssets, all(balances), totalLoans === null ? null : -totalLoans, facts.otherLiabilities === null ? null : -facts.otherLiabilities]);
  // Today uses confirmed income/expenses only, never edited scenario assumptions.
  today.monthlySurplus = facts.confirmedMonthlySurplus !== undefined ? facts.confirmedMonthlySurplus : facts.income === null || facts.livingExpenses === null || payments === null ? null : cents(facts.income - facts.livingExpenses - payments);
  today.essentialExpenses = facts.essentialExpenses === null || payments === null ? null : facts.essentialExpenses + payments;
  today.cashBuffer = today.availableCash === null || today.essentialExpenses === null || today.essentialExpenses <= 0 ? null : today.availableCash / today.essentialExpenses;
  today.accounts = data.accounts.map(account => ({ id: account.id, title: account.title, balance: account.balance, committed: account.balance === null ? null : committedByAccount[account.id] ?? 0, available: account.balance === null ? null : cents(account.balance - (committedByAccount[account.id] ?? 0)) }));
  return today;
}

export function compareFundingPlans(facts: FundingFacts, currentPlan: FundingPlan, proposedPlan: FundingPlan, period: { start: string; end: string }): FundingComparison {
  const shared = proposedPlan.assumptions;
  const horizon = addControlMonths(facts.asOf, FUNDING_HORIZON_MONTHS);
  const current = runFundingPlan(facts, { ...currentPlan, assumptions: shared }, period, horizon);
  const proposed = runFundingPlan(facts, proposedPlan, period, horizon);
  const retirementDate = shared.alreadyRetired ? shared.retirementReviewDate : shared.retirementDate;
  const differences = { interest: delta(delta(proposed.selected.mortgageInterest, proposed.start.mortgageInterest), delta(current.selected.mortgageInterest, current.start.mortgageInterest)), savingsInterest: delta(delta(proposed.selected.savingsInterest, proposed.start.savingsInterest), delta(current.selected.savingsInterest, current.start.savingsInterest)), loanBalance: delta(proposed.selected.mortgageBalance, current.selected.mortgageBalance), retirementNet: delta(proposed.retirement.netPosition, current.retirement.netPosition), retirementSurplus: delta(proposed.retirement.monthlySurplus, current.retirement.monthlySurplus) };
  const summary: string[] = [];
  for (const goal of proposed.goals.filter(g => g.instructionShortfall > 0 && g.shortfall === null)) summary.push(`${goal.title}: funding instructions leave ${money(goal.instructionShortfall)} unassigned; payment-date affordability is unavailable.`);
  const unfunded = proposed.goals.filter(goal => goal.shortfall !== null && goal.shortfall > 0 && goal.date && goal.date <= period.end);
  for (const goal of unfunded.slice(0, 3)) summary.push(`${goal.title}: ${money(goal.shortfall!)} shortfall at ${goal.date}; the full ${money(goal.cost)} cost remains unpaid.`);
  if (proposed.lowest && proposed.lowest.amount < 0) summary.push(`Available cash reaches ${money(proposed.lowest.amount)} on ${proposed.lowest.date}.`);
  if (proposed.emergencyDays) summary.push(`Available cash is below your emergency minimum for ${proposed.emergencyDays} days in this period.`);
  for (const goal of proposed.goals) { const previous = current.goals.find(g => g.id === goal.id); if (previous?.shortfall !== null && goal.shortfall !== null && previous && goal.shortfall > (previous.shortfall ?? 0)) summary.push(`${goal.title} has ${money(goal.shortfall - (previous.shortfall ?? 0))} more unfunded at its existing payment date.`); }
  if (differences.interest !== null && Math.abs(differences.interest) >= 0.01) summary.push(`${money(Math.abs(differences.interest))} ${differences.interest > 0 ? "more" : "less"} mortgage interest over the selected period; scheduled repayments are unchanged.`);
  if (differences.retirementNet !== null && Math.abs(differences.retirementNet) >= 0.01) summary.push(`Retirement net position is ${money(Math.abs(differences.retirementNet))} ${differences.retirementNet > 0 ? "higher" : "lower"} than the current plan.`);
  if (!summary.length) summary.push(proposed.missing.length ? "Complete the missing inputs before comparing funding impacts." : "No material funding difference is calculated for the selected period.");
  const today = confirmedFundingToday(facts, currentPlan);
  const metricDifference = (p: FundingMetric, c: FundingMetric) => { const difference = unavailable(); for (const key of ["netPosition", "monthlySurplus", "cash", "availableCash", "commitments", "cashBuffer", "essentialExpenses", "mortgageBalance", "mortgageInterest", "savingsInterest"] as const) difference[key] = delta(p[key], c[key]); return difference; };
  return { today, current, proposed, selectedDifference: metricDifference(proposed.selected, current.selected), retirementDifference: metricDifference(proposed.retirement, current.retirement), summary: summary.slice(0, 3), differences, retirementDate };
}

export type FundingAlternative = { name: "Use savings" | "Use offset" | "Split funding" | "Save first"; plan: FundingPlan | null; date: string | null; shortfall: number | null; reason: string | null };
export function fundingAlternatives(facts: FundingFacts, plan: FundingPlan, goalId: string): FundingAlternative[] {
  const goal = plan.goals.find(g => g.id === goalId);
  if (!goal) return [];
  const accounts = resolved(facts, plan.assumptions).accounts.filter(a => a.accessible === true);
  const chosen = goal.funding.sources.map(source => accounts.find(account => account.id === source.accountId)).filter((account): account is FundingAccount => !!account);
  const savings = chosen.find(a => a.kind === "savings") ?? accounts.find(a => a.kind === "savings"), offset = chosen.find(a => a.kind === "offset" && a.loanId && a.offsetPercent !== null) ?? accounts.find(a => a.kind === "offset" && a.loanId && a.offsetPercent !== null);
  const horizon = addControlMonths(facts.asOf, FUNDING_HORIZON_MONTHS);
  const build = (funding: GoalFunding, paymentDate = goal.paymentDate) => ({ ...plan, goals: plan.goals.map(g => g.id === goalId ? { ...g, paymentDate, funding } : g) });
  const options: FundingAlternative[] = [];
  for (const name of ["Use savings", "Use offset", "Split funding"] as const) {
    const required = name === "Use savings" ? !!savings : name === "Use offset" ? !!offset : !!savings && !!offset;
    if (!required || !goal.paymentDate) { options.push({ name, plan: null, date: goal.paymentDate, shortfall: null, reason: "Select the required accessible account(s), offset linkage and payment date." }); continue; }
    const funding = emptyGoalFunding();
    funding.sources = name === "Use savings" ? [{ accountId: savings!.id, amount: goal.cost }] : name === "Use offset" ? [{ accountId: offset!.id, amount: goal.cost }] : [{ accountId: savings!.id, amount: cents(goal.cost / 2) }, { accountId: offset!.id, amount: cents(goal.cost - cents(goal.cost / 2)) }];
    funding.replenish = goal.funding.replenish;
    const alternative = build(funding), result = runFundingPlan(facts, alternative, { start: facts.asOf, end: goal.paymentDate });
    const assessment = result.goals.find(g => g.id === goalId)!;
    options.push({ name, plan: alternative, date: goal.paymentDate, shortfall: assessment.shortfall, reason: result.selected.cash === null ? result.missing[0] ?? "Required inputs are unavailable." : null });
  }
  // One cash-ledger run without this goal's payment: its accumulated surplus is reserved,
  // so other commitments still compete and no assumed revised date is invented.
  const saving = emptyGoalFunding();
  saving.surplus = { amount: goal.cost, monthly: 0, useAllSurplus: true, accountId: plan.assumptions.settlementAccountId, startDate: facts.asOf };
  const savingPlan = build(saving, horizon), run = runFundingPlan(facts, savingPlan, { start: facts.asOf, end: horizon });
  const feasible = run.feasibleDates[goalId] ?? null;
  options.push({ name: "Save first", plan: feasible ? build(saving, feasible) : null, date: feasible, shortfall: feasible ? 0 : null, reason: feasible ? null : run.missing[0] ?? "No feasible payment date was found within 60 years using available surplus and existing commitments." });
  return options;
}
