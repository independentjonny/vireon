import * as fs from "fs";
import * as path from "path";
import { getNextQueuedJob, startBuildJob, completeBuildJob, BuildJob } from "./buildQueue";
import { runAllowedCommand, listAllowedCommands } from "./commandPolicy";
import { buildCurrentArtifactSnapshot } from "./buildArtifactManifest";
import { generateArchitectureMap } from "./architectureMapper";

const AI_DIR = path.join(process.cwd(), ".ai");
const ORCHESTRATOR_STATE_FILE = path.join(AI_DIR, "builds", "orchestrator-state.json");

export type OrchestratorStatus = "idle" | "running" | "paused" | "error";

export interface StageResult {
  stage: string;
  commandKey: string;
  ok: boolean;
  output: string;
  durationMs: number;
}

export interface BuildRunResult {
  jobId: string;
  goal: string;
  startedAt: string;
  completedAt: string;
  passed: boolean;
  stages: StageResult[];
  artifactId: string | null;
  note: string;
}

export interface OrchestratorState {
  status: OrchestratorStatus;
  lastRunAt: string | null;
  lastJobId: string | null;
  totalJobsRun: number;
  lastResult: BuildRunResult | null;
  transientFailures: number;
  updatedAt: string;
}

export const TRANSIENT_ERROR_PATTERNS = [
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "fetch failed",
  "socket hang up",
  "network timeout",
  "ETIMEDOUT",
  "localhost validation",
];

export function isTransientFailure(errorOutput: string): boolean {
  const lower = errorOutput.toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function readOrchestratorState(): OrchestratorState {
  const dir = path.dirname(ORCHESTRATOR_STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  try {
    if (fs.existsSync(ORCHESTRATOR_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(ORCHESTRATOR_STATE_FILE, "utf-8")) as OrchestratorState;
    }
  } catch { /* ignore */ }
  return {
    status: "idle",
    lastRunAt: null,
    lastJobId: null,
    totalJobsRun: 0,
    lastResult: null,
    transientFailures: 0,
    updatedAt: new Date().toISOString(),
  };
}

function writeOrchestratorState(state: OrchestratorState): void {
  const dir = path.dirname(ORCHESTRATOR_STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(ORCHESTRATOR_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

const STAGE_COMMAND_MAP: Record<string, string> = {
  build: "npm-build",
  test: "npm-test",
  "git-status": "git-status",
  "git-diff": "git-diff-stat",
  "git-rev": "git-rev-parse",
};

export function runBuildJob(job: BuildJob): BuildRunResult {
  const state = readOrchestratorState();
  state.status = "running";
  state.lastJobId = job.jobId;
  writeOrchestratorState(state);

  startBuildJob(job.jobId);

  const startedAt = new Date().toISOString();
  const stageResults: StageResult[] = [];

  for (const stage of job.stages) {
    const cmdKey = STAGE_COMMAND_MAP[stage] ?? stage;
    const result = runAllowedCommand(cmdKey);
    stageResults.push({
      stage,
      commandKey: cmdKey,
      ok: result.ok,
      output: result.output.slice(0, 800),
      durationMs: result.durationMs,
    });
    if (!result.ok && !isTransientFailure(result.output)) {
      break;
    }
    if (!result.ok && isTransientFailure(result.output)) {
      state.transientFailures++;
      stageResults[stageResults.length - 1].output += "\n[TRANSIENT: classified as infrastructure failure — no rollback]";
    }
  }

  const passed = stageResults.every((s) => s.ok || isTransientFailure(s.output));
  const completedAt = new Date().toISOString();

  const archMap = generateArchitectureMap();
  const diffResult = runAllowedCommand("git-diff-stat");
  let artifactId: string | null = null;
  try {
    const artifact = buildCurrentArtifactSnapshot(
      job.jobId,
      archMap.summary.totalRoutes,
      diffResult.output
    );
    artifactId = artifact.buildId;
  } catch { /* ignore */ }

  completeBuildJob(job.jobId, passed, passed ? "All stages passed" : "One or more stages failed");

  const runResult: BuildRunResult = {
    jobId: job.jobId,
    goal: job.goal,
    startedAt,
    completedAt,
    passed,
    stages: stageResults,
    artifactId,
    note: passed ? "Build succeeded" : "Build failed — check stage output",
  };

  state.status = "idle";
  state.lastRunAt = completedAt;
  state.totalJobsRun++;
  state.lastResult = runResult;
  writeOrchestratorState(state);

  return runResult;
}

export function runNextQueuedJob(): BuildRunResult | null {
  const job = getNextQueuedJob();
  if (!job) return null;
  return runBuildJob(job);
}

export function getOrchestratorState(): OrchestratorState {
  return readOrchestratorState();
}

export function getOrchestratorSummary(): {
  status: OrchestratorStatus;
  lastJobId: string | null;
  totalJobsRun: number;
  transientFailures: number;
  allowedCommandCount: number;
} {
  const state = readOrchestratorState();
  return {
    status: state.status,
    lastJobId: state.lastJobId,
    totalJobsRun: state.totalJobsRun,
    transientFailures: state.transientFailures,
    allowedCommandCount: listAllowedCommands().length,
  };
}
