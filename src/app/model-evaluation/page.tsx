import { Activity, AlertTriangle, BarChart3, CheckCircle2, Gauge, GitCompare, LockKeyhole, Scale, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import AppShell from "../components/AppShell";
import { EVALUATION_FIXTURES } from "@/lib/modelEvaluation/fixtures";
import { buildCalibrationReport } from "@/lib/modelEvaluation/calibration";
import {
  buildLiveEvaluationStatusSummary,
  buildLiveFailureDisplaySummary,
  buildLiveReviewSummary,
  buildStageALiveStatusSummary,
} from "@/lib/modelEvaluation/liveReviewSummary";
import { EVALUATION_PROMPT_DEFINITIONS } from "@/lib/modelEvaluation/promotion";
import { listEvaluationSuites, runEvaluation, runFixtureValidation } from "@/lib/modelEvaluation/runner";

export const dynamic = "force-dynamic";

function scoreTone(score: number) {
  if (score >= 0.9) return "text-emerald-700";
  if (score >= 0.7) return "text-amber-700";
  return "text-red-700";
}
export default async function ModelEvaluationPage() {
  const suites = listEvaluationSuites();
  const validation = runFixtureValidation();
  const run = await runEvaluation({ executionMode: "offline-mock", maximumFixtures: 10, now: "2026-07-21T10:00:00.000Z" });
  const liveStatus = buildLiveEvaluationStatusSummary();
  const stageALiveStatus = buildStageALiveStatusSummary();
  const liveReview = buildLiveReviewSummary();
  const {
    failureDecomposition,
    claimAudit,
    confidenceAudit,
    taskRestrictions,
    v3Candidate,
    v3Failures,
    v3Regressions,
    stageA,
    stageAPreflight,
  } = buildLiveFailureDisplaySummary();
  const calibration = buildCalibrationReport(run);
  const hardFailureResults = run.results.filter((result) => result.hardFailures.length > 0);

  return (
    <AppShell active="workspace">
      <main className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Developer Mode
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Evaluation & Trust Framework</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Provider-neutral synthetic benchmarks for model, prompt, routing policy and worker trust. Default runs use mock and deterministic adapters only; live provider evaluation requires an explicit opt-in.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              No automatic promotion in v1
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Activity className="h-4 w-4 text-blue-600" />
                Synthetic live evaluation
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {liveStatus.statusText}. Raw prompts and provider responses are not stored by default; every live result enters human review before promotion can be considered.
              </p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${liveStatus.preflight.state === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {liveStatus.preflight.message}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["Provider", liveStatus.preflight.provider],
              ["Model", liveStatus.preflight.model],
              ["Fixture cap", String(liveStatus.preflight.fixtureCount)],
              ["Max cost", `$${liveStatus.preflight.estimatedMaximumCost}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs font-semibold text-slate-500">{label}</div>
                <div className="mt-1 break-words font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">Operational metrics</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                Requests {liveStatus.operationalMetrics.requestCount}; schema failures {Math.round(liveStatus.operationalMetrics.schemaFailureRate * 100)}%; p95 latency {liveStatus.operationalMetrics.latencyP95}ms.
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">Human review queue</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                {liveStatus.humanReviewQueue.filter((item) => item.required).length} required; corrections are stored separately from original output.
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">Expansion gate</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                {liveStatus.expandedRunEligible ? "Eligible after human approval" : "Not eligible until initial subset and review gates pass."}
              </div>
            </div>
          </div>
          {liveStatus.preflight.blockers.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              Blockers: {liveStatus.preflight.blockers.join(", ")}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Live run review and remediation
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Run {liveReview.runId} completed execution with 6 passed and 6 failed fixtures. Human review and remediation records are separate from immutable source outputs, scores and routing artifacts.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Expansion {liveReview.expansionStatus}; promotion {liveReview.promotionStatus}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["Reviews", `${liveReview.reviewCompleteCount}/${liveReview.reviewCount}`],
              ["Hard failures", String(liveReview.hardFailureCount)],
              ["Calibration", liveReview.calibration.label],
              ["Rerun", liveReview.rerunCandidate.rerunDecision],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs font-semibold text-slate-500">{label}</div>
                <div className="mt-1 break-words font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {liveReview.failureMatrix.map((group) => (
              <article key={group.rootCause} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{group.rootCause}</div>
                    <div className="mt-1 text-xs text-slate-500">{group.occurrences} occurrences; {group.affectedTaskTypes.join(", ")}</div>
                  </div>
                  <span className={group.safetyCritical ? "text-amber-700" : "text-slate-600"}>{group.safetyCritical ? "Safety critical" : "Review required"}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">{group.proposedFix}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {liveReview.reviews.slice(0, 12).map((review) => (
              <article key={review.reviewId} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                <div className="font-semibold text-slate-950">{review.fixtureId}</div>
                <div className="mt-1 text-xs text-slate-500">{review.preferredDisposition}; confidence {review.reviewerConfidence}</div>
                <div className="mt-3 text-xs leading-5 text-slate-600">
                  {review.materialOmissions.length > 0 ? review.materialOmissions.join("; ") : "No material omission recorded."}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-red-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Live failure decomposition
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Original run passed 6/12. Rerun v2 passed 4/12, introduced three regressions and is excluded from expansion. The preserved halted run is recorded as an operational event, not a model-quality pass-rate input.
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {failureDecomposition.conclusion}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {Object.entries(failureDecomposition.transitionCounts).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs font-semibold capitalize text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="font-semibold text-slate-950">Prohibited-claim audit</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                Corpus {claimAudit.corpusSize}; precision {claimAudit.precision}; recall {claimAudit.recall}; false negatives {claimAudit.falseNegatives}. Scorer approval remains candidate-only pending broader validation.
              </div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="font-semibold text-slate-950">Confidence policy</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                {confidenceAudit.policyVersion}; low-ceiling fixtures {confidenceAudit.rows.filter((row) => row.deterministicCeiling < 0.7).length}. Confidence is capped by evidence quality, conflicts, risk and review requirements.
              </div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="font-semibold text-slate-950">V3 candidate</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                Status {v3Candidate.status}; paid rerun authorised {String(v3Candidate.paidRerunAuthorised)}. Blockers: {v3Candidate.blockers.join("; ")}.
              </div>
            </article>
          </div>

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="font-semibold text-slate-950">Stage-A readiness</div>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                  Six-fixture candidate prepared for separate budget approval. It covers all three regressions, confidence remediation, prohibited-claim remediation, one stable-pass control and an adversarial/high-risk case.
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800">
                {stageAPreflight.state}
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Failures classified: {v3Failures.failureCount}; pending live validation: {v3Failures.unresolvedPendingLiveTestCount}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Regression traces: {v3Regressions.rows.length}; all Stage-A required {String(v3Regressions.allRegressionsIncludedInStageA)}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Paid execution authorised: {String(stageAPreflight.paidExecutionAuthorised)}
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Live status: {stageALiveStatus.status}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Run: {stageALiveStatus.runId ?? "none"}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Corrected cause: {String(stageALiveStatus.correction?.correctedAnalyticalCause ?? "none")}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Stage-B ready: {String(stageALiveStatus.stageBReady)}
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Recorded halt: {String(stageALiveStatus.correction?.recordedHaltReason ?? "none")}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Underlying error: {String(stageALiveStatus.correction?.underlyingErrorCode ?? "none")}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Budget reservation: {String((stageALiveStatus.executionCandidate?.budgetReservation as { status?: string } | undefined)?.status ?? "none")}
              </div>
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700">
                Fresh run ready: {String(Boolean(stageALiveStatus.executionCandidate))}
              </div>
            </div>
            <div className="mt-2 rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600">
              {stageALiveStatus.message}
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {stageA.fixtures.map((fixture) => (
                <div key={fixture.fixtureId} className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs">
                  <div className="font-semibold text-slate-800">{fixture.fixtureId}</div>
                  <div className="mt-1 text-slate-500">{fixture.reason}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="font-semibold text-slate-950">Transition matrix</div>
              <div className="mt-3 grid gap-2">
                {failureDecomposition.rows.map((row) => (
                  <div key={row.fixtureId} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="truncate text-xs font-semibold text-slate-700">{row.fixtureId}</span>
                    <span className={row.primaryTransition === "regressed" ? "text-xs font-semibold text-red-700" : row.primaryTransition === "fixed" ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-slate-600"}>
                      {row.primaryTransition}
                    </span>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="font-semibold text-slate-950">gpt-5.2 task restrictions</div>
              <div className="mt-3 grid gap-2">
                {taskRestrictions.restrictions.map((restriction) => (
                  <div key={`${restriction.taskType}-${restriction.state}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-700">{restriction.taskType}</span>
                      <span className="text-xs font-semibold text-amber-700">{restriction.state}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                      <span>Production eligible: false</span>
                      <span>Evaluation eligible: {String(taskRestrictions.permissions?.find((permission) => permission.taskType === restriction.taskType)?.evaluationAllowed ?? false)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Override source: {taskRestrictions.evaluationOverride?.version ?? "none"}</div>
                    <div className="mt-1 text-xs text-slate-500">{restriction.reason}</div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["Suites", String(validation.suiteCount), BarChart3],
            ["Fixtures", String(validation.fixtureCount), Scale],
            ["High risk", String(validation.highRiskCount), AlertTriangle],
            ["Adversarial", String(validation.adversarialCount), LockKeyhole],
          ].map(([label, value, Icon]) => (
            <article key={label as string} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Icon className="h-4 w-4 text-blue-600" />
                {label as string}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{value as string}</div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Gauge className="h-4 w-4 text-blue-600" />
              Latest mock scorecard
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Overall", run.scoreSummary.overall],
                ["Evidence grounding", run.scoreSummary.evidenceGrounding],
                ["Deterministic fidelity", run.scoreSummary.deterministicFidelity],
                ["Safety", run.scoreSummary.safety],
                ["Policy compliance", run.scoreSummary.policyCompliance],
                ["Calibration", run.scoreSummary.confidenceCalibration],
              ].map(([label, score]) => (
                <div key={label as string} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">{label as string}</div>
                  <div className={`mt-1 text-xl font-semibold ${scoreTone(score as number)}`}>{Math.round((score as number) * 100)}%</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3">Passed: {run.passedCount}</div>
              <div className="rounded-lg border border-slate-200 p-3">Failed: {run.failedCount}</div>
              <div className="rounded-lg border border-slate-200 p-3">Hard failures: {run.scoreSummary.hardFailureCount}</div>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <SlidersHorizontal className="h-4 w-4 text-blue-600" />
              Promotion gates
            </div>
            <div className="mt-4 space-y-2">
              {Object.entries(run.promotionDecision.gateOutcomes).map(([gate, passed]) => (
                <div key={gate} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-700">{gate}</span>
                  <span className={passed ? "text-emerald-700" : "text-amber-700"}>{passed ? "Passed" : "Required"}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Candidate state: {run.promotionDecision.proposedState}. Human approval remains required even when automated gates pass.
            </p>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <GitCompare className="h-4 w-4 text-blue-600" />
              Regression visibility
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Current status: {run.regressionSummary.status}. Baselines are immutable and candidate changes report hard-failure, cost, latency and calibration movement separately.
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Confidence calibration
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Brier {calibration.brierScore}; expected calibration error {calibration.expectedCalibrationError}; overconfidence {calibration.overconfidenceRate}.
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Users className="h-4 w-4 text-blue-600" />
              Human review
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {run.results.filter((result) => result.humanReviewStatus === "pending").length} results require review. Blind review support is modelled for promotion-critical comparisons.
            </p>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Benchmark suites
            </div>
            <div className="mt-4 grid gap-2">
              {suites.slice(0, 8).map((suite) => (
                <div key={suite.suiteId} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="font-semibold text-slate-950">{suite.name}</div>
                  <div className="text-xs text-slate-500">{suite.fixtureIds.length} fixtures</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Hard failures and safeguards
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {hardFailureResults.length === 0 ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">No hard failures in latest displayed mock subset.</div>
              ) : hardFailureResults.slice(0, 5).map((result) => (
                <div key={result.fixtureId} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  <div className="font-semibold">{result.fixtureId}</div>
                  <div className="mt-1 text-xs">{result.hardFailures.join("; ")}</div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-950">Prompt and fixture governance</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {EVALUATION_PROMPT_DEFINITIONS.map((prompt) => (
              <article key={`${prompt.promptId}-${prompt.version}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="font-semibold text-slate-950">{prompt.promptId}</div>
                <div className="mt-1 text-xs text-slate-500">v{prompt.version} - {prompt.status} - immutable {String(prompt.immutable)}</div>
              </article>
            ))}
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="font-semibold text-slate-950">Fixture controls</div>
              <div className="mt-1 text-xs text-slate-500">
                {EVALUATION_FIXTURES.length} fixtures; default source types exclude approved-anonymised data.
              </div>
            </article>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
