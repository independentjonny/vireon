export type PlannerOutput = {
  agent: string;
  status: string;
  goal: string;
  phases: PlannerPhase[];
  estimatedComplexity: "low" | "medium" | "high";
  warnings: string[];
};

export type PlannerPhase = {
  phase: number;
  name: string;
  files: string[];
  actions: string[];
};

export async function plannerAgent(goal: string): Promise<PlannerOutput> {
  const phases: PlannerPhase[] = [
    {
      phase: 1,
      name: "Architecture analysis",
      files: ["src/app/page.tsx", "src/lib/"],
      actions: ["Identify affected components", "Map file dependencies", "Assess risk surface"],
    },
    {
      phase: 2,
      name: "Patch generation",
      files: [],
      actions: ["Generate minimal safe patch", "Validate TypeScript types", "Check API contracts"],
    },
    {
      phase: 3,
      name: "Build validation",
      files: [],
      actions: ["Run npm run build", "Confirm 0 TypeScript errors", "Verify route table intact"],
    },
    {
      phase: 4,
      name: "Browser validation",
      files: [],
      actions: ["Check page loads", "Confirm no console errors", "Capture screenshot"],
    },
  ];

  const estimatedComplexity: "low" | "medium" | "high" =
    goal.length > 200 ? "high" : goal.length > 80 ? "medium" : "low";

  return {
    agent: "planner-agent",
    status: "complete",
    goal,
    phases,
    estimatedComplexity,
    warnings:
      estimatedComplexity === "high"
        ? ["High complexity goal — consider splitting into sub-tasks"]
        : [],
  };
}
