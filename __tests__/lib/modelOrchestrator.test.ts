import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AICfoOrchestrator } from "../../src/lib/aiCfo.ts";
import { createAutonomousWorkerModelTaskRequest, AutonomousOperationsEngine } from "../../src/lib/autonomousOperations.ts";
import { gatherAICfoInputs } from "../../src/lib/aiCfoRuntime.ts";
import {
  MODEL_OUTPUT_SCHEMAS,
  buildModelRegistry,
  executeModelTask,
  initialCircuitBreaker,
  modelRunRepository,
  recordCircuitBreakerFailure,
  routeModelTask,
  validateModelResult,
  type ModelRecord,
  type ModelTaskRequest,
} from "../../src/lib/modelOrchestrator/index.ts";
import {
  buildCanonicalModelRegistry,
  buildComparisonReadiness,
  type ModelComparisonApproval,
  validateCanonicalModelRegistry,
  type CanonicalModelRegistryEntry,
} from "../../src/lib/modelOrchestrator/modelRegistry.ts";
import { routeModelTask as routeTaskDirectly } from "../../src/lib/modelOrchestrator/router.ts";
import { fixtureToModelTask } from "../../src/lib/modelEvaluation/adapters/orchestrator.ts";
import {
  buildCandidateEnvironment,
  buildExecutionEnvelope,
  buildFrozenMethodologyHashes,
  buildFrameworkEquivalenceReport,
  buildRouterDryExecution,
  runChildProcessPropagationCheck,
  validateExecutionEnvelope,
} from "../../src/lib/modelEvaluation/modelComparisonCandidate.ts";
import { EVALUATION_FIXTURES } from "../../src/lib/modelEvaluation/fixtures.ts";

function env(overrides: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...overrides } as NodeJS.ProcessEnv;
}

function baseTask(overrides: Partial<ModelTaskRequest> = {}): ModelTaskRequest {
  return {
    taskId: "task-test",
    userId: "pilot-user-a",
    sessionId: "session-a",
    correlationId: "corr-a",
    taskType: "financial-synthesis",
    purpose: "Synthetic financial synthesis",
    sensitivity: "financial-sensitive",
    riskLevel: "medium",
    autonomyLevel: "inform-only",
    requiredCapabilities: ["text", "structured-output"],
    preferredCapabilities: ["reasoning"],
    prohibitedProviders: [],
    permittedProviders: null,
    contextReferences: ["fact:income"],
    evidenceReferences: ["ev-income"],
    inputPayload: { question: "What changed?" },
    outputSchema: MODEL_OUTPUT_SCHEMAS.FinancialSynthesis,
    maximumCost: 0.25,
    maximumLatencyMs: 10000,
    minimumConfidence: 0.6,
    professionalReviewRequired: false,
    deterministicEngineRequired: false,
    fallbackAllowed: true,
    retryPolicy: { maxAttempts: 1, baseDelayMs: 10, retryableErrors: ["RATE_LIMITED"] },
    createdAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function model(overrides: Partial<ModelRecord>): ModelRecord {
  return {
    provider: "mock",
    model: "mock-standard",
    enabled: true,
    availability: "available",
    supportsText: true,
    supportsVision: false,
    supportsDocuments: false,
    supportsStructuredOutput: true,
    supportsToolCalling: false,
    supportsLongContext: false,
    supportsReasoning: true,
    supportsStreaming: false,
    supportsBatch: false,
    maximumInputTokens: 64000,
    maximumOutputTokens: 4000,
    relativeCostClass: "low",
    relativeLatencyClass: "fast",
    dataRegion: "local-test",
    retentionPolicy: "none",
    approvedSensitivityLevels: ["public", "internal", "personal", "financial-sensitive"],
    approvedTaskTypes: ["financial-synthesis", "conversational-answer", "recommendation-drafting"],
    healthStatus: "healthy",
    lastHealthCheck: "2026-07-20T00:00:00.000Z",
    configurationSource: "test",
    promotionState: "approved",
    ...overrides,
  };
}

function readLocalJson(path: string) {
  assert.equal(existsSync(path), true, `expected artifact to exist: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

const gpt56Approval: ModelComparisonApproval = {
  approvalId: "approval-gpt-56-terra",
  provider: "openai" as const,
  exactModelId: "gpt-5.6-terra",
  displayName: "GPT-5.6 Terra",
  reason: "test",
  expectedCost: { inputPerMillion: 2.5, outputPerMillion: 15, currency: "USD" as const, source: "test" },
  evaluationScope: "stage-a-six-fixture-comparison" as const,
  approvedTaskTypes: ["financial-synthesis", "document-extraction", "verification-review", "timeline-explanation", "recommendation-critique", "scenario-explanation"],
  approvedSensitivityLevels: ["public", "internal", "personal", "financial-sensitive"],
  approvedAt: "2026-07-23T00:00:00.000Z",
  approvedBy: "test",
};

const candidate2Approval: ModelComparisonApproval = {
  approvalId: "approval-gpt-41-candidate-2",
  provider: "openai" as const,
  exactModelId: "gpt-4.1",
  displayName: "GPT-4.1 Candidate 2",
  reason: "test candidate 2",
  expectedCost: { inputPerMillion: 2, outputPerMillion: 8, currency: "USD" as const, source: "test" },
  evaluationScope: "stage-a-six-fixture-comparison" as const,
  approvedTaskTypes: ["financial-synthesis", "document-extraction", "verification-review", "timeline-explanation", "recommendation-critique", "scenario-explanation"],
  approvedSensitivityLevels: ["public", "internal", "personal", "financial-sensitive"],
  approvedAt: "2026-07-23T00:00:00.000Z",
  approvedBy: "test",
};

describe("Model Orchestrator routing and guardrails", () => {
  it("routes deterministic calculations to deterministic engines only", () => {
    const task = baseTask({
      taskType: "deterministic-calculation",
      deterministicEngineRequired: true,
      requiredCapabilities: ["deterministic-engine"],
      outputSchema: null,
    });
    const decision = routeModelTask(task, buildModelRegistry(env({ VIREON_MODEL_ORCHESTRATOR_MODE: "mock" })));

    assert.equal(decision.selectedProvider, "deterministic");
    assert.ok(decision.rejectedCandidates.every((candidate) => candidate.provider === "mock" || candidate.provider === "openai" || candidate.provider === "anthropic" || candidate.provider === "gemini"));
  });

  it("blocks financial-sensitive data from providers not approved for that sensitivity", () => {
    const registry = [model({ provider: "openai", model: "openai-test", approvedSensitivityLevels: ["public", "internal"] })];
    const decision = routeModelTask(baseTask(), registry);

    assert.equal(decision.selectedProvider, null);
    assert.ok(decision.rejectedCandidates.some((candidate) => candidate.reasons.includes("sensitivity not approved for model")));
  });

  it("respects prohibited providers and client cannot force a blocked provider", () => {
    const registry = [
      model({ provider: "mock", model: "mock-fast" }),
      model({ provider: "openai", model: "openai-approved", approvedSensitivityLevels: ["financial-sensitive"] }),
    ];
    const decision = routeModelTask(baseTask({ permittedProviders: ["openai", "mock"], prohibitedProviders: ["openai"] }), registry);

    assert.equal(decision.selectedProvider, "mock");
    assert.ok(decision.rejectedCandidates.some((candidate) => candidate.provider === "openai"));
  });

  it("prefers the lowest cost eligible model that meets capability and latency requirements", () => {
    const registry = [
      model({ provider: "mock", model: "mock-expensive", relativeCostClass: "high", relativeLatencyClass: "normal" }),
      model({ provider: "mock", model: "mock-cheap", relativeCostClass: "low", relativeLatencyClass: "fast" }),
    ];
    const decision = routeModelTask(baseTask(), registry);

    assert.equal(decision.selectedModel, "mock-cheap");
  });

  it("removes unhealthy models from normal routing", () => {
    const decision = routeModelTask(baseTask(), [model({ model: "mock-down", healthStatus: "unhealthy" })]);

    assert.equal(decision.selectedProvider, null);
    assert.ok(decision.rejectedCandidates.some((candidate) => candidate.reasons.includes("MODEL_UNHEALTHY: health status is unhealthy")));
  });

  it("opens the circuit breaker after repeated provider failures", () => {
    let record = initialCircuitBreaker("mock", "mock-standard");
    record = recordCircuitBreakerFailure(record, "TIMEOUT");
    record = recordCircuitBreakerFailure(record, "TIMEOUT");

    assert.equal(record.state, "open");
  });

  it("rejects invalid structured output and unknown evidence references", () => {
    const result = {
      taskId: "task-test",
      runId: "run-test",
      provider: "mock" as const,
      model: "mock-standard",
      modelVersionOrAlias: "mock-standard",
      status: "succeeded" as const,
      structuredOutput: { summary: "Unsupported", evidenceIds: ["missing"], classification: ["evidence-backed"], confidence: 0.8, extra: true },
      displayText: "Unsupported",
      evidenceUsed: ["missing"],
      evidenceMissing: [],
      assumptions: [],
      confidence: 0.8,
      classification: ["evidence-backed" as const],
      professionalReviewRequired: false,
      deterministicResultsReferenced: [],
      validationResults: [],
      fallbackHistory: [],
      tokenUsage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      estimatedCost: 0.001,
      latencyMs: 1,
      startedAt: "2026-07-20T00:00:00.000Z",
      completedAt: "2026-07-20T00:00:00.001Z",
      correlationId: "corr-a",
      auditReference: "model-audit:test",
      errorCode: null,
    };
    const report = validateModelResult(baseTask(), result);

    assert.equal(report.every((item) => item.passed), false);
    assert.ok(report.some((item) => item.name === "field:extra" && !item.passed));
    assert.ok(report.some((item) => item.name === "evidence-references" && !item.passed));
  });

  it("rejects claimed calculated results without calculation snapshot references", () => {
    const report = validateModelResult(baseTask(), {
      taskId: "task-test",
      runId: "run-test",
      provider: "mock",
      model: "mock-standard",
      modelVersionOrAlias: "mock-standard",
      status: "succeeded",
      structuredOutput: { summary: "Calculated claim", evidenceIds: ["ev-income"], classification: ["calculated"], confidence: 0.8 },
      displayText: "Calculated claim",
      evidenceUsed: ["ev-income"],
      evidenceMissing: [],
      assumptions: [],
      confidence: 0.8,
      classification: ["calculated"],
      professionalReviewRequired: false,
      deterministicResultsReferenced: [],
      validationResults: [],
      fallbackHistory: [],
      tokenUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      estimatedCost: 0.001,
      latencyMs: 1,
      startedAt: "2026-07-20T00:00:00.000Z",
      completedAt: "2026-07-20T00:00:00.001Z",
      correlationId: "corr-a",
      auditReference: "model-audit:test",
      errorCode: null,
    });

    assert.equal(report.every((item) => item.passed), false);
    assert.ok(report.some((item) => item.detail.includes("calculated outputs require deterministic")));
  });

  it("enforces budgets before avoidable spend", async () => {
    const result = await executeModelTask(baseTask({ maximumCost: 0.001 }), [
      model({ provider: "mock", model: "mock-budget-test", relativeCostClass: "low" }),
    ]);

    assert.equal(result.status, "budget-blocked");
    assert.equal(result.errorCode, "BUDGET_EXCEEDED");
  });

  it("redacts prompt-sensitive fields from persisted runs by default", async () => {
    const task = baseTask({ inputPayload: { apiKey: "secret-key", token: "secret-token", normal: "allowed" } });
    const result = await executeModelTask(task, buildModelRegistry(env({ VIREON_MODEL_ORCHESTRATOR_MODE: "mock" })));
    const run = modelRunRepository.getRun(task.userId, result.runId);

    assert.equal(result.status, "succeeded");
    assert.ok(run);
    assert.equal(run?.rawPromptStored, false);
    assert.equal(run?.rawResponseStored, false);
    assert.ok(run?.promptHash);
  });

  it("returns provider unavailable in no-LLM mode while deterministic remains available", async () => {
    const conversational = await executeModelTask(baseTask({ taskType: "conversational-answer", outputSchema: null }), buildModelRegistry(env({ VIREON_MODEL_ORCHESTRATOR_MODE: "disabled" })));
    const deterministic = await executeModelTask(baseTask({
      taskType: "deterministic-calculation",
      deterministicEngineRequired: true,
      requiredCapabilities: ["deterministic-engine"],
      outputSchema: null,
    }), buildModelRegistry(env({ VIREON_MODEL_ORCHESTRATOR_MODE: "disabled" })));

    assert.equal(conversational.status, "blocked");
    assert.notEqual(conversational.errorCode, "MODEL_NOT_AVAILABLE");
    assert.ok(["PROVIDER_NOT_CONFIGURED", "MODEL_UNHEALTHY", "PROVIDER_UNAVAILABLE"].includes(String(conversational.errorCode)));
    assert.equal(deterministic.status, "succeeded");
    assert.ok(deterministic.classification.includes("deterministic"));
  });

  it("operates safely with one configured provider without claiming independent review", async () => {
    const result = await executeModelTask(baseTask({ taskType: "recommendation-drafting", professionalReviewRequired: true }), buildModelRegistry(env({ VIREON_MODEL_ORCHESTRATOR_MODE: "mock" })));

    assert.equal(result.status, "succeeded");
    assert.equal(result.provider, "mock");
    assert.equal(result.professionalReviewRequired, true);
  });

  it("keeps model run history user isolated", async () => {
    const task = baseTask({ taskId: "isolated-run" });
    const result = await executeModelTask(task, buildModelRegistry(env({ VIREON_MODEL_ORCHESTRATOR_MODE: "mock" })));

    assert.ok(modelRunRepository.getRun(task.userId, result.runId));
    assert.equal(modelRunRepository.getRun("pilot-user-b", result.runId), null);
  });

  it("maps AI CFO requests into provider-neutral model tasks without changing calculations", () => {
    const run = AICfoOrchestrator.run(gatherAICfoInputs(), {
      userQuery: "Should I use a trust?",
      workspaceContext: "structure-optimiser",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    const task = AICfoOrchestrator.createModelTaskRequest({
      request: run.request,
      context: run.context,
      userId: "pilot-user-a",
      sessionId: "session-a",
      correlationId: "corr-a",
    });

    assert.equal(task.sensitivity, "financial-sensitive");
    assert.equal(task.professionalReviewRequired, true);
    assert.equal(task.deterministicEngineRequired, true);
    const deterministicOutputs = task.inputPayload.deterministicOutputs as Record<string, number>;
    assert.equal(deterministicOutputs.borrowingCapacity, run.context.selectedSimulation.borrowingCapacity);
  });

  it("maps autonomous workers into model tasks without selecting providers or executing tools", () => {
    const state = AutonomousOperationsEngine.build({ now: "2026-07-20T09:00:00.000Z" });
    const task = state.tasks.find((item) => item.worker === "Debt Optimiser") ?? state.tasks[0];
    assert.ok(task);
    const modelTask = createAutonomousWorkerModelTaskRequest({
      task,
      context: state.context,
      userId: "pilot-user-a",
      sessionId: "session-a",
      correlationId: "corr-worker",
      now: "2026-07-20T09:00:00.000Z",
    });

    assert.equal(modelTask.permittedProviders, null);
    const guardrails = modelTask.inputPayload.guardrails as Record<string, boolean>;
    assert.equal(guardrails.canExecuteProviderNativeTools, false);
    assert.equal(guardrails.canModifyFinancialFacts, false);
    assert.ok(modelTask.requiredCapabilities.includes("structured-output"));
  });

  it("canonical registry excludes retired gpt-5.2 from comparison eligibility", () => {
    const registry = buildCanonicalModelRegistry(env({
      VIREON_OPENAI_ENABLED: "true",
      VIREON_OPENAI_API_KEY: "test-key",
      VIREON_OPENAI_DEFAULT_MODEL: "gpt-5.2",
      VIREON_MODEL_COMPARISON_APPROVALS: JSON.stringify([{
        approvalId: "approval-retired",
        provider: "openai",
        exactModelId: "gpt-5.2",
        displayName: "GPT-5.2",
        reason: "test",
        expectedCost: { inputPerMillion: 1, outputPerMillion: 1, currency: "USD", source: "test" },
        evaluationScope: "stage-a-six-fixture-comparison",
        approvedTaskTypes: ["financial-synthesis"],
        approvedSensitivityLevels: ["financial-sensitive"],
        approvedAt: "2026-07-23T00:00:00.000Z",
        approvedBy: "test",
      }]),
    }));
    const retired = registry.find((entry) => entry.provider === "openai" && entry.exactModelId === "gpt-5.2");

    assert.ok(retired);
    assert.equal(retired.retirementStatus.retired, true);
    assert.equal(retired.evaluationEligibility.eligible, false);
  });

  it("canonical registry blocks unavailable or uncredentialed candidates", () => {
    const registry = buildCanonicalModelRegistry(env({
      VIREON_OPENAI_ENABLED: "true",
      VIREON_OPENAI_DEFAULT_MODEL: "gpt-4.1",
      VIREON_MODEL_COMPARISON_APPROVALS: JSON.stringify([{
        approvalId: "approval-no-key",
        provider: "openai",
        exactModelId: "gpt-4.1",
        displayName: "GPT-4.1 Candidate 2",
        reason: "test",
        expectedCost: { inputPerMillion: 1, outputPerMillion: 1, currency: "USD", source: "test" },
        evaluationScope: "stage-a-six-fixture-comparison",
        approvedTaskTypes: ["financial-synthesis"],
        approvedSensitivityLevels: ["financial-sensitive"],
        approvedAt: "2026-07-23T00:00:00.000Z",
        approvedBy: "test",
      }]),
    }));
    const candidate = registry.find((entry) => entry.provider === "openai" && entry.exactModelId === "gpt-4.1");

    assert.ok(candidate);
    assert.equal(candidate.evaluationEligibility.eligible, false);
    assert.match(candidate.evaluationEligibility.reason, /credential|enabled|health|not enabled/);
  });

  it("canonical registry separates evaluation eligibility from production eligibility", () => {
    const registry = buildCanonicalModelRegistry(env({
      VIREON_OPENAI_ENABLED: "true",
      VIREON_OPENAI_API_KEY: "test-key",
      VIREON_OPENAI_DEFAULT_MODEL: "gpt-4.1",
      VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS: "public,internal,personal,financial-sensitive",
      VIREON_MODEL_COMPARISON_APPROVALS: JSON.stringify([{
        approvalId: "approval-eval",
        provider: "openai",
        exactModelId: "gpt-4.1",
        displayName: "GPT-4.1 Candidate 2",
        reason: "test",
        expectedCost: { inputPerMillion: 2.5, outputPerMillion: 15, currency: "USD", source: "test" },
        evaluationScope: "stage-a-six-fixture-comparison",
        approvedTaskTypes: ["financial-synthesis"],
        approvedSensitivityLevels: ["financial-sensitive"],
        approvedAt: "2026-07-23T00:00:00.000Z",
        approvedBy: "test",
      }]),
    }));
    const candidate = registry.find((entry) => entry.provider === "openai" && entry.exactModelId === "gpt-4.1");

    assert.ok(candidate);
    assert.equal(candidate.evaluationEligibility.eligible, true);
    assert.equal(candidate.productionEligibility.eligible, false);
  });

  it("registry validation reports duplicate provider/model entries", () => {
    const entry = buildCanonicalModelRegistry(env({ VIREON_MODEL_ORCHESTRATOR_MODE: "mock" }))[0] as CanonicalModelRegistryEntry;
    const validation = validateCanonicalModelRegistry([entry, entry]);

    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.includes("duplicate model entry")));
  });

  it("comparison readiness includes only approved non-retired evaluation candidates", () => {
    const registry = buildCanonicalModelRegistry(env({
      VIREON_OPENAI_ENABLED: "true",
      VIREON_OPENAI_API_KEY: "test-key",
      VIREON_OPENAI_DEFAULT_MODEL: "gpt-4.1",
      VIREON_MODEL_COMPARISON_APPROVALS: JSON.stringify([gpt56Approval, candidate2Approval]),
    }));
    const readiness = buildComparisonReadiness(registry);

    assert.equal(readiness.ready, true);
    assert.ok(readiness.included.some((entry) => entry.exactModelId === "gpt-4.1"));
    assert.ok(!readiness.included.some((entry) => entry.exactModelId === "gpt-5.6-terra"));
    assert.ok(readiness.excluded.some((entry) => entry.exactModelId === "gpt-5.6-terra" && entry.reason === "model is retired"));
    assert.ok(readiness.excluded.some((entry) => entry.exactModelId === "gpt-5.2" || entry.reason));
  });

  it("keeps gpt-5.2 and gpt-5.6 Terra retired when Candidate 2 is configured", () => {
    const registry = buildCanonicalModelRegistry(env({
      VIREON_OPENAI_ENABLED: "true",
      VIREON_OPENAI_API_KEY: "test-key",
      VIREON_OPENAI_DEFAULT_MODEL: "gpt-4.1",
      VIREON_MODEL_COMPARISON_APPROVALS: JSON.stringify([gpt56Approval, candidate2Approval]),
    }));

    assert.equal(registry.find((entry) => entry.exactModelId === "gpt-5.2")?.retirementStatus.retired, true);
    assert.equal(registry.find((entry) => entry.exactModelId === "gpt-5.6-terra")?.retirementStatus.retired, true);
    assert.equal(registry.find((entry) => entry.exactModelId === "gpt-4.1")?.status, "evaluation");
  });

  it("Terra retirement preserves quality and operational metrics without selecting a winner", () => {
    const summary = readLocalJson(join(process.cwd(), ".vireon", "model-evaluation", "live", "live-eval-d30efd91-7857-4bd5-a665-e7424fb69a7a-summary.json"));
    const results = Array.isArray(summary.results) ? summary.results : [];
    const matrixPath = join(process.cwd(), ".vireon", "model-evaluation", "model-comparison", "model-comparison-program-v1-matrix.json");
    const matrix = existsSync(matrixPath) ? readLocalJson(matrixPath) : { winnerSelected: false };

    assert.equal(summary.status, "halted");
    assert.equal(summary.haltReason, "critical-failures");
    assert.equal(summary.requestCount, 5);
    assert.equal(results.length, 5);
    assert.equal(summary.blockedCount, 1);
    assert.equal(summary.passedCount, 0);
    assert.equal((summary.scoreSummary as Record<string, unknown>).hardFailureCount, 5);
    assert.notEqual(results.length, summary.fixtureCount);
    assert.notEqual(matrix.winnerSelected, true);
  });

  it("candidate approval is exact-model specific", () => {
    const registry = buildCanonicalModelRegistry(env({
      VIREON_OPENAI_ENABLED: "true",
      VIREON_OPENAI_API_KEY: "test-key",
      VIREON_OPENAI_DEFAULT_MODEL: "gpt-5.6-other",
      VIREON_MODEL_COMPARISON_APPROVALS: JSON.stringify([gpt56Approval]),
    }));
    const configured = registry.find((entry) => entry.exactModelId === "gpt-5.6-other");

    assert.ok(configured);
    assert.equal(configured.evaluationEligibility.eligible, false);
    assert.equal(configured.evaluationEligibility.approvalId, null);
  });

  it("candidate pricing is model-specific and not inherited from gpt-5.2", () => {
    const registry = buildCanonicalModelRegistry(env({
      VIREON_OPENAI_ENABLED: "true",
      VIREON_OPENAI_API_KEY: "test-key",
      VIREON_OPENAI_DEFAULT_MODEL: "gpt-4.1",
      VIREON_OPENAI_INPUT_COST_PER_1M: "99",
      VIREON_OPENAI_OUTPUT_COST_PER_1M: "99",
      VIREON_MODEL_COMPARISON_APPROVALS: JSON.stringify([candidate2Approval]),
    }));
    const candidate = registry.find((entry) => entry.exactModelId === "gpt-4.1");

    assert.equal(candidate?.pricingMetadata.inputPerMillion, 2);
    assert.equal(candidate?.pricingMetadata.outputPerMillion, 8);
  });

  it("blocks production routing for evaluation-only comparison candidates", () => {
    const decision = routeTaskDirectly(baseTask({
      permittedProviders: ["openai"],
      permittedModels: ["gpt-5.6-terra"],
      executionMode: "PRODUCTION",
    }), [
      model({
        provider: "openai",
        model: "gpt-5.6-terra",
        approvedSensitivityLevels: ["financial-sensitive"],
        promotionState: "evaluation",
      }),
    ]);

    assert.equal(decision.selectedModel, null);
    assert.ok(decision.rejectedCandidates.some((candidate) => candidate.reasons.some((reason) => reason.includes("MODEL_RESTRICTED_PRODUCTION"))));
  });

  it("allows approved INTERNAL_EVALUATION routing for exact Stage-A candidate fixtures", () => {
    const candidateEnv = buildCandidateEnvironment({
      provider: "openai",
      model: "gpt-4.1",
      approval: candidate2Approval,
      env: env({ VIREON_OPENAI_API_KEY: "test-key" }),
    });
    const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === "fixture-01-payslip-extraction");
    assert.ok(fixture);
    const task = fixtureToModelTask(fixture, {
      executionMode: "live-single-provider",
      provider: "openai",
      model: "gpt-4.1",
      promptVersion: "stage-a-task-specific-v3",
      scorerVersion: "deterministic-scorer-v3-structured-claims-candidate",
      stageACandidateId: candidateEnv.VIREON_STAGE_A_CANDIDATE_ID,
      maximumTaskCost: 0.3,
      maximumRetries: 1,
      maximumOutputTokens: 800,
    });
    const decision = routeTaskDirectly(task, [
      model({
        provider: "openai",
        model: "gpt-4.1",
        approvedSensitivityLevels: ["public", "internal", "personal", "financial-sensitive"],
        approvedTaskTypes: ["document-extraction"],
        promotionState: "evaluation",
      }),
    ], candidateEnv);

    assert.equal(decision.selectedProvider, "openai");
    assert.equal(decision.selectedModel, "gpt-4.1");
  });

  it("frozen methodology hashes are stable and fixture set remains six", () => {
    const hashes = buildFrozenMethodologyHashes(env({ VIREON_STAGE_A_APPROVED_MODEL: "gpt-5.6-terra" }));
    const equivalence = buildFrameworkEquivalenceReport(env({ VIREON_STAGE_A_APPROVED_MODEL: "gpt-5.6-terra" })).report;

    assert.equal(Object.values(hashes).every((value) => typeof value === "string" && value.length > 8), true);
    assert.equal(equivalence.identicalControls.fixtureIds.length, 6);
    assert.deepEqual(equivalence.unexplainedMethodologyDifferences, []);
    assert.equal(equivalence.valid, true);
  });

  it("candidate execution envelope validates with one shared configuration hash", () => {
    const candidateEnv = buildCandidateEnvironment({
      provider: "openai",
      model: "gpt-4.1",
      approval: candidate2Approval,
      env: env({ VIREON_OPENAI_API_KEY: "test-key", VIREON_STAGE_A_BUDGET_APPROVED: "true" }),
    });
    const envelope = buildExecutionEnvelope({
      provider: "openai",
      model: "gpt-4.1",
      approval: candidate2Approval,
      snapshotId: "snapshot-test",
      budgetApprovalId: "budget-test",
      budgetConfigurationHash: "budget-hash",
      env: candidateEnv,
    });
    candidateEnv.VIREON_CANDIDATE_EXECUTION_ENVELOPE = JSON.stringify(envelope);
    candidateEnv.VIREON_CANDIDATE_CONFIGURATION_HASH = envelope.configurationHash;

    const validation = validateExecutionEnvelope(candidateEnv);
    assert.equal(validation.ok, true);
    assert.equal(validation.configurationHash, envelope.configurationHash);
  });

  it("candidate environment reaches a child process without provider calls", () => {
    const candidateEnv = buildCandidateEnvironment({
      provider: "openai",
      model: "gpt-4.1",
      approval: candidate2Approval,
      env: env({ VIREON_OPENAI_API_KEY: "test-key", VIREON_STAGE_A_BUDGET_APPROVED: "true" }),
    });
    const envelope = buildExecutionEnvelope({
      provider: "openai",
      model: "gpt-4.1",
      approval: candidate2Approval,
      snapshotId: "snapshot-test",
      budgetApprovalId: "budget-test",
      budgetConfigurationHash: "budget-hash",
      env: candidateEnv,
    });
    candidateEnv.VIREON_CANDIDATE_EXECUTION_ENVELOPE = JSON.stringify(envelope);
    candidateEnv.VIREON_CANDIDATE_CONFIGURATION_HASH = envelope.configurationHash;

    const propagation = runChildProcessPropagationCheck(candidateEnv);
    assert.equal(propagation.status, "valid");
    assert.equal(propagation.message, "CANDIDATE ENVIRONMENT PROPAGATION VALID");
  });

  it("router dry execution resolves the candidate without provider calls", () => {
    const candidateEnv = buildCandidateEnvironment({
      provider: "openai",
      model: "gpt-4.1",
      approval: candidate2Approval,
      env: env({ VIREON_OPENAI_API_KEY: "test-key", VIREON_STAGE_A_BUDGET_APPROVED: "true" }),
    });
    const envelope = buildExecutionEnvelope({
      provider: "openai",
      model: "gpt-4.1",
      approval: candidate2Approval,
      snapshotId: "snapshot-test",
      budgetApprovalId: "budget-test",
      budgetConfigurationHash: "budget-hash",
      env: candidateEnv,
    });
    candidateEnv.VIREON_CANDIDATE_EXECUTION_ENVELOPE = JSON.stringify(envelope);
    candidateEnv.VIREON_CANDIDATE_CONFIGURATION_HASH = envelope.configurationHash;
    const dry = buildRouterDryExecution({ env: candidateEnv, provider: "openai", model: "gpt-4.1" });

    assert.equal(dry.status, "ready");
    assert.equal(dry.message, "ROUTER DRY EXECUTION READY");
    assert.equal(dry.provider, "openai");
    assert.equal(dry.model, "gpt-4.1");
    assert.equal(dry.providerCallsMade, false);
  });

  it("missing candidate context is not reported as MODEL_UNHEALTHY", async () => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === "fixture-01-payslip-extraction");
    assert.ok(fixture);
    const task = fixtureToModelTask(fixture, {
      executionMode: "live-single-provider",
      provider: "openai",
      model: "gpt-5.6-terra",
      promptVersion: "stage-a-task-specific-v3",
      scorerVersion: "deterministic-scorer-v3-structured-claims-candidate",
      maximumTaskCost: 0.3,
      maximumRetries: 1,
      maximumOutputTokens: 800,
    });
    delete task.inputPayload.stageACandidateId;
    const result = await executeModelTask(task, [
      model({
        provider: "openai",
        model: "gpt-5.6-terra",
        enabled: false,
        availability: "unavailable",
        healthStatus: "disabled",
        promotionState: "unconfigured",
      }),
    ]);

    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, "CANDIDATE_CONTEXT_MISSING");
  });
});
