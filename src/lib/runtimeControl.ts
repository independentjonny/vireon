import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

function getAiDir() { return path.join(/* turbopackIgnore: true */ process.cwd(), ".ai"); }

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

const SECRET_TEXT_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /canary-[A-Za-z0-9_-]+/gi,
  /((?:api[_-]?key|access[_-]?token|client[_-]?secret|token|secret|password)\s*[:=]\s*)["']?[^"'\s,;}]+["']?/gi,
  /(OPENAI_API_KEY|PGPASSWORD|PASSWORD|DATABASE_URL)\s*=\s*["']?[^"'\s]+["']?/gi,
  /\bPASSWORD\s+'[^']*'/gi,
  /\bPASSWORD\s+"[^"]*"/gi,
  /https?:\/\/[^:\s/'"]+:[^@\s'"]+@/gi,
  /postgres(?:ql)?:\/\/[^:\s/'"]+:[^@\s'"]+@/gi,
];

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;

  let output = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  for (const pattern of SECRET_TEXT_PATTERNS) {
    output = output.replace(pattern, (match) => {
      if (/PRIVATE KEY/i.test(match)) return "<redacted-private-key>";
      if (/^Bearer/i.test(match)) return "Bearer <redacted>";
      if (/^eyJ/.test(match)) return "<redacted-token>";
      if (/^sk-/.test(match)) return "<redacted-key>";
      if (/^canary-/i.test(match)) return "<redacted-canary>";
      if (/^PASSWORD\s+['"]/i.test(match)) return "PASSWORD '<redacted>'";
      if (/^https?:/i.test(match)) return match.replace(/\/\/[^:\s/'"]+:[^@\s'"]+@/, "//<redacted>:<redacted>@");
      if (/^postgres/i.test(match)) return match.replace(/\/\/[^:\s/'"]+:[^@\s'"]+@/, "//<redacted>:<redacted>@");
      const keyed = match.match(/^((?:api[_-]?key|access[_-]?token|client[_-]?secret|token|secret|password)\s*[:=]\s*)/i);
      if (keyed) return `${keyed[1]}<redacted>`;
      const key = match.split("=")[0]?.trim() || "SECRET";
      return `${key}=<redacted>`;
    });
  }

  if (!output) return "";
  return output.length > maxLength ? `${output.slice(0, Math.max(0, maxLength - 3))}...` : output;
}

const BRIDGE_FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const BRIDGE_SANITIZER_LIMITS = {
  maxDepth: 4,
  maxStringLength: 400,
  maxArrayLength: 20,
  maxObjectKeys: 24,
};

type BridgeSanitizationDiagnostics = {
  discardedUnexpectedFieldCount: number;
  truncatedFieldCount: number;
  secretRedactedCount: number;
  malformedFieldCount: number;
};

function createSanitizationDiagnostics(): BridgeSanitizationDiagnostics {
  return {
    discardedUnexpectedFieldCount: 0,
    truncatedFieldCount: 0,
    secretRedactedCount: 0,
    malformedFieldCount: 0,
  };
}

function isPlainBridgeObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeBridgeString(value: unknown, maxLength = BRIDGE_SANITIZER_LIMITS.maxStringLength, diag = createSanitizationDiagnostics()): string {
  const raw = typeof value === "string" ? value : value == null ? "" : String(value);
  const redacted = safeText(raw, maxLength) ?? "";
  if (redacted.includes("<redacted")) diag.secretRedactedCount += 1;
  if (raw.length > maxLength) diag.truncatedFieldCount += 1;
  return redacted;
}

function sanitizeBridgeValue(
  value: unknown,
  diag: BridgeSanitizationDiagnostics,
  depth = 0,
): unknown {
  if (depth > BRIDGE_SANITIZER_LIMITS.maxDepth) {
    diag.truncatedFieldCount += 1;
    return "<truncated>";
  }
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return sanitizeBridgeString(value, BRIDGE_SANITIZER_LIMITS.maxStringLength, diag);
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    diag.malformedFieldCount += 1;
    return null;
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    diag.malformedFieldCount += 1;
    return "<binary-redacted>";
  }
  if (Array.isArray(value)) {
    if (value.length > BRIDGE_SANITIZER_LIMITS.maxArrayLength) diag.truncatedFieldCount += 1;
    return value.slice(0, BRIDGE_SANITIZER_LIMITS.maxArrayLength).map((item) => sanitizeBridgeValue(item, diag, depth + 1));
  }
  if (!isPlainBridgeObject(value)) {
    diag.malformedFieldCount += 1;
    return null;
  }
  const out: Record<string, unknown> = {};
  const entries = Object.entries(value).filter(([key]) => {
    if (BRIDGE_FORBIDDEN_KEYS.has(key)) {
      diag.discardedUnexpectedFieldCount += 1;
      return false;
    }
    return true;
  });
  if (entries.length > BRIDGE_SANITIZER_LIMITS.maxObjectKeys) diag.truncatedFieldCount += 1;
  for (const [key, item] of entries.slice(0, BRIDGE_SANITIZER_LIMITS.maxObjectKeys)) {
    out[sanitizeBridgeString(key, 80, diag)] = sanitizeBridgeValue(item, diag, depth + 1);
  }
  return out;
}

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
      latestGreenGoal: safeText(green?.goal, 120),
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
    activeRunGoal: safeText(active?.goal, 120),
    latestGreenGoal: safeText(green?.goal, 120),
    recentRunSummaries: runs.slice(-3).map((r) => ({
      runId: r.runId,
      status: r.status ?? "unknown",
      completedAt: r.completedAt ?? null,
      goalPreview: safeText(r.goal, 80) ?? "",
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
      goalPreview: safeText(r.goal, 100) ?? "",
      status: r.status ?? "unknown",
      startedAt: r.startedAt,
      completedAt: r.completedAt ?? null,
      greenCommit: r.greenCommit?.commit ?? null,
    })),
    activeRun: active
      ? {
          runId: active.runId,
          goalPreview: safeText(active.goal, 100) ?? "",
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
    goalPreview: safeText(r.goal, 80) ?? "",
    status: r.status === "green" ? "completed" : r.status === "paused" ? "paused" : "failed",
    startedAt: r.startedAt,
    completedAt: r.completedAt ?? null,
  }));

  if (active) {
    queue.push({
      runId: active.runId,
      goalPreview: safeText(active.goal, 80) ?? "",
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
    goal: safeText(goal ?? "(no goal)", 200) ?? "(no goal)",
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
    const abs = path.join(/* turbopackIgnore: true */ process.cwd(), relPath);
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
type QueueFile = { items: { id: string; title: string; source: string; addedAt: string; status: string }[] };

const DEFECT_ALLOWED_FIELDS = [
  "id",
  "code",
  "severity",
  "category",
  "title",
  "summary",
  "evidence",
  "affectedFiles",
  "acceptanceCriterion",
  "remediation",
  "status",
  "detectedAt",
  "source",
  "description",
  "repairTaskId",
  "resolved",
] as const;
const DEFECT_EVIDENCE_ALLOWED_FIELDS = new Set(["id", "source", "summary", "detail", "note", "file", "line", "excerpt", "status", "at"]);

type SafeDefect = {
  id: string;
  code: string;
  severity: string;
  category: string;
  title: string;
  summary: string;
  evidence: unknown[];
  affectedFiles: string[];
  acceptanceCriterion: string;
  remediation: string;
  status: string;
  detectedAt: string | null;
  source: string;
  description: string;
  repairTaskId: string | null;
  resolved: boolean;
  discardedUnexpectedFieldCount: number;
  sanitizationStatus: string[];
};

function normalizeDefect(raw: unknown): SafeDefect | null {
  const diag = createSanitizationDiagnostics();
  if (!isPlainBridgeObject(raw)) return null;
  const rawKeys = Object.keys(raw);
  const allowed = new Set<string>(DEFECT_ALLOWED_FIELDS);
  const unexpected = rawKeys.filter((key) => !allowed.has(key) || BRIDGE_FORBIDDEN_KEYS.has(key));
  diag.discardedUnexpectedFieldCount += unexpected.length;

  const field = (name: string, maxLength = 240) => sanitizeBridgeString(raw[name], maxLength, diag);
  const sanitizeEvidence = (item: unknown) => {
    if (!isPlainBridgeObject(item)) return sanitizeBridgeValue(item, diag, 0);
    const evidenceOut: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item).slice(0, BRIDGE_SANITIZER_LIMITS.maxObjectKeys)) {
      if (!DEFECT_EVIDENCE_ALLOWED_FIELDS.has(key) || BRIDGE_FORBIDDEN_KEYS.has(key)) {
        diag.discardedUnexpectedFieldCount += 1;
        continue;
      }
      evidenceOut[key] = sanitizeBridgeValue(value, diag, 1);
    }
    return evidenceOut;
  };
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.slice(0, 8).map(sanitizeEvidence).filter((item) => item !== null)
    : raw.evidence == null
      ? []
      : [sanitizeEvidence(raw.evidence)].filter((item) => item !== null);
  const affectedFiles = Array.isArray(raw.affectedFiles)
    ? raw.affectedFiles.map((item) => sanitizeBridgeString(item, 180, diag)).filter(Boolean).slice(0, 20)
    : [];
  const resolved = raw.resolved === true || raw.status === "resolved";
  const status = field("status", 40) || (resolved ? "resolved" : "open");
  const defect = {
    id: field("id", 80),
    code: field("code", 80),
    severity: field("severity", 40),
    category: field("category", 80),
    title: field("title", 160),
    summary: field("summary", 240),
    evidence,
    affectedFiles,
    acceptanceCriterion: field("acceptanceCriterion", 160),
    remediation: field("remediation", 240),
    status,
    detectedAt: typeof raw.detectedAt === "string" ? sanitizeBridgeString(raw.detectedAt, 40, diag) : null,
    source: field("source", 80),
    description: field("description", 240),
    repairTaskId: typeof raw.repairTaskId === "string" ? sanitizeBridgeString(raw.repairTaskId, 80, diag) : null,
    resolved,
  };
  const sanitizationStatus = [
    diag.discardedUnexpectedFieldCount > 0 ? "MALFORMED_DEFECT_DISCARDED" : null,
    diag.truncatedFieldCount > 0 ? "DEFECT_FIELD_TRUNCATED" : null,
    diag.secretRedactedCount > 0 ? "DEFECT_SECRET_REDACTED" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    id: defect.id,
    code: defect.code,
    severity: defect.severity,
    category: defect.category,
    title: defect.title,
    summary: defect.summary,
    evidence: defect.evidence,
    affectedFiles: defect.affectedFiles,
    acceptanceCriterion: defect.acceptanceCriterion,
    remediation: defect.remediation,
    status: defect.status,
    detectedAt: defect.detectedAt,
    source: defect.source,
    description: defect.description,
    repairTaskId: defect.repairTaskId,
    resolved: defect.resolved,
    discardedUnexpectedFieldCount: diag.discardedUnexpectedFieldCount,
    sanitizationStatus,
  };
}

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
      ? { id: next.id, title: safeText(next.title, 160) ?? "", source: safeText(next.source, 80) ?? "", addedAt: next.addedAt }
      : null,
    queueDepth: pending.length,
    totalItems: queue?.items?.length ?? 0,
    source: ".ai/operations/queue.json",
    checkedAt: new Date().toISOString(),
  };
}

export function getDefects() {
  const raw = readOpsFile<unknown>("defects.json");
  const rawDefects = Array.isArray(raw) ? raw : [];
  const normalized = rawDefects.map(normalizeDefect);
  const defects = normalized.filter((defect): defect is SafeDefect => defect !== null).slice(-20);
  const malformedDiscarded = normalized.length - defects.length;
  const unresolved = defects.filter((d) => !d.resolved);
  return {
    total: rawDefects.length,
    unresolved: unresolved.length,
    malformedDiscarded,
    discardedUnexpectedFieldCount: defects.reduce((sum, defect) => sum + defect.discardedUnexpectedFieldCount, malformedDiscarded),
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
      ? { at: defects.latest.detectedAt, source: safeText(defects.latest.source, 80), resolved: defects.latest.resolved }
      : null,
    nextPlannedTask: nextTask.nextTask
      ? { id: nextTask.nextTask.id, title: safeText(nextTask.nextTask.title, 160) ?? "" }
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
    goal: safeText(report.goal, 200) ?? "",
    completedAt: (report.completedAt as string) ?? null,
    greenCommit: (report.greenCommit as { commit?: string } | null)?.commit ?? null,
    validationPassed: !!validation?.ok,
    buildPassed: !!validation?.buildBrowser?.ok,
  };
}

export function getGitState() {
  const cwd = /* turbopackIgnore: true */ process.cwd();

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
