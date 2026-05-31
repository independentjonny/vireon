export type CopilotContext = {
  netWorth: string;
  cashFlow: string;
  savingsRate: string;
  runway: string;
  healthScore: number;
  topInsight: string;
};

export function getCopilotContext(): CopilotContext {
  return {
    netWorth: "$1.84M",
    cashFlow: "+$6,420/month",
    savingsRate: "31%",
    runway: "8.4 months",
    healthScore: 93,
    topInsight: "Offset mortgage by $800/month to save $2,400/year in interest.",
  };
}

export function askCopilot(prompt: string) {
  const context = getCopilotContext();
  const lc = prompt.toLowerCase();

  let answer = "Liberva Copilot can analyse your transactions, subscriptions, cash flow, financial health, and mortgage strategy.";

  if (lc.includes("afford") || lc.includes("ppor") || lc.includes("property")) {
    answer = `Based on your net worth of ${context.netWorth} and ${context.runway} runway, you have the capacity for increased property exposure — but Liberva recommends maintaining your current offset strategy first to reduce interest costs.`;
  } else if (lc.includes("savings") || lc.includes("save")) {
    answer = `Your current savings rate is ${context.savingsRate}, which is above your target. Redirecting $800/month to your offset account would save ~$2,400/year in mortgage interest.`;
  } else if (lc.includes("subscription") || lc.includes("subscription spend")) {
    answer = `Liberva detected $38.98/month in potentially optimisable subscriptions. Two entertainment subscriptions overlap. Cancelling one would save $14-24/month.`;
  } else if (lc.includes("health") || lc.includes("score")) {
    answer = `Your financial health score is ${context.healthScore}/100. Key drivers: strong liquidity (92), healthy debt coverage (88), excellent savings habit (95). Diversification (74) is the area to improve.`;
  }

  return {
    ok: true,
    prompt,
    answer,
    context,
    nextActions: [
      "Connect real database",
      "Enable Supabase auth",
      "Add real transaction import",
      "Enable vector memory",
    ],
  };
}

export function getCopilotPromptSuggestions(): string[] {
  return [
    "Can I comfortably afford a larger PPOR?",
    "What's my optimal savings rate this quarter?",
    "Analyse my subscription spend vs market average.",
    "How much interest am I paying on my mortgage?",
    "What's my biggest financial risk right now?",
    "Should I increase my equity allocation?",
  ];
}
