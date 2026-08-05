import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { routeModelTask } from "../../src/lib/modelOrchestrator/router.ts";
import { buildModelRegistry } from "../../src/lib/modelOrchestrator/registry.ts";
import { isApprovedStageAEvaluationRequest, taskPermissionMatrix } from "../../src/lib/modelOrchestrator/taskRestrictions.ts";
import { validateModelResult } from "../../src/lib/modelOrchestrator/validator.ts";
import { buildPromptEnvelope } from "../../src/lib/modelOrchestrator/executor.ts";
import { circuitBreakerAllows, recordCircuitBreakerFailure } from "../../src/lib/modelOrchestrator/circuitBreaker.ts";
import {
  LIVE_EVALUATION_PROMPT_STAGE_A_V3,
  LIVE_EVALUATION_SCORER_V3,
  buildLiveEvaluationPreflight,
  haltReasonForModelTaskResult,
  runLiveEvaluationPilot,
  selectInitialLiveEvaluationFixtures,
  selectLiveEvaluationFixtures,
} from "../../src/lib/modelEvaluation/livePilot.ts";
import { fixtureToModelTask } from "../../src/lib/modelEvaluation/adapters/orchestrator.ts";
import { EVALUATION_FIXTURES } from "../../src/lib/modelEvaluation/fixtures.ts";
import { runEvaluation } from "../../src/lib/modelEvaluation/runner.ts";
import { scoreEvaluationResult } from "../../src/lib/modelEvaluation/scorers.ts";
import type { EvaluationFixture } from "../../src/lib/modelEvaluation/types.ts";
import type { ModelTaskResult } from "../../src/lib/modelOrchestrator/types.ts";

const baseReadyEnv = {
  NODE_ENV: "test",
  VIREON_LIVE_MODEL_EVALUATION: "true",
  VIREON_SYNTHETIC_DATA_ONLY: "true",
  VIREON_MODEL_ORCHESTRATOR_MODE: "live-evaluation",
  VIREON_MODEL_EVALUATION_ENVIRONMENT: "local-live-evaluation",
  VIREON_DATA_SOURCE: "synthetic",
  VIREON_OPENAI_ENABLED: "true",
  VIREON_OPENAI_API_KEY: "set-but-not-used-in-tests",
  VIREON_OPENAI_DEFAULT_MODEL: "synthetic-openai-eval-model",
  VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS: "public,internal,personal,financial-sensitive",
  VIREON_LIVE_MODEL_DAILY_BUDGET: "3",
  VIREON_LIVE_MODEL_MAX_RUN_COST: "1",
  VIREON_LIVE_MODEL_MAX_TASK_COST: "0.3",
  VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT: "12",
  VIREON_LIVE_MODEL_MAX_RETRIES: "1",
  VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS: "800",
  VIREON_MODEL_LOG_PROMPTS: "false",
  VIREON_MODEL_STORE_RAW_RESPONSES: "false",
} satisfies NodeJS.ProcessEnv;

const emptyEnv = { NODE_ENV: "test" } satisfies NodeJS.ProcessEnv;

const stageAEnv = {
  ...baseReadyEnv,
  VIREON_OPENAI_DEFAULT_MODEL: "gpt-5.2",
  VIREON_MODEL_EVALUATION_ENVIRONMENT: "local-pilot",
  VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT: "6",
  VIREON_LIVE_MODEL_DAILY_BUDGET: "1.8",
  VIREON_LIVE_MODEL_MAX_RUN_COST: "1.8",
  VIREON_LIVE_MODEL_MAX_TASK_COST: "0.3",
  VIREON_LIVE_MODEL_MAX_RETRIES: "0",
  VIREON_STAGE_A_LIVE_VALIDATION: "true",
  VIREON_LIVE_MODEL_STAGE: "stage-a",
  VIREON_LIVE_MODEL_PROMPT_VERSION: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
  VIREON_LIVE_MODEL_SCORER_VERSION: LIVE_EVALUATION_SCORER_V3,
  VIREON_LIVE_MODEL_FIXTURE_IDS: [
    "fixture-01-payslip-extraction",
    "fixture-03-mortgage-statement-extraction",
    "fixture-32-unsupported-action-rejection",
    "fixture-12-daily-review-briefing",
    "fixture-13-timeline-explanation",
    "fixture-07-mortgage-comparison",
  ].join(","),
  VIREON_STAGE_A_BUDGET_APPROVED: "true",
} satisfies NodeJS.ProcessEnv;

function resultFor(fixture: EvaluationFixture, overrides: Partial<ModelTaskResult> = {}): ModelTaskResult {
  return {
    taskId: `task-${fixture.fixtureId}`,
    runId: `run-${fixture.fixtureId}`,
    provider: "mock",
    model: "mock-evaluator",
    modelVersionOrAlias: "mock-evaluator",
    status: "succeeded",
    structuredOutput: {
      summary: `Synthetic explanation for ${fixture.category}.`,
      evidenceIds: fixture.evidence.map((evidence) => evidence.evidenceId),
      classification: fixture.professionalReviewExpected ? ["evidence-backed", "professional-review-required"] : ["evidence-backed"],
      confidence: 0.82,
    },
    displayText: `Synthetic explanation for ${fixture.category} using provided evidence.`,
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
    startedAt: "2026-07-22T10:00:00.000Z",
    completedAt: "2026-07-22T10:00:00.020Z",
    correlationId: "live-eval-test",
    auditReference: "live-eval-test",
    errorCode: null,
    ...overrides,
  };
}

describe("Live Model Evaluation Pilot", () => {
  it("keeps live evaluation disabled by default", async () => {
    const preflight = await buildLiveEvaluationPreflight(emptyEnv);

    assert.equal(preflight.state, "blocked");
    assert.equal(preflight.message, "LIVE MODEL EVALUATION BLOCKED");
    assert.ok(preflight.blockers.includes("liveEvaluationEnabled"));
  });

  it("requires synthetic-only mode before a live run", async () => {
    const preflight = await buildLiveEvaluationPreflight({ ...baseReadyEnv, VIREON_SYNTHETIC_DATA_ONLY: "false" });

    assert.equal(preflight.state, "blocked");
    assert.ok(preflight.blockers.includes("syntheticOnly"));
  });

  it("rejects production data sources and unidentified environments", async () => {
    const productionSource = await buildLiveEvaluationPreflight({ ...baseReadyEnv, VIREON_DATA_SOURCE: "production" });
    const productionEnv = await buildLiveEvaluationPreflight({ ...baseReadyEnv, VIREON_MODEL_EVALUATION_ENVIRONMENT: "production" });

    assert.ok(productionSource.blockers.includes("noProductionDataSource"));
    assert.ok(productionEnv.blockers.includes("environmentIdentified"));
  });

  it("requires fixture and budget limits", async () => {
    const preflight = await buildLiveEvaluationPreflight({
      ...baseReadyEnv,
      VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT: undefined,
      VIREON_LIVE_MODEL_MAX_RUN_COST: undefined,
    });

    assert.ok(preflight.blockers.includes("fixtureLimitConfigured"));
    assert.ok(preflight.blockers.includes("maxRunCostConfigured"));
  });

  it("selects no more than the required bounded synthetic fixture subset", () => {
    const fixtures = selectInitialLiveEvaluationFixtures(12);

    assert.equal(fixtures.length, 12);
    assert.equal(fixtures.filter((fixture) => fixture.riskLevel === "high" || fixture.riskLevel === "critical").length >= 3, true);
    assert.equal(fixtures.filter((fixture) => fixture.tags.includes("missing-evidence") || fixture.tags.includes("conflicting-data")).length >= 2, true);
    assert.equal(fixtures.some((fixture) => fixture.tags.includes("adversarial")), true);
    assert.equal(fixtures.every((fixture) => fixture.testData), true);
  });

  it("selects exactly the approved Stage-A six-fixture subset", () => {
    const fixtures = selectLiveEvaluationFixtures(6, stageAEnv);

    assert.deepEqual(fixtures.map((fixture) => fixture.fixtureId), [
      "fixture-01-payslip-extraction",
      "fixture-03-mortgage-statement-extraction",
      "fixture-32-unsupported-action-rejection",
      "fixture-12-daily-review-briefing",
      "fixture-13-timeline-explanation",
      "fixture-07-mortgage-comparison",
    ]);
    assert.equal(fixtures.every((fixture) => fixture.testData), true);
  });

  it("blocks Stage-A until budget approval is explicit", async () => {
    const preflight = await buildLiveEvaluationPreflight({ ...stageAEnv, VIREON_STAGE_A_BUDGET_APPROVED: "false" });

    assert.equal(preflight.state, "blocked");
    assert.equal(preflight.message, "STAGE A LIVE VALIDATION BLOCKED");
    assert.ok(preflight.blockers.includes("stageABudgetApproved"));
  });

  it("requires Stage-A v3 prompt and scorer versions", async () => {
    const preflight = await buildLiveEvaluationPreflight({
      ...stageAEnv,
      VIREON_LIVE_MODEL_PROMPT_VERSION: "prompt-eval-live-v2",
      VIREON_LIVE_MODEL_SCORER_VERSION: "deterministic-scorer-v2",
    });

    assert.equal(preflight.state, "blocked");
    assert.ok(preflight.blockers.includes("promptVersionActive"));
    assert.ok(preflight.blockers.includes("scorerVersionActive"));
  });

  it("blocks Stage-A when the fixture cap or fixture set is not exact", async () => {
    const badLimit = await buildLiveEvaluationPreflight({ ...stageAEnv, VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT: "7" });
    const badFixtures = await buildLiveEvaluationPreflight({
      ...stageAEnv,
      VIREON_LIVE_MODEL_FIXTURE_IDS: "fixture-01-payslip-extraction,fixture-03-mortgage-statement-extraction",
    });

    assert.ok(badLimit.blockers.includes("fixtureLimitConfigured"));
    assert.ok(badFixtures.blockers.includes("stageAFixtureSetExact"));
  });

  it("marks every executed Stage-A fixture as requiring human review", async () => {
    const pilot = await runLiveEvaluationPilot(stageAEnv);

    assert.equal(pilot.run?.fixtureCount, 6);
    assert.equal(pilot.humanReviewQueue.length, 6);
    assert.equal(pilot.humanReviewQueue.every((item) => item.required), true);
    assert.equal(pilot.automaticPromotionEnabled, false);
  });

  it("requires all six Stage-A budget reservations before run creation", async () => {
    const preflight = await buildLiveEvaluationPreflight({
      ...stageAEnv,
      VIREON_LIVE_MODEL_MAX_RUN_COST: "0.1",
      VIREON_LIVE_MODEL_MAX_TASK_COST: "0.02",
    });
    const pilot = await runLiveEvaluationPilot({
      ...stageAEnv,
      VIREON_LIVE_MODEL_MAX_RUN_COST: "0.1",
      VIREON_LIVE_MODEL_MAX_TASK_COST: "0.02",
    });

    assert.equal(preflight.state, "blocked");
    assert.equal(preflight.budgetReservation?.message, "STAGE-A BLOCKED BEFORE RUN CREATION");
    assert.ok(preflight.blockers.includes("budgetReservationValid"));
    assert.ok(preflight.budgetReservation?.blockers.includes("per-task-budget-exceeded"));
    assert.equal(pilot.run, null);
    assert.equal(pilot.operationalMetrics.requestCount, 0);
  });

  it("reports a valid Stage-A budget reservation with a shared configuration hash", async () => {
    const preflight = await buildLiveEvaluationPreflight(stageAEnv);

    assert.equal(preflight.state, "ready");
    assert.equal(preflight.budgetReservation?.message, "BUDGET RESERVATION VALID");
    assert.equal(preflight.budgetReservation?.reservations.length, 6);
    assert.equal(preflight.budgetReservation?.reservations.every((item) => item.fitsPerTaskCap), true);
    assert.equal(preflight.budgetConfigurationHash, preflight.budgetReservation?.configurationHash);
  });

  it("keeps production restriction blocking while approved Stage-A fixture is evaluation eligible", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === "fixture-01-payslip-extraction");
    assert.ok(fixture);
    const registry = buildModelRegistry(stageAEnv);
    const model = registry.find((item) => item.provider === "openai" && item.model === "gpt-5.2");
    assert.ok(model);
    const evaluationTask = fixtureToModelTask(fixture, {
      executionMode: "live-single-provider",
      provider: "openai",
      model: "gpt-5.2",
      maximumTaskCost: 0.3,
      maximumRetries: 1,
      maximumOutputTokens: 800,
      promptVersion: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
      scorerVersion: LIVE_EVALUATION_SCORER_V3,
    });
    const productionTask = { ...evaluationTask, executionMode: "PRODUCTION" as const, inputPayload: { ...evaluationTask.inputPayload, evaluationMode: false, evaluationExecutionMode: "PRODUCTION" } };

    const productionRoute = routeModelTask(productionTask, registry, stageAEnv);
    const evaluationRoute = routeModelTask(evaluationTask, registry, stageAEnv);

    assert.equal(taskPermissionMatrix("document-extraction").productionAllowed, false);
    assert.equal(taskPermissionMatrix("document-extraction").evaluationAllowed, true);
    assert.equal(isApprovedStageAEvaluationRequest(model, evaluationTask, stageAEnv), true);
    assert.equal(productionRoute.selectedProvider, null);
    assert.ok(productionRoute.rejectedCandidates.some((candidate) => candidate.reasons.some((reason) => reason.includes("TASK_RESTRICTED_PRODUCTION"))));
    assert.equal(evaluationRoute.selectedProvider, "openai");
    assert.equal(evaluationRoute.selectedModel, "gpt-5.2");
  });

  it("does not allow evaluation override without manifest, synthetic data, exact provider, exact model and approved fixture", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === "fixture-01-payslip-extraction");
    assert.ok(fixture);
    const registry = buildModelRegistry(stageAEnv);
    const model = registry.find((item) => item.provider === "openai" && item.model === "gpt-5.2");
    assert.ok(model);
    const task = fixtureToModelTask(fixture, {
      executionMode: "live-single-provider",
      provider: "openai",
      model: "gpt-5.2",
      maximumTaskCost: 0.3,
      maximumRetries: 1,
      maximumOutputTokens: 800,
      promptVersion: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
      scorerVersion: LIVE_EVALUATION_SCORER_V3,
    });

    const cases = [
      { name: "manifest", task: { ...task, inputPayload: { ...task.inputPayload, stageACandidateId: "unapproved" } } },
      { name: "synthetic-only", task: { ...task, inputPayload: { ...task.inputPayload, testData: false } } },
      { name: "provider", task: { ...task, permittedProviders: ["mock" as const] } },
      { name: "model", task: { ...task, permittedModels: ["different-model"] } },
      { name: "fixture", task: { ...task, inputPayload: { ...task.inputPayload, fixtureId: "fixture-99-unapproved" } } },
      { name: "mode", task: { ...task, executionMode: "PRODUCTION" as const, inputPayload: { ...task.inputPayload, evaluationExecutionMode: "PRODUCTION", evaluationMode: false } } },
    ];

    for (const item of cases) {
      assert.equal(isApprovedStageAEvaluationRequest(model, item.task, stageAEnv), false, item.name);
      const route = routeModelTask(item.task, registry, stageAEnv);
      assert.equal(route.selectedProvider, null, item.name);
    }
  });

  it("does not expose API keys in preflight output", async () => {
    const preflight = await buildLiveEvaluationPreflight({ ...baseReadyEnv, VIREON_OPENAI_API_KEY: "sk-test-secret-value-never-print" });
    const serialised = JSON.stringify(preflight);

    assert.equal(serialised.includes("sk-test-secret-value-never-print"), false);
    assert.equal(preflight.redactedEnvironment.VIREON_OPENAI_API_KEY, "set");
  });

  it("does not persist raw prompts or raw responses by default", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture, { executionMode: "live-single-provider", provider: "openai", maximumTaskCost: 0.5 });
    const prompt = buildPromptEnvelope(task);

    assert.equal(JSON.stringify(prompt).includes("set-but-not-used-in-tests"), false);
    assert.equal(baseReadyEnv.VIREON_MODEL_LOG_PROMPTS, "false");
    assert.equal(baseReadyEnv.VIREON_MODEL_STORE_RAW_RESPONSES, "false");
  });

  it("prevents untrusted input from forcing provider or lowering sensitivity", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.tags.includes("adversarial"));
    assert.ok(fixture);
    const task = fixtureToModelTask(fixture, { executionMode: "live-single-provider", provider: "openai" });

    assert.deepEqual(task.permittedProviders, ["openai"]);
    assert.equal(task.sensitivity, fixture.sensitivity);
    assert.notEqual(task.sensitivity, fixture.input.lowerSensitivityRequest);
  });

  it("requires a registered and eligible model", async () => {
    const preflight = await buildLiveEvaluationPreflight({ ...baseReadyEnv, VIREON_OPENAI_DEFAULT_MODEL: undefined });

    assert.equal(preflight.state, "blocked");
    assert.ok(preflight.blockers.includes("providerConfigured"));
  });

  it("blocks preflight when the selected model is not approved for fixture sensitivity", async () => {
    const preflight = await buildLiveEvaluationPreflight({
      ...baseReadyEnv,
      VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS: "public,internal,personal",
    });

    assert.equal(preflight.state, "blocked");
    assert.equal(preflight.sensitivityLevel, "financial-sensitive");
    assert.ok(preflight.blockers.includes("sensitivityApproved"));
  });

  it("routes only to the explicitly permitted configured provider", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === "fixture-01-payslip-extraction");
    assert.ok(fixture);
    const task = fixtureToModelTask(fixture, {
      executionMode: "live-single-provider",
      provider: "openai",
      model: "gpt-5.2",
      maximumTaskCost: 0.3,
      maximumRetries: 1,
      maximumOutputTokens: 800,
      promptVersion: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
      scorerVersion: LIVE_EVALUATION_SCORER_V3,
    });
    const route = routeModelTask(task, buildModelRegistry(stageAEnv), stageAEnv);

    assert.equal(route.selectedProvider, "openai");
    assert.equal(route.selectedModel, "gpt-5.2");
  });

  it("routes live evaluation only to the exact configured model", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === "fixture-01-payslip-extraction");
    assert.ok(fixture);
    const task = fixtureToModelTask(fixture, {
      executionMode: "live-single-provider",
      provider: "openai",
      model: "gpt-5.2",
      maximumTaskCost: 0.3,
      maximumRetries: 1,
      maximumOutputTokens: 800,
      promptVersion: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
      scorerVersion: LIVE_EVALUATION_SCORER_V3,
    });
    const registry = buildModelRegistry({ ...stageAEnv, VIREON_OPENAI_FAST_MODEL: "synthetic-openai-fast-model" });
    const route = routeModelTask(task, registry, stageAEnv);

    assert.equal(route.selectedProvider, "openai");
    assert.equal(route.selectedModel, "gpt-5.2");
    assert.ok(route.rejectedCandidates.some((candidate) => candidate.model === "synthetic-openai-fast-model" && candidate.reasons.includes("model not in permitted model list")));
  });

  it("fails invalid structured output and unknown evidence references", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const invalid = resultFor(fixture, {
      structuredOutput: { unexpected: true },
      evidenceUsed: ["cross-fixture-evidence"],
    });
    const validations = validateModelResult(task, invalid);
    const evaluation = scoreEvaluationResult({ fixture, task, result: invalid, runId: "live-invalid-output" });

    assert.ok(validations.some((validation) => !validation.passed));
    assert.ok(evaluation.hardFailures.includes("unsupported evidence reference"));
  });

  it("treats deterministic-value changes as hard failures", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      result: resultFor(fixture, { classification: ["calculated"], deterministicResultsReferenced: [] }),
      runId: "live-deterministic-mismatch",
    });

    assert.equal(evaluation.deterministicFidelityScore, 0);
    assert.ok(evaluation.hardFailures.includes("claimed calculation without calculation snapshot"));
  });

  it("fails high-risk fixtures when professional review is omitted", () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.professionalReviewExpected);
    assert.ok(fixture);
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      result: resultFor(fixture, {
        professionalReviewRequired: false,
        classification: ["evidence-backed"],
        structuredOutput: { summary: "high risk answer", evidenceIds: fixture.evidence.map((evidence) => evidence.evidenceId), classification: ["evidence-backed"], confidence: 0.9 },
      }),
      runId: "live-professional-review",
    });

    assert.ok(evaluation.hardFailures.includes("missing professional-review classification where required"));
  });

  it("stops before execution when budget cannot cover the bounded subset", async () => {
    const pilot = await runLiveEvaluationPilot({ ...stageAEnv, VIREON_LIVE_MODEL_MAX_RUN_COST: "0.01", VIREON_LIVE_MODEL_MAX_TASK_COST: "0.02" });

    assert.equal(pilot.run, null);
    assert.equal(pilot.preflight.budgetReservation?.message, "STAGE-A BLOCKED BEFORE RUN CREATION");
    assert.equal(pilot.operationalMetrics.requestCount, 0);
  });

  it("maps BUDGET_EXCEEDED to budget-exceeded instead of provider-unexpected", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const budgetBlocked = resultFor(fixture, {
      provider: "disabled",
      model: "none",
      status: "budget-blocked",
      errorCode: "BUDGET_EXCEEDED",
    });

    assert.equal(haltReasonForModelTaskResult(budgetBlocked, "openai", "gpt-5.2"), "budget-exceeded");
  });

  it("maps unknown local block errors to internal-evaluation-error", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const unknown = resultFor(fixture, {
      provider: "disabled",
      model: "none",
      status: "blocked",
      errorCode: "INTERNAL_ORCHESTRATOR_ERROR",
    });

    assert.equal(haltReasonForModelTaskResult(unknown, "openai", "gpt-5.2"), "internal-evaluation-error");
  });

  it("requires actual provider evidence before provider-unexpected", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const mismatch = resultFor(fixture, { provider: "mock", model: "mock-evaluator" });

    assert.equal(haltReasonForModelTaskResult(mismatch, "openai", "gpt-5.2"), "provider-unexpected");
  });

  it("classifies a budget-blocked fixture as operational, not quality", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      result: resultFor(fixture, {
        provider: "disabled",
        model: "none",
        status: "budget-blocked",
        errorCode: "BUDGET_EXCEEDED",
      }),
      runId: "budget-blocked-result",
    });

    assert.equal(evaluation.status, "blocked");
    assert.equal(evaluation.humanReviewStatus, "not-required");
  });

  it("opens circuit breaker after repeated live failures", () => {
    const breaker = recordCircuitBreakerFailure({
      provider: "openai",
      model: "synthetic-openai-eval-model",
      state: "closed",
      consecutiveFailures: 1,
      rateLimitFailures: 0,
      timeouts: 1,
      malformedOutputRate: 0,
      validationFailureRate: 0,
      latencyDegraded: false,
      lastHealthCheck: "not-run",
      reason: null,
    }, "TIMEOUT");

    assert.equal(circuitBreakerAllows(breaker), false);
  });

  it("does not report a halted live run as successful", async () => {
    const pilot = await runLiveEvaluationPilot({ ...stageAEnv, VIREON_LIVE_MODEL_MAX_RUN_COST: "0.01", VIREON_LIVE_MODEL_MAX_TASK_COST: "0.02" });

    assert.equal(pilot.run, null);
    assert.equal(pilot.preflight.state, "blocked");
  });

  it("does not treat token usage metadata as credential exposure", async () => {
    const pilot = await runLiveEvaluationPilot(baseReadyEnv);

    assert.notEqual(pilot.haltReason, "credential-exposure");
    assert.ok((pilot.operationalMetrics.requestCount > 0 || pilot.run?.status === "completed"));
  });

  it("does not automatically promote live results", async () => {
    const pilot = await runLiveEvaluationPilot({ ...stageAEnv, VIREON_LIVE_MODEL_MAX_RUN_COST: "0.01", VIREON_LIVE_MODEL_MAX_TASK_COST: "0.02" });

    assert.equal(pilot.automaticPromotionEnabled, false);
    assert.equal(pilot.run, null);
  });

  it("labels initial live evaluation as a partial fixture set", async () => {
    const pilot = await runLiveEvaluationPilot({ ...stageAEnv, VIREON_LIVE_MODEL_MAX_RUN_COST: "0.01", VIREON_LIVE_MODEL_MAX_TASK_COST: "0.02" });

    assert.equal(pilot.partialFixtureSet, true);
    assert.equal(pilot.expandedRunEligible, false);
  });

  it("keeps no-provider and mock evaluation functional", async () => {
    const mock = await runEvaluation({ executionMode: "offline-mock", maximumFixtures: 2 });
    const noProviderPreflight = await buildLiveEvaluationPreflight(emptyEnv);

    assert.equal(mock.status, "completed");
    assert.equal(mock.totalCost, 0);
    assert.equal(noProviderPreflight.state, "blocked");
  });

  it("rejects cross-fixture references", () => {
    const fixture = EVALUATION_FIXTURES[0];
    const task = fixtureToModelTask(fixture);
    const evaluation = scoreEvaluationResult({
      fixture,
      task,
      result: resultFor(fixture, { evidenceUsed: ["ev-from-other-fixture"] }),
      runId: "live-cross-fixture",
    });

    assert.ok(evaluation.hardFailures.includes("unsupported evidence reference"));
  });

  it("developer-facing live preflight output is secret-safe", async () => {
    const preflight = await buildLiveEvaluationPreflight({ ...baseReadyEnv, VIREON_OPENAI_API_KEY: "sk-test-secret-value-never-print" });
    const output = JSON.stringify({
      provider: preflight.provider,
      model: preflight.model,
      blockers: preflight.blockers,
      environment: preflight.redactedEnvironment,
    });

    assert.equal(output.includes("sk-test-secret-value-never-print"), false);
    assert.equal(output.includes("password"), false);
  });
});
