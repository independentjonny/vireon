import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyFinancialVaultState } from "../../src/lib/financialVaultEmptyState.ts";
import { buildFinancialPositionReadModel } from "../../src/server/services/financialPositionReadService.ts";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";

function record(input: Partial<CanonicalFinancialRecord> & { id: string; userId: string; kind: CanonicalFinancialRecord["kind"]; label: string; value: Record<string, unknown> }): CanonicalFinancialRecord {
  return {
    subtype: input.kind,
    provenance: { ingestionId: "ingestion-test", sourceField: "manual-entry", confidence: 0.95, userConfirmed: true, sourceType: "MANUAL" },
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    superseded: false,
    approximate: false,
    history: [],
    ...input,
  };
}

test("financial read model maps confirmed persisted facts by user and category", () => {
  const userId = "11111111-1111-4111-a111-111111111111";
  const otherUserId = "22222222-2222-4222-a222-222222222222";
  const vault = createEmptyFinancialVaultState("2026-07-31T00:00:00.000Z");
  vault.financial_profile.assets = 0;
  vault.financial_profile.liabilities = 0;
  const model = buildFinancialPositionReadModel({
    userId,
    vault,
    canonical: [
      record({ id: "cash-a", userId, kind: "account", label: "Offset account", value: { balance: 25000 } }),
      record({ id: "property-a", userId, kind: "asset", subtype: "property", label: "Home", value: { marketValue: 900000 } }),
      record({ id: "mortgage-a", userId, kind: "liability", subtype: "mortgage", label: "Home loan", value: { balance: 450000, repaymentAmount: 1000, repaymentFrequency: "Monthly" } }),
      record({ id: "income-a", userId, kind: "income", label: "Salary", value: { monthlyAmount: 12000 } }),
      record({ id: "expense-a", userId, kind: "expense", label: "Living costs", value: { monthlyAmount: 5000 } }),
      record({ id: "other-user", userId: otherUserId, kind: "asset", label: "Other user asset", value: { value: 999999 } }),
    ],
    ingestions: [{ status: "NEEDS_REVIEW" }],
    freshness: [{ recordId: "cash-a", stale: true }],
    correlationId: "corr-test",
    generatedAt: "2026-07-31T01:00:00.000Z",
  });

  assert.equal(model.confirmedFacts.length, 5);
  assert.equal(model.cashPosition.confirmedCash, 25000);
  assert.equal(model.netWorthInputs.assets, 925000);
  assert.equal(model.netWorthInputs.liabilities, 450000);
  assert.equal(model.netWorthInputs.netWorth, 475000);
  assert.equal(model.monthlyCashFlow.monthlyIncome, 12000);
  assert.equal(model.monthlyCashFlow.monthlyExpenses, 6000);
  assert.equal(model.monthlyCashFlow.monthlySurplus, 6000);
  assert.equal(model.monthlyCashFlow.status, "confirmed");
  assert.deepEqual(model.staleDataSummary.staleRecordIds, ["cash-a"]);
  assert.equal(model.documentImportStatus.activeImportCount, 1);
  assert.equal(model.confirmedFacts.some((item) => item.id === "other-user"), false);
});

test("financial read model distinguishes missing data from zero-valued persisted facts", () => {
  const userId = "11111111-1111-4111-a111-111111111111";
  const model = buildFinancialPositionReadModel({
    userId,
    vault: createEmptyFinancialVaultState("2026-07-31T00:00:00.000Z"),
    canonical: [],
    ingestions: [],
    freshness: [],
  });

  assert.equal(model.confirmedFacts.length, 0);
  assert.equal(model.profileSummary.completenessScore, 0);
  assert.equal(model.documentImportStatus.unresolvedExtractionReviewCount, 0);
  assert.equal(model.confidenceSummary.averageFactConfidence, 0);
  assert.equal(model.monthlyCashFlow.monthlySurplus, null);
  assert.equal(model.monthlyCashFlow.status, "unavailable");
});
