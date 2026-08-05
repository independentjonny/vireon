import { randomUUID } from "crypto";
import { MODEL_POLICY_VERSION } from "../modelOrchestrator/policy.ts";
import type { ModelProvider } from "../modelOrchestrator/types.ts";
import { getDefaultEvaluationFixtures, EVALUATION_SUITES, EVALUATION_FIXTURES } from "./fixtures.ts";
import { scoreEvaluationResult } from "./scorers.ts";
import { buildCalibrationReport, confidenceCalibrationScore } from "./calibration.ts";
import { compareAgainstBaseline } from "./regression.ts";
import { createPromotionDecision } from "./promotion.ts";
import { runRuleBasedJudge } from "./judges.ts";
import { evaluationRepository } from "./store.ts";
import { executeFixtureThroughOrchestrator, fixtureToModelTask, modelConfigurationLabel } from "./adapters/orchestrator.ts";
import { runDeterministicFixture } from "./adapters/deterministic.ts";
import { runMockFixture } from "./adapters/mock.ts";
import type { EvaluationErrorCode, EvaluationExecutionMode, EvaluationFixture, EvaluationRun, EvaluationRunOptions, EvaluationScoreSummary, PromotionDecision } from "./types.ts";

function nowIso(options: EvaluationRunOptions) {
  return options.now ?? new Date().toISOString();
}

function average(values: number[]) {
  return values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function scoreSummary(results: ReturnType<typeof scoreEvaluationResult>[]): EvaluationScoreSummary {
  return {
    overall: average(results.map((result) => result.overallScore)),
    schema: average(results.map((result) => result.schemaScore)),
    factualAccuracy: average(results.map((result) => result.factualAccuracyScore)),
    evidenceGrounding: average(results.map((result) => result.evidenceGroundingScore)),
    deterministicFidelity: average(results.map((result) => result.deterministicFidelityScore)),
    safety: average(results.map((result) => result.safetyScore)),
    policyCompliance: average(results.map((result) => result.policyComplianceScore)),
    confidenceCalibration: confidenceCalibrationScore(results),
    professionalReview: average(results.map((result) => result.professionalReviewScore)),
    actionBoundary: average(results.map((result) => result.actionBoundaryScore)),
    cost: average(results.map((result) => result.costScore)),
    latency: average(results.map((result) => result.latencyScore)),
    hardFailureCount: results.reduce((sum, result) => sum + result.hardFailures.length, 0),
  };
}

function assertLiveGuard(options: EvaluationRunOptions): EvaluationErrorCode | null {
  if ((options.executionMode === "live-single-provider" || options.executionMode === "live-multi-provider") && (process.env.VIREON_LIVE_MODEL_EVALUATION !== "true" || !options.liveProviderOptIn)) {
    return "LIVE_EVALUATION_DISABLED";
  }
  return null;
}

function fixtureSafetyError(fixtures: EvaluationFixture[], options: EvaluationRunOptions): EvaluationErrorCode | null {
  const unsafe = fixtures.some((fixture) => !fixture.testData || fixture.evidence.some((evidence) => !evidence.testData));
  if (unsafe) return "UNSAFE_TEST_DATA";
  const anonymisedWithoutOptIn = fixtures.some((fixture) => fixture.sourceType === "approved-anonymised") && !options.includeApprovedAnonymised;
  return anonymisedWithoutOptIn ? "UNSAFE_TEST_DATA" : null;
}

async function executeFixture(fixture: EvaluationFixture, options: EvaluationRunOptions) {
  if (options.executionMode === "deterministic-only") return runDeterministicFixture(fixture, options);
  if (options.executionMode === "live-single-provider" || options.executionMode === "live-multi-provider") return executeFixtureThroughOrchestrator(fixture, options);
  return runMockFixture(fixture, options);
}

export async function runEvaluation(options: EvaluationRunOptions = {}): Promise<EvaluationRun> {
  const startedAt = nowIso(options);
  const executionMode: EvaluationExecutionMode = options.executionMode ?? "offline-mock";
  const suiteId = options.suiteId ?? "core-synthetic-v1";
  const fixtures = getDefaultEvaluationFixtures({ suiteId, maximumFixtures: options.maximumFixtures, fixtureIds: options.fixtureIds, includeApprovedAnonymised: options.includeApprovedAnonymised });
  const errors: EvaluationErrorCode[] = [];
  const liveError = assertLiveGuard({ ...options, executionMode });
  const safetyError = fixtureSafetyError(fixtures, options);
  if (liveError) errors.push(liveError);
  if (safetyError) errors.push(safetyError);

  const runId = `eval-run-${randomUUID()}`;
  const emptySummary: EvaluationScoreSummary = {
    overall: 0,
    schema: 0,
    factualAccuracy: 0,
    evidenceGrounding: 0,
    deterministicFidelity: 0,
    safety: 0,
    policyCompliance: 0,
    confidenceCalibration: 0,
    professionalReview: 0,
    actionBoundary: 0,
    cost: 0,
    latency: 0,
    hardFailureCount: 0,
  };

  if (errors.length > 0) {
    const blockedRegressionSummary = {
      baselineId: null,
      previousScore: null,
      candidateScore: 0,
      absoluteChange: null,
      percentageChange: null,
      hardFailureChange: null,
      costChange: null,
      latencyChange: null,
      calibrationChange: null,
      fixtureDifferences: [],
      status: "no-baseline" as const,
    };
    const blocked: EvaluationRun = {
      runId,
      suiteId,
      fixtureVersion: fixtures[0]?.fixtureVersion ?? "unknown",
      modelOrchestratorPolicyVersion: options.routingPolicyVersion ?? MODEL_POLICY_VERSION,
      provider: options.provider ?? "none",
      model: options.model ?? "none",
      modelConfigurationVersion: modelConfigurationLabel(options.provider, options.model),
      promptVersion: options.promptVersion ?? "prompt-eval-v1",
      workerVersion: options.workerVersion ?? "worker-eval-v1",
      deterministicEngineVersions: ["vireon-deterministic-engines-v1"],
      startedAt,
      completedAt: startedAt,
      status: "blocked",
      environment: "local",
      executionMode,
      fixtureCount: fixtures.length,
      passedCount: 0,
      failedCount: 0,
      blockedCount: fixtures.length,
      totalCost: 0,
      averageLatency: 0,
      scoreSummary: emptySummary,
      regressionSummary: blockedRegressionSummary,
      promotionDecision: null as unknown as PromotionDecision,
      correlationId: `eval-corr-${runId}`,
      results: [],
      errors,
    };
    blocked.promotionDecision = createPromotionDecision(blocked);
    evaluationRepository.saveRun(blocked);
    return blocked;
  }

  const results = [];
  for (const fixture of fixtures) {
    const task = fixtureToModelTask(fixture, options);
    try {
      const { result } = await executeFixture(fixture, options);
      const evaluationResult = scoreEvaluationResult({ fixture, task, result, runId });
      evaluationResult.automatedJudgeResults = [runRuleBasedJudge(fixture, evaluationResult)];
      results.push(evaluationResult);
    } catch (error) {
      const failed = scoreEvaluationResult({ fixture, task, result: null, runId });
      failed.hardFailures.push(error instanceof Error ? error.message : "Unknown evaluation execution error");
      failed.status = "blocked";
      results.push(failed);
    }
  }

  const completedAt = nowIso(options);
  const summary = scoreSummary(results);
  const candidate = `${options.provider ?? "mock"}/${options.model ?? "router-selected"}/${options.promptVersion ?? "prompt-eval-v1"}`;
  const regressionSummary = compareAgainstBaseline({
    runId,
    suiteId,
    fixtureVersion: fixtures[0]?.fixtureVersion ?? "unknown",
    scoreSummary: summary,
    results,
    totalCost: results.reduce((sum, result) => sum + (result.modelResult?.estimatedCost ?? 0), 0),
    averageLatency: average(results.map((result) => result.modelResult?.latencyMs ?? 0)),
  } as EvaluationRun, evaluationRepository.latestBaseline(suiteId, candidate));
  const run: EvaluationRun = {
    runId,
    suiteId,
    fixtureVersion: fixtures[0]?.fixtureVersion ?? "unknown",
    modelOrchestratorPolicyVersion: options.routingPolicyVersion ?? MODEL_POLICY_VERSION,
    provider: (options.provider ?? "mock") as ModelProvider,
    model: options.model ?? "router-selected",
    modelConfigurationVersion: modelConfigurationLabel(options.provider, options.model),
    promptVersion: options.promptVersion ?? "prompt-eval-v1",
    workerVersion: options.workerVersion ?? "worker-eval-v1",
    deterministicEngineVersions: ["vireon-deterministic-engines-v1"],
    startedAt,
    completedAt,
    status: "completed",
    environment: "local",
    executionMode,
    fixtureCount: fixtures.length,
    passedCount: results.filter((result) => result.status === "passed").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    blockedCount: results.filter((result) => result.status === "blocked").length,
    totalCost: results.reduce((sum, result) => sum + (result.modelResult?.estimatedCost ?? 0), 0),
    averageLatency: average(results.map((result) => result.modelResult?.latencyMs ?? 0)),
    scoreSummary: summary,
    regressionSummary,
    promotionDecision: null as unknown as PromotionDecision,
    correlationId: `eval-corr-${runId}`,
    results,
    errors: [],
  };
  run.promotionDecision = createPromotionDecision(run);
  evaluationRepository.saveRun(run);
  evaluationRepository.saveCalibrationReport(buildCalibrationReport(run));
  return run;
}

export function listEvaluationSuites() {
  for (const suite of EVALUATION_SUITES) evaluationRepository.upsertSuite(suite);
  for (const fixture of EVALUATION_FIXTURES) evaluationRepository.upsertFixture(fixture);
  return EVALUATION_SUITES;
}

export function runFixtureValidation() {
  const fixtures = getDefaultEvaluationFixtures();
  return {
    fixtureCount: fixtures.length,
    suiteCount: EVALUATION_SUITES.length,
    highRiskCount: fixtures.filter((fixture) => fixture.tags.includes("high-risk")).length,
    missingEvidenceCount: fixtures.filter((fixture) => fixture.tags.includes("missing-evidence")).length,
    conflictingDataCount: fixtures.filter((fixture) => fixture.tags.includes("conflicting-data")).length,
    adversarialCount: fixtures.filter((fixture) => fixture.tags.includes("adversarial")).length,
    unsafeCount: fixtures.filter((fixture) => !fixture.testData).length,
  };
}
