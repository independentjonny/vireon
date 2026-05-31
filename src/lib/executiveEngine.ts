import { detectAnomalies } from "./anomalyEngine";
import { cashflowForecast } from "./forecastEngine";
import { executiveAnalytics } from "./analyticsEngine";

export function executiveRecommendations() {
  return [
    {
      id: "reduce-recurring-costs",
      priority: "high",
      title: "Reduce recurring costs",
      action: "Review duplicate entertainment and software subscriptions.",
      estimatedImpact: "$138/month",
    },
    {
      id: "protect-liquidity",
      priority: "medium",
      title: "Protect liquidity",
      action: "Maintain emergency buffer before increasing property exposure.",
      estimatedImpact: "8.4 months runway preserved",
    },
    {
      id: "optimise-offset",
      priority: "medium",
      title: "Optimise mortgage offset",
      action: "Keep surplus cash aligned to offset strategy.",
      estimatedImpact: "Interest reduction opportunity",
    },
  ];
}

export function executiveBriefing() {
  return {
    ok: true,
    title: "Executive Financial Briefing",
    summary:
      "Liberva has analysed cash flow, subscriptions, health score, anomalies and forecast runway.",
    analytics: executiveAnalytics(),
    forecast: cashflowForecast(),
    anomalies: detectAnomalies(),
    recommendations: executiveRecommendations(),
    generatedAt: new Date().toISOString(),
  };
}
