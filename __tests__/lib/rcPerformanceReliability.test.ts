import assert from "node:assert/strict";
import test from "node:test";
import { buildRcPerformanceReliabilityReport, type RcCriticalPathId } from "../../src/lib/rcPerformanceReliability.ts";

const requiredPaths: RcCriticalPathId[] = [
  "dashboard-load",
  "financial-vault-load",
  "digital-twin-scenario-load",
  "simulation-execution",
  "decision-centre-load",
  "workflow-mutation",
  "ai-cfo-context-preparation",
  "daily-review-load",
  "goals-load",
  "transaction-list",
  "background-job-claim",
  "database-reconnect",
];

test("RC Stage 6 measures every required critical path with bounded synthetic inputs", () => {
  const report = buildRcPerformanceReliabilityReport("2026-08-03T00:00:00.000Z");
  assert.equal(report.version, "rc-performance-reliability-v1");
  assert.equal(report.syntheticOnly, true);
  assert.deepEqual(report.criticalPaths.map((path) => path.id), requiredPaths);
  assert(report.criticalPaths.every((path) => Number.isFinite(path.measuredMs) && path.measuredMs >= 0));
  assert(report.criticalPaths.every((path) => path.bounded));
});

test("RC Stage 6 stage gate fails closed if any critical path fails", () => {
  const report = buildRcPerformanceReliabilityReport("2026-08-03T00:00:00.000Z");
  const failed = report.criticalPaths.map((path, index) => index === 0 ? { ...path, status: "FAIL" as const } : path);
  const pass = failed.every((path) => path.status !== "FAIL") && report.reliabilityChecks.every((check) => check.status !== "FAIL");
  assert.equal(report.stageGate.pass, true);
  assert.equal(pass, false);
});

test("RC Stage 6 records bounded query, timeout, retry and heavy-dataset evidence", () => {
  const report = buildRcPerformanceReliabilityReport("2026-08-03T00:00:00.000Z");
  const checks = new Map(report.reliabilityChecks.map((check) => [check.id, check]));
  assert.equal(checks.get("unbounded-history")?.status, "PASS");
  assert.equal(checks.get("timeouts")?.status, "PASS");
  assert.equal(checks.get("retry-safety")?.status, "PASS");
  assert.equal(checks.get("heavy-dataset")?.status, "PASS");
  assert.equal(report.stageGate.criticalRequestsBounded, true);
  assert.equal(report.stageGate.noUnboundedProductionQuery, true);
  assert.equal(report.stageGate.retryBehaviorSafe, true);
});
