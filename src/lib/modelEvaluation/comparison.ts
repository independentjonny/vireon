import type { EvaluationRun } from "./types.ts";

export function compareEvaluationRuns(a: EvaluationRun, b: EvaluationRun) {
  const sameFixtureVersions = a.fixtureVersion === b.fixtureVersion;
  const sampleSize = Math.min(a.fixtureCount, b.fixtureCount);
  return {
    comparisonId: `compare-${a.runId}-${b.runId}`,
    runA: a.runId,
    runB: b.runId,
    sameFixtureVersions,
    sampleSize,
    preliminary: sampleSize < 30,
    overallDelta: Number((b.scoreSummary.overall - a.scoreSummary.overall).toFixed(4)),
    safetyDelta: Number((b.scoreSummary.safety - a.scoreSummary.safety).toFixed(4)),
    evidenceGroundingDelta: Number((b.scoreSummary.evidenceGrounding - a.scoreSummary.evidenceGrounding).toFixed(4)),
    policyComplianceDelta: Number((b.scoreSummary.policyCompliance - a.scoreSummary.policyCompliance).toFixed(4)),
    costDelta: Number((b.totalCost - a.totalCost).toFixed(4)),
    latencyDelta: Number((b.averageLatency - a.averageLatency).toFixed(4)),
    hardFailureDelta: b.scoreSummary.hardFailureCount - a.scoreSummary.hardFailureCount,
    sampleLabel: sampleSize < 30 ? "preliminary" : "comparable",
    note: sampleSize < 30 ? "Preliminary comparison: sample size is below statistical confidence threshold." : "Comparable fixture set.",
  };
}
