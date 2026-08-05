import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  getContinuousStatus,
  getDefects,
  getFinalGreenReport,
  getNextTask,
} from "../../src/lib/runtimeControl.ts";

function withTempCwd<T>(fn: (dir: string) => T): T {
  const original = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "vireon-runtime-control-"));
  process.chdir(dir);
  try {
    return fn(dir);
  } finally {
    process.chdir(original);
  }
}

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

  it("redacts sensitive bridge goal previews from runtime state", () => {
    withTempCwd((dir) => {
      mkdirSync(join(dir, ".ai"), { recursive: true });
      writeFileSync(
        join(dir, ".ai", "daemon-state.json"),
        JSON.stringify({
          activeRun: {
            runId: "run-secret",
            goal:
              "Investigate DATABASE_URL=postgresql://app:secret-value@db.example/vireon and Bearer abc.def.ghi and access_token=token-secret",
            startedAt: "2026-07-31T00:00:00.000Z",
          },
          runs: [
            {
              runId: "run-old",
              goal:
                "Repair OPENAI_API_KEY=sk-test-secret and PGPASSWORD=super-secret with https://app:basic-secret@example.test and eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2aXJlb24ifQ.signaturesecretvalue",
              startedAt: "2026-07-30T00:00:00.000Z",
              completedAt: "2026-07-30T00:10:00.000Z",
              status: "failed",
            },
          ],
        }),
        "utf8"
      );
      mkdirSync(join(dir, ".ai", "operations"), { recursive: true });
      writeFileSync(
        join(dir, ".ai", "operations", "queue.json"),
        JSON.stringify({
          items: [
            {
              id: "queued-task",
              title: "Queue task with PASSWORD=queued-secret and Bearer queued.token.value",
              source: "DATABASE_URL=postgresql://queue:queue-secret@example/vireon",
              addedAt: "2026-07-31T00:05:00.000Z",
              status: "queued",
            },
          ],
        }),
        "utf8"
      );
      writeFileSync(
        join(dir, ".ai", "operations", "defects.json"),
        JSON.stringify([
          {
            detectedAt: "2026-07-31T00:06:00.000Z",
            source: "OPENAI_API_KEY=sk-defect-secret",
            description: "Defect exposed client_secret=defect-secret",
            repairTaskId: "repair-1",
            resolved: false,
          },
        ]),
        "utf8"
      );
      writeFileSync(
        join(dir, ".ai", "final-green-report.json"),
        JSON.stringify({
          status: "green",
          goal: "Final report with PGPASSWORD=green-secret",
          completedAt: "2026-07-31T00:07:00.000Z",
          validation: { ok: true, buildBrowser: { ok: true } },
        }),
        "utf8"
      );

      const bridgePayload = JSON.stringify({
        status: getRuntimeStatus(),
        logs: getRuntimeLogs(),
        runs: getRuntimeRuns(),
        queue: getRuntimeQueue(),
        assigned: assignRun("Assign with access_token=assign-secret"),
        nextTask: getNextTask(),
        defects: getDefects(),
        continuousStatus: getContinuousStatus(),
        finalGreenReport: getFinalGreenReport(),
      });

      assert.equal(bridgePayload.includes("secret-value"), false);
      assert.equal(bridgePayload.includes("sk-test-secret"), false);
      assert.equal(bridgePayload.includes("super-secret"), false);
      assert.equal(bridgePayload.includes("abc.def.ghi"), false);
      assert.equal(bridgePayload.includes("token-secret"), false);
      assert.equal(bridgePayload.includes("basic-secret"), false);
      assert.equal(bridgePayload.includes("signaturesecretvalue"), false);
      assert.equal(bridgePayload.includes("queued-secret"), false);
      assert.equal(bridgePayload.includes("queue-secret"), false);
      assert.equal(bridgePayload.includes("sk-defect-secret"), false);
      assert.equal(bridgePayload.includes("defect-secret"), false);
      assert.equal(bridgePayload.includes("green-secret"), false);
      assert.equal(bridgePayload.includes("assign-secret"), false);
      assert.match(bridgePayload, /<redacted>/);
    });
  });

  it("strictly normalizes defects without copying unexpected secret fields", () => {
    withTempCwd((dir) => {
      const canary = "canary-runtime-defect-secret-7b7f3b4a";
      mkdirSync(join(dir, ".ai", "operations"), { recursive: true });
      writeFileSync(
        join(dir, ".ai", "operations", "defects.json"),
        JSON.stringify([
          {
            id: `defect ${canary}`,
            code: `CODE_${canary}`,
            severity: `high ${canary}`,
            category: `runtime ${canary}`,
            title: `title ${canary}`,
            summary: `summary ${canary}`,
            evidence: [{ note: `Bearer ${canary}`, command: `echo ${canary}` }],
            affectedFiles: [`src/app/api/runtime/defects/route.ts?token=${canary}`],
            acceptanceCriterion: `criterion ${canary}`,
            remediation: `remediation ${canary}`,
            status: "open",
            detectedAt: "2026-07-31T00:06:00.000Z",
            source: `postgresql://user:${canary}@db.example/postgres`,
            description: `ALTER ROLE vireon_app PASSWORD '${canary}'`,
            repairTaskId: `repair-${canary}`,
            resolved: false,
            rawSecret: canary,
            password: canary,
            apiKey: canary,
            token: canary,
            arbitraryNestedPayload: { secret: canary },
            shell: `powershell ${canary}`,
            env: { PGPASSWORD: canary },
            connectionString: `postgresql://user:${canary}@db.example/postgres`,
          },
        ]),
        "utf8",
      );

      const result = getDefects();
      const text = JSON.stringify(result);
      assert.equal(text.includes(canary), false);
      assert.equal(Object.prototype.hasOwnProperty.call(result.latest ?? {}, "rawSecret"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(result.latest ?? {}, "password"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(result.latest ?? {}, "command"), false);
      assert.ok(result.discardedUnexpectedFieldCount >= 8);
      assert.match(text, /DEFECT_SECRET_REDACTED/);
      assert.match(text, /MALFORMED_DEFECT_DISCARDED/);
    });
  });

  it("defect normalization discards prototype-pollution and oversized payloads safely", () => {
    withTempCwd((dir) => {
      mkdirSync(join(dir, ".ai", "operations"), { recursive: true });
      const malicious = JSON.parse(
        `[
          {
            "id": "oversized",
            "title": "${"x".repeat(1200)}",
            "evidence": ${JSON.stringify(Array.from({ length: 60 }, (_, index) => ({ index, text: "safe" })))},
            "__proto__": { "polluted": true },
            "constructor": { "prototype": { "polluted": true } },
            "prototype": { "polluted": true }
          },
          "not an object"
        ]`,
      );
      writeFileSync(join(dir, ".ai", "operations", "defects.json"), JSON.stringify(malicious), "utf8");

      const before = ({} as Record<string, unknown>).polluted;
      const result = getDefects();
      const after = ({} as Record<string, unknown>).polluted;
      assert.equal(before, undefined);
      assert.equal(after, undefined);
      assert.equal(result.total, 2);
      assert.equal(result.malformedDiscarded, 1);
      assert.ok(result.discardedUnexpectedFieldCount >= 4);
      assert.ok(result.latest);
      assert.ok((result.latest?.title ?? "").length <= 160);
      assert.ok(Array.isArray(result.latest?.evidence));
      assert.ok((result.latest?.evidence as unknown[]).length <= 8);
      assert.match(JSON.stringify(result), /DEFECT_FIELD_TRUNCATED/);
    });
  });

  it("queue task and final green report payloads redact adversarial canaries", () => {
    withTempCwd((dir) => {
      const canary = "canary-runtime-report-secret-2e65fe48";
      mkdirSync(join(dir, ".ai", "operations"), { recursive: true });
      writeFileSync(
        join(dir, ".ai", "operations", "queue.json"),
        JSON.stringify({
          items: [{
            id: "queued-secret",
            title: `Queue with PGPASSWORD=${canary}`,
            source: `postgresql://queue:${canary}@db.example/vireon`,
            addedAt: "2026-07-31T00:05:00.000Z",
            status: "queued",
            unexpected: { token: canary },
          }],
        }),
        "utf8",
      );
      writeFileSync(
        join(dir, ".ai", "final-green-report.json"),
        JSON.stringify({
          status: "green",
          goal: `Codex completion text Bearer ${canary}`,
          completedAt: "2026-07-31T00:07:00.000Z",
          validation: { ok: true, buildBrowser: { ok: true }, stderr: `PASSWORD '${canary}'` },
          reviewer: { finding: canary },
        }),
        "utf8",
      );
      const text = JSON.stringify({
        queue: getRuntimeQueue(),
        nextTask: getNextTask(),
        finalGreenReport: getFinalGreenReport(),
        status: getRuntimeStatus(),
      });
      assert.equal(text.includes(canary), false);
      assert.match(text, /<redacted>/);
      assert.equal(text.includes("unexpected"), false);
      assert.equal(text.includes("reviewer"), false);
    });
  });
});
