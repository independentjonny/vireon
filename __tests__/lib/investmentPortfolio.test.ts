import test from "node:test";
import assert from "node:assert/strict";
import { investmentPortfolio } from "../../src/lib/investmentPortfolio.ts";
import { buildFinancialPositionReadModel } from "../../src/server/services/financialPositionReadService.ts";
import { createEmptyFinancialVaultState } from "../../src/lib/financialVaultEmptyState.ts";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";
const record = (id: string, subtype: string, balance: unknown): CanonicalFinancialRecord => ({id,userId:"qa",kind:"asset",subtype,label:id,value:{balance},provenance:{userConfirmed:true,sourceType:"MANUAL",confidence:1,ingestionId:"qa",sourceField:"qa"},createdAt:"2026-10-30",updatedAt:"2026-10-30",superseded:false,approximate:false,history:[]});
const model = (canonical: CanonicalFinancialRecord[]) => buildFinancialPositionReadModel({userId:"qa",vault:createEmptyFinancialVaultState(),canonical,freshness:[],ingestions:[]});
test("super fund names and investment properties cannot appear in two portfolio groups", () => {
  const input=model([record("My Super Fund","superannuation",388000),record("Investment property fund","property",500000),record("ETF fund","investment",10000)]);
  const result=investmentPortfolio(input);
  assert.equal(result.total,898000);
  assert.deepEqual(result.groups.map(g=>[g.label,g.value]),[["Investment property",500000],["Investments",10000],["Superannuation",388000]]);
  assert.equal(new Set(result.groups.flatMap(g=>g.items.map(i=>i.id))).size,3);
});
test("duplicate IDs and stale, estimated, unconfirmed or foreign holdings cannot inflate the portfolio",()=>{
  const good=record("ETF","investment",100);
  const input=model([good]);
  input.assets.push(good,{...record("stale","investment",200)},{...record("estimate","investment",300),approximate:true},{...record("foreign","investment",400),userId:"other"},{...record("unconfirmed","investment",500),provenance:{...good.provenance,userConfirmed:false}});
  input.staleDataSummary.staleRecordIds=["stale"];
  assert.equal(investmentPortfolio(input).total,100);
});
test("unknown balances stay unknown and confirmed zero remains zero",()=>{
  assert.equal(investmentPortfolio(model([])).total,null);
  assert.equal(investmentPortfolio(model([record("ETF","investment"," ")])).total,null);
  assert.equal(investmentPortfolio(model([record("ETF","investment",0)])).total,0);
});
