import { readModelOrchestratorConfig } from "./registry.ts";
import { MODEL_POLICY_VERSION, policyRejectReasons } from "./policy.ts";
import type { ModelRecord, ModelTaskRequest, RoutingDecision } from "./types.ts";

const costScore = { free: 4, low: 3, medium: 2, high: 1 } as const;
const latencyScore = { fast: 3, normal: 2, slow: 1 } as const;

function scoreModel(request: ModelTaskRequest, model: ModelRecord) {
  let score = 0;
  if (model.provider === "deterministic") score += 100;
  score += costScore[model.relativeCostClass] * 4;
  score += latencyScore[model.relativeLatencyClass] * (request.serviceClass === "interactive" ? 6 : 2);
  for (const capability of request.preferredCapabilities) {
    if (
      (capability === "reasoning" && model.supportsReasoning) ||
      (capability === "long-context" && model.supportsLongContext) ||
      (capability === "structured-output" && model.supportsStructuredOutput) ||
      (capability === "documents" && model.supportsDocuments) ||
      (capability === "vision" && model.supportsVision)
    ) {
      score += 3;
    }
  }
  if (model.promotionState === "preferred") score += 5;
  if (model.promotionState === "approved") score += 3;
  if (request.taskType === "recommendation-critique" && model.supportsReasoning) score += 4;
  return score;
}

function costClassToEstimate(model: ModelRecord) {
  if (model.relativeCostClass === "free") return 0;
  if (model.relativeCostClass === "low") return 0.02;
  if (model.relativeCostClass === "medium") return 0.2;
  return 1.5;
}

function latencyClassToEstimate(model: ModelRecord) {
  if (model.relativeLatencyClass === "fast") return 750;
  if (model.relativeLatencyClass === "normal") return 2500;
  return 8000;
}

export function routeModelTask(request: ModelTaskRequest, registry: ModelRecord[], env: NodeJS.ProcessEnv = process.env): RoutingDecision {
  const config = readModelOrchestratorConfig(env);
  const rejectedCandidates = registry.map((model) => {
    const reasons = policyRejectReasons(request, model, env);
    const estimatedCost = costClassToEstimate(model);
    const estimatedLatency = latencyClassToEstimate(model);
    if (estimatedCost > request.maximumCost || estimatedCost > config.maxTaskCost) reasons.push("estimated cost exceeds task limit");
    if (estimatedLatency > request.maximumLatencyMs) reasons.push("estimated latency exceeds task limit");
    return { provider: model.provider, model: model.model, reasons };
  });
  const eligible = registry
    .filter((model) => rejectedCandidates.find((item) => item.provider === model.provider && item.model === model.model)?.reasons.length === 0)
    .sort((a, b) => scoreModel(request, b) - scoreModel(request, a));

  const selected = eligible[0] ?? null;
  const selectedScore = selected ? scoreModel(request, selected) : 0;
  return {
    selectedProvider: selected?.provider ?? null,
    selectedModel: selected?.model ?? null,
    routingScore: selectedScore,
    routingReasons: selected
      ? [
          `Selected by ${MODEL_POLICY_VERSION}`,
          request.deterministicEngineRequired ? "deterministic engine required" : "policy and capability eligible",
          `cost class ${selected.relativeCostClass}`,
          `latency class ${selected.relativeLatencyClass}`,
        ]
      : ["No eligible model met policy, capability, sensitivity, cost and latency requirements."],
    rejectedCandidates: rejectedCandidates.filter((item) => item.reasons.length > 0),
    fallbackCandidates: eligible.slice(1),
    policyVersion: MODEL_POLICY_VERSION,
  };
}
