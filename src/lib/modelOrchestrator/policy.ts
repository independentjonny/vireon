import type { DataSensitivity, ModelRecord, ModelTaskRequest, OutputClassification } from "./types.ts";
import { evaluationEligibilityRejectReason, getModelTaskRestriction, modelExecutionMode, restrictionRejectReason } from "./taskRestrictions.ts";

export const MODEL_POLICY_VERSION = "model-routing-policy-v1";

const sensitivityRank: Record<DataSensitivity, number> = {
  public: 1,
  internal: 2,
  personal: 3,
  "financial-sensitive": 4,
  "identity-sensitive": 5,
  "highly-restricted": 6,
};

export function sensitivityAtLeast(actual: DataSensitivity, required: DataSensitivity) {
  return sensitivityRank[actual] >= sensitivityRank[required];
}

export function isProviderEligibleForSensitivity(model: ModelRecord, sensitivity: DataSensitivity) {
  return model.approvedSensitivityLevels.includes(sensitivity);
}

export function classifyTaskRisk(request: ModelTaskRequest): OutputClassification[] {
  const classifications: OutputClassification[] = [];
  if (request.deterministicEngineRequired || request.taskType === "deterministic-calculation") classifications.push("deterministic", "calculated");
  if (request.evidenceReferences.length > 0) classifications.push("evidence-backed");
  if (request.inputPayload.assumptions) classifications.push("estimated");
  if (request.professionalReviewRequired || request.riskLevel === "critical") classifications.push("professional-review-required");
  if (classifications.length === 0) classifications.push("speculative");
  return [...new Set(classifications)];
}

export function policyRejectReasons(request: ModelTaskRequest, model: ModelRecord, env: NodeJS.ProcessEnv = process.env): string[] {
  const reasons: string[] = [];
  const executionMode = modelExecutionMode(request, env);
  const evaluationReject = evaluationEligibilityRejectReason(model, request, env);
  if (evaluationReject) reasons.push(evaluationReject);
  const restriction = getModelTaskRestriction(model, request);
  const productionStateReject = executionMode === "PRODUCTION"
    && (model.provider === "openai" || model.provider === "anthropic" || model.provider === "gemini")
    && model.promotionState !== "approved"
    && model.promotionState !== "preferred"
      ? `MODEL_RESTRICTED_PRODUCTION: promotion state is ${model.promotionState}; production approval remains separate`
      : null;
  if (productionStateReject) reasons.push(productionStateReject);
  const restrictionReason = restriction && executionMode === "PRODUCTION" ? restrictionRejectReason(restriction, request, env) : null;
  if (restrictionReason) {
    const productionCode = restriction?.state === "restricted" ? "TASK_RESTRICTED_PRODUCTION" : "MODEL_RESTRICTED_PRODUCTION";
    reasons.push(`${productionCode}: ${restrictionReason}`);
  }
  if (!model.enabled) reasons.push("PROVIDER_NOT_CONFIGURED: model disabled or provider key missing");
  if (model.availability !== "available") reasons.push(`PROVIDER_UNAVAILABLE: provider availability is ${model.availability}`);
  if (model.healthStatus !== "healthy") reasons.push(`MODEL_UNHEALTHY: health status is ${model.healthStatus}`);
  if (request.prohibitedProviders.includes(model.provider)) reasons.push("provider prohibited by request");
  if (request.permittedProviders && !request.permittedProviders.includes(model.provider)) reasons.push("provider not in permitted provider list");
  if (request.permittedModels && !request.permittedModels.includes(model.model)) reasons.push("model not in permitted model list");
  if (!model.approvedTaskTypes.includes(request.taskType)) reasons.push("task type not approved for model");
  if (!isProviderEligibleForSensitivity(model, request.sensitivity)) reasons.push("sensitivity not approved for model");
  if (request.deterministicEngineRequired && model.provider !== "deterministic") reasons.push("deterministic engine required");
  if (request.taskType === "deterministic-calculation" && model.provider !== "deterministic") reasons.push("deterministic calculations never route to LLM providers");
  if (request.outputSchema && !model.supportsStructuredOutput) reasons.push("structured output required");
  for (const capability of request.requiredCapabilities) {
    const supports = capability === "text"
      ? model.supportsText
      : capability === "vision"
      ? model.supportsVision
      : capability === "documents"
      ? model.supportsDocuments
      : capability === "structured-output"
      ? model.supportsStructuredOutput
      : capability === "tool-calling"
      ? model.supportsToolCalling
      : capability === "long-context"
      ? model.supportsLongContext
      : capability === "reasoning"
      ? model.supportsReasoning
      : capability === "streaming"
      ? model.supportsStreaming
      : capability === "batch"
      ? model.supportsBatch
      : capability === "deterministic-engine"
      ? model.provider === "deterministic"
      : false;
    if (!supports) reasons.push(`missing required capability: ${capability}`);
  }
  return reasons;
}

export function requiresIndependentReview(request: ModelTaskRequest) {
  return request.riskLevel === "critical" || (request.riskLevel === "high" && request.professionalReviewRequired);
}

export function fallbackPermitted(request: ModelTaskRequest, from: ModelRecord, to: ModelRecord, crossProviderFallback: boolean) {
  if (!request.fallbackAllowed) return { ok: false, reason: "task does not allow fallback" };
  if (request.deterministicEngineRequired || request.taskType === "deterministic-calculation") return { ok: false, reason: "deterministic calculation cannot fallback to a model" };
  if (from.provider !== to.provider && !crossProviderFallback) return { ok: false, reason: "cross-provider fallback disabled" };
  if (!isProviderEligibleForSensitivity(to, request.sensitivity)) return { ok: false, reason: "fallback would weaken sensitivity policy" };
  return { ok: true, reason: "fallback permitted" };
}
