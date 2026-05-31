import { getOrchestratorState } from "@/lib/buildOrchestrator";
import { listBuildJobs } from "@/lib/buildQueue";
import { getGitState, getRuntimeStatus } from "@/lib/runtimeControl";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

export interface HealthContractCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface HealthContract {
  generatedAt: string;
  overallHealth: "healthy" | "degraded" | "critical";
  checks: HealthContractCheck[];
  summary: string;
}

export async function GET() {
  const checks: HealthContractCheck[] = [];

  const orchestratorState = getOrchestratorState();
  checks.push({
    name: "Orchestrator Server",
    status: orchestratorState.status !== "error" ? "pass" : "fail",
    detail: `Orchestrator status: ${orchestratorState.status}. Total jobs run: ${orchestratorState.totalJobsRun}.`,
  });

  const nextAppHealthy = fs.existsSync(path.join(process.cwd(), ".next"));
  checks.push({
    name: "Next.js App",
    status: nextAppHealthy ? "pass" : "warn",
    detail: nextAppHealthy ? ".next build directory present" : ".next not found — run npm run build",
  });

  const screenshotExists = fs.existsSync(path.join(process.cwd(), ".ai", "browser-check.png"));
  checks.push({
    name: "Browser Validation",
    status: screenshotExists ? "pass" : "warn",
    detail: screenshotExists ? "browser-check.png present" : "No browser validation screenshot — run browser check",
  });

  const claudeReportExists = fs.existsSync(path.join(process.cwd(), ".ai", "claude-report.json"));
  checks.push({
    name: "Claude Availability",
    status: claudeReportExists ? "pass" : "warn",
    detail: claudeReportExists ? "claude-report.json present — Claude agent active" : "No claude-report.json — agent may not have run",
  });

  const buildQueue = listBuildJobs();
  const runningJobs = buildQueue.jobs.filter((j) => j.status === "running").length;
  const queuedJobs = buildQueue.jobs.filter((j) => j.status === "queued").length;
  checks.push({
    name: "Build Queue",
    status: runningJobs > 3 ? "warn" : "pass",
    detail: `${queuedJobs} queued · ${runningJobs} running · ${buildQueue.jobs.filter((j) => j.status === "succeeded").length} succeeded`,
  });

  const gitState = getGitState();
  checks.push({
    name: "Git State",
    status: gitState.branch ? "pass" : "warn",
    detail: gitState.branch ? `Branch: ${gitState.branch} · Commit: ${(gitState.lastCommit?.hash ?? "").slice(0, 10)}` : "Git state unavailable",
  });

  const runtimeStatus = getRuntimeStatus();
  checks.push({
    name: "Runtime Status",
    status: runtimeStatus.daemon?.active ? "pass" : "warn",
    detail: `Daemon: ${runtimeStatus.daemon?.active ? "active" : "inactive"} · Run: ${runtimeStatus.daemon?.runId ?? "none"}`,
  });

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const overallHealth: HealthContract["overallHealth"] =
    failCount > 0 ? "critical" : warnCount > 2 ? "degraded" : "healthy";

  const contract: HealthContract = {
    generatedAt: new Date().toISOString(),
    overallHealth,
    checks,
    summary: `${overallHealth.toUpperCase()} — ${checks.filter((c) => c.status === "pass").length}/${checks.length} checks passing`,
  };

  return Response.json({ ok: true, contract });
}
