import { fallbackPermitted } from "./policy.ts";
import { readModelOrchestratorConfig } from "./registry.ts";
import type { ModelRecord, ModelTaskRequest, RoutingFallbackRecord } from "./types.ts";

export function orderFallbackCandidates(request: ModelTaskRequest, selected: ModelRecord, candidates: ModelRecord[], env: NodeJS.ProcessEnv = process.env) {
  const config = readModelOrchestratorConfig(env);
  const accepted: ModelRecord[] = [];
  const rejected: RoutingFallbackRecord[] = [];
  for (const candidate of candidates) {
    const decision = fallbackPermitted(request, selected, candidate, config.crossProviderFallback);
    if (decision.ok) accepted.push(candidate);
    else rejected.push({ provider: candidate.provider, model: candidate.model, reason: decision.reason, at: new Date().toISOString() });
  }
  return { accepted, rejected };
}
