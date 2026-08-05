import { auditReference } from "../audit.ts";
import type { ModelProvider, ModelProviderAdapter, ModelTaskResult } from "../types.ts";

function nowIso() {
  return new Date().toISOString();
}

export function createDisabledAdapter(provider: ModelProvider): ModelProviderAdapter {
  return {
    provider,
    async healthCheck() {
      return "disabled";
    },
    async estimate() {
      return { estimatedCost: 0, estimatedLatencyMs: 0, estimatedTokens: 0 };
    },
    async execute(request, model) {
      const now = nowIso();
      return {
        taskId: request.taskId,
        runId: `${provider}-disabled-${request.taskId}`,
        provider,
        model: model.model,
        modelVersionOrAlias: model.model,
        status: "provider-unavailable",
        structuredOutput: null,
        displayText: `${provider} provider is not configured in this environment.`,
        evidenceUsed: [],
        evidenceMissing: request.evidenceReferences,
        assumptions: [],
        confidence: 0,
        classification: ["speculative"],
        professionalReviewRequired: request.professionalReviewRequired,
        deterministicResultsReferenced: [],
        validationResults: [{ name: "provider", passed: false, detail: "provider not configured" }],
        fallbackHistory: [],
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        estimatedCost: 0,
        latencyMs: 0,
        startedAt: now,
        completedAt: now,
        correlationId: request.correlationId,
        auditReference: auditReference(`${provider}-disabled-${request.taskId}`),
        errorCode: "PROVIDER_NOT_CONFIGURED",
      };
    },
    normalizeResult(raw) {
      return raw as ModelTaskResult;
    },
    classifyError() {
      return "PROVIDER_NOT_CONFIGURED";
    },
    supports() {
      return false;
    },
  };
}
