export async function financeAgent(task: string) {
  return {
    agent: "finance-agent",
    status: "complete",
    task,
    insights: [
      "Subscription optimisation opportunities detected",
      "Cash flow remains positive",
      "Savings trajectory remains healthy",
    ],
  };
}
