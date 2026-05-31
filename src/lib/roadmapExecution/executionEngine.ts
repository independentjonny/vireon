import { generateRoadmap, type RoadmapItem } from "@/lib/roadmapPlanner";
import { getSystemReadiness, type ReadinessState } from "@/lib/system/readiness";

export type ExecutionTask = {
  id: string;
  roadmapItemId: string;
  title: string;
  description: string;
  priority: RoadmapItem["priority"];
  status: "backlog" | "sprint" | "in_progress" | "blocked" | "done";
  effort: RoadmapItem["effort"];
  category: string;
  dependencyIds: string[];
  assignedAgent: string | null;
  sprintId: string | null;
  estimatedHours: number;
  createdAt: string;
};

export type SprintPlan = {
  sprintId: string;
  tasks: ExecutionTask[];
  totalEstimatedHours: number;
  startDate: string;
  endDate: string;
};

const EFFORT_HOURS: Record<RoadmapItem["effort"], number> = {
  small: 4,
  medium: 16,
  large: 40,
};

const AGENT_ASSIGNMENTS: Record<string, string> = {
  infrastructure: "backend-agent",
  security: "backend-agent",
  data: "database-agent",
  finance: "financial-intelligence",
  ui: "ui-agent",
};

// Maps roadmap item IDs to their corresponding readiness flag
const READINESS_MAP: Record<string, keyof ReadinessState> = {
  "real-db-connection": "database",
  "auth-integration": "auth",
  "vector-memory": "embeddings",
  "transaction-import": "transactions",
  "subscription-alerts": "subscriptions",
};

export function buildExecutionQueue(): ExecutionTask[] {
  const roadmap = generateRoadmap();
  const readiness = getSystemReadiness();

  // Pre-compute completed IDs so dependency checks account for live infrastructure
  const completedIds = new Set<string>(
    roadmap.items
      .filter((item) => {
        const key = READINESS_MAP[item.id];
        return key ? readiness[key] : false;
      })
      .map((item) => item.id)
  );

  return roadmap.items.map((item) => {
    const isComplete = completedIds.has(item.id);
    const blocked = !isComplete && item.dependencies.some((dep) => !completedIds.has(dep));
    const resolvedTitle =
      isComplete && item.id === "real-db-connection" ? "Database connected" :
      isComplete && item.id === "auth-integration" ? "Authentication configured" :
      item.title;
    const resolvedPriority: RoadmapItem["priority"] =
      isComplete && item.id === "real-db-connection" ? "low" :
      isComplete && item.id === "auth-integration" ? "low" :
      item.priority;
    return {
      id: `task-${item.id}`,
      roadmapItemId: item.id,
      title: resolvedTitle,
      description: item.description,
      priority: resolvedPriority,
      status: isComplete ? "done" : blocked ? "blocked" : item.priority === "critical" ? "sprint" : "backlog",
      effort: item.effort,
      category: item.category,
      dependencyIds: item.dependencies.map((d) => `task-${d}`),
      assignedAgent: AGENT_ASSIGNMENTS[item.category] ?? null,
      sprintId: isComplete ? null : item.priority === "critical" ? "sprint-1" : item.priority === "high" ? "sprint-2" : null,
      estimatedHours: EFFORT_HOURS[item.effort],
      createdAt: new Date().toISOString(),
    };
  });
}

export function buildSprintPlan(sprintId: string): SprintPlan {
  const tasks = buildExecutionQueue().filter((t) => t.sprintId === sprintId);
  const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  const now = new Date();
  const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return {
    sprintId,
    tasks,
    totalEstimatedHours: totalHours,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
  };
}

export function getExecutionSummary() {
  const queue = buildExecutionQueue();
  return {
    total: queue.length,
    byStatus: {
      backlog: queue.filter((t) => t.status === "backlog").length,
      sprint: queue.filter((t) => t.status === "sprint").length,
      in_progress: queue.filter((t) => t.status === "in_progress").length,
      blocked: queue.filter((t) => t.status === "blocked").length,
      done: queue.filter((t) => t.status === "done").length,
    },
    byPriority: {
      critical: queue.filter((t) => t.priority === "critical").length,
      high: queue.filter((t) => t.priority === "high").length,
      medium: queue.filter((t) => t.priority === "medium").length,
      low: queue.filter((t) => t.priority === "low").length,
    },
    estimatedTotalHours: queue.reduce((sum, t) => sum + t.estimatedHours, 0),
  };
}
