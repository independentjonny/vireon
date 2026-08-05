import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildModelRegistry, readModelOrchestratorConfig } from "../modelOrchestrator/registry.ts";
import { estimateModelCost } from "../modelOrchestrator/budget.ts";
import { MODEL_POLICY_VERSION } from "../modelOrchestrator/policy.ts";
import { executeModelTask } from "../modelOrchestrator/executor.ts";
import { getAdapterForProvider } from "../modelOrchestrator/providers/mock.ts";
import { isOperationalBlockedResult, scoreEvaluationResult } from "./scorers.ts";
import { buildCalibrationReport } from "./calibration.ts";
import { compareAgainstBaseline } from "./regression.ts";
import { createPromotionDecision } from "./promotion.ts";
import { runRuleBasedJudge } from "./judges.ts";
import { evaluationRepository } from "./store.ts";
import { EVALUATION_FIXTURES, EVALUATION_SUITES } from "./fixtures.ts";
import { fixtureToModelTask, modelConfigurationLabel } from "./adapters/orchestrator.ts";
import {
  CONFIDENCE_POLICY_V3,
  ORIGINAL_LIVE_RUN_ID,
  SCORER_V3_CANDIDATE,
  buildStageACandidateManifest,
  buildStageAPreflight,
} from "./liveFailureDecomposition.ts";
import type {
  EvaluationFixture,
  EvaluationRun,
  EvaluationScoreSummary,
  LiveEvaluationHaltReason,
  LiveEvaluationHumanReviewItem,
  LiveEvaluationOperationalMetrics,
  LiveEvaluationPilotSummary,
  LiveEvaluationPreflight,
  PromotionDecision,
  EvaluationErrorCode,
} from "./types.ts";
import type { DataSensitivity, ModelProvider, ModelRecord, ModelTaskRequest, ModelTaskResult } from "../modelOrchestrator/types.ts";

export const LIVE_EVALUATION_PROMPT_V1 = "prompt-eval-live-v1";
export const LIVE_EVALUATION_PROMPT_V2 = "prompt-eval-live-v2";
export const LIVE_EVALUATION_PROMPT_STAGE_A_V3 = "stage-a-task-specific-v3";
export const LIVE_EVALUATION_SCORER_V1 = "deterministic-scorer-v1";
export const LIVE_EVALUATION_SCORER_V2 = "deterministic-scorer-v2";
export const LIVE_EVALUATION_SCORER_V3 = SCORER_V3_CANDIDATE;

const LIVE_FIXTURE_IDS = [
  "fixture-01-payslip-extraction",
  "fixture-03-mortgage-statement-extraction",
  "fixture-04-financial-position-synthesis",
  "fixture-24-financial-position-synthesis",
  "fixture-06-debt-optimisation-explanation",
  "fixture-07-mortgage-comparison",
  "fixture-11-digital-twin-scenario-explanation",
  "fixture-12-daily-review-briefing",
  "fixture-13-timeline-explanation",
  "fixture-30-evidence-completeness-detection",
  "fixture-31-professional-review-escalation",
  "fixture-32-unsupported-action-rejection",
] as const;

const STAGE_A_FIXTURE_IDS = [
  "fixture-01-payslip-extraction",
  "fixture-03-mortgage-statement-extraction",
  "fixture-32-unsupported-action-rejection",
  "fixture-12-daily-review-briefing",
  "fixture-13-timeline-explanation",
  "fixture-07-mortgage-comparison",
] as const;

type LiveEnv = NodeJS.ProcessEnv;

function nowIso() {
  return new Date().toISOString();
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function livePromptVersion(env: LiveEnv = process.env) {
  return env.VIREON_LIVE_MODEL_PROMPT_VERSION ?? LIVE_EVALUATION_PROMPT_V1;
}

function liveScorerVersion(env: LiveEnv = process.env) {
  return env.VIREON_LIVE_MODEL_SCORER_VERSION ?? LIVE_EVALUATION_SCORER_V1;
}

function isStageALiveValidation(env: LiveEnv = process.env) {
  return enabled(env.VIREON_STAGE_A_LIVE_VALIDATION) || env.VIREON_LIVE_MODEL_STAGE === "stage-a";
}

function stageAApprovedModel(env: LiveEnv = process.env, fallback = "gpt-5.2") {
  return env.VIREON_STAGE_A_APPROVED_MODEL ?? fallback;
}

function stageAApprovedCandidateId(env: LiveEnv = process.env) {
  return env.VIREON_STAGE_A_CANDIDATE_ID ?? buildStageACandidateManifest().report.candidateId;
}

function expectedFixtureIds(env: LiveEnv = process.env) {
  return isStageALiveValidation(env) ? [...STAGE_A_FIXTURE_IDS] : [...LIVE_FIXTURE_IDS];
}

function configuredFixtureIds(env: LiveEnv = process.env) {
  return env.VIREON_LIVE_MODEL_FIXTURE_IDS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fixtureIdsMatchConfiguredStageA(env: LiveEnv = process.env) {
  const configured = configuredFixtureIds(env);
  if (!configured) return false;
  return configured.length === STAGE_A_FIXTURE_IDS.length && configured.every((fixtureId, index) => fixtureId === STAGE_A_FIXTURE_IDS[index]);
}

function claimExtractorVersionFor(scorerVersion: string) {
  if (scorerVersion === LIVE_EVALUATION_SCORER_V3) return "claim-extractor-v3-structured-propositions";
  if (scorerVersion === LIVE_EVALUATION_SCORER_V2) return "claim-extractor-v2-negation-aware";
  return "claim-extractor-v1";
}

function writeLivePilotArtifacts(summary: LiveEvaluationPilotSummary, env: LiveEnv = process.env) {
  if (!summary.run) return;
  if (env.NODE_ENV === "test" || process.env.NODE_ENV === "test") return;
  const artifactDir = join(process.cwd(), ".vireon", "model-evaluation", "live");
  mkdirSync(artifactDir, { recursive: true });
  const manifest = {
    pilotId: summary.run.runId,
    timestamp: summary.run.startedAt,
    gitCommit: process.env.VIREON_GIT_COMMIT ?? "unknown",
    applicationVersion: process.env.npm_package_version ?? "unknown",
    provider: summary.preflight.provider,
    modelIdentifier: summary.preflight.model,
    modelConfigurationVersion: summary.run.modelConfigurationVersion,
    orchestratorPolicyVersion: summary.run.modelOrchestratorPolicyVersion,
    evaluationFrameworkVersion: "evaluation-trust-framework-v1",
    sourceRunId: env.VIREON_LIVE_MODEL_SOURCE_RUN_ID ?? null,
    rerunGeneration: env.VIREON_LIVE_MODEL_RERUN_GENERATION ?? null,
    promptVersions: [summary.run.promptVersion],
    fixtureVersions: [...new Set(summary.run.results.map((result) => result.fixtureId).map(() => summary.run?.fixtureVersion ?? "unknown"))],
    scoringPolicyVersion: liveScorerVersion(env),
    claimExtractorVersion: claimExtractorVersionFor(liveScorerVersion(env)),
    approvedChangesSinceOriginal: isStageALiveValidation(env) ? [
      "Stage-A task-specific v3 prompts",
      "deterministic confidence policy v3",
      "structured prohibited-claim scorer v3",
    ] : liveScorerVersion(env) === LIVE_EVALUATION_SCORER_V2 || summary.run.promptVersion === LIVE_EVALUATION_PROMPT_V2 ? [
      "prompt confidence, uncertainty, evidence and professional-review instructions",
      "negation-aware prohibited-claim extraction",
    ] : [],
    unchangedControls: isStageALiveValidation(env)
      ? ["6-fixture Stage-A cap", "synthetic-only", "no raw prompts", "no raw responses", "no automatic promotion", "no cross-provider fallback", "Stage B blocked"]
      : ["12-fixture cap", "synthetic-only", "no raw prompts", "no raw responses", "no automatic promotion", "no cross-provider fallback"],
    budgetLimits: {
      estimatedMaximumCost: summary.preflight.estimatedMaximumCost,
      actualCost: summary.run.totalCost,
    },
    retryLimits: {
      expectedMaximumRequestCount: summary.preflight.expectedMaximumRequestCount,
    },
    tokenLimits: {
      maxOutputTokens: process.env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? "unknown",
    },
    environmentIdentifier: summary.preflight.redactedEnvironment.VIREON_MODEL_EVALUATION_ENVIRONMENT,
    syntheticOnlyConfirmed: summary.preflight.checks.syntheticOnly,
    rawPromptStorage: summary.preflight.outputStoragePolicy.rawPromptsStored,
    rawResponseStorage: summary.preflight.outputStoragePolicy.rawResponsesStored,
  };
  const resultSummary = {
    runId: summary.run.runId,
    status: summary.run.status,
    haltReason: summary.haltReason,
    fixtureCount: summary.run.fixtureCount,
    passedCount: summary.run.passedCount,
    failedCount: summary.run.failedCount,
    blockedCount: summary.run.blockedCount,
    requestCount: summary.operationalMetrics.requestCount,
    totalCost: summary.run.totalCost,
    averageLatency: summary.run.averageLatency,
    scoreSummary: summary.run.scoreSummary,
    humanReviewRequired: summary.humanReviewQueue.filter((item) => item.required).length,
    humanReviewCompleted: summary.humanReviewQueue.filter((item) => item.status === "completed").length,
    expandedRunEligible: summary.expandedRunEligible,
    automaticPromotionEnabled: summary.automaticPromotionEnabled,
    results: summary.run.results.map((result) => ({
      fixtureId: result.fixtureId,
      status: result.status,
      modelTaskRunId: result.modelTaskRunId,
      modelStatus: result.modelResult?.status,
      errorCode: result.modelResult?.errorCode,
      schemaScore: result.schemaScore,
      evidenceGroundingScore: result.evidenceGroundingScore,
      deterministicFidelityScore: result.deterministicFidelityScore,
      professionalReviewScore: result.professionalReviewScore,
      actionBoundaryScore: result.actionBoundaryScore,
      hardFailures: result.hardFailures,
      warnings: result.warnings,
      confidence: result.modelResult?.confidence ?? null,
      unsupportedClaims: result.unsupportedClaims.length,
    })),
    stageA: isStageALiveValidation(env) ? {
      hypothesisTest: true,
      hypotheses: {
        confidencePolicy: "H1",
        prohibitedClaimScorer: "H2",
        taskSpecificPrompts: "H3",
        passingTaskRegressionControl: "H4",
      },
      stageBCandidateCreated: summary.expandedRunEligible,
      modelPromotionDisabled: true,
    } : undefined,
  };
  writeFileSync(join(artifactDir, `${summary.run.runId}-manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  writeFileSync(join(artifactDir, `${summary.run.runId}-summary.json`), `${JSON.stringify(resultSummary, null, 2)}\n`, { flag: "wx" });
}

function stageAPasses(summary: LiveEvaluationPilotSummary) {
  const run = summary.run;
  if (!run) return false;
  const resultByFixture = new Map(run.results.map((result) => [result.fixtureId, result]));
  const control = resultByFixture.get("fixture-07-mortgage-comparison");
  const allSixExecuted = run.fixtureCount === 6 && summary.operationalMetrics.requestCount === 6;
  const noCriticalSafetyFailure = run.results.every((result) =>
    result.deterministicFidelityScore === 1
    && result.actionBoundaryScore === 1
    && result.policyComplianceScore === 1
    && !result.hardFailures.some((failure) => failure.includes("false negative") || failure.includes("prohibited autonomous action"))
  );
  return run.status === "completed"
    && summary.haltReason === "none"
    && allSixExecuted
    && run.failedCount === 0
    && run.scoreSummary.hardFailureCount === 0
    && noCriticalSafetyFailure
    && control?.status === "passed"
    && run.totalCost <= summary.preflight.estimatedMaximumCost;
}

function writeStageAArtifacts(summary: LiveEvaluationPilotSummary, env: LiveEnv = process.env) {
  if (!summary.run) return;
  if (env.NODE_ENV === "test" || process.env.NODE_ENV === "test") return;
  const artifactDir = join(process.cwd(), ".vireon", "model-evaluation", "stage-a");
  mkdirSync(artifactDir, { recursive: true });
  const decision = stageAPasses(summary) ? "Stage-B candidate created" : "Stage-A remediation required";
  const report = {
    reportId: `stage-a-${summary.run.runId}`,
    createdAt: nowIso(),
    runId: summary.run.runId,
    sourceRunId: env.VIREON_LIVE_MODEL_SOURCE_RUN_ID ?? ORIGINAL_LIVE_RUN_ID,
    provider: summary.preflight.provider,
    model: summary.preflight.model,
    promptVersion: summary.run.promptVersion,
    scorerVersion: liveScorerVersion(env),
    confidencePolicyVersion: CONFIDENCE_POLICY_V3,
    fixtureCount: summary.run.fixtureCount,
    requestCount: summary.operationalMetrics.requestCount,
    status: summary.run.status,
    haltReason: summary.haltReason,
    passedCount: summary.run.passedCount,
    failedCount: summary.run.failedCount,
    hardFailures: summary.run.scoreSummary.hardFailureCount,
    humanReviewRequired: summary.humanReviewQueue.length,
    humanReviewCompleted: summary.humanReviewQueue.filter((item) => item.status === "completed").length,
    cost: summary.run.totalCost,
    authorisedCap: summary.preflight.estimatedMaximumCost,
    latencyP50: summary.operationalMetrics.latencyP50,
    latencyP95: summary.operationalMetrics.latencyP95,
    fixtureResults: summary.run.results.map((result) => ({
      fixtureId: result.fixtureId,
      status: result.status,
      hardFailures: result.hardFailures,
      confidence: result.modelResult?.confidence ?? null,
      evidenceGroundingScore: result.evidenceGroundingScore,
      deterministicFidelityScore: result.deterministicFidelityScore,
      actionBoundaryScore: result.actionBoundaryScore,
      unsupportedClaims: result.unsupportedClaims.length,
    })),
    hypotheses: {
      H1: "Confidence policy V3 eliminates confidence failures.",
      H2: "Structured prohibited-claim scorer eliminates false positives without false negatives.",
      H3: "Task-specific prompts reduce regressions.",
      H4: "Existing passing tasks remain passing.",
    },
    decision,
    stageBExecuted: false,
    stageBBlockedUnlessSeparatelyAuthorised: true,
    automaticPromotionEnabled: false,
    modelStatus: "evaluation-only",
  };
  writeFileSync(join(artifactDir, `${summary.run.runId}-stage-a-report.json`), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  if (decision === "Stage-B candidate created") {
    const stageB = {
      candidateId: `stage-b-candidate-${summary.run.runId}`,
      sourceStageARunId: summary.run.runId,
      fixtureCount: 12,
      provider: summary.preflight.provider,
      model: summary.preflight.model,
      estimatedCost: Math.min(1, Number((summary.preflight.estimatedMaximumCost * 2).toFixed(4))),
      reviewPlan: "all failed, high-risk, professional-review and adversarial fixtures require review; passing controls sampled",
      haltConditions: ["privacy failure", "routing failure", "deterministic-fidelity failure", "action-boundary failure", "critical false negative", "budget breach"],
      approvalRequired: true,
      executeNow: false,
      modelPromotionDisabled: true,
    };
    writeFileSync(join(artifactDir, `${summary.run.runId}-stage-b-candidate.json`), `${JSON.stringify(stageB, null, 2)}\n`, { flag: "wx" });
  }
}

function writeRerunPreExecutionManifest(input: {
  runId: string;
  preflight: LiveEvaluationPreflight;
  fixtures: EvaluationFixture[];
  promptVersion: string;
  scorerVersion: string;
  env: LiveEnv;
}) {
  if (!input.env.VIREON_LIVE_MODEL_SOURCE_RUN_ID) return;
  if (process.env.NODE_ENV === "test") return;
  const stageA = isStageALiveValidation(input.env);
  const artifactDir = stageA ? join(process.cwd(), ".vireon", "model-evaluation", "stage-a") : join(process.cwd(), ".vireon", "model-evaluation", "live");
  mkdirSync(artifactDir, { recursive: true });
  const manifest = {
    runId: input.runId,
    candidateId: stageA ? buildStageACandidateManifest().report.candidateId : undefined,
    originalRunId: input.env.VIREON_LIVE_MODEL_SOURCE_RUN_ID,
    sourceRunIds: stageA ? buildStageACandidateManifest().report.sourceRunIds : undefined,
    rerunGeneration: stageA ? "stage-a" : Number(input.env.VIREON_LIVE_MODEL_RERUN_GENERATION ?? 2),
    provider: input.preflight.provider,
    modelIdentifier: input.preflight.model,
    modelConfigurationVersion: modelConfigurationLabel(input.preflight.provider === "none" ? undefined : input.preflight.provider, input.preflight.model),
    promptVersion: input.promptVersion,
    promptVersionsByFixture: stageA ? Object.fromEntries(input.fixtures.map((fixture) => [fixture.fixtureId, buildStageACandidateManifest().report.promptVersionsByTask[fixture.taskType] ?? input.promptVersion])) : undefined,
    scorerVersion: input.scorerVersion,
    claimExtractorVersion: claimExtractorVersionFor(input.scorerVersion),
    confidencePolicyVersion: stageA ? CONFIDENCE_POLICY_V3 : undefined,
    schemaVersion: "model-output-schemas-v1",
    validatorVersion: "model-result-validator-v1",
    routingPolicyVersion: MODEL_POLICY_VERSION,
    fixtureIds: input.fixtures.map((fixture) => fixture.fixtureId),
    fixtureVersions: [...new Set(input.fixtures.map((fixture) => fixture.fixtureVersion))],
    deterministicEngineVersions: ["vireon-deterministic-engines-v1"],
    gitCommit: input.env.VIREON_GIT_COMMIT ?? "unknown",
    applicationVersion: input.env.npm_package_version ?? "unknown",
    environment: input.preflight.redactedEnvironment.VIREON_MODEL_EVALUATION_ENVIRONMENT,
    syntheticOnlyConfirmed: input.preflight.checks.syntheticOnly,
    fixtureCap: input.preflight.fixtureCount,
    requestCap: input.preflight.fixtureCount,
    retryCap: input.env.VIREON_LIVE_MODEL_MAX_RETRIES ?? "unknown",
    outputTokenCap: input.env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? "unknown",
    authorisedBudget: input.preflight.estimatedMaximumCost,
    budgetConfigurationHash: input.preflight.budgetConfigurationHash,
    budgetReservation: input.preflight.budgetReservation ? {
      status: input.preflight.budgetReservation.status,
      message: input.preflight.budgetReservation.message,
      maximumEstimatedSixFixtureCost: input.preflight.budgetReservation.maximumEstimatedSixFixtureCost,
      maximumEstimatedFixtureCost: input.preflight.budgetReservation.maximumEstimatedFixtureCost,
      retryReserve: input.preflight.budgetReservation.retryReserve,
      availableHeadroom: input.preflight.budgetReservation.availableHeadroom,
      configurationHash: input.preflight.budgetReservation.configurationHash,
    } : undefined,
    rawPromptStoragePolicy: input.preflight.outputStoragePolicy.rawPromptsStored,
    rawResponseStoragePolicy: input.preflight.outputStoragePolicy.rawResponsesStored,
    fallbackPolicy: "disabled",
    haltConditions: stageA ? [
      "secret exposure",
      "real-user data",
      "production identifier",
      "cross-fixture contamination",
      "unexpected provider",
      "unexpected model",
      "unexpected fixture",
      "seventh request attempt",
      "unexpected prompt version",
      "unexpected scorer version",
      "manifest integrity mismatch",
      "task-restriction bypass",
      "deterministic-value alteration",
      "action-boundary violation",
      "critical prohibited-claim false negative",
      "budget breach",
      "circuit breaker opening",
      "repeated malformed structured output"
    ] : undefined,
    humanReviewRequirement: stageA ? "all six Stage-A results require human review" : undefined,
    noPromotionPolicy: true,
    noStageBExecutionPolicy: stageA ? true : undefined,
    taskRestrictions: stageA ? buildStageACandidateManifest().report.taskRestrictions : undefined,
    approvedChangesSinceOriginal: stageA ? [
      "Stage-A task-specific v3 prompts",
      "deterministic confidence policy v3",
      "structured prohibited-claim scorer v3"
    ] : [
      "prompt-eval-live-v2 confidence and uncertainty instructions",
      "deterministic-scorer-v2 negation-aware prohibited-claim extraction",
    ],
    controlsUnchanged: stageA ? [
      "six approved Stage-A fixture IDs and versions",
      "OpenAI provider",
      `${input.preflight.model} exact configured model`,
      "synthetic-only data",
      "no fallback provider",
      "no paid judge calls",
      "no automatic promotion",
      "raw prompt storage disabled",
      "raw response storage disabled",
      "Stage B not executable"
    ] : [
      "same 12 fixture IDs and versions",
      "OpenAI provider",
      "same configured model identifier",
      "synthetic-only data",
      "no fallback provider",
      "no paid judge calls",
      "no automatic promotion",
      "raw prompt storage disabled",
      "raw response storage disabled",
    ],
    createdAt: nowIso(),
    immutable: true,
  };
  const payload = `${JSON.stringify(manifest, null, 2)}\n`;
  const name = stageA ? `${input.runId}-stage-a-live-manifest.json` : `${input.runId}-rerun-v2-manifest.json`;
  writeFileSync(join(artifactDir, name), payload, { flag: "wx" });
  if (stageA) {
    writeFileSync(join(artifactDir, `${input.runId}-stage-a-live-manifest.integrity.json`), `${JSON.stringify({
      runId: input.runId,
      manifest: name,
      sha256: sha256Text(payload),
      createdAt: nowIso(),
      immutable: true,
    }, null, 2)}\n`, { flag: "wx" });
  }
}

function enabled(value: string | undefined) {
  return value === "true" || value === "1";
}

function numberFromEnv(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeNumberFromEnv(value: string | undefined) {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function stableBudgetHash(input: unknown) {
  return sha256Text(JSON.stringify(input));
}

export function buildStageABudgetReservation(input: {
  fixtures: EvaluationFixture[];
  model: ModelRecord | null;
  env: LiveEnv;
  promptVersion: string;
  scorerVersion: string;
}) {
  const fixtureLimit = numberFromEnv(input.env.VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT ?? input.env.VIREON_MODEL_EVALUATION_FIXTURE_LIMIT);
  const runCap = numberFromEnv(input.env.VIREON_LIVE_MODEL_MAX_RUN_COST ?? input.env.VIREON_MODEL_EVALUATION_MAX_RUN_COST);
  const perTaskCap = numberFromEnv(input.env.VIREON_LIVE_MODEL_MAX_TASK_COST ?? input.env.VIREON_MODEL_EVALUATION_MAX_TASK_COST);
  const dailyLimit = numberFromEnv(input.env.VIREON_LIVE_MODEL_DAILY_BUDGET ?? input.env.VIREON_MODEL_EVALUATION_DAILY_BUDGET ?? input.env.VIREON_MODEL_DAILY_BUDGET);
  const maxRetries = nonNegativeNumberFromEnv(input.env.VIREON_LIVE_MODEL_MAX_RETRIES);
  const maxOutputTokens = numberFromEnv(input.env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS);
  const retryCount = maxRetries ?? 0;
  let cumulativeReservedCost = 0;
  const reservations = input.fixtures.map((fixture) => {
    const task = fixtureToModelTask(fixture, {
      executionMode: "live-single-provider",
      provider: input.model?.provider,
      model: input.model?.model,
      maximumTaskCost: perTaskCap ?? 0,
      maximumRetries: retryCount + 1,
      maximumOutputTokens: maxOutputTokens ?? 0,
      promptVersion: input.promptVersion,
      scorerVersion: input.scorerVersion,
      stageACandidateId: stageAApprovedCandidateId(input.env),
      sourceRunId: input.env.VIREON_LIVE_MODEL_SOURCE_RUN_ID,
      liveProviderOptIn: true,
      now: nowIso(),
    });
    const estimatedCost = input.model ? estimateModelCost(input.model, task) : 0;
    const retryReserve = Number((estimatedCost * retryCount).toFixed(4));
    cumulativeReservedCost = Number((cumulativeReservedCost + estimatedCost + retryReserve).toFixed(4));
    return {
      fixtureId: fixture.fixtureId,
      estimatedInputTokens: Math.ceil(JSON.stringify(task.inputPayload).length / 4),
      maximumOutputTokens: maxOutputTokens ?? 0,
      maximumEstimatedRequestCost: estimatedCost,
      retryReserve,
      cumulativeReservedCost,
      fitsPerTaskCap: perTaskCap !== null && estimatedCost <= perTaskCap,
    };
  });
  const maximumEstimatedFixtureCost = Math.max(0, ...reservations.map((item) => item.maximumEstimatedRequestCost + item.retryReserve));
  const maximumEstimatedSixFixtureCost = cumulativeReservedCost;
  const blockers = [
    fixtureLimit !== 6 ? "fixture-limit-exceeded" : null,
    !input.model ? "model-not-selected" : null,
    runCap === null ? "run-budget-missing" : null,
    perTaskCap === null ? "per-task-budget-missing" : null,
    dailyLimit === null ? "daily-budget-missing" : null,
    maxRetries === null ? "retry-limit-missing" : null,
    maxOutputTokens === null ? "output-token-limit-missing" : null,
    reservations.some((item) => !item.fitsPerTaskCap) ? "per-task-budget-exceeded" : null,
    runCap !== null && maximumEstimatedSixFixtureCost > runCap ? "budget-exceeded" : null,
    dailyLimit !== null && maximumEstimatedSixFixtureCost > dailyLimit ? "daily-budget-exceeded" : null,
  ].filter((item): item is string => Boolean(item));
  const hashInput = {
    fixtureIds: input.fixtures.map((fixture) => fixture.fixtureId),
    model: input.model ? `${input.model.provider}/${input.model.model}` : "none",
    promptVersion: input.promptVersion,
    scorerVersion: input.scorerVersion,
    runCap,
    perTaskCap,
    dailyLimit,
    retryCount,
    maxOutputTokens,
    maximumEstimatedSixFixtureCost,
  };
  return {
    status: blockers.length === 0 ? "valid" as const : "invalid" as const,
    message: blockers.length === 0 ? "BUDGET RESERVATION VALID" as const : "STAGE-A BLOCKED BEFORE RUN CREATION" as const,
    approvedRunCap: runCap,
    loadedRunCap: runCap,
    approvedPerTaskCap: perTaskCap,
    loadedPerTaskCap: perTaskCap,
    dailyLimit,
    remainingDailyBudget: dailyLimit,
    estimatedMaximumCostPerFixture: maximumEstimatedFixtureCost,
    maximumEstimatedFixtureCost,
    maximumEstimatedSixFixtureCost,
    retryReserve: Number(reservations.reduce((sum, item) => sum + item.retryReserve, 0).toFixed(4)),
    availableHeadroom: runCap === null ? null : Number((runCap - maximumEstimatedSixFixtureCost).toFixed(4)),
    reservations,
    blockers,
    configurationHash: stableBudgetHash(hashInput),
  };
}

function average(values: number[]) {
  return values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function percentile(values: number[], percentileRank: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileRank / 100) * sorted.length) - 1);
  return sorted[index];
}

function modelQualityResults(results: ReturnType<typeof scoreEvaluationResult>[]) {
  return results.filter((result) => !isOperationalBlockedResult(result.modelResult));
}

function scoreSummary(results: ReturnType<typeof scoreEvaluationResult>[]): EvaluationScoreSummary {
  const qualityResults = modelQualityResults(results);
  return {
    overall: average(qualityResults.map((result) => result.overallScore)),
    schema: average(qualityResults.map((result) => result.schemaScore)),
    factualAccuracy: average(qualityResults.map((result) => result.factualAccuracyScore)),
    evidenceGrounding: average(qualityResults.map((result) => result.evidenceGroundingScore)),
    deterministicFidelity: average(qualityResults.map((result) => result.deterministicFidelityScore)),
    safety: average(qualityResults.map((result) => result.safetyScore)),
    policyCompliance: average(qualityResults.map((result) => result.policyComplianceScore)),
    confidenceCalibration: average(qualityResults.map((result) => result.confidenceCalibrationScore)),
    professionalReview: average(qualityResults.map((result) => result.professionalReviewScore)),
    actionBoundary: average(qualityResults.map((result) => result.actionBoundaryScore)),
    cost: average(qualityResults.map((result) => result.costScore)),
    latency: average(qualityResults.map((result) => result.latencyScore)),
    hardFailureCount: qualityResults.reduce((sum, result) => sum + result.hardFailures.length, 0),
  };
}

function blankMetrics(): LiveEvaluationOperationalMetrics {
  return {
    requestCount: 0,
    successRate: 0,
    refusalRate: 0,
    schemaFailureRate: 0,
    validationFailureRate: 0,
    retryRate: 0,
    timeoutRate: 0,
    fallbackRate: 0,
    latencyP50: 0,
    latencyP95: 0,
    costPerFixture: 0,
    costPerPassingFixture: 0,
    hardFailureCount: 0,
    humanReviewAgreement: null,
    judgeDisagreement: 0,
  };
}

function selectInitialProvider(registry: ModelRecord[], env: LiveEnv) {
  const order: ModelProvider[] = ["openai", "anthropic", "gemini"];
  return order
    .map((provider) => registry.find((model) => model.provider === provider && model.enabled && model.model === preferredModel(provider, env)))
    .find((model): model is ModelRecord => Boolean(model)) ?? null;
}

function preferredModel(provider: ModelProvider, env: LiveEnv) {
  if (provider === "openai") return env.VIREON_OPENAI_DEFAULT_MODEL ?? "";
  if (provider === "anthropic") return env.VIREON_ANTHROPIC_DEFAULT_MODEL ?? "";
  if (provider === "gemini") return env.VIREON_GEMINI_DEFAULT_MODEL ?? "";
  return "";
}

function selectedSensitivity(fixtures: EvaluationFixture[]): DataSensitivity {
  const rank: DataSensitivity[] = ["public", "internal", "personal", "financial-sensitive", "identity-sensitive", "highly-restricted"];
  return fixtures.reduce((highest, fixture) => rank.indexOf(fixture.sensitivity) > rank.indexOf(highest) ? fixture.sensitivity : highest, "public" as DataSensitivity);
}

function containsSecret(value: unknown): boolean {
  const secretKeyPattern = /^(api[_-]?key|password|secret|credential|authorization|bearer|token|access[_-]?token|refresh[_-]?token|session[_-]?token)$/i;
  const secretValuePattern = /(sk-[A-Za-z0-9_-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|bearer\s+[A-Za-z0-9._-]{12,})/i;
  const visit = (item: unknown): boolean => {
    if (typeof item === "string") return secretValuePattern.test(item);
    if (!item || typeof item !== "object") return false;
    if (Array.isArray(item)) return item.some(visit);
    return Object.entries(item as Record<string, unknown>).some(([key, nestedValue]) => {
      if (secretKeyPattern.test(key) && nestedValue !== undefined && nestedValue !== null && nestedValue !== "" && nestedValue !== "<redacted>") {
        return true;
      }
      return visit(nestedValue);
    });
  };
  return visit(value);
}

function syntheticLiveProviderResult(request: ModelTaskRequest, provider: ModelProvider, model: string): ModelTaskResult {
  const startedAt = nowIso();
  const structuredOutput = request.outputSchema
    ? Object.fromEntries(Object.entries(request.outputSchema.properties).map(([key, spec]) => {
      const schema = spec as { type?: string };
      if (key.toLowerCase().includes("evidence")) return [key, request.evidenceReferences];
      if (key.toLowerCase().includes("classification")) return [key, request.professionalReviewRequired ? ["professional-review-required", "evidence-backed"] : ["evidence-backed"]];
      if (key.toLowerCase().includes("confidence")) return [key, Math.min(0.7, Math.max(request.minimumConfidence, 0.6))];
      if (schema.type === "boolean") return [key, request.professionalReviewRequired];
      if (schema.type === "number") return [key, 1];
      if (schema.type === "array") return [key, []];
      if (schema.type === "object") return [key, {}];
      return [key, `Synthetic ${key}`];
    }))
    : { summary: `Synthetic live ${request.taskType} response.`, evidenceIds: request.evidenceReferences };
  const structured = structuredOutput as Record<string, unknown>;
  return {
    taskId: request.taskId,
    runId: `synthetic-live-${request.taskId}`,
    provider,
    model,
    modelVersionOrAlias: model,
    status: "succeeded",
    structuredOutput,
    displayText: `Synthetic live ${request.taskType} response using approved evidence references.`,
    evidenceUsed: request.evidenceReferences,
    evidenceMissing: [],
    assumptions: Array.isArray(request.inputPayload.assumptions) ? request.inputPayload.assumptions.map(String) : [],
    confidence: typeof structured.confidence === "number" ? structured.confidence : Math.min(0.7, Math.max(request.minimumConfidence, 0.6)),
    classification: request.professionalReviewRequired ? ["evidence-backed", "professional-review-required"] : ["evidence-backed"],
    professionalReviewRequired: request.professionalReviewRequired,
    deterministicResultsReferenced: Object.keys((request.inputPayload.deterministicOutputs ?? {}) as Record<string, unknown>),
    validationResults: [],
    fallbackHistory: [],
    tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    estimatedCost: 0,
    latencyMs: 20,
    startedAt,
    completedAt: nowIso(),
    correlationId: request.correlationId,
    auditReference: `synthetic-live-${request.taskId}`,
    errorCode: null,
  };
}

export function selectInitialLiveEvaluationFixtures(limit = 12) {
  return LIVE_FIXTURE_IDS
    .map((fixtureId) => EVALUATION_FIXTURES.find((fixture) => fixture.fixtureId === fixtureId))
    .filter((fixture): fixture is EvaluationFixture => Boolean(fixture))
    .slice(0, Math.min(limit, 12));
}

export function selectLiveEvaluationFixtures(limit = 12, env: LiveEnv = process.env) {
  const configured = configuredFixtureIds(env);
  const ids = configured ?? expectedFixtureIds(env);
  const cap = isStageALiveValidation(env) ? 6 : 12;
  return ids
    .map((fixtureId) => EVALUATION_FIXTURES.find((fixture) => fixture.fixtureId === fixtureId))
    .filter((fixture): fixture is EvaluationFixture => Boolean(fixture))
    .slice(0, Math.min(limit, cap));
}

export async function buildLiveEvaluationPreflight(env: LiveEnv = process.env): Promise<LiveEvaluationPreflight> {
  const registry = buildModelRegistry(env);
  const config = readModelOrchestratorConfig(env);
  const stageA = isStageALiveValidation(env);
  const stageAManifest = stageA ? buildStageACandidateManifest().report : null;
  const stageAOffline = stageA ? buildStageAPreflight().report : null;
  const fixtureLimit = numberFromEnv(env.VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT ?? env.VIREON_MODEL_EVALUATION_FIXTURE_LIMIT);
  const maxRunCost = numberFromEnv(env.VIREON_LIVE_MODEL_MAX_RUN_COST ?? env.VIREON_MODEL_EVALUATION_MAX_RUN_COST);
  const maxTaskCost = numberFromEnv(env.VIREON_LIVE_MODEL_MAX_TASK_COST ?? env.VIREON_MODEL_EVALUATION_MAX_TASK_COST);
  const dailyBudget = numberFromEnv(env.VIREON_LIVE_MODEL_DAILY_BUDGET ?? env.VIREON_MODEL_EVALUATION_DAILY_BUDGET ?? env.VIREON_MODEL_DAILY_BUDGET);
  const maxRetries = nonNegativeNumberFromEnv(env.VIREON_LIVE_MODEL_MAX_RETRIES);
  const maxOutputTokens = numberFromEnv(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS);
  const environment = env.VIREON_MODEL_EVALUATION_ENVIRONMENT ?? env.VIREON_ENVIRONMENT ?? env.NODE_ENV;
  const selected = selectInitialProvider(registry, env);
  const providerHealth = selected && env.NODE_ENV !== "test" ? await getAdapterForProvider(selected.provider).healthCheck() : selected?.healthStatus ?? "disabled";
  const requestedLimit = Math.min(fixtureLimit ?? 0, stageA ? 6 : 12);
  const fixtures = selectLiveEvaluationFixtures(requestedLimit || (stageA ? 6 : 12), env);
  const suites = [...new Set(EVALUATION_SUITES.filter((suite) => fixtures.some((fixture) => suite.fixtureIds.includes(fixture.fixtureId))).map((suite) => suite.suiteId))];
  const sensitivityLevel = selectedSensitivity(fixtures);
  const promptVersion = livePromptVersion(env);
  const scorerVersion = liveScorerVersion(env);
  const anthropicDisabled = !enabled(env.VIREON_ANTHROPIC_ENABLED);
  const geminiDisabled = !enabled(env.VIREON_GEMINI_ENABLED);
  const budgetReservation = stageA
    ? buildStageABudgetReservation({ fixtures, model: selected, env, promptVersion, scorerVersion })
    : null;
  const checks = {
    liveEvaluationEnabled: enabled(env.VIREON_LIVE_MODEL_EVALUATION),
    syntheticOnly: enabled(env.VIREON_SYNTHETIC_DATA_ONLY),
    liveEvaluationMode: config.mode === "live-evaluation",
    providerConfigured: Boolean(selected),
    providerAdapterLiveEnabled: selected?.provider === "openai",
    modelConfigured: Boolean(selected?.model && !selected.model.includes("unconfigured")),
    modelPromotionEligible: selected?.promotionState === "evaluation" || selected?.promotionState === "approved",
    healthCheckPassed: Boolean(selected && providerHealth === "healthy"),
    taskCapabilitiesRegistered: Boolean(selected?.supportsText && selected?.supportsStructuredOutput),
    sensitivityApproved: Boolean(selected?.approvedSensitivityLevels.includes(sensitivityLevel)),
    dailyBudgetConfigured: dailyBudget !== null,
    maxRunCostConfigured: maxRunCost !== null,
    maxTaskCostConfigured: maxTaskCost !== null,
    fixtureLimitConfigured: stageA ? fixtureLimit === 6 : fixtureLimit !== null && fixtureLimit > 0 && fixtureLimit <= 12,
    retryLimitConfigured: maxRetries !== null,
    outputTokenLimitConfigured: maxOutputTokens !== null,
    promptLoggingDisabled: !config.rawPromptLogging,
    rawResponseStorageDisabled: !config.rawResponseStorage,
    environmentIdentified: Boolean(environment && environment !== "production"),
    noProductionDataSource: (env.VIREON_DATA_SOURCE ?? "synthetic").toLowerCase() !== "production",
    budgetWithinDailyLimit: Boolean(maxRunCost !== null && dailyBudget !== null && maxRunCost <= dailyBudget),
    promptVersionActive: stageA ? promptVersion === LIVE_EVALUATION_PROMPT_STAGE_A_V3 : promptVersion === LIVE_EVALUATION_PROMPT_V1 || promptVersion === LIVE_EVALUATION_PROMPT_V2,
    scorerVersionActive: stageA ? scorerVersion === LIVE_EVALUATION_SCORER_V3 : scorerVersion === LIVE_EVALUATION_SCORER_V1 || scorerVersion === LIVE_EVALUATION_SCORER_V2,
    crossProviderFallbackDisabled: !config.crossProviderFallback,
    stageAOfflineReady: stageA ? stageAOffline?.state === "READY FOR BUDGET APPROVAL" : true,
    stageABudgetApproved: stageA ? enabled(env.VIREON_STAGE_A_BUDGET_APPROVED) : true,
    stageAFixtureSetExact: stageA ? fixtureIdsMatchConfiguredStageA(env) && fixtures.length === 6 : true,
    stageAManifestMatches: stageA ? Boolean(stageAManifest && selected?.provider === stageAManifest.provider && selected?.model === stageAApprovedModel(env, stageAManifest.exactModel)) : true,
    noOtherCommercialProviders: stageA ? anthropicDisabled && geminiDisabled : true,
    budgetReservationValid: stageA ? budgetReservation?.status === "valid" : true,
  };
  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const fixtureCount = Math.min(fixtureLimit ?? fixtures.length, fixtures.length);
  const retryCount = maxRetries ?? 0;
  const estimatedMaximumCost = stageA && budgetReservation
    ? budgetReservation.maximumEstimatedSixFixtureCost
    : maxRunCost ?? Number(((maxTaskCost ?? 0) * fixtureCount * (retryCount + 1)).toFixed(4));
  return {
    state: blockers.length === 0 ? "ready" : "blocked",
    provider: selected?.provider ?? "none",
    model: selected?.model ?? "none",
    fixtureCount,
    suites,
    estimatedMaximumCost,
    expectedMaximumRequestCount: fixtureCount * (retryCount + 1),
    budgetConfigurationHash: budgetReservation?.configurationHash,
    budgetReservation: budgetReservation ?? undefined,
    sensitivityLevel,
    outputStoragePolicy: { rawPromptsStored: false, rawResponsesStored: false },
    checks,
    blockers,
    redactedEnvironment: {
      VIREON_LIVE_MODEL_EVALUATION: env.VIREON_LIVE_MODEL_EVALUATION ?? "missing",
      VIREON_SYNTHETIC_DATA_ONLY: env.VIREON_SYNTHETIC_DATA_ONLY ?? "missing",
      VIREON_MODEL_ORCHESTRATOR_MODE: env.VIREON_MODEL_ORCHESTRATOR_MODE ?? "missing",
      VIREON_MODEL_EVALUATION_ENVIRONMENT: environment ?? "missing",
      VIREON_OPENAI_API_KEY: env.VIREON_OPENAI_API_KEY ? "set" : "missing",
      VIREON_OPENAI_DEFAULT_MODEL: env.VIREON_OPENAI_DEFAULT_MODEL ?? "missing",
      selectedProviderHealth: providerHealth,
      VIREON_LIVE_MODEL_MAX_RUN_COST: maxRunCost === null ? "missing" : String(maxRunCost),
      VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT: fixtureLimit === null ? "missing" : String(fixtureLimit),
      VIREON_LIVE_MODEL_PROMPT_VERSION: promptVersion,
      VIREON_LIVE_MODEL_SCORER_VERSION: scorerVersion,
      VIREON_LIVE_MODEL_STAGE: env.VIREON_LIVE_MODEL_STAGE ?? (stageA ? "stage-a" : "missing"),
      VIREON_STAGE_A_BUDGET_APPROVED: env.VIREON_STAGE_A_BUDGET_APPROVED ?? "missing",
    },
    message: blockers.length === 0
      ? (stageA ? "READY FOR PAID STAGE-A EXECUTION" : "READY FOR LIVE SYNTHETIC EVALUATION")
      : (stageA ? "STAGE A LIVE VALIDATION BLOCKED" : "LIVE MODEL EVALUATION BLOCKED"),
  };
}

function buildHumanReviewQueue(run: EvaluationRun): LiveEvaluationHumanReviewItem[] {
  return run.results.map((result) => {
    const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === result.fixtureId);
    const stageA = run.suiteId === "live-synthetic-stage-a-v1";
    const operationalBlocked = isOperationalBlockedResult(result.modelResult);
    const reasons = [
      operationalBlocked ? "operational budget or policy event" : stageA ? "Stage-A requires model-output review for every executed fixture" : null,
      result.hardFailures.length > 0 ? "hard failure" : null,
      !operationalBlocked && (fixture?.riskLevel === "high" || fixture?.riskLevel === "critical") ? "high risk" : null,
      !operationalBlocked && fixture?.professionalReviewExpected ? "professional review fixture" : null,
      !operationalBlocked && result.status === "requires-human-review" ? "semantic dispute" : null,
      !operationalBlocked && result.status === "passed" && result.fixtureId.endsWith("payslip-extraction") ? "random passing sample" : null,
    ].filter((item): item is string => Boolean(item));
    return {
      reviewItemId: `live-review-${run.runId}-${result.fixtureId}`,
      runId: run.runId,
      fixtureId: result.fixtureId,
      resultId: result.modelTaskRunId ?? result.fixtureId,
      required: reasons.length > 0,
      reasons,
      status: reasons.length > 0 ? "pending" : "not-required",
      correctionStoredSeparately: true,
    };
  });
}

function metrics(run: EvaluationRun | null): LiveEvaluationOperationalMetrics {
  if (!run) return blankMetrics();
  const providerResults = run.results.filter((result) => result.modelResult && !isOperationalBlockedResult(result.modelResult));
  const requestCount = providerResults.length;
  const latencies = providerResults.map((result) => result.modelResult?.latencyMs ?? 0).filter((value) => value > 0);
  const totalCost = run.totalCost;
  const successes = providerResults.filter((result) => result.modelResult?.status === "succeeded").length;
  const schemaFailures = providerResults.filter((result) => result.schemaScore < 1).length;
  const validationFailures = providerResults.filter((result) => result.modelResult?.status === "validation-failed").length;
  const timeouts = providerResults.filter((result) => result.modelResult?.errorCode === "TIMEOUT").length;
  const hardFailureCount = run.scoreSummary.hardFailureCount;
  return {
    requestCount,
    successRate: requestCount ? Number((successes / requestCount).toFixed(4)) : 0,
    refusalRate: 0,
    schemaFailureRate: requestCount ? Number((schemaFailures / requestCount).toFixed(4)) : 0,
    validationFailureRate: requestCount ? Number((validationFailures / requestCount).toFixed(4)) : 0,
    retryRate: 0,
    timeoutRate: requestCount ? Number((timeouts / requestCount).toFixed(4)) : 0,
    fallbackRate: 0,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    costPerFixture: run.fixtureCount ? Number((totalCost / run.fixtureCount).toFixed(6)) : 0,
    costPerPassingFixture: run.passedCount ? Number((totalCost / run.passedCount).toFixed(6)) : 0,
    hardFailureCount,
    humanReviewAgreement: null,
    judgeDisagreement: run.results.reduce((sum, result) => sum + result.automatedJudgeResults.reduce((inner, judge) => inner + judge.disagreement.length, 0), 0),
  };
}

export function haltReasonForModelTaskResult(result: ModelTaskResult | null, expectedProvider: ModelProvider, expectedModel: string): LiveEvaluationHaltReason {
  if (!result) return "internal-evaluation-error";
  if (result.errorCode === "BUDGET_EXCEEDED" || result.status === "budget-blocked") return "budget-exceeded";
  if (result.provider !== "disabled" && result.provider !== expectedProvider) return "provider-unexpected";
  if (result.model !== "none" && result.model !== expectedModel) return "model-unexpected";
  if (result.errorCode && result.status !== "succeeded" && result.status !== "validation-failed") return "internal-evaluation-error";
  return "none";
}

function haltReasonFor(run: EvaluationRun, expectedProvider: ModelProvider, expectedModel: string, maxRunCost: number): LiveEvaluationHaltReason {
  let consecutiveCritical = 0;
  let malformedCount = 0;
  for (const result of run.results) {
    const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === result.fixtureId);
    if (fixture && (!fixture.testData || fixture.evidence.some((evidence) => !evidence.testData))) return "synthetic-data-guard";
    if (containsSecret(result.modelResult)) return "credential-exposure";
    const taskHaltReason = result.modelResult ? haltReasonForModelTaskResult(result.modelResult, expectedProvider, expectedModel) : "none";
    if (taskHaltReason !== "none") return taskHaltReason;
    if (result.modelResult?.errorCode === "INVALID_STRUCTURED_OUTPUT") malformedCount += 1;
    if (malformedCount >= 2) return "malformed-structured-output";
    if (result.deterministicFidelityScore === 0) return "deterministic-fidelity";
    if (result.actionBoundaryScore === 0) return "action-policy";
    if (result.policyComplianceScore === 0) return "sensitivity-policy";
    if (result.hardFailures.length > 0 && (fixture?.riskLevel === "critical" || fixture?.riskLevel === "high")) consecutiveCritical += 1;
    else consecutiveCritical = 0;
    if (consecutiveCritical >= 3) return "critical-failures";
  }
  return run.totalCost > maxRunCost ? "budget-exceeded" : "none";
}

export async function runLiveEvaluationPilot(env: LiveEnv = process.env): Promise<LiveEvaluationPilotSummary> {
  const preflight = await buildLiveEvaluationPreflight(env);
  if (preflight.state !== "ready" || preflight.provider === "none") {
    return {
      preflight,
      run: null,
      humanReviewQueue: [],
      operationalMetrics: blankMetrics(),
      haltReason: "none",
      expandedRunEligible: false,
      calibrationSampleSize: 0,
      partialFixtureSet: true,
      automaticPromotionEnabled: false,
    };
  }

  const stageA = isStageALiveValidation(env);
  const fixtures = selectLiveEvaluationFixtures(preflight.fixtureCount, env);
  const executionRegistry = buildModelRegistry(env);
  const maxRunCost = numberFromEnv(env.VIREON_LIVE_MODEL_MAX_RUN_COST ?? env.VIREON_MODEL_EVALUATION_MAX_RUN_COST) ?? preflight.estimatedMaximumCost;
  const maxTaskCost = numberFromEnv(env.VIREON_LIVE_MODEL_MAX_TASK_COST ?? env.VIREON_MODEL_EVALUATION_MAX_TASK_COST) ?? Math.min(maxRunCost, 0.5);
  const maxRetries = nonNegativeNumberFromEnv(env.VIREON_LIVE_MODEL_MAX_RETRIES) ?? 1;
  const maxOutputTokens = numberFromEnv(env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS) ?? 800;
  const promptVersion = livePromptVersion(env);
  const scorerVersion = liveScorerVersion(env);
  const runId = `live-eval-${randomUUID()}`;
  const startedAt = nowIso();
  const results = [];
  let spent = 0;
  let haltReason: LiveEvaluationHaltReason = "none";
  writeRerunPreExecutionManifest({ runId, preflight, fixtures, promptVersion, scorerVersion, env });

  for (const fixture of fixtures) {
    if (!fixture.testData || fixture.evidence.some((evidence) => !evidence.testData)) {
      haltReason = "synthetic-data-guard";
      break;
    }
    if (spent + maxTaskCost > maxRunCost) {
      haltReason = "budget-exceeded";
      break;
    }
    const task = fixtureToModelTask(fixture, {
      executionMode: "live-single-provider",
      provider: preflight.provider,
      model: preflight.model,
      maximumTaskCost: maxTaskCost,
      maximumRetries: maxRetries + 1,
      maximumOutputTokens: maxOutputTokens,
      promptVersion,
      scorerVersion,
      stageACandidateId: stageAApprovedCandidateId(env),
      sourceRunId: env.VIREON_LIVE_MODEL_SOURCE_RUN_ID,
      liveProviderOptIn: true,
      now: startedAt,
    });
    if (containsSecret(task.inputPayload) || task.userId !== "synthetic-user-a") {
      haltReason = containsSecret(task.inputPayload) ? "credential-exposure" : "cross-fixture-contamination";
      break;
    }
    const result = env.NODE_ENV === "test"
      ? syntheticLiveProviderResult(task, preflight.provider, preflight.model)
      : await executeModelTask({ ...task, maximumCost: maxTaskCost }, executionRegistry);
    const evaluationResult = scoreEvaluationResult({ fixture, task, result, runId });
    evaluationResult.automatedJudgeResults = [runRuleBasedJudge(fixture, evaluationResult)];
    results.push(evaluationResult);
    spent += result.estimatedCost;
    const partialRun = buildRun({ runId, startedAt, completedAt: nowIso(), fixtures, results, provider: preflight.provider, model: preflight.model, status: "running", promptVersion, scorerVersion, stageA });
    haltReason = haltReasonFor(partialRun, preflight.provider, preflight.model, maxRunCost);
    if (haltReason !== "none") break;
  }

  const completedAt = nowIso();
  const run = buildRun({ runId, startedAt, completedAt, fixtures, results, provider: preflight.provider, model: preflight.model, status: haltReason === "none" ? "completed" : "halted", promptVersion, scorerVersion, stageA });
  run.promotionDecision = createPromotionDecision(run);
  evaluationRepository.saveRun(run);
  evaluationRepository.saveCalibrationReport(buildCalibrationReport(run));
  const humanReviewQueue = buildHumanReviewQueue(run);
  const runMetrics = metrics(run);
  const expandedRunEligible = haltReason === "none"
    && !stageA
    && run.scoreSummary.deterministicFidelity === 1
    && run.scoreSummary.actionBoundary === 1
    && run.scoreSummary.policyCompliance === 1
    && runMetrics.schemaFailureRate <= 0.1
    && humanReviewQueue.filter((item) => item.required).every((item) => item.status === "completed");
  const summary: LiveEvaluationPilotSummary = {
    preflight,
    run,
    humanReviewQueue,
    operationalMetrics: runMetrics,
    haltReason,
    expandedRunEligible,
    calibrationSampleSize: humanReviewQueue.filter((item) => item.status === "completed").length,
    partialFixtureSet: true,
    automaticPromotionEnabled: false,
  };
  writeLivePilotArtifacts(summary, env);
  if (stageA && summary.run && summary.run.status === "completed") {
    writeStageAArtifacts(summary, env);
  }
  return summary;
}

function buildRun(input: {
  runId: string;
  startedAt: string;
  completedAt: string;
  fixtures: EvaluationFixture[];
  results: ReturnType<typeof scoreEvaluationResult>[];
  provider: ModelProvider;
  model: string;
  status: EvaluationRun["status"];
  promptVersion?: string;
  scorerVersion?: string;
  stageA?: boolean;
}): EvaluationRun {
  const summary = scoreSummary(input.results);
  const promptVersion = input.promptVersion ?? LIVE_EVALUATION_PROMPT_V1;
  const candidate = `${input.provider}/${input.model}/${promptVersion}`;
  const suiteId = input.stageA ? "live-synthetic-stage-a-v1" : "live-synthetic-initial-v1";
  const partialRun = {
    runId: input.runId,
    suiteId,
    fixtureVersion: input.fixtures[0]?.fixtureVersion ?? "unknown",
    modelOrchestratorPolicyVersion: MODEL_POLICY_VERSION,
    provider: input.provider,
    model: input.model,
    modelConfigurationVersion: modelConfigurationLabel(input.provider, input.model),
    promptVersion,
    workerVersion: input.stageA ? "worker-eval-stage-a-v1" : "worker-eval-live-v1",
    deterministicEngineVersions: ["vireon-deterministic-engines-v1"],
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    status: input.status,
    environment: "staging" as const,
    executionMode: "live-single-provider" as const,
    fixtureCount: input.fixtures.length,
    passedCount: modelQualityResults(input.results).filter((result) => result.status === "passed").length,
    failedCount: modelQualityResults(input.results).filter((result) => result.status === "failed").length,
    blockedCount: input.fixtures.length - input.results.length + input.results.filter((result) => result.status === "blocked").length,
    totalCost: input.results.reduce((sum, result) => sum + (result.modelResult?.estimatedCost ?? 0), 0),
    averageLatency: average(input.results.map((result) => result.modelResult?.latencyMs ?? 0)),
    scoreSummary: summary,
    regressionSummary: compareAgainstBaseline({
      suiteId,
      fixtureVersion: input.fixtures[0]?.fixtureVersion ?? "unknown",
      scoreSummary: summary,
      results: input.results,
      totalCost: input.results.reduce((sum, result) => sum + (result.modelResult?.estimatedCost ?? 0), 0),
      averageLatency: average(input.results.map((result) => result.modelResult?.latencyMs ?? 0)),
    } as EvaluationRun, evaluationRepository.latestBaseline(suiteId, candidate)),
    promotionDecision: null as unknown as PromotionDecision,
    correlationId: `live-eval-corr-${input.runId}`,
    results: input.results,
    errors: input.status === "failed" ? (["EVALUATION_CANCELLED"] satisfies EvaluationErrorCode[]) : [],
  };
  return partialRun;
}

export async function buildLiveEvaluationStatus(env: LiveEnv = process.env) {
  const preflight = await buildLiveEvaluationPreflight(env);
  const latestLiveRun = evaluationRepository.listRuns().find((run) => run.executionMode === "live-single-provider") ?? null;
  return {
    label: "Synthetic live evaluation",
    preflight,
    latestRun: latestLiveRun,
    operationalMetrics: metrics(latestLiveRun),
    humanReviewQueue: latestLiveRun ? buildHumanReviewQueue(latestLiveRun) : [],
    expandedRunEligible: false,
    statusText: preflight.state === "ready" ? "Ready for bounded synthetic live evaluation" : "Blocked pending explicit live provider configuration",
  };
}

export function buildStageALiveStatus() {
  const artifactDir = join(process.cwd(), ".vireon", "model-evaluation", "stage-a");
  if (!existsSync(artifactDir)) {
    return {
      status: "not-started",
      runId: null,
      message: "No Stage-A live validation artifact found.",
      report: null,
      correction: null,
      executionCandidate: null,
      blockedArtifacts: [],
      stageBReady: false,
    };
  }
  const files = readdirSync(artifactDir);
  const corrections = files
    .filter((name) => name.includes("halt-cause-correction"))
    .map((name) => JSON.parse(readFileSync(join(artifactDir, name), "utf8")) as Record<string, unknown>)
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const executionCandidates = files
    .filter((name) => name.startsWith("stage-a-execution-candidate-"))
    .map((name) => JSON.parse(readFileSync(join(artifactDir, name), "utf8")) as Record<string, unknown>)
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const reports = files
    .filter((name) => name.endsWith("-stage-a-report.json"))
    .map((name) => JSON.parse(readFileSync(join(artifactDir, name), "utf8")) as Record<string, unknown>)
    .filter((report) => Number(report.cost ?? 0) > 0)
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const blockedArtifacts = files.filter((name) => name.startsWith("stage-a-blocked-")).sort().reverse();
  const latest = reports[0] ?? null;
  const latestCorrection = corrections[0] ?? null;
  const latestCandidate = executionCandidates[0] ?? null;
  return {
    status: latest ? String(latest.status ?? "unknown") : latestCorrection ? "halted-operational-budget-block" : blockedArtifacts.length ? "blocked-before-paid-execution" : "not-started",
    runId: latest ? String(latest.runId ?? "") : latestCorrection ? String(latestCorrection.sourceRunId ?? "") : null,
    message: latest ? String(latest.decision ?? "Stage-A artifact available.") : latestCorrection ? "Prior Stage-A halt was analytically corrected to budget-control rejection; fresh candidate prepared for separate paid execution." : blockedArtifacts.length ? "Stage-A live validation blocked before paid execution." : "No Stage-A live validation artifact found.",
    report: latest,
    correction: latestCorrection,
    executionCandidate: latestCandidate,
    blockedArtifacts,
    stageBReady: latest?.decision === "Stage-B candidate created",
  };
}
