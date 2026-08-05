import type { NormalizedTransaction } from "./csvPipeline.ts";

const RECURRING_MERCHANTS = new Set([
  "Netflix", "Spotify", "Apple", "Google", "Microsoft", "Amazon",
  "Medibank", "Bupa", "AHM", "Disney+", "Stan", "Adobe",
]);

const CADENCE_PATTERNS: Array<{ name: string; days: number; tolerance: number }> = [
  { name: "monthly", days: 30, tolerance: 5 },
  { name: "fortnightly", days: 14, tolerance: 3 },
  { name: "weekly", days: 7, tolerance: 2 },
  { name: "quarterly", days: 91, tolerance: 10 },
  { name: "annual", days: 365, tolerance: 20 },
];

function detectCadence(dates: Date[]): string | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  for (const pattern of CADENCE_PATTERNS) {
    if (Math.abs(avgGap - pattern.days) <= pattern.tolerance) {
      return pattern.name;
    }
  }

  return null;
}

export function detectRecurring(transactions: NormalizedTransaction[]): NormalizedTransaction[] {
  const merchantGroups: Record<string, NormalizedTransaction[]> = {};

  for (const tx of transactions) {
    const key = tx.merchantCanonical;
    if (!merchantGroups[key]) merchantGroups[key] = [];
    merchantGroups[key].push(tx);
  }

  return transactions.map((tx) => {
    if (RECURRING_MERCHANTS.has(tx.merchantCanonical)) {
      return { ...tx, recurring: true, recurringCadence: "monthly" };
    }

    const group = merchantGroups[tx.merchantCanonical];
    if (group && group.length >= 2) {
      const dates = group.map((g) => new Date(g.date));
      const cadence = detectCadence(dates);
      if (cadence) {
        return { ...tx, recurring: true, recurringCadence: cadence };
      }
    }

    return tx;
  });
}
