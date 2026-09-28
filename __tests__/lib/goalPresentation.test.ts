import assert from "node:assert/strict";
import test from "node:test";
import {
  hasGoalEstimate,
  retirementDisplayTitle,
} from "../../src/lib/goalPresentation.ts";
import type { GoalEvaluation } from "../../src/lib/goalPlanning.ts";
import type { TrajectorySettings } from "../../src/lib/wealthTrajectory.ts";
const evaluation = {
  feasibility: "ACHIEVABLE",
  goal: { targetAmount: 10000, targetDate: "2030-01-01" },
  requiredMonthlyContribution: 0,
  fundingGap: 0,
  currentProgress: 100,
} as GoalEvaluation;
test("missing information cannot appear as a zero-dollar estimate", () => {
  assert.equal(
    hasGoalEstimate({ ...evaluation, feasibility: "INSUFFICIENT_DATA" }),
    false,
  );
  assert.equal(
    hasGoalEstimate({
      ...evaluation,
      goal: { ...evaluation.goal, targetAmount: 0 },
    }),
    false,
  );
  assert.equal(
    hasGoalEstimate({
      ...evaluation,
      goal: { ...evaluation.goal, targetDate: null },
    }),
    false,
  );
  assert.equal(hasGoalEstimate({ ...evaluation, fundingGap: NaN }), false);
});
test("a fully funded calculable goal can legitimately show zero required funding", () =>
  assert.equal(hasGoalEstimate(evaluation), true));
test("Dashboard retirement label uses the saved projection age, not a legacy target title", () => {
  assert.equal(
    retirementDisplayTitle(null),
    "Retirement · set your retirement age",
  );
  assert.equal(
    retirementDisplayTitle({ retirementAge: 67 } as TrajectorySettings),
    "Retirement at 67",
  );
});
