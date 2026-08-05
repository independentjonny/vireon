import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Gauge,
  GitBranch,
  LockKeyhole,
  RotateCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { AutonomousOperationsEngine, type ApprovalClass, type AutonomyConfidence, type AutonomyPriority, type TaskStatus } from "@/lib/autonomousOperations";

export const dynamic = "force-dynamic";

function priorityClass(priority: AutonomyPriority) {
  if (priority === "Critical") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "High") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "Medium") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function confidenceClass(confidence: AutonomyConfidence) {
  if (confidence === "High") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "Medium") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function taskClass(status: TaskStatus) {
  if (status === "Waiting approval") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "Failed") return "border-red-200 bg-red-50 text-red-800";
  if (status === "Completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-slate-200 bg-white text-slate-700";
}

function approvalCopy(value: ApprovalClass) {
  if (value === "Never autonomous") return "Never autonomous";
  if (value === "Execute after approval") return "Approval required";
  return value;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function AutonomousOperationsPage() {
  const state = AutonomousOperationsEngine.build();
  const topTask = state.tasks[0];

  return (
    <AppShell active="workspace">
      <main className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Bot className="h-3.5 w-3.5" />
                Developer Mode
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Autonomous Operations</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Deterministic financial-operator control plane for goals, plans, workers, task approvals, verification, learning and safety. GPT can explain and prepare, but it cannot directly modify financial records.
              </p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${state.supervisor.status === "Healthy" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              Supervisor {state.supervisor.status}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["Current tasks", state.tasks.length.toString(), ClipboardList],
            ["Waiting approvals", state.supervisor.waitingApprovalCount.toString(), LockKeyhole],
            ["Knowledge health", `${state.knowledgeHealth.score}%`, ShieldCheck],
            ["Worker utilisation", percent(state.metrics.workerUtilisation), Activity],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Icon className="h-4 w-4 text-blue-600" />
                {label as string}
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{value as string}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.58fr_0.42fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <BrainCircuit className="h-4 w-4 text-blue-600" />
              Executive briefing
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">{state.executiveBriefing.topPriority}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Projected impact: {state.executiveBriefing.projectedImpact}. Financial actions remain approval-gated and outcomes require evidence before they are treated as realised.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">Wins</div>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {state.executiveBriefing.financialWins.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Risks</div>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {(state.executiveBriefing.emergingRisks.length ? state.executiveBriefing.emergingRisks : ["No critical autonomous risk"]).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Approvals</div>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {(state.executiveBriefing.waitingApprovals.length ? state.executiveBriefing.waitingApprovals.slice(0, 2) : ["No approval waiting"]).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Safety envelope
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["Deterministic engines", state.safety.deterministicEnginesOnly],
                ["GPT financial mutations", state.safety.gptCanModifyFinancialFacts],
                ["Approval required", state.safety.financialActionsRequireApproval],
                ["Duplicate suppression", state.safety.duplicateSuppressionEnabled],
                ["Audit trail required", state.safety.auditTrailRequired],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">{label as string}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${(label === "GPT financial mutations" && value === false) || (label !== "GPT financial mutations" && value) ? "text-emerald-700" : "text-red-700"}`}>
                    {(label === "GPT financial mutations" && value === false) || (label !== "GPT financial mutations" && value) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </section>

        {topTask && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">Next autonomous task</div>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{topTask.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {topTask.worker} can prepare the work. Execution status is {topTask.status.toLowerCase()} and the approval policy is {approvalCopy(topTask.approvalClass).toLowerCase()}.
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${taskClass(topTask.status)}`}>{topTask.status}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-500">Expected benefit</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{topTask.expectedBenefit}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-500">Required evidence</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{topTask.requiredEvidence.slice(0, 2).join(", ") || "None"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-500">Verification</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{topTask.verification[0]}</div>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Target className="h-4 w-4 text-blue-600" />
              Goal graph
            </div>
            <div className="mt-4 space-y-3">
              {state.goals.slice(0, 5).map((goal) => (
                <div key={goal.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass(goal.priority)}`}>{goal.priority}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(goal.confidence)}`}>{goal.confidence} confidence</span>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-950">{goal.type}</div>
                  <div className="mt-1 text-sm text-slate-600">Target: {Math.round(goal.targetValue).toLocaleString()} by {new Date(goal.targetDate).toLocaleDateString("en-AU")}</div>
                  {goal.blockers.length > 0 && <div className="mt-2 text-xs text-amber-700">Blocked by: {goal.blockers.join(", ")}</div>}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <GitBranch className="h-4 w-4 text-blue-600" />
              Planner
            </div>
            <div className="mt-4 space-y-3">
              {state.plans.slice(0, 4).map((plan) => (
                <details key={plan.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-950">{plan.strategy}</summary>
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <div className="font-semibold text-slate-700">Milestones</div>
                      <ul className="mt-1 space-y-1 text-slate-600">{plan.milestones.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-700">Verification</div>
                      <ul className="mt-1 space-y-1 text-slate-600">{plan.verification.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            Task queue and worker results
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {state.tasks.slice(0, 8).map((task) => {
              const result = state.workerResults.find((item) => item.taskId === task.id);
              return (
                <article key={task.id} className={`rounded-lg border p-4 ${taskClass(task.status)}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{task.worker}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{approvalCopy(task.approvalClass)}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-950">{task.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{task.expectedBenefit}</p>
                  <div className="mt-2 text-xs font-semibold text-slate-500">Classification: {result?.classification ?? "Pending"}</div>
                  {result?.rejectedReason && <div className="mt-2 text-xs text-amber-700">{result.rejectedReason}</div>}
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Gauge className="h-4 w-4 text-blue-600" />
              Knowledge health
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">{state.knowledgeHealth.score}%</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>Missing documents: {state.knowledgeHealth.missingDocuments.length}</div>
              <div>Missing evidence: {state.knowledgeHealth.missingEvidence.length}</div>
              <div>Stale assumptions: {state.knowledgeHealth.staleAssumptions.length}</div>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <RotateCw className="h-4 w-4 text-blue-600" />
              Scheduled reviews
            </div>
            <div className="mt-3 space-y-3">
              {state.scheduledReviews.map((review) => (
                <div key={review.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-950">{review.cadence}</div>
                  <div className="text-slate-600">Next: {new Date(review.nextRunAt).toLocaleDateString("en-AU")}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Activity className="h-4 w-4 text-blue-600" />
              Learning metrics
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>Recommendation quality: {percent(state.learning.recommendationQuality)}</div>
              <div>False positive rate: {percent(state.learning.falsePositiveRate)}</div>
              <div>Confidence calibration: {percent(state.learning.confidenceCalibration)}</div>
              <div>Completed workflows: {state.learning.completedWorkflows}</div>
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
