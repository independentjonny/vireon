import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AI_DIR = join(ROOT, ".ai");
const TASK_PATH = join(AI_DIR, "tasks", "current-task.md");
const STATE_PATH = join(AI_DIR, "daemon-state.json");
const QUOTA_PATH = join(AI_DIR, "operations", "quota-pause.json");
const HEARTBEAT_PATH = join(AI_DIR, "operations", "daemon.json");
const POLL_MS = Number(process.env.NEVEN_DAEMON_POLL_MS || 10000);
const MAX_ATTEMPTS = Number(process.env.NEVEN_DAEMON_MAX_ATTEMPTS || 3);
const HEARTBEAT_INTERVAL_MS = 30000;

mkdirSync(join(AI_DIR, "tasks"), { recursive: true });
mkdirSync(join(AI_DIR, "operations"), { recursive: true });

let processing = false;
let lastTaskHash = "";

function writeHeartbeat(patch = {}) {
  let existing = {};
  try { if (existsSync(HEARTBEAT_PATH)) existing = JSON.parse(readFileSync(HEARTBEAT_PATH, "utf8")); } catch {}
  writeFileSync(HEARTBEAT_PATH, JSON.stringify({ ...existing, ...patch, lastBeat: new Date().toISOString(), pid: process.pid }, null, 2));
}

function readTask() {
  if (!existsSync(TASK_PATH)) return null;
  const text = readFileSync(TASK_PATH, "utf8").trim();
  if (!text) return null;
  return { text, hash: Buffer.from(text).toString("base64").slice(0, 80) };
}

function readState() {
  try { if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, "utf8")); } catch {}
  return {};
}

function writeState(patch) {
  const state = readState();
  writeFileSync(STATE_PATH, JSON.stringify({ ...state, ...patch, updatedAt: new Date().toISOString() }, null, 2));
}

function writeCompletedRun(patch, runRecord) {
  const state = readState();
  const existing = Array.isArray(state.runs) ? state.runs : [];
  const runs = [...existing, runRecord].slice(-50);
  writeFileSync(STATE_PATH, JSON.stringify({ ...state, ...patch, runs, lastRun: runRecord, updatedAt: new Date().toISOString() }, null, 2));
}

function runAutomation(goal) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", "automate", "--", goal], { cwd: ROOT, shell: process.platform === "win32", env: process.env });
    let output = "";
    child.stdout?.on("data", (d) => { output += d.toString(); process.stdout.write(d); });
    child.stderr?.on("data", (d) => { output += d.toString(); process.stderr.write(d); });
    child.on("close", (code) => resolve({ ok: code === 0, code, outputTail: output.slice(-8000) }));
    child.on("error", (error) => resolve({ ok: false, code: 1, outputTail: String(error) }));
  });
}

async function processTask(task) {
  if (!task || processing || task.hash === lastTaskHash) return;
  processing = true;
  lastTaskHash = task.hash;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const startedAt = new Date().toISOString();
  const attempts = [];
  writeState({ activeRun: { runId, goal: task.text, startedAt, attempts }, paused: false });
  writeHeartbeat({ paused: false, activeRunId: runId });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await runAutomation(task.text);
    const attemptEntry = { attempt, ok: result.ok ?? false, code: result.code, outputTail: (result.outputTail ?? "").slice(-2000), completedAt: new Date().toISOString() };
    attempts.push(attemptEntry);

    if (/session limit|quota|rate limit/i.test(result.outputTail ?? "")) {
      writeFileSync(QUOTA_PATH, JSON.stringify({ paused: true, reason: "Claude/session quota or rate limit detected", runId, attempt, at: new Date().toISOString() }, null, 2));
      writeCompletedRun({ activeRun: null, paused: true }, { runId, goal: task.text, status: "paused", startedAt, attempts });
      writeHeartbeat({ paused: true, activeRunId: null });
      processing = false;
      return;
    }

    if (result.ok) {
      writeCompletedRun({ activeRun: null, paused: false }, { runId, goal: task.text, status: "green", startedAt, attempts, completedAt: new Date().toISOString() });
      writeHeartbeat({ paused: false, activeRunId: null });
      processing = false;
      return;
    }
  }

  writeCompletedRun({ activeRun: null, paused: false }, { runId, goal: task.text, status: "failed", startedAt, attempts, completedAt: new Date().toISOString() });
  writeHeartbeat({ paused: false, activeRunId: null });
  processing = false;
}

writeHeartbeat({ paused: false, activeRunId: null });
console.log(`Neven local daemon watching ${TASK_PATH}`);
setInterval(() => writeHeartbeat({}), HEARTBEAT_INTERVAL_MS);
setInterval(() => { processTask(readTask()).catch((error) => { processing = false; writeState({ activeRun: null, lastError: String(error) }); writeHeartbeat({ paused: false, activeRunId: null }); }); }, POLL_MS);
processTask(readTask()).catch((error) => { processing = false; writeState({ activeRun: null, lastError: String(error) }); writeHeartbeat({ paused: false, activeRunId: null }); });
