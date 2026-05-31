import { spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AI_DIR = join(ROOT, ".ai");
const SCREENSHOT_DIR = join(ROOT, "screenshot");
mkdirSync(AI_DIR, { recursive: true });
mkdirSync(join(AI_DIR, "tasks"), { recursive: true });
mkdirSync(join(AI_DIR, "sc"), { recursive: true });
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function run(command, args, options = {}) {
  const startedAt = new Date().toISOString();
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, shell: process.platform === "win32", env: process.env, ...options });
    let output = "";
    child.stdout?.on("data", (d) => { output += d.toString(); process.stdout.write(d); });
    child.stderr?.on("data", (d) => { output += d.toString(); process.stderr.write(d); });
    child.on("close", (code) => resolve({ command: [command, ...args].join(" "), code, ok: code === 0, outputTail: output.slice(-12000), startedAt, completedAt: new Date().toISOString() }));
    child.on("error", (error) => resolve({ command: [command, ...args].join(" "), code: 1, ok: false, outputTail: String(error), startedAt, completedAt: new Date().toISOString() }));
  });
}

async function main() {
  const goal = process.argv.slice(2).join(" ") || readCurrentTask() || "Local autonomous validation";
  const steps = [];

  steps.push(await run("npm", ["run", "lint"]));
  steps.push(await run("npm", ["run", "build"]));

  // Smoke test should be fast and should not wait for networkidle because the app polls runtime APIs.
  steps.push(await run("npm", ["run", "test:smoke"]));

  // Capture full-page screenshots into /screenshot and /.ai/screenshots.
  steps.push(await run("npm", ["run", "screenshot"]));

  const report = {
    ok: steps.every((s) => s.ok),
    status: steps.every((s) => s.ok) ? "green" : "red",
    goal,
    steps: steps.map(({ command, code, ok, outputTail, startedAt, completedAt }) => ({ command, code, ok, outputTail, startedAt, completedAt })),
    screenshots: readManifest(),
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(join(AI_DIR, "claude-report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(AI_DIR, "final-green-report.json"), JSON.stringify(report, null, 2));
  console.log(`\nAutomation report written to ${join(AI_DIR, "claude-report.json")}`);
  process.exitCode = report.ok ? 0 : 1;
}

function readCurrentTask() {
  const taskPath = join(AI_DIR, "tasks", "current-task.md");
  if (!existsSync(taskPath)) return null;
  return readFileSync(taskPath, "utf8").split("\n").find((line) => line.trim())?.trim() || null;
}

function readManifest() {
  const manifestPath = join(SCREENSHOT_DIR, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  try { return JSON.parse(readFileSync(manifestPath, "utf8")); } catch { return null; }
}

main().catch((error) => {
  const report = { ok: false, status: "red", error: String(error), generatedAt: new Date().toISOString() };
  writeFileSync(join(AI_DIR, "claude-report.json"), JSON.stringify(report, null, 2));
  console.error(error);
  process.exit(1);
});
