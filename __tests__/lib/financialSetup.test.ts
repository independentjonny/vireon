import assert from "node:assert/strict";
import { it } from "node:test";
import { randomUUID } from "node:crypto";
import { suggestSetupEntries, validateSetupEntries, type SetupDraft, type SetupEntry } from "../../src/lib/financialSetup.ts";
import { createFinancialVaultPostgresService } from "../../src/server/services/financialVaultPostgresService.ts";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";

const userA = { userId: "11111111-1111-4111-8111-111111111111", expiresAt: "2099-01-01" };
const userB = { userId: "22222222-2222-4222-8222-222222222222", expiresAt: "2099-01-01" };
const entry = (patch: Partial<SetupEntry> = {}): SetupEntry => ({ id: randomUUID(), category: "bank", label: "Everyday account", amount: "2500", frequency: "", asOfDate: "2026-01-01", ownership: "Sole", source: "Manual entry", snippet: "", replaceId: "", replaceUpdatedAt: "", included: true, ...patch });
const draft = (entries = [entry()]): SetupDraft => ({ id: randomUUID(), revision: 0, status: "draft", updatedAt: "", files: [], entries });

// Durable shared store; each service instance is recreated against it. Transactions roll back all writes on error.
class SetupDb implements PostgresPilotClient {
  drafts = new Map<string, { userId: string; draft: SetupDraft }>();
  facts: Array<{ id: string; userId: string; record: CanonicalFinancialRecord; version: number }> = [];
  versions: unknown[][] = [];
  scopedUser = "";
  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    const before = structuredClone({ drafts: this.drafts, facts: this.facts, versions: this.versions });
    try { return await operation(this); }
    catch (error) { this.drafts = before.drafts; this.facts = before.facts; this.versions = before.versions; throw error; }
    finally { this.scopedUser = ""; }
  }
  async query<T>(sql: string, p: unknown[] = []): Promise<QueryResult<T>> {
    const rows = (value: unknown[]): QueryResult<T> => ({ rows: value as T[] });
    if (sql.includes("set_config")) { this.scopedUser = String(p[0]); return rows([]); }
    assert.ok(this.scopedUser, "queries require a transaction-local user");
    if (sql.includes("select preview from migration_runs")) return rows([...this.drafts.values()].filter(row => row.userId === p[0] && (!sql.includes("id = $2") || row.draft.id === p[1])).map(row => ({ preview: structuredClone(row.draft) })));
    if (sql.includes("insert into migration_runs")) {
      const current = this.drafts.get(String(p[0]));
      if (current && current.userId !== p[1]) return rows([]);
      this.drafts.set(String(p[0]), { userId: String(p[1]), draft: JSON.parse(String(p[3])) }); return rows([{ id: p[0] }]);
    }
    if (sql.includes("select fact_value as record")) return rows(this.facts.filter(row => row.userId === p[0]).map(row => ({ record: structuredClone(row.record) })));
    if (sql.includes("insert into financial_facts")) { const fact = { id: randomUUID(), userId: String(p[0]), record: JSON.parse(String(p[2])), version: 1 }; this.facts.push(fact); return rows([{ id: fact.id, version: 1 }]); }
    if (sql.includes("update financial_facts")) {
      const fact = this.facts.find(row => row.userId === p[2] && row.record.id === p[3] && row.record.updatedAt === p[4]);
      if (!fact) return rows([]);
      fact.record = JSON.parse(String(p[0])); fact.version++; return rows([{ id: fact.id, version: fact.version }]);
    }
    if (sql.includes("insert into fact_versions")) this.versions.push(p);
    return rows([]);
  }
}

it("requires explicit numeric values, dates, ownership and recurring frequency", () => {
  for (const patch of [{ amount: "" }, { amount: "-1" }, { amount: "Infinity" }, { asOfDate: "2026-02-30" }, { asOfDate: "2099-01-01" }, { ownership: "" }, { category: "income" as const, frequency: "" }]) assert.throws(() => validateSetupEntries([entry(patch)]));
  assert.doesNotThrow(() => validateSetupEntries([entry({ amount: "0" })]));
  assert.throws(() => validateSetupEntries([entry(), entry()]));
});
it("suggests only explicit labelled values and leaves dates and frequency unanswered", () => {
  const proposed = suggestSetupEntries("Statement closing balance: $2,345.67 Net pay: $1,500.00", "statement.txt");
  assert.equal(proposed.length, 2); assert.equal(proposed[0].amount, "2345.67");
  assert.ok(proposed.every(row => !row.asOfDate && !row.ownership && !row.frequency));
  assert.equal(suggestSetupEntries("Credits $1000.00 and debits $200.00", "bank.csv").length, 0);
});
it("saves incomplete drafts without changing financial facts, survives service recreation and isolates users", async () => {
  const db = new SetupDb(); const first = createFinancialVaultPostgresService(db);
  const saved = await first.saveSetup(userA, draft([entry({ amount: "" })]));
  assert.equal(db.facts.length, 0);
  const restarted = createFinancialVaultPostgresService(db);
  assert.equal((await restarted.getSetup(userA)).drafts[0].id, saved.id);
  assert.equal((await restarted.getSetup(userB)).drafts.length, 0);
});
it("confirms once, records provenance and supports idempotent retry", async () => {
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db), pending = draft();
  const confirmed = await service.saveSetup(userA, pending, true);
  assert.equal(confirmed.confirmedCount, 1); assert.equal(db.facts.length, 1);
  assert.equal(db.facts[0].record.provenance.userConfirmed, true); assert.equal(db.versions.length, 1);
  await service.saveSetup(userA, pending, true); assert.equal(db.facts.length, 1);
});
it("updates an existing balance without double counting and appends its history", async () => {
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db);
  await service.saveSetup(userA, draft(), true); const original = structuredClone(db.facts[0].record);
  await service.saveSetup(userA, draft([entry({ amount: "3100", replaceId: original.id, replaceUpdatedAt: original.updatedAt })]), true);
  assert.equal(db.facts.length, 1); assert.equal(db.facts[0].record.value.balance, 3100); assert.equal(db.facts[0].record.history.length, 2); assert.equal(db.versions.length, 2);
});
it("rejects stale drafts and duplicate account creation", async () => {
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db), pending = draft();
  await service.saveSetup(userA, pending); await assert.rejects(service.saveSetup(userA, pending), /another tab/);
  await service.saveSetup(userA, draft(), true); await assert.rejects(service.saveSetup(userA, draft(), true), /already exists/);
  assert.equal(db.facts.length, 1);
});
it("rolls back the whole confirmation if any replacement is unavailable or belongs to another user", async () => {
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db);
  await service.saveSetup(userB, draft(), true); const other = db.facts[0].record;
  await assert.rejects(service.saveSetup(userA, draft([entry({ label: "New account" }), entry({ replaceId: other.id, replaceUpdatedAt: other.updatedAt })]), true), /unavailable/);
  assert.equal(db.facts.length, 1); assert.equal((await service.getSetup(userA)).records.length, 0);
});
it("does not overwrite another user's draft even when its UUID is supplied", async () => {
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db), pending = draft();
  await service.saveSetup(userB, pending);
  await assert.rejects(service.saveSetup(userA, pending, true), /unavailable/);
  assert.equal(db.facts.length, 0); assert.equal((await service.getSetup(userB)).drafts[0].status, "draft");
});
it("clears obsolete monthly aliases when updating recurring amounts", async () => {
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db);
  await service.saveSetup(userA, draft([entry({ category: "income", frequency: "monthly" })]), true);
  const old = db.facts[0].record; old.value.monthlyAmount = 999;
  await service.saveSetup(userA, draft([entry({ category: "income", frequency: "fortnightly", amount: "2000", replaceId: old.id, replaceUpdatedAt: old.updatedAt })]), true);
  assert.equal(db.facts[0].record.value.monthlyAmount, undefined); assert.equal(db.facts[0].record.value.frequency, "fortnightly");
});
it("keeps the marketValue field required by existing property editing", async () => {
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db);
  await service.saveSetup(userA, draft([entry({ category: "property", amount: "500000", mortgageAmount: "0" })]), true);
  assert.equal(db.facts[0].record.value.marketValue, 500000);
  assert.equal(db.facts[0].record.value.balance, undefined);
});

it("saves and updates property and mortgage atomically without duplicate debts", async () => {
  assert.throws(() => validateSetupEntries([entry({ category: "property" })]), /mortgage/);
  assert.throws(() => validateSetupEntries([entry({ category: "property", mortgageAmount: "-1" })]), /mortgage/);
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db);
  const pending = draft([entry({ category: "property", label: "Home", amount: "800000", mortgageAmount: "300000", repaymentAmount: "2000", repaymentFrequency: "monthly" })]);
  assert.equal((await service.saveSetup(userA, pending, true)).confirmedCount, 2);
  const [property, mortgage] = db.facts.map(f => structuredClone(f.record));
  assert.equal(mortgage.value.balance, 300000); assert.equal(mortgage.kind, "liability"); assert.equal(mortgage.value.repaymentAmount, 2000); assert.equal(mortgage.value.repaymentFrequency, "monthly");
  assert.equal(mortgage.value.propertyEntityKey, property.value.entityKey);
  await service.saveSetup(userA, pending, true); assert.equal(db.facts.length, 2);
  const update = entry({ category: "property", label: "Home", amount: "850000", mortgageAmount: "290000", repaymentAmount: "550", repaymentFrequency: "weekly", replaceId: property.id, replaceUpdatedAt: property.updatedAt, mortgageReplaceId: mortgage.id, mortgageReplaceUpdatedAt: mortgage.updatedAt });
  await assert.rejects(service.saveSetup(userA, draft([{ ...update, mortgageReplaceUpdatedAt: "stale" }]), true), /mortgage/);
  assert.equal(db.facts[0].record.value.marketValue, 800000);
  await service.saveSetup(userA, draft([update]), true);
  assert.equal(db.facts.length, 2); assert.equal(db.facts[0].record.value.marketValue, 850000); assert.equal(db.facts[1].record.value.balance, 290000); assert.equal(db.facts[1].record.value.repaymentAmount, 550); assert.equal(db.facts[1].record.value.repaymentFrequency, "weekly");
});

it("feeds saved repayments into monthly surplus and allows an explicitly paid-off mortgage", async () => {
  const { buildMonthlyCashFlowModel } = await import("../../src/lib/monthlyCashFlow.ts");
  const db = new SetupDb(), service = createFinancialVaultPostgresService(db);
  const home = entry({ category: "property", label: "Home", amount: "800000", mortgageAmount: "300000", repaymentAmount: "2000", repaymentFrequency: "monthly" });
  assert.throws(() => validateSetupEntries([{ ...home, repaymentAmount: "" }]), /repayment/);
  assert.throws(() => validateSetupEntries([{ ...home, repaymentFrequency: "" }]), /repayment/);
  await service.saveSetup(userA, draft([home, entry({ category: "income", label: "Salary", amount: "8000", frequency: "monthly" }), entry({ category: "expenses", label: "Living", amount: "2500", frequency: "monthly" })]), true);
  const flow = buildMonthlyCashFlowModel(db.facts.map(f => f.record), userA.userId);
  assert.equal(flow.monthlyExpenses, 4500); assert.equal(flow.monthlySurplus, 3500);
  const property = db.facts[0].record, mortgage = db.facts[1].record;
  await service.saveSetup(userA, draft([{ ...home, mortgageAmount: "0", repaymentAmount: "", repaymentFrequency: "", replaceId: property.id, replaceUpdatedAt: property.updatedAt, mortgageReplaceId: mortgage.id, mortgageReplaceUpdatedAt: mortgage.updatedAt }]), true);
  const paidOff = buildMonthlyCashFlowModel(db.facts.map(f => f.record), userA.userId);
  assert.equal(paidOff.monthlyExpenses, 2500); assert.equal(paidOff.monthlySurplus, 5500);
});
