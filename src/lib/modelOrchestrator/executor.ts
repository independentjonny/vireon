import { randomUUID } from "crypto";
import { auditReference, modelRunRepository } from "./audit.ts";
import { enforceBudget } from "./budget.ts";
import { buildModelRegistry } from "./registry.ts";
import { routeModelTask } from "./router.ts";
import { validateModelResult, validationPassed } from "./validator.ts";
import { getAdapterForProvider } from "./providers/mock.ts";
import type { ModelErrorCode, ModelRecord, ModelTaskRequest, ModelTaskResult, PromptEnvelope } from "./types.ts";

function nowIso() {
  return new Date().toISOString();
}

export function redactSecrets<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(/(api[_-]?key|password|token|secret)["']?\s*:\s*["'][^"']+["']/gi, "$1\":\"<redacted>\"")) as T;
}

export function estimatePromptSize(envelope: PromptEnvelope) {
  return Math.ceil(JSON.stringify(envelope).length / 4);
}

export function trimPromptEnvelope(envelope: PromptEnvelope, maxTokens: number): PromptEnvelope {
  const trimmed = { ...envelope, relevantFinancialContext: redactSecrets(envelope.relevantFinancialContext) };
  while (estimatePromptSize(trimmed) > maxTokens && trimmed.evidence.length > 0) {
    trimmed.evidence = trimmed.evidence.slice(0, -1);
  }
  while (estimatePromptSize(trimmed) > maxTokens && trimmed.rulesAndProvenance.length > 0) {
    trimmed.rulesAndProvenance = trimmed.rulesAndProvenance.slice(0, -1);
  }
  return trimmed;
}

export function buildPromptEnvelope(request: ModelTaskRequest): PromptEnvelope {
  return {
    systemPolicy: "You are Vireon's model worker. Use only supplied context. Do not modify verified financial records, deterministic calculations, audit history, timeline history or realised impact.",
    taskInstruction: request.purpose,
    userGoal: String(request.inputPayload.userGoal ?? request.purpose),
    relevantFinancialContext: redactSecrets((request.inputPayload.context ?? {}) as Record<string, unknown>),
    deterministicOutputs: redactSecrets((request.inputPayload.deterministicOutputs ?? {}) as Record<string, unknown>),
    evidence: request.evidenceReferences,
    rulesAndProvenance: Array.isArray(request.inputPayload.rules) ? request.inputPayload.rules.map(String) : [],
    missingInformation: Array.isArray(request.inputPayload.missingInformation) ? request.inputPayload.missingInformation.map(String) : [],
    permittedTools: ["read-only", "deterministic-calculation", "document-preparation"],
    prohibitedBehaviours: [
      "do not invent facts",
      "do not calculate tax, borrowing, retirement or net worth in the model",
      "do not execute external communication",
      "do not mark evidence verified",
      "do not alter deterministic outputs",
    ],
    outputSchema: request.outputSchema,
    confidenceRequirements: [
      `minimum confidence ${request.minimumConfidence}`,
      request.professionalReviewRequired ? "professional review required" : "professional review not required unless risk is identified",
      typeof request.inputPayload.evaluationPromptVersion === "string" ? `evaluation prompt ${request.inputPayload.evaluationPromptVersion}` : "",
      ...(Array.isArray(request.inputPayload.remediationInstructions) ? request.inputPayload.remediationInstructions.map(String) : []),
    ].filter(Boolean),
  };
}

function blockedResult(request: ModelTaskRequest, errorCode: ModelTaskResult["errorCode"], detail: string): ModelTaskResult {
  const now = nowIso();
  return {
    taskId: request.taskId,
    runId: `model-run-blocked-${randomUUID()}`,
    provider: "disabled",
    model: "none",
    modelVersionOrAlias: "none",
    status: errorCode === "BUDGET_EXCEEDED" ? "budget-blocked" : "blocked",
    structuredOutput: null,
    displayText: detail,
    evidenceUsed: [],
    evidenceMissing: request.evidenceReferences,
    assumptions: [],
    confidence: 0,
    classification: request.deterministicEngineRequired ? ["deterministic"] : ["speculative"],
    professionalReviewRequired: request.professionalReviewRequired,
    deterministicResultsReferenced: [],
    validationResults: [{ name: "blocked", passed: false, detail }],
    fallbackHistory: [],
    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    estimatedCost: 0,
    latencyMs: 0,
    startedAt: now,
    completedAt: now,
    correlationId: request.correlationId,
    auditReference: "model-audit:block",
    errorCode,
  };
}

function blockedErrorCodeFromRoutingReasons(reasons: string[], request: ModelTaskRequest): ModelErrorCode {
  const text = reasons.join(" ");
  if (request.executionMode === "INTERNAL_EVALUATION" && !request.inputPayload.stageACandidateId) return "CANDIDATE_CONTEXT_MISSING";
  if (request.executionMode === "INTERNAL_EVALUATION" && text.includes("PROVIDER_NOT_CONFIGURED") && request.inputPayload.stageACandidateId) return "CANDIDATE_CONTEXT_MISSING";
  const ordered: ModelErrorCode[] = [
    "MODEL_NOT_REGISTERED",
    "MODEL_UNHEALTHY",
    "MODEL_RESTRICTED_PRODUCTION",
    "MODEL_NOT_ELIGIBLE_FOR_EVALUATION",
    "EXECUTION_ENVELOPE_MISMATCH",
    "CHILD_PROCESS_CONFIGURATION_MISMATCH",
    "CANDIDATE_CONTEXT_MISSING",
    "EVALUATION_ENVIRONMENT_MISSING",
    "TASK_RESTRICTED_PRODUCTION",
    "TASK_NOT_ELIGIBLE_FOR_EVALUATION",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_NOT_CONFIGURED",
    "SENSITIVITY_BLOCKED",
    "CAPABILITY_UNAVAILABLE",
    "POLICY_BLOCKED",
  ];
  const match = ordered.find((code) => text.includes(code));
  if (match) return match;
  if (text.includes("cost") || text.includes("budget")) return "BUDGET_EXCEEDED";
  return "MODEL_NOT_AVAILABLE";
}

export async function executeModelTask(request: ModelTaskRequest, registry: ModelRecord[] = buildModelRegistry()): Promise<ModelTaskResult> {
  const routing = routeModelTask(request, registry);
  if (!routing.selectedProvider || !routing.selectedModel) {
    const rejectedReasons = routing.rejectedCandidates.flatMap((candidate) => candidate.reasons);
    return blockedResult(request, blockedErrorCodeFromRoutingReasons(rejectedReasons, request), routing.routingReasons.join(" "));
  }
  const model = registry.find((item) => item.provider === routing.selectedProvider && item.model === routing.selectedModel);
  if (!model) return blockedResult(request, "MODEL_NOT_AVAILABLE", "Selected model unavailable after routing.");
  const budget = enforceBudget(request, model);
  if (!budget.ok) return blockedResult(request, "BUDGET_EXCEEDED", budget.reason);

  const prompt = trimPromptEnvelope(buildPromptEnvelope(request), model.maximumInputTokens);
  if (estimatePromptSize(prompt) > model.maximumInputTokens) {
    return blockedResult(request, "CONTEXT_TOO_LARGE", "Prompt exceeds selected model context window after trimming.");
  }

  const startedAt = nowIso();
  const run = modelRunRepository.createRun({ request, routingDecision: routing, prompt, provider: model.provider, model: model.model, now: startedAt });
  const adapter = getAdapterForProvider(model.provider);
  modelRunRepository.appendAudit(run.runId, "provider-attempted", `Attempting ${model.provider}/${model.model}`, request.correlationId, startedAt);

  let result = await adapter.execute(request, model, prompt);
  result = { ...result, runId: run.runId, auditReference: auditReference(run.runId) };
  const validations = validateModelResult(request, result);
  result = { ...result, validationResults: validations, status: validationPassed(validations) ? result.status : "validation-failed", errorCode: validationPassed(validations) ? result.errorCode : "VALIDATION_FAILED" };
  modelRunRepository.completeRun(run.runId, result);
  return result;
}

export async function estimateModelTask(request: ModelTaskRequest, registry: ModelRecord[] = buildModelRegistry()) {
  const routing = routeModelTask(request, registry);
  const model = registry.find((item) => item.provider === routing.selectedProvider && item.model === routing.selectedModel) ?? null;
  return {
    routing,
    estimate: model ? enforceBudget(request, model) : { ok: false, estimatedCost: 0, reason: "no model selected" },
  };
}
