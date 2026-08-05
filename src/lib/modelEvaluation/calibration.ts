import type { CalibrationBucket, CalibrationReport, EvaluationResult, EvaluationRun } from "./types.ts";

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

export function buildCalibrationReport(run: EvaluationRun): CalibrationReport {
  const buckets: CalibrationBucket[] = [
    { minConfidence: 0, maxConfidence: 0.2, count: 0, accuracy: 0, averageConfidence: 0 },
    { minConfidence: 0.2, maxConfidence: 0.4, count: 0, accuracy: 0, averageConfidence: 0 },
    { minConfidence: 0.4, maxConfidence: 0.6, count: 0, accuracy: 0, averageConfidence: 0 },
    { minConfidence: 0.6, maxConfidence: 0.8, count: 0, accuracy: 0, averageConfidence: 0 },
    { minConfidence: 0.8, maxConfidence: 1.01, count: 0, accuracy: 0, averageConfidence: 0 },
  ];
  for (const result of run.results) {
    const confidence = result.modelResult?.confidence ?? 0;
    const bucket = buckets.find((item) => confidence >= item.minConfidence && confidence < item.maxConfidence) ?? buckets[0];
    const correct = result.status === "passed" ? 1 : 0;
    bucket.count += 1;
    bucket.accuracy += correct;
    bucket.averageConfidence += confidence;
  }
  for (const bucket of buckets) {
    if (bucket.count > 0) {
      bucket.accuracy = clamp(bucket.accuracy / bucket.count);
      bucket.averageConfidence = clamp(bucket.averageConfidence / bucket.count);
    }
  }
  const scored = run.results.map((result) => ({ confidence: result.modelResult?.confidence ?? 0, correct: result.status === "passed" ? 1 : 0 }));
  const brierScore = scored.length === 0 ? 0 : clamp(scored.reduce((sum, item) => sum + (item.confidence - item.correct) ** 2, 0) / scored.length);
  const expectedCalibrationError = clamp(buckets.reduce((sum, bucket) => sum + (bucket.count / Math.max(1, run.results.length)) * Math.abs(bucket.accuracy - bucket.averageConfidence), 0));
  const overconfidenceRate = scored.length === 0 ? 0 : clamp(scored.filter((item) => item.confidence >= 0.75 && item.correct === 0).length / scored.length);
  const underconfidenceRate = scored.length === 0 ? 0 : clamp(scored.filter((item) => item.confidence < 0.5 && item.correct === 1).length / scored.length);
  const byTaskType: Record<string, number> = {};
  const byRiskLevel: Record<string, number> = {};
  for (const result of run.results) {
    const category = result.fixtureId.replace(/^fixture-\d+-/, "");
    byTaskType[category] = result.confidenceCalibrationScore;
    const risk = result.humanReviewStatus === "pending" ? "high-or-critical" : "low-or-medium";
    byRiskLevel[risk] = clamp(((byRiskLevel[risk] ?? 0) + result.confidenceCalibrationScore) / (byRiskLevel[risk] === undefined ? 1 : 2));
  }
  return {
    reportId: `calibration-${run.runId}`,
    runId: run.runId,
    brierScore,
    expectedCalibrationError,
    overconfidenceRate,
    underconfidenceRate,
    buckets,
    byTaskType,
    byProvider: { [run.provider]: 1 - brierScore },
    byWorker: { [run.workerVersion]: 1 - brierScore },
    byRiskLevel,
    createdAt: run.completedAt ?? run.startedAt,
  };
}

export function confidenceCalibrationScore(results: EvaluationResult[]) {
  if (results.length === 0) return 0;
  return clamp(results.reduce((sum, result) => sum + result.confidenceCalibrationScore, 0) / results.length);
}
