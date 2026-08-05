import type { EvaluationRun } from "./types.ts";

export function summariseEvaluationRun(run: EvaluationRun) {
  const hardFailures = run.results.flatMap((result) => result.hardFailures);
  return {
    runId: run.runId,
    suiteId: run.suiteId,
    status: run.status,
    fixtureCount: run.fixtureCount,
    passedCount: run.passedCount,
    failedCount: run.failedCount,
    blockedCount: run.blockedCount,
    overallScore: run.scoreSummary.overall,
    hardFailureCount: run.scoreSummary.hardFailureCount,
    topHardFailures: [...new Set(hardFailures)].slice(0, 8),
    totalCost: run.totalCost,
    averageLatency: run.averageLatency,
    liveProviderStatus: run.executionMode.startsWith("live") ? "live opt-in run" : "no paid provider calls",
    promotionStatus: run.promotionDecision.status,
  };
}

export function renderEvaluationReport(run: EvaluationRun, format: "json" | "html" | "text" = "json") {
  const summary = summariseEvaluationRun(run);
  if (format === "json") return JSON.stringify({ summary, run }, null, 2);
  if (format === "text") {
    return [
      `Evaluation Run ${run.runId}`,
      `Status: ${run.status}`,
      `Suite: ${run.suiteId}`,
      `Fixtures: ${run.fixtureCount} passed=${run.passedCount} failed=${run.failedCount} blocked=${run.blockedCount}`,
      `Overall score: ${run.scoreSummary.overall}`,
      `Hard failures: ${run.scoreSummary.hardFailureCount}`,
      `Cost: ${run.totalCost}`,
      `Average latency: ${run.averageLatency}ms`,
      `Live-provider status: ${summary.liveProviderStatus}`,
      `Promotion status: ${run.promotionDecision.status}`,
    ].join("\n");
  }
  return `<article><h1>Evaluation Run ${run.runId}</h1><p>Status: ${run.status}</p><p>Overall score: ${run.scoreSummary.overall}</p><p>Hard failures: ${run.scoreSummary.hardFailureCount}</p><p>${summary.liveProviderStatus}</p></article>`;
}
