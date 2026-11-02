import type { CanonicalFinancialRecord } from "./manualFinancialDataPlatform";
import { confirmedBalance } from "./confirmedPositionSummary.ts";
import { monthlyRecurringAmount } from "./monthlyCashFlow.ts";

// Coverage describes recorded areas, never overall completeness or financial readiness.
export function setupProgress(records: CanonicalFinancialRecord[], now: number) {
  const active = records.filter(record => record.provenance.userConfirmed && !record.superseded && !record.approximate
    && Date.parse(record.updatedAt) >= now - 180 * 86400000
    && (typeof record.value.asOfDate !== "string" || Date.parse(record.value.asOfDate) >= now - 180 * 86400000));
  const recurring = (kind: "income" | "expense") => active.some(record => record.kind === kind && monthlyRecurringAmount(record) !== null);
  const balance = (kinds: string[]) => active.some(record => kinds.includes(record.kind) && confirmedBalance(record) !== null);
  const steps = [
    { id: "income", label: "Add your income", detail: "Take-home pay and how often it arrives.", complete: recurring("income"), href: "/financial-profile/add-data?category=income" },
    { id: "expenses", label: "Add your expenses", detail: "Regular living costs and payment frequency.", complete: recurring("expense"), href: "/financial-profile/add-data?category=expenses" },
    { id: "balances", label: "Add assets and debts", detail: "What you own and owe. Confirm zero if you have no debts.", complete: balance(["asset", "account"]) && balance(["liability"]), href: "/financial-profile/add-data?category=bank" },
  ];
  return { steps, recorded: steps.filter(step => step.complete).length, next: steps.find(step => !step.complete) };
}
