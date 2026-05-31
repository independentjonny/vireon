export type ForecastScenario = "base" | "optimistic" | "conservative";

export function cashflowForecast(scenario: ForecastScenario = "base") {
  const multipliers: Record<ForecastScenario, number> = {
    base: 1,
    optimistic: 1.15,
    conservative: 0.85,
  };
  const m = multipliers[scenario];

  return {
    scenario,
    next30Days: Math.round(6420 * m),
    next90Days: Math.round(19260 * m),
    next12Months: Math.round(77040 * m),
    runwayMonths: Math.round(8.4 * m * 10) / 10,
    confidence: scenario === "base" ? 0.91 : scenario === "optimistic" ? 0.72 : 0.88,
    assumptions: [
      "Salary income stable",
      "No major one-off expenses",
      "Subscription spend unchanged",
      scenario === "optimistic" ? "Side income +15%" : scenario === "conservative" ? "Unexpected costs -15%" : "Steady state",
    ],
  };
}

export function getRecommendations(): Array<{ id: string; title: string; action: string; impact: string; priority: "high" | "medium" | "low" }> {
  return [
    {
      id: "rec-001",
      title: "Increase offset contribution",
      action: "Redirect $800/month from discretionary spend to mortgage offset account.",
      impact: "$2,400/year interest saving",
      priority: "high",
    },
    {
      id: "rec-002",
      title: "Cancel duplicate streaming",
      action: "You have Netflix and another entertainment subscription with overlapping content.",
      impact: "$14-24/month saving",
      priority: "medium",
    },
    {
      id: "rec-003",
      title: "Review health insurance tier",
      action: "Current Medibank plan may include unused extras. Downgrade could save $40/month.",
      impact: "$480/year saving",
      priority: "medium",
    },
    {
      id: "rec-004",
      title: "Equity allocation increase",
      action: "Consider reallocating 5% of property equity into diversified equities index.",
      impact: "Diversification score +8 pts",
      priority: "low",
    },
  ];
}
