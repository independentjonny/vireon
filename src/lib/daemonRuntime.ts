import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export type RunStatus = "queued" | "running" | "completed" | "failed";

export type QueueEntry = {
  runId: string;
  goalSummary: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  attempts: number;
  greenCommit?: string | null;
};

export type StaleRunResult = {
  stale: boolean;
  runId: string | null;
  elapsedMs: number | null;
  thresholdMs: number;
};

export type AutonomousHealthReport = {
  healthy: boolean;
  successRate: number;
  staleRun: StaleRunResult;
  queueSummary: {
    total: number;
    running: number;
    completed: number;
    failed: number;
    queued: number;
  };
  logDir: string;
};

const STALE_THRESHOLD_MS = 30 * 60 * 1000;

function readDaemonState(): Record<string, unknown> | null {
  try {
    const p = path.join(process.cwd(), ".ai", "daemon-state.json");
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
  } catch {
    // state unreadable
  }
  return null;
}

export function getActiveRun(): {
  runId: string;
  goal: string;
  startedAt: string;
  attempts: unknown[];
} | null {
  const state = readDaemonState();
  if (!state?.activeRun) return null;
  const ar = state.activeRun as {
    runId: string;
    goal: string;
    startedAt: string;
    attempts?: unknown[];
  };
  return {
    runId: ar.runId,
    goal: ar.goal,
    startedAt: ar.startedAt,
    attempts: ar.attempts ?? [],
  };
}

export function getRunQueue(): QueueEntry[] {
  const state = readDaemonState();
  if (!state) return [];

  const entries: QueueEntry[] = [];

  const runs = (state.runs ?? []) as Array<{
    runId: string;
    goal: string;
    startedAt: string;
    completedAt?: string;
    status?: string;
    greenCommit?: { commit: string } | null;
    attempts?: unknown[];
  }>;

  for (const r of runs) {
    entries.push({
      runId: r.runId,
      goalSummary: r.goal.slice(0, 80) + (r.goal.length > 80 ? "…" : ""),
      status: r.status === "green" ? "completed" : "failed",
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      attempts: (r.attempts ?? []).length,
      greenCommit: r.greenCommit?.commit ?? null,
    });
  }

  const active = state.activeRun as {
    runId: string;
    goal: string;
    startedAt: string;
    attempts?: unknown[];
  } | null;

  if (active) {
    entries.push({
      runId: active.runId,
      goalSummary: active.goal.slice(0, 80) + (active.goal.length > 80 ? "…" : ""),
      status: "running",
      startedAt: active.startedAt,
      attempts: (active.attempts ?? []).length,
    });
  }

  return entries;
}

export function getQueueSummary() {
  const queue = getRunQueue();
  return {
    total: queue.length,
    running: queue.filter((q) => q.status === "running").length,
    completed: queue.filter((q) => q.status === "completed").length,
    failed: queue.filter((q) => q.status === "failed").length,
    queued: queue.filter((q) => q.status === "queued").length,
  };
}

export function detectStaleRun(thresholdMs = STALE_THRESHOLD_MS): StaleRunResult {
  const active = getActiveRun();
  if (!active) return { stale: false, runId: null, elapsedMs: null, thresholdMs };

  const startedAt = new Date(active.startedAt).getTime();
  const elapsedMs = Date.now() - startedAt;

  return {
    stale: elapsedMs > thresholdMs,
    runId: active.runId,
    elapsedMs,
    thresholdMs,
  };
}

export function hashTaskGoal(goal: string): string {
  return crypto.createHash("sha256").update(goal.trim()).digest("hex").slice(0, 16);
}

export function isTaskDuplicate(goal: string): boolean {
  const state = readDaemonState();
  if (!state) return false;

  const hash = hashTaskGoal(goal);
  if (state.lastTaskHash === hash) return true;

  const runs = (state.runs ?? []) as Array<{ goal: string }>;
  return runs.some((r) => hashTaskGoal(r.goal) === hash);
}

export function getRunLogPath(runId: string): string {
  return path.join(process.cwd(), ".ai", "runs", runId);
}

export function getAutonomousHealth(): AutonomousHealthReport {
  const queue = getRunQueue();
  const staleRun = detectStaleRun();
  const queueSummary = getQueueSummary();

  const resolved = queueSummary.completed + queueSummary.failed;
  const successRate = resolved > 0 ? Math.round((queueSummary.completed / resolved) * 100) : 100;

  return {
    healthy: !staleRun.stale,
    successRate,
    staleRun,
    queueSummary,
    logDir: path.join(".ai", "runs"),
  };
}

export function persistRunMemory(entry: {
  runId: string;
  goal: string;
  outcome: "green" | "failed" | "in_progress";
  commit: string | null;
  filesChanged: string[];
  buildPassed: boolean | null;
}): void {
  const historyPath = path.join(process.cwd(), ".ai", "memory", "task-history.json");
  try {
    let history: { type: string; updatedAt: string; tasks: unknown[] } = {
      type: "task-history",
      updatedAt: new Date().toISOString(),
      tasks: [],
    };

    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    }

    // Dedup by runId
    history.tasks = history.tasks.filter(
      (t) => (t as { runId: string }).runId !== entry.runId
    );
    history.tasks.push({
      runId: entry.runId,
      date: new Date().toISOString().slice(0, 10),
      goal: entry.goal,
      outcome: entry.outcome,
      commit: entry.commit,
      filesChanged: entry.filesChanged,
      buildPassed: entry.buildPassed,
    });
    history.updatedAt = new Date().toISOString();

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch {
    // memory persistence failed silently
  }
}
