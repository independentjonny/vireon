import test from "node:test";
import assert from "node:assert/strict";
import { workspaceNavigation, selectedWorkspaceHref } from "../../src/lib/workspaceNavigation.ts";
import { setupProgress } from "../../src/lib/setupProgress.ts";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";

const now = Date.parse("2026-11-02T00:00:00Z");
function record(kind: CanonicalFinancialRecord["kind"], value: Record<string, unknown>, patch: Partial<CanonicalFinancialRecord> = {}): CanonicalFinancialRecord {
  return { id: crypto.randomUUID(), userId: "u", kind, label: "Record", subtype: "setup", value, provenance: { ingestionId: "i", sourceField: "manual-entry", sourceType: "MANUAL", confidence: 100, userConfirmed: true }, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", approximate: false, superseded: false, history: [], ...patch };
}
test("five shared groups keep deep links available and select the most specific route", () => {
  assert.deepEqual(workspaceNavigation.map(group => group.label), ["Overview", "Money", "Planning", "AI adviser", "Documents"]);
  assert.equal(selectedWorkspaceHref("/financial-profile/add-data"), "/financial-profile/add-data");
  assert.equal(selectedWorkspaceHref("/financial-profile/property"), "/financial-profile");
  assert.equal(selectedWorkspaceHref("/balance-sheet"), "/financial-profile");
  assert.equal(selectedWorkspaceHref("/"), "/");
  assert.equal(selectedWorkspaceHref("/accounts-unknown"), undefined);
  const links = workspaceNavigation.flatMap(group => group.items.map(item => item.href));
  assert.equal(new Set(links).size, links.length);
});
test("setup never counts missing or unconfirmed values as zero or completed", () => {
  assert.equal(setupProgress([], now).recorded, 0);
  const income = record("income", { amount: 0, frequency: "monthly" });
  assert.equal(setupProgress([income], now).recorded, 1);
  assert.equal(setupProgress([record("income", { amount: 200 })], now).recorded, 0);
  assert.equal(setupProgress([record("income", { amount: 200, frequency: "monthly", asOfDate: "2025-01-01" })], now).recorded, 0);
  for (const patch of [{ approximate: true }, { superseded: true }, { updatedAt: "2025-01-01" }, { provenance: { ...income.provenance, userConfirmed: false } }]) assert.equal(setupProgress([{ ...income, ...patch }], now).recorded, 0);
});
test("setup requires both assets and explicit debts and resumes the first missing area", () => {
  const items = [record("income", { amount: 2400, frequency: "fortnightly" }), record("expense", { annualAmount: 24000 }), record("account", { balance: 3000 })];
  assert.equal(setupProgress(items, now).next?.id, "balances");
  assert.equal(setupProgress(items, now).recorded, 2);
  items.push(record("liability", { balance: 0 }));
  assert.equal(setupProgress(items, now).recorded, 3);
  assert.equal(setupProgress(items, now).next, undefined);
});
