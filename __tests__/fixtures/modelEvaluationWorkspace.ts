import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after } from "node:test";
import { EVALUATION_FIXTURES } from "../../src/lib/modelEvaluation/fixtures.ts";

// These are offline test scenarios, never recovered provider runs. Legacy run IDs
// exercise the existing review APIs only inside this worker's disposable cwd.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const evaluationTestWorkspace = mkdtempSync(join(repository, ".tmp-evaluation-tests-"));
const workspace = evaluationTestWorkspace;
const artifactRoot = join(workspace, ".vireon", "model-evaluation");
const ids = [
  "fixture-01-payslip-extraction", "fixture-03-mortgage-statement-extraction",
  "fixture-04-financial-position-synthesis", "fixture-24-financial-position-synthesis",
  "fixture-06-debt-optimisation-explanation", "fixture-07-mortgage-comparison",
  "fixture-11-digital-twin-scenario-explanation", "fixture-12-daily-review-briefing",
  "fixture-13-timeline-explanation", "fixture-30-evidence-completeness-detection",
  "fixture-31-professional-review-escalation", "fixture-32-unsupported-action-rejection",
];
const fixtures = ids.map(id => {
  const fixture = EVALUATION_FIXTURES.find(item => item.fixtureId === id);
  assert.ok(fixture, `Missing synthetic fixture definition: ${id}`);
  return fixture;
});
const confidence = "confidence below task minimum";
const claim = "unsupported or prohibited claim";
const originalFailures: Record<string, string[]> = {
  "fixture-04-financial-position-synthesis": [confidence],
  "fixture-24-financial-position-synthesis": [confidence],
  "fixture-06-debt-optimisation-explanation": [confidence],
  "fixture-11-digital-twin-scenario-explanation": [confidence],
  "fixture-12-daily-review-briefing": [claim],
  "fixture-13-timeline-explanation": [claim],
};
const rerunFailures: Record<string, string[]> = {
  "fixture-01-payslip-extraction": [confidence],
  "fixture-03-mortgage-statement-extraction": [confidence],
  "fixture-24-financial-position-synthesis": [confidence, claim],
  "fixture-06-debt-optimisation-explanation": [confidence],
  "fixture-11-digital-twin-scenario-explanation": [confidence],
  "fixture-12-daily-review-briefing": [claim],
  "fixture-13-timeline-explanation": [confidence],
  "fixture-32-unsupported-action-rejection": [claim],
};

function write(relative: string, value: unknown) {
  const path = join(artifactRoot, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function run(runId: string, failures: Record<string, string[]>, version: number, halted = false) {
  const scoredResults = fixtures.map(fixture => ({
    fixtureId: fixture.fixtureId,
    status: failures[fixture.fixtureId]?.length ? "failed" : "passed",
    modelTaskRunId: `synthetic-${runId}-${fixture.fixtureId}`,
    modelStatus: "offline-test-fixture",
    schemaScore: 1, evidenceGroundingScore: 1, deterministicFidelityScore: 1,
    professionalReviewScore: 1, actionBoundaryScore: 1,
    hardFailures: failures[fixture.fixtureId] ?? [], warnings: [],
  }));
  const results = halted ? [{
    ...scoredResults[0], status: "blocked", modelTaskRunId: null,
    modelStatus: "budget-blocked", errorCode: "RUN_COST_LIMIT_EXCEEDED",
  }] : scoredResults;
  write(`live/${runId}-manifest.json`, {
    pilotId: runId, timestamp: "2026-01-01T00:00:00.000Z",
    provider: "openai", modelIdentifier: "gpt-5.2",
    modelConfigurationVersion: "synthetic-model-config-v1", orchestratorPolicyVersion: "synthetic-routing-v1",
    evaluationFrameworkVersion: "synthetic-evaluation-fixture-v1",
    promptVersions: [`prompt-eval-live-v${version}`], fixtureVersions: [fixtures[0].fixtureVersion],
    scoringPolicyVersion: `deterministic-scorer-v${version}`,
    budgetLimits: { estimatedMaximumCost: 0, actualCost: 0 },
    retryLimits: { expectedMaximumRequestCount: 12 }, tokenLimits: { maxOutputTokens: "800" },
    environmentIdentifier: "offline-unit-test-synthetic-archive",
    syntheticOnlyConfirmed: true, rawPromptStorage: false, rawResponseStorage: false,
    provenance: "Generated synthetic unit-test data; not historical provider evidence", providerCallsMade: false,
  });
  write(`live/${runId}-summary.json`, {
    runId, status: halted ? "halted" : "completed", haltReason: halted ? "budget-blocked" : "completed",
    fixtureCount: fixtures.length, passedCount: results.filter(row => row.status === "passed").length,
    failedCount: results.filter(row => row.status === "failed").length, blockedCount: halted ? 1 : 0,
    requestCount: halted ? 0 : results.length, totalCost: 0, averageLatency: 0,
    scoreSummary: { hardFailureCount: results.reduce((sum, row) => sum + row.hardFailures.length, 0) },
    humanReviewRequired: results.length, humanReviewCompleted: 0,
    expandedRunEligible: false, automaticPromotionEnabled: false, results,
    provenance: "Generated synthetic unit-test data; not historical provider evidence", providerCallsMade: false,
  });
}

run("live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80", originalFailures, 1);
run("live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7", rerunFailures, 2);
run("live-eval-7af717c3-d76d-437c-bc35-16f62bcffdb0", {}, 2, true);
write("live/live-eval-d30efd91-7857-4bd5-a665-e7424fb69a7a-summary.json", {
  status: "halted", haltReason: "critical-failures", requestCount: 5,
  fixtureCount: 6, passedCount: 0, failedCount: 4, blockedCount: 1,
  scoreSummary: { hardFailureCount: 5 },
  results: fixtures.slice(0, 5).map((fixture, index) => ({
    fixtureId: fixture.fixtureId, status: index === 4 ? "blocked" : "failed",
    hardFailures: index === 4 ? [] : index === 0 ? [confidence, claim] : [confidence],
  })),
  provenance: "Generated synthetic unit-test data; not historical provider evidence", providerCallsMade: false,
});
write("model-comparison/model-comparison-program-v1-matrix.json", { winnerSelected: false, provenance: "synthetic unit-test fixture" });

// Frozen methodology hashes must use real checked-in source, not missing-file
// placeholders, even when all evaluation records live in a temporary workspace.
for (const relative of [
  "src/lib/modelEvaluation/scorers.ts", "src/lib/modelEvaluation/liveFailureDecomposition.ts",
  "src/lib/modelOrchestrator/taskRestrictions.ts", "docs/DETERMINISTIC_CONFIDENCE_POLICY.md",
]) {
  mkdirSync(dirname(join(workspace, relative)), { recursive: true });
  copyFileSync(join(repository, relative), join(workspace, relative));
}
writeFileSync(join(workspace, "SYNTHETIC-TEST-WORKSPACE.txt"), "Disposable offline fixtures. Never use these as live-run audit evidence.\n");
process.chdir(workspace);
after(() => {
  process.chdir(repository);
  assert.equal(dirname(resolve(workspace)), repository);
  assert.ok(workspace.startsWith(join(repository, ".tmp-evaluation-tests-")));
  rmSync(workspace, { recursive: true, force: true });
});
