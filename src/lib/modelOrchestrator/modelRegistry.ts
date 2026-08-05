import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { buildModelRegistry } from "./registry.ts";
import { getAdapterForProvider } from "./providers/mock.ts";
import type { DataSensitivity, ModelProvider, ModelRecord, ModelTaskType, ProviderHealthStatus } from "./types.ts";

export type CanonicalModelStatus = "active" | "evaluation" | "retired" | "disabled" | "unavailable";

export type ModelComparisonApproval = {
  approvalId: string;
  provider: Extract<ModelProvider, "openai" | "anthropic" | "gemini">;
  exactModelId: string;
  displayName: string;
  reason: string;
  expectedCost: {
    inputPerMillion: number;
    outputPerMillion: number;
    currency: "USD";
    source: string;
  };
  evaluationScope: "stage-a-six-fixture-comparison";
  approvedTaskTypes: ModelTaskType[];
  approvedSensitivityLevels: DataSensitivity[];
  approvedAt: string;
  approvedBy: string;
  expiresAt?: string;
};

export type CanonicalModelRegistryEntry = {
  provider: ModelProvider;
  exactModelId: string;
  displayName: string;
  status: CanonicalModelStatus;
  capabilities: {
    text: boolean;
    vision: boolean;
    documents: boolean;
    structuredOutput: boolean;
    toolCalling: boolean;
    longContext: boolean;
    reasoning: boolean;
  };
  contextWindow: number;
  structuredOutputSupport: boolean;
  availability: "available" | "degraded" | "unavailable";
  evaluationEligibility: {
    eligible: boolean;
    reason: string;
    approvalId: string | null;
  };
  productionEligibility: {
    eligible: boolean;
    reason: string;
  };
  retirementStatus: {
    retired: boolean;
    reason: string | null;
  };
  pricingMetadata: {
    inputPerMillion: number | null;
    outputPerMillion: number | null;
    currency: "USD";
    source: string;
  };
  healthStatus: ProviderHealthStatus;
  configured: boolean;
  authenticated: boolean;
  reachable: boolean;
  supportedModels: string[];
  lastCheck: string;
  failureReason: string | null;
  configurationSource: string;
};

export type ProviderHealthReport = {
  provider: ModelProvider;
  configured: boolean;
  authenticated: boolean;
  reachable: boolean;
  healthy: boolean;
  supportedModels: string[];
  lastCheck: string;
  failureReason: string | null;
};

export type RegistryValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  modelCount: number;
  eligibleComparisonCandidateCount: number;
};

export type ComparisonReadiness = {
  ready: boolean;
  included: CanonicalModelRegistryEntry[];
  excluded: Array<{
    provider: ModelProvider;
    exactModelId: string;
    reason: string;
  }>;
  message: string;
};

const COMMERCIAL_PROVIDERS: Array<Extract<ModelProvider, "openai" | "anthropic" | "gemini">> = ["openai", "anthropic", "gemini"];
const RETIRED_MODELS = new Map<string, string>([
  ["openai/gpt-5.2", "Retired after failed Stage-A live validation."],
  ["openai/gpt-5.6-terra", "Retired after valid live Stage-A evaluation produced five critical failures from five reviewed outputs."],
]);

function enabled(value: string | undefined) {
  return value === "true" || value === "1";
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

function providerEnabled(provider: ModelProvider, env: NodeJS.ProcessEnv) {
  if (provider === "openai") return enabled(env.VIREON_OPENAI_ENABLED);
  if (provider === "anthropic") return enabled(env.VIREON_ANTHROPIC_ENABLED);
  if (provider === "gemini") return enabled(env.VIREON_GEMINI_ENABLED);
  return provider === "deterministic" || provider === "mock";
}

function hasCredential(provider: ModelProvider, env: NodeJS.ProcessEnv) {
  const primary = envKey(provider);
  const generic = genericEnvKey(provider);
  return Boolean((primary && env[primary]) || (generic && env[generic]));
}

function configuredModelIds(provider: ModelProvider, env: NodeJS.ProcessEnv) {
  if (provider === "openai") return [env.VIREON_OPENAI_DEFAULT_MODEL, env.VIREON_OPENAI_FAST_MODEL].filter((item): item is string => Boolean(item));
  if (provider === "anthropic") return [env.VIREON_ANTHROPIC_DEFAULT_MODEL].filter((item): item is string => Boolean(item));
  if (provider === "gemini") return [env.VIREON_GEMINI_DEFAULT_MODEL, env.VIREON_GEMINI_VISION_MODEL].filter((item): item is string => Boolean(item));
  return [];
}

function approvedModelIds(provider: ModelProvider, approvals: ModelComparisonApproval[]) {
  return approvals.filter((approval) => approval.provider === provider).map((approval) => approval.exactModelId);
}

function approvalsPath() {
  return join(process.cwd(), ".vireon", "model-evaluation", "model-comparison", "candidate-approvals.json");
}

export function readComparisonApprovals(env: NodeJS.ProcessEnv = process.env): ModelComparisonApproval[] {
  const fromEnv = env.VIREON_MODEL_COMPARISON_APPROVALS;
  if (fromEnv) {
    try {
      const parsed = JSON.parse(fromEnv);
      return Array.isArray(parsed) ? parsed as ModelComparisonApproval[] : [];
    } catch {
      return [];
    }
  }
  const path = approvalsPath();
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed.approvals) ? parsed.approvals as ModelComparisonApproval[] : [];
  } catch {
    return [];
  }
}

function displayNameFor(record: ModelRecord, approval?: ModelComparisonApproval) {
  return approval?.displayName ?? `${record.provider}/${record.model}`;
}

function priceFor(provider: ModelProvider, approval: ModelComparisonApproval | undefined, env: NodeJS.ProcessEnv) {
  const prefix = provider === "openai" ? "VIREON_OPENAI" : provider === "anthropic" ? "VIREON_ANTHROPIC" : "VIREON_GEMINI";
  return {
    inputPerMillion: approval?.expectedCost.inputPerMillion ?? Number(env[`${prefix}_INPUT_COST_PER_1M`] ?? Number.NaN),
    outputPerMillion: approval?.expectedCost.outputPerMillion ?? Number(env[`${prefix}_OUTPUT_COST_PER_1M`] ?? Number.NaN),
    currency: "USD" as const,
    source: approval?.expectedCost.source ?? `${prefix}_*_COST_PER_1M`,
  };
}

function entryStatus(record: ModelRecord, retired: boolean): CanonicalModelStatus {
  if (retired) return "retired";
  if (!record.enabled || record.healthStatus === "disabled") return "disabled";
  if (record.healthStatus === "unhealthy" || record.availability === "unavailable") return "unavailable";
  if (record.promotionState === "approved" || record.promotionState === "preferred") return "active";
  return "evaluation";
}

function evaluationEligibility(input: {
  record: ModelRecord;
  providerConfigured: boolean;
  authenticated: boolean;
  approval?: ModelComparisonApproval;
  retired: boolean;
}) {
  if (input.retired) return { eligible: false, reason: "model is retired", approvalId: input.approval?.approvalId ?? null };
  if (!input.approval) return { eligible: false, reason: "no explicit comparison approval record", approvalId: null };
  if (!input.providerConfigured) return { eligible: false, reason: "provider is not enabled", approvalId: input.approval.approvalId };
  if (!input.authenticated) return { eligible: false, reason: "provider credential missing", approvalId: input.approval.approvalId };
  if (!input.record.enabled) return { eligible: false, reason: "model is not enabled", approvalId: input.approval.approvalId };
  if (input.record.healthStatus !== "healthy") return { eligible: false, reason: `provider/model health is ${input.record.healthStatus}`, approvalId: input.approval.approvalId };
  if (!input.record.supportsStructuredOutput) return { eligible: false, reason: "structured output unsupported", approvalId: input.approval.approvalId };
  if (input.record.promotionState === "disabled" || input.record.promotionState === "deprecated") return { eligible: false, reason: `promotion state is ${input.record.promotionState}`, approvalId: input.approval.approvalId };
  return { eligible: true, reason: "approved for frozen six-fixture comparison", approvalId: input.approval.approvalId };
}

function productionEligibility(record: ModelRecord, retired: boolean) {
  if (retired) return { eligible: false, reason: "retired models cannot serve production" };
  if (record.promotionState === "preferred" || record.promotionState === "approved") return { eligible: true, reason: `promotion state is ${record.promotionState}` };
  return { eligible: false, reason: `promotion state is ${record.promotionState}; production approval remains separate` };
}

export function buildCanonicalModelRegistry(env: NodeJS.ProcessEnv = process.env, now = new Date().toISOString()): CanonicalModelRegistryEntry[] {
  const base = buildModelRegistry(env);
  const approvals = readComparisonApprovals(env);
  const records = [...base];
  for (const approval of approvals) {
    if (records.some((record) => record.provider === approval.provider && record.model === approval.exactModelId)) continue;
    const enabledForProvider = providerEnabled(approval.provider, env) && hasCredential(approval.provider, env);
    records.push({
      provider: approval.provider,
      model: approval.exactModelId,
      enabled: enabledForProvider,
      availability: enabledForProvider ? "available" : "unavailable",
      supportsText: true,
      supportsVision: approval.provider === "gemini",
      supportsDocuments: approval.provider === "gemini",
      supportsStructuredOutput: true,
      supportsToolCalling: true,
      supportsLongContext: true,
      supportsReasoning: true,
      supportsStreaming: true,
      supportsBatch: false,
      maximumInputTokens: approval.exactModelId.includes("gpt-5.6") ? 1_050_000 : 200_000,
      maximumOutputTokens: approval.exactModelId.includes("gpt-5.6") ? 128_000 : 8_000,
      relativeCostClass: "medium",
      relativeLatencyClass: "normal",
      dataRegion: "provider-configured",
      retentionPolicy: "provider-default; raw prompt logging disabled by Vireon unless explicitly enabled",
      approvedSensitivityLevels: approval.approvedSensitivityLevels,
      approvedTaskTypes: approval.approvedTaskTypes,
      healthStatus: enabledForProvider ? "healthy" : "disabled",
      lastHealthCheck: "not-run",
      configurationSource: `comparison approval ${approval.approvalId}`,
      promotionState: "evaluation",
    });
  }
  for (const retiredKey of RETIRED_MODELS.keys()) {
    const [provider, modelId] = retiredKey.split("/") as [Extract<ModelProvider, "openai" | "anthropic" | "gemini">, string];
    if (records.some((record) => record.provider === provider && record.model === modelId)) continue;
    records.push({
      provider,
      model: modelId,
      enabled: false,
      availability: "unavailable",
      supportsText: true,
      supportsVision: false,
      supportsDocuments: false,
      supportsStructuredOutput: true,
      supportsToolCalling: true,
      supportsLongContext: true,
      supportsReasoning: true,
      supportsStreaming: false,
      supportsBatch: false,
      maximumInputTokens: 0,
      maximumOutputTokens: 0,
      relativeCostClass: "high",
      relativeLatencyClass: "slow",
      dataRegion: "retired",
      retentionPolicy: "retired model record retained for evaluation history readability",
      approvedSensitivityLevels: [],
      approvedTaskTypes: [],
      healthStatus: "disabled",
      lastHealthCheck: "retired",
      configurationSource: "retired-model-ledger",
      promotionState: "deprecated",
    });
  }

  return records.map((record) => {
    const key = `${record.provider}/${record.model}`;
    const approval = approvals.find((item) => item.provider === record.provider && item.exactModelId === record.model);
    const retiredReason = RETIRED_MODELS.get(key) ?? null;
    const providerConfigured = providerEnabled(record.provider, env) && hasCredential(record.provider, env);
    const configured = record.provider === "deterministic" || record.provider === "mock" || (
      providerConfigured && (configuredModelIds(record.provider, env).includes(record.model) || approval?.exactModelId === record.model)
    );
    const authenticated = record.provider === "deterministic" || record.provider === "mock" || hasCredential(record.provider, env);
    const pricing = priceFor(record.provider, approval, env);
    const evaluation = evaluationEligibility({ record, providerConfigured: configured, authenticated, approval, retired: Boolean(retiredReason) });
    return {
      provider: record.provider,
      exactModelId: record.model,
      displayName: displayNameFor(record, approval),
      status: entryStatus(record, Boolean(retiredReason)),
      capabilities: {
        text: record.supportsText,
        vision: record.supportsVision,
        documents: record.supportsDocuments,
        structuredOutput: record.supportsStructuredOutput,
        toolCalling: record.supportsToolCalling,
        longContext: record.supportsLongContext,
        reasoning: record.supportsReasoning,
      },
      contextWindow: record.maximumInputTokens,
      structuredOutputSupport: record.supportsStructuredOutput,
      availability: record.availability,
      evaluationEligibility: evaluation,
      productionEligibility: productionEligibility(record, Boolean(retiredReason)),
      retirementStatus: { retired: Boolean(retiredReason), reason: retiredReason },
      pricingMetadata: {
        inputPerMillion: Number.isFinite(pricing.inputPerMillion) ? pricing.inputPerMillion : null,
        outputPerMillion: Number.isFinite(pricing.outputPerMillion) ? pricing.outputPerMillion : null,
        currency: pricing.currency,
        source: pricing.source,
      },
      healthStatus: record.healthStatus,
      configured,
      authenticated,
      reachable: record.healthStatus === "healthy" || record.healthStatus === "degraded",
      supportedModels: [...new Set([...configuredModelIds(record.provider, env), ...approvedModelIds(record.provider, approvals)])],
      lastCheck: record.lastHealthCheck === "not-run" ? now : record.lastHealthCheck,
      failureReason: evaluation.eligible ? null : evaluation.reason,
      configurationSource: record.configurationSource,
    };
  });
}

export async function buildProviderHealthReports(env: NodeJS.ProcessEnv = process.env): Promise<ProviderHealthReport[]> {
  const now = new Date().toISOString();
  const approvals = readComparisonApprovals();
  const reports: ProviderHealthReport[] = [];
  for (const provider of COMMERCIAL_PROVIDERS) {
    const configured = providerEnabled(provider, env) && configuredModelIds(provider, env).length > 0;
    const authenticated = hasCredential(provider, env);
    let health: ProviderHealthStatus = "disabled";
    if (configured && authenticated) {
      health = await getAdapterForProvider(provider).healthCheck();
    }
    reports.push({
      provider,
      configured,
      authenticated,
      reachable: health === "healthy" || health === "degraded",
      healthy: health === "healthy",
      supportedModels: [
        ...new Set([...configuredModelIds(provider, env), ...approvedModelIds(provider, approvals)]),
      ],
      lastCheck: now,
      failureReason: !configured ? "provider or model not configured" : !authenticated ? "credential missing" : health === "healthy" ? null : `health check returned ${health}`,
    });
  }
  return reports;
}

export function validateCanonicalModelRegistry(entries: CanonicalModelRegistryEntry[]): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.provider}/${entry.exactModelId}`;
    if (seen.has(key)) errors.push(`duplicate model entry: ${key}`);
    seen.add(key);
    if (entry.retirementStatus.retired && entry.evaluationEligibility.eligible) errors.push(`retired model is evaluation eligible: ${key}`);
    if (entry.status === "unavailable" && entry.evaluationEligibility.eligible) errors.push(`unavailable model is evaluation eligible: ${key}`);
    if (entry.status === "disabled" && entry.evaluationEligibility.eligible) errors.push(`disabled model is evaluation eligible: ${key}`);
    if (entry.provider === "deterministic" || entry.provider === "mock") continue;
    if (!entry.pricingMetadata.inputPerMillion || !entry.pricingMetadata.outputPerMillion) warnings.push(`missing explicit pricing metadata: ${key}`);
  }
  const eligibleComparisonCandidateCount = entries.filter((entry) => entry.evaluationEligibility.eligible && !entry.productionEligibility.eligible).length;
  if (eligibleComparisonCandidateCount === 0) warnings.push("comparison pool is empty");
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    modelCount: entries.length,
    eligibleComparisonCandidateCount,
  };
}

export function buildComparisonReadiness(entries: CanonicalModelRegistryEntry[]): ComparisonReadiness {
  const included = entries.filter((entry) => entry.evaluationEligibility.eligible && !entry.retirementStatus.retired);
  const excluded = entries
    .filter((entry) => !included.includes(entry) && entry.provider !== "deterministic" && entry.provider !== "mock")
    .map((entry) => ({ provider: entry.provider, exactModelId: entry.exactModelId, reason: entry.evaluationEligibility.reason }));
  return {
    ready: included.length > 0,
    included,
    excluded,
    message: included.length > 0
      ? `COMPARISON READY: ${included.length} candidate(s) eligible.`
      : "COMPARISON BLOCKED: no eligible non-retired candidates.",
  };
}
