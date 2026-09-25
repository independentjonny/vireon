import { test } from "node:test";
import assert from "node:assert/strict";
import { decisionImpact } from "../../src/lib/decisionImpact.ts";

test("one-off illustration matches compound growth and spending opportunity cost", () => {
  const add = decisionImpact({ currentAge: 55, amount: 1000, annualReturn: 5, direction: "add" })!;
  const spend = decisionImpact({ currentAge: 55, amount: 1000, annualReturn: 5, direction: "spend" })!;
  assert.ok(Math.abs(add.futureValue - 1628.894626777442) < 0.000001);
  assert.equal(spend.impact, -add.impact);
  assert.equal(add.growth, add.futureValue - 1000);
  assert.equal(add.yearly.at(-1)!.value, add.impact);
  assert.equal(add.yearly[0].age, 55);
  assert.equal(add.yearly.at(-1)!.age, 65);
});
test("zero return, zero amount and current age 65 remain real zero/horizon cases", () => {
  assert.equal(decisionImpact({ currentAge: 51, amount: 1000, annualReturn: 0, direction: "add" })!.impact, 1000);
  assert.equal(decisionImpact({ currentAge: 65, amount: 1000, annualReturn: 6, direction: "add" })!.impact, 1000);
  assert.equal(decisionImpact({ currentAge: 51, amount: 0, annualReturn: 6, direction: "add" })!.impact, 0);
});
test("negative returns are losses, not fabricated positive growth", () => {
  const result = decisionImpact({ currentAge: 64, amount: 1000, annualReturn: -10, direction: "add" })!;
  assert.equal(result.impact, 900);
  assert.equal(result.growth, -100);
});
test("invalid and overflowing inputs never yield financial outputs", () => {
  const valid = { currentAge: 51, amount: 1000, annualReturn: 5, direction: "add" as const };
  for (const change of [{ currentAge: 66 }, { currentAge: -1 }, { currentAge: 51.5 }, { amount: -1 }, { amount: NaN }, { annualReturn: -100 }, { annualReturn: Infinity }, { amount: Number.MAX_VALUE, annualReturn: 100 }]) assert.equal(decisionImpact({ ...valid, ...change }), null);
});
