export function ingestTransactions(rows: Array<Record<string, unknown>>) {
  return rows.map((row, index) => ({
    id: row.id || `ingested-${index + 1}`,
    merchant: row.merchant || row.description || "Unknown merchant",
    amount: Number(row.amount || row.debit || row.credit || 0),
    category: row.category || "Uncategorised",
    date: row.date || new Date().toISOString(),
    recurring: Boolean(row.recurring),
  }));
}
