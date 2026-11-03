import { goalFundingReadModelFixture as seed } from "../fixtures/goalFundingReadModel.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createGoalFundingPostgresService } from "../../src/server/services/goalFundingPostgresService.ts";
import type { FinancialGoal } from "../../src/lib/goalPlanning.ts";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";
import { fundingFixture } from "../fixtures/goalFunding.ts";

const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
type State = { goals: Array<{ user: string; id: string; payload: FinancialGoal; version: number }>; prefs: Array<{ user: string; value: unknown; version: number }>; events: Array<{ user: string; id: string; name: string; type: string; before: unknown; after: unknown }> };
function database() {
  let state: State = { goals: [], prefs: [], events: [] }, scoped: string | null = null;
  const calls: string[] = []; let failHistory = false;
  const client: PostgresPilotClient = {
    async transaction<T>(operation: (tx: PostgresPilotClient) => Promise<T>) { const before = structuredClone(state); try { return await operation(this); } catch (e) { state = before; throw e; } finally { scoped = null; } },
    async query<T>(sql: string, p: unknown[] = []): Promise<QueryResult<T>> {
      calls.push(sql);
      if (sql.includes("set_config")) { scoped = String(p[0]); return { rows: [] }; }
      assert.ok(scoped, "every query is transaction-scoped");
      if (sql.includes("pg_advisory_xact_lock")) { assert.equal(p[0], `goal-funding:${scoped}`); return { rows: [] }; }
      assert.equal(p[0], scoped, "first query parameter is always the trusted user");
      let rows: unknown[] = [];
      if (sql.startsWith("select app_id as id,") && sql.includes("from goals")) rows = state.goals.filter(g => g.user === scoped).map(g => ({ id: g.id, payload: g.payload, version: g.version })).sort((a,b) => a.id.localeCompare(b.id));
      else if (sql.startsWith("select preference_value")) rows = state.prefs.filter(p => p.user === scoped).map(p => ({ value: p.value, version: p.version }));
      else if (sql.startsWith("select app_id as id, title as name")) rows = state.events.filter(e => e.user === scoped).slice().reverse();
      else if (sql.startsWith("select after_values as after")) rows = state.events.filter(e => e.user === scoped && e.id === p[1]).map(e => ({ after: e.after }));
      else if (sql.startsWith("insert into goals")) { const current = state.goals.find(g => g.user === scoped && g.id === p[1]), payload = JSON.parse(String(p[9])); if (current) { current.payload = payload; current.version++; } else state.goals.push({ user: scoped!, id: String(p[1]), payload, version: 1 }); }
      else if (sql.startsWith("insert into user_preferences")) { const current = state.prefs.find(p => p.user === scoped); if (current) { current.value = JSON.parse(String(p[1])); current.version++; } else state.prefs.push({ user: scoped!, value: JSON.parse(String(p[1])), version: 1 }); }
      else if (sql.startsWith("insert into timeline_events")) { if (failHistory) throw new Error("synthetic history failure"); state.events.push({ user: scoped!, id: String(p[1]), name: String(p[2]), type: String(p[4]), before: JSON.parse(String(p[5])), after: JSON.parse(String(p[6])) }); }
      else throw new Error(`Unexpected SQL: ${sql}`);
      return { rows: rows as T[] };
    },
  };
  return { client, calls, snapshot: () => structuredClone(state), failHistory: () => { failHistory = true; } };
}
const session = (userId: string | null) => ({ userId, expiresAt: "2027-01-01T00:00:00Z" });
test("alternative save survives service reload without changing active goals or facts", async () => {
  const db = database(), input = seed(A), before = structuredClone(input.position.confirmedFacts);
  const service = createGoalFundingPostgresService(db.client, async () => input), workspace = await service.read(session(A));
  const plan = fundingFixture().plan;
  const saved = await service.save(session(A), { action: "alternative", plan, name: "Offset option", expectedRevision: workspace.revision, requestId: "alternative-one" });
  assert.equal(saved.plan.goals.length, 0); assert.equal(saved.alternatives.length, 1);
  const reloaded = await createGoalFundingPostgresService(db.client, async () => input).read(session(A));
  assert.deepEqual(reloaded.alternatives[0].plan, plan); assert.equal(db.snapshot().goals.length, 0); assert.deepEqual(input.position.confirmedFacts, before);
});
test("adoption persists goals, settings and recovery history without writes to confirmed facts", async () => {
  const db = database(), input = seed(A), service = createGoalFundingPostgresService(db.client, async () => input), original = await service.read(session(A)), plan = fundingFixture().plan;
  const adopted = await service.save(session(A), { action: "adopt", plan, expectedRevision: original.revision, requestId: "adopt-first" });
  assert.deepEqual(adopted.plan, plan); assert.equal(adopted.history.length, 1); assert.deepEqual(adopted.history[0].plan, original.plan);
  const next = structuredClone(plan); next.goals[0].funding.sources = [{ accountId: "offset", amount: 10000 }];
  await service.save(session(A), { action: "adopt", plan: next, expectedRevision: adopted.revision, requestId: "adopt-second" });
  const reloaded = await createGoalFundingPostgresService(db.client, async () => input).read(session(A));
  assert.deepEqual(reloaded.plan, next); assert.deepEqual(reloaded.history[0].plan, plan);
  assert.ok(db.calls.every(sql => !/insert into financial_facts|update financial_facts|fact_versions|insert into transactions/i.test(sql)));
});
test("trusted user scopes saved scenarios and plans across fresh service instances", async () => {
  const db = database(), service = createGoalFundingPostgresService(db.client, async s => seed(s.userId!));
  const workspace = await service.read(session(A)); await service.save(session(A), { action: "adopt", plan: fundingFixture().plan, expectedRevision: workspace.revision, requestId: "adopt-owned" });
  const other = await createGoalFundingPostgresService(db.client, async () => seed(B)).read(session(B));
  assert.equal(other.plan.goals.length, 0); assert.equal(other.history.length, 0); assert.equal(other.alternatives.length, 0);
  await assert.rejects(() => service.read(session(null)), /Sign in/);
});
test("stale revisions and request-ID reuse reject overwrites; retry is idempotent", async () => {
  const db = database(), service = createGoalFundingPostgresService(db.client, async () => seed(A)), workspace = await service.read(session(A));
  const request = { action: "adopt" as const, plan: fundingFixture().plan, expectedRevision: workspace.revision, requestId: "adopt-retry" };
  const result = await service.save(session(A), request); await service.save(session(A), request); assert.equal(db.snapshot().events.length, 1);
  await assert.rejects(() => service.save(session(A), { ...request, requestId: "stale-request" }), /changed/);
  const changed = structuredClone(request.plan); changed.goals[0].title = "Changed";
  await assert.rejects(() => service.save(session(A), { ...request, plan: changed }), /different changes/);
  assert.notEqual(result.revision, workspace.revision);
});
test("history failure rolls back all adoption writes", async () => {
  const db = database(), service = createGoalFundingPostgresService(db.client, async () => seed(A)), workspace = await service.read(session(A)); db.failHistory();
  await assert.rejects(() => service.save(session(A), { action: "adopt", plan: fundingFixture().plan, expectedRevision: workspace.revision, requestId: "adopt-rollback" }), /history failure/);
  assert.equal(db.snapshot().goals.length, 0); assert.equal(db.snapshot().prefs.length, 0);
});
test("foreign account references and attempts to edit balances are rejected before saving", async () => {
  const db = database(), service = createGoalFundingPostgresService(db.client, async () => seed(A)), workspace = await service.read(session(A));
  const plan = fundingFixture().plan; plan.goals[0].funding.sources[0].accountId = "foreign-account";
  await assert.rejects(() => service.save(session(A), { action: "adopt", plan, expectedRevision: workspace.revision, requestId: "adopt-foreign" }), /workspace/);
  const forged = fundingFixture().plan; Object.assign(forged.assumptions.accounts, { savings: { balance: 999999 } });
  await assert.rejects(() => service.save(session(A), { action: "adopt", plan: forged, expectedRevision: workspace.revision, requestId: "adopt-forged" }), /Invalid account/);
  assert.equal(db.snapshot().goals.length, 0);
});
test("a mismatched financial input owner is rejected before reading or saving another user's plan", async () => {
  const db = database(), service = createGoalFundingPostgresService(db.client, async () => seed(B));
  await assert.rejects(() => service.read(session(A)), /ownership/);
  await assert.rejects(() => service.save(session(A), { action: "adopt", plan: fundingFixture().plan, expectedRevision: "unused", requestId: "wrong-owner" }), /ownership/);
  assert.equal(db.calls.length, 0);
});

test("Goals retirement settings override obsolete plan preferences and reject stale retirement edits", async () => {
 const db=database(),input=seed(A),service=createGoalFundingPostgresService(db.client,async()=>input),initial=await service.read(session(A)),plan=fundingFixture().plan;
 const saved=await service.save(session(A),{action:"adopt",plan,expectedRevision:initial.revision,requestId:"retirement-owned"});
 input.retirement={retirementDate:"2040-11-03",monthlyIncome:2000,monthlyExpenses:1500};
 const reloaded=await service.read(session(A));assert.equal(reloaded.plan.assumptions.retirementDate,"2040-11-03");assert.equal(reloaded.plan.assumptions.retirementIncome,2000);assert.equal(reloaded.plan.assumptions.retirementSpending,1500);assert.notEqual(reloaded.revision,saved.revision);
 await assert.rejects(()=>service.save(session(A),{action:"adopt",plan,expectedRevision:reloaded.revision,requestId:"stale-retirement"}),/changed in Goals/);
});
