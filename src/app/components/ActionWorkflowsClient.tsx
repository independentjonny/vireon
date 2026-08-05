"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, FileWarning, ListChecks, ShieldAlert, Sparkles, X } from "lucide-react";
import type { ActionWorkflow, ActionWorkflowExecution, ActionWorkflowStepStatus, ActionWorkflowSummary } from "@/lib/actionWorkflows";

type WorkflowView = "Overview" | "Active" | "Waiting" | "Verification" | "Completed" | "Templates";

const workflowViews: WorkflowView[] = ["Overview", "Active", "Waiting", "Verification", "Completed", "Templates"];

const statusClass = {
  "Not Started": "border-slate-200 bg-slate-50 text-slate-700",
  "In Progress": "border-blue-200 bg-blue-50 text-blue-700",
  "Waiting on User": "border-amber-200 bg-amber-50 text-amber-700",
  "Waiting on Document": "border-amber-200 bg-amber-50 text-amber-700",
  "Ready for Review": "border-purple-200 bg-purple-50 text-purple-700",
  "Awaiting Verification": "border-purple-200 bg-purple-50 text-purple-700",
  "Waiting on Third Party": "border-amber-200 bg-amber-50 text-amber-700",
  Draft: "border-slate-200 bg-slate-50 text-slate-700",
  Ready: "border-blue-200 bg-blue-50 text-blue-700",
  Completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Completed with Variance": "border-amber-200 bg-amber-50 text-amber-700",
  Blocked: "border-red-200 bg-red-50 text-red-700",
  Dismissed: "border-slate-200 bg-slate-100 text-slate-500",
  Skipped: "border-slate-200 bg-slate-100 text-slate-500",
  Cancelled: "border-slate-200 bg-slate-100 text-slate-500",
  Reopened: "border-red-200 bg-red-50 text-red-700",
} as const;

const priorityClass = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-blue-200 bg-blue-50 text-blue-700",
  Low: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

function WorkflowStep({
  workflow,
  step,
  onStepStatus,
}: {
  workflow: ActionWorkflow;
  step: ActionWorkflow["steps"][number];
  onStepStatus: (workflowId: string, stepId: string, status: ActionWorkflowStepStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[step.status]}`}>{step.status}</span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{step.owner}</span>
            {step.professionalReviewRequired && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Professional review</span>}
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-950">{step.title}</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
          <div className="mt-2 text-xs text-slate-500">{step.estimatedMinutes} min - Required: {step.requiredData.join(", ") || "No extra data"}</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={step.actionHref} className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#10243b] px-3 text-xs font-semibold text-white">
            Open
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {step.status !== "Completed" && (
            <button type="button" onClick={() => onStepStatus(workflow.id, step.id, "Completed")} className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActionWorkflowsClient({
  initialWorkflows,
  initialExecutions,
  summary,
  lastSyncedAt,
  initialWorkflowId,
}: {
  initialWorkflows: ActionWorkflow[];
  initialExecutions: ActionWorkflowExecution[];
  summary: ActionWorkflowSummary;
  lastSyncedAt: string;
  initialWorkflowId?: string;
}) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [executions, setExecutions] = useState(initialExecutions);
  const [view, setView] = useState<WorkflowView>("Overview");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(initialWorkflowId ?? initialWorkflows[0]?.id ?? null);
  const [mutationMessage, setMutationMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const activeWorkflows = useMemo(() => workflows.filter((workflow) => workflow.status !== "Dismissed"), [workflows]);
  const visibleWorkflows = useMemo(() => {
    if (view === "Active") return activeWorkflows.filter((workflow) => ["Ready", "Not Started", "In Progress", "Reopened"].includes(workflow.status));
    if (view === "Waiting") return activeWorkflows.filter((workflow) => ["Waiting on User", "Waiting on Document", "Waiting on Third Party", "Blocked"].includes(workflow.status));
    if (view === "Verification") return activeWorkflows.filter((workflow) => workflow.status === "Awaiting Verification" || ["Evidence Pending", "Verification Pending", "Inconclusive", "Not Achieved", "Partially Verified"].includes(workflow.outcomeStatus ?? ""));
    if (view === "Completed") return activeWorkflows.filter((workflow) => ["Completed", "Completed with Variance", "Cancelled"].includes(workflow.status));
    return activeWorkflows;
  }, [activeWorkflows, view]);
  const selectedWorkflow = visibleWorkflows.find((workflow) => workflow.id === selectedWorkflowId) ?? visibleWorkflows[0] ?? null;
  const selectedExecution = executions.find((execution) => selectedWorkflow && execution.id === selectedWorkflow.id.replace(/^workflow-/, "execution-")) ?? null;
  const templateSummaries = useMemo(() => {
    const byTemplate = new Map<string, { title: string; version: string; count: number; professionalReviewRequired: boolean }>();
    for (const execution of executions) {
      const current = byTemplate.get(execution.workflowDefinitionId);
      byTemplate.set(execution.workflowDefinitionId, {
        title: execution.title,
        version: execution.workflowVersion,
        count: (current?.count ?? 0) + 1,
        professionalReviewRequired: current?.professionalReviewRequired ?? execution.professionalReviewRequired,
      });
    }
    return [...byTemplate.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [executions]);

  async function applyWorkflowMutation(payload: unknown, success: string) {
    setMutationMessage(null);
    try {
      const response = await fetch("/api/action-workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const state = await response.json().catch(() => ({})) as { workflows?: ActionWorkflow[]; executions?: ActionWorkflowExecution[]; error?: string };
      if (!response.ok || !state.workflows || !state.executions) {
        setMutationMessage({ tone: "error", text: state.error ?? "Workflow update could not be saved." });
        return;
      }
      setWorkflows(state.workflows);
      setExecutions(state.executions);
      setMutationMessage({ tone: "success", text: success });
    } catch {
      setMutationMessage({ tone: "error", text: "Workflow update failed offline." });
    }
  }

  async function updateStep(workflowId: string, stepId: string, status: ActionWorkflowStepStatus) {
    await applyWorkflowMutation({ workflowId, stepId, status }, "Workflow step saved.");
  }

  function requestEvidenceUpload() {
    setMutationMessage({
      tone: "error",
      text: "Attach verified evidence through Financial Vault before outcome verification. Demo evidence is not recorded as live evidence.",
    });
  }

  async function requestOutcomeVerification(workflowId: string) {
    const execution = executions.find((item) => item.id === workflowId.replace(/^workflow-/, "execution-"));
    const evidenceIds = execution?.evidence.map((item) => item.id) ?? [];
    if (evidenceIds.length === 0) {
      setMutationMessage({ tone: "error", text: "Outcome verification needs verified evidence before Vireon can assess realised impact." });
      return;
    }
    await applyWorkflowMutation({ workflowId, verifyOutcome: { actualValue: null, evidenceIds, recalculationSucceeded: false } }, "Outcome verification requested.");
  }

  async function generateArtefact(workflowId: string) {
    await applyWorkflowMutation({ workflowId, artefactType: "workflow-completion-report" }, "Workflow artefact generated.");
  }

  async function dismissWorkflow(workflowId: string) {
    await applyWorkflowMutation({ workflowId, dismiss: true }, "Workflow dismissed.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Sparkles className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
              Action Workflows v1
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Action Workflows</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Turn ranked decisions into guided steps with evidence, blockers, professional-review flags and progress tracking. Calculations remain owned by Vireon&apos;s deterministic engines.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Last synced {new Date(lastSyncedAt).toLocaleString()}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Total", summary.total.toString()],
            ["Active", summary.active.toString()],
            ["Waiting on user", summary.waitingOnUser.toString()],
            ["Waiting on document", summary.waitingOnDocument.toString()],
            ["Completed", summary.completed.toString()],
            ["Monthly savings", `$${summary.estimatedMonthlySavings.toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </div>
        {mutationMessage && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${mutationMessage.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {mutationMessage.text}
          </div>
        )}
      </section>

      <nav aria-label="Workflow views" className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
        {workflowViews.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setView(item)}
            className={`h-10 shrink-0 rounded-md px-3 text-sm font-semibold transition ${view === item ? "bg-[#10243b] text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {item}
          </button>
        ))}
      </nav>

      {view === "Templates" && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templateSummaries.map((template) => (
            <div key={`${template.title}-${template.version}`} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-950">{template.title}</div>
              <div className="mt-2 text-xs text-slate-500">Template version {template.version} - {template.count} active instance{template.count === 1 ? "" : "s"}</div>
              {template.professionalReviewRequired && <div className="mt-3 text-xs font-semibold text-amber-700">Professional-review checkpoint included</div>}
            </div>
          ))}
        </section>
      )}

      {view !== "Templates" && (
      <section className="grid gap-5 xl:grid-cols-[0.42fr_0.58fr]">
        <aside className="space-y-3">
          {visibleWorkflows.map((workflow) => (
            <button
              key={workflow.id}
              type="button"
              onClick={() => setSelectedWorkflowId(workflow.id)}
              className={`w-full rounded-lg border p-4 text-left transition hover:border-blue-200 hover:bg-white ${selectedWorkflow?.id === workflow.id ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}
            >
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass[workflow.priority]}`}>{workflow.priority}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[workflow.status]}`}>{workflow.status}</span>
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-950">{workflow.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{workflow.financialImpact} - {workflow.progress}% complete</div>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${workflow.progress}%` }} />
              </div>
            </button>
          ))}
          {visibleWorkflows.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">No workflows in this view.</div>
          )}
        </aside>

        {selectedWorkflow ? (
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass[selectedWorkflow.priority]}`}>{selectedWorkflow.priority}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[selectedWorkflow.status]}`}>{selectedWorkflow.status}</span>
                  {selectedWorkflow.professionalReviewRequired && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Professional review</span>}
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">{selectedWorkflow.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedWorkflow.objective}</p>
              </div>
              <button type="button" onClick={() => dismissWorkflow(selectedWorkflow.id)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                <X className="h-4 w-4" />
                Dismiss
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {[
                ["Impact", selectedWorkflow.financialImpact],
                ["Confidence", selectedWorkflow.confidence],
                ["Time", selectedWorkflow.timeToComplete],
                ["Progress", `${selectedWorkflow.progress}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </div>

            {selectedExecution && (
              <section className="mt-5 grid gap-4 lg:grid-cols-[0.55fr_0.45fr]">
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div className="text-sm font-semibold text-blue-950">Current next action</div>
                  <div className="mt-2 text-base font-semibold text-slate-950">{selectedWorkflow.nextActionLabel}</div>
                  <p className="mt-2 text-sm leading-6 text-blue-900">Checklist completion is separate from outcome verification. Realised impact appears only after verified post-action evidence and recalculation.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={requestEvidenceUpload} className="h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700">Add evidence in Vault</button>
                    <button type="button" onClick={() => requestOutcomeVerification(selectedWorkflow.id)} className="h-9 rounded-lg bg-[#10243b] px-3 text-xs font-semibold text-white">Request verification</button>
                    <button type="button" onClick={() => generateArtefact(selectedWorkflow.id)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">Generate artefact</button>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">Outcome verification</div>
                  <div className="mt-3 grid gap-2">
                    {[
                      ["Execution status", selectedExecution.executionStatus],
                      ["Outcome status", selectedExecution.outcomeStatus],
                      ["Expected", selectedExecution.expectedImpact],
                      ["Realised", selectedExecution.realisedImpact ?? "Not verified"],
                      ["Variance", selectedExecution.impactVariance ?? "Pending"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-semibold text-slate-950">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {selectedWorkflow.blockers.length > 0 && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                  <FileWarning className="h-4 w-4" />
                  Blockers
                </div>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
                  {selectedWorkflow.blockers.map((blocker) => <li key={blocker}>- {blocker}</li>)}
                </ul>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {selectedWorkflow.steps.map((step) => <WorkflowStep key={step.id} workflow={selectedWorkflow} step={step} onStepStatus={updateStep} />)}
            </div>

            <section className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <ListChecks className="h-4 w-4 text-blue-600" />
                  Evidence
                </div>
                <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                  {selectedWorkflow.evidence.map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Clock3 className="h-4 w-4 text-blue-600" />
                  Outputs
                </div>
                <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                  {(selectedExecution?.artefacts.map((item) => `${item.title} (${item.version})`) ?? selectedWorkflow.outputs).map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
            </section>

            {selectedExecution && (
              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">Affected deterministic engines</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedExecution.affectedEngines.map((engine) => <span key={engine} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{engine}</span>)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">Immutable audit trail</div>
                  <div className="mt-3 space-y-2">
                    {selectedExecution.auditEvents.slice(0, 5).map((event) => (
                      <div key={event.id} className="rounded-md bg-white p-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-950">{event.eventType}</span> - {event.summary}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {selectedWorkflow.professionalReviewRequired && (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Professional review required before acting.</div>
                  <ul className="mt-1 space-y-1 leading-6">
                    {selectedWorkflow.professionalReviewReasons.map((reason) => <li key={reason}>- {reason}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </article>
        ) : (
          <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <h2 className="mt-3 text-xl font-semibold text-emerald-950">No active workflows</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-emerald-800">New workflows appear when Vireon generates actionable decisions.</p>
          </article>
        )}
      </section>
      )}
    </div>
  );
}
