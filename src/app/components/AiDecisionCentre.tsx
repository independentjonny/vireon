"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronRight, Clock3, Sparkles, X } from "lucide-react";
import type { AiDecision, AiDecisionStatus } from "@/lib/aiDecisionCentre";

type StoredDecisionState = {
  status: AiDecisionStatus;
  clickedAt?: string;
  actionedAt?: string;
};

const priorityClass = {
  Critical: "bg-red-50 text-red-700 border-red-100",
  High: "bg-orange-50 text-orange-700 border-orange-100",
  Medium: "bg-blue-50 text-blue-700 border-blue-100",
  Low: "bg-slate-50 text-slate-700 border-slate-200",
} as const;

const statusClass = {
  New: "bg-blue-50 text-blue-700 border-blue-100",
  Reviewed: "bg-slate-50 text-slate-700 border-slate-200",
  Actioned: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Dismissed: "bg-slate-100 text-slate-500 border-slate-200",
} as const;

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatDate(value?: string) {
  if (!value) return "Not started";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AiDecisionCentre({
  decisions,
  limit,
  title = "AI Decision Centre",
  compact = false,
  initialDecisionState = {},
}: {
  decisions: AiDecision[];
  limit?: number;
  title?: string;
  compact?: boolean;
  initialDecisionState?: Record<string, StoredDecisionState>;
}) {
  const [decisionState, setDecisionState] = useState<Record<string, StoredDecisionState>>(initialDecisionState);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function updateDecisionState(id: string, update: (current: StoredDecisionState) => StoredDecisionState) {
    const next = { ...decisionState, [id]: update(decisionState[id] ?? { status: "New" }) };
    setMutationError(null);
    const response = await fetch("/api/decisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decisionId: id, status: next[id].status }),
    });
    const data = await response.json().catch(() => ({})) as { states?: Record<string, StoredDecisionState>; error?: string };
    if (response.ok && data.states) {
      setDecisionState(data.states);
      return;
    }
    setMutationError(data.error ?? "Decision update could not be saved.");
  }

  function setDecisionStatus(id: string, status: AiDecisionStatus) {
    void updateDecisionState(id, (current) => {
      if (status === "Actioned") {
        const now = new Date().toISOString();
        return { ...current, status, clickedAt: current.clickedAt ?? now, actionedAt: now };
      }
      return { ...current, status };
    });
  }

  function markActionClicked(id: string) {
    void updateDecisionState(id, (current) => ({
      ...current,
      status: current.status === "Actioned" ? "Actioned" : "Reviewed",
      clickedAt: current.clickedAt ?? new Date().toISOString(),
    }));
  }

  const dashboardMode = typeof limit === "number";
  const getStatus = useCallback((id: string): AiDecisionStatus => decisionState[id]?.status ?? "New", [decisionState]);

  const visibleDecisions = useMemo(() => {
    const filtered = decisions.filter((decision) => {
      const status = getStatus(decision.id);
      if (status === "Dismissed") return false;
      return dashboardMode ? status !== "Actioned" : true;
    });
    return dashboardMode ? filtered.slice(0, limit) : filtered;
  }, [dashboardMode, decisions, getStatus, limit]);

  const summary = useMemo(() => {
    const active = decisions.filter((decision) => getStatus(decision.id) !== "Dismissed");
    const unresolved = active.filter((decision) => getStatus(decision.id) !== "Actioned");
    return {
      newDecisions: unresolved.filter((decision) => getStatus(decision.id) === "New").length,
      highPriority: unresolved.filter((decision) => decision.priority === "Critical" || decision.priority === "High").length,
      monthlySavings: unresolved.reduce((sum, decision) => sum + decision.monthlySavingsEstimate, 0),
      missingDataBlockers: unresolved.filter((decision) => decision.missingDataBlocker).length,
    };
  }, [decisions, getStatus]);

  const actionHistory = useMemo(
    () =>
      decisions
        .map((decision) => ({ decision, state: decisionState[decision.id] }))
        .filter(({ state }) => state?.clickedAt || state?.actionedAt)
        .sort((a, b) => (b.state?.actionedAt ?? b.state?.clickedAt ?? "").localeCompare(a.state?.actionedAt ?? a.state?.clickedAt ?? "")),
    [decisions, decisionState]
  );

  const selectedDecision = decisions.find((decision) => decision.id === selectedDecisionId) ?? null;

  return (
    <section id="ai-decision-centre" className="rounded-lg border border-blue-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
            Decisions ranked by financial impact
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Rules-first recommendations from Vault, Balance Sheet, Housing, Cash Flow, Subscriptions, Goals and Alerts.</p>
        </div>
        {limit && <a href="/insights" className="text-sm font-semibold text-blue-700">View all decisions</a>}
      </div>
      {mutationError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{mutationError}</div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["New decisions", summary.newDecisions.toString(), "Awaiting review"],
          ["High priority", summary.highPriority.toString(), "Critical or high"],
          ["Potential monthly savings", formatCurrency(summary.monthlySavings), "Unresolved actions"],
          ["Missing data blockers", summary.missingDataBlockers.toString(), "Vault or source gaps"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{note}</div>
          </div>
        ))}
      </div>

      {visibleDecisions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="text-base font-semibold text-emerald-900">All current decisions are actioned.</div>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-emerald-800">
            New recommendations will appear here when Financial Vault, Cash Flow, Housing, Goals, Alerts, or subscription data changes.
          </p>
        </div>
      ) : (
        <div className={compact ? "grid gap-3 xl:grid-cols-5" : "space-y-3"}>
          {visibleDecisions.map((decision) => {
            const state = decisionState[decision.id];
            const status = state?.status ?? "New";
            const canMarkActioned = status !== "Actioned" && (!compact || Boolean(state?.clickedAt));
            return (
              <article
                key={decision.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDecisionId(decision.id);
                    if (status === "New") setDecisionStatus(decision.id, "Reviewed");
                  }}
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${priorityClass[decision.priority]}`}>{decision.priority}</span>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass[status]}`}>{status}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 text-xs font-semibold uppercase text-slate-500">{decision.category}</div>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">{decision.title}</h3>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase text-slate-500">Impact</div>
                      <div className="mt-1 font-semibold text-slate-950">{decision.financialImpact}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase text-slate-500">Confidence</div>
                      <div className="mt-1 font-semibold text-slate-950">{decision.confidence}</div>
                    </div>
                  </div>
                  {!compact && <p className="mt-3 text-sm leading-6 text-slate-600">{decision.reason}</p>}
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={decision.actionHref}
                    data-decision-action={decision.id}
                    onClick={() => markActionClicked(decision.id)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#10243b] px-3 text-xs font-semibold text-white"
                  >
                    {decision.actionLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                  {canMarkActioned && (
                    <button type="button" data-decision-status-id={decision.id} data-decision-status="Actioned" onClick={() => setDecisionStatus(decision.id, "Actioned")} className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
                      Mark Actioned
                    </button>
                  )}
                  <button type="button" data-decision-status-id={decision.id} data-decision-status="Dismissed" onClick={() => setDecisionStatus(decision.id, "Dismissed")} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                    Dismiss
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!compact && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Clock3 className="h-4 w-4 text-blue-600" />
            Action history
          </div>
          {actionHistory.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-slate-500">No decision actions have been started yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {actionHistory.map(({ decision, state }) => (
                <div key={`${decision.id}-history`} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{decision.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Started {formatDate(state?.clickedAt)}
                      {state?.actionedAt ? ` - actioned ${formatDate(state.actionedAt)}` : ""}
                    </div>
                  </div>
                  <span className={`w-fit rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass[state?.status ?? "Reviewed"]}`}>
                    {state?.status ?? "Reviewed"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedDecision && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${selectedDecision.title} decision details`}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass[selectedDecision.priority]}`}>{selectedDecision.priority}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[getStatus(selectedDecision.id)]}`}>{getStatus(selectedDecision.id)}</span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">{selectedDecision.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedDecision.reason}</p>
              </div>
              <button type="button" onClick={() => setSelectedDecisionId(null)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close decision details">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Category", selectedDecision.category],
                ["Source", selectedDecision.source],
                ["Estimated impact", selectedDecision.expectedImpact],
                ["Estimated benefit", selectedDecision.estimatedBenefit],
                ["Time to complete", selectedDecision.timeToComplete],
                ["Confidence", selectedDecision.confidence],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </div>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-950">Why this matters</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedDecision.whyThisMatters}</p>
            </section>

            <section className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-950">Evidence</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {selectedDecision.evidence.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-950">Source data</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {selectedDecision.sourceData.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-5">
              <div className="text-sm font-semibold text-blue-950">Next step</div>
              <p className="mt-2 text-sm leading-6 text-blue-900">{selectedDecision.nextStep}</p>
              <div className="mt-4 text-xs font-semibold uppercase text-blue-800">Required data</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedDecision.requiredData.map((item) => (
                  <span key={item} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800">{item}</span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`/action-workflows?decisionId=${encodeURIComponent(selectedDecision.id)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white"
                >
                  Start workflow
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={selectedDecision.actionHref}
                  data-decision-action={selectedDecision.id}
                  onClick={() => markActionClicked(selectedDecision.id)}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700"
                >
                  {selectedDecision.actionLabel}
                  <ArrowRight className="h-4 w-4" />
                </a>
                {decisionState[selectedDecision.id]?.clickedAt && getStatus(selectedDecision.id) !== "Actioned" && (
                  <button type="button" data-decision-status-id={selectedDecision.id} data-decision-status="Actioned" onClick={() => setDecisionStatus(selectedDecision.id, "Actioned")} className="h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
                    Mark Actioned
                  </button>
                )}
              </div>
            </section>

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" data-decision-status-id={selectedDecision.id} data-decision-status="Reviewed" onClick={() => setDecisionStatus(selectedDecision.id, "Reviewed")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800">
                <Check className="h-4 w-4" />
                Reviewed
              </button>
              <button type="button" data-decision-status-id={selectedDecision.id} data-decision-status="Dismissed" onClick={() => setDecisionStatus(selectedDecision.id, "Dismissed")} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                Dismiss
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
