import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getRuntimeStatus,
  getRuntimeLogs,
  getRuntimeRuns,
  getRuntimeQueue,
  assignRun,
  getCancelScaffold,
  getScreenshotMeta,
  getPauseResumeState,
  getGitState,
} from "../../src/lib/runtimeControl.js";

describe("runtimeControl — pure read-only functions", () => {
  it("getRuntimeStatus returns expected shape", () => {
    const status = getRuntimeStatus();
    assert.equal(typeof status.daemon, "object");
    assert.equal(typeof status.daemon.active, "boolean");
    assert.equal(typeof status.daemon.totalRuns, "number");
    assert.equal(typeof status.build, "object");
    assert.equal(typeof status.checkedAt, "string");
  });

  it("getRuntimeLogs returns expected shape", () => {
    const logs = getRuntimeLogs();
    assert.ok(Array.isArray(logs.recentRunSummaries));
    assert.equal(typeof logs.checkedAt, "string");
  });

  it("getRuntimeRuns returns expected shape", () => {
    const runs = getRuntimeRuns();
    assert.ok(Array.isArray(runs.runs));
    assert.equal(typeof runs.total, "number");
    assert.equal(typeof runs.checkedAt, "string");
  });

  it("getRuntimeQueue returns expected shape", () => {
    const queue = getRuntimeQueue();
    assert.ok(Array.isArray(queue.queue));
    assert.equal(typeof queue.summary.total, "number");
    assert.equal(typeof queue.checkedAt, "string");
  });

  it("assignRun generates a unique runId", () => {
    const r1 = assignRun("test goal A");
    const r2 = assignRun("test goal B");
    assert.notEqual(r1.runId, r2.runId);
    assert.equal(r1.status, "assigned");
  });

  it("assignRun truncates long goals", () => {
    const longGoal = "a".repeat(500);
    const result = assignRun(longGoal);
    assert.ok(result.goal.length <= 200);
  });

  it("getCancelScaffold returns canCancel boolean", () => {
    const cancel = getCancelScaffold();
    assert.equal(typeof cancel.canCancel, "boolean");
  });

  it("getScreenshotMeta returns screenshots array", () => {
    const meta = getScreenshotMeta();
    assert.ok(Array.isArray(meta.screenshots));
    meta.screenshots.forEach((s) => {
      assert.equal(typeof s.key, "string");
      assert.equal(typeof s.exists, "boolean");
    });
  });

  it("getPauseResumeState returns paused boolean", () => {
    const state = getPauseResumeState();
    assert.equal(typeof state.paused, "boolean");
  });

  it("getGitState returns branch string or null", () => {
    const git = getGitState();
    assert.ok(git.branch === null || typeof git.branch === "string");
    assert.equal(typeof git.checkedAt, "string");
  });
});
