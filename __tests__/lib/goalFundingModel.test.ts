import test from "node:test";
import assert from "node:assert/strict";
import { compareFundingPlans, emptyGoalFunding, fundingAlternatives, fundingPeriodRange, runFundingPlan, validateFundingPlan } from "../../src/lib/goalFundingModel.ts";
import { fundingFixture } from "../fixtures/goalFunding.ts";
const period = { start: "2026-11-03", end: "2028-11-03" };
const near = (actual: number | null, expected: number, tolerance = .05) => assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
test("exact-day slider and manual periods share calendar boundaries", () => {
  assert.deepEqual(fundingPeriodRange("2028-01-31", "2028-02-29"), { days: 29, wholeMonths: 1, extraDays: 0 });
  assert.deepEqual(fundingPeriodRange("2026-11-03", "2026-11-20"), { days: 17, wholeMonths: 0, extraDays: 17 });
});
test("reservations reduce available cash without changing balances or net position", () => {
  const { facts, plan } = fundingFixture(), before = structuredClone(facts);
  const reserved = runFundingPlan(facts, plan, { start: facts.asOf, end: facts.asOf });
  const free = runFundingPlan(facts, { ...plan, goals: [] }, { start: facts.asOf, end: facts.asOf });
  near(reserved.selected.cash, 40000); near(reserved.selected.commitments, 10000); near(reserved.selected.availableCash, 30000); near(reserved.selected.netPosition, free.selected.netPosition!);
  assert.deepEqual(facts, before);
});
test("savings, offset and split payments spend full cost without inventing assets", () => {
  for (const sources of [[{ accountId: "savings", amount: 10000 }], [{ accountId: "offset", amount: 10000 }], [{ accountId: "savings", amount: 5000 }, { accountId: "offset", amount: 5000 }]]) {
    const { facts, plan } = fundingFixture(); plan.goals[0].paymentDate = facts.asOf; plan.goals[0].funding.sources = sources;
    const result = runFundingPlan(facts, plan, { start: facts.asOf, end: facts.asOf });
    near(result.selected.cash, 30000); near(result.selected.netPosition, 130000); assert.equal(result.goals[0].paid, true);
  }
});
test("offset withdrawal increases interest and debt without raising scheduled repayments", () => {
  const { facts, plan } = fundingFixture(), proposed = structuredClone(plan);
  proposed.goals[0].funding.sources = [{ accountId: "offset", amount: 10000 }];
  const result = compareFundingPlans(facts, plan, proposed, period);
  assert.ok(result.differences.interest! > 0); assert.ok(result.differences.loanBalance! > 0);
  assert.equal(facts.loans[0].monthlyPayment, 1000); assert.equal(proposed.assumptions.loans.mortgage, undefined);
  assert.notEqual(result.current.payoffDates.mortgage, result.proposed.payoffDates.mortgage);
});
test("offset relief is percentage-weighted and capped at principal", () => {
  const { facts, plan } = fundingFixture(); plan.goals = []; facts.accounts[1].balance = 300000; facts.accounts[1].offsetPercent = 50;
  const result = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-03" });
  near(result.selected.mortgageInterest, 0); near(result.selected.mortgageBalance, 99000);
});
test("savings interest is lost when savings are used and is not after-tax", () => {
  const { facts, plan } = fundingFixture(), proposed = structuredClone(plan);
  proposed.goals[0].funding.sources = [{ accountId: "offset", amount: 10000 }];
  const result = compareFundingPlans(facts, plan, proposed, period);
  assert.ok(result.differences.savingsInterest! > 0);
});
test("principal repayments reduce cash and debt together, not net position twice", () => {
  const { facts, plan } = fundingFixture(); plan.goals = []; facts.accounts.forEach(a => a.annualRate = 0); facts.loans[0].annualRate = 0; plan.assumptions.income = plan.assumptions.livingExpenses = plan.assumptions.essentialExpenses = 0;
  const result = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-03" });
  near(result.selected.cash, 39000); near(result.selected.mortgageBalance, 99000); near(result.selected.netPosition, 140000);
});
test("monthly cash flow remains exactly twelve months through a leap year", () => {
  const { facts, plan } = fundingFixture(); facts.asOf = "2027-11-03"; plan.goals = []; facts.accounts.forEach(a => a.annualRate = 0); facts.loans[0].balance = 0;
  plan.assumptions.income = 1000; plan.assumptions.livingExpenses = plan.assumptions.essentialExpenses = 0;
  near(runFundingPlan(facts, plan, { start: facts.asOf, end: "2028-11-03" }).selected.cash, 52000);
});
test("scheduled owned-account transfers preserve total cash and net position", () => {
  const { facts, plan } = fundingFixture(); plan.goals = []; facts.accounts.forEach(a => a.annualRate = 0); facts.loans[0].annualRate = 0;
  const free = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-11-15" });
  facts.transactions.push({ id: "transfer", date: "2026-11-10", accountId: "savings", destinationId: "offset", amount: 4000, type: "transfer" });
  const moved = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-11-15" }); near(moved.selected.cash, free.selected.cash!); near(moved.selected.netPosition, free.selected.netPosition!);
  facts.transactions[0].amount = 1e6;
  const failed = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-11-15" }); assert.equal(failed.selected.cash, null); assert.match(failed.missing.join(" "), /no borrowing/);
});
test("priority and stable ID prevent double reservation and retain unaffordable goals", () => {
  const { facts, plan } = fundingFixture(); facts.accounts[0].balance = 5000;
  plan.goals[0].paymentDate = facts.asOf; plan.goals[0].cost = 5000; plan.goals[0].funding.sources[0].amount = 5000;
  plan.goals.push({ ...structuredClone(plan.goals[0]), id: "z-goal", title: "Urgent", priority: "critical" });
  const result = runFundingPlan(facts, plan, { start: facts.asOf, end: facts.asOf });
  assert.equal(result.goals.find(g => g.id === "z-goal")?.paid, true); const failed = result.goals.find(g => g.id === "a-goal")!;
  assert.equal(failed.paid, false); near(failed.shortfall, 5000); near(failed.cost, 5000);
  plan.goals[1].priority = "medium"; plan.goals.reverse();
  assert.equal(runFundingPlan(facts, plan, { start: facts.asOf, end: facts.asOf }).goals.find(goal => goal.id === "a-goal")?.paid, true);
});
test("surplus is allocated once, stops at target and respects earlier transactions", () => {
  const { facts, plan } = fundingFixture(); facts.accounts.forEach(a => { a.balance = 0; a.annualRate = 0; }); facts.loans[0].balance = 0;
  plan.assumptions.income = 1000; plan.assumptions.livingExpenses = 0; plan.assumptions.essentialExpenses = 0;
  const funding = emptyGoalFunding(); funding.surplus = { accountId: "savings", amount: 500, monthly: 1000, startDate: facts.asOf };
  plan.goals[0] = { ...plan.goals[0], cost: 500, paymentDate: "2026-12-03", funding };
  plan.goals.push({ ...structuredClone(plan.goals[0]), id: "z-goal", funding: { ...structuredClone(funding), surplus: { ...funding.surplus, amount: 1000 } }, cost: 1000 });
  const result = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-03" }); assert.equal(result.goals[0].paid, true); assert.ok(result.goals[1].shortfall! > 0);
  facts.transactions.push({ id: "expense", date: "2026-12-03", accountId: "savings", amount: 600, type: "expense" });
  assert.ok(runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-03" }).goals[0].shortfall! > 0);
});
test("replenishment is a surplus-funded transfer with explicit shortfall", () => {
  const { facts, plan } = fundingFixture(); plan.goals[0].paymentDate = facts.asOf; plan.goals[0].funding.sources = [{ accountId: "offset", amount: 10000 }];
  plan.goals[0].funding.replenish = { accountId: "offset", monthly: 5000, startDate: "2026-11-04" };
  const result = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-03" }); assert.ok(result.selected.accounts.find(a => a.id === "offset")!.balance! > 10000); assert.ok(result.goals[0].replenishmentShortfall! > 0);
});
test("retirement changes cash flow; missing essential spending affects buffer only", () => {
  const { facts, plan } = fundingFixture(); plan.assumptions.retirementDate = "2026-12-03"; plan.assumptions.essentialExpenses = null;
  const result = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-03" });
  assert.ok(result.retirement.monthlySurplus! < 0); assert.equal(result.start.cashBuffer, null); assert.ok(result.selected.cash! > 0);
  plan.assumptions.retirementIncome = null;
  assert.equal(runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-04" }).selected.cash, null);
});
test("unknown rates are not zero, and confirmed zero rates/balances are supported", () => {
  const { facts, plan } = fundingFixture(); facts.accounts[0].annualRate = null;
  assert.equal(runFundingPlan(facts, plan, period).selected.cash, null);
  facts.accounts[0].annualRate = 0; facts.accounts[0].balance = 0;
  assert.notEqual(runFundingPlan(facts, { ...plan, goals: [] }, period).selected.cash, null);
});
test("missing asset growth affects future net position without inventing zero growth or blocking cash", () => {
  const { facts, plan } = fundingFixture(); plan.assumptions.assetGrowth = null;
  const result = runFundingPlan(facts, plan, period); assert.equal(result.selected.netPosition, null); assert.notEqual(result.selected.cash, null); assert.notEqual(result.selected.mortgageBalance, null);
});
test("date boundaries, missing account IDs, excess splits and reversed periods are rejected", () => {
  const { facts, plan } = fundingFixture(); assert.throws(() => runFundingPlan(facts, plan, { start: period.end, end: period.start }));
  assert.throws(() => runFundingPlan(facts, plan, { start: facts.asOf, end: "2090-11-03" }));
  plan.goals[0].funding.sources[0].accountId = "other-user-account"; assert.throws(() => validateFundingPlan(plan, facts));
  plan.goals[0].funding.sources[0] = { accountId: "savings", amount: 10001 }; assert.throws(() => validateFundingPlan(plan, facts));
  plan.goals[0].cost = 0.00000001; assert.throws(() => validateFundingPlan(plan, facts), /whole cents/);
});
test("alternatives retain cost/date; Save first calculates a feasible date", () => {
  const { facts, plan } = fundingFixture();
  const alternatives = fundingAlternatives(facts, plan, "a-goal");
  assert.deepEqual(alternatives.slice(0, 3).map(a => a.plan?.goals[0].cost), [10000,10000,10000]);
  assert.deepEqual(alternatives.slice(0, 3).map(a => a.date), ["2027-01-03","2027-01-03","2027-01-03"]);
  const first = alternatives[3]; assert.ok(first.date); assert.equal(first.shortfall, 0);
  assert.equal(runFundingPlan(facts, first.plan!, { start: facts.asOf, end: first.date! }).goals[0].paid, true);
  const previous = new Date(Date.parse(first.date! + "T00:00:00Z") - 86400000).toISOString().slice(0,10), earlier = structuredClone(first.plan!); earlier.goals[0].paymentDate = previous;
  assert.equal(runFundingPlan(facts, earlier, { start: facts.asOf, end: previous }).goals[0].paid, false);
});
test("no feasible Save first date is reported rather than invented", () => {
  const { facts, plan } = fundingFixture(); facts.accounts.forEach(a => { a.balance = 0; a.annualRate = 0; }); facts.loans[0].balance = 0;
  plan.assumptions.income = plan.assumptions.livingExpenses = plan.assumptions.essentialExpenses = plan.assumptions.retirementIncome = plan.assumptions.retirementSpending = plan.assumptions.retirementEssential = 0;
  const result = fundingAlternatives(facts, plan, "a-goal")[3]; assert.equal(result.date, null); assert.match(result.reason!, /No feasible/);
});
test("emergency duration is exact and uncovered repayments cannot invent payoff", () => {
  const { facts, plan } = fundingFixture(); plan.goals = []; plan.assumptions.minimumEmergency = 100000;
  assert.equal(runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-03" }).emergencyDays, 30);
  facts.accounts.forEach(a => { a.balance = 0; a.annualRate = 0; }); plan.assumptions.income = plan.assumptions.livingExpenses = plan.assumptions.essentialExpenses = 0;
  const uncovered = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-04" }); assert.equal(uncovered.selected.cash, null); assert.equal(uncovered.payoffDates.mortgage, null); assert.match(uncovered.missing.join(" "), /repayment funding shortfall/);
});
test("term expiry and interest-only limits are explicit", () => {
  const { facts, plan } = fundingFixture(); plan.goals = []; facts.loans[0].remainingMonths = 1;
  const expired = runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-04" }); assert.equal(expired.selected.cash, null); assert.match(expired.missing.join(" "), /term end/);
  facts.loans[0].remainingMonths = 360; facts.loans[0].repaymentType = "interest-only";
  near(runFundingPlan(facts, plan, { start: facts.asOf, end: "2026-12-03" }).selected.mortgageBalance, 100000);
});
test("already retired uses a future review; changing assumptions leaves Today confirmed", () => {
  const { facts, plan } = fundingFixture(), proposed = structuredClone(plan); proposed.assumptions.income = 9000; proposed.assumptions.loans.mortgage = { monthlyPayment: 3000 };
  const result = compareFundingPlans(facts, plan, proposed, period); near(result.today.monthlySurplus, 2000);
  proposed.assumptions.loans.mortgage = { monthlyPayment: 1000 }; proposed.assumptions.alreadyRetired = true; proposed.assumptions.retirementDate = "2020-11-03"; proposed.assumptions.retirementReviewDate = "2027-11-03";
  const retired = compareFundingPlans(facts, plan, proposed, period); assert.equal(retired.retirementDate, "2027-11-03"); assert.notEqual(retired.proposed.retirement.cash, null);
});
