import type { DailyReviewFinding, DailyReviewHistoryRecord } from "./aiCfoDailyReview";

export type ReviewDirection = "improved" | "stable" | "mixed" | "deteriorated" | "partial";

export type SystemHealthSummary = {
  label: "Healthy" | "Needs review";
  confidenceScore: number;
  emphasise: boolean;
  reasons: string[];
};

function priorityWeight(label: string): number {
  if (label === "Critical") return 4;
  if (label === "High") return 3;
  if (label === "Medium") return 2;
  return 1;
}

function typeWeight(finding: DailyReviewFinding): number {
  if (finding.type === "deadline") return 5;
  if (finding.type === "risk" || finding.type === "negative-change" || finding.type === "professional-review") return 4;
  if (finding.type === "opportunity") return 3;
  if (finding.type === "missing-data" || finding.type === "stale-data") return 2;
  return 1;
}

function confidenceWeight(label: string): number {
  if (label === "High") return 3;
  if (label === "Medium") return 2;
  return 1;
}

function actionabilityWeight(finding: DailyReviewFinding): number {
  return finding.actionHref && finding.actionLabel ? 2 : 0;
}

export function scoreFindingForBriefing(finding: DailyReviewFinding): number {
  const urgency = finding.deadline ? 3 : 0;
  const impact = Math.min(Math.abs(finding.absoluteChange) / 1000, 25);
  return priorityWeight(finding.priority) * 100 + typeWeight(finding) * 30 + urgency * 20 + actionabilityWeight(finding) * 10 + confidenceWeight(finding.confidence) * 5 + impact;
}

export function selectFeaturedFinding(findings: DailyReviewFinding[]): DailyReviewFinding | null {
  const actionable = findings.filter((finding) => finding.type !== "positive-change" && finding.type !== "goal-improvement");
  const pool = actionable.length > 0 ? actionable : findings;
  return [...pool].sort((a, b) => scoreFindingForBriefing(b) - scoreFindingForBriefing(a) || a.title.localeCompare(b.title))[0] ?? null;
}

export function selectPriorityActions(findings: DailyReviewFinding[], limit = 3): DailyReviewFinding[] {
  return [...findings]
    .filter((finding) => finding.type !== "positive-change" && finding.type !== "goal-improvement")
    .sort((a, b) => scoreFindingForBriefing(b) - scoreFindingForBriefing(a) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function selectFinancialWins(findings: DailyReviewFinding[], limit = 3): DailyReviewFinding[] {
  return findings.filter((finding) => finding.type === "positive-change" || finding.type === "goal-improvement").slice(0, limit);
}

export function getReviewDirection(record: DailyReviewHistoryRecord): ReviewDirection {
  const { review } = record;
  if (review.failures.length > 0 || review.status === "Failed Safely") return "partial";
  if (review.findings.length === 0) return "stable";

  const negative = review.findings.filter((finding) => ["negative-change", "risk", "deadline", "missing-data", "stale-data", "professional-review", "goal-slippage"].includes(finding.type)).length;
  const positive = review.findings.filter((finding) => finding.type === "positive-change" || finding.type === "goal-improvement").length;
  if (positive > 0 && negative === 0) return "improved";
  if (negative > 0 && positive === 0) return "deteriorated";
  return "mixed";
}

export function buildBriefingHeadline(record: DailyReviewHistoryRecord): string {
  const direction = getReviewDirection(record);
  const count = record.review.findings.length;
  if (direction === "partial") return "Review partially complete.";
  if (direction === "stable") return "Your financial position is stable.";
  if (direction === "improved") return `Your position improved with ${count} material update${count === 1 ? "" : "s"}.`;
  if (direction === "deteriorated") return `${count} item${count === 1 ? "" : "s"} need attention.`;
  return `Your position improved, but ${Math.max(1, selectPriorityActions(record.review.findings).length)} item${selectPriorityActions(record.review.findings).length === 1 ? "" : "s"} need attention.`;
}

export function buildExecutiveSummary(record: DailyReviewHistoryRecord): string {
  const featured = selectFeaturedFinding(record.review.findings);
  if (record.review.failures.length > 0) {
    return "Some areas could not be checked. Available findings are shown with reduced confidence.";
  }
  if (!featured) {
    return "No material changes need attention since the previous review.";
  }
  return `${record.review.overallSummary.split(".")[0]}. Most important: ${featured.title}.`;
}

export function buildSystemHealthSummary(record: DailyReviewHistoryRecord): SystemHealthSummary {
  const lowConfidence = record.review.findings.filter((finding) => finding.confidence === "Low").length;
  const professionalReview = record.review.findings.filter((finding) => finding.professionalReviewRequired).length;
  const staleRules = record.review.findings.filter((finding) => finding.type === "stale-data" || finding.category === "rule-freshness").length;
  const confidenceScore = Math.max(0, Math.min(100, record.currentSnapshot.knowledgeHealthScore - lowConfidence * 8 - record.review.failures.length * 15));
  const reasons = [
    ...record.review.failures.map((failure) => `${failure.engine} unavailable`),
    ...(staleRules > 0 ? ["Material rule freshness needs review"] : []),
    ...(lowConfidence > 0 ? [`${lowConfidence} low-confidence input${lowConfidence === 1 ? "" : "s"}`] : []),
    ...(professionalReview > 0 ? [`${professionalReview} professional-review item${professionalReview === 1 ? "" : "s"}`] : []),
  ];
  return {
    label: reasons.length > 0 || confidenceScore < 85 ? "Needs review" : "Healthy",
    confidenceScore,
    emphasise: reasons.length > 0 || confidenceScore < 85,
    reasons,
  };
}
