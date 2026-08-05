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
    netWorth: "Not calculated yet",
    cashFlow: "Not calculated yet",
    savingsRate: "Not calculated yet",
    runway: "Not calculated yet",
    healthScore: 0,
    topInsight: "Add confirmed Financial Vault data to unlock a grounded top insight.",
  };
}

export function askCopilot(prompt: string) {
  const context = getCopilotContext();
  const lc = prompt.toLowerCase();

  let answer = "My AI CFO can analyse persisted transactions, subscriptions, cash flow, financial health, and mortgage strategy once the required Financial Vault data is confirmed.";

  if (lc.includes("afford") || lc.includes("ppor") || lc.includes("property")) {
    answer = "Property affordability needs confirmed income, spending, debt and housing assumptions. Open Housing Scenarios after the Vault is complete to view deterministic results.";
  } else if (lc.includes("savings") || lc.includes("save")) {
    answer = "Savings guidance needs confirmed income and recurring spending. Vireon will not invent a savings rate or offset recommendation without persisted facts.";
  } else if (lc.includes("subscription") || lc.includes("subscription spend")) {
    answer = "Subscription analysis uses persisted imported transactions and subscriptions. Import or confirm records to calculate specific savings opportunities.";
  } else if (lc.includes("health") || lc.includes("score")) {
    answer = "Financial health is calculated only after confirmed Vault records are available. Complete income, spending, cash and debt inputs to unlock the score.";
  }

  return {
    ok: true,
    prompt,
    answer,
    context,
    nextActions: [
      "Complete Financial Vault",
      "Import transactions",
      "Review subscriptions",
      "Open Daily Review",
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
