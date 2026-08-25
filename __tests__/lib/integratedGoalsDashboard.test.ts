import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dashboard gives Integrated Goals decision-level prominence", () => {
  const widget = readFileSync("src/app/components/IntegratedGoalsWidget.tsx", "utf8");
  const dashboard = readFileSync("src/app/components/BaselineDashboard.tsx", "utf8");
  const emptyDashboard = readFileSync("src/app/components/EmptyFinancialDashboard.tsx", "utf8");

  assert.match(widget, /Integrated Goals/);
  assert.match(widget, /Retire at 60/);
  assert.match(widget, /Default goal/);
  assert.match(widget, /Goal interaction/);
  assert.match(widget, /changing one can affect the others/);
  assert.match(widget, /href="\/goals"/);
  assert.match(dashboard, /<IntegratedGoalsWidget snapshot=\{goalsSnapshot\}/);
  assert.match(emptyDashboard, /<IntegratedGoalsWidget snapshot=\{goalsSnapshot\}/);
  assert.doesNotMatch(widget, /Scenario comparison|Accelerated monthly contribution|Milestones/);
});

test("Integrated Goals workspace supports retirement, vehicle and holiday goals", () => {
  const goals = readFileSync("src/app/components/GoalsPlanningClient.tsx", "utf8");
  assert.match(goals, /Plan every goal against the same financial position/);
  assert.match(goals, /Retire early/);
  assert.match(goals, /Vehicle purchase/);
  assert.match(goals, /Holiday or travel/);
  assert.match(goals, /Your integrated goals/);
});
