import type { NormalizedTransaction } from "./csvPipeline.ts";

function txSignature(tx: NormalizedTransaction): string {
  const dateStr = tx.date.slice(0, 10);
  const amountStr = tx.amount.toFixed(2);
  return `${dateStr}::${tx.merchantCanonical}::${amountStr}`;
}

export function detectDuplicates(transactions: NormalizedTransaction[]): NormalizedTransaction[] {
  const seen = new Map<string, string>();
  const result: NormalizedTransaction[] = [];

  for (const tx of transactions) {
    const sig = txSignature(tx);
    if (seen.has(sig)) {
      result.push({ ...tx, duplicate: true });
    } else {
      seen.set(sig, tx.id);
      result.push(tx);
    }
  }

  return result;
}
