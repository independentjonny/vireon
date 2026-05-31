export type SavingsRecommendation = {
  merchant: string;
  currentMonthlyCost: number;
  recommendationType: "cancel" | "downgrade" | "bundle" | "negotiate" | "review";
  potentialSaving: number;
  reasoning: string;
  confidence: number;
  priority: "high" | "medium" | "low";
};

export type SavingsReport = {
  recommendations: SavingsRecommendation[];
  totalPotentialSaving: number;
  annualisedSaving: number;
  generatedAt: string;
};

const BENCHMARK_PRICES: Record<string, number> = {
  Netflix: 17,
  Spotify: 12,
  Apple: 15,
  Microsoft: 12,
  Amazon: 9,
  Adobe: 30,
  Google: 10,
};

export function generateSavingsRecommendations(
  subscriptions: Array<{ merchant: string; amount: number; lastUsed?: string; duplicateOf?: string }>
): SavingsReport {
  const recommendations: SavingsRecommendation[] = [];

  for (const sub of subscriptions) {
    const benchmark = BENCHMARK_PRICES[sub.merchant];

    if (sub.duplicateOf) {
      recommendations.push({
        merchant: sub.merchant,
        currentMonthlyCost: sub.amount,
        recommendationType: "cancel",
        potentialSaving: sub.amount,
        reasoning: `Duplicate subscription detected. You appear to have two active ${sub.merchant} subscriptions.`,
        confidence: 0.95,
        priority: "high",
      });
      continue;
    }

    if (benchmark && sub.amount > benchmark * 1.15) {
      recommendations.push({
        merchant: sub.merchant,
        currentMonthlyCost: sub.amount,
        recommendationType: "downgrade",
        potentialSaving: sub.amount - benchmark,
        reasoning: `You're paying $${sub.amount}/mo for ${sub.merchant} vs market rate of ~$${benchmark}/mo. Consider downgrading your plan.`,
        confidence: 0.78,
        priority: sub.amount - benchmark > 10 ? "high" : "medium",
      });
    }

    if (sub.lastUsed) {
      const daysSinceUse = Math.round(
        (Date.now() - new Date(sub.lastUsed).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceUse > 60) {
        recommendations.push({
          merchant: sub.merchant,
          currentMonthlyCost: sub.amount,
          recommendationType: "cancel",
          potentialSaving: sub.amount,
          reasoning: `${sub.merchant} has not been used in ${daysSinceUse} days. Consider cancelling.`,
          confidence: 0.85,
          priority: sub.amount > 20 ? "high" : "medium",
        });
      }
    }
  }

  recommendations.sort((a, b) => b.potentialSaving - a.potentialSaving);
  const totalPotentialSaving = recommendations.reduce((sum, r) => sum + r.potentialSaving, 0);

  return {
    recommendations,
    totalPotentialSaving,
    annualisedSaving: totalPotentialSaving * 12,
    generatedAt: new Date().toISOString(),
  };
}
