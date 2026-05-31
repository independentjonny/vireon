import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

function getAiDir() { return path.join(process.cwd(), ".ai"); }

function readDaemonState(): Record<string, unknown> | null {
  try {
    const p = path.join(getAiDir(), "daemon-state.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    // unreadable
  }
  return null;
}

function readFinalGreenReport(): Record<string, unknown> | null {
  try {
    const p = path.join(getAiDir(), "final-green-report.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    // unreadable
  }
  return null;
}

type ActiveRun = { runId: string; goal: string; startedAt: string; attempts?: unknown[] };
type RunRecord = {
  runId: string;
  goal: string;
  status?: string;
  startedAt: string;
  completedAt?: string;
  greenCommit?: { commit: string } | null;
};

function resolveRuns(state: Record<string, unknown> | null): RunRecord[] {
  const raw = (state?.runs as RunRecord[]) ?? [];
  if (raw.length > 0) return raw;
  const last = state?.lastRun as RunRecord | null;
  return last ? [last] : [];
}

export function getRuntimeStatus() {
  const state = readDaemonState();
  const green = readFinalGreenReport();
  const active = state?.activeRun as ActiveRun | null;
  const runs = resolveRuns(state);

  return {
    daemon: {
      active: !!active,
      runId: active?.runId ?? null,
      startedAt: active?.startedAt ?? null,
      totalRuns: runs.length,
    },
    build: {
      lastGreen: green?.status === "green",
      greenCommit: (green?.greenCommit as { commit?: string } | null)?.commit ?? null,
      completedAt: (green?.completedAt as string) ?? null,
      latestGreenGoal: (green?.goal as string)?.slice(0, 120) ?? null,
    },
    browser: {
      validateScreenshot: ".ai/validate-and-repair.png",
      interactionScreenshot: ".ai/browser-interaction-check.png",
    },
    checkedAt: new Date().toISOString(),
  };
}

export function getRuntimeLogs() {
  const state = readDaemonState();
  const green = readFinalGreenReport();
  const active = state?.activeRun as ActiveRun | null;
  const runs = resolveRuns(state);

  return {
    activeRunGoal: active?.goal?.slice(0, 120) ?? null,
    latestGreenGoal: (green?.goal as string)?.slice(0, 120) ?? null,
    recentRunSummaries: runs.slice(-3).map((r) => ({
      runId: r.runId,
      status: r.status ?? "unknown",
      completedAt: r.completedAt ?? null,
      goalPreview: r.goal?.slice(0, 80) ?? "",
    })),
    files: {
      daemonState: ".ai/daemon-state.json",
      greenReport: ".ai/final-green-report.json",
      logDir: ".ai/runs",
    },
    checkedAt: new Date().toISOString(),
  };
}

export function getRuntimeRuns() {
  const state = readDaemonState();
  const runs = resolveRuns(state);
  const active = state?.activeRun as ActiveRun | null;

  return {
    runs: runs.map((r) => ({
      runId: r.runId,
      goalPreview: r.goal?.slice(0, 100) ?? "",
      status: r.status ?? "unknown",
      startedAt: r.startedAt,
      completedAt: r.completedAt ?? null,
      greenCommit: r.greenCommit?.commit ?? null,
    })),
    activeRun: active
      ? {
          runId: active.runId,
          goalPreview: active.goal?.slice(0, 100) ?? "",
          startedAt: active.startedAt,
          status: "running",
        }
      : null,
    total: runs.length,
    checkedAt: new Date().toISOString(),
  };
}

export function getRuntimeQueue() {
  const state = readDaemonState();
  const runs = resolveRuns(state);
  const active = state?.activeRun as ActiveRun | null;

  type QueueItem = { runId: string; goalPreview: string; status: string; startedAt: string; completedAt: string | null };
  const queue: QueueItem[] = runs.map((r) => ({
    runId: r.runId,
    goalPreview: r.goal?.slice(0, 80) ?? "",
    status: r.status === "green" ? "completed" : r.status === "paused" ? "paused" : "failed",
    startedAt: r.startedAt,
    completedAt: r.completedAt ?? null,
  }));

  if (active) {
    queue.push({
      runId: active.runId,
      goalPreview: active.goal?.slice(0, 80) ?? "",
      status: "running",
      startedAt: active.startedAt,
      completedAt: null,
    });
  }

  const summary = {
    total: queue.length,
    running: queue.filter((q) => q.status === "running").length,
    completed: queue.filter((q) => q.status === "completed").length,
    failed: queue.filter((q) => q.status === "failed").length,
    queued: queue.filter((q) => q.status === "queued").length,
  };

  return { queue: queue.slice(-10), summary, checkedAt: new Date().toISOString() };
}

export function assignRun(goal: string) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return {
    runId,
    goal: (goal ?? "(no goal)").slice(0, 200),
    assignedAt: new Date().toISOString(),
    status: "assigned",
    note: "Write goal to .ai/tasks/current-task.md and trigger daemon to pick up",
  };
}

export function getCancelScaffold() {
  const state = readDaemonState();
  const active = state?.activeRun as ActiveRun | null;

  return {
    activeRunId: active?.runId ?? null,
    canCancel: !!active,
    action: "scaffold",
    note: "Set activeRun to null in .ai/daemon-state.json to release the daemon lock. No destructive shell execution.",
    checkedAt: new Date().toISOString(),
  };
}

export function getScreenshotMeta() {
  const files = [
    { key: "validate-and-repair", relPath: ".ai/validate-and-repair.png" },
    { key: "browser-interaction-check", relPath: ".ai/browser-interaction-check.png" },
    { key: "browser-check", relPath: ".ai/browser-check.png" },
  ];

  const screenshots = files.map(({ key, relPath }) => {
    const abs = path.join(process.cwd(), relPath);
    let exists = false;
    let sizeBytes: number | null = null;
    let lastModified: string | null = null;
    try {
      const stat = fs.statSync(abs);
      exists = true;
      sizeBytes = stat.size;
      lastModified = new Date(stat.mtimeMs).toISOString();
    } catch {
      // file absent
    }
    return { key, relPath, exists, sizeBytes, lastModified };
  });

  return {
    screenshots,
    note: "Relative paths only — no raw file contents exposed",
    checkedAt: new Date().toISOString(),
  };
}

// ── Continuous Operations ───────────────────────────────────────────────────

function getOpsDir() { return path.join(getAiDir(), "operations"); }

function readOpsFile<T>(name: string): T | null {
  try {
    const p = path.join(getOpsDir(), name);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch { /* unreadable */ }
  return null;
}

type HeartbeatFile = { lastBeat: string; pid?: number; uptime?: number; paused?: boolean };
type SchedulerFile = { cadenceMinutes: number; lastRunAt: string | null; nextRunAt: string | null; enabled: boolean };
type OvernightFile = { enabled: boolean; maxTasks: number; tasksRun: number; startedAt: string | null; stoppedAt: string | null; stopReason: string | null };
type DefectFile = { detectedAt: string | null; source: string | null; description: string | null; repairTaskId: string | null; resolved: boolean };
type QueueFile = { items: { id: string; title: string; source: string; addedAt: string; status: string }[] };

export function getHeartbeat() {
  const hb = readOpsFile<HeartbeatFile>("daemon.json");
  const state = readDaemonState();
  const active = state?.activeRun as ActiveRun | null;
  const now = new Date().toISOString();
  const lastBeat = hb?.lastBeat ?? null;
  const staleSec = lastBeat ? Math.floor((Date.now() - new Date(lastBeat).getTime()) / 1000) : null;
  return {
    alive: !!active,
    paused: hb?.paused ?? false,
    lastBeat,
    staleSeconds: staleSec,
    healthy: staleSec !== null ? staleSec < 1800 : !!active,
    activeRunId: active?.runId ?? null,
    checkedAt: now,
  };
}

export function getSchedulerStatus() {
  const sched = readOpsFile<SchedulerFile>("scheduler.json");
  const now = new Date().toISOString();
  return {
    enabled: sched?.enabled ?? false,
    cadenceMinutes: sched?.cadenceMinutes ?? 60,
    lastRunAt: sched?.lastRunAt ?? null,
    nextRunAt: sched?.nextRunAt ?? null,
    source: ".ai/operations/scheduler.json",
    checkedAt: now,
  };
}

export function getOvernightStatus() {
  const ov = readOpsFile<OvernightFile>("overnight.json");
  const now = new Date().toISOString();
  return {
    enabled: ov?.enabled ?? false,
    maxTasks: ov?.maxTasks ?? 10,
    tasksRun: ov?.tasksRun ?? 0,
    startedAt: ov?.startedAt ?? null,
    stoppedAt: ov?.stoppedAt ?? null,
    stopReason: ov?.stopReason ?? null,
    safetyGates: ["build must be green", "no destructive shell", "max task cap enforced"],
    source: ".ai/operations/overnight.json",
    checkedAt: now,
  };
}

export function getNextTask() {
  const queue = readOpsFile<QueueFile>("queue.json");
  const pending = (queue?.items ?? []).filter((i) => i.status === "queued");
  const next = pending[0] ?? null;
  return {
    nextTask: next
      ? { id: next.id, title: next.title, source: next.source, addedAt: next.addedAt }
      : null,
    queueDepth: pending.length,
    totalItems: queue?.items?.length ?? 0,
    source: ".ai/operations/queue.json",
    checkedAt: new Date().toISOString(),
  };
}

export function getDefects() {
  const defects = readOpsFile<DefectFile[]>("defects.json") ?? [];
  const unresolved = defects.filter((d) => !d.resolved);
  return {
    total: defects.length,
    unresolved: unresolved.length,
    latest: defects[defects.length - 1] ?? null,
    defects: defects.slice(-5),
    detectionSources: ["build", "browser", "telemetry"],
    source: ".ai/operations/defects.json",
    checkedAt: new Date().toISOString(),
  };
}

export function getPauseResumeState() {
  const hb = readOpsFile<HeartbeatFile>("daemon.json");
  return {
    paused: hb?.paused ?? false,
    instruction: "Write { paused: true } to .ai/operations/daemon.json to pause. Set false to resume. No destructive shell access.",
    source: ".ai/operations/daemon.json",
    checkedAt: new Date().toISOString(),
  };
}

export function getContinuousStatus() {
  const heartbeat = getHeartbeat();
  const scheduler = getSchedulerStatus();
  const overnight = getOvernightStatus();
  const nextTask = getNextTask();
  const defects = getDefects();
  const state = readDaemonState();
  const green = readFinalGreenReport();
  const runs = (state?.runs as RunRecord[]) ?? [];
  const lastGreenRun = runs.filter((r) => r.status === "green").slice(-1)[0] ?? null;
  const lastFailedRun = runs.filter((r) => r.status !== "green").slice(-1)[0] ?? null;

  return {
    heartbeat,
    scheduler,
    overnight: { enabled: overnight.enabled, tasksRun: overnight.tasksRun, maxTasks: overnight.maxTasks },
    queueDepth: nextTask.queueDepth,
    lastValidation: {
      at: (green?.completedAt as string) ?? null,
      passed: green?.status === "green",
    },
    lastRepair: defects.latest
      ? { at: defects.latest.detectedAt, source: defects.latest.source, resolved: defects.latest.resolved }
      : null,
    nextPlannedTask: nextTask.nextTask
      ? { id: nextTask.nextTask.id, title: nextTask.nextTask.title }
      : null,
    operationalSummary: {
      totalRuns: runs.length,
      lastGreenRunId: lastGreenRun?.runId ?? null,
      lastFailedRunId: lastFailedRun?.runId ?? null,
    },
    checkedAt: new Date().toISOString(),
  };
}

export function getFinalGreenReport() {
  const report = readFinalGreenReport();
  if (!report) return null;
  const validation = report.validation as { ok?: boolean; buildBrowser?: { ok?: boolean } } | null;
  return {
    status: (report.status as string) ?? null,
    goal: ((report.goal as string) ?? "").slice(0, 200),
    completedAt: (report.completedAt as string) ?? null,
    greenCommit: (report.greenCommit as { commit?: string } | null)?.commit ?? null,
    validationPassed: !!validation?.ok,
    buildPassed: !!validation?.buildBrowser?.ok,
  };
}

export function getGitState() {
  const cwd = process.cwd();

  function safeExec(cmd: string): string {
    try {
      return execSync(cmd, { cwd, timeout: 2000, encoding: "utf-8", stdio: "pipe" }).trim();
    } catch {
      return "";
    }
  }

  const branch = safeExec("git rev-parse --abbrev-ref HEAD");
  const commitHash = safeExec("git log -1 --pretty=format:%H");
  const commitSubject = safeExec("git log -1 --pretty=oneline").replace(/^\S+\s*/, "").split(/\r?\n/)[0] ?? "";
  const commitDate = safeExec("git log -1 --pretty=format:%ai");
  const statusShort = safeExec("git status --short");
  const diffStat = safeExec("git diff --stat HEAD");

  const lastCommit = commitHash
    ? { hash: commitHash, subject: commitSubject, date: commitDate }
    : null;

  return {
    branch: branch || null,
    lastCommit,
    status: statusShort || "(clean)",
    diffStat: diffStat || "(no unstaged changes)",
    checkedAt: new Date().toISOString(),
  };
}
