export * from "./types.ts";
export * from "./registry.ts";
export * from "./policy.ts";
export * from "./router.ts";
export * from "./executor.ts";
export * from "./validator.ts";
export * from "./fallback.ts";
export * from "./circuitBreaker.ts";
export * from "./budget.ts";
export * from "./audit.ts";
export * from "./taskRestrictions.ts";

import { buildModelRegistry, readModelOrchestratorConfig } from "./registry.ts";
import { initialCircuitBreaker } from "./circuitBreaker.ts";

export function diagnoseModelOrchestrator(env: NodeJS.ProcessEnv = process.env) {
  const config = readModelOrchestratorConfig(env);
  const registry = buildModelRegistry(env);
  return {
    ok: true,
    mode: config.mode,
    policyVersion: config.policyVersion,
    privacyDefaults: {
      rawPromptLogging: config.rawPromptLogging,
      rawResponseStorage: config.rawResponseStorage,
      crossProviderFallback: config.crossProviderFallback,
    },
    configuredProviders: registry
      .filter((model) => model.provider !== "disabled")
      .map((model) => ({
        provider: model.provider,
        model: model.model,
        enabled: model.enabled,
        healthStatus: model.healthStatus,
        capabilities: {
          text: model.supportsText,
          vision: model.supportsVision,
          documents: model.supportsDocuments,
          structuredOutput: model.supportsStructuredOutput,
          toolCalling: model.supportsToolCalling,
          longContext: model.supportsLongContext,
          reasoning: model.supportsReasoning,
        },
        approvedSensitivityLevels: model.approvedSensitivityLevels,
        approvedTaskTypes: model.approvedTaskTypes,
        circuitBreaker: initialCircuitBreaker(model.provider, model.model),
        configurationSource: model.configurationSource,
      })),
    missingKeys: {
      openai: env.VIREON_OPENAI_ENABLED === "true" && !env.VIREON_OPENAI_API_KEY,
      anthropic: env.VIREON_ANTHROPIC_ENABLED === "true" && !env.VIREON_ANTHROPIC_API_KEY,
      gemini: env.VIREON_GEMINI_ENABLED === "true" && !env.VIREON_GEMINI_API_KEY,
    },
    blockedTaskClasses: registry.some((model) => model.provider !== "deterministic" && model.enabled)
      ? []
      : ["LLM-backed conversational tasks", "independent model review", "live provider consensus"],
  };
}
