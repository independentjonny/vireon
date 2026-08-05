import { runtimeMemory } from "./memoryEngine";
import { selfRepairPlan } from "./selfRepairEngine";
import { deploymentReadiness } from "./deploymentAgent";
import { executiveBriefing } from "./executiveEngine";
import { computeActivationStatus } from "./activationStatus";
import * as fs from "fs";
import * as path from "path";

function getDaemonRunId(): string | null {
  try {
    const statePath = path.join(process.cwd(), ".ai", "daemon-state.json");
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
      return state?.activeRun?.runId ?? null;
    }
  } catch {
    // daemon state not available
  }
  return null;
}

export function productionStatus() {
  const runId = getDaemonRunId();
  return {
    ok: true,
    system: "Vireon",
    phase: "Production Autonomous Engineer",
    runId,
    memory: runtimeMemory(),
    repair: selfRepairPlan(),
    deployment: deploymentReadiness(),
    executiveBriefing: executiveBriefing(),
    activationStatus: computeActivationStatus(runId ?? undefined),
    generatedAt: new Date().toISOString(),
  };
}
