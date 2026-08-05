import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("workflow UI does not record demo evidence as live verification evidence", () => {
  const file = source("src/app/components/ActionWorkflowsClient.tsx");
  assert.match(file, /Attach verified evidence through Financial Vault before outcome verification/);
  assert.match(file, /Demo evidence is not recorded as live evidence/);
  assert.match(file, /Add evidence in Vault/);
  assert.doesNotMatch(file, /async function addDemoEvidence/);
  assert.doesNotMatch(file, /Demo evidence recorded for outcome verification/);
  assert.doesNotMatch(file, /verificationStatus: "Verified"/);
});

test("workflow outcome verification cannot default omitted recalculation to success", () => {
  const route = source("src/app/api/action-workflows/route.ts");
  assert.match(route, /recalculationSucceeded === true/);
  assert.doesNotMatch(route, /recalculationSucceeded \?\? true/);

  const client = source("src/app/components/ActionWorkflowsClient.tsx");
  assert.match(client, /Outcome verification needs verified evidence/);
  assert.match(client, /recalculationSucceeded: false/);
});

test("housing affordability explanation references persisted Vault authority, not local state", () => {
  const file = source("src/lib/housingAffordabilityEngine.ts");
  assert.match(file, /current persisted Financial Vault values/);
  assert.doesNotMatch(file, /current local Financial Profile Vault values/);
});

test("core claim surfaces visibly distinguish evidence confidence and professional review boundaries", () => {
  const ai = source("src/app/components/AiCfoClient.tsx");
  assert.match(ai, /Calculation snapshot/);
  assert.match(ai, /Professional review required before acting/);
  assert.match(ai, /item\.classification/);
  assert.match(ai, /item\.confidence/);

  const daily = source("src/app/components/DailyReviewClient.tsx");
  assert.match(daily, /Evidence and assumptions/);
  assert.match(daily, /Rule freshness/);
  assert.match(daily, /Professional review required before acting/);

  const forecast = source("src/app/components/ForecastTimelineClient.tsx");
  assert.match(forecast, /confirmed Financial Vault records and explicit assumptions/);
  assert.match(forecast, /not guaranteed returns/);
});
