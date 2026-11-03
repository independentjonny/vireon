import { addControlMonths, controlDate } from "@/lib/controlCentreProjection";
import { compareFundingPlans, confirmedFundingToday, fundingPeriodRange, type FundingFacts, type FundingPlan, type FundingMetric } from "@/lib/goalFundingModel";

/** A disclosed cash-flow projection, not a substitute for the account funding ledger. */
export function cashFlowPreview(facts: FundingFacts, plan: FundingPlan, endpoint: string): FundingMetric {
  const value = confirmedFundingToday(facts, plan), a = plan.assumptions;
  // Fractional months use the actual anniversary interval, including leap years.
  const duration = (from: string, to: string) => { const p = fundingPeriodRange(from, to); const anchor = addControlMonths(from, p.wholeMonths); return p.wholeMonths + (controlDate(to) - controlDate(anchor)) / (controlDate(addControlMonths(from, p.wholeMonths + 1)) - controlDate(anchor)); };
  const payments = facts.loans.every(l => l.balance === 0 || l.monthlyPayment !== null) ? facts.loans.reduce((s,l) => s + (l.balance === 0 ? 0 : l.monthlyPayment!),0) : null;
  const surplus = a.income !== null && a.livingExpenses !== null && payments !== null ? a.income - a.livingExpenses - payments : facts.confirmedMonthlySurplus ?? null;
  const expenses = a.livingExpenses !== null && payments !== null ? a.livingExpenses + payments : facts.income !== null && facts.confirmedMonthlySurplus != null ? facts.income - facts.confirmedMonthlySurplus : null;
  const retirement = a.retirementDate;
  const retired = !!retirement && endpoint >= retirement;
  const retirementSurplus = a.retirementIncome === null || a.retirementSpending === null ? null : a.retirementIncome - a.retirementSpending;
  const beforeEnd = retirement && endpoint > retirement ? retirement < facts.asOf ? facts.asOf : retirement : endpoint;
  const afterStart = retirement && retirement > facts.asOf ? retirement : facts.asOf;
  const before = duration(facts.asOf, beforeEnd), after = retired ? duration(afterStart, endpoint) : 0;
  const change = surplus === null && before > 0 || retirementSurplus === null && after > 0 ? null : (surplus ?? 0) * before + (retirementSurplus ?? 0) * after;
  const costs = plan.goals.filter(g => g.paymentDate && g.paymentDate > facts.asOf && g.paymentDate <= endpoint).reduce((s,g) => s + g.cost,0);
  const round = (n: number) => Math.round(n * 100) / 100;
  value.cash = value.cash === null || change === null ? null : round(value.cash + change - costs);
  value.netPosition = value.netPosition === null || change === null ? null : round(value.netPosition + change - costs);
  value.monthlySurplus = retired ? retirementSurplus : surplus;
  value.commitments = value.cash === null ? null : Math.min(Math.max(0,value.cash),plan.goals.filter(g => !g.paymentDate || g.paymentDate > endpoint).reduce((s,g) => s + g.funding.sources.reduce((n,source) => n + source.amount,0),0));
  value.availableCash = value.cash === null || value.commitments === null ? null : round(value.cash - value.commitments);
  value.essentialExpenses = retired ? a.retirementEssential ?? a.retirementSpending : a.essentialExpenses !== null && payments !== null ? a.essentialExpenses + payments : expenses;
  value.cashBufferBasis = (retired ? a.retirementEssential === null : a.essentialExpenses === null) ? "total" : undefined;
  value.cashBuffer = value.availableCash === null || value.essentialExpenses === null || value.essentialExpenses <= 0 ? null : value.availableCash / value.essentialExpenses;
  value.accounts = []; // This aggregate projection does not invent per-account allocations.
  return value;
}

export function compareControlCentrePlans(facts: FundingFacts, current: FundingPlan, proposed: FundingPlan, period: {start:string;end:string}) {
  const result = compareFundingPlans(facts,current,proposed,period);
  const preview = result.proposed.selected.cash === null && confirmedFundingToday(facts,current).cash !== null && facts.confirmedMonthlySurplus != null;
  if (!preview) return {...result, cashFlowPreview: false};
  for (const [run,plan] of [[result.current,{...current,assumptions:proposed.assumptions}],[result.proposed,proposed]] as const) {
    run.selected = cashFlowPreview(facts,plan,period.end);
    run.retirement = result.retirementDate ? cashFlowPreview(facts,plan,result.retirementDate) : run.retirement;
    run.points = [{date:period.start,value:cashFlowPreview(facts,plan,period.start)},{date:period.end,value:run.selected}];
  }
  for (const key of ["netPosition","monthlySurplus","cash","availableCash","cashBuffer"] as const) {
    for (const [difference,p,c] of [[result.selectedDifference,result.proposed.selected,result.current.selected],[result.retirementDifference,result.proposed.retirement,result.current.retirement]] as const) difference[key] = p[key] === null || c[key] === null ? null : p[key]! - c[key]!;
  }
  return {...result,cashFlowPreview:true};
}
