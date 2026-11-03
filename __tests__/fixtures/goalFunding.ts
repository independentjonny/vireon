import { emptyGoalFunding, type FundingFacts, type FundingPlan } from "../../src/lib/goalFundingModel.ts";
export function fundingFixture() {
  const facts: FundingFacts = { asOf: "2026-11-03", accounts: [
    { id: "savings", title: "Savings", balance: 20000, kind: "savings", accessible: true, annualRate: 4, loanId: null, offsetPercent: null },
    { id: "offset", title: "Offset", balance: 20000, kind: "offset", accessible: true, annualRate: 0, loanId: "mortgage", offsetPercent: 100 },
  ], loans: [{ id: "mortgage", title: "Home loan", isMortgage: true, balance: 100000, annualRate: 6, monthlyPayment: 1000, repaymentType: "principal-interest", remainingMonths: 360, paymentAccountId: "savings" }],
    otherAssets: 200000, otherLiabilities: 0, income: 5000, livingExpenses: 2000, essentialExpenses: 1500, transactions: [] };
  const plan: FundingPlan = { goals: [{ id: "a-goal", title: "Renovation", cost: 10000, paymentDate: "2027-01-03", priority: "medium", funding: { ...emptyGoalFunding(), sources: [{ accountId: "savings", amount: 10000 }] } }],
    assumptions: { income: 5000, livingExpenses: 2000, essentialExpenses: 1500, minimumEmergency: 5000, settlementAccountId: "savings", inflation: 0, assetGrowth: 0, retirementDate: "2030-11-03", alreadyRetired: false, retirementReviewDate: null, retirementIncome: 2500, retirementSpending: 1800, retirementEssential: 1500, accounts: {}, loans: {} } };
  return { facts, plan };
}
