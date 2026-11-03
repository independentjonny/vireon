import { createFinancialVaultPostgresService } from "../../src/server/services/financialVaultPostgresService.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PsqlRuntimeClient, createRuntimeDatabaseConfigFromEnv } from "../../src/server/db/postgresRuntime.ts";
import { createGoalFundingPostgresService } from "../../src/server/services/goalFundingPostgresService.ts";
import { goalFundingReadModelFixture } from "../fixtures/goalFundingReadModel.ts";
import { fundingFixture } from "../fixtures/goalFunding.ts";

test("live PostgreSQL funding writes, fresh-service reload, RLS and history inside an always-rolled-back fixture transaction", { skip: process.env.VIREON_ENABLE_LIVE_FUNDING_TESTS !== "true", timeout: 120000 }, async () => {
  const runtime = new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv()), a = randomUUID(), b = randomUUID(), rollback = new Error("ROLLBACK_SYNTHETIC_FUNDING_FIXTURES");
  let complete = false;
  await assert.rejects(() => runtime.transaction(async tx => {
    for (const id of [a, b]) { await tx.query("select set_config('app.current_user_id', $1, true)", [id]); await tx.query("insert into users(id,email,display_name,source) values($1,$2,'Synthetic funding fixture','goal-funding-test')", [id, `${id}@funding-fixture.invalid`]); }
    const service = createGoalFundingPostgresService(tx, async s => goalFundingReadModelFixture(s.userId!)), session = (userId: string) => ({ userId, expiresAt: "2027-01-01T00:00:00Z" });
    const vault=createFinancialVaultPostgresService(tx), retirement={retirementDate:"2040-11-03",monthlyIncome:2000,monthlyExpenses:1500};
    await vault.saveRetirementGoals(session(a), retirement);
    const persistedRetirement=await createFinancialVaultPostgresService(tx).getRetirementGoals(session(a));
    assert.equal(persistedRetirement?.retirementDate,retirement.retirementDate);assert.equal(persistedRetirement?.monthlyIncome,2000);assert.equal(persistedRetirement?.monthlyExpenses,1500);assert.equal(await vault.getRetirementGoals(session(b)),null);
    const initial = await service.read(session(a)), plan = fundingFixture().plan;
    await service.save(session(a), { action: "alternative", plan, expectedRevision: initial.revision, requestId: randomUUID(), name: "Synthetic offset alternative" });
    const adopted = await service.save(session(a), { action: "adopt", plan, expectedRevision: initial.revision, requestId: randomUUID() });
    const reloaded = await createGoalFundingPostgresService(tx, async s => goalFundingReadModelFixture(s.userId!)).read(session(a));
    assert.deepEqual(reloaded.plan, plan); assert.equal(reloaded.alternatives.length, 1); assert.equal(reloaded.history.length, 1); assert.notEqual(adopted.revision, initial.revision);
    const other = await service.read(session(b)); assert.equal(other.plan.goals.length, 0); assert.equal(other.alternatives.length, 0); assert.equal(other.history.length, 0);
    await tx.query("select set_config('app.current_user_id', $1, true)", [b]);
    assert.equal((await tx.query("select id from goals where user_id = $1", [a])).rows.length, 0, "RLS hides other-user goals even when explicitly queried");
    await tx.query("select set_config('app.current_user_id', $1, true)", [a]);
    assert.equal((await tx.query("select id from financial_facts where user_id = $1", [a])).rows.length, 0);
    complete = true; throw rollback;
  }), error => error === rollback);
  assert.equal(complete, true);
  await runtime.transaction(async tx => { await tx.query("select set_config('app.current_user_id', $1, true)", [a]); for (const table of ["users", "goals", "user_preferences", "timeline_events", "migration_runs"]) assert.equal((await tx.query(`select id from ${table} where ${table === "users" ? "id" : "user_id"} = $1`, [a])).rows.length, 0, "fixture rollback left no rows"); });
});
