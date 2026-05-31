export type AgentRole =
  | "supervisor"
  | "architecture-council"
  | "deployment-governor"
  | "repair-governor"
  | "financial-intelligence"
  | "roadmap-planner"
  | "qa-orchestrator"
  | "ui-agent"
  | "backend-agent"
  | "database-agent";

export type AgentMessage = {
  id: string;
  from: AgentRole;
  to: AgentRole | "broadcast";
  type: "directive" | "report" | "query" | "escalation" | "ack";
  payload: Record<string, unknown>;
  priority: "critical" | "high" | "medium" | "low";
  timestamp: string;
};

export type AgentContract = {
  role: AgentRole;
  responsibilities: string[];
  canDirectly: AgentRole[];
  reportsTo: AgentRole;
  escalatesTo: AgentRole;
  maxAutonomyLevel: number;
};

export const AGENT_CONTRACTS: Record<AgentRole, AgentContract> = {
  supervisor: {
    role: "supervisor",
    responsibilities: [
      "Coordinate all agents toward platform goals",
      "Arbitrate conflicts between agent directives",
      "Approve high-risk mutations",
      "Maintain global agent health",
    ],
    canDirectly: ["architecture-council", "deployment-governor", "repair-governor", "roadmap-planner", "qa-orchestrator"],
    reportsTo: "supervisor",
    escalatesTo: "supervisor",
    maxAutonomyLevel: 10,
  },
  "architecture-council": {
    role: "architecture-council",
    responsibilities: [
      "Review and approve architectural changes",
      "Enforce design principles and patterns",
      "Validate inter-service contracts",
    ],
    canDirectly: ["backend-agent", "database-agent", "ui-agent"],
    reportsTo: "supervisor",
    escalatesTo: "supervisor",
    maxAutonomyLevel: 7,
  },
  "deployment-governor": {
    role: "deployment-governor",
    responsibilities: [
      "Gate all deployment actions",
      "Run pre-deploy smoke tests",
      "Manage rollback strategy",
      "Validate environment readiness",
    ],
    canDirectly: [],
    reportsTo: "supervisor",
    escalatesTo: "supervisor",
    maxAutonomyLevel: 6,
  },
  "repair-governor": {
    role: "repair-governor",
    responsibilities: [
      "Detect and classify errors",
      "Dispatch repair agents",
      "Track repair outcomes",
    ],
    canDirectly: ["backend-agent", "ui-agent"],
    reportsTo: "supervisor",
    escalatesTo: "supervisor",
    maxAutonomyLevel: 8,
  },
  "financial-intelligence": {
    role: "financial-intelligence",
    responsibilities: [
      "Analyse transactions and subscriptions",
      "Generate insights and forecasts",
      "Score financial health",
      "Detect anomalies",
    ],
    canDirectly: [],
    reportsTo: "supervisor",
    escalatesTo: "supervisor",
    maxAutonomyLevel: 5,
  },
  "roadmap-planner": {
    role: "roadmap-planner",
    responsibilities: [
      "Convert roadmap items to executable tasks",
      "Maintain dependency graph",
      "Manage sprint queue",
      "Assign tasks to agents",
    ],
    canDirectly: ["backend-agent", "ui-agent", "database-agent"],
    reportsTo: "supervisor",
    escalatesTo: "supervisor",
    maxAutonomyLevel: 6,
  },
  "qa-orchestrator": {
    role: "qa-orchestrator",
    responsibilities: [
      "Run build and type checks",
      "Execute browser validation",
      "Validate API contracts",
      "Report quality gates",
    ],
    canDirectly: [],
    reportsTo: "supervisor",
    escalatesTo: "supervisor",
    maxAutonomyLevel: 5,
  },
  "ui-agent": {
    role: "ui-agent",
    responsibilities: ["Render UI components", "Validate semantic DOM", "Fix UI regressions"],
    canDirectly: [],
    reportsTo: "architecture-council",
    escalatesTo: "repair-governor",
    maxAutonomyLevel: 4,
  },
  "backend-agent": {
    role: "backend-agent",
    responsibilities: ["Build API routes", "Wire service layer", "Validate data contracts"],
    canDirectly: [],
    reportsTo: "architecture-council",
    escalatesTo: "repair-governor",
    maxAutonomyLevel: 4,
  },
  "database-agent": {
    role: "database-agent",
    responsibilities: ["Manage schema migrations", "Seed data", "Validate queries"],
    canDirectly: [],
    reportsTo: "architecture-council",
    escalatesTo: "repair-governor",
    maxAutonomyLevel: 4,
  },
};

export function createMessage(
  from: AgentRole,
  to: AgentRole | "broadcast",
  type: AgentMessage["type"],
  payload: Record<string, unknown>,
  priority: AgentMessage["priority"] = "medium"
): AgentMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from,
    to,
    type,
    payload,
    priority,
    timestamp: new Date().toISOString(),
  };
}
