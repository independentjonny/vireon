export type Transaction = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  recurring?: boolean;
  tags?: string[];
};

export type TransactionCategory =
  | "Income"
  | "Groceries"
  | "Subscription"
  | "Dining"
  | "Transport"
  | "Utilities"
  | "Health"
  | "Entertainment"
  | "Shopping"
  | "Savings"
  | "Investment";

export function getTransactions(): Transaction[] {
  return [
    { id: "tx-1", merchant: "Salary", category: "Income", amount: 6420, date: "Today", tags: ["employment"] },
    { id: "tx-2", merchant: "Woolworths", category: "Groceries", amount: -182, date: "Today", tags: ["essentials"] },
    { id: "tx-3", merchant: "Netflix", category: "Subscription", amount: -23.99, date: "Yesterday", recurring: true, tags: ["entertainment"] },
    { id: "tx-4", merchant: "Spotify", category: "Subscription", amount: -14.99, date: "Yesterday", recurring: true, tags: ["entertainment"] },
    { id: "tx-5", merchant: "Shell", category: "Transport", amount: -85, date: "2 days ago", tags: ["fuel"] },
    { id: "tx-6", merchant: "JB Hi-Fi", category: "Shopping", amount: -249, date: "3 days ago", tags: ["electronics"] },
    { id: "tx-7", merchant: "Medibank", category: "Health", amount: -165, date: "4 days ago", recurring: true, tags: ["insurance"] },
    { id: "tx-8", merchant: "Offset transfer", category: "Savings", amount: -1500, date: "5 days ago", tags: ["mortgage", "savings"] },
  ];
}

export function summariseTransactions() {
  const transactions = getTransactions();
  const income = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const spend = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    income,
    spend,
    net: income - spend,
    transactionCount: transactions.length,
  };
}

export function getTransactionsByCategory(): Record<string, Transaction[]> {
  const transactions = getTransactions();
  return transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    if (!acc[tx.category]) acc[tx.category] = [];
    acc[tx.category].push(tx);
    return acc;
  }, {});
}

export function getSpendingBreakdown(): Array<{ category: string; total: number; count: number; pct: number }> {
  const byCategory = getTransactionsByCategory();
  const allSpend = getTransactions()
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return Object.entries(byCategory)
    .filter(([, txs]) => txs.some(t => t.amount < 0))
    .map(([category, txs]) => {
      const total = txs.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return {
        category,
        total,
        count: txs.filter(t => t.amount < 0).length,
        pct: allSpend > 0 ? Math.round((total / allSpend) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}
