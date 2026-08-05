import type { ModelExecutionMode, ModelProvider, ModelRecord, ModelTaskRequest, ModelTaskType } from "./types.ts";

export type ModelTaskRestrictionState = "evaluation" | "evaluation-with-mandatory-review" | "restricted" | "ineligible";

export type ModelTaskRestriction = {
  provider: ModelProvider;
  model: string;
  taskType: ModelTaskType | "autonomous-financial-action";
  state: ModelTaskRestrictionState;
  reason: string;
  supportingEvaluationVersion: string;
  supportingFixtures: string[];
  reviewRequired: boolean;
  reassessAfter: string;
};

export const LIVE_FAILURE_DECOMPOSITION_VERSION = "live-failure-decomposition-v1";
export const STAGE_A_EVALUATION_OVERRIDE_VERSION = "evaluation-mode-routing-remediation-v1";
export const STAGE_A_CANDIDATE_ID = "live-eval-stage-a-candidate-2026-07-22";
export const APPROVED_STAGE_A_FIXTURES = [
  "fixture-01-payslip-extraction",
  "fixture-03-mortgage-statement-extraction",
  "fixture-32-unsupported-action-rejection",
  "fixture-12-daily-review-briefing",
  "fixture-13-timeline-explanation",
  "fixture-07-mortgage-comparison",
] as const;

const GPT_52_RESTRICTIONS: ModelTaskRestriction[] = [
  {
    provider: "openai",
    model: "gpt-5.2",
    taskType: "deterministic-calculation",
    state: "ineligible",
    reason: "Deterministic calculations remain authoritative Vireon engine work and must never route to an LLM.",
    supportingEvaluationVersion: LIVE_FAILURE_DECOMPOSITION_VERSION,
    supportingFixtures: [],
    reviewRequired: false,
    reassessAfter: "after-production-deterministic-engine-review",
  },
  {
    provider: "openai",
    model: "gpt-5.2",
    taskType: "document-extraction",
    state: "restricted",
    reason: "Rerun v2 regressed two original document-extraction passes with confidence validation failures.",
    supportingEvaluationVersion: LIVE_FAILURE_DECOMPOSITION_VERSION,
    supportingFixtures: ["fixture-01-payslip-extraction", "fixture-03-mortgage-statement-extraction"],
    reviewRequired: true,
    reassessAfter: "after-targeted-v3-stage-a",
  },
  {
    provider: "openai",
    model: "gpt-5.2",
    taskType: "financial-synthesis",
    state: "restricted",
    reason: "Original and rerun results show repeated confidence and prohibited-claim failures across financial synthesis fixtures.",
    supportingEvaluationVersion: LIVE_FAILURE_DECOMPOSITION_VERSION,
    supportingFixtures: [
      "fixture-04-financial-position-synthesis",
      "fixture-24-financial-position-synthesis",
      "fixture-06-debt-optimisation-explanation",
      "fixture-12-daily-review-briefing",
      "fixture-31-professional-review-escalation",
    ],
    reviewRequired: true,
    reassessAfter: "after-targeted-v3-stage-a",
  },
  {
    provider: "openai",
    model: "gpt-5.2",
    taskType: "timeline-explanation",
    state: "evaluation-with-mandatory-review",
    reason: "Timeline explanation remained failed under scorer v2 and requires review until prohibited-claim scope is validated.",
    supportingEvaluationVersion: LIVE_FAILURE_DECOMPOSITION_VERSION,
    supportingFixtures: ["fixture-13-timeline-explanation"],
    reviewRequired: true,
    reassessAfter: "after-scorer-v3-corpus-approval",
  },
  {
    provider: "openai",
    model: "gpt-5.2",
    taskType: "verification-review",
    state: "restricted",
    reason: "Unsupported-action rejection regressed in rerun v2; verification and action-sensitive review must not use this model without a new clean evaluation.",
    supportingEvaluationVersion: LIVE_FAILURE_DECOMPOSITION_VERSION,
    supportingFixtures: ["fixture-32-unsupported-action-rejection"],
    reviewRequired: true,
    reassessAfter: "after-targeted-v3-stage-a",
  },
  {
    provider: "openai",
    model: "gpt-5.2",
    taskType: "scenario-explanation",
    state: "evaluation",
    reason: "Digital Twin scenario explanation passed in both completed live runs but evidence remains insufficient for approval.",
    supportingEvaluationVersion: LIVE_FAILURE_DECOMPOSITION_VERSION,
    supportingFixtures: ["fixture-11-digital-twin-scenario-explanation"],
    reviewRequired: true,
    reassessAfter: "after-32-fixture-suite",
  },
];

export function modelTaskRestrictions(provider?: ModelProvider, model?: string) {
  return GPT_52_RESTRICTIONS.filter((restriction) =>
    (!provider || restriction.provider === provider) && (!model || restriction.model === model)
  );
}

function approvedStageAModel(env: NodeJS.ProcessEnv = process.env) {
  return env.VIREON_STAGE_A_APPROVED_MODEL ?? "gpt-5.2";
}

function approvedStageACandidateId(env: NodeJS.ProcessEnv = process.env) {
  return env.VIREON_STAGE_A_CANDIDATE_ID ?? STAGE_A_CANDIDATE_ID;
}

export function getModelTaskRestriction(model: ModelRecord, request: ModelTaskRequest): ModelTaskRestriction | null {
  if (model.provider !== "openai") return null;
  if (model.model !== "gpt-5.2") {
    return {
      provider: model.provider,
      model: model.model,
      taskType: request.taskType,
      state: "evaluation",
      reason: "Comparison candidate is evaluation-only and has no production approval.",
      supportingEvaluationVersion: STAGE_A_EVALUATION_OVERRIDE_VERSION,
      supportingFixtures: [...APPROVED_STAGE_A_FIXTURES],
      reviewRequired: true,
      reassessAfter: "after-frozen-stage-a-comparison",
    };
  }
  if (request.inputPayload.autonomousFinancialAction === true) {
    return {
      provider: model.provider,
      model: model.model,
      taskType: "autonomous-financial-action",
      state: "ineligible",
      reason: "Autonomous financial action is never eligible for direct LLM execution.",
      supportingEvaluationVersion: LIVE_FAILURE_DECOMPOSITION_VERSION,
      supportingFixtures: [],
      reviewRequired: false,
      reassessAfter: "never-without-new-policy",
    };
  }
  return GPT_52_RESTRICTIONS.find((restriction) => restriction.taskType === request.taskType) ?? {
    provider: model.provider,
    model: model.model,
    taskType: request.taskType,
    state: "evaluation",
    reason: "Task class has insufficient live evidence for approval.",
    supportingEvaluationVersion: LIVE_FAILURE_DECOMPOSITION_VERSION,
    supportingFixtures: [],
    reviewRequired: true,
    reassessAfter: "after-expanded-synthetic-suite",
  };
}

export function modelExecutionMode(request: ModelTaskRequest, env: NodeJS.ProcessEnv = process.env): ModelExecutionMode {
  if (request.executionMode) return request.executionMode;
  if (request.inputPayload.evaluationExecutionMode === "INTERNAL_EVALUATION") return "INTERNAL_EVALUATION";
  if (request.inputPayload.evaluationExecutionMode === "OFFLINE_TEST") return "OFFLINE_TEST";
  if (request.inputPayload.evaluationExecutionMode === "MOCK") return "MOCK";
  if (env.VIREON_MODEL_ORCHESTRATOR_MODE === "live-evaluation" || request.inputPayload.evaluationMode === true) return "INTERNAL_EVALUATION";
  return "PRODUCTION";
}

export function isApprovedStageAEvaluationRequest(model: ModelRecord, request: ModelTaskRequest, env: NodeJS.ProcessEnv = process.env) {
  const fixtureId = String(request.inputPayload.fixtureId ?? "");
  return modelExecutionMode(request, env) === "INTERNAL_EVALUATION"
    && model.provider === "openai"
    && model.model === approvedStageAModel(env)
    && request.inputPayload.testData === true
    && request.inputPayload.evaluationStage === "stage-a"
    && request.inputPayload.stageACandidateId === approvedStageACandidateId(env)
    && APPROVED_STAGE_A_FIXTURES.includes(fixtureId as (typeof APPROVED_STAGE_A_FIXTURES)[number])
    && request.permittedProviders?.length === 1
    && request.permittedProviders[0] === model.provider
    && request.permittedModels?.length === 1
    && request.permittedModels[0] === model.model
    && request.fallbackAllowed === false
    && request.inputPayload.humanReviewRequired === true
    && request.inputPayload.evaluationPromptVersion === "stage-a-task-specific-v3"
    && request.inputPayload.evaluationScorerVersion === "deterministic-scorer-v3-structured-claims-candidate"
    && env.VIREON_SYNTHETIC_DATA_ONLY !== "false";
}

export function taskPermissionMatrix(taskType: ModelTaskType, provider: ModelProvider = "openai", model = "gpt-5.2") {
  const restriction = provider === "openai" && model === "gpt-5.2"
    ? GPT_52_RESTRICTIONS.find((item) => item.taskType === taskType)
    : null;
  return {
    taskType,
    provider,
    model,
    productionAllowed: false,
    evaluationAllowed: restriction?.state !== "ineligible",
    mockAllowed: true,
    offlineAllowed: true,
    restrictionState: restriction?.state ?? "evaluation",
    restrictionSource: restriction?.supportingEvaluationVersion ?? LIVE_FAILURE_DECOMPOSITION_VERSION,
    reason: restriction?.reason ?? "Task class has insufficient live evidence for production approval.",
  };
}

export function restrictionRejectReason(restriction: ModelTaskRestriction, request: ModelTaskRequest, env: NodeJS.ProcessEnv = process.env) {
  if (restriction.state === "ineligible") return `model task restriction: ${restriction.reason}`;
  const executionMode = modelExecutionMode(request, env);
  const evaluationMode = executionMode === "INTERNAL_EVALUATION" || executionMode === "OFFLINE_TEST" || executionMode === "MOCK";
  if (restriction.state === "restricted") {
    return evaluationMode ? null : `model task restriction: ${restriction.reason}`;
  }
  if (restriction.state === "evaluation-with-mandatory-review" && (!evaluationMode || request.inputPayload.humanReviewRequired !== true)) {
    return `model task restriction: mandatory human review required; ${restriction.reason}`;
  }
  if (restriction.state === "evaluation" && executionMode === "PRODUCTION") {
    return `model task restriction: evaluation-only model cannot serve approved production tasks; ${restriction.reason}`;
  }
  return null;
}

export function evaluationEligibilityRejectReason(model: ModelRecord, request: ModelTaskRequest, env: NodeJS.ProcessEnv = process.env) {
  const executionMode = modelExecutionMode(request, env);
  if (executionMode !== "INTERNAL_EVALUATION") return null;
  const restriction = getModelTaskRestriction(model, request);
  if (restriction?.state === "ineligible") return `TASK_NOT_ELIGIBLE_FOR_EVALUATION: ${restriction.reason}`;
  if (!isApprovedStageAEvaluationRequest(model, request, env)) {
    return "TASK_NOT_ELIGIBLE_FOR_EVALUATION: internal evaluation override requires approved Stage-A manifest, synthetic data, exact fixture, provider, model, v3 prompt/scorer, no fallback and mandatory review.";
  }
  return null;
}
