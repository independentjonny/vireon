import test from "node:test";
import assert from "node:assert/strict";
import { confirmedBalance, confirmedPositionSummary } from "../../src/lib/confirmedPositionSummary.ts";
import { buildFinancialPositionReadModel } from "../../src/server/services/financialPositionReadService.ts";
import { createEmptyFinancialVaultState } from "../../src/lib/financialVaultEmptyState.ts";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";
const record = (id: string, kind: CanonicalFinancialRecord["kind"], value: Record<string, unknown>): CanonicalFinancialRecord => ({ id, userId: "qa", kind, subtype: kind, label: id, value, provenance: { userConfirmed: true, sourceType: "MANUAL", confidence: 1, ingestionId: "qa", sourceField: "qa" }, createdAt: "2026-09-25", updatedAt: "2026-09-25", superseded: false, approximate: false, history: [] });
const model = (canonical: CanonicalFinancialRecord[]) => buildFinancialPositionReadModel({ userId: "qa", vault: createEmptyFinancialVaultState(), canonical, freshness: [], ingestions: [] });
test("missing balances remain unavailable, while confirmed zero wins over alternative fields", () => {
 assert.equal(confirmedBalance(record("cash", "account", { balance: 0, amount: 99 })), 0);
 assert.equal(confirmedBalance(record("loan", "liability", { monthlyRepayment: 2000 })), null);
 assert.equal(confirmedBalance(record("cash", "account", { balance: " " })), null);
 assert.equal(confirmedPositionSummary(model([])).netPosition, null);
 assert.equal(confirmedPositionSummary(model([record("cash", "account", { balance: 500 })])).netPosition, null);
 const zero = confirmedPositionSummary(model([record("cash", "account", { balance: 0 }), record("loan", "liability", { balance: 0 })]));
 assert.equal(zero.netPosition, 0); assert.equal(zero.assetGroups[0].value, null);
});
test("shared summaries preserve negative position and exclude stale or estimated records", () => {
 const input=model([record("cash", "account", { balance: 100 }), record("loan", "liability", { balance: 500 }), { ...record("car", "asset", { value: 9000 }), approximate: true }]);
 assert.equal(confirmedPositionSummary(input).netPosition, -400);
 input.staleDataSummary.staleRecordIds = ["cash"];
 assert.equal(confirmedPositionSummary(input).assets, null);
});
