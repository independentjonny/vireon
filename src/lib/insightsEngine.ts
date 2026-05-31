export type InsightCategory =
  | "subscription"
  | "cashflow"
  | "allocation"
  | "debt"
  | "savings"
  | "forecast"
  | "opportunity";

export type Insight = {
  id: string;
  title: string;
  body: string;
  severity: "low" | "medium" | "high";
  category: InsightCategory;
  estimatedImpact?: string;
  actionable: boolean;
};

export function generateInsights(): Insight[] {
  return [
    {
      id: "subscription-optimisation",
      title: "Subscription optimisation",
      body: "Liberva detected recurring cost optimisation opportunities across subscriptions. Two entertainment services overlap.",
      severity: "medium",
      category: "subscription",
      estimatedImpact: "$138/month saving potential",
      actionable: true,
    },
    {
      id: "cashflow-strength",
      title: "Cash flow strength",
      body: "Your cash flow remains stable with strong savings capacity. Net positive for 6 consecutive months.",
      severity: "low",
      category: "cashflow",
      actionable: false,
    },
    {
      id: "property-concentration",
      title: "Property concentration",
      body: "Your wealth profile is property-heavy (58%) relative to liquid assets. Consider rebalancing toward equities as markets stabilise.",
      severity: "medium",
      category: "allocation",
      estimatedImpact: "Diversification score +8 pts",
      actionable: true,
    },
    {
      id: "offset-opportunity",
      title: "Offset mortgage opportunity",
      body: "Current offset balance could be increased by $800/month. At current rate, saves $2,400/year in interest.",
      severity: "high",
      category: "opportunity",
      estimatedImpact: "$2,400/year interest reduction",
      actionable: true,
    },
    {
      id: "savings-habit",
      title: "Savings habit",
      body: "Your 31% savings rate is in the top 10% of Liberva users. Consistent monthly offset transfers detected.",
      severity: "low",
      category: "savings",
      actionable: false,
    },
    {
      id: "runway-healthy",
      title: "Emergency runway",
      body: "8.4 months of cash runway detected. Liberva recommends maintaining at least 6 months — you are above target.",
      severity: "low",
      category: "forecast",
      actionable: false,
    },
  ];
}

export function getInsightsByCategory(category: InsightCategory): Insight[] {
  return generateInsights().filter((i) => i.category === category);
}

export function getActionableInsights(): Insight[] {
  return generateInsights().filter((i) => i.actionable);
}

export function getHighPriorityInsights(): Insight[] {
  return generateInsights().filter((i) => i.severity === "high");
}
