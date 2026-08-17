import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyCashFlowModel } from "../../src/lib/monthlyCashFlow.ts";
import type { CanonicalFinancialRecord } from "../../src/lib/manualFinancialDataPlatform.ts";

const userId = "11111111-1111-4111-a111-111111111111";

function record(id: string, kind: CanonicalFinancialRecord["kind"], value: Record<string, unknown>, input: Partial<CanonicalFinancialRecord> = {}): CanonicalFinancialRecord {
  return {
    id,
    userId,
    kind,
    subtype: kind,
    label: id,
    value,
    provenance: { ingestionId: "ingestion-test", sourceField: "manual-entry", confidence: 1, userConfirmed: true, sourceType: "MANUAL" },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    superseded: false,
    approximate: false,
    history: [],
    ...input,
  };
}

test("calculates confirmed monthly cash flow from explicit monthly records", () => {
  const model = buildMonthlyCashFlowModel([
    record("salary", "income", { monthlyAmount: 12000 }),
    record("living", "expense", { monthlyAmount: 5000 }),
  ], userId);
  assert.equal(model.monthlyIncome, 12000);
  assert.equal(model.monthlyExpenses, 5000);
  assert.equal(model.monthlySurplus, 7000);
  assert.equal(model.status, "confirmed");
});

test("normalises supported cadences and excludes one-off or cadence-free amounts", () => {
  const model = buildMonthlyCashFlowModel([
    record("annual-salary", "income", { annualAmount: 144000 }),
    record("fortnightly-income", "income", { amount: 1000, frequency: "fortnightly" }),
    record("weekly-expense", "expense", { amount: 500, cadence: "weekly" }),
    record("one-off", "income", { amount: 300, cadence: "one-off" }),
    record("unknown", "expense", { amount: 100 }),
  ], userId);
  assert.equal(model.monthlyIncome, 12000 + (1000 * 26) / 12);
  assert.equal(model.monthlyExpenses, null);
  assert.equal(model.monthlySurplus, null);
  assert.deepEqual(model.excludedRecordIds.sort(), ["one-off", "unknown"]);
  assert.equal(model.status, "unavailable");
});

test("does not invent a surplus when either recurring side is missing", () => {
  const model = buildMonthlyCashFlowModel([record("salary", "income", { monthlyAmount: 12000 })], userId);
  assert.equal(model.monthlyIncome, 12000);
  assert.equal(model.monthlyExpenses, null);
  assert.equal(model.monthlySurplus, null);
  assert.equal(model.status, "unavailable");
});

test("uses monthly transaction averages only as an estimated fallback", () => {
  const model = buildMonthlyCashFlowModel([
    record("jan-income", "transaction", { date: "2026-01-03", amount: 8000 }),
    record("jan-expense", "transaction", { date: "2026-01-04", amount: -4000 }),
    record("feb-income", "transaction", { date: "2026-02-03", amount: 10000 }),
    record("feb-expense", "transaction", { date: "2026-02-04", amount: -6000 }),
  ], userId);
  assert.equal(model.monthlyIncome, 9000);
  assert.equal(model.monthlyExpenses, 5000);
  assert.equal(model.monthlySurplus, 4000);
  assert.equal(model.status, "estimated");
});

test("explicit recurring records take precedence over transactions and users remain isolated", () => {
  const model = buildMonthlyCashFlowModel([
    record("salary", "income", { monthlyAmount: 12000 }),
    record("living", "expense", { monthlyAmount: 5000 }),
    record("transaction-income", "transaction", { date: "2026-01-03", amount: 9000 }),
    record("transaction-expense", "transaction", { date: "2026-01-04", amount: -4000 }),
    record("other-user-income", "income", { monthlyAmount: 999999 }, { userId: "22222222-2222-4222-a222-222222222222" }),
  ], userId);
  assert.equal(model.monthlySurplus, 7000);
  assert.deepEqual(model.sourceRecordIds.sort(), ["living", "salary"]);
});

test("includes confirmed rent, investment distributions and mortgage repayments without counting asset growth", () => {
  const model = buildMonthlyCashFlowModel([
    record("salary", "income", { annualAmount: 144000 }, { subtype: "salary", label: "Salary" }),
    record("home", "asset", { marketValue: 920000, rentalIncome: false }, { subtype: "property", label: "Home" }),
    record("rental", "asset", { marketValue: 630000, rentalIncome: true, rentalIncomeAmount: 500, rentalIncomeFrequency: "Weekly" }, { subtype: "property", label: "Rental unit" }),
    record("portfolio", "asset", { marketValue: 480000, distributionAmount: 3000, distributionFrequency: "Quarterly" }, { subtype: "investment", label: "ETF portfolio" }),
    record("mortgage", "liability", { balance: 245000, repaymentAmount: 450, repaymentFrequency: "Weekly" }, { subtype: "mortgage", label: "Rental unit home loan" }),
    record("living", "expense", { monthlyAmount: 5000 }),
  ], userId);
  assert.equal(model.monthlyIncome, 12000 + (500 * 52) / 12 + 1000);
  assert.equal(model.monthlyExpenses, 5000 + (450 * 52) / 12);
  assert.equal(model.incomeLines.some((line) => line.category === "rental"), true);
  assert.equal(model.incomeLines.some((line) => line.category === "investment"), true);
  assert.equal(model.expenseLines.some((line) => line.category === "mortgage"), true);
  assert.equal(model.incomeLines.some((line) => [920000, 630000, 480000].includes(line.monthlyAmount)), false);
  assert.equal(model.status, "confirmed");
});

test("transaction fallback includes classified cash income and excludes transfers, reimbursements, refunds and sale proceeds", () => {
  const model = buildMonthlyCashFlowModel([
    record("salary-tx", "transaction", { date: "2026-01-02", description: "Salary deposit", amount: 8000 }),
    record("rent-tx", "transaction", { date: "2026-01-03", description: "Rental income", amount: 2000 }),
    record("reimbursement-tx", "transaction", { date: "2026-01-04", description: "Expense reimbursement", amount: 300 }),
    record("transfer-in", "transaction", { date: "2026-01-05", description: "Internal transfer", amount: 5000 }),
    record("sale-tx", "transaction", { date: "2026-01-06", description: "Asset sale proceeds", amount: 50000 }),
    record("spend-tx", "transaction", { date: "2026-01-07", description: "Living costs", amount: -4000 }),
    record("transfer-out", "transaction", { date: "2026-01-08", description: "Transfer to savings", amount: -1000 }),
  ], userId);
  assert.equal(model.monthlyIncome, 10000);
  assert.equal(model.monthlyExpenses, 4000);
  assert.equal(model.monthlySurplus, 6000);
  assert.deepEqual(model.excludedRecordIds.sort(), ["reimbursement-tx", "sale-tx", "transfer-in", "transfer-out"]);
  assert.equal(model.status, "estimated");
});

test("a rent flag without amount and cadence is disclosed rather than invented", () => {
  const model = buildMonthlyCashFlowModel([
    record("salary", "income", { monthlyAmount: 12000 }),
    record("rental", "asset", { rentalIncome: true }, { subtype: "property", label: "Rental unit" }),
    record("living", "expense", { monthlyAmount: 5000 }),
  ], userId);
  assert.equal(model.monthlyIncome, null);
  assert.equal(model.monthlySurplus, null);
  assert.equal(model.warnings.some((warning) => warning.includes("marked as earning rent")), true);
});

test("a mortgage without repayment amount and cadence does not produce a falsely complete surplus", () => {
  const model = buildMonthlyCashFlowModel([
    record("salary", "income", { monthlyAmount: 12000 }),
    record("living", "expense", { monthlyAmount: 5000 }),
    record("mortgage", "liability", { balance: 245000 }, { subtype: "mortgage", label: "Home loan" }),
  ], userId);
  assert.equal(model.monthlyExpenses, null);
  assert.equal(model.monthlySurplus, null);
  assert.equal(model.status, "unavailable");
  assert.equal(model.warnings.some((warning) => warning.includes("mortgage has no usable repayment")), true);
});
