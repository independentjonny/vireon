import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("Cash Flow is authenticated and uses the canonical financial position model", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/cash-flow/page.tsx"), "utf8");
  assert.match(page, /requireServerPageSession\("\/cash-flow"\)/);
  assert.match(page, /createFinancialPositionReadServiceFromEnv\(\)\.read\(session\)/);
  assert.match(page, /position\.monthlyCashFlow/);
  assert.match(page, /cashFlow\.missingInputs/);
  assert.match(page, /Complete the missing cash-flow details/);
  assert.match(page, /Add details/);
  assert.doesNotMatch(page, /\$6,420|\$14,680|\$8,260|1 Jun - 30 Jun 2026|Salary Deposit/);
});

test("Financial Position consumes the same canonical monthly cash flow", () => {
  const client = readFileSync(resolve(process.cwd(), "src/app/components/FinancialProfileBuilderClient.tsx"), "utf8");
  assert.match(client, /position\.monthlyCashFlow\.monthlySurplus/);
  assert.match(client, /position\.monthlyCashFlow\.missingInputs/);
  assert.match(client, /Add missing details/);
  assert.match(client, /cashFlowMissing\?\.href \?\? "\/cash-flow"/);
  assert.match(client, /"View calculation"/);
  assert.match(client, /monthlyCashFlow === null \? "Incomplete"/);
  assert.doesNotMatch(client, /total\(position\.income, \["monthlyAmount", "monthlyIncome", "amount"\]\)/);
});

test("Dashboard consumes the same canonical monthly cash flow and savings rate", () => {
  const dashboard = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
  assert.match(dashboard, /const monthlyCashFlow = readModel\.monthlyCashFlow/);
  assert.match(dashboard, /monthlyCashFlow\.monthlySurplus/);
  assert.match(dashboard, /monthlyCashFlow\.monthlyIncome/);
  assert.match(dashboard, /monthlyCashFlow\.monthlyExpenses/);
  assert.doesNotMatch(dashboard, /record\.value\.monthlyAmount \?\? record\.value\.amount/);
});
