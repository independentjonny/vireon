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
      case "reviewUI":
        return { action, ok: true, summary: "UI review completed.", output: JSON.stringify(await reviewWithGpt("ui"), null, 2) };
      case "reviewCode":
        return { action, ok: true, summary: "Code review completed.", output: JSON.stringify(await reviewWithGpt("code"), null, 2) };
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

function screenshotInput(relativePath: string) {
  const fullPath = path.join(REPO, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return {
    type: "input_image",
    image_url: `data:image/png;base64,${fs.readFileSync(fullPath).toString("base64")}`,
  };
}

async function reviewWithGpt(mode: "ui" | "code", context: Record<string, unknown> = {}): Promise<ReviewResult> {
  const diff = String(context.diff ?? runSync("git diff --stat; git diff", 30_000)).slice(-40_000);
  const buildOutput = String(context.buildOutput ?? "").slice(-12_000);
  const testOutput = String(context.testOutput ?? "").slice(-12_000);
  const screenshots = Array.isArray(context.screenshots) ? context.screenshots.map(String) : [];
  const fallback: ReviewResult = {
    issue: mode === "ui" ? "GPT reviewer unavailable; inspect the visible app and latest diff." : "GPT reviewer unavailable; inspect the latest diff and validation output.",
    file: "src/app/page.tsx",
    task: mode === "ui" ? "Review the current Neven UI and make one substantive improvement." : "Review the current diff and fix the highest-risk code issue.",
    confidence: 0,
    category: mode === "ui" ? "information_hierarchy" : "code_quality",
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const prompt = [
    `You are the Neven GPT Reviewer performing a ${mode} review.`,
    "Input includes screenshots if available, git diff, build output, and test output.",
    "Return strict JSON only:",
    '{"issue":"","file":"","task":"","confidence":0,"category":""}',
    "Use category values such as feature_gap, workflow, information_hierarchy, navigation, dashboard_insight, accessibility, responsiveness, layout, code_quality, test_failure, build_failure.",
    "Prefer substantive hierarchy, workflow, feature, accessibility, responsiveness, or code correctness tasks over spacing-only changes.",
    "",
    "Git diff:",
    diff || "No diff",
    "",
    "Build output:",
    buildOutput || "No build output",
    "",
    "Test output:",
    testOutput || "No test output",
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
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
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
                file: { type: "string" },
                task: { type: "string" },
                confidence: { type: "number" },
                category: { type: "string" },
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
      issue: String(parsed.issue || fallback.issue),
      file: String(parsed.file || fallback.file),
      task: String(parsed.task || fallback.task),
      confidence: Number(parsed.confidence || 0),
      category: String(parsed.category || fallback.category) as ReviewCategory,
    };
  } catch {
    return fallback;
  }
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
  let snapshot: RunSnapshot | null = null;
  let taskError: string | null = null;

  try {
    snapshot = trackedSnapshot();

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
      const beforeReview = await reviewWithGpt("ui", {
        screenshots: [desktop.screenshotPath, mobile.screenshotPath].filter(Boolean),
        diff: runSync("git diff --stat; git diff", 30_000),
      });
      lastReview = beforeReview;
      const plannedTask = [
        `Alex goal: ${task.goal}`,
        `Reviewer issue: ${beforeReview.issue}`,
        `Target file: ${beforeReview.file}`,
        `Reviewer task: ${beforeReview.task}`,
        `Category: ${beforeReview.category}`,
      ].join("\n");

      const codex = await runCodex(plannedTask);
      const typecheck = await executeAction("runCommand", { command: "npx tsc --noEmit", timeoutMs: 120_000 }, true);
      const test = await executeAction("runCommand", { command: "npx playwright test -c tests mobile-nav.spec.ts --reporter=list", timeoutMs: 120_000 }, true);
      const afterDesktop = await executeAction("screenshotDesktop");
      const afterMobile = await executeAction("screenshotMobile");
      const diff = runSync("git diff --stat; git diff", 30_000);
      const afterReview = await reviewWithGpt("ui", {
        screenshots: [afterDesktop.screenshotPath, afterMobile.screenshotPath].filter(Boolean),
        diff,
        buildOutput: typecheck.output,
        testOutput: test.output,
      });
      lastReview = afterReview;
      const improved = scoreReview(afterReview) >= scoreReview(beforeReview) && Boolean(diff.trim()) && typecheck.ok && test.ok;
      let restored: string[] = [];
      if (!improved && snapshot) restored = rollback(snapshot);

      iterations.push({
        iteration,
        beforeReview,
        afterReview,
        improved,
        codex: { ok: codex.ok, summary: codex.summary, output: codex.output?.slice(-4000) },
        typecheck: { ok: typecheck.ok, output: typecheck.output?.slice(-4000) },
        test: { ok: test.ok, output: test.output?.slice(-4000) },
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
    addHistory({ taskId: task.id, action: "task.error", ok: false, summary: taskError });
  }

  const report = {
    ok: finalStatus === "complete",
    taskId: task.id,
    goal: task.goal,
    status: finalStatus,
    error: taskError,
    lastReview,
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
  res.end(JSON.stringify(payload, null, 2));
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, status: readState().status });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  const body = await readRequestBody(req);
  const payload = body ? JSON.parse(body) : {};

  switch (req.url) {
    case "/task": {
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
      {
        const state = readState();
        const tasks = readTasks();
        sendJson(res, 200, {
          ok: true,
          state,
          tasks,
          processing,
          queueLength: tasks.filter((task) => task.status === "queued").length,
          activeTaskId: state.activeTaskId,
          lastError: state.lastError,
        });
      }
      return;
    case "/pause":
      sendJson(res, 200, { ok: true, state: writeState({ paused: true, status: "paused" }) });
      return;
    case "/resume":
      sendJson(res, 200, { ok: true, state: writeState({ paused: false, stopped: false, status: "idle" }) });
      return;
    case "/stop":
      sendJson(res, 200, { ok: true, state: writeState({ stopped: true, paused: false, status: "stopped" }) });
      return;
    case "/report":
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

server.listen(PORT, () => {
  appendLog("supervisor.started", { port: PORT, repo: REPO });
  console.log(`Neven Supervisor running on http://localhost:${PORT}`);
  console.log(`POST /task {"goal":"Improve Neven onboarding"}`);
});
