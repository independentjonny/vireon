import assert from "node:assert/strict";
import test from "node:test";
import { buildFinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import { FinancialForecastingEngine } from "@/lib/financialForecasting";
import { GoalPlanningEngine, createGoal } from "@/lib/goalPlanning";
import { buildFinancialHealthIndicators } from "@/app/components/FinancialHealthIndicatorsWidget";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";

const userId = "health-indicators-user";
const at = "2026-08-25T00:00:00.000Z";

function record(id: string, kind: CanonicalFinancialRecord["kind"], subtype: string, label: string, value: Record<string, unknown>): CanonicalFinancialRecord {
  return { id, userId, kind, subtype, label, value, provenance: { ingestionId: "manual", sourceField: "manual", confidence: 1, userConfirmed: true, sourceType: "MANUAL" }, createdAt: at, updatedAt: at, superseded: false, approximate: false, history: [] };
}

test("financial health widget presents the requested five dashboard indicators", () => {
  const records = [
    record("income", "income", "salary", "Salary", { monthlyAmount: 10000 }),
    record("expense", "expense", "living", "Living costs", { monthlyAmount: 6400 }),
    record("cash", "account", "cash", "Offset", { balance: 37120 }),
    record("debt", "liability", "loan", "Vehicle loan", { balance: 14400 }),
    record("etf", "asset", "etf", "ETF portfolio", { marketValue: 90000 }),
    record("shares", "asset", "shares", "Australian shares", { marketValue: 60000 }),
  ];
  const health = buildFinancialHealthSnapshot({ userId, records, asOf: at });
  const retirement = createGoal({ userId, type: "RETIREMENT", title: "Retire at 60", targetAmount: 1000000, currentAmount: 780000, targetDate: "2046-08-01", contributionAmount: 1500 });
  const forecast = FinancialForecastingEngine.generate(FinancialForecastingEngine.buildInput({ userId, records, startDate: "2026-08-01", horizon: "12m" }));
  const goals = GoalPlanningEngine.buildSnapshot({ userId, goals: [retirement], forecast });
  const indicators = buildFinancialHealthIndicators(health, goals);

  assert.deepEqual(indicators.map((item) => item.label), ["Savings rate", "Debt to income", "Emergency fund", "Investment allocation", "Retirement progress"]);
  assert.deepEqual(indicators.map((item) => item.value), ["36%", "12%", "5.8 months", "Diversified", "78% of target"]);
  assert.deepEqual(indicators.map((item) => item.assessment), ["Excellent", "Low", "Good", "Good", "Monitor"]);
});

test("financial health widget fails closed when confirmed inputs are missing", () => {
  const health = buildFinancialHealthSnapshot({ userId, records: [], asOf: at });
  const forecast = FinancialForecastingEngine.generate(FinancialForecastingEngine.buildInput({ userId, records: [], startDate: "2026-08-01", horizon: "12m" }));
  const goals = GoalPlanningEngine.buildSnapshot({ userId, goals: [], forecast });
  assert.ok(buildFinancialHealthIndicators(health, goals).every((item) => /Needs/.test(item.value) || /Needs/.test(item.assessment)));
});
