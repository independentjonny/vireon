import { AGENT_CONTRACTS, createMessage, type AgentRole, type AgentMessage } from "./coordinationContracts";
import { supervisorOrchestrator, type RepairLoopResult, type ClassifiedFailure } from "./supervisorOrchestrator";

export type SupervisorState = {
  phase: string;
  activeAgents: AgentRole[];
  pendingMessages: AgentMessage[];
  completedGoals: string[];
  healthStatus: Record<AgentRole, "nominal" | "degraded" | "offline">;
  autonomyLevel: number;
  lastCheckAt: string;
};

function initHealthStatus(): Record<AgentRole, "nominal" | "degraded" | "offline"> {
  return Object.keys(AGENT_CONTRACTS).reduce((acc, role) => {
    acc[role as AgentRole] = "nominal";
    return acc;
  }, {} as Record<AgentRole, "nominal" | "degraded" | "offline">);
}

export function getSupervisorState(): SupervisorState {
  return {
    phase: "Autonomous Finance OS — Phase 3",
    activeAgents: Object.keys(AGENT_CONTRACTS) as AgentRole[],
    pendingMessages: [],
    completedGoals: [
      "JSX-aware UI runtime",
      "Specialist agent layer v2",
      "Health scoring system",
      "Subscription detection engine",
      "Vector memory scaffold",
      "Cloud deployment readiness",
    ],
    healthStatus: initHealthStatus(),
    autonomyLevel: 9,
    lastCheckAt: new Date().toISOString(),
  };
}

export async function supervisorRun(goal: string): Promise<{
  ok: boolean;
  goal: string;
  directives: AgentMessage[];
  state: SupervisorState;
}> {
  const state = getSupervisorState();

  const directives: AgentMessage[] = [
    createMessage("supervisor", "roadmap-planner", "directive", { goal, action: "plan" }, "high"),
    createMessage("supervisor", "architecture-council", "directive", { goal, action: "review" }, "high"),
    createMessage("supervisor", "qa-orchestrator", "directive", { goal, action: "validate" }, "medium"),
    createMessage("supervisor", "deployment-governor", "directive", { goal, action: "gate" }, "medium"),
    createMessage("supervisor", "financial-intelligence", "directive", { goal, action: "analyse" }, "medium"),
  ];

  return { ok: true, goal, directives, state };
}

export function supervisorHandleFailure(
  errorOutput: string,
  opts: { stackFile?: string; failingPhase?: string; command?: string; attempt?: number } = {}
): RepairLoopResult {
  return supervisorOrchestrator.runRepairLoop(errorOutput, opts);
}

export type { RepairLoopResult, ClassifiedFailure };
