import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("Cash Flow is authenticated and uses the canonical financial position model", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/cash-flow/page.tsx"), "utf8");
  assert.match(page, /requireServerPageSession\("\/cash-flow"\)/);
  assert.match(page, /createFinancialPositionReadServiceFromEnv\(\)\.read\(session\)/);
  assert.match(page, /position\.monthlyCashFlow/);
  assert.doesNotMatch(page, /\$6,420|\$14,680|\$8,260|1 Jun - 30 Jun 2026|Salary Deposit/);
});

test("Financial Position consumes the same canonical monthly cash flow", () => {
  const client = readFileSync(resolve(process.cwd(), "src/app/components/FinancialProfileBuilderClient.tsx"), "utf8");
  assert.match(client, /position\.monthlyCashFlow\.monthlySurplus/);
  assert.doesNotMatch(client, /total\(position\.income, \["monthlyAmount", "monthlyIncome", "amount"\]\)/);
});
