import { ManualFinancialDataPlatform } from "./manualFinancialDataPlatform.ts";

export function buildManualDataDemo() {
  const platform = new ManualFinancialDataPlatform();
  platform.manualRecord("demo-user", { kind: "household", subtype: "primary", label: "Alex and household", value: { adults: 2, dependants: 1, postcode: "2000" } });
  platform.manualRecord("demo-user", { kind: "income", subtype: "salary", label: "Primary salary", value: { annualAmount: 145000, employer: "Synthetic Design Pty Ltd" } });
  platform.manualRecord("demo-user", { kind: "account", subtype: "savings", label: "Emergency savings", value: { balance: 18200, currency: "AUD", lastUpdatedAt: "2026-07-24" } });
  platform.manualRecord("demo-user", { kind: "liability", subtype: "credit_card", label: "Rewards card", value: { balance: 4200, interestRate: 19.99, currency: "AUD" } });
  platform.manualRecord("demo-user", { kind: "expense", subtype: "household", label: "Household expenses", value: { monthlyAmount: 6800, currency: "AUD" } });
  const ingestion = platform.createIngestion({ userId: "demo-user", sourceType: "CSV", fileName: "synthetic-australian-bank.csv", mimeType: "text/csv", fileHash: "demo-fixture-hash", periodStart: "2026-06-01", periodEnd: "2026-06-30" });
  const mapping = { Date: "date", Description: "description", Debit: "debit", Credit: "credit" };
  platform.previewCsv("demo-user", ingestion.id, "Date,Description,Debit,Credit\n01/06/2026,Salary,,8450.00\n02/06/2026,Mortgage repayment,3860.00,\n05/06/2026,Groceries,212.40,", mapping);
  platform.stageTransactions("demo-user", ingestion.id, mapping);
  return platform;
}
