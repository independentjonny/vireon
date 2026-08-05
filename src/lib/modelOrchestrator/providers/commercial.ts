import { auditReference } from "../audit.ts";
import type { ModelAdapterEstimate, ModelErrorCode, ModelProvider, ModelProviderAdapter, ModelRecord, ModelTaskRequest, ModelTaskResult, PromptEnvelope, ProviderHealthStatus } from "../types.ts";

function nowIso() {
  return new Date().toISOString();
}

function envKey(provider: ModelProvider) {
  if (provider === "openai") return "VIREON_OPENAI_API_KEY";
  if (provider === "anthropic") return "VIREON_ANTHROPIC_API_KEY";
  if (provider === "gemini") return "VIREON_GEMINI_API_KEY";
  return "";
}

function genericEnvKey(provider: ModelProvider) {
  if (provider === "openai") return "OPENAI_API_KEY";
  if (provider === "anthropic") return "ANTHROPIC_API_KEY";
  if (provider === "gemini") return "GEMINI_API_KEY";
  return "";
}

function apiKeyFor(provider: ModelProvider, env: NodeJS.ProcessEnv) {
  return env[envKey(provider)] ?? env[genericEnvKey(provider)];
}

function estimateTokens(request: ModelTaskRequest, prompt?: PromptEnvelope) {
  return Math.ceil(JSON.stringify(prompt ?? request.inputPayload).length / 4);
}

function pricing(provider: ModelProvider, env: NodeJS.ProcessEnv = process.env) {
  const prefix = provider === "openai" ? "VIREON_OPENAI" : provider === "anthropic" ? "VIREON_ANTHROPIC" : "VIREON_GEMINI";
  return {
    inputPerMillion: Number(env[`${prefix}_INPUT_COST_PER_1M`] ?? env.VIREON_MODEL_INPUT_COST_PER_1M ?? 1),
    outputPerMillion: Number(env[`${prefix}_OUTPUT_COST_PER_1M`] ?? env.VIREON_MODEL_OUTPUT_COST_PER_1M ?? 4),
  };
}

function costFromTokens(provider: ModelProvider, inputTokens: number, outputTokens: number) {
  const configured = pricing(provider);
  return Number((((inputTokens / 1_000_000) * configured.inputPerMillion) + ((outputTokens / 1_000_000) * configured.outputPerMillion)).toFixed(6));
}

function safeError(status: number, fallback: ModelErrorCode): ModelErrorCode {
  if (status === 401 || status === 403) return "PROVIDER_NOT_CONFIGURED";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 400) return "INVALID_STRUCTURED_OUTPUT";
  if (status >= 500) return "MODEL_NOT_AVAILABLE";
  return fallback;
}

function extractOpenAiText(raw: Record<string, unknown>) {
  if (typeof raw.output_text === "string") return raw.output_text;
  const output = Array.isArray(raw.output) ? raw.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const text = (contentItem as { text?: unknown }).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("\n");
}

function extractAnthropicText(raw: Record<string, unknown>) {
  const content = Array.isArray(raw.content) ? raw.content : [];
  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const text = (item as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractGeminiText(raw: Record<string, unknown>) {
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  const parts: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as { content?: unknown }).content;
    const contentParts = content && typeof content === "object" && Array.isArray((content as { parts?: unknown }).parts)
      ? (content as { parts: unknown[] }).parts
      : [];
    for (const part of contentParts) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("\n");
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function errorResult(input: { request: ModelTaskRequest; provider: ModelProvider; model: ModelRecord; startedAt: string; errorCode: ModelErrorCode; message: string }): ModelTaskResult {
  const completedAt = nowIso();
  return {
    taskId: input.request.taskId,
    runId: `${input.provider}-failed-${input.request.taskId}`,
    provider: input.provider,
    model: input.model.model,
    modelVersionOrAlias: input.model.model,
    status: input.errorCode === "PROVIDER_NOT_CONFIGURED" ? "provider-unavailable" : input.errorCode === "TIMEOUT" ? "failed" : "failed",
    structuredOutput: null,
    displayText: input.message,
    evidenceUsed: [],
    evidenceMissing: input.request.evidenceReferences,
    assumptions: [],
    confidence: 0,
    classification: ["speculative"],
    professionalReviewRequired: input.request.professionalReviewRequired,
    deterministicResultsReferenced: [],
    validationResults: [{ name: "provider", passed: false, detail: input.message }],
    fallbackHistory: [],
    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    estimatedCost: 0,
    latencyMs: new Date(completedAt).getTime() - new Date(input.startedAt).getTime(),
    startedAt: input.startedAt,
    completedAt,
    correlationId: input.request.correlationId,
    auditReference: auditReference(`${input.provider}-failed-${input.request.taskId}`),
    errorCode: input.errorCode,
  };
}

function normalizeOpenAiResult(raw: unknown, request: ModelTaskRequest, model: ModelRecord): ModelTaskResult {
  const startedAt = nowIso();
  const completedAt = nowIso();
  const objectRaw = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const text = extractOpenAiText(objectRaw);
  const structuredOutput = request.outputSchema ? parseJson(text) : { summary: text, evidenceIds: request.evidenceReferences };
  const usage = objectRaw.usage && typeof objectRaw.usage === "object" ? objectRaw.usage as Record<string, unknown> : {};
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? estimateTokens(request));
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? Math.ceil(text.length / 4));
  const classification = request.professionalReviewRequired ? ["evidence-backed", "professional-review-required"] as const : ["evidence-backed"] as const;
  const evidenceIds = structuredOutput && Array.isArray(structuredOutput.evidenceIds) ? structuredOutput.evidenceIds.map(String) : request.evidenceReferences;
  return {
    taskId: request.taskId,
    runId: `openai-${request.taskId}`,
    provider: "openai",
    model: model.model,
    modelVersionOrAlias: model.model,
    status: structuredOutput ? "succeeded" : "validation-failed",
    structuredOutput,
    displayText: text || "OpenAI response did not include display text.",
    evidenceUsed: evidenceIds.filter((id) => request.evidenceReferences.includes(id)),
    evidenceMissing: request.evidenceReferences.filter((id) => !evidenceIds.includes(id)),
    assumptions: Array.isArray(request.inputPayload.assumptions) ? request.inputPayload.assumptions.map(String) : [],
    confidence: typeof structuredOutput?.confidence === "number" ? structuredOutput.confidence : Math.max(request.minimumConfidence, 0.6),
    classification: structuredOutput && Array.isArray(structuredOutput.classification) ? structuredOutput.classification.filter((item): item is ModelTaskResult["classification"][number] => typeof item === "string" && ["deterministic", "calculated", "evidence-backed", "estimated", "speculative", "professional-review-required"].includes(item)) : [...classification],
    professionalReviewRequired: request.professionalReviewRequired || Boolean(structuredOutput && Array.isArray(structuredOutput.classification) && structuredOutput.classification.includes("professional-review-required")),
    deterministicResultsReferenced: Object.keys((request.inputPayload.deterministicOutputs ?? {}) as Record<string, unknown>),
    validationResults: [],
    fallbackHistory: [],
    tokenUsage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
    estimatedCost: costFromTokens("openai", inputTokens, outputTokens),
    latencyMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    startedAt,
    completedAt,
    correlationId: request.correlationId,
    auditReference: auditReference(`openai-${request.taskId}`),
    errorCode: structuredOutput ? null : "INVALID_STRUCTURED_OUTPUT",
  };
}

function normalizeAnthropicResult(raw: unknown, request: ModelTaskRequest, model: ModelRecord): ModelTaskResult {
  const startedAt = nowIso();
  const completedAt = nowIso();
  const objectRaw = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const text = extractAnthropicText(objectRaw);
  const structuredOutput = request.outputSchema ? parseJson(text) : { summary: text, evidenceIds: request.evidenceReferences };
  const usage = objectRaw.usage && typeof objectRaw.usage === "object" ? objectRaw.usage as Record<string, unknown> : {};
  const inputTokens = Number(usage.input_tokens ?? estimateTokens(request));
  const outputTokens = Number(usage.output_tokens ?? Math.ceil(text.length / 4));
  const evidenceIds = structuredOutput && Array.isArray(structuredOutput.evidenceIds) ? structuredOutput.evidenceIds.map(String) : request.evidenceReferences;
  return {
    taskId: request.taskId,
    runId: `anthropic-${request.taskId}`,
    provider: "anthropic",
    model: model.model,
    modelVersionOrAlias: model.model,
    status: structuredOutput ? "succeeded" : "validation-failed",
    structuredOutput,
    displayText: text || "Anthropic response did not include display text.",
    evidenceUsed: evidenceIds.filter((id) => request.evidenceReferences.includes(id)),
    evidenceMissing: request.evidenceReferences.filter((id) => !evidenceIds.includes(id)),
    assumptions: Array.isArray(request.inputPayload.assumptions) ? request.inputPayload.assumptions.map(String) : [],
    confidence: typeof structuredOutput?.confidence === "number" ? structuredOutput.confidence : Math.max(request.minimumConfidence, 0.6),
    classification: structuredOutput && Array.isArray(structuredOutput.classification) ? structuredOutput.classification.filter((item): item is ModelTaskResult["classification"][number] => typeof item === "string" && ["deterministic", "calculated", "evidence-backed", "estimated", "speculative", "professional-review-required"].includes(item)) : ["evidence-backed"],
    professionalReviewRequired: request.professionalReviewRequired || Boolean(structuredOutput && Array.isArray(structuredOutput.classification) && structuredOutput.classification.includes("professional-review-required")),
    deterministicResultsReferenced: Object.keys((request.inputPayload.deterministicOutputs ?? {}) as Record<string, unknown>),
    validationResults: [],
    fallbackHistory: [],
    tokenUsage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
    estimatedCost: costFromTokens("anthropic", inputTokens, outputTokens),
    latencyMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    startedAt,
    completedAt,
    correlationId: request.correlationId,
    auditReference: auditReference(`anthropic-${request.taskId}`),
    errorCode: structuredOutput ? null : "INVALID_STRUCTURED_OUTPUT",
  };
}

function normalizeGeminiResult(raw: unknown, request: ModelTaskRequest, model: ModelRecord): ModelTaskResult {
  const startedAt = nowIso();
  const completedAt = nowIso();
  const objectRaw = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const text = extractGeminiText(objectRaw);
  const structuredOutput = request.outputSchema ? parseJson(text) : { summary: text, evidenceIds: request.evidenceReferences };
  const usage = objectRaw.usageMetadata && typeof objectRaw.usageMetadata === "object" ? objectRaw.usageMetadata as Record<string, unknown> : {};
  const inputTokens = Number(usage.promptTokenCount ?? estimateTokens(request));
  const outputTokens = Number(usage.candidatesTokenCount ?? Math.ceil(text.length / 4));
  const evidenceIds = structuredOutput && Array.isArray(structuredOutput.evidenceIds) ? structuredOutput.evidenceIds.map(String) : request.evidenceReferences;
  return {
    taskId: request.taskId,
    runId: `gemini-${request.taskId}`,
    provider: "gemini",
    model: model.model,
    modelVersionOrAlias: model.model,
    status: structuredOutput ? "succeeded" : "validation-failed",
    structuredOutput,
    displayText: text || "Gemini response did not include display text.",
    evidenceUsed: evidenceIds.filter((id) => request.evidenceReferences.includes(id)),
    evidenceMissing: request.evidenceReferences.filter((id) => !evidenceIds.includes(id)),
    assumptions: Array.isArray(request.inputPayload.assumptions) ? request.inputPayload.assumptions.map(String) : [],
    confidence: typeof structuredOutput?.confidence === "number" ? structuredOutput.confidence : Math.max(request.minimumConfidence, 0.6),
    classification: structuredOutput && Array.isArray(structuredOutput.classification) ? structuredOutput.classification.filter((item): item is ModelTaskResult["classification"][number] => typeof item === "string" && ["deterministic", "calculated", "evidence-backed", "estimated", "speculative", "professional-review-required"].includes(item)) : ["evidence-backed"],
    professionalReviewRequired: request.professionalReviewRequired || Boolean(structuredOutput && Array.isArray(structuredOutput.classification) && structuredOutput.classification.includes("professional-review-required")),
    deterministicResultsReferenced: Object.keys((request.inputPayload.deterministicOutputs ?? {}) as Record<string, unknown>),
    validationResults: [],
    fallbackHistory: [],
    tokenUsage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
    estimatedCost: costFromTokens("gemini", inputTokens, outputTokens),
    latencyMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    startedAt,
    completedAt,
    correlationId: request.correlationId,
    auditReference: auditReference(`gemini-${request.taskId}`),
    errorCode: structuredOutput ? null : "INVALID_STRUCTURED_OUTPUT",
  };
}

export function createOpenAiAdapter(env: NodeJS.ProcessEnv = process.env): ModelProviderAdapter {
  return {
    provider: "openai",
    async healthCheck(): Promise<ProviderHealthStatus> {
      const model = env.VIREON_OPENAI_DEFAULT_MODEL;
      const apiKey = apiKeyFor("openai", env);
      if (env.VIREON_OPENAI_ENABLED !== "true" || !apiKey || !model) return "disabled";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(env.VIREON_LIVE_MODEL_HEALTH_TIMEOUT_MS ?? 10000));
      try {
        const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        return response.ok ? "healthy" : response.status === 429 || response.status >= 500 ? "degraded" : "unhealthy";
      } catch {
        return "unhealthy";
      } finally {
        clearTimeout(timeout);
      }
    },
    async estimate(request, model): Promise<ModelAdapterEstimate> {
      const inputTokens = estimateTokens(request);
      const outputTokens = Math.min(model.maximumOutputTokens, Number(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 800));
      return {
        estimatedCost: costFromTokens("openai", inputTokens, outputTokens),
        estimatedLatencyMs: model.relativeLatencyClass === "fast" ? 1200 : 4500,
        estimatedTokens: inputTokens + outputTokens,
      };
    },
    async execute(request, model, prompt): Promise<ModelTaskResult> {
      const startedAt = nowIso();
      const apiKey = apiKeyFor("openai", env);
      if (!apiKey) return errorResult({ request, provider: "openai", model, startedAt, errorCode: "PROVIDER_NOT_CONFIGURED", message: "OpenAI provider is not configured." });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(env.VIREON_LIVE_MODEL_TIMEOUT_MS ?? 30000));
      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: model.model,
            input: [
              { role: "system", content: prompt.systemPolicy },
              { role: "user", content: JSON.stringify({ task: prompt.taskInstruction, goal: prompt.userGoal, context: prompt.relevantFinancialContext, deterministicOutputs: prompt.deterministicOutputs, evidence: prompt.evidence, rules: prompt.rulesAndProvenance, missing: prompt.missingInformation, prohibited: prompt.prohibitedBehaviours }) },
            ],
            max_output_tokens: Math.min(model.maximumOutputTokens, Number(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 800)),
            text: request.outputSchema ? { format: { type: "json_schema", name: "vireon_evaluation_output", strict: false, schema: request.outputSchema } } : undefined,
          }),
        });
        if (!response.ok) {
          return errorResult({ request, provider: "openai", model, startedAt, errorCode: safeError(response.status, "MODEL_NOT_AVAILABLE"), message: `OpenAI request failed with safe status ${response.status}.` });
        }
        return { ...normalizeOpenAiResult(await response.json(), request, model), startedAt, latencyMs: Date.now() - new Date(startedAt).getTime() };
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return errorResult({ request, provider: "openai", model, startedAt, errorCode: aborted ? "TIMEOUT" : "MODEL_NOT_AVAILABLE", message: aborted ? "OpenAI request timed out." : "OpenAI provider request failed safely." });
      } finally {
        clearTimeout(timeout);
      }
    },
    async cancel() {
      return false;
    },
    normalizeResult: normalizeOpenAiResult,
    classifyError(error): ModelErrorCode {
      if (error instanceof Error && error.name === "AbortError") return "TIMEOUT";
      return "MODEL_NOT_AVAILABLE";
    },
    supports(model, capability) {
      if (capability === "vision") return model.supportsVision;
      if (capability === "documents") return model.supportsDocuments;
      if (capability === "structured-output") return model.supportsStructuredOutput;
      if (capability === "tool-calling") return model.supportsToolCalling;
      if (capability === "long-context") return model.supportsLongContext;
      if (capability === "reasoning") return model.supportsReasoning;
      return capability === "text" ? model.supportsText : false;
    },
  };
}

export function createAnthropicAdapter(env: NodeJS.ProcessEnv = process.env): ModelProviderAdapter {
  return {
    provider: "anthropic",
    async healthCheck(): Promise<ProviderHealthStatus> {
      const model = env.VIREON_ANTHROPIC_DEFAULT_MODEL;
      const apiKey = apiKeyFor("anthropic", env);
      if (env.VIREON_ANTHROPIC_ENABLED !== "true" || !apiKey || !model) return "disabled";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(env.VIREON_LIVE_MODEL_HEALTH_TIMEOUT_MS ?? 10000));
      try {
        const response = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, {
          headers: { "x-api-key": apiKey, "anthropic-version": env.VIREON_ANTHROPIC_VERSION ?? "2023-06-01" },
          signal: controller.signal,
        });
        return response.ok ? "healthy" : response.status === 429 || response.status >= 500 ? "degraded" : "unhealthy";
      } catch {
        return "unhealthy";
      } finally {
        clearTimeout(timeout);
      }
    },
    async estimate(request, model): Promise<ModelAdapterEstimate> {
      const inputTokens = estimateTokens(request);
      const outputTokens = Math.min(model.maximumOutputTokens, Number(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 800));
      return { estimatedCost: costFromTokens("anthropic", inputTokens, outputTokens), estimatedLatencyMs: 4500, estimatedTokens: inputTokens + outputTokens };
    },
    async execute(request, model, prompt): Promise<ModelTaskResult> {
      const startedAt = nowIso();
      const apiKey = apiKeyFor("anthropic", env);
      if (!apiKey) return errorResult({ request, provider: "anthropic", model, startedAt, errorCode: "PROVIDER_NOT_CONFIGURED", message: "Anthropic provider is not configured." });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(env.VIREON_LIVE_MODEL_TIMEOUT_MS ?? 30000));
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": env.VIREON_ANTHROPIC_VERSION ?? "2023-06-01",
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: model.model,
            max_tokens: Math.min(model.maximumOutputTokens, Number(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 800)),
            system: prompt.systemPolicy,
            messages: [{ role: "user", content: JSON.stringify({ task: prompt.taskInstruction, goal: prompt.userGoal, context: prompt.relevantFinancialContext, deterministicOutputs: prompt.deterministicOutputs, evidence: prompt.evidence, rules: prompt.rulesAndProvenance, missing: prompt.missingInformation, prohibited: prompt.prohibitedBehaviours, outputSchema: prompt.outputSchema }) }],
            output_config: request.outputSchema ? { format: { type: "json_schema", schema: request.outputSchema } } : undefined,
          }),
        });
        if (!response.ok) return errorResult({ request, provider: "anthropic", model, startedAt, errorCode: safeError(response.status, "MODEL_NOT_AVAILABLE"), message: `Anthropic request failed with safe status ${response.status}.` });
        return { ...normalizeAnthropicResult(await response.json(), request, model), startedAt, latencyMs: Date.now() - new Date(startedAt).getTime() };
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return errorResult({ request, provider: "anthropic", model, startedAt, errorCode: aborted ? "TIMEOUT" : "MODEL_NOT_AVAILABLE", message: aborted ? "Anthropic request timed out." : "Anthropic provider request failed safely." });
      } finally {
        clearTimeout(timeout);
      }
    },
    async cancel() {
      return false;
    },
    normalizeResult: normalizeAnthropicResult,
    classifyError(error): ModelErrorCode {
      if (error instanceof Error && error.name === "AbortError") return "TIMEOUT";
      return "MODEL_NOT_AVAILABLE";
    },
    supports(model, capability) {
      if (capability === "vision") return model.supportsVision;
      if (capability === "documents") return model.supportsDocuments;
      if (capability === "structured-output") return model.supportsStructuredOutput;
      if (capability === "tool-calling") return model.supportsToolCalling;
      if (capability === "long-context") return model.supportsLongContext;
      if (capability === "reasoning") return model.supportsReasoning;
      return capability === "text" ? model.supportsText : false;
    },
  };
}

export function createGeminiAdapter(env: NodeJS.ProcessEnv = process.env): ModelProviderAdapter {
  return {
    provider: "gemini",
    async healthCheck(): Promise<ProviderHealthStatus> {
      const model = env.VIREON_GEMINI_DEFAULT_MODEL ?? env.VIREON_GEMINI_VISION_MODEL;
      const apiKey = apiKeyFor("gemini", env);
      if (env.VIREON_GEMINI_ENABLED !== "true" || !apiKey || !model) return "disabled";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(env.VIREON_LIVE_MODEL_HEALTH_TIMEOUT_MS ?? 10000));
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`, { signal: controller.signal });
        return response.ok ? "healthy" : response.status === 429 || response.status >= 500 ? "degraded" : "unhealthy";
      } catch {
        return "unhealthy";
      } finally {
        clearTimeout(timeout);
      }
    },
    async estimate(request, model): Promise<ModelAdapterEstimate> {
      const inputTokens = estimateTokens(request);
      const outputTokens = Math.min(model.maximumOutputTokens, Number(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 800));
      return { estimatedCost: costFromTokens("gemini", inputTokens, outputTokens), estimatedLatencyMs: 4500, estimatedTokens: inputTokens + outputTokens };
    },
    async execute(request, model, prompt): Promise<ModelTaskResult> {
      const startedAt = nowIso();
      const apiKey = apiKeyFor("gemini", env);
      if (!apiKey) return errorResult({ request, provider: "gemini", model, startedAt, errorCode: "PROVIDER_NOT_CONFIGURED", message: "Gemini provider is not configured." });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(env.VIREON_LIVE_MODEL_TIMEOUT_MS ?? 30000));
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt.systemPolicy }] },
            contents: [{ role: "user", parts: [{ text: JSON.stringify({ task: prompt.taskInstruction, goal: prompt.userGoal, context: prompt.relevantFinancialContext, deterministicOutputs: prompt.deterministicOutputs, evidence: prompt.evidence, rules: prompt.rulesAndProvenance, missing: prompt.missingInformation, prohibited: prompt.prohibitedBehaviours }) }] }],
            generationConfig: request.outputSchema ? {
              maxOutputTokens: Math.min(model.maximumOutputTokens, Number(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 800)),
              responseMimeType: "application/json",
              responseSchema: request.outputSchema,
            } : {
              maxOutputTokens: Math.min(model.maximumOutputTokens, Number(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 800)),
            },
          }),
        });
        if (!response.ok) return errorResult({ request, provider: "gemini", model, startedAt, errorCode: safeError(response.status, "MODEL_NOT_AVAILABLE"), message: `Gemini request failed with safe status ${response.status}.` });
        return { ...normalizeGeminiResult(await response.json(), request, model), startedAt, latencyMs: Date.now() - new Date(startedAt).getTime() };
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return errorResult({ request, provider: "gemini", model, startedAt, errorCode: aborted ? "TIMEOUT" : "MODEL_NOT_AVAILABLE", message: aborted ? "Gemini request timed out." : "Gemini provider request failed safely." });
      } finally {
        clearTimeout(timeout);
      }
    },
    async cancel() {
      return false;
    },
    normalizeResult: normalizeGeminiResult,
    classifyError(error): ModelErrorCode {
      if (error instanceof Error && error.name === "AbortError") return "TIMEOUT";
      return "MODEL_NOT_AVAILABLE";
    },
    supports(model, capability) {
      if (capability === "vision") return model.supportsVision;
      if (capability === "documents") return model.supportsDocuments;
      if (capability === "structured-output") return model.supportsStructuredOutput;
      if (capability === "tool-calling") return model.supportsToolCalling;
      if (capability === "long-context") return model.supportsLongContext;
      if (capability === "reasoning") return model.supportsReasoning;
      return capability === "text" ? model.supportsText : false;
    },
  };
}
