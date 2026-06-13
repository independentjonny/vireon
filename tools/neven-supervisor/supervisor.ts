import http from "node:http";
import { execFile, execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.NEVEN_SUPERVISOR_PORT ?? 4010);
const REPO = path.resolve(process.env.NEVEN_REPO ?? process.cwd());
const SUPERVISOR_DIR = path.join(REPO, ".ai-supervisor");
const SCREENSHOT_DIR = path.join(SUPERVISOR_DIR, "screenshots");
const TASKS_PATH = path.join(SUPERVISOR_DIR, "tasks.json");
const HISTORY_PATH = path.join(SUPERVISOR_DIR, "history.json");
const STATE_PATH = path.join(SUPERVISOR_DIR, "state.json");
const REPORT_PATH = path.join(SUPERVISOR_DIR, "latest-report.json");
const LOG_PATH = path.join(SUPERVISOR_DIR, "actions.log");
const POLL_MS = Number(process.env.NEVEN_SUPERVISOR_POLL_MS ?? 2500);
const MAX_ITERATIONS = Number(process.env.NEVEN_SUPERVISOR_MAX_ITERATIONS ?? 5);
const APP_URL = process.env.NEVEN_APP_URL ?? "http://localhost:3000";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.5";
const UI_REVIEW_MODE = "UI_REVIEW_MODE" as const;
const BUILD_HEALTH_MODE = "BUILD_HEALTH_MODE" as const;
const UI_REVIEW_FILES = [
  "src/app/page.tsx",
  "src/app/components/OverviewV3.tsx",
  "src/app/components/MobileNav.tsx",
  "src/app/components/sections/TransactionsSection.tsx",
  "src/app/components/sections/SubscriptionsSection.tsx",
  "src/app/components/ImportWorkflow.tsx",
] as const;
const UI_REVIEW_CATEGORIES = [
  "information_hierarchy",
  "navigation",
  "workflow",
  "feature_gap",
  "dashboard_insight",
  "accessibility",
  "responsiveness",
  "layout",
] as const;
const UI_REVIEW_FORBIDDEN_PATTERN =
  /\bpackage\.json\b|\btools[\\/]|\bsupervisor\.ts\b|\bagent-server\.ts\b|\btests[\\/]|\bplaywright\b|\btypescript\b|\bci\b|\bbuild failure\b|\bnpm scripts\b|\binfrastructure\b/i;

type TaskStatus = "queued" | "running" | "complete" | "failed" | "paused" | "stopped" | "needs_approval";
type SupervisorStatus = "idle" | "running" | "paused" | "stopped";
type ReviewCategory =
  | "information_hierarchy"
  | "navigation"
  | "workflow"
  | "feature_gap"
  | "dashboard_insight"
  | "accessibility"
  | "responsiveness"
  | "layout"
  | "code_quality"
  | "test_failure"
  | "build_failure";

type CommandAction =
  | "createFile"
  | "modifyFile"
  | "deleteFile"
  | "runCommand"
  | "killProcess"
  | "startProcess"
  | "restartProcess"
  | "gitStatus"
  | "gitDiff"
  | "gitCommit"
  | "screenshotDesktop"
  | "screenshotMobile"
  | "reviewUI"
  | "reviewCode"
  | "rollback";

type TaskRecord = {
  id: string;
  goal: string;
  status: TaskStatus;
  approved?: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  lastIssue?: string;
  lastReportPath?: string;
  planner?: PlannerResult;
  breakdown?: PlannerTask[];
  codex?: WorkflowStatus["codex"];
  validation?: WorkflowStatus["buildTest"];
  reviewer?: GptReviewerResult;
  workflow?: WorkflowStatus;
};

type HistoryEvent = {
  id: string;
  taskId?: string;
  action: string;
  ok: boolean;
  summary: string;
  createdAt: string;
  data?: unknown;
};

type SupervisorState = {
  status: SupervisorStatus;
  activeTaskId: string | null;
  paused: boolean;
  stopped: boolean;
  lastError: string | null;
  lastBeat: string;
  processes: Record<string, { command: string; args: string[]; pid?: number; startedAt: string }>;
};

type CommandResult = {
  action: CommandAction;
  ok: boolean;
  summary: string;
  output?: string;
  code?: number | null;
  path?: string;
  screenshotPath?: string;
};

type ReviewResult = {
  issue: string;
  file: string;
  task: string;
  confidence: number;
  category: ReviewCategory;
};

type BuildHealthResult = {
  mode: typeof BUILD_HEALTH_MODE;
  ok: boolean;
  typecheck: Pick<CommandResult, "ok" | "summary" | "output" | "code">;
  test: Pick<CommandResult, "ok" | "summary" | "output" | "code">;
  failures: string[];
};

type PlannerTask = {
  title: string;
  type: "inspect" | "edit" | "test" | "review";
  instructions: string;
};

type PlannerOutput = {
  summary: string;
  tasks: PlannerTask[];
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
};

type PlannerResult = {
  status: "skipped" | "complete" | "failed";
  reason?: string;
  output?: PlannerOutput;
};

type GptReviewerOutput = {
  accepted: boolean;
  reviewSummary: string;
  issues: string[];
  recommendedNextTask: string;
};

type GptReviewerResult = {
  status: "skipped" | "complete" | "failed";
  reason?: string;
  output?: GptReviewerOutput;
};

type WorkflowStatus = {
  planner?: PlannerResult;
  codex?: {
    status: "pending" | "running" | "complete" | "failed";
    summaries: string[];
  };
  buildTest?: {
    status: "pending" | "running" | "passed" | "failed";
    failures?: string[];
  };
  reviewer?: GptReviewerResult;
  recommendedNextTask?: string;
};

type RunSnapshot = {
  trackedFiles: Map<string, string>;
  untrackedFiles: Set<string>;
};

const runningProcesses = new Map<string, ChildProcess>();

function now() {
  return new Date().toISOString();
}

function ensureSupervisorFiles() {
  fs.mkdirSync(SUPERVISOR_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  if (!fs.existsSync(TASKS_PATH)) writeJson(TASKS_PATH, []);
  if (!fs.existsSync(HISTORY_PATH)) writeJson(HISTORY_PATH, []);
  if (!fs.existsSync(STATE_PATH)) {
    writeJson(STATE_PATH, {
      status: "idle",
      activeTaskId: null,
      paused: false,
      stopped: false,
      lastError: null,
      lastBeat: now(),
      processes: {},
    } satisfies SupervisorState);
  }
  if (!fs.existsSync(REPORT_PATH)) writeJson(REPORT_PATH, { ok: true, status: "empty", generatedAt: now() });
}

function loadLocalEnv() {
  const envPath = path.join(REPO, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function appendLog(message: string, data?: unknown) {
  const line = JSON.stringify({ at: now(), message, data }) + "\n";
  fs.appendFileSync(LOG_PATH, line, "utf8");
}

function addHistory(event: Omit<HistoryEvent, "id" | "createdAt">) {
  const history = readJson<HistoryEvent[]>(HISTORY_PATH, []);
  const record: HistoryEvent = {
    id: createId("hist"),
    createdAt: now(),
    ...event,
  };
  history.push(record);
  writeJson(HISTORY_PATH, history.slice(-500));
  appendLog(event.action, event);
}

function readState() {
  return readJson<SupervisorState>(STATE_PATH, {
    status: "idle",
    activeTaskId: null,
    paused: false,
    stopped: false,
    lastError: null,
    lastBeat: now(),
    processes: {},
  });
}

function writeState(patch: Partial<SupervisorState>) {
  const state = { ...readState(), ...patch, lastBeat: now() };
  writeJson(STATE_PATH, state);
  return state;
}

function readTasks() {
  return readJson<TaskRecord[]>(TASKS_PATH, []);
}

function writeTasks(tasks: TaskRecord[]) {
  writeJson(TASKS_PATH, tasks);
}

function updateTask(taskId: string, patch: Partial<TaskRecord>) {
  const tasks = readTasks();
  const next = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          ...patch,
          updatedAt: now(),
        }
      : task
  );
  writeTasks(next);
  return next.find((task) => task.id === taskId) ?? null;
}

function updateTaskWorkflow(taskId: string, workflow: WorkflowStatus) {
  return updateTask(taskId, {
    planner: workflow.planner,
    breakdown: workflow.planner?.output?.tasks ?? [],
    codex: workflow.codex,
    validation: workflow.buildTest,
    reviewer: workflow.reviewer,
    workflow,
  });
}

function repairStaleRunningTasks() {
  const tasks = readTasks();
  const repaired: string[] = [];
  const repairedAt = now();
  const nextTasks = tasks.map((task) => {
    if (task.status !== "running") return task;
    repaired.push(task.id);
    return {
      ...task,
      status: "failed" as TaskStatus,
      completedAt: repairedAt,
      updatedAt: repairedAt,
      lastIssue: "Repaired stale running task",
      lastReportPath: ".ai-supervisor/latest-report.json",
    };
  });

  writeTasks(nextTasks);

  const currentState = readState();
  const state = writeState({
    activeTaskId: null,
    status: currentState.paused ? "paused" : "idle",
    stopped: false,
    lastError: repaired.length > 0 ? "Repaired stale running task" : currentState.lastError,
  });

  writeJson(REPORT_PATH, {
    ok: true,
    status: "repaired",
    repaired,
    summary:
      repaired.length > 0
        ? `Repaired stale running tasks: ${repaired.join(", ")}`
        : "No stale running tasks found.",
    generatedAt: repairedAt,
  });

  addHistory({
    action: "repair",
    ok: true,
    summary:
      repaired.length > 0
        ? `Repaired stale running tasks: ${repaired.join(", ")}`
        : "No stale running tasks found.",
    data: { repaired },
  });

  return { repaired, state };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safePath(input: string) {
  const full = path.resolve(REPO, input.replaceAll("/", path.sep));
  const relative = path.relative(REPO, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe path outside repo: ${input}`);
  }
  return full;
}

function normalizedRepoPath(fullPath: string) {
  return path.relative(REPO, fullPath).replaceAll("\\", "/");
}

function isSecretPath(filePath: string) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  return (
    normalized.includes(".env") ||
    normalized.includes("secret") ||
    normalized.includes("credential") ||
    normalized.endsWith(".pem") ||
    normalized.endsWith(".key")
  );
}

function commandNeedsApproval(command: string) {
  return /\b(npm|pnpm|yarn|bun)\s+(install|add|upgrade|update)\b/i.test(command) ||
    /\b(prisma|drizzle|sequelize|typeorm)\b.*\b(migrate|migration|db\s+push)\b/i.test(command) ||
    /\bgit\s+push\b/i.test(command) ||
    /\b--force\b/i.test(command);
}

function assertSafeCommand(command: string, approved = false) {
  if (/\bgit\s+push\b.*\b(--force|-f)\b/i.test(command)) {
    throw new Error("Safety blocked force push.");
  }
  if (/\bRemove-Item\b.*\b-Recurse\b/i.test(command) || /\brm\s+-rf\b/i.test(command)) {
    throw new Error("Safety blocked recursive delete.");
  }
  if (commandNeedsApproval(command) && !approved) {
    throw new Error("Approval required for package installs, dependency upgrades, database migrations, or push operations.");
  }
}

function assertSafeFileAction(filePath: string) {
  const fullPath = safePath(filePath);
  if (fullPath === REPO) throw new Error("Safety blocked repo root modification.");
  if (isSecretPath(filePath)) throw new Error("Safety blocked modifying secrets.");
  return fullPath;
}

function execPowerShell(command: string, timeoutMs = 120_000, approved = false): Promise<CommandResult> {
  assertSafeCommand(command, approved);
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      {
        cwd: REPO,
        env: process.env,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 50,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n");
        resolve({
          action: "runCommand",
          ok: !error,
          code: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          summary: error ? `Command failed: ${command}` : `Command completed: ${command}`,
          output: output.slice(-30_000),
        });
      }
    );
  });
}

function runSync(command: string, timeoutMs = 60_000) {
  try {
    return execSync(command, {
      cwd: REPO,
      encoding: "utf8",
      shell: "powershell.exe",
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 50,
    });
  } catch (err: any) {
    return [err.stdout?.toString() ?? "", err.stderr?.toString() ?? "", err.message ?? ""].join("\n");
  }
}

function trackedSnapshot(): RunSnapshot {
  const trackedFiles = new Map<string, string>();
  const files = runSync("git ls-files", 30_000)
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  for (const file of files) {
    if (isSecretPath(file)) continue;
    const fullPath = path.join(REPO, file);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      trackedFiles.set(file.replaceAll("\\", "/"), fs.readFileSync(fullPath, "utf8"));
    }
  }
  const untrackedFiles = new Set(
    runSync("git ls-files --others --exclude-standard", 30_000)
      .split(/\r?\n/)
      .map((file) => file.trim().replaceAll("\\", "/"))
      .filter(Boolean)
  );
  return { trackedFiles, untrackedFiles };
}

function rollback(snapshot: RunSnapshot): string[] {
  const restored: string[] = [];
  const currentTracked = runSync("git ls-files", 30_000)
    .split(/\r?\n/)
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean);

  for (const file of currentTracked) {
    if (isSecretPath(file)) continue;
    const previous = snapshot.trackedFiles.get(file);
    if (previous === undefined) continue;
    const fullPath = path.join(REPO, file);
    if (!fs.existsSync(fullPath) || fs.readFileSync(fullPath, "utf8") !== previous) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, previous, "utf8");
      restored.push(file);
    }
  }

  const currentUntracked = runSync("git ls-files --others --exclude-standard", 30_000)
    .split(/\r?\n/)
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean);
  for (const file of currentUntracked) {
    if (snapshot.untrackedFiles.has(file) || isSecretPath(file) || file.startsWith(".ai-supervisor/")) continue;
    const fullPath = path.join(REPO, file);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
      restored.push(`deleted ${file}`);
    }
  }

  return restored;
}

async function executeAction(action: CommandAction, input: Record<string, unknown> = {}, approved = false): Promise<CommandResult> {
  try {
    switch (action) {
      case "createFile": {
        const target = String(input.path ?? "");
        const content = String(input.content ?? "");
        const fullPath = assertSafeFileAction(target);
        if (fs.existsSync(fullPath)) throw new Error(`File already exists: ${target}`);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, "utf8");
        return { action, ok: true, path: target, summary: `Created ${target}` };
      }
      case "modifyFile": {
        const target = String(input.path ?? "");
        const content = String(input.content ?? "");
        const fullPath = assertSafeFileAction(target);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, "utf8");
        return { action, ok: true, path: target, summary: `Modified ${target}` };
      }
      case "deleteFile": {
        const target = String(input.path ?? "");
        const fullPath = assertSafeFileAction(target);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) fs.unlinkSync(fullPath);
        return { action, ok: true, path: target, summary: `Deleted ${target}` };
      }
      case "runCommand":
        return execPowerShell(String(input.command ?? ""), Number(input.timeoutMs ?? 120_000), approved);
      case "startProcess": {
        const name = String(input.name ?? createId("proc"));
        const command = String(input.command ?? "");
        assertSafeCommand(command, approved);
        const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
          cwd: REPO,
          env: process.env,
          detached: false,
          stdio: "ignore",
        });
        child.unref();
        runningProcesses.set(name, child);
        const state = readState();
        writeState({
          processes: {
            ...state.processes,
            [name]: { command, args: [], pid: child.pid, startedAt: now() },
          },
        });
        return { action, ok: true, summary: `Started process ${name}`, code: child.pid ?? null };
      }
      case "killProcess": {
        const name = String(input.name ?? "");
        const processId = Number(input.pid ?? readState().processes[name]?.pid ?? 0);
        if (!processId) throw new Error("Missing process name or pid.");
        process.kill(processId);
        const state = readState();
        const processes = { ...state.processes };
        delete processes[name];
        writeState({ processes });
        return { action, ok: true, summary: `Killed process ${name || processId}` };
      }
      case "restartProcess": {
        const name = String(input.name ?? "");
        const existing = readState().processes[name];
        if (existing?.pid) {
          try {
            process.kill(existing.pid);
          } catch {}
        }
        return executeAction("startProcess", { name, command: String(input.command ?? existing?.command ?? "") }, approved);
      }
      case "gitStatus":
        return { action, ok: true, summary: "Git status captured.", output: runSync("git status --short", 30_000) };
      case "gitDiff":
        return { action, ok: true, summary: "Git diff captured.", output: runSync("git diff --stat; git diff", 30_000) };
      case "gitCommit": {
        const message = String(input.message ?? "Neven supervisor improvement").replaceAll('"', "'");
        const status = runSync("git status --short", 30_000).trim();
        if (!status) return { action, ok: true, summary: "No changes to commit." };
        const output = runSync(`git add -A; git commit -m "${message}"`, 120_000);
        return { action, ok: !/nothing to commit|failed/i.test(output), summary: "Git commit attempted.", output };
      }
      case "screenshotDesktop":
        return screenshot("desktop", 1440, 1200);
      case "screenshotMobile":
        return screenshot("mobile", 390, 1200);
      case "reviewUI": {
        const desktop = await screenshot("desktop", 1440, 1200);
        const mobile = await screenshot("mobile", 390, 1200);
        const review = await reviewUiWithRetry({
          screenshots: [desktop.screenshotPath, mobile.screenshotPath].filter(Boolean),
        });
        return { action, ok: true, summary: "UI review completed.", output: JSON.stringify({ review, screenshots: { desktop, mobile } }, null, 2) };
      }
      case "reviewCode":
        return { action, ok: true, summary: "Build health completed.", output: JSON.stringify(await runBuildHealth(), null, 2) };
      case "rollback":
        throw new Error("Rollback requires an active task snapshot and is only available inside the autonomous loop.");
      default:
        return { action, ok: false, summary: `Unsupported action: ${action}` };
    }
  } catch (err: any) {
    return { action, ok: false, summary: err.message ?? String(err) };
  }
}

async function screenshot(kind: "desktop" | "mobile", width: number, height: number): Promise<CommandResult> {
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${kind}.png`;
  const relativePath = `.ai-supervisor/screenshots/${fileName}`;
  const result = await execPowerShell(
    `npx playwright screenshot --timeout=30000 --viewport-size=${width},${height} ${APP_URL} ${relativePath}`,
    45_000,
    true
  );
  return {
    action: kind === "desktop" ? "screenshotDesktop" : "screenshotMobile",
    ok: result.ok,
    summary: result.ok ? `${kind} screenshot captured.` : result.summary,
    output: result.output,
    screenshotPath: relativePath,
  };
}

function responseTextFromOpenAI(payload: any) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const parts: string[] = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function fallbackPlanner(): PlannerOutput {
  return {
    summary: "Direct Codex execution without GPT planning.",
    tasks: [
      {
        title: "Execute requested improvement",
        type: "edit",
        instructions: "Use the existing Neven autonomous flow to inspect, edit, validate, and summarize the requested task.",
      },
    ],
    riskLevel: "medium",
    requiresApproval: false,
  };
}

function sanitizePlannerOutput(value: Partial<PlannerOutput> | null | undefined): PlannerOutput {
  const fallback = fallbackPlanner();
  const validTypes = new Set(["inspect", "edit", "test", "review"]);
  const tasks = Array.isArray(value?.tasks)
    ? value.tasks
        .map((item) => ({
          title: String(item?.title ?? "").trim(),
          type: validTypes.has(String(item?.type)) ? (String(item?.type) as PlannerTask["type"]) : "edit",
          instructions: String(item?.instructions ?? "").trim(),
        }))
        .filter((item) => item.title && item.instructions)
        .slice(0, 6)
    : [];
  const risk = String(value?.riskLevel ?? fallback.riskLevel);

  return {
    summary: String(value?.summary ?? fallback.summary).trim() || fallback.summary,
    tasks: tasks.length > 0 ? tasks : fallback.tasks,
    riskLevel: risk === "low" || risk === "medium" || risk === "high" ? risk : fallback.riskLevel,
    requiresApproval: Boolean(value?.requiresApproval),
  };
}

function sanitizeReviewerOutput(value: Partial<GptReviewerOutput> | null | undefined): GptReviewerOutput {
  return {
    accepted: Boolean(value?.accepted),
    reviewSummary: String(value?.reviewSummary ?? "GPT reviewer did not return a summary.").trim(),
    issues: Array.isArray(value?.issues) ? value.issues.map(String).filter(Boolean).slice(0, 8) : [],
    recommendedNextTask: String(value?.recommendedNextTask ?? "").trim(),
  };
}

async function callOpenAIJson<T>(name: string, schema: Record<string, unknown>, prompt: string): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: {
        format: {
          type: "json_schema",
          name,
          strict: true,
          schema,
        },
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload.error?.message ?? `OpenAI request failed with ${response.status}`));
  return JSON.parse(responseTextFromOpenAI(payload)) as T;
}

function recentFailures() {
  return readJson<HistoryEvent[]>(HISTORY_PATH, [])
    .filter((event) => !event.ok)
    .slice(-8)
    .map((event) => `${event.createdAt} ${event.action}: ${event.summary}`)
    .join("\n") || "No recent failures.";
}

async function runGptPlanner(task: TaskRecord): Promise<PlannerResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { status: "skipped", reason: "missing OPENAI_API_KEY", output: fallbackPlanner() };
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["inspect", "edit", "test", "review"] },
            instructions: { type: "string" },
          },
          required: ["title", "type", "instructions"],
        },
      },
      riskLevel: { type: "string", enum: ["low", "medium", "high"] },
      requiresApproval: { type: "boolean" },
    },
    required: ["summary", "tasks", "riskLevel", "requiresApproval"],
  };
  const prompt = [
    "You are the GPT Planner for Neven's local autonomous coding supervisor.",
    "Return strict JSON matching the schema.",
    "Plan only safe local repository work. Do not request package installs, secret edits, git push, force operations, or destructive deletes.",
    "",
    `User task goal:\n${task.goal}`,
    "",
    `Current repo status:\n${runSync("git status --short", 30_000).slice(-6000) || "Clean working tree."}`,
    "",
    `Recent failures:\n${recentFailures()}`,
    "",
    "Available commands:",
    "- codex exec -s workspace-write",
    "- npx tsc --noEmit",
    "- npx playwright test",
    "- npm run build",
    "- Playwright screenshot capture",
  ].join("\n");

  try {
    const output = sanitizePlannerOutput(await callOpenAIJson<PlannerOutput>("neven_planner", schema, prompt));
    return { status: "complete", output };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "GPT Planner failed.",
      output: fallbackPlanner(),
    };
  }
}

async function runGptReviewer(input: {
  goal: string;
  planner: PlannerResult;
  diffSummary: string;
  buildHealth: BuildHealthResult;
  screenshots: string[];
}): Promise<GptReviewerResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { status: "skipped", reason: "missing OPENAI_API_KEY" };
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      accepted: { type: "boolean" },
      reviewSummary: { type: "string" },
      issues: { type: "array", items: { type: "string" } },
      recommendedNextTask: { type: "string" },
    },
    required: ["accepted", "reviewSummary", "issues", "recommendedNextTask"],
  };
  const prompt = [
    "You are the GPT Reviewer for Neven's autonomous coding workflow.",
    "Return strict JSON matching the schema.",
    "Accept only if the code change appears aligned with the goal and validation is acceptable.",
    "",
    `Task goal:\n${input.goal}`,
    "",
    `Planner output:\n${JSON.stringify(input.planner.output ?? null, null, 2)}`,
    "",
    `Git diff summary:\n${input.diffSummary.slice(-8000) || "No diff."}`,
    "",
    `Build/test result:\n${JSON.stringify(input.buildHealth, null, 2).slice(-8000)}`,
    "",
    `Screenshot paths:\n${input.screenshots.join("\n")}`,
  ].join("\n");

  try {
    const output = sanitizeReviewerOutput(await callOpenAIJson<GptReviewerOutput>("neven_reviewer", schema, prompt));
    return { status: "complete", output };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "GPT Reviewer failed.",
    };
  }
}

function screenshotInput(relativePath: string) {
  const fullPath = path.join(REPO, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return {
    type: "input_image",
    image_url: `data:image/png;base64,${fs.readFileSync(fullPath).toString("base64")}`,
  };
}

function fallbackUiReview(): ReviewResult {
  return {
    issue: "GPT reviewer unavailable; inspect the visible dashboard and choose the clearest visual improvement.",
    file: UI_REVIEW_FILES[0],
    task: "Improve the visible dashboard hierarchy or workflow clarity based on the screenshots.",
    confidence: 0,
    category: "information_hierarchy",
  };
}

function isAllowedUiReview(review: ReviewResult) {
  const combined = [review.issue, review.file, review.task, review.category].join("\n");
  return (
    (UI_REVIEW_FILES as readonly string[]).includes(review.file) &&
    (UI_REVIEW_CATEGORIES as readonly string[]).includes(review.category) &&
    !UI_REVIEW_FORBIDDEN_PATTERN.test(combined)
  );
}

function sanitizeUiReview(review: ReviewResult) {
  return isAllowedUiReview(review) ? review : fallbackUiReview();
}

async function reviewWithGpt(mode: typeof UI_REVIEW_MODE, context: Record<string, unknown> = {}): Promise<ReviewResult> {
  const screenshots = Array.isArray(context.screenshots) ? context.screenshots.map(String) : [];
  const fallback = fallbackUiReview();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const prompt = [
    `You are the Neven visual reviewer using ${mode}.`,
    "Inspect only the screenshots.",
    "Identify the highest-impact visible dashboard improvement.",
    "Do not inspect or mention git diff, package.json, tools, tests, TypeScript, Playwright, CI, build output, supervisor files, agent files, npm scripts, or infrastructure.",
    "Return strict JSON only:",
    '{"issue":"","file":"","task":"","confidence":0,"category":""}',
    `The file must be one of: ${UI_REVIEW_FILES.join(", ")}.`,
    `The category must be one of: ${UI_REVIEW_CATEGORIES.join(", ")}.`,
    "Prefer substantive hierarchy, workflow, feature, accessibility, responsiveness, or layout tasks over spacing-only changes.",
    "",
    "Screenshots are the complete review input.",
  ].join("\n");

  const content = [
    { type: "input_text", text: prompt },
    ...screenshots.map(screenshotInput).filter(Boolean),
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "neven_review",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                issue: { type: "string" },
                file: { type: "string", enum: UI_REVIEW_FILES },
                task: { type: "string" },
                confidence: { type: "number" },
                category: { type: "string", enum: UI_REVIEW_CATEGORIES },
              },
              required: ["issue", "file", "task", "confidence", "category"],
            },
          },
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return fallback;
    const text = responseTextFromOpenAI(payload);
    const parsed = JSON.parse(text) as ReviewResult;
    return {
      issue: String(parsed.issue || fallback.issue).trim(),
      file: String(parsed.file || fallback.file).trim(),
      task: String(parsed.task || fallback.task).trim(),
      confidence: Number(parsed.confidence || 0),
      category: String(parsed.category || fallback.category).trim() as ReviewCategory,
    };
  } catch {
    return fallback;
  }
}

async function reviewUiWithRetry(context: Record<string, unknown> = {}, attempts = 3): Promise<ReviewResult> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const review = await reviewWithGpt(UI_REVIEW_MODE, context);
    if (isAllowedUiReview(review)) return review;
  }
  return fallbackUiReview();
}

async function runBuildHealth(): Promise<BuildHealthResult> {
  const typecheck = await executeAction("runCommand", { command: "npx tsc --noEmit", timeoutMs: 120_000 }, true);
  const test = await executeAction("runCommand", { command: "npx playwright test -c tests mobile-nav.spec.ts --reporter=list", timeoutMs: 120_000 }, true);
  const failures = [
    typecheck.ok ? "" : `Typecheck failed: ${typecheck.summary}`,
    test.ok ? "" : `Tests failed: ${test.summary}`,
  ].filter(Boolean);

  return {
    mode: BUILD_HEALTH_MODE,
    ok: typecheck.ok && test.ok,
    typecheck: { ok: typecheck.ok, summary: typecheck.summary, output: typecheck.output?.slice(-4000), code: typecheck.code },
    test: { ok: test.ok, summary: test.summary, output: test.output?.slice(-4000), code: test.code },
    failures,
  };
}

async function runCodex(task: string) {
  const promptPath = path.join(SUPERVISOR_DIR, `${createId("codex")}.txt`);
  const prompt = [
    `You are working in the Neven repo at ${REPO}.`,
    "",
    "Task:",
    task,
    "",
    "Rules:",
    "- Make a substantive, reviewable improvement.",
    "- Do not modify secrets, package files, lockfiles, migrations, or API integrations unless explicitly required.",
    "- Do not install packages.",
    "- Do not run npm run build unless explicitly asked.",
    "- Do not commit.",
    "- Return summary only.",
  ].join("\n");
  fs.writeFileSync(promptPath, prompt, "utf8");
  return execPowerShell(`Get-Content -Raw ${quotePath(promptPath)} | codex exec -s workspace-write -`, 300_000, true);
}

function quotePath(filePath: string) {
  return `"${filePath.replaceAll('"', '\\"')}"`;
}

function scoreReview(review: ReviewResult) {
  return Math.max(0, Math.min(1, review.confidence));
}

async function processTask(task: TaskRecord) {
  updateTask(task.id, { status: "running", startedAt: task.startedAt ?? now(), attempts: task.attempts + 1 });
  writeState({ status: "running", activeTaskId: task.id, paused: false, stopped: false, lastError: null });
  addHistory({ taskId: task.id, action: "task.start", ok: true, summary: task.goal });

  const iterations: unknown[] = [];
  let finalStatus: TaskStatus = "failed";
  let lastReview: ReviewResult | null = null;
  let lastBuildHealth: BuildHealthResult | null = null;
  let snapshot: RunSnapshot | null = null;
  let taskError: string | null = null;
  let plannerResult: PlannerResult | null = null;
  let gptReviewerResult: GptReviewerResult | null = null;

  try {
    snapshot = trackedSnapshot();
    plannerResult = await runGptPlanner(task);
    updateTaskWorkflow(task.id, {
      planner: plannerResult,
      codex: { status: "pending", summaries: [] },
      buildTest: { status: "pending" },
      reviewer: { status: "skipped", reason: "GPT Reviewer has not run yet." },
      recommendedNextTask: plannerResult.output?.tasks[0]?.title,
    });
    addHistory({
      taskId: task.id,
      action: "gpt.planner",
      ok: plannerResult.status !== "failed",
      summary: plannerResult.reason ?? plannerResult.output?.summary ?? "GPT Planner completed.",
      data: plannerResult,
    });

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
      const state = readState();
      if (state.paused) {
        finalStatus = "paused";
        break;
      }
      if (state.stopped) {
        finalStatus = "stopped";
        break;
      }

      const desktop = await executeAction("screenshotDesktop");
      const mobile = await executeAction("screenshotMobile");
      const beforeReview = await reviewUiWithRetry({
        screenshots: [desktop.screenshotPath, mobile.screenshotPath].filter(Boolean),
      });
      lastReview = beforeReview;
      const plannedTask = [
        `Alex goal: ${task.goal}`,
        `Review mode: ${UI_REVIEW_MODE}`,
        `Reviewer issue: ${beforeReview.issue}`,
        `Target file: ${beforeReview.file}`,
        `Reviewer task: ${beforeReview.task}`,
        `Category: ${beforeReview.category}`,
      ].join("\n");

      const plannerTasks = plannerResult?.status === "complete" && plannerResult.output?.tasks.length
        ? plannerResult.output.tasks
        : fallbackPlanner().tasks;
      const codexResults: CommandResult[] = [];
      updateTaskWorkflow(task.id, {
        planner: plannerResult ?? undefined,
        codex: { status: "running", summaries: [] },
        buildTest: { status: "pending" },
        reviewer: { status: "skipped", reason: "GPT Reviewer has not run yet." },
        recommendedNextTask: plannerResult?.output?.tasks[0]?.title,
      });

      if (plannerResult?.status === "skipped") {
        codexResults.push(await runCodex(plannedTask));
      } else {
        for (const plannerTask of plannerTasks) {
          const codexPrompt = [
            plannedTask,
            "",
            "GPT Planner task:",
            `Title: ${plannerTask.title}`,
            `Type: ${plannerTask.type}`,
            `Instructions: ${plannerTask.instructions}`,
            "",
            "Preserve all existing supervisor safety rules. Keep changes focused on this planner task.",
          ].join("\n");
          codexResults.push(await runCodex(codexPrompt));
        }
      }

      const codexOk = codexResults.every((result) => result.ok);
      updateTaskWorkflow(task.id, {
        planner: plannerResult ?? undefined,
        codex: {
          status: codexOk ? "complete" : "failed",
          summaries: codexResults.map((result) => result.summary),
        },
        buildTest: { status: "running" },
        reviewer: { status: "skipped", reason: "GPT Reviewer has not run yet." },
        recommendedNextTask: plannerResult?.output?.tasks[0]?.title,
      });
      const buildHealth = await runBuildHealth();
      lastBuildHealth = buildHealth;
      const afterDesktop = await executeAction("screenshotDesktop");
      const afterMobile = await executeAction("screenshotMobile");
      const diff = runSync("git diff --stat; git diff", 30_000);
      gptReviewerResult = await runGptReviewer({
        goal: task.goal,
        planner: plannerResult ?? { status: "skipped", reason: "GPT Planner skipped.", output: fallbackPlanner() },
        diffSummary: diff,
        buildHealth,
        screenshots: [afterDesktop.screenshotPath, afterMobile.screenshotPath].filter(Boolean) as string[],
      });
      updateTaskWorkflow(task.id, {
        planner: plannerResult ?? undefined,
        codex: {
          status: codexOk ? "complete" : "failed",
          summaries: codexResults.map((result) => result.summary),
        },
        buildTest: {
          status: buildHealth.ok ? "passed" : "failed",
          failures: buildHealth.failures,
        },
        reviewer: gptReviewerResult,
        recommendedNextTask: gptReviewerResult.output?.recommendedNextTask ?? plannerResult?.output?.tasks[0]?.title,
      });
      addHistory({
        taskId: task.id,
        action: "gpt.reviewer",
        ok: gptReviewerResult.status !== "failed" && gptReviewerResult.output?.accepted !== false,
        summary: gptReviewerResult.reason ?? gptReviewerResult.output?.reviewSummary ?? "GPT Reviewer skipped.",
        data: gptReviewerResult,
      });
      const afterReview = await reviewUiWithRetry({
        screenshots: [afterDesktop.screenshotPath, afterMobile.screenshotPath].filter(Boolean),
      });
      lastReview = afterReview;
      const gptAccepted = gptReviewerResult.status === "complete" ? Boolean(gptReviewerResult.output?.accepted) : true;
      const improved = codexOk && buildHealth.ok && gptAccepted && scoreReview(afterReview) >= scoreReview(beforeReview) && Boolean(diff.trim());
      let restored: string[] = [];
      if (!improved && snapshot) restored = rollback(snapshot);

      iterations.push({
        iteration,
        reviewMode: UI_REVIEW_MODE,
        beforeReview,
        afterReview,
        planner: plannerResult,
        gptReviewer: gptReviewerResult,
        improved,
        codex: codexResults.map((result) => ({ ok: result.ok, summary: result.summary, output: result.output?.slice(-4000) })),
        buildHealth,
        screenshots: {
          before: { desktop: desktop.screenshotPath, mobile: mobile.screenshotPath },
          after: { desktop: afterDesktop.screenshotPath, mobile: afterMobile.screenshotPath },
        },
        rollback: { occurred: !improved, restored },
      });

      addHistory({
        taskId: task.id,
        action: "loop.iteration",
        ok: improved,
        summary: improved ? "Improvement accepted." : "Change rolled back.",
        data: iterations.at(-1),
      });

      if (improved) {
        const commit = await executeAction("gitCommit", { message: `Improve Neven: ${task.goal.slice(0, 60)}` }, true);
        iterations.push({ commit });
        finalStatus = "complete";
        break;
      }
    }
  } catch (err: any) {
    finalStatus = "failed";
    taskError = err.message ?? String(err);
    addHistory({ taskId: task.id, action: "task.error", ok: false, summary: taskError ?? "Unknown task error" });
  }

  const report = {
    ok: finalStatus === "complete",
    taskId: task.id,
    goal: task.goal,
    status: finalStatus,
    error: taskError,
    planner: plannerResult,
    gptReviewer: gptReviewerResult,
    lastReview,
    lastBuildHealth,
    iterations,
    gitStatus: runSync("git status --short", 30_000),
    generatedAt: now(),
  };
  writeJson(REPORT_PATH, report);
  updateTask(task.id, {
    status: finalStatus,
    completedAt: ["complete", "failed", "stopped"].includes(finalStatus) ? now() : undefined,
    lastIssue: lastReview?.issue,
    lastReportPath: ".ai-supervisor/latest-report.json",
  });
  writeState({
    status: finalStatus === "paused" ? "paused" : "idle",
    activeTaskId: null,
    paused: finalStatus === "paused",
    lastError: taskError,
  });
  addHistory({ taskId: task.id, action: "task.finish", ok: finalStatus === "complete", summary: finalStatus, data: report });
}

let processing = false;

async function supervisorTick() {
  const state = readState();
  writeState({ lastBeat: now() });
  if (processing || state.paused || state.stopped) return;
  const nextTask = readTasks().find((task) => task.status === "queued");
  if (!nextTask) return;
  processing = true;
  try {
    await processTask(nextTask);
  } finally {
    processing = false;
  }
}

function readRequestBody(req: http.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1024 * 1024 * 5) reject(new Error("Request body too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload, null, 2));
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, status: readState().status });
    return;
  }

  switch (req.url) {
    case "/task":
    case "/task-submit": {
      if (req.method !== "POST") {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
      }

      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const goal = String(payload.goal ?? "").trim();
      if (!goal) throw new Error("Missing goal");
      const task: TaskRecord = {
        id: createId("task"),
        goal,
        approved: Boolean(payload.approved),
        status: "queued",
        createdAt: now(),
        updatedAt: now(),
        attempts: 0,
      };
      writeTasks([...readTasks(), task]);
      writeState({ stopped: false, status: "idle" });
      addHistory({ taskId: task.id, action: "task.queued", ok: true, summary: goal });
      sendJson(res, 200, { ok: true, task });
      return;
    }
    case "/status":
      if (req.method !== "GET" && req.method !== "POST") {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
      }

      {
        const state = readState();
        const tasks = readTasks();
        sendJson(res, 200, {
          ok: true,
          state,
          tasks,
          workflows: tasks.map((task) => ({
            taskId: task.id,
            planner: task.planner ?? task.workflow?.planner,
            taskBreakdown: task.breakdown ?? task.workflow?.planner?.output?.tasks ?? [],
            codex: task.codex ?? task.workflow?.codex,
            validation: task.validation ?? task.workflow?.buildTest,
            buildTest: task.validation ?? task.workflow?.buildTest,
            reviewer: task.reviewer ?? task.workflow?.reviewer,
            recommendedNextTask: task.workflow?.recommendedNextTask ?? task.reviewer?.output?.recommendedNextTask,
          })),
          processing,
          queueLength: tasks.filter((task) => task.status === "queued").length,
          activeTaskId: state.activeTaskId,
          lastError: state.lastError,
        });
      }
      return;
    case "/pause":
      if (req.method !== "POST") {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
      }

      sendJson(res, 200, { ok: true, state: writeState({ paused: true, status: "paused" }) });
      return;
    case "/resume":
      if (req.method !== "POST") {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
      }

      sendJson(res, 200, { ok: true, state: writeState({ paused: false, stopped: false, status: "idle" }) });
      return;
    case "/stop":
      if (req.method !== "POST") {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
      }

      sendJson(res, 200, { ok: true, state: writeState({ stopped: true, paused: false, status: "stopped" }) });
      return;
    case "/repair": {
      if (req.method !== "POST") {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
      }

      const { repaired, state } = repairStaleRunningTasks();
      setTimeout(() => {
        supervisorTick().catch((err) => {
          const error = err.message ?? String(err);
          processing = false;
          addHistory({ action: "supervisor.error", ok: false, summary: error });
          writeJson(REPORT_PATH, {
            ok: false,
            status: "failed",
            error,
            generatedAt: now(),
            gitStatus: runSync("git status --short", 30_000),
          });
          writeState({ status: "idle", activeTaskId: null, lastError: error });
        });
      }, 0);
      sendJson(res, 200, { ok: true, repaired, state });
      return;
    }
    case "/report":
      if (req.method !== "GET" && req.method !== "POST") {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        report: fs.existsSync(REPORT_PATH) ? readJson(REPORT_PATH, {}) : {},
        reportPath: ".ai-supervisor/latest-report.json",
      });
      return;
    default:
      sendJson(res, 404, { ok: false, error: "Not found" });
  }
}

loadLocalEnv();
ensureSupervisorFiles();
writeState({ status: readState().paused ? "paused" : "idle", activeTaskId: null, stopped: false });

setInterval(() => {
  supervisorTick().catch((err) => {
    const error = err.message ?? String(err);
    processing = false;
    addHistory({ action: "supervisor.error", ok: false, summary: error });
    writeJson(REPORT_PATH, {
      ok: false,
      status: "failed",
      error,
      generatedAt: now(),
      gitStatus: runSync("git status --short", 30_000),
    });
    writeState({ status: "idle", activeTaskId: null, lastError: error });
  });
}, POLL_MS);

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    addHistory({ action: "api.error", ok: false, summary: err.message ?? String(err) });
    sendJson(res, 500, { ok: false, error: err.message ?? String(err) });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  appendLog("supervisor.started", { port: PORT, repo: REPO });
  console.log(`Neven Supervisor running on http://localhost:${PORT}`);
  console.log(`POST /task {"goal":"Improve Neven onboarding"}`);
});
