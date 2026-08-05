import type { NormalizedTransaction } from "./csvPipeline.ts";

export type IngestionHealthReport = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  issues: string[];
  recommendations: string[];
};

export function scoreIngestionHealth(transactions: NormalizedTransaction[], errors: string[]): number {
  if (transactions.length === 0) return 0;

  let score = 100;

  const errorRate = errors.length / Math.max(transactions.length, 1);
  score -= Math.min(errorRate * 50, 30);

  const duplicateRate = transactions.filter((t) => t.duplicate).length / transactions.length;
  score -= Math.min(duplicateRate * 40, 20);

  const lowConfidence = transactions.filter((t) => t.confidence < 0.5).length;
  const lowConfidenceRate = lowConfidence / transactions.length;
  score -= Math.min(lowConfidenceRate * 20, 15);

  const uncategorised = transactions.filter((t) => t.category === "Uncategorised").length;
  const uncategorisedRate = uncategorised / transactions.length;
  score -= Math.min(uncategorisedRate * 15, 10);

  const missingDates = transactions.filter((t) => !t.date).length;
  score -= missingDates * 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getIngestionHealthReport(
  transactions: NormalizedTransaction[],
  errors: string[]
): IngestionHealthReport {
  const score = scoreIngestionHealth(transactions, errors);
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (errors.length > 0) {
    issues.push(`${errors.length} parse errors during ingestion`);
    recommendations.push("Validate CSV headers match expected format: date, description, amount");
  }

  const duplicates = transactions.filter((t) => t.duplicate).length;
  if (duplicates > 0) {
    issues.push(`${duplicates} duplicate transactions detected`);
    recommendations.push("Check if the same file was uploaded multiple times or date ranges overlap");
  }

  const uncategorised = transactions.filter((t) => t.category === "Uncategorised").length;
  if (uncategorised > 0) {
    issues.push(`${uncategorised} transactions could not be categorised`);
    recommendations.push("Add merchant aliases to improve auto-categorisation");
  }

  return { score, grade, issues, recommendations };
}
