import { executeModelTask } from "../../modelOrchestrator/executor.ts";
import { MODEL_POLICY_VERSION } from "../../modelOrchestrator/policy.ts";
import type { ModelProvider, ModelTaskRequest, ModelTaskResult } from "../../modelOrchestrator/types.ts";
import type { EvaluationFixture, EvaluationRunOptions } from "../types.ts";

export function fixtureToModelTask(fixture: EvaluationFixture, options: EvaluationRunOptions = {}): ModelTaskRequest {
  const deterministicOnly = options.executionMode === "deterministic-only";
  const executionMode = deterministicOnly
    ? "OFFLINE_TEST"
    : options.executionMode === "offline-mock"
    ? "MOCK"
    : options.executionMode?.startsWith("live")
    ? "INTERNAL_EVALUATION"
    : options.executionMode === "regression" || options.executionMode === "candidate-promotion"
    ? "OFFLINE_TEST"
    : "PRODUCTION";
  return {
    taskId: `eval-${fixture.fixtureId}`,
    userId: "synthetic-user-a",
    sessionId: "synthetic-evaluation-session",
    correlationId: `eval-corr-${fixture.fixtureId}`,
    taskType: deterministicOnly ? "deterministic-calculation" : fixture.taskType,
    purpose: `Evaluate fixture: ${fixture.name}`,
    sensitivity: deterministicOnly ? "highly-restricted" : fixture.sensitivity,
    riskLevel: fixture.riskLevel,
    autonomyLevel: fixture.autonomyLevel,
    serviceClass: options.executionMode === "live-single-provider" || options.executionMode === "live-multi-provider" ? "background" : "normal",
    requiredCapabilities: deterministicOnly ? ["deterministic-engine", "structured-output"] : fixture.expectedOutputSchema ? ["text", "structured-output"] : ["text"],
    preferredCapabilities: fixture.riskLevel === "high" || fixture.riskLevel === "critical" ? ["reasoning"] : [],
    prohibitedProviders: [],
    permittedProviders: options.provider ? [options.provider] : null,
    permittedModels: options.model ? [options.model] : null,
    contextReferences: fixture.contextReferences,
    evidenceReferences: fixture.evidence.map((evidence) => evidence.evidenceId),
    inputPayload: {
      fixtureId: fixture.fixtureId,
      fixtureVersion: fixture.fixtureVersion,
      userGoal: fixture.input.userGoal,
      context: fixture.input,
      deterministicOutputs: fixture.expectedFacts.deterministicOutputs,
      assumptions: [`Fixture difficulty: ${fixture.difficulty}`],
      rules: fixture.category.includes("tax") ? ["synthetic-rule-reference-v1"] : [],
      missingInformation: fixture.tags.includes("missing-evidence") ? fixture.requiredEvidenceReferences : [],
      evaluationPromptVersion: options.promptVersion ?? "prompt-eval-v1",
      evaluationScorerVersion: options.scorerVersion ?? "deterministic-scorer-v1",
      remediationInstructions: options.promptVersion === "prompt-eval-live-v2" ? [
        "Use a confidence value that matches evidence strength and task risk; do not choose an allowed number merely to satisfy schema.",
        "Explicitly disclose missing or conflicting evidence when it affects confidence.",
        "Preserve deterministic outputs exactly, including units, values, time periods and snapshot references.",
        "Do not convert assumptions, estimates or user statements into verified facts.",
        "Retain professional-review classification for high-risk tax, legal, investment, lending-policy or regulated-advice outputs.",
        "Warnings about prohibited claims or actions must be phrased as prohibitions, not as affirmative conclusions.",
      ] : options.promptVersion === "stage-a-task-specific-v3" ? [
        "Use the task-specific prompt policy only; do not add unrelated global policy boilerplate.",
        "Do not provide an unconstrained model confidence. Respect deterministic confidence ceilings from evidence completeness, evidence conflicts, stale evidence, task risk and professional-review requirements.",
        "For document extraction, provide field-level confidence derived from visible synthetic evidence only.",
        "For synthesis, timeline, Daily Review and high-risk outputs, express certainty by claim source instead of presenting a single confidence as certainty.",
        "Preserve deterministic outputs exactly and reference calculation snapshots when using calculated values.",
        "Represent prohibited-action discussion as warnings or refusals unless the task explicitly asks for a permitted educational comparison.",
        "Distinguish affirmative recommendations from negated, quoted, hypothetical, conditional or warning statements.",
        "Do not propose autonomous financial execution, verified-fact mutation, realised-impact updates or audit-history changes.",
      ] : [],
      testData: true,
      evaluationMode: executionMode === "INTERNAL_EVALUATION",
      evaluationExecutionMode: executionMode,
      evaluationStage: options.promptVersion === "stage-a-task-specific-v3" ? "stage-a" : "general",
      stageACandidateId: options.promptVersion === "stage-a-task-specific-v3" ? options.stageACandidateId ?? "live-eval-stage-a-candidate-2026-07-22" : null,
      humanReviewRequired: options.promptVersion === "stage-a-task-specific-v3" ? true : fixture.professionalReviewExpected,
    },
    outputSchema: fixture.expectedOutputSchema,
    maximumCost: options.executionMode?.startsWith("live") ? options.maximumTaskCost ?? 0.5 : 0.05,
    maximumLatencyMs: 10000,
    minimumConfidence: fixture.riskLevel === "high" || fixture.riskLevel === "critical" ? 0.7 : 0.55,
    professionalReviewRequired: fixture.professionalReviewExpected,
    deterministicEngineRequired: deterministicOnly || fixture.taskType === "deterministic-calculation",
    fallbackAllowed: false,
    retryPolicy: { maxAttempts: options.executionMode?.startsWith("live") ? options.maximumRetries ?? 1 : 1, baseDelayMs: 100, retryableErrors: ["RATE_LIMITED", "TIMEOUT"] },
    createdAt: options.now ?? new Date().toISOString(),
    executionMode,
  };
}

export async function executeFixtureThroughOrchestrator(fixture: EvaluationFixture, options: EvaluationRunOptions = {}): Promise<{ task: ModelTaskRequest; result: ModelTaskResult }> {
  const task = fixtureToModelTask(fixture, options);
  const result = await executeModelTask(task);
  return { task, result };
}

export function modelConfigurationLabel(provider: ModelProvider | undefined, model: string | undefined) {
  return `${provider ?? "router-selected"}:${model ?? "configured"}:${MODEL_POLICY_VERSION}`;
}
