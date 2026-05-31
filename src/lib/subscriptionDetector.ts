export function detectRecurring(transactions: Array<Record<string, unknown>>) {
  return transactions
    .filter((tx) =>
      String(tx.category || "").toLowerCase().includes("subscription") ||
      String(tx.merchant || "").match(/netflix|spotify|adobe|apple|google/i)
    )
    .map((tx) => ({
      merchant: tx.merchant,
      amount: Math.abs(Number(tx.amount)),
      cadence: "monthly",
      confidence: 0.86,
      risk: Math.abs(Number(tx.amount)) > 50 ? "high" : "medium",
    }));
}
