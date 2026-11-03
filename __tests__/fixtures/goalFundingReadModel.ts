import { buildFinancialPositionReadModel } from "../../src/server/services/financialPositionReadService.ts";
import { createEmptyFinancialVaultState } from "../../src/lib/financialVaultEmptyState.ts";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";
export function goalFundingReadModelFixture(userId: string) {
  function record(id: string, kind: CanonicalFinancialRecord["kind"], subtype: string, value: Record<string, unknown>): CanonicalFinancialRecord { return { id, userId, kind, subtype, label: id, value, provenance: { ingestionId: "fixture", sourceType: "MANUAL", sourceField: "fixture", confidence: 100, userConfirmed: true }, approximate: false, superseded: false, createdAt: "2026-11-03T00:00:00Z", updatedAt: "2026-11-03T00:00:00Z", history: [] }; }
  const records = [record("savings", "account", "savings", { balance: 20000, interestRate: 4 }), record("offset", "account", "offset", { balance: 20000, interestRate: 0, linkedMortgageId: "mortgage", offsetPercent: 100 }), record("mortgage", "liability", "mortgage", { balance: 100000, interestRate: 6, monthlyRepayment: 1000, repaymentType: "Principal and interest", remainingMonths: 360, paymentAccountId: "savings" }), record("house", "asset", "property", { marketValue: 200000 }), record("salary", "income", "salary", { monthlyAmount: 5000 }), record("living", "expense", "living", { monthlyAmount: 2000, essential: true })];
  const position = buildFinancialPositionReadModel({ userId, vault: createEmptyFinancialVaultState(), canonical: records, freshness: [], ingestions: [] }); position.generatedAt = "2026-11-03T01:00:00Z";
  return { position, trajectory: null, retirement: { retirementDate: "2030-11-03", monthlyIncome: 2500, monthlyExpenses: 1800 } };
}
