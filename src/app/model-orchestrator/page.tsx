import { Activity, AlertTriangle, BrainCircuit, CheckCircle2, Coins, GitBranch, LockKeyhole, Route, ShieldCheck, SlidersHorizontal } from "lucide-react";
import AppShell from "../components/AppShell";
import { buildModelRegistry, diagnoseModelOrchestrator, MODEL_OUTPUT_SCHEMAS, routeModelTask, type ModelTaskRequest } from "@/lib/modelOrchestrator/index";
import { buildCanonicalModelRegistry, buildComparisonReadiness, buildProviderHealthReports, validateCanonicalModelRegistry } from "@/lib/modelOrchestrator/modelRegistry";
import { buildLiveEvaluationStatusSummary, buildStageALiveStatusSummary, buildTaskRestrictionsSummary } from "@/lib/modelEvaluation/liveReviewSummary";

export const dynamic = "force-dynamic";

function statusClass(enabled: boolean, health: string) {
  if (!enabled || health === "disabled") return "border-slate-200 bg-slate-50 text-slate-600";
  if (health === "healthy") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function sampleRequest(overrides: Partial<ModelTaskRequest> = {}): ModelTaskRequest {
  return {
    taskId: "synthetic-task-console",
    userId: "developer-fixture-user",
    sessionId: "developer-fixture-session",
    correlationId: "developer-fixture-correlation",
    taskType: "financial-synthesis",
    purpose: "Synthetic model routing console task",
    sensitivity: "financial-sensitive",
    riskLevel: "high",
    autonomyLevel: "prepare",
    serviceClass: "normal",
    requiredCapabilities: ["text", "structured-output", "reasoning"],
    preferredCapabilities: ["reasoning"],
    prohibitedProviders: [],
    permittedProviders: null,
    contextReferences: ["fixture-context"],
    evidenceReferences: ["fixture-evidence-income", "fixture-evidence-cashflow"],
    inputPayload: { userGoal: "Explain synthetic borrowing readiness change", deterministicOutputs: { borrowingDelta: -26000 } },
    outputSchema: MODEL_OUTPUT_SCHEMAS.FinancialSynthesis,
    maximumCost: 0.5,
    maximumLatencyMs: 5000,
    minimumConfidence: 0.6,
    professionalReviewRequired: true,
    deterministicEngineRequired: false,
    fallbackAllowed: false,
    retryPolicy: { maxAttempts: 1, baseDelayMs: 250, retryableErrors: ["RATE_LIMITED", "TIMEOUT"] },
    createdAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

export default async function ModelOrchestratorPage() {
  const registry = buildModelRegistry();
  const canonicalRegistry = buildCanonicalModelRegistry();
  const providerHealth = await buildProviderHealthReports();
  const registryValidation = validateCanonicalModelRegistry(canonicalRegistry);
  const comparisonReadiness = buildComparisonReadiness(canonicalRegistry);
  const diagnosis = diagnoseModelOrchestrator();
  const liveStatus = buildLiveEvaluationStatusSummary();
  const stageALiveStatus = buildStageALiveStatusSummary();
  const restrictions = buildTaskRestrictionsSummary();
  const route = routeModelTask(sampleRequest(), registry);
  const deterministicRoute = routeModelTask(sampleRequest({
    taskId: "synthetic-deterministic",
    taskType: "deterministic-calculation",
    sensitivity: "highly-restricted",
    requiredCapabilities: ["deterministic-engine", "structured-output"],
    deterministicEngineRequired: true,
    outputSchema: null,
    maximumCost: 0,
  }), registry);

  return (
    <AppShell active="workspace">
      <main className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <BrainCircuit className="h-3.5 w-3.5" />
                Developer Mode
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Model Orchestrator</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Provider-neutral routing, validation, budget, fallback and audit control plane. Deterministic Vireon engines remain authoritative and model output cannot mutate financial records.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              Policy {diagnosis.policyVersion}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Model Registry
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Canonical provider and model registry for frozen comparison readiness. Evaluation eligibility is separate from production eligibility, and retired models remain excluded.
              </p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${comparisonReadiness.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {comparisonReadiness.message}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-slate-500">Registry validation</div>
              <div className="mt-1 font-semibold text-slate-950">{registryValidation.ok ? "Valid" : "Invalid"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-slate-500">Eligible candidates</div>
              <div className="mt-1 font-semibold text-slate-950">{registryValidation.eligibleComparisonCandidateCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-slate-500">Retired excluded</div>
              <div className="mt-1 font-semibold text-slate-950">{canonicalRegistry.filter((entry) => entry.retirementStatus.retired).length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-slate-500">Production approvals</div>
              <div className="mt-1 font-semibold text-slate-950">{canonicalRegistry.filter((entry) => entry.productionEligibility.eligible).length}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {providerHealth.map((provider) => (
              <article key={provider.provider} className={`rounded-lg border p-4 text-sm ${provider.healthy ? "border-emerald-200 bg-emerald-50 text-emerald-800" : provider.configured ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{provider.provider}</div>
                    <div className="mt-1 text-xs">Models: {provider.supportedModels.length ? provider.supportedModels.join(", ") : "none configured"}</div>
                  </div>
                  <span className="text-xs font-semibold">{provider.healthy ? "Healthy" : provider.configured ? "Configured issue" : "Disabled"}</span>
                </div>
                <div className="mt-3 grid gap-1 text-xs">
                  <span>Configured: {String(provider.configured)}</span>
                  <span>Authenticated: {String(provider.authenticated)}</span>
                  <span>Reachable: {String(provider.reachable)}</span>
                  <span>Failure reason: {provider.failureReason ?? "none"}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.8fr_0.8fr] gap-0 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
              <div>Model</div>
              <div>Status</div>
              <div>Health</div>
              <div>Structured</div>
              <div>Evaluation</div>
              <div>Production</div>
            </div>
            {canonicalRegistry.map((entry) => (
              <div key={`${entry.provider}-${entry.exactModelId}`} className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.8fr_0.8fr] gap-0 border-t border-slate-200 px-3 py-2 text-xs text-slate-700">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">{entry.displayName}</div>
                  <div className="truncate text-slate-500">{entry.provider}/{entry.exactModelId}</div>
                </div>
                <div>{entry.status}</div>
                <div>{entry.healthStatus}</div>
                <div>{String(entry.structuredOutputSupport)}</div>
                <div title={entry.evaluationEligibility.reason}>{entry.evaluationEligibility.eligible ? "Eligible" : "Excluded"}</div>
                <div title={entry.productionEligibility.reason}>{entry.productionEligibility.eligible ? "Eligible" : "Blocked"}</div>
              </div>
            ))}
          </div>
          {registryValidation.errors.length || registryValidation.warnings.length ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {[...registryValidation.errors, ...registryValidation.warnings].join("; ")}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Activity className="h-4 w-4 text-blue-600" />
                Live synthetic adapter status
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Live evaluation is isolated to synthetic fixtures and does not expose credentials, raw prompts or raw provider responses.
              </p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${liveStatus.preflight.state === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {liveStatus.preflight.message}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-slate-500">Configured model</div>
              <div className="mt-1 break-words font-semibold text-slate-950">{liveStatus.preflight.provider}/{liveStatus.preflight.model}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-slate-500">Spend today</div>
              <div className="mt-1 font-semibold text-slate-950">${liveStatus.latestRun?.totalCost ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-slate-500">Remaining eval budget</div>
              <div className="mt-1 font-semibold text-slate-950">${Math.max(0, liveStatus.preflight.estimatedMaximumCost - (liveStatus.latestRun?.totalCost ?? 0)).toFixed(4)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-slate-500">Validation failure rate</div>
              <div className="mt-1 font-semibold text-slate-950">{Math.round(liveStatus.operationalMetrics.validationFailureRate * 100)}%</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">Circuit breaker</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">Shown per model in the provider registry. Unhealthy live models are removed from normal routing.</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">Task eligibility</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">Live pilot requires structured output, synthetic fixtures, explicit budget and approved model state.</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">Blocked sensitivity levels</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">Highly restricted data is never eligible for commercial live evaluation.</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="font-semibold text-slate-950">Stage-A live validation</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Status {stageALiveStatus.status}; run {stageALiveStatus.runId ?? "none"}. Model remains evaluation-only and Stage B is not executable from this workspace.
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800">
                Stage-B ready {String(stageALiveStatus.stageBReady)}
              </div>
            </div>
              <div className="mt-2 text-xs text-slate-600">{stageALiveStatus.message}</div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Active budget source: Stage-A live reservation
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Daily limit: ${String((stageALiveStatus.executionCandidate?.budgetReservation as { dailyCap?: number } | undefined)?.dailyCap ?? "n/a")}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Per-run limit: ${String((stageALiveStatus.executionCandidate?.budgetReservation as { perRunCap?: number } | undefined)?.perRunCap ?? "n/a")}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Per-task limit: ${String((stageALiveStatus.executionCandidate?.budgetReservation as { perTaskCap?: number } | undefined)?.perTaskCap ?? "n/a")}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-amber-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <LockKeyhole className="h-4 w-4 text-amber-600" />
                Evaluation-only task restrictions
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                gpt-5.2 remains evaluation-only. Restricted task classes require a clean targeted evaluation and human review before reassessment; client input cannot disable these restrictions.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Approval evidence {restrictions.approvalEvidence}
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {restrictions.restrictions.map((restriction) => (
              <article key={`${restriction.taskType}-${restriction.state}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-slate-950">{restriction.taskType}</div>
                  <span className="text-xs font-semibold text-amber-700">{restriction.state}</span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-slate-600">
                  <span>Current mode: PRODUCTION blocked; INTERNAL_EVALUATION controlled</span>
                  <span>Production eligible: false</span>
                  <span>Evaluation eligible: {String(restrictions.permissions?.find((permission) => permission.taskType === restriction.taskType)?.evaluationAllowed ?? false)}</span>
                  <span>Restriction source: {restriction.supportingEvaluationVersion}</span>
                  <span>Override source: {restrictions.evaluationOverride?.version ?? "none"}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{restriction.reason}</p>
                <div className="mt-2 text-xs text-slate-500">Reassess: {restriction.reassessAfter}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["Mode", diagnosis.mode, SlidersHorizontal],
            ["Providers", String(new Set(registry.map((item) => item.provider)).size), Activity],
            ["Raw prompt logs", diagnosis.privacyDefaults.rawPromptLogging ? "On" : "Off", LockKeyhole],
            ["Cross fallback", diagnosis.privacyDefaults.crossProviderFallback ? "On" : "Off", GitBranch],
          ].map(([label, value, Icon]) => (
            <article key={label as string} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Icon className="h-4 w-4 text-blue-600" />
                {label as string}
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{value as string}</div>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            Provider registry
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {registry.map((model) => (
              <article key={`${model.provider}-${model.model}`} className={`rounded-lg border p-4 ${statusClass(model.enabled, model.healthStatus)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{model.provider}</div>
                    <div className="mt-1 break-words text-xs">{model.model}</div>
                  </div>
                  {model.enabled ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>Cost: {model.relativeCostClass}</div>
                  <div>Latency: {model.relativeLatencyClass}</div>
                  <div>Structured: {String(model.supportsStructuredOutput)}</div>
                  <div>Reasoning: {String(model.supportsReasoning)}</div>
                  <div>Vision: {String(model.supportsVision)}</div>
                  <div>Docs: {String(model.supportsDocuments)}</div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Route className="h-4 w-4 text-blue-600" />
              Synthetic routing console
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Uses synthetic fixture references only. Real-user data is not sent from this console.
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="font-semibold text-slate-950">Financial synthesis fixture</div>
              <div className="mt-2 text-slate-600">Selected: {route.selectedProvider ? `${route.selectedProvider}/${route.selectedModel}` : "blocked"}</div>
              <div className="mt-1 text-slate-600">Score: {route.routingScore}</div>
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {route.routingReasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="font-semibold">Deterministic calculation fixture</div>
              <div className="mt-1">Selected: {deterministicRoute.selectedProvider}/{deterministicRoute.selectedModel}</div>
              <div className="mt-1">LLM fallback is not permitted for deterministic calculations.</div>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Coins className="h-4 w-4 text-blue-600" />
              Budget, validation and blocked classes
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                Raw prompt persistence: {diagnosis.privacyDefaults.rawPromptLogging ? "enabled" : "disabled"}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                Raw response storage: {diagnosis.privacyDefaults.rawResponseStorage ? "enabled" : "disabled"}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                Blocked task classes: {diagnosis.blockedTaskClasses.length ? diagnosis.blockedTaskClasses.join(", ") : "None in current policy"}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                Validation schemas: {Object.keys(MODEL_OUTPUT_SCHEMAS).length}
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Activity className="h-4 w-4 text-blue-600" />
            Rejected routing candidates
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {route.rejectedCandidates.slice(0, 8).map((candidate) => (
              <article key={`${candidate.provider}-${candidate.model}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">{candidate.provider}/{candidate.model}</div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                  {candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
