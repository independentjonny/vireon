export type CadenceResult = {
  cadence: "weekly" | "fortnightly" | "monthly" | "quarterly" | "annual" | "irregular";
  averageDaysBetween: number;
  confidence: number;
  nextExpected: string | null;
};

export function detectCadence(amounts: number[], dates: string[]): CadenceResult {
  if (dates.length < 2) {
    return { cadence: "irregular", averageDaysBetween: 0, confidence: 0, nextExpected: null };
  }

  const sorted = dates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
  }

  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avg, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);

  const amountVariance = amounts.length > 1
    ? amounts.reduce((sum, a) => sum + Math.abs(a - amounts[0]), 0) / amounts.length
    : 0;

  let cadence: CadenceResult["cadence"] = "irregular";
  let confidence = 0;

  if (avg >= 6 && avg <= 8 && stdDev < 2) { cadence = "weekly"; confidence = 0.92; }
  else if (avg >= 12 && avg <= 16 && stdDev < 3) { cadence = "fortnightly"; confidence = 0.88; }
  else if (avg >= 25 && avg <= 35 && stdDev < 7) { cadence = "monthly"; confidence = 0.9; }
  else if (avg >= 85 && avg <= 97 && stdDev < 10) { cadence = "quarterly"; confidence = 0.85; }
  else if (avg >= 350 && avg <= 380 && stdDev < 20) { cadence = "annual"; confidence = 0.87; }

  if (amountVariance > amounts[0] * 0.1) {
    confidence *= 0.8;
  }

  const lastDate = sorted[sorted.length - 1];
  const nextExpected = cadence !== "irregular"
    ? new Date(lastDate.getTime() + avg * 24 * 60 * 60 * 1000).toISOString()
    : null;

  return {
    cadence,
    averageDaysBetween: Math.round(avg),
    confidence: Math.round(confidence * 100) / 100,
    nextExpected,
  };
}
