import assert from 'node:assert/strict';
import test from 'node:test';
import { fundingFixture } from '../fixtures/goalFunding.ts';
import { cashFlowPreview, compareControlCentrePlans } from '../../src/lib/controlCentreCashFlowPreview.ts';
test('recorded cash flow produces a dated preview without invented mortgage inputs',()=>{
 const {facts,plan}=fundingFixture(); facts.confirmedMonthlySurplus=2000; facts.confirmedKnownNetPosition=140000;
 facts.accounts[0].annualRate=null; facts.loans[0].remainingMonths=null; plan.assumptions.settlementAccountId=null;
 plan.assumptions.retirementDate='2040-11-03'; plan.assumptions.retirementIncome=2000; plan.assumptions.retirementSpending=1500; plan.goals=[];
 const original=JSON.stringify({facts,plan});
 const c=compareControlCentrePlans(facts,plan,plan,{start:facts.asOf,end:'2031-11-03'});
 assert.equal(c.cashFlowPreview,true); assert.equal(c.proposed.selected.cash,160000); assert.equal(c.proposed.selected.netPosition,260000);
 assert.equal(c.proposed.retirement.monthlySurplus,500); assert.equal(c.proposed.retirement.cash,376000);
 assert.equal(cashFlowPreview(facts,plan,'2041-11-03').cash,382000);
 assert.equal(JSON.stringify({facts,plan}),original);
});
test('goal cost changes future cash and net position once while dates change the projection',()=>{
 const {facts,plan}=fundingFixture();facts.confirmedKnownNetPosition=140000;
 const before=cashFlowPreview(facts,plan,'2027-01-02'), after=cashFlowPreview(facts,plan,'2027-01-03');
 assert.ok(before.cash!>after.cash!+9900); assert.equal(after.cash,34000);assert.equal(after.netPosition,134000);
});
test('unknown cash is never manufactured and complete ledger is retained',()=>{
 const {facts,plan}=fundingFixture();facts.accounts[0].balance=null; assert.equal(cashFlowPreview(facts,plan,'2027-01-03').cash,null);
 const complete=fundingFixture();assert.equal(compareControlCentrePlans(complete.facts,complete.plan,complete.plan,{start:complete.facts.asOf,end:'2027-01-03'}).cashFlowPreview,false);
});
