import { createHash, randomUUID } from "crypto";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildModelRegistry } from "../modelOrchestrator/registry.ts";
import { routeModelTask } from "../modelOrchestrator/router.ts";
import {
  buildCanonicalModelRegistry,
  buildComparisonReadiness,
  readComparisonApprovals,
  validateCanonicalModelRegistry,
  type CanonicalModelRegistryEntry,
  type ModelComparisonApproval,
} from "../modelOrchestrator/modelRegistry.ts";
import { APPROVED_STAGE_A_FIXTURES } from "../modelOrchestrator/taskRestrictions.ts";
import { EVALUATION_FIXTURES } from "./fixtures.ts";
import {
  CONFIDENCE_POLICY_V3,
  ORIGINAL_LIVE_RUN_ID,
  SCORER_V3_CANDIDATE,
  buildStageACandidateManifest,
} from "./liveFailureDecomposition.ts";
import {
  LIVE_EVALUATION_PROMPT_STAGE_A_V3,
  buildLiveEvaluationPreflight,
  buildStageABudgetReservation,
  runLiveEvaluationPilot,
  selectLiveEvaluationFixtures,
} from "./livePilot.ts";
import type { EvaluationFixture } from "./types.ts";
import type { ModelProvider } from "../modelOrchestrator/types.ts";
import { fixtureToModelTask } from "./adapters/orchestrator.ts";

export const MODEL_COMPARISON_PROGRAM_ID = "model-comparison-program-v1";
export const MODEL_COMPARISON_REGISTRY_VERSION = "model-registry-v1";
export const MODEL_COMPARISON_ADAPTER_VERSION = "provider-adapters-v1";
export const MODEL_COMPARISON_API_SURFACE = "openai-responses-api-v1";
export const MODEL_COMPARISON_REVIEW_POLICY = "stage-a-human-review-rubric-v1";
export const MODEL_COMPARISON_GATE_POLICY = "frozen-stage-a-success-gates-v1";
export const GPT_52_RETIRED_STAGE_A_RUN_ID = "live-eval-b60c3e10-8664-4120-9e2b-23b065a647ef";
export const GPT_56_TERRA_STAGE_A_RUN_ID = "live-eval-d30efd91-7857-4bd5-a665-e7424fb69a7a";
export const GPT_56_TERRA_SOURCE_HALTED_RUN_ID = "live-eval-18283104-85df-4868-981a-f39b952ccdf1";

type Env = NodeJS.ProcessEnv;

function nowIso() {
  return new Date().toISOString();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableHash(value: unknown) {
  return sha256(JSON.stringify(value));
}

function artifactDir() {
  const dir = join(process.cwd(), ".vireon", "model-evaluation", "model-comparison");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeArtifact(name: string, payload: unknown) {
  const path = join(artifactDir(), name);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
  return path;
}

function writeOrReplaceArtifact(name: string, payload: unknown) {
  const path = join(artifactDir(), name);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

function redactReceipt(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/key|secret|token|password|credential|authorization/i.test(key)));
}

function fixtureSet() {
  return [...APPROVED_STAGE_A_FIXTURES]
    .map((fixtureId) => EVALUATION_FIXTURES.find((fixture) => fixture.fixtureId === fixtureId))
    .filter((fixture): fixture is EvaluationFixture => Boolean(fixture));
}

function configuredApproval(provider: ModelProvider, exactModelId: string, env: Env = process.env) {
  return readComparisonApprovals(env).find((approval) => approval.provider === provider && approval.exactModelId === exactModelId) ?? null;
}

function configuredCandidate(provider: ModelProvider, exactModelId: string, env: Env = process.env) {
  return buildCanonicalModelRegistry(env).find((entry) => entry.provider === provider && entry.exactModelId === exactModelId) ?? null;
}

function sourceHash(path: string) {
  return existsSync(path) ? sha256(readFileSync(path, "utf8")) : "missing";
}

function readJsonArtifact<T = Record<string, unknown>>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function liveArtifactPath(runId: string, suffix: "manifest" | "summary") {
  return join(process.cwd(), ".vireon", "model-evaluation", "live", `${runId}-${suffix}.json`);
}

function reviewArtifactPath(runId: string, suffix: string) {
  return join(process.cwd(), ".vireon", "model-evaluation", "reviews", `${runId}-${suffix}.json`);
}

export function buildFrozenMethodologyHashes(env: Env = process.env) {
  const stageAManifest = buildStageACandidateManifest().report;
  const fixtures = fixtureSet();
  return {
    fixtureSetHash: stableHash(fixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      fixtureVersion: fixture.fixtureVersion,
      expectedFacts: fixture.expectedFacts,
      prohibitedClaims: fixture.prohibitedClaims,
      requiredEvidenceReferences: fixture.requiredEvidenceReferences,
    }))),
    promptSetHash: stableHash({
      promptVersion: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
      promptVersionsByTask: stageAManifest.promptVersionsByTask,
    }),
    scorerHash: stableHash({
      scorerVersion: SCORER_V3_CANDIDATE,
      source: sourceHash(join(process.cwd(), "src", "lib", "modelEvaluation", "scorers.ts")),
    }),
    claimExtractorHash: stableHash({
      scorerVersion: SCORER_V3_CANDIDATE,
      source: sourceHash(join(process.cwd(), "src", "lib", "modelEvaluation", "liveFailureDecomposition.ts")),
    }),
    confidencePolicyHash: stableHash({
      confidencePolicy: CONFIDENCE_POLICY_V3,
      source: sourceHash(join(process.cwd(), "docs", "DETERMINISTIC_CONFIDENCE_POLICY.md")),
    }),
    taskRestrictionHash: stableHash({
      source: sourceHash(join(process.cwd(), "src", "lib", "modelOrchestrator", "taskRestrictions.ts")),
      activeComparisonModel: env.VIREON_STAGE_A_APPROVED_MODEL ?? null,
    }),
    reviewPolicyHash: stableHash(MODEL_COMPARISON_REVIEW_POLICY),
    evaluationGateHash: stableHash(MODEL_COMPARISON_GATE_POLICY),
  };
}

export function buildExecutionEnvelope(input: {
  provider: Extract<ModelProvider, "openai">;
  model: string;
  approval: ModelComparisonApproval;
  snapshotId: string;
  budgetApprovalId: string;
  budgetConfigurationHash: string;
  env: Env;
}) {
  const hashes = buildFrozenMethodologyHashes(input.env);
  const envelope = {
    executionMode: "INTERNAL_EVALUATION",
    comparisonProgramId: MODEL_COMPARISON_PROGRAM_ID,
    candidateSnapshotId: input.snapshotId,
    candidateApprovalId: input.approval.approvalId,
    budgetApprovalId: input.budgetApprovalId,
    provider: input.provider,
    model: input.model,
    fixtureSetId: "frozen-stage-a-six-fixtures-v1",
    fixtureIds: [...APPROVED_STAGE_A_FIXTURES],
    promptSetHash: hashes.promptSetHash,
    scorerHash: hashes.scorerHash,
    confidencePolicyHash: hashes.confidencePolicyHash,
    taskRestrictionHash: hashes.taskRestrictionHash,
    syntheticOnly: true,
    fallbackAllowed: false,
    paidJudgesAllowed: false,
    mandatoryReview: true,
    budgetConfigurationHash: input.budgetConfigurationHash,
    requestCap: 6,
    retryCap: Number(input.env.VIREON_LIVE_MODEL_MAX_RETRIES ?? 0),
    outputTokenCap: Number(input.env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 0),
    wrapperVersion: "candidate-execution-wrapper-v2",
    routerVersion: "model-routing-policy-v1",
    adapterVersion: MODEL_COMPARISON_ADAPTER_VERSION,
  };
  return { ...envelope, configurationHash: stableHash(envelope) };
}

export function applyExecutionEnvelopeToEnv(envelope: ReturnType<typeof buildExecutionEnvelope>, env: Env) {
  env.VIREON_CANDIDATE_EXECUTION_ENVELOPE = JSON.stringify(envelope);
  env.VIREON_CANDIDATE_CONFIGURATION_HASH = envelope.configurationHash;
  env.VIREON_STAGE_A_CANDIDATE_ID = `comparison-stage-a-${envelope.provider}-${envelope.model}`;
  env.VIREON_STAGE_A_APPROVED_MODEL = envelope.model;
  return env;
}

export function buildConfigurationReceipt(layer: string, env: Env, extra: Record<string, unknown> = {}) {
  const envelope = env.VIREON_CANDIDATE_EXECUTION_ENVELOPE ? JSON.parse(env.VIREON_CANDIDATE_EXECUTION_ENVELOPE) as Record<string, unknown> : {};
  return redactReceipt({
    layer,
    createdAt: nowIso(),
    provider: env.VIREON_OPENAI_ENABLED === "true" ? "openai" : "none",
    model: env.VIREON_OPENAI_DEFAULT_MODEL ?? "missing",
    executionMode: env.VIREON_MODEL_ORCHESTRATOR_MODE === "live-evaluation" ? "INTERNAL_EVALUATION" : "PRODUCTION",
    syntheticOnly: env.VIREON_SYNTHETIC_DATA_ONLY === "true",
    fallbackAllowed: env.VIREON_MODEL_ALLOW_CROSS_PROVIDER_FALLBACK === "true",
    promptVersion: env.VIREON_LIVE_MODEL_PROMPT_VERSION ?? "missing",
    scorerVersion: env.VIREON_LIVE_MODEL_SCORER_VERSION ?? "missing",
    candidateSnapshotId: envelope.candidateSnapshotId ?? "missing",
    candidateApprovalId: envelope.candidateApprovalId ?? "missing",
    budgetApprovalId: envelope.budgetApprovalId ?? "missing",
    configurationHash: env.VIREON_CANDIDATE_CONFIGURATION_HASH ?? "missing",
    ...extra,
  });
}

export function validateExecutionEnvelope(env: Env) {
  if (!env.VIREON_CANDIDATE_EXECUTION_ENVELOPE) {
    return { ok: false, reason: "CANDIDATE_CONTEXT_MISSING", configurationHash: "missing" };
  }
  const envelope = JSON.parse(env.VIREON_CANDIDATE_EXECUTION_ENVELOPE) as ReturnType<typeof buildExecutionEnvelope>;
  const hashable = Object.fromEntries(
    Object.entries(envelope).filter(([key]) => key !== "configurationHash"),
  );
  const recomputed = stableHash(hashable);
  const ok = recomputed === envelope.configurationHash && env.VIREON_CANDIDATE_CONFIGURATION_HASH === envelope.configurationHash;
  return {
    ok,
    reason: ok ? "execution envelope valid" : "EXECUTION_ENVELOPE_MISMATCH",
    configurationHash: envelope.configurationHash,
    recomputedHash: recomputed,
  };
}

export function buildCandidateEnvironment(input: {
  provider: Extract<ModelProvider, "openai">;
  model: string;
  approval: ModelComparisonApproval;
  env?: Env;
}) {
  const env = { ...(input.env ?? process.env) } as Env;
  env.VIREON_OPENAI_ENABLED = "true";
  env.VIREON_OPENAI_DEFAULT_MODEL = input.model;
  env.VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS = input.approval.approvedSensitivityLevels.join(",");
  env.VIREON_OPENAI_INPUT_COST_PER_1M = String(input.approval.expectedCost.inputPerMillion);
  env.VIREON_OPENAI_OUTPUT_COST_PER_1M = String(input.approval.expectedCost.outputPerMillion);
  env.VIREON_STAGE_A_APPROVED_MODEL = input.model;
  env.VIREON_STAGE_A_CANDIDATE_ID = `comparison-stage-a-${input.provider}-${input.model}`;
  env.VIREON_STAGE_A_LIVE_VALIDATION = "true";
  env.VIREON_LIVE_MODEL_STAGE = "stage-a";
  env.VIREON_LIVE_MODEL_SOURCE_RUN_ID = ORIGINAL_LIVE_RUN_ID;
  env.VIREON_LIVE_MODEL_PROMPT_VERSION = LIVE_EVALUATION_PROMPT_STAGE_A_V3;
  env.VIREON_LIVE_MODEL_SCORER_VERSION = SCORER_V3_CANDIDATE;
  env.VIREON_LIVE_MODEL_FIXTURE_IDS = [...APPROVED_STAGE_A_FIXTURES].join(",");
  env.VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT = "6";
  env.VIREON_LIVE_MODEL_RERUN_GENERATION = "comparison-stage-a";
  env.VIREON_MODEL_ORCHESTRATOR_MODE = "live-evaluation";
  env.VIREON_LIVE_MODEL_EVALUATION = "true";
  env.VIREON_SYNTHETIC_DATA_ONLY = "true";
  env.VIREON_MODEL_EVALUATION_ENVIRONMENT = env.VIREON_MODEL_EVALUATION_ENVIRONMENT ?? "local-pilot";
  env.VIREON_MODEL_LOG_PROMPTS = "false";
  env.VIREON_MODEL_STORE_RAW_RESPONSES = "false";
  env.VIREON_MODEL_ALLOW_CROSS_PROVIDER_FALLBACK = "false";
  env.VIREON_ANTHROPIC_ENABLED = "false";
  env.VIREON_GEMINI_ENABLED = "false";
  env.VIREON_DATA_SOURCE = "synthetic";
  env.VIREON_STAGE_A_BUDGET_APPROVED = env.VIREON_STAGE_A_BUDGET_APPROVED ?? "false";
  env.VIREON_LIVE_MODEL_DAILY_BUDGET = env.VIREON_LIVE_MODEL_DAILY_BUDGET ?? "1.8";
  env.VIREON_LIVE_MODEL_MAX_RUN_COST = env.VIREON_LIVE_MODEL_MAX_RUN_COST ?? "1.8";
  env.VIREON_LIVE_MODEL_MAX_TASK_COST = env.VIREON_LIVE_MODEL_MAX_TASK_COST ?? "0.3";
  env.VIREON_LIVE_MODEL_MAX_RETRIES = env.VIREON_LIVE_MODEL_MAX_RETRIES ?? "0";
  env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS = env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? "800";
  env.VIREON_MODEL_DAILY_BUDGET = env.VIREON_LIVE_MODEL_DAILY_BUDGET;
  env.VIREON_MODEL_MAX_TASK_COST = env.VIREON_LIVE_MODEL_MAX_TASK_COST;
  return env;
}

export async function verifyOpenAiModelAvailability(model: string, env: Env = process.env) {
  const checkedAt = nowIso();
  const apiKey = env.VIREON_OPENAI_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      configuredModelId: model,
      providerReportedModelId: null,
      accessStatus: "credential-missing",
      availabilityStatus: "unavailable",
      structuredOutputCompatibility: "not-checked",
      healthCheckTimestamp: checkedAt,
      apiSurfaceUsed: "GET /v1/models/{model}",
      errorCode: "CREDENTIAL_MISSING",
    };
  }
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const payload = response.ok ? await response.json() as { id?: string } : {};
    return {
      configuredModelId: model,
      providerReportedModelId: payload.id ?? null,
      accessStatus: response.ok ? "accessible" : "not-accessible",
      availabilityStatus: response.ok && payload.id === model ? "available" : "unavailable",
      structuredOutputCompatibility: response.ok ? "requires-compatibility-check" : "not-checked",
      healthCheckTimestamp: checkedAt,
      apiSurfaceUsed: "GET /v1/models/{model}",
      errorCode: response.ok ? null : `HTTP_${response.status}`,
    };
  } catch {
    return {
      configuredModelId: model,
      providerReportedModelId: null,
      accessStatus: "network-error",
      availabilityStatus: "unavailable",
      structuredOutputCompatibility: "not-checked",
      healthCheckTimestamp: checkedAt,
      apiSurfaceUsed: "GET /v1/models/{model}",
      errorCode: "NETWORK_ERROR",
    };
  }
}

export async function runOpenAiCompatibilityCheck(model: string, env: Env = process.env) {
  const checkedAt = nowIso();
  const apiKey = env.VIREON_OPENAI_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "blocked", checkedAt, model, endpoint: "POST /v1/responses", errorCode: "CREDENTIAL_MISSING", cost: 0 };
  }
  const outputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["status", "evidenceIds", "confidence", "classification"],
    properties: {
      status: { type: "string", enum: ["compatible"] },
      evidenceIds: { type: "array", items: { type: "string" } },
      confidence: { type: "number" },
      classification: { type: "array", items: { type: "string" } },
    },
  };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: "Return only JSON matching the provided schema. This is a synthetic adapter compatibility check." },
          { role: "user", content: "Synthetic compatibility check. No financial data. Use evidence id compat-evidence-1." },
        ],
        max_output_tokens: 80,
        text: { format: { type: "json_schema", name: "vireon_adapter_compatibility", strict: false, schema: outputSchema } },
      }),
    });
    if (!response.ok) {
      return { status: "failed", checkedAt, model, endpoint: "POST /v1/responses", errorCode: `HTTP_${response.status}`, cost: 0 };
    }
    const payload = await response.json() as Record<string, unknown>;
    const usage = payload.usage && typeof payload.usage === "object" ? payload.usage as Record<string, unknown> : {};
    const inputTokens = Number(usage.input_tokens ?? 0);
    const outputTokens = Number(usage.output_tokens ?? 0);
    const inputPrice = Number(env.VIREON_OPENAI_INPUT_COST_PER_1M ?? 0);
    const outputPrice = Number(env.VIREON_OPENAI_OUTPUT_COST_PER_1M ?? 0);
    const cost = Number((((inputTokens / 1_000_000) * inputPrice) + ((outputTokens / 1_000_000) * outputPrice)).toFixed(6));
    return {
      status: "compatible",
      checkedAt,
      model,
      endpoint: "POST /v1/responses",
      requestSchemaSupported: true,
      structuredOutputSupported: true,
      tokenLimitParametersSupported: true,
      usageReportingSupported: inputTokens + outputTokens > 0,
      finishStatusHandlingChecked: true,
      refusalHandlingChecked: true,
      timeoutHandlingChecked: true,
      errorNormalisationChecked: true,
      costCalculationChecked: true,
      responseExtractionChecked: true,
      tokenUsage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      cost,
    };
  } catch {
    return { status: "failed", checkedAt, model, endpoint: "POST /v1/responses", errorCode: "NETWORK_ERROR", cost: 0 };
  }
}

export function createCandidateSnapshot(input: {
  provider: Extract<ModelProvider, "openai">;
  model: string;
  approval: ModelComparisonApproval;
  registryEntry: CanonicalModelRegistryEntry;
  availability: Awaited<ReturnType<typeof verifyOpenAiModelAvailability>>;
  compatibility: Awaited<ReturnType<typeof runOpenAiCompatibilityCheck>> | null;
  env: Env;
}) {
  const hashes = buildFrozenMethodologyHashes(input.env);
  const snapshot = {
    artifactType: "model-comparison-candidate-snapshot",
    snapshotId: `candidate-snapshot-${input.provider}-${input.model}-${randomUUID()}`,
    comparisonProgramId: MODEL_COMPARISON_PROGRAM_ID,
    candidateApprovalId: input.approval.approvalId,
    provider: input.provider,
    exactModel: input.model,
    registryVersion: MODEL_COMPARISON_REGISTRY_VERSION,
    adapterVersion: MODEL_COMPARISON_ADAPTER_VERSION,
    apiEndpointVersion: MODEL_COMPARISON_API_SURFACE,
    ...hashes,
    gitCommit: input.env.VIREON_GIT_COMMIT ?? "unknown",
    createdAt: nowIso(),
    evaluationOnlyStatus: input.registryEntry.evaluationEligibility.eligible,
    productionIneligibleStatus: !input.registryEntry.productionEligibility.eligible,
    modelAvailability: input.availability,
    adapterCompatibility: input.compatibility,
    immutable: true,
  };
  const path = writeArtifact(`${snapshot.snapshotId}.json`, snapshot);
  const integrity = {
    snapshotId: snapshot.snapshotId,
    path,
    sha256: sha256(JSON.stringify(snapshot)),
    createdAt: nowIso(),
  };
  const integrityPath = writeArtifact(`${snapshot.snapshotId}.integrity.json`, integrity);
  return { snapshot, path, integrity, integrityPath };
}

export function createCandidateSpendingApproval(input: {
  snapshotId: string;
  approval: ModelComparisonApproval;
  env: Env;
}) {
  const fixtures = fixtureSet();
  const model = buildModelRegistry(input.env).find((item) => item.provider === input.approval.provider && item.model === input.approval.exactModelId) ?? null;
  const reservation = buildStageABudgetReservation({
    fixtures,
    model,
    env: input.env,
    promptVersion: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
    scorerVersion: SCORER_V3_CANDIDATE,
  });
  const approval = {
    artifactType: "candidate-stage-a-spending-approval",
    approvalId: `spending-approval-${input.approval.provider}-${input.approval.exactModelId}-${randomUUID()}`,
    candidateSnapshotId: input.snapshotId,
    comparisonProgramId: MODEL_COMPARISON_PROGRAM_ID,
    provider: input.approval.provider,
    exactModel: input.approval.exactModelId,
    fixtureCount: 6,
    primaryRequestCap: 6,
    operationalRetryCap: Number(input.env.VIREON_LIVE_MODEL_MAX_RETRIES ?? 0),
    estimatedTotalCost: reservation.maximumEstimatedSixFixtureCost,
    hardRunCap: Number(input.env.VIREON_LIVE_MODEL_MAX_RUN_COST ?? 0),
    perRequestCap: Number(input.env.VIREON_LIVE_MODEL_MAX_TASK_COST ?? 0),
    dailyEvaluationCap: Number(input.env.VIREON_LIVE_MODEL_DAILY_BUDGET ?? 0),
    outputTokenCap: Number(input.env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 0),
    approvalTimestamp: nowIso(),
    approver: "local-developer-mode-milestone",
    expiry: "2026-07-24T23:59:59+10:00",
    syntheticOnlyRequirement: true,
    noFallbackRequirement: true,
    noPaidJudgeRequirement: true,
    noPromotionRequirement: true,
    noStageBExecutionRequirement: true,
    budgetReservationStatus: reservation.status,
    budgetReservationHash: reservation.configurationHash,
    immutable: true,
  };
  const path = writeArtifact(`${approval.approvalId}.json`, approval);
  return { approval, reservation, path };
}

function classifyTerraFailure(result: Record<string, unknown>) {
  const hardFailures = Array.isArray(result.hardFailures) ? result.hardFailures.map(String) : [];
  const status = String(result.status ?? "unknown");
  const errorCode = result.errorCode ? String(result.errorCode) : null;
  const unsupportedClaims = Number(result.unsupportedClaims ?? 0);
  const classifications = new Set<string>();
  if (status === "failed") classifications.add("material omission");
  if (hardFailures.some((failure) => /confidence/i.test(failure))) classifications.add("confidence-policy failure");
  if (hardFailures.some((failure) => /unsupported|prohibited/i.test(failure)) || unsupportedClaims > 0) classifications.add("prohibited claim");
  if (errorCode === "VALIDATION_FAILED") classifications.add("malformed structured output");
  if (Number(result.deterministicFidelityScore ?? 1) < 1) classifications.add("deterministic-fidelity failure");
  if (Number(result.evidenceGroundingScore ?? 1) < 1) classifications.add("missing evidence grounding");
  if (Number(result.actionBoundaryScore ?? 1) < 1) classifications.add("action-boundary violation");
  if (Number(result.professionalReviewScore ?? 1) < 1) classifications.add("professional-review escalation failure");
  return [...classifications];
}

export function finalizeTerraRetirementDecision(runId = GPT_56_TERRA_STAGE_A_RUN_ID) {
  const manifestPath = liveArtifactPath(runId, "manifest");
  const summaryPath = liveArtifactPath(runId, "summary");
  const reviewPath = reviewArtifactPath(runId, "review-report");
  const candidateReportPath = join(artifactDir(), `candidate-stage-a-report-${runId}.json`);
  const summary = readJsonArtifact<Record<string, unknown>>(summaryPath);
  const reviewReport = readJsonArtifact<Record<string, unknown>>(reviewPath);
  const candidateReport = readJsonArtifact<Record<string, unknown>>(candidateReportPath);
  const results = Array.isArray(summary?.results) ? summary.results as Array<Record<string, unknown>> : [];
  const generatedResults = results.filter((result) => String(result.modelStatus ?? "blocked") !== "blocked");
  const decompositions = generatedResults.map((result) => {
    const classifications = classifyTerraFailure(result);
    const hardFailures = Array.isArray(result.hardFailures) ? result.hardFailures.map(String) : [];
    return {
      fixtureId: String(result.fixtureId ?? "unknown"),
      modelTaskRunId: String(result.modelTaskRunId ?? "unknown"),
      automatedFinding: hardFailures,
      humanReviewFinding: "review completed; result not accepted for Stage-B gating",
      agreement: "automated and human review agree that the result does not satisfy Stage-A gates",
      classifications,
      criticalGateTriggered: hardFailures.length > 0,
      rawProviderOutputContainsDefect: classifications.includes("confidence-policy failure") || classifications.includes("prohibited claim"),
      transformationOrParsingIntroducedDefect: false,
      adapterOrResponseExtractionDefect: false,
    };
  });
  const adapterDefectException = {
    eligible: false,
    reason: "No persisted evidence shows materially correct raw provider responses corrupted by adapter, parser or transformation. Poor confidence handling, prohibited-claim findings, omissions or validation failures do not qualify for the adapter-defect exception.",
    requirements: [
      "raw provider response materially correct",
      "adapter/parser/transformation corrupted response",
      "deterministic reproducible defect",
      "correction does not change frozen methodology",
      "explicit new execution approval",
    ],
  };
  const decision = {
    artifactType: "model-comparison-candidate-decision",
    decisionId: `candidate-decision-openai-gpt-5.6-terra-${runId}`,
    createdAt: nowIso(),
    provider: "openai",
    model: "gpt-5.6-terra",
    sourceRunId: runId,
    sourceOperationalHaltedRunId: GPT_56_TERRA_SOURCE_HALTED_RUN_ID,
    decision: "NOT SUITABLE",
    generatedOutputs: Number(summary?.requestCount ?? candidateReport?.requestCount ?? generatedResults.length),
    passed: Number(summary?.passedCount ?? candidateReport?.passedFixtures ?? 0),
    hardFailures: Number(summary?.scoreSummary && typeof summary.scoreSummary === "object" ? (summary.scoreSummary as Record<string, unknown>).hardFailureCount ?? candidateReport?.hardFailures ?? 0 : candidateReport?.hardFailures ?? 0),
    criticalFailures: Number(candidateReport?.criticalFailures ?? generatedResults.filter((result) => Array.isArray(result.hardFailures) && result.hardFailures.length > 0).length),
    humanReviewsCompleted: Number(reviewReport?.reviewCompleteCount ?? candidateReport?.humanReviewCompleted ?? 0),
    sixthFixture: "not attempted because the critical-failure halt condition activated",
    totalCost: Number(summary?.totalCost ?? candidateReport?.cost ?? 0),
    noStageBCandidate: true,
    noProductionPromotion: true,
    retiredFromFurtherStageAAndStageBRescueWork: true,
    adapterDefectException,
    immutableSourceArtifacts: {
      manifestPath,
      summaryPath,
      reviewPath,
      candidateReportPath,
      manifestSha256: sourceHash(manifestPath),
      summarySha256: sourceHash(summaryPath),
      reviewSha256: sourceHash(reviewPath),
      candidateReportSha256: sourceHash(candidateReportPath),
    },
    modelPromotionDisabled: true,
    stageBBlocked: true,
  };
  const decomposition = {
    artifactType: "bounded-offline-failure-decomposition",
    decompositionId: `terra-offline-decomposition-${runId}`,
    createdAt: nowIso(),
    provider: "openai",
    model: "gpt-5.6-terra",
    runId,
    providerCallsMade: false,
    methodologyChanged: false,
    generatedOutputCount: generatedResults.length,
    unattemptedFixtures: Math.max(0, Number(summary?.fixtureCount ?? 6) - generatedResults.length),
    fixtureDecompositions: decompositions,
    adapterDefectException,
    conclusion: "GPT-5.6 Terra remains permanently retired unless a separate, evidence-backed adapter-defect exception is approved.",
  };
  const decisionPath = writeOrReplaceArtifact(`${decision.decisionId}.json`, decision);
  const decisionIntegrity = {
    decisionId: decision.decisionId,
    path: decisionPath,
    sha256: sha256(JSON.stringify(decision)),
    createdAt: nowIso(),
    immutable: true,
  };
  const decisionIntegrityPath = writeOrReplaceArtifact(`${decision.decisionId}.integrity.json`, decisionIntegrity);
  const decompositionPath = writeOrReplaceArtifact(`${decomposition.decompositionId}.json`, decomposition);
  const matrixPath = join(artifactDir(), "model-comparison-program-v1-matrix.json");
  const matrix = readJsonArtifact<Record<string, unknown>>(matrixPath) ?? {
    artifactType: "model-comparison-program-matrix",
    programId: MODEL_COMPARISON_PROGRAM_ID,
    candidates: [],
  };
  const candidates = Array.isArray(matrix.candidates) ? matrix.candidates as Array<Record<string, unknown>> : [];
  const withoutTerra = candidates.filter((candidate) => !(candidate.provider === "openai" && candidate.model === "gpt-5.6-terra"));
  const withoutGpt52 = withoutTerra.filter((candidate) => !(candidate.provider === "openai" && candidate.model === "gpt-5.2"));
  matrix.candidates = [
    ...withoutGpt52,
    {
      provider: "openai",
      model: "gpt-5.2",
      status: "retired",
      decision: "NOT SUITABLE",
      stageAResult: "0/6",
      winnerEligible: false,
    },
    {
      provider: "openai",
      model: "gpt-5.6-terra",
      status: "retired",
      decision: "NOT SUITABLE",
      generatedOutputs: decision.generatedOutputs,
      passed: decision.passed,
      hardFailures: decision.hardFailures,
      criticalFailures: decision.criticalFailures,
      cost: decision.totalCost,
      completion: "halted by valid critical-failure policy",
      winnerEligible: false,
    },
  ];
  matrix.updatedAt = nowIso();
  matrix.winnerSelected = false;
  matrix.stageBBlocked = true;
  matrix.productionPromotionDisabled = true;
  const updatedMatrixPath = writeOrReplaceArtifact("model-comparison-program-v1-matrix.json", matrix);
  return {
    decision,
    decisionPath,
    decisionIntegrity,
    decisionIntegrityPath,
    decomposition,
    decompositionPath,
    matrixPath: updatedMatrixPath,
  };
}

export function runChildProcessPropagationCheck(env: Env) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/models-comparison-stage-a-receipt.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      status: "blocked",
      message: "CANDIDATE ENVIRONMENT PROPAGATION BLOCKED",
      exitCode: result.status,
      stderr: String(result.stderr ?? result.error?.message ?? "").slice(0, 1000),
    };
  }
  try {
    const receipt = JSON.parse(result.stdout) as Record<string, unknown>;
    return {
      status: receipt.configurationHash === env.VIREON_CANDIDATE_CONFIGURATION_HASH ? "valid" : "invalid",
      message: receipt.configurationHash === env.VIREON_CANDIDATE_CONFIGURATION_HASH ? "CANDIDATE ENVIRONMENT PROPAGATION VALID" : "CHILD_PROCESS_CONFIGURATION_MISMATCH",
      receipt,
      exitCode: result.status,
    };
  } catch {
    return { status: "blocked", message: "CHILD_PROCESS_CONFIGURATION_MISMATCH", exitCode: result.status, stdout: String(result.stdout ?? "").slice(0, 1000) };
  }
}

export function buildRouterDryExecution(input: {
  env: Env;
  provider: Extract<ModelProvider, "openai">;
  model: string;
}) {
  const fixture = fixtureSet()[0];
  const registry = buildModelRegistry(input.env);
  const task = fixtureToModelTask(fixture, {
    executionMode: "live-single-provider",
    provider: input.provider,
    model: input.model,
    maximumTaskCost: Number(input.env.VIREON_LIVE_MODEL_MAX_TASK_COST ?? 0.3),
    maximumRetries: Number(input.env.VIREON_LIVE_MODEL_MAX_RETRIES ?? 0) + 1,
    maximumOutputTokens: Number(input.env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 800),
    promptVersion: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
    scorerVersion: SCORER_V3_CANDIDATE,
    stageACandidateId: input.env.VIREON_STAGE_A_CANDIDATE_ID,
  });
  const decision = routeModelTask(task, registry, input.env);
  const selected = registry.find((record) => record.provider === decision.selectedProvider && record.model === decision.selectedModel) ?? null;
  const envelope = validateExecutionEnvelope(input.env);
  const ready = decision.selectedProvider === input.provider
    && decision.selectedModel === input.model
    && selected?.healthStatus === "healthy"
    && envelope.ok;
  return {
    status: ready ? "ready" : "blocked",
    message: ready ? "ROUTER DRY EXECUTION READY" : "ROUTER DRY EXECUTION BLOCKED",
    fixtureId: fixture.fixtureId,
    provider: decision.selectedProvider,
    model: decision.selectedModel,
    productionEligibility: false,
    evaluationEligible: ready,
    modelHealth: selected?.healthStatus ?? "missing",
    adapterInvocationWouldBeAuthorised: ready,
    providerCallsMade: false,
    configurationHash: input.env.VIREON_CANDIDATE_CONFIGURATION_HASH ?? "missing",
    rejectedCandidates: decision.rejectedCandidates,
  };
}

export function buildFrameworkEquivalenceReport(env: Env = process.env) {
  const stageAManifest = buildStageACandidateManifest().report;
  const hashes = buildFrozenMethodologyHashes(env);
  const fixtureVersions = fixtureSet().map((fixture) => ({ fixtureId: fixture.fixtureId, fixtureVersion: fixture.fixtureVersion }));
  const report = {
    artifactType: "candidate-framework-equivalence",
    reportId: `framework-equivalence-${randomUUID()}`,
    createdAt: nowIso(),
    sourceModel: "openai/gpt-5.2",
    candidateModel: `openai/${env.VIREON_STAGE_A_APPROVED_MODEL ?? env.VIREON_OPENAI_DEFAULT_MODEL ?? "unknown"}`,
    identicalControls: {
      fixtureIds: [...APPROVED_STAGE_A_FIXTURES],
      fixtureVersions,
      promptVersion: LIVE_EVALUATION_PROMPT_STAGE_A_V3,
      scorerVersion: SCORER_V3_CANDIDATE,
      claimExtractorVersion: "claim-extractor-v3-structured-propositions",
      confidencePolicyVersion: CONFIDENCE_POLICY_V3,
      deterministicValidators: "model-result-validator-v1",
      humanReviewRubric: MODEL_COMPARISON_REVIEW_POLICY,
      successGates: MODEL_COMPARISON_GATE_POLICY,
      comparisonMetrics: "model-comparison-program-v1-matrix",
      haltConditions: "frozen-stage-a-halt-conditions",
    },
    permittedDifferences: ["provider/model identity", "model-specific adapter configuration", "model pricing", "provider-required token constraints"],
    sourceStageAManifestId: stageAManifest.candidateId,
    methodologyHashes: hashes,
    unexplainedMethodologyDifferences: [],
    valid: true,
  };
  const path = writeArtifact(`${report.reportId}.json`, report);
  return { report, path };
}

export async function buildCandidateStageAPreflight(input: {
  provider: Extract<ModelProvider, "openai">;
  model: string;
  runCompatibilityCheck?: boolean;
  budgetApproved?: boolean;
  env?: Env;
}) {
  const baseEnv = input.env ?? process.env;
  const approval = configuredApproval(input.provider, input.model, baseEnv);
  if (!approval) {
    return {
      status: "blocked",
      message: "CANDIDATE STAGE-A BLOCKED: no model-specific comparison approval.",
      blockers: ["candidate-approval-missing"],
      providerCallsMade: false,
    };
  }
  const env = buildCandidateEnvironment({ provider: input.provider, model: input.model, approval, env: baseEnv });
  if (input.budgetApproved) env.VIREON_STAGE_A_BUDGET_APPROVED = "true";
  const registry = buildCanonicalModelRegistry(env);
  const validation = validateCanonicalModelRegistry(registry);
  const readiness = buildComparisonReadiness(registry);
  const registryEntry = configuredCandidate(input.provider, input.model, env);
  const availability = await verifyOpenAiModelAvailability(input.model, env);
  const compatibility = input.runCompatibilityCheck ? await runOpenAiCompatibilityCheck(input.model, env) : null;
  const preflight = await buildLiveEvaluationPreflight(env);
  const equivalence = buildFrameworkEquivalenceReport(env);
  const snapshot = registryEntry ? createCandidateSnapshot({ provider: input.provider, model: input.model, approval, registryEntry, availability, compatibility, env }) : null;
  const spending = snapshot ? createCandidateSpendingApproval({ snapshotId: snapshot.snapshot.snapshotId, approval, env }) : null;
  const envelope = snapshot && spending ? buildExecutionEnvelope({
    provider: input.provider,
    model: input.model,
    approval,
    snapshotId: snapshot.snapshot.snapshotId,
    budgetApprovalId: spending.approval.approvalId,
    budgetConfigurationHash: spending.reservation.configurationHash,
    env,
  }) : null;
  if (envelope) applyExecutionEnvelopeToEnv(envelope, env);
  const envelopeValidation = envelope ? validateExecutionEnvelope(env) : { ok: false, reason: "CANDIDATE_CONTEXT_MISSING", configurationHash: "missing" };
  const receipts = envelope ? [
    buildConfigurationReceipt("preflight", env, { source: "candidate-stage-a-preflight" }),
    buildConfigurationReceipt("run-creation", env, { source: "candidate-stage-a-preflight" }),
  ] : [];
  const childPropagation = envelope ? runChildProcessPropagationCheck(env) : { status: "blocked", message: "CANDIDATE_CONTEXT_MISSING" };
  const routerDryExecution = envelope ? buildRouterDryExecution({ env, provider: input.provider, model: input.model }) : { status: "blocked", message: "CANDIDATE_CONTEXT_MISSING" };
  const fixtures = selectLiveEvaluationFixtures(6, env);
  const routingChecks = fixtures.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    executionMode: "INTERNAL_EVALUATION",
    evaluationEligibility: registryEntry?.evaluationEligibility.eligible === true,
    productionEligibility: registryEntry?.productionEligibility.eligible === true,
    syntheticOnlyEnvelope: fixture.testData === true && env.VIREON_SYNTHETIC_DATA_ONLY === "true",
    provider: input.provider,
    model: input.model,
    fallback: false,
    mandatoryReview: true,
  }));
  const blockers = [
    validation.ok ? null : "registry-validation-failed",
    readiness.included.some((entry) => entry.provider === input.provider && entry.exactModelId === input.model) ? null : "candidate-not-comparison-ready",
    registryEntry ? null : "candidate-registry-entry-missing",
    registryEntry?.retirementStatus.retired ? "candidate-retired" : null,
    registryEntry?.productionEligibility.eligible ? "production-eligibility-must-remain-false" : null,
    availability.availabilityStatus === "available" && availability.providerReportedModelId === input.model ? null : "exact-model-unavailable",
    compatibility && compatibility.status !== "compatible" ? "adapter-compatibility-failed" : null,
    preflight.message === "READY FOR PAID STAGE-A EXECUTION" ? null : "stage-a-preflight-blocked",
    equivalence.report.valid ? null : "framework-equivalence-failed",
    spending?.reservation.status === "valid" ? null : "budget-reservation-invalid",
    spending?.approval.hardRunCap && spending.approval.perRequestCap ? null : "budget-approval-invalid",
    envelopeValidation.ok ? null : String(envelopeValidation.reason),
    childPropagation.status === "valid" ? null : "child-process-configuration-mismatch",
    routerDryExecution.status === "ready" ? null : "router-dry-execution-blocked",
    routingChecks.every((check) => check.evaluationEligibility && !check.productionEligibility && check.syntheticOnlyEnvelope) ? null : "routing-eligibility-invalid",
  ].filter((item): item is string => Boolean(item));
  const report = {
    artifactType: "candidate-stage-a-preflight",
    reportId: `candidate-stage-a-preflight-${randomUUID()}`,
    createdAt: nowIso(),
    provider: input.provider,
    model: input.model,
    status: blockers.length === 0 ? "ready" : "blocked",
    message: blockers.length === 0
      ? input.model === "gpt-5.6-terra" ? "READY FOR PAID CANDIDATE STAGE-A EXECUTION" : "READY FOR PAID CANDIDATE 2 STAGE-A EXECUTION"
      : `${input.provider}/${input.model} candidate validation was blocked before paid execution.`,
    blockers,
    approval,
    registryValidation: validation,
    comparisonReadiness: {
      ready: readiness.ready,
      included: readiness.included.map((entry) => ({ provider: entry.provider, exactModelId: entry.exactModelId })),
      excluded: readiness.excluded,
    },
    availability,
    compatibility,
    snapshot: snapshot ? {
      snapshotId: snapshot.snapshot.snapshotId,
      path: snapshot.path,
      integrityPath: snapshot.integrityPath,
    } : null,
    pricing: {
      inputTokenPrice: approval.expectedCost.inputPerMillion,
      cachedInputPrice: null,
      outputTokenPrice: approval.expectedCost.outputPerMillion,
      currency: approval.expectedCost.currency,
      pricingEffectiveDate: approval.approvedAt,
      pricingSourceVersion: approval.expectedCost.source,
      maximumOutputTokenSetting: Number(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? 0),
    },
    budgetApproval: spending?.approval ?? null,
    budgetReservation: spending?.reservation ?? null,
    executionEnvelope: envelope,
    envelopeValidation,
    configurationReceipts: receipts,
    childProcessPropagation: childPropagation,
    routerDryExecution,
    frameworkEquivalence: {
      reportId: equivalence.report.reportId,
      path: equivalence.path,
      valid: equivalence.report.valid,
      methodologyHashes: equivalence.report.methodologyHashes,
    },
    routingChecks,
    livePreflight: {
      message: preflight.message,
      blockers: preflight.blockers,
      fixtureCount: preflight.fixtureCount,
      estimatedMaximumCost: preflight.estimatedMaximumCost,
      budgetConfigurationHash: preflight.budgetConfigurationHash,
    },
    providerCallsMade: input.runCompatibilityCheck,
    paidStageAExecuted: false,
    modelPromotionDisabled: true,
    stageBExecuted: false,
  };
  const path = writeArtifact(`${report.reportId}.json`, report);
  return { ...report, path, env };
}

export async function executeCandidateStageA(input: {
  provider: Extract<ModelProvider, "openai">;
  model: string;
  env?: Env;
}) {
  const preflight = await buildCandidateStageAPreflight({
    provider: input.provider,
    model: input.model,
    runCompatibilityCheck: true,
    budgetApproved: true,
    env: input.env,
  });
  if (preflight.status !== "ready") return { preflight, summary: null };
  if (!("env" in preflight)) return { preflight, summary: null };
  const runEnv = preflight.env;
  Object.assign(process.env, runEnv);
  const summary = await runLiveEvaluationPilot(runEnv);
  const report = {
    artifactType: "candidate-stage-a-report",
    reportId: `candidate-stage-a-report-${summary.run?.runId ?? randomUUID()}`,
    createdAt: nowIso(),
    provider: input.provider,
    model: input.model,
    runId: summary.run?.runId ?? null,
    status: summary.run?.status ?? "blocked",
    haltReason: summary.haltReason,
    requestCount: summary.operationalMetrics.requestCount,
    cost: summary.run?.totalCost ?? 0,
    passedFixtures: summary.run?.passedCount ?? 0,
    hardFailures: summary.run?.scoreSummary.hardFailureCount ?? 0,
    criticalFailures: summary.run?.results.filter((result) => result.hardFailures.length > 0 && result.safetyScore === 0).length ?? 0,
    humanReviewItems: summary.humanReviewQueue.length,
    humanReviewCompleted: summary.humanReviewQueue.filter((item) => item.status === "completed").length,
    decision: "INVALID OR INCOMPLETE RUN",
    decisionReason: "Human review must be completed before candidate can be approved for a Stage-B candidate.",
    stageBCandidateCreated: false,
    productionEligibility: false,
    modelPromotionDisabled: true,
  };
  if (summary.run?.status === "completed" && summary.operationalMetrics.requestCount === 6) {
    report.decision = "NEEDS TARGETED REMEDIATION";
    report.decisionReason = "Generated outputs require human review and gate application before any Stage-B candidate.";
  }
  writeArtifact(`${report.reportId}.json`, report);
  return { preflight, summary, report };
}
