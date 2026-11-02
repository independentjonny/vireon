import test from "node:test";
import assert from "node:assert/strict";
import { addControlMonths, controlDate, projectControlPosition, type ControlAssumptions, type ControlGoal, type ControlPosition } from "../../src/lib/controlCentreProjection.ts";

const today = "2026-11-03";
const position: ControlPosition = { assets: 100000, liabilities: 20000, cash: 20000, monthlyIncome: 6000, monthlyExpenses: 4000 };
const settings: ControlAssumptions = { start: today, incomeChange: 0, expenseChange: 0, assetReturn: 0, cashReturn: 0, inflation: 0, monthlyInvestment: 0, retirementDate: "", retirementIncome: null, retirementExpenses: null };
const goal: ControlGoal = { id: "goal", title: "Test goal", target: 100000, current: 0, monthly: 500, date: "", enabled: true, effect: "invest" };
const near = (actual: number | null, expected: number, tolerance = 0.02) => assert.ok(actual !== null && Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);
const end = "2027-11-03";
test("calendar helpers reject impossible dates and clamp leap/month boundaries", () => {
  assert.ok(Number.isNaN(controlDate("2027-02-29")));
  assert.equal(addControlMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addControlMonths("2028-02-29", 12), "2029-02-28");
});
test("zero horizon equals confirmed state without adding goal progress or annual contributions", () => {
  const result = projectControlPosition(position, today, today, settings, [{ ...goal, current: 20000 }]);
  near(result.netPosition, 80000); near(result.cash, 20000); near(result.monthlySurplus, 2000); near(result.buffer, 5);
});
test("surplus accumulates once and transfers preserve net position", () => {
  const base = projectControlPosition(position, today, end, settings, []);
  const moved = projectControlPosition(position, today, end, { ...settings, monthlyInvestment: 500 }, []);
  near(moved.netPosition, base.netPosition!); near(base.cash! - moved.cash!, 500 * 365 / 365.2425 * 12);
  near(moved.monthlySurplus, 2000); near(moved.afterAllocations, 1500);
});
test("spending reduces wealth; debt goals reduce cash and liabilities together", () => {
  const base = projectControlPosition(position, today, end, settings, []);
  const spent = projectControlPosition(position, today, end, settings, [{ ...goal, effect: "spend" }]);
  const repaid = projectControlPosition(position, today, end, settings, [{ ...goal, effect: "repay" }]);
  near(base.netPosition! - spent.netPosition!, spent.goals.goal); near(repaid.netPosition, base.netPosition!);
  assert.ok(repaid.cash! < base.cash!);
});
test("future effective dates do not change earlier flows or growth", () => {
  const later = { ...settings, start: "2028-11-03", incomeChange: 1000, assetReturn: 20, before: { assetReturn: 0, cashReturn: 0, inflation: 0 } };
  assert.deepEqual(projectControlPosition(position, today, end, later, []), projectControlPosition(position, today, end, settings, []));
});
test("retirement stops salary and keeps missing retirement income unknown", () => {
  const at = projectControlPosition(position, today, end, { ...settings, retirementDate: end }, []);
  assert.equal(at.monthlySurplus, null); assert.ok(at.cash! > 20000);
  const after = projectControlPosition(position, today, "2028-11-03", { ...settings, retirementDate: end }, []);
  assert.equal(after.cash, null); assert.equal(after.netPosition, null);
  const zero = projectControlPosition(position, today, end, { ...settings, retirementDate: end, retirementIncome: 0, retirementExpenses: 4000 }, []);
  near(zero.monthlySurplus, -4000);
});
test("missing current data is never silently treated as zero", () => {
  const result = projectControlPosition({ ...position, monthlyIncome: null }, today, end, settings, []);
  assert.equal(result.cash, null); assert.equal(result.netPosition, null); assert.equal(result.monthlySurplus, null);
});
test("goals stop at target, can be disabled, and reserve money cannot fund another goal", () => {
  const p = { ...position, cash: 1000, monthlyIncome: 4000 };
  const result = projectControlPosition(p, today, end, settings, [{ ...goal, id: "reserve", effect: "reserve", target: 1000, monthly: 1000 }, { ...goal, monthly: 1000 }]);
  near(result.goals.reserve + result.goals.goal, 1000);
  assert.ok(result.unfunded > 0);
  assert.deepEqual(projectControlPosition(position, today, end, settings, [{ ...goal, enabled: false }]).cash, projectControlPosition(position, today, end, settings, []).cash);
  near(projectControlPosition(position, today, end, settings, [{ ...goal, target: 100 }]).goals.goal, 100);
});
test("negative cash shows a gap, buffer reaches zero, and no unfunded investment is invented", () => {
  const result = projectControlPosition({ ...position, cash: 10, monthlyIncome: 0 }, today, end, { ...settings, monthlyInvestment: 1000 }, []);
  assert.ok(result.cash! < 0); near(result.buffer, 0); assert.ok(result.unfunded > 0);
});
test("invalid inputs and excessive horizons fail instead of producing financial figures", () => {
  for (const patch of [{ inflation: -1 }, { assetReturn: NaN }, { monthlyInvestment: -1 }, { start: "2020-01-01" }]) assert.throws(() => projectControlPosition(position, today, end, { ...settings, ...patch }, []));
  assert.throws(() => projectControlPosition(position, today, "2099-01-01", settings, []));
  assert.throws(() => projectControlPosition(position, today, end, settings, [{ ...goal, monthly: NaN }]));
});
