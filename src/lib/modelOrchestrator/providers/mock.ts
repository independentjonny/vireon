import { auditReference } from "../audit.ts";
import { deterministicAdapter } from "./deterministic.ts";
import { anthropicAdapter } from "./anthropic.ts";
import { createDisabledAdapter } from "./disabled.ts";
import { geminiAdapter } from "./gemini.ts";
import { openAiAdapter } from "./openai.ts";
import type { ModelAdapterEstimate, ModelProvider, ModelProviderAdapter, ModelRecord, ModelTaskRequest, ModelTaskResult, PromptEnvelope, ProviderHealthStatus } from "../types.ts";

function nowIso() {
  return new Date().toISOString();
}

export const mockAdapter: ModelProviderAdapter = {
  provider: "mock",
  async healthCheck(): Promise<ProviderHealthStatus> {
    return "healthy";
  },
  async estimate(request: ModelTaskRequest): Promise<ModelAdapterEstimate> {
    return { estimatedCost: 0, estimatedLatencyMs: 20, estimatedTokens: Math.ceil(JSON.stringify(request.inputPayload).length / 4) };
  },
  async execute(request: ModelTaskRequest, model: ModelRecord, prompt: PromptEnvelope): Promise<ModelTaskResult> {
    const started = nowIso();
    const structuredOutput = request.outputSchema
      ? Object.fromEntries(Object.entries(request.outputSchema.properties).map(([key, spec]) => {
          if (key.toLowerCase().includes("evidence")) return [key, request.evidenceReferences];
          if (key.toLowerCase().includes("classification")) return [key, request.professionalReviewRequired ? ["professional-review-required", "evidence-backed"] : ["evidence-backed"]];
          if (key.toLowerCase().includes("confidence")) return [key, Math.max(request.minimumConfidence, 0.72)];
          if (spec.type === "boolean") return [key, request.professionalReviewRequired];
          if (spec.type === "number") return [key, 1];
          if (spec.type === "array") return [key, []];
          if (spec.type === "object") return [key, {}];
          return [key, `Mock ${request.taskType} output`];
        }))
      : { summary: `Mock response for ${request.taskType}`, evidenceIds: request.evidenceReferences };
    const completed = nowIso();
    return {
      taskId: request.taskId,
      runId: `mock-${request.taskId}`,
      provider: "mock",
      model: model.model,
      modelVersionOrAlias: model.model,
      status: "succeeded",
      structuredOutput,
      displayText: `Mock provider generated a policy-safe ${request.taskType} response.`,
      evidenceUsed: request.evidenceReferences,
      evidenceMissing: [],
      assumptions: Array.isArray(request.inputPayload.assumptions) ? request.inputPayload.assumptions.map(String) : [],
      confidence: Math.max(request.minimumConfidence, 0.72),
      classification: request.professionalReviewRequired ? ["evidence-backed", "professional-review-required"] : ["evidence-backed"],
      professionalReviewRequired: request.professionalReviewRequired,
      deterministicResultsReferenced: Object.keys(prompt.deterministicOutputs),
      validationResults: [],
      fallbackHistory: [],
      tokenUsage: { inputTokens: Math.ceil(JSON.stringify(prompt).length / 4), outputTokens: 80, totalTokens: Math.ceil(JSON.stringify(prompt).length / 4) + 80 },
      estimatedCost: 0,
      latencyMs: new Date(completed).getTime() - new Date(started).getTime(),
      startedAt: started,
      completedAt: completed,
      correlationId: request.correlationId,
      auditReference: auditReference(`mock-${request.taskId}`),
      errorCode: null,
    };
  },
  normalizeResult(raw: unknown) {
    return raw as ModelTaskResult;
  },
  classifyError(): NonNullable<ModelTaskResult["errorCode"]> {
    return "INTERNAL_ORCHESTRATOR_ERROR";
  },
  supports(model: ModelRecord, capability) {
    if (capability === "vision") return model.supportsVision;
    if (capability === "documents") return model.supportsDocuments;
    if (capability === "structured-output") return model.supportsStructuredOutput;
    if (capability === "tool-calling") return model.supportsToolCalling;
    if (capability === "long-context") return model.supportsLongContext;
    if (capability === "reasoning") return model.supportsReasoning;
    return model.supportsText;
  },
};

export function getAdapterForProvider(provider: ModelProvider): ModelProviderAdapter {
  if (provider === "deterministic") return deterministicAdapter;
  if (provider === "mock") return mockAdapter;
  if (provider === "openai") return openAiAdapter;
  if (provider === "anthropic") return anthropicAdapter;
  if (provider === "gemini") return geminiAdapter;
  return createDisabledAdapter(provider);
}
