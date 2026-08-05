import type { EvaluationBaseline, EvaluationRun, RegressionSummary } from "./types.ts";

function pct(previous: number, current: number) {
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export function compareAgainstBaseline(run: EvaluationRun, baseline: EvaluationBaseline | null): RegressionSummary {
  if (!baseline) {
    return {
      baselineId: null,
      previousScore: null,
      candidateScore: run.scoreSummary.overall,
      absoluteChange: null,
      percentageChange: null,
      hardFailureChange: null,
      costChange: null,
      latencyChange: null,
      calibrationChange: null,
      fixtureDifferences: [],
      status: "no-baseline",
    };
  }
  const absoluteChange = Number((run.scoreSummary.overall - baseline.scoreSummary.overall).toFixed(4));
  const hardFailureChange = run.scoreSummary.hardFailureCount - baseline.scoreSummary.hardFailureCount;
  const fixtureDifferences = run.results
    .filter((result) => baseline.resultHashes[result.fixtureId] && result.status !== "passed")
    .map((result) => `${result.fixtureId}: ${result.status}`);
  return {
    baselineId: baseline.baselineId,
    previousScore: baseline.scoreSummary.overall,
    candidateScore: run.scoreSummary.overall,
    absoluteChange,
    percentageChange: pct(baseline.scoreSummary.overall, run.scoreSummary.overall),
    hardFailureChange,
    costChange: Number((run.totalCost - baseline.scoreSummary.cost).toFixed(4)),
    latencyChange: Number((run.averageLatency - baseline.scoreSummary.latency).toFixed(4)),
    calibrationChange: Number((run.scoreSummary.confidenceCalibration - baseline.scoreSummary.confidenceCalibration).toFixed(4)),
    fixtureDifferences,
    status: absoluteChange < -0.03 || hardFailureChange > 0 ? "regression-detected" : "passed",
  };
}

export function detectInstability(runs: EvaluationRun[]) {
  const byFixture = new Map<string, { statuses: Set<string>; scores: number[] }>();
  for (const run of runs) {
    for (const result of run.results) {
      const key = result.fixtureId;
      const existing = byFixture.get(key) ?? { statuses: new Set<string>(), scores: [] };
      existing.statuses.add(result.status);
      existing.scores.push(result.overallScore);
      byFixture.set(key, existing);
    }
  }
  return [...byFixture.entries()]
    .filter(([, item]) => item.statuses.size > 1 || Math.max(...item.scores) - Math.min(...item.scores) > 0.15)
    .map(([fixtureId]) => fixtureId);
}
