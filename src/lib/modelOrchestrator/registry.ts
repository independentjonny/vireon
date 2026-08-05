import type { DataSensitivity, ModelProvider, ModelRecord, ModelTaskType, ProviderHealthStatus } from "./types.ts";

const allTaskTypes: ModelTaskType[] = [
  "conversational-answer",
  "financial-synthesis",
  "document-extraction",
  "document-summary",
  "financial-document-analysis",
  "plan-generation",
  "recommendation-drafting",
  "recommendation-critique",
  "workflow-planning",
  "scenario-explanation",
  "timeline-explanation",
  "anomaly-explanation",
  "structured-classification",
  "evidence-mapping",
  "rule-grounding",
  "user-communication",
  "deterministic-calculation",
  "verification-review",
];

const commercialTaskTypes = allTaskTypes.filter((item) => item !== "deterministic-calculation");
const lowSensitivity: DataSensitivity[] = ["public", "internal", "personal"];

function enabled(value: string | undefined) {
  return value === "true" || value === "1";
}

function health(enabledValue: boolean): ProviderHealthStatus {
  return enabledValue ? "healthy" : "disabled";
}

export type ModelOrchestratorConfig = {
  mode: "disabled" | "mock" | "local" | "live" | "live-evaluation";
  rawPromptLogging: boolean;
  rawResponseStorage: boolean;
  crossProviderFallback: boolean;
  dailyBudget: number;
  monthlyBudget: number;
  maxTaskCost: number;
  policyVersion: string;
};

export function readModelOrchestratorConfig(env: NodeJS.ProcessEnv = process.env): ModelOrchestratorConfig {
  const liveEvaluationMode = env.VIREON_MODEL_ORCHESTRATOR_MODE === "live-evaluation";
  return {
    mode: liveEvaluationMode ? "live-evaluation" : env.VIREON_MODEL_ORCHESTRATOR_MODE === "live" ? "live" : env.VIREON_MODEL_ORCHESTRATOR_MODE === "mock" ? "mock" : env.VIREON_MODEL_ORCHESTRATOR_MODE === "disabled" ? "disabled" : "local",
    rawPromptLogging: enabled(env.VIREON_MODEL_LOG_PROMPTS),
    rawResponseStorage: enabled(env.VIREON_MODEL_STORE_RAW_RESPONSES),
    crossProviderFallback: enabled(env.VIREON_MODEL_ALLOW_CROSS_PROVIDER_FALLBACK),
    dailyBudget: Number((liveEvaluationMode ? env.VIREON_LIVE_MODEL_DAILY_BUDGET : undefined) ?? env.VIREON_MODEL_DAILY_BUDGET ?? 25),
    monthlyBudget: Number((liveEvaluationMode ? env.VIREON_LIVE_MODEL_MONTHLY_BUDGET : undefined) ?? env.VIREON_MODEL_MONTHLY_BUDGET ?? 500),
    maxTaskCost: Number((liveEvaluationMode ? env.VIREON_LIVE_MODEL_MAX_TASK_COST : undefined) ?? env.VIREON_MODEL_MAX_TASK_COST ?? 2),
    policyVersion: "model-routing-policy-v1",
  };
}

function sensitivityList(value: string | undefined, fallback: DataSensitivity[]) {
  if (!value) return fallback;
  const allowed: DataSensitivity[] = ["public", "internal", "personal", "financial-sensitive", "identity-sensitive", "highly-restricted"];
  const parsed = value.split(",").map((item) => item.trim()).filter((item): item is DataSensitivity => allowed.includes(item as DataSensitivity));
  return parsed.length > 0 ? parsed : fallback;
}

function commercialModel(input: {
  provider: Extract<ModelProvider, "openai" | "anthropic" | "gemini">;
  model: string;
  enabled: boolean;
  supportsVision?: boolean;
  supportsDocuments?: boolean;
  supportsStructuredOutput?: boolean;
  supportsLongContext?: boolean;
  supportsReasoning?: boolean;
  cost?: "low" | "medium" | "high";
  latency?: "fast" | "normal" | "slow";
  approvedSensitivityLevels?: DataSensitivity[];
  approvedTaskTypes?: ModelTaskType[];
  configurationSource: string;
}): ModelRecord {
  return {
    provider: input.provider,
    model: input.model,
    enabled: input.enabled,
    availability: input.enabled ? "available" : "unavailable",
    supportsText: true,
    supportsVision: Boolean(input.supportsVision),
    supportsDocuments: Boolean(input.supportsDocuments),
    supportsStructuredOutput: Boolean(input.supportsStructuredOutput),
    supportsToolCalling: true,
    supportsLongContext: Boolean(input.supportsLongContext),
    supportsReasoning: Boolean(input.supportsReasoning),
    supportsStreaming: true,
    supportsBatch: false,
    maximumInputTokens: input.supportsLongContext ? 200_000 : 32_000,
    maximumOutputTokens: 8_000,
    relativeCostClass: input.cost ?? "medium",
    relativeLatencyClass: input.latency ?? "normal",
    dataRegion: "provider-configured",
    retentionPolicy: "provider-default; raw prompt logging disabled by Vireon unless explicitly enabled",
    approvedSensitivityLevels: input.approvedSensitivityLevels ?? lowSensitivity,
    approvedTaskTypes: input.approvedTaskTypes ?? commercialTaskTypes,
    healthStatus: health(input.enabled),
    lastHealthCheck: "not-run",
    configurationSource: input.configurationSource,
    promotionState: input.enabled ? "evaluation" : "unconfigured",
  };
}

export function buildModelRegistry(env: NodeJS.ProcessEnv = process.env): ModelRecord[] {
  const openaiEnabled = enabled(env.VIREON_OPENAI_ENABLED) && Boolean(env.VIREON_OPENAI_API_KEY ?? env.OPENAI_API_KEY);
  const anthropicEnabled = enabled(env.VIREON_ANTHROPIC_ENABLED) && Boolean(env.VIREON_ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY);
  const geminiEnabled = enabled(env.VIREON_GEMINI_ENABLED) && Boolean(env.VIREON_GEMINI_API_KEY ?? env.GEMINI_API_KEY);
  const openaiDefaultModelConfigured = Boolean(env.VIREON_OPENAI_DEFAULT_MODEL);
  const openaiFastModelConfigured = Boolean(env.VIREON_OPENAI_FAST_MODEL);

  const records: ModelRecord[] = [
    {
      provider: "deterministic",
      model: "vireon-deterministic-engines-v1",
      enabled: true,
      availability: "available",
      supportsText: true,
      supportsVision: false,
      supportsDocuments: false,
      supportsStructuredOutput: true,
      supportsToolCalling: false,
      supportsLongContext: false,
      supportsReasoning: true,
      supportsStreaming: false,
      supportsBatch: true,
      maximumInputTokens: 256_000,
      maximumOutputTokens: 16_000,
      relativeCostClass: "free",
      relativeLatencyClass: "fast",
      dataRegion: "local-vireon-runtime",
      retentionPolicy: "local deterministic execution; no provider transmission",
      approvedSensitivityLevels: ["public", "internal", "personal", "financial-sensitive", "identity-sensitive", "highly-restricted"],
      approvedTaskTypes: ["deterministic-calculation", "verification-review", "structured-classification", "evidence-mapping"],
      healthStatus: "healthy",
      lastHealthCheck: "local",
      configurationSource: "built-in",
      promotionState: "approved",
    },
    {
      provider: "mock",
      model: "vireon-mock-model-v1",
      enabled: env.VIREON_MODEL_ORCHESTRATOR_MODE !== "disabled",
      availability: env.VIREON_MODEL_ORCHESTRATOR_MODE === "disabled" ? "unavailable" : "available",
      supportsText: true,
      supportsVision: true,
      supportsDocuments: true,
      supportsStructuredOutput: true,
      supportsToolCalling: true,
      supportsLongContext: true,
      supportsReasoning: true,
      supportsStreaming: false,
      supportsBatch: true,
      maximumInputTokens: 64_000,
      maximumOutputTokens: 8_000,
      relativeCostClass: "free",
      relativeLatencyClass: "fast",
      dataRegion: "local-test",
      retentionPolicy: "synthetic local test output only",
      approvedSensitivityLevels: ["public", "internal", "personal", "financial-sensitive"],
      approvedTaskTypes: commercialTaskTypes,
      healthStatus: env.VIREON_MODEL_ORCHESTRATOR_MODE === "disabled" ? "disabled" : "healthy",
      lastHealthCheck: "local",
      configurationSource: "built-in-test-adapter",
      promotionState: "evaluation",
    },
    commercialModel({
      provider: "openai",
      model: env.VIREON_OPENAI_DEFAULT_MODEL ?? "openai-default-unconfigured",
      enabled: openaiEnabled && openaiDefaultModelConfigured,
      supportsStructuredOutput: true,
      supportsReasoning: true,
      cost: "medium",
      latency: "normal",
      configurationSource: "VIREON_OPENAI_DEFAULT_MODEL",
      approvedSensitivityLevels: sensitivityList(env.VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS, lowSensitivity),
    }),
    commercialModel({
      provider: "openai",
      model: env.VIREON_OPENAI_FAST_MODEL ?? "openai-fast-unconfigured",
      enabled: openaiEnabled && openaiFastModelConfigured,
      supportsStructuredOutput: true,
      cost: "low",
      latency: "fast",
      configurationSource: "VIREON_OPENAI_FAST_MODEL",
      approvedTaskTypes: ["conversational-answer", "user-communication", "structured-classification", "document-summary"],
      approvedSensitivityLevels: sensitivityList(env.VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS, lowSensitivity),
    }),
    commercialModel({
      provider: "anthropic",
      model: env.VIREON_ANTHROPIC_DEFAULT_MODEL ?? "anthropic-default-unconfigured",
      enabled: anthropicEnabled,
      supportsStructuredOutput: true,
      supportsLongContext: true,
      supportsReasoning: true,
      cost: "medium",
      latency: "normal",
      configurationSource: "VIREON_ANTHROPIC_DEFAULT_MODEL",
      approvedSensitivityLevels: sensitivityList(env.VIREON_ANTHROPIC_APPROVED_SENSITIVITY_LEVELS, lowSensitivity),
    }),
    commercialModel({
      provider: "gemini",
      model: env.VIREON_GEMINI_DEFAULT_MODEL ?? "gemini-default-unconfigured",
      enabled: geminiEnabled,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsDocuments: true,
      cost: "medium",
      latency: "normal",
      configurationSource: "VIREON_GEMINI_DEFAULT_MODEL",
      approvedSensitivityLevels: sensitivityList(env.VIREON_GEMINI_APPROVED_SENSITIVITY_LEVELS, lowSensitivity),
    }),
    commercialModel({
      provider: "gemini",
      model: env.VIREON_GEMINI_VISION_MODEL ?? "gemini-vision-unconfigured",
      enabled: geminiEnabled,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsDocuments: true,
      supportsLongContext: true,
      cost: "medium",
      latency: "normal",
      configurationSource: "VIREON_GEMINI_VISION_MODEL",
      approvedTaskTypes: ["document-extraction", "document-summary", "financial-document-analysis", "evidence-mapping"],
      approvedSensitivityLevels: sensitivityList(env.VIREON_GEMINI_APPROVED_SENSITIVITY_LEVELS, lowSensitivity),
    }),
  ];

  return records;
}
