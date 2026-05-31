import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const AI_DIR = path.join(process.cwd(), ".ai");
const BUILDS_DIR = path.join(AI_DIR, "builds");

export type BuildStageStatus = "pass" | "fail" | "skip";

export interface BuildStage {
  name: string;
  status: BuildStageStatus;
  durationMs: number;
  output: string;
}

export interface BuildRecord {
  buildId: string;
  runId: string | null;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "green" | "red";
  stages: BuildStage[];
  gitDiffStat: string;
  semanticGate: {
    passed: boolean;
    codeFilesChanged: number;
    aiOnlyChange: boolean;
    note: string;
  };
}

function ensureBuildsDir(): void {
  if (!fs.existsSync(BUILDS_DIR)) fs.mkdirSync(BUILDS_DIR, { recursive: true });
}

function safeExec(cmd: string, cwd = process.cwd()): { output: string; ok: boolean } {
  try {
    const output = execSync(cmd, { cwd, timeout: 60_000, encoding: "utf-8", stdio: "pipe" }).trim();
    return { output, ok: true };
  } catch (err: unknown) {
    const output = err instanceof Error ? err.message : String(err);
    return { output: output.slice(0, 500), ok: false };
  }
}

function runStage(name: string, cmd: string): BuildStage {
  const start = Date.now();
  const result = safeExec(cmd);
  return {
    name,
    status: result.ok ? "pass" : "fail",
    durationMs: Date.now() - start,
    output: result.output.slice(0, 800),
  };
}

function computeSemanticGate(diffStat: string): BuildRecord["semanticGate"] {
  const lines = diffStat.split("\n");
  const codeExts = [".ts", ".tsx", ".js", ".jsx", ".css", ".json"];
  const codeFiles = lines.filter((l) => {
    const trimmed = l.trim();
    return codeExts.some((ext) => trimmed.includes(ext)) && !trimmed.startsWith(".ai/");
  });
  const aiOnlyFiles = lines.filter((l) => l.trim().startsWith(".ai/"));
  const codeFilesChanged = codeFiles.length;
  const aiOnlyChange = codeFilesChanged === 0 && aiOnlyFiles.length > 0;

  return {
    passed: codeFilesChanged > 0 || aiOnlyFiles.length === 0,
    codeFilesChanged,
    aiOnlyChange,
    note: aiOnlyChange
      ? "Only .ai/ files changed — no source code modified"
      : codeFilesChanged > 0
      ? `${codeFilesChanged} code file(s) changed`
      : "No files changed",
  };
}

export function runBuildPipeline(runId: string | null = null): BuildRecord {
  ensureBuildsDir();
  const buildId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const startedAt = new Date().toISOString();

  const stages: BuildStage[] = [];

  const typecheckStage = runStage("typecheck", "npx tsc --noEmit");
  stages.push(typecheckStage);

  const buildStage = runStage("build", "npm run build");
  stages.push(buildStage);

  const diffResult = safeExec("git diff --stat HEAD");
  const gitDiffStat = diffResult.output || "(no diff)";
  const semanticGate = computeSemanticGate(gitDiffStat);

  const overallStatus: BuildRecord["status"] =
    stages.every((s) => s.status === "pass") ? "green" : "red";

  const record: BuildRecord = {
    buildId,
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    status: overallStatus,
    stages,
    gitDiffStat: gitDiffStat.slice(0, 1000),
    semanticGate,
  };

  fs.writeFileSync(
    path.join(BUILDS_DIR, `${buildId}.json`),
    JSON.stringify(record, null, 2),
    "utf-8"
  );

  return record;
}

export function getBuildHistory(limit = 10): BuildRecord[] {
  ensureBuildsDir();
  try {
    const files = fs
      .readdirSync(BUILDS_DIR)
      .filter((f) => f.endsWith(".json") && f !== "queue.json")
      .sort()
      .reverse()
      .slice(0, limit);
    return files.map((f) => JSON.parse(fs.readFileSync(path.join(BUILDS_DIR, f), "utf-8")) as BuildRecord);
  } catch {
    return [];
  }
}

export function getLatestBuildStatus(): BuildRecord | null {
  const history = getBuildHistory(1);
  return history[0] ?? null;
}
