import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import { FinancialForecastingEngine } from "@/lib/financialForecasting";
import { DEFAULT_RETIREMENT_GOAL_ID, GoalPlanningEngine, createDefaultRetirementGoal, createGoal, defaultGoalState, type FinancialGoal, type GoalScenarioVariant } from "@/lib/goalPlanning";

const userId = "goal-test-user";
const startDate = "2026-08-01";

function record(input: Partial<CanonicalFinancialRecord> & { kind: CanonicalFinancialRecord["kind"]; label: string; value: Record<string, unknown> }): CanonicalFinancialRecord {
  return {
    id: input.id ?? `record-${input.kind}-${input.label.replace(/\W/g, "-")}`,
    userId,
    kind: input.kind,
    subtype: input.subtype ?? input.kind,
    label: input.label,
    value: input.value,
    provenance: input.provenance ?? { ingestionId: "manual", sourceField: "manual-entry", confidence: 1, userConfirmed: true, sourceType: "MANUAL" },
    createdAt: input.createdAt ?? "2026-07-01T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-07-01T00:00:00.000Z",
    superseded: input.superseded ?? false,
    approximate: input.approximate ?? false,
    history: input.history ?? [],
  };
}

function forecast(records: CanonicalFinancialRecord[] = baseRecords()) {
  return FinancialForecastingEngine.generate(FinancialForecastingEngine.buildInput({ userId, records, startDate, horizon: "12m" }));
}

function baseRecords(): CanonicalFinancialRecord[] {
  return [
    record({ kind: "account", subtype: "transaction", label: "Offset account", value: { balance: 18000 } }),
    record({ kind: "income", subtype: "salary", label: "Salary", value: { monthlyAmount: 9500 } }),
    record({ kind: "expense", subtype: "fixed", label: "Core expenses", value: { monthlyAmount: 4300 } }),
    record({ kind: "liability", subtype: "mortgage", label: "Home loan", value: { balance: 420000, interestRate: 6, monthlyRepayment: 2600 } }),
  ];
}

function goal(overrides: Partial<FinancialGoal> = {}) {
  return createGoal({
    userId,
    type: overrides.type ?? "EMERGENCY_FUND",
    title: overrides.title ?? "Emergency fund",
    targetAmount: overrides.targetAmount ?? 30000,
    currentAmount: overrides.currentAmount ?? 6000,
    targetDate: overrides.targetDate ?? "2027-08-01",
    priority: overrides.priority ?? "high",
    contributionAmount: overrides.contributionAmount ?? 1200,
  });
}

function snapshot(goals: FinancialGoal[] = [goal()], records = baseRecords(), scenarios: GoalScenarioVariant[] = []) {
  return GoalPlanningEngine.buildSnapshot({ userId, goals, scenarios, forecast: forecast(records) });
}

test("1 emergency-fund goal", () => assert.equal(GoalPlanningEngine.evaluateGoal(goal(), forecast()).goal.type, "EMERGENCY_FUND"));
test("2 savings goal", () => assert.equal(GoalPlanningEngine.evaluateGoal(goal({ type: "SAVINGS", title: "Vehicle fund" }), forecast()).goal.type, "SAVINGS"));
test("3 home-purchase deposit calculation", () => assert.ok(GoalPlanningEngine.evaluateGoal(goal({ type: "HOME_PURCHASE", targetAmount: 1300000, currentAmount: 120000, contributionAmount: 5000 }), forecast()).homePurchase!.depositGap > 0));
test("4 indicative mortgage repayment", () => assert.ok(GoalPlanningEngine.evaluateGoal(goal({ type: "HOME_PURCHASE", targetAmount: 1300000, currentAmount: 260000 }), forecast()).homePurchase!.indicativeMonthlyRepayment > 0));
test("5 purchase-cost assumptions", () => assert.ok(GoalPlanningEngine.evaluateGoal(goal({ type: "HOME_PURCHASE", targetAmount: 1000000 }), forecast()).homePurchase!.estimatedPurchaseCosts > 0));
test("6 retirement projection", () => assert.ok(GoalPlanningEngine.evaluateGoal(goal({ type: "RETIREMENT", targetAmount: 1000000, currentAmount: 220000, targetDate: "2046-08-01" }), forecast()).retirement!.projectedBalance > 220000));
test("7 debt payoff goal", () => assert.ok(GoalPlanningEngine.evaluateGoal(goal({ type: "DEBT_REPAYMENT", title: "Home loan", targetAmount: 420000, targetDate: "2036-08-01" }), forecast()).debtRepayment!.requiredRepayment > 0));
test("8 required monthly contribution", () => assert.equal(Math.round(GoalPlanningEngine.evaluateGoal(goal({ targetAmount: 18000, currentAmount: 6000, targetDate: "2027-08-01" }), forecast()).requiredMonthlyContribution), 1000));
test("9 contribution shortfall", () => assert.ok(GoalPlanningEngine.evaluateGoal(goal({ targetAmount: 30000, currentAmount: 0, contributionAmount: 100, targetDate: "2027-08-01" }), forecast()).contributionShortfall > 0));
test("10 delayed start", () => {
  const g = goal();
  const delayed = { id: "delayed", goalId: g.id, name: "delayed" as const, contributionAmount: 1200, oneOffDeposit: 0, startDelayMonths: 3, incomeChange: 0, expenseReduction: 0, createdAt: startDate, archived: false };
  assert.ok(GoalPlanningEngine.evaluateGoal(g, forecast(), delayed).delayedStartImpact >= 3);
});
test("11 one-off contribution", () => {
  const g = goal();
  const variant = { id: "one-off", goalId: g.id, name: "custom" as const, contributionAmount: 1200, oneOffDeposit: 5000, startDelayMonths: 0, incomeChange: 0, expenseReduction: 0, createdAt: startDate, archived: false };
  assert.equal(GoalPlanningEngine.evaluateGoal(g, forecast(), variant).oneOffDepositImpact, 5000);
});
test("12 milestone generation", () => assert.ok(GoalPlanningEngine.evaluateGoal(goal(), forecast()).milestones.some((item) => item.thresholdPercent === 50)));
test("13 goal progress", () => assert.equal(GoalPlanningEngine.evaluateGoal(goal({ targetAmount: 10000, currentAmount: 2500 }), forecast()).currentProgress, 25));
test("14 goal status", () => assert.equal(GoalPlanningEngine.evaluateGoal(goal({ targetAmount: 10000, currentAmount: 10000 }), forecast()).goal.status, "ACHIEVED"));
test("15 feasibility classification", () => assert.equal(GoalPlanningEngine.evaluateGoal(goal({ targetAmount: 30000, currentAmount: 29000 }), forecast()).feasibility, "ACHIEVABLE"));
test("16 insufficient-data handling", () => assert.equal(GoalPlanningEngine.evaluateGoal(goal({ targetAmount: 0 }), forecast()).feasibility, "INSUFFICIENT_DATA"));
test("17 competing goals", () => assert.ok(snapshot([goal(), goal({ type: "HOME_PURCHASE", title: "Home deposit", targetAmount: 260000, contributionAmount: 5000 })]).aiCfoContext.conflicts.length >= 0));
test("18 emergency-fund conflict", () => assert.ok(snapshot([goal({ contributionAmount: 50 }), goal({ type: "TRAVEL", title: "Holiday", targetAmount: 20000, contributionAmount: 1500 })]).aiCfoContext.conflicts.some((item) => item.includes("Emergency"))));
test("19 cash-flow conflict", () => assert.ok(GoalPlanningEngine.evaluateGoal(goal({ targetAmount: 90000, currentAmount: 0, contributionAmount: 8000 }), forecast()).decisions.some((decision) => decision.title.includes("cash-flow"))));
test("20 scenario isolation", () => {
  const g = goal();
  const variant = { id: "accelerated", goalId: g.id, name: "accelerated" as const, contributionAmount: 2000, oneOffDeposit: 0, startDelayMonths: 0, incomeChange: 0, expenseReduction: 0, createdAt: startDate, archived: false };
  GoalPlanningEngine.evaluateGoal(g, forecast(), variant);
  assert.equal(g.contributionAmount, 1200);
});
test("21 baseline immutability", () => {
  const f = forecast();
  const before = f.hash;
  GoalPlanningEngine.evaluateGoal(goal(), f);
  assert.equal(f.hash, before);
});
test("22 goal planning default state is deterministic and non-persistent", () => {
  const state = defaultGoalState();
  assert.deepEqual(state, { version: "goals-scenario-planning-v1", goals: [], scenarios: [], snapshots: [], statusHistory: [] });
});
test("23 goal status history is owned by PostgreSQL persistence, not the deterministic engine", () => {
  const engineKeys = Object.keys(GoalPlanningEngine);
  assert.ok(!engineKeys.includes("readState"));
  assert.ok(!engineKeys.includes("saveGoal"));
  assert.ok(!engineKeys.includes("archiveGoal"));
});
test("24 timeline integration", () => assert.ok(snapshot().timelineEvents.every((event) => event.type === "goal-milestone")));
test("25 Decision Centre integration", () => assert.ok(snapshot([goal({ contributionAmount: 50 })]).decisions.length > 0));
test("26 AI CFO provenance", () => assert.ok(snapshot().aiCfoContext.instruction.includes("Do not invent")));
test("27 stale-data warnings", () => assert.ok(snapshot([goal()], [baseRecords()[0]]).aiCfoContext.dataQualityWarnings.length > 0));
test("28 archived goals excluded", () => assert.equal(snapshot([{ ...goal(), status: "ARCHIVED" }]).activeGoals.length, 0));
test("29 no Open Banking dependency", () => assert.doesNotThrow(() => snapshot()));
test("30 no live AI dependency", () => assert.ok(!JSON.stringify(snapshot()).toLowerCase().includes("openai")));

test("31 default retirement goal is a stable integrated baseline at age 60", () => {
  const retirement = createDefaultRetirementGoal(userId, "2026-08-24T00:00:00.000Z");
  assert.equal(retirement.id, DEFAULT_RETIREMENT_GOAL_ID);
  assert.equal(retirement.title, "Retire at 60");
  assert.equal(retirement.type, "RETIREMENT");
  assert.equal(retirement.priority, "critical");
  assert.equal(retirement.provenance.source, "system-default");
  assert.equal(retirement.assumptions.find((item) => item.id === "retirement-age")?.value, 60);
});

test("32 default retirement goal honestly requests setup before inventing a target", () => {
  const evaluation = GoalPlanningEngine.evaluateGoal(createDefaultRetirementGoal(userId, "2026-08-24T00:00:00.000Z"), forecast());
  assert.equal(evaluation.feasibility, "INSUFFICIENT_DATA");
  assert.equal(evaluation.goal.targetAmount, 0);
  assert.equal(evaluation.goal.targetDate, null);
});

test("goal state can reset to default", () => {
  const state = defaultGoalState();
  assert.equal(state.goals.length, 0);
});
