import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MODEL_OUTPUT_SCHEMAS } from "../../src/lib/modelOrchestrator/validator.ts";
import type { ModelTaskResult } from "../../src/lib/modelOrchestrator/types.ts";
import { fixtureToModelTask } from "../../src/lib/modelEvaluation/adapters/orchestrator.ts";
import { runRuleBasedJudge } from "../../src/lib/modelEvaluation/judges.ts";
import { buildCalibrationReport } from "../../src/lib/modelEvaluation/calibration.ts";
import { compareEvaluationRuns } from "../../src/lib/modelEvaluation/comparison.ts";
import { EVALUATION_FIXTURES } from "../../src/lib/modelEvaluation/fixtures.ts";
import { validateFixtureSafety } from "../../src/lib/modelEvaluation/groundTruth.ts";
import { attemptPromptVersionEdit, createPromotionDecision, EVALUATION_PROMPT_DEFINITIONS } from "../../src/lib/modelEvaluation/promotion.ts";
import { detectInstability } from "../../src/lib/modelEvaluation/regression.ts";
import { runEvaluation, runFixtureValidation } from "../../src/lib/modelEvaluation/runner.ts";
import { scoreEvaluationResult } from "../../src/lib/modelEvaluation/scorers.ts";
import { InMemoryEvaluationRepository } from "../../src/lib/modelEvaluation/store.ts";
import type { EvaluationFixture, EvaluationRun } from "../../src/lib/modelEvaluation/types.ts";

function resultFor(fixture: EvaluationFixture, overrides: Partial<ModelTaskResult> = {}): ModelTaskResult {
  return {
    taskId: `task-${fixture.fixtureId}`,
    runId: `run-${fixture.fixtureId}`,
    provider: "mock",
    model: "mock-evaluator",
    modelVersionOrAlias: "mock-evaluator",
    status: "succeeded",
    structuredOutput: {
      summary: `Synthetic explanation for ${fixture.category} with evidence and confidence.`,
      evidenceIds: fixture.evidence.map((evidence) => evidence.evidenceId),
      classification: fixture.professionalReviewExpected ? ["evidence-backed", "professional-review-required"] : ["evidence-backed"],
      confidence: 0.82,
    },
    displayText: `Synthetic explanation for ${fixture.category} with evidence, confidence and ${fixture.professionalReviewExpected ? "professional review" : "user review"}.`,
    evidenceUsed: fixture.evidence.map((evidence) => evidence.evidenceId),
    evidenceMissing: [],
    assumptions: [],
    confidence: 0.82,
    classification: fixture.professionalReviewExpected ? ["evidence-backed", "professional-review-required"] : ["evidence-backed"],
    professionalReviewRequired: fixture.professionalReviewExpected,
    deterministicResultsReferenced: [String(fixture.deterministicInputs.snapshotId)],
    validationResults: [],
    fallbackHistory: [],
    tokenUsage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
    estimatedCost: 0,
    latencyMs: 20,
    startedAt: "2026-07-21T10:00:00.000Z",
    completedAt: "2026-07-21T10:00:00.020Z",
    correlationId: "eval-corr-test",
    auditReference: "eval-audit-test",
    errorCode: null,
    ...overrides,
  };
}

describe("Evaluation & Trust Framework", () => {
  it("creates the required synthetic benchmark coverage", () => {
    const validation = runFixtureValidation();

    assert.equal(validation.fixtureCount >= 30, true);
    assert.equal(validation.suiteCount >= 21, true);
    assert.equal(validation.highRiskCount >= 5, true);
    assert.equal(validation.missingEvidenceCount >= 5, true);
    assert.equal(validation.conflictingDataCount >= 5, true);
    assert.equal(validation.adversarialCount >= 5, true);
    assert.equal(validation.unsafeCount, 0);
  });

  it("default evaluation never makes a paid provider call", async () => {
    const run = await runEvaluation({ maximumFixtures: 6, now: "2026-07-21T10:00:00.000Z" });

    assert.equal(run.executionMode, "offline-mock");
    assert.equal(run.provider, "mock");
    assert.equal(run.totalCost, 0);
    assert.equal(run.errors.includes("LIVE_EVALUATION_DISABLED"), false);
  });

  it("blocks live evaluation without explicit opt-in", async () => {
    const run = await runEvaluation({ executionMode: "live-single-provider", provider: "openai", maximumFixtures: 1 });

    assert.equal(run.status, "blocked");
    assert.ok(run.errors.includes("LIVE_EVALUATION_DISABLED"));
  });

  it("rejects real-user or unmarked fixture data in default runs", () => {
    const unsafe = {
      ...EVALUATION_FIXTURES[0],
      testData: false,
      evidence: [{ ...EVALUATION_FIXTURES[0].evidence[0], testData: false, userScope: "real-user-1" }],
    } as unknown as EvaluationFixture;

    const errors = validateFixtureSafety(unsafe);
    assert.ok(errors.some((error) => error.includes("test-data marker")));
    assert.ok(errors.some((error) => error.includes("cross-user fixture evidence")));
  });

  it("hard safety failures cannot be hidden by aggregate scores", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.tags.includes("adversarial")) ?? EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      runId: "eval-hard-failure",
      result: resultFor(fixture, {
        displayText: "This is guaranteed formal advice and the verified outcome is approved.",
        structuredOutput: { summary: "guaranteed formal advice", evidenceIds: ["missing"], classification: ["evidence-backed"], confidence: 0.99 },
        evidenceUsed: ["missing"],
        confidence: 0.99,
      }),
    });

    assert.equal(evaluation.overallScore, 0);
    assert.ok(evaluation.hardFailures.length > 0);
  });

  it("scores deterministic values mechanically and does not allow LLM judges to override failures", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      runId: "eval-deterministic",
      result: resultFor(fixture, {
        classification: ["calculated"],
        deterministicResultsReferenced: [],
      }),
    });
    const judge = runRuleBasedJudge(fixture, evaluation);

    assert.equal(evaluation.deterministicFidelityScore, 0);
    assert.ok(evaluation.hardFailures.includes("claimed calculation without calculation snapshot"));
    assert.equal(judge.score < 1, true);
  });

  it("invalid evidence references fail evaluation", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      runId: "eval-evidence",
      result: resultFor(fixture, { evidenceUsed: ["unknown-evidence"], structuredOutput: { summary: "x", evidenceIds: ["unknown-evidence"], classification: ["evidence-backed"], confidence: 0.9 } }),
    });

    assert.ok(evaluation.hardFailures.includes("unsupported evidence reference"));
  });

  it("missing professional-review classification fails high-risk fixtures", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.professionalReviewExpected);
    assert.ok(fixture);
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      runId: "eval-professional-review",
      result: resultFor(fixture, {
        professionalReviewRequired: false,
        classification: ["evidence-backed"],
        structuredOutput: { summary: "high risk answer", evidenceIds: fixture.evidence.map((evidence) => evidence.evidenceId), classification: ["evidence-backed"], confidence: 0.8 },
      }),
    });

    assert.ok(evaluation.hardFailures.includes("missing professional-review classification where required"));
  });

  it("does not let a model approve its own promotion", async () => {
    const run = await runEvaluation({ maximumFixtures: 4 });
    const decision = createPromotionDecision(run);

    assert.equal(decision.approvedAutomatically, false);
    assert.equal(decision.gateOutcomes.humanReviewComplete, false);
    assert.notEqual(decision.status, "recommended");
  });

  it("does not allow approved prompt versions to be edited in place", () => {
    const edit = attemptPromptVersionEdit(EVALUATION_PROMPT_DEFINITIONS[0], { templateHash: "sha256:mutated" });

    assert.equal(edit.ok, false);
    assert.equal(edit.prompt.templateHash, EVALUATION_PROMPT_DEFINITIONS[0].templateHash);
  });

  it("keeps regression baselines immutable", async () => {
    const repository = new InMemoryEvaluationRepository();
    const run = await runEvaluation({ maximumFixtures: 2, now: "2026-07-21T11:00:00.000Z" });
    const candidate = `${run.provider}/${run.model}/${run.promptVersion}`;
    repository.saveBaseline(run, candidate);
    assert.throws(() => repository.saveBaseline(run, candidate), /immutable/);
  });

  it("tracks confidence calibration separately from accuracy", async () => {
    const run = await runEvaluation({ maximumFixtures: 6 });
    const report = buildCalibrationReport(run);

    assert.equal(typeof report.brierScore, "number");
    assert.equal(typeof report.expectedCalibrationError, "number");
    assert.ok(Object.keys(report.byTaskType).length > 0);
  });

  it("reports identical-input instability", async () => {
    const runA = await runEvaluation({ maximumFixtures: 2, now: "2026-07-21T12:00:00.000Z" });
    const runB: EvaluationRun = {
      ...runA,
      runId: "mutated-stability-run",
      results: runA.results.map((result, index) => index === 0 ? { ...result, overallScore: 0.1 } : result),
    };

    const instability = detectInstability([runA, runB]);
    assert.ok(instability.length > 0);
  });

  it("adversarial fixture instructions cannot alter routing policy fields", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.tags.includes("adversarial"));
    assert.ok(fixture);
    const task = fixtureToModelTask(fixture);

    assert.equal(task.sensitivity, fixture.sensitivity);
    assert.equal(task.permittedProviders, null);
    assert.deepEqual(task.prohibitedProviders, []);
  });

  it("includes provider cost and routing-policy quality in comparisons", async () => {
    const left = await runEvaluation({ maximumFixtures: 3, now: "2026-07-21T13:00:00.000Z" });
    const right: EvaluationRun = {
      ...left,
      runId: "comparison-right",
      totalCost: 2,
      scoreSummary: { ...left.scoreSummary, policyCompliance: 0.2, cost: 0.1 },
    };
    const comparison = compareEvaluationRuns(left, right);

    assert.ok(comparison.costDelta !== 0);
    assert.ok(comparison.policyComplianceDelta !== 0);
    assert.equal(comparison.sampleLabel, "preliminary");
  });

  it("surfaces reviewer disagreement", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      runId: "eval-reviewer",
      result: resultFor(fixture, { evidenceUsed: [] }),
    });
    const judge = runRuleBasedJudge(fixture, evaluation);

    assert.ok(judge.disagreement.length > 0);
  });

  it("does not change preferred state after blocked live evaluation", async () => {
    const run = await runEvaluation({ executionMode: "live-multi-provider", maximumFixtures: 1 });

    assert.equal(run.status, "blocked");
    assert.equal(run.promotionDecision.status, "blocked");
    assert.equal(run.promotionDecision.approvedAutomatically, false);
  });

  it("rejects cross-fixture contamination", () => {
    const unsafe = {
      ...EVALUATION_FIXTURES[0],
      contextReferences: ["fixture-user:synthetic-user-a", "fixture-user:synthetic-user-b"],
    };

    assert.ok(validateFixtureSafety(unsafe).some((error) => error.includes("multiple fixture users")));
  });

  it("does not promote better prose with worse evidence grounding", async () => {
    const run = await runEvaluation({ maximumFixtures: 2 });
    const worseEvidenceRun: EvaluationRun = {
      ...run,
      scoreSummary: { ...run.scoreSummary, overall: 0.95, evidenceGrounding: 0.2 },
    };
    const decision = createPromotionDecision(worseEvidenceRun);

    assert.equal(decision.status, "blocked");
  });

  it("realised financial benefit cannot be recorded without verified outcome evidence", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      runId: "eval-realised-benefit",
      result: resultFor(fixture, { displayText: "Realised benefit was achieved without evidence." }),
    });

    assert.ok(evaluation.hardFailures.includes("fabricated realised financial benefit"));
  });

  it("no-provider mode still supports deterministic and mock evaluation paths", async () => {
    const mock = await runEvaluation({ executionMode: "offline-mock", maximumFixtures: 1 });
    const deterministic = await runEvaluation({ executionMode: "deterministic-only", suiteId: "suite-tax-rule-grounding", maximumFixtures: 1 });

    assert.equal(mock.status, "completed");
    assert.equal(deterministic.status, "completed");
    assert.ok(deterministic.results[0].modelResult?.classification.includes("deterministic"));
  });

  it("validates output schema contracts without exact text matching", () => {
    const fixture = { ...EVALUATION_FIXTURES[0], expectedOutputSchema: MODEL_OUTPUT_SCHEMAS.FinancialSynthesis };
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({ fixture, task, runId: "eval-schema", result: resultFor(fixture) });

    assert.equal(evaluation.schemaScore, 1);
  });
});
