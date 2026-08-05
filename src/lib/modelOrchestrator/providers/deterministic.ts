import { auditReference } from "../audit.ts";
import type { ModelAdapterEstimate, ModelProviderAdapter, ModelRecord, ModelTaskRequest, ModelTaskResult, PromptEnvelope, ProviderHealthStatus } from "../types.ts";

function nowIso() {
  return new Date().toISOString();
}

export const deterministicAdapter: ModelProviderAdapter = {
  provider: "deterministic",
  async healthCheck(): Promise<ProviderHealthStatus> {
    return "healthy";
  },
  async estimate(): Promise<ModelAdapterEstimate> {
    return { estimatedCost: 0, estimatedLatencyMs: 25, estimatedTokens: 0 };
  },
  async execute(request: ModelTaskRequest, model: ModelRecord, prompt: PromptEnvelope): Promise<ModelTaskResult> {
    const started = nowIso();
    const output = {
      taskType: request.taskType,
      deterministicOutputs: prompt.deterministicOutputs,
      evidenceIds: request.evidenceReferences,
      status: "deterministic-result",
    };
    const completed = nowIso();
    return {
      taskId: request.taskId,
      runId: `deterministic-${request.taskId}`,
      provider: "deterministic",
      model: model.model,
      modelVersionOrAlias: model.model,
      status: "succeeded",
      structuredOutput: output,
      displayText: "Deterministic Vireon engine output was returned without using an LLM.",
      evidenceUsed: request.evidenceReferences,
      evidenceMissing: [],
      assumptions: Array.isArray(request.inputPayload.assumptions) ? request.inputPayload.assumptions.map(String) : [],
      confidence: 1,
      classification: ["deterministic", "calculated"],
      professionalReviewRequired: request.professionalReviewRequired,
      deterministicResultsReferenced: Object.keys(prompt.deterministicOutputs),
      validationResults: [],
      fallbackHistory: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      estimatedCost: 0,
      latencyMs: new Date(completed).getTime() - new Date(started).getTime(),
      startedAt: started,
      completedAt: completed,
      correlationId: request.correlationId,
      auditReference: auditReference(`deterministic-${request.taskId}`),
      errorCode: null,
    };
  },
  normalizeResult(raw: unknown, _request: ModelTaskRequest, _model: ModelRecord): ModelTaskResult {
    void _request;
    void _model;
    return raw as ModelTaskResult;
  },
  classifyError(): NonNullable<ModelTaskResult["errorCode"]> {
    return "DETERMINISTIC_ENGINE_FAILED";
  },
  supports(model: ModelRecord, capability) {
    return capability === "deterministic-engine" || capability === "structured-output" || capability === "reasoning" ? model.provider === "deterministic" : false;
  },
};
