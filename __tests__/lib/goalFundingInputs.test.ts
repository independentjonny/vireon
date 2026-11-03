import test from "node:test";
import assert from "node:assert/strict";
import { goalFundingFacts, initialFundingPlan } from "../../src/lib/goalFundingInputs.ts";
import { goalFundingReadModelFixture } from "../fixtures/goalFundingReadModel.ts";
import type { FinancialGoal } from "../../src/lib/goalPlanning.ts";
import { confirmedFundingToday } from "../../src/lib/goalFundingModel.ts";
const id = "11111111-1111-4111-8111-111111111111";
test("confirmed account IDs, rates and explicit essential expenses seed the model", () => {
  const facts = goalFundingFacts(goalFundingReadModelFixture(id).position);
  assert.equal(facts.accounts[1].loanId, "mortgage"); assert.equal(facts.accounts[1].offsetPercent, 100); assert.equal(facts.accounts[1].annualRate, 0); assert.equal(facts.essentialExpenses, 2000); assert.equal(facts.otherAssets, 200000); assert.equal(facts.otherLiabilities, 0);
});
test("missing, stale and unconfirmed records are not converted to zero facts", () => {
  const { position } = goalFundingReadModelFixture(id); position.staleDataSummary.staleRecordIds = ["savings"];
  position.confirmedFacts.find(record => record.id === "living")!.value.essential = undefined;
  const facts = goalFundingFacts(position); assert.equal(facts.accounts.some(account => account.id === "savings"), false); assert.equal(facts.essentialExpenses, null);
  position.confirmedFacts.find(record => record.id === "offset")!.provenance.userConfirmed = false;
  const noCash = goalFundingFacts(position); assert.equal(noCash.accounts.length, 0);
  assert.equal(confirmedFundingToday(noCash, initialFundingPlan(noCash, [], null)).cash, null);
});
test("recorded offset money cannot become a synthetic account or redraw funding", () => {
  const { position } = goalFundingReadModelFixture(id); position.confirmedFacts.find(record => record.id === "mortgage")!.value.offsetBalance = 50000;
  position.confirmedFacts.find(record => record.id === "offset")!.value.linkedMortgageId = undefined;
  const facts = goalFundingFacts(position); assert.equal(facts.accounts.length, 2); assert.match(facts.inputWarnings!.join(" "), /confirmed account ID/);
});
test("stale or estimated cash flow and observed transactions never seed confirmed recurring income", () => {
  const { position } = goalFundingReadModelFixture(id);
  position.confirmedFacts.find(record => record.id === "salary")!.approximate = true;
  const estimated = goalFundingFacts(position); assert.equal(estimated.income, null); assert.equal(estimated.confirmedMonthlySurplus, null);
  position.confirmedFacts.find(record => record.id === "salary")!.approximate = false;
  position.staleDataSummary.staleRecordIds = ["living"];
  const stale = goalFundingFacts(position); assert.equal(stale.livingExpenses, null); assert.equal(stale.essentialExpenses, null); assert.equal(stale.confirmedMonthlySurplus, null);
});
test("retirement wealth targets do not become automatic purchases", () => {
  const facts = goalFundingFacts(goalFundingReadModelFixture(id).position);
  const retirement = { id: "retirement-goal", type: "RETIREMENT", title: "Retirement wealth", targetAmount: 1000000, targetDate: "2040-01-01", status: "ACTIVE", priority: "high" } as FinancialGoal;
  assert.equal(initialFundingPlan(facts, [retirement], null).goals.length, 0); assert.equal(initialFundingPlan(facts, [{ ...retirement, type: "TRAVEL" }], null).goals.length, 1);
  assert.equal(initialFundingPlan(facts, [retirement], null).assumptions.retirementDate, "2040-01-01");
  const noDate = initialFundingPlan(facts, [], { currentAge: 45, retirementAge: 65, annualAddition: 0, low: 1, base: 4, high: 6, inflation: 2, complete: true });
  assert.equal(noDate.assumptions.retirementDate, null); assert.equal(noDate.assumptions.alreadyRetired, null);
});
