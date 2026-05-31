import * as fs from "fs";
import * as path from "path";

const AI_DIR = path.join(process.cwd(), ".ai");
const TASKS_DIR = path.join(AI_DIR, "tasks");

export async function POST(req: Request) {
  let goal = "";
  let forceNew = false;
  try {
    const body = await req.json();
    goal = (body?.goal as string) ?? "";
    forceNew = !!(body?.forceNew);
  } catch {
    // no body or invalid JSON
  }

  if (!goal) {
    return Response.json({ ok: false, error: "goal is required" }, { status: 400 });
  }

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  const assignedAt = new Date().toISOString();
  const goalSliced = goal.slice(0, 600);
  const reportPath = path.join(AI_DIR, "claude-report.json");
  const projectPath = process.cwd();

  const reportJson = JSON.stringify({
    goal: goalSliced,
    filesChanged: [],
    commandsRun: [],
    buildPassed: false,
    errors: [],
    summary: "",
    nextRecommendedStep: "",
  }, null, 2);

  const taskContent = [
    "# Claude Task",
    "",
    "STATUS: ASSIGNED",
    `ATTEMPT: 1`,
    "",
    "GOAL:",
    goalSliced,
    "",
    `PROJECT:\n${projectPath}`,
    "",
    "INSTRUCTIONS:",
    "1. Inspect the relevant files.",
    "2. Make the smallest safe changes.",
    "3. Run npm run build.",
    "4. Write the report file:",
    `   ${reportPath}`,
    "",
    "REPORT JSON:",
    reportJson,
    "",
    "RULES:",
    `- Only edit inside ${projectPath}`,
    "- Do not touch .env files",
    "- Do not delete files",
    "- Do not run destructive git commands",
    "- Allowed commands: npm run build, npm run dev, npm test, git status, git diff",
    "",
    "",
    "",
    "AUTONOMOUS EXECUTION REQUIREMENTS:",
    "- You must actually edit at least one relevant file unless no code change is needed.",
    "- Run npm run build.",
    "- Run git diff --stat.",
    `- Write ${reportPath}.`,
    "- Report exactly what files changed.",
    "- Do not only validate existing app unless the task explicitly asks for validation only.",
    "- Do not touch .env files.",
    "- Do not delete files.",
    "",
    `RUN ID: ${runId}`,
    `ASSIGNED AT: ${assignedAt}`,
    `FORCE NEW: ${forceNew}`,
  ].join("\n");

  try {
    if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
    fs.writeFileSync(path.join(TASKS_DIR, "current-task.md"), taskContent, "utf-8");
  } catch {
    // best-effort write
  }

  return Response.json({
    ok: true,
    runId,
    goal: goalSliced,
    assignedAt,
    status: "ASSIGNED",
    forceNew,
    note: "Goal written to .ai/tasks/current-task.md — daemon will pick up on next cycle",
  });
}
