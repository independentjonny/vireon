export type RoadmapItem = {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  category: "infrastructure" | "finance" | "ui" | "security" | "data";
  dependencies: string[];
};

export type Roadmap = {
  generatedAt: string;
  phase: string;
  items: RoadmapItem[];
};

export function generateRoadmap(): Roadmap {
  return {
    generatedAt: new Date().toISOString(),
    phase: "Autonomous Finance OS — Phase 3",
    items: [
      {
        id: "real-db-connection",
        priority: "critical",
        title: "Connect real database",
        description: "Replace mock data with Supabase or Postgres via Prisma. Schema already scaffolded.",
        effort: "medium",
        category: "data",
        dependencies: [],
      },
      {
        id: "auth-integration",
        priority: "critical",
        title: "Enable authentication",
        description: "Wire NextAuth or Supabase Auth. Protect all API routes with session middleware.",
        effort: "medium",
        category: "security",
        dependencies: ["real-db-connection"],
      },
      {
        id: "transaction-import",
        priority: "high",
        title: "Real transaction import",
        description: "Build CSV/bank-feed import pipeline. Parse, categorise, and persist transactions.",
        effort: "large",
        category: "finance",
        dependencies: ["real-db-connection"],
      },
      {
        id: "vector-memory",
        priority: "high",
        title: "Enable vector memory",
        description: "Embed transactions and insights into pgvector for semantic copilot queries.",
        effort: "large",
        category: "infrastructure",
        dependencies: ["real-db-connection"],
      },
      {
        id: "subscription-alerts",
        priority: "medium",
        title: "Subscription alert engine",
        description: "Detect price increases, duplicates, and unused subscriptions. Send alerts.",
        effort: "small",
        category: "finance",
        dependencies: ["transaction-import"],
      },
      {
        id: "forecast-ml",
        priority: "medium",
        title: "ML-based cash flow forecast",
        description: "Replace static forecast with rolling-window regression on real transaction history.",
        effort: "large",
        category: "finance",
        dependencies: ["transaction-import"],
      },
      {
        id: "copilot-llm",
        priority: "medium",
        title: "LLM copilot integration",
        description: "Connect copilot to Claude API with finance context and transaction history.",
        effort: "medium",
        category: "ui",
        dependencies: ["auth-integration", "vector-memory"],
      },
      {
        id: "mobile-app",
        priority: "low",
        title: "React Native mobile app",
        description: "Port core dashboard to React Native using existing API layer.",
        effort: "large",
        category: "ui",
        dependencies: ["auth-integration"],
      },
    ],
  };
}

export function getTopPriorities(limit = 3): RoadmapItem[] {
  const roadmap = generateRoadmap();
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return roadmap.items
    .sort((a, b) => order[a.priority] - order[b.priority])
    .slice(0, limit);
}
