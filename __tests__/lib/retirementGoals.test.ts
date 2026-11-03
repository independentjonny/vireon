import test from "node:test";
import assert from "node:assert/strict";
import { validateRetirementGoals } from "../../src/lib/retirementGoals.ts";
import { initialFundingPlan,goalFundingFacts } from "../../src/lib/goalFundingInputs.ts";
import { goalFundingReadModelFixture } from "../fixtures/goalFundingReadModel.ts";
test("Goals retirement settings seed date and monthly values without inventing essential expenses",()=>{
 const {position}=goalFundingReadModelFixture("11111111-1111-4111-8111-111111111111");const settings={retirementDate:"2040-11-03",monthlyIncome:2000,monthlyExpenses:1500};validateRetirementGoals(settings);const plan=initialFundingPlan(goalFundingFacts(position),[],null,settings);assert.equal(plan.assumptions.retirementDate,"2040-11-03");assert.equal(plan.assumptions.retirementIncome,2000);assert.equal(plan.assumptions.retirementSpending,1500);assert.equal(plan.assumptions.retirementEssential,null);assert.equal(plan.assumptions.alreadyRetired,false);
});
test("retirement dates and monthly amounts reject invalid dates, unknown amounts and owner fields",()=>{
 const good={retirementDate:"2040-11-03",monthlyIncome:2000,monthlyExpenses:1500};for(const patch of [{retirementDate:"2040-02-30"},{monthlyIncome:NaN},{monthlyExpenses:-1},{monthlyIncome:.001},{userId:"someone-else"}])assert.throws(()=>validateRetirementGoals({...good,...patch}));validateRetirementGoals({...good,monthlyIncome:0,monthlyExpenses:0});
});
