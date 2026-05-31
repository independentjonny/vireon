import { recallRelevantMemories } from "./memoryGraph";
import { subscriptionSummary } from "@/lib/subscriptionEngine";
import { summariseTransactions } from "@/lib/transactionEngine";

export type CopilotContext = {
  query: string;
  relevantMemories: Array<{ content: string; type: string; importance: number }>;
  financialSnapshot: {
    netCashFlow: number;
    subscriptionMonthly: number;
    subscriptionCount: number;
    savingsRate: number;
  };
  contextTokenEstimate: number;
  assembledAt: string;
};

export async function assembleCopilotContext(query: string): Promise<CopilotContext> {
  const [memories, subSummary, txSummary] = await Promise.all([
    recallRelevantMemories(query, 5),
    Promise.resolve(subscriptionSummary()),
    Promise.resolve(summariseTransactions()),
  ]);

  const contextTokenEstimate =
    memories.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0) + 200;

  return {
    query,
    relevantMemories: memories.map((m) => ({
      content: m.content,
      type: m.type,
      importance: m.importance,
    })),
    financialSnapshot: {
      netCashFlow: txSummary.net,
      subscriptionMonthly: subSummary.monthlySpend,
      subscriptionCount: subSummary.subscriptions.length,
      savingsRate: 0.31,
    },
    contextTokenEstimate,
    assembledAt: new Date().toISOString(),
  };
}
