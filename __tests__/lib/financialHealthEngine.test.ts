import assert from "node:assert/strict";
import test from "node:test";
import { ManualFinancialDataPlatform } from "../../src/lib/manualFinancialDataPlatform.ts";
import { buildFinancialHealthSnapshot, FINANCIAL_HEALTH_ENGINE_VERSION } from "../../src/lib/financialHealthEngine.ts";

test("cash-only profiles are insufficient for a financial health rating", () => {
  const platform = new ManualFinancialDataPlatform();
  platform.manualRecord("u1", { kind: "account", subtype: "cash", label: "Savings", value: { balance: 13000 } });
  const snapshot = platform.financialHealth("u1");
  assert.equal(snapshot.healthRating, "Insufficient Data");
  assert.equal(snapshot.healthScore, 0);
});

test("manual health cash flow uses the same cadence and debt repayments as Cash Flow", () => {
  const platform = new ManualFinancialDataPlatform();
  platform.manualRecord("u1", { kind: "account", subtype: "cash", label: "Savings", value: { balance: 12000 } });
  platform.manualRecord("u1", { kind: "income", subtype: "salary", label: "Weekly salary", value: { amount: 2800, frequency: "weekly" } });
  platform.manualRecord("u1", { kind: "expense", subtype: "living", label: "Living", value: { monthlyAmount: 2500 } });
  platform.manualRecord("u1", { kind: "liability", subtype: "loan", label: "Personal loan", value: { balance: 10000, repaymentAmount: 500, repaymentFrequency: "monthly" } });
  const snapshot = platform.financialHealth("u1");
  assert.equal(snapshot.cashFlow.averageMonthlyIncome.value, 12133.33);
  assert.equal(snapshot.cashFlow.averageMonthlySpending.value, 3000);
  assert.equal(snapshot.cashFlow.monthlySurplus.value, 9133.33);
});

function platformWithHealthData() {
  const platform = new ManualFinancialDataPlatform();
  const csv = [
    "Date,Description,Debit,Credit",
    "01/05/2026,Salary,,8000",
    "03/05/2026,Mortgage repayment,2500,",
    "05/05/2026,Netflix,25,",
    "10/05/2026,Dining,600,",
    "01/06/2026,Salary,,8200",
    "03/06/2026,Mortgage repayment,2500,",
    "05/06/2026,Netflix,25,",
    "10/06/2026,Dining,900,",
  ].join("\n");
  const mapping = { Date: "date", Description: "description", Debit: "debit", Credit: "credit" };
  const ingestion = platform.createIngestion({ userId: "u1", sourceType: "CSV", fileName: "bank.csv", mimeType: "text/csv" });
  platform.previewCsv("u1", ingestion.id, csv, mapping);
  const candidates = platform.stageTransactions("u1", ingestion.id, mapping);
  platform.review("u1", ingestion.id, candidates.map((candidate) => ({ candidateId: candidate.id, action: "accept" as const })));
  platform.confirm("u1", ingestion.id);
  platform.manualRecord("u1", { kind: "account", subtype: "cash", label: "Offset", value: { balance: 7500 } });
  platform.manualRecord("u1", { kind: "asset", subtype: "super", label: "Super", value: { balance: 60000 } });
  platform.manualRecord("u1", { kind: "asset", subtype: "property", label: "Home", value: { marketValue: 700000 } });
  platform.manualRecord("u1", { kind: "liability", subtype: "mortgage", label: "Home loan", value: { balance: 520000, interestRate: 6.4, monthlyPayment: 2500 } });
  platform.manualRecord("u1", { kind: "liability", subtype: "credit_card", label: "Card", value: { balance: 4200, interestRate: 19.9, limit: 8000 } });
  return platform;
}

test("Financial Health Engine calculates cash flow after confirmed import", () => {
  const platform = platformWithHealthData();
  const health = platform.financialHealth("u1");

  assert.equal(health.engineVersion, FINANCIAL_HEALTH_ENGINE_VERSION);
  assert.equal(health.transactionCount, 8);
  assert.equal(health.cashFlow.averageMonthlyIncome.value, 8100);
  assert.equal(health.cashFlow.averageMonthlySpending.value, 3275);
  assert.equal(health.cashFlow.monthlySurplus.value, 4825);
  assert.equal(health.cashFlow.savingsRate.value, 59.57);
  assert.equal(health.periodStart, "2026-05-01");
  assert.equal(health.periodEnd, "2026-06-10");
});

test("Financial Health Engine detects spending, subscriptions and trend deterministically", () => {
  const health = platformWithHealthData().financialHealth("u1");

  assert.equal(health.spending.largestCategories[0].category, "Mortgage");
  assert.ok(health.spending.subscriptions.some((subscription) => subscription.merchant === "Netflix"));
  assert.equal(health.spending.spendingTrend.value, 9.6);
  assert.ok(health.actions.some((action) => action.id === "review-subscriptions"));
});

test("Financial Health Engine calculates debt, safety and wealth metrics", () => {
  const health = platformWithHealthData().financialHealth("u1");

  assert.equal(health.debt.totalDebt.value, 524200);
  assert.equal(health.debt.estimatedMonthlyInterest.value, 2842.98);
  assert.equal(health.safety.emergencyFundMonths.value, 2.29);
  assert.equal(health.wealth.netWorth.value, 243300);
  assert.ok(health.actions.some((action) => action.id === "build-emergency-fund"));
  assert.ok(health.actions.some((action) => action.id === "review-interest-burden" && action.reviewRequired));
});

test("Financial Health Engine excludes unconfirmed and rejected candidates", () => {
  const platform = new ManualFinancialDataPlatform();
  const ingestion = platform.createIngestion({ userId: "u1", sourceType: "CSV" });
  platform.stageParsedTransactions("u1", ingestion.id, [
    { date: "2026-07-01", description: "Salary", amount: 9000 },
    { date: "2026-07-02", description: "Rent", amount: -3000 },
  ]);
  const staged = platform.candidates.get(ingestion.id)!;
  platform.review("u1", ingestion.id, [{ candidateId: staged[0].id, action: "reject" }]);

  const health = buildFinancialHealthSnapshot({ userId: "u1", records: [...platform.canonical.values()] });

  assert.equal(health.transactionCount, 0);
  assert.equal(health.recordCount, 0);
  assert.equal(health.healthRating, "Insufficient Data");
  assert.ok(health.actions.some((action) => action.id === "complete-financial-vault"));
});

test("Manual platform exposes health actions through deterministic decisions", () => {
  const decisions = platformWithHealthData().decisions("u1");

  assert.ok(decisions.some((decision) => decision.id === "health-build-emergency-fund"));
  assert.ok(decisions.some((decision) => decision.id === "health-review-interest-burden"));
});
