"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Bot, BriefcaseBusiness, CalendarPlus, CheckCircle2, Download, FileText, GitCompare, Landmark, Save, ShieldCheck, Sparkles } from "lucide-react";
import { AICfoOrchestrator, type AICfoInputs, type AICfoRunResult } from "@/lib/aiCfo";
import type { DailyReviewHistoryRecord } from "@/lib/aiCfoDailyReview";
import DailyReviewCard from "./DailyReviewCard";

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function confidenceClass(label: string): string {
  if (label === "High") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export default function AiCfoClient({
  initialResult,
  persistedHistory,
  inputs,
  dailyReview,
}: {
  initialResult: AICfoRunResult;
  persistedHistory?: AICfoRunResult[];
  inputs: AICfoInputs;
  dailyReview?: DailyReviewHistoryRecord;
}) {
  const [query, setQuery] = useState(initialResult.request.userQuery);
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialResult.request.selectedScenarioId);
  const [currentPage, setCurrentPage] = useState(initialResult.request.workspaceContext);
  const [history, setHistory] = useState<AICfoRunResult[]>(persistedHistory?.length ? persistedHistory : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = history[0] ?? initialResult;
  const prompts = useMemo(() => AICfoOrchestrator.suggestedPrompts(currentPage), [currentPage]);

  async function ask(nextQuery = query) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-cfo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userQuery: nextQuery, workspaceContext: currentPage, selectedScenarioId }),
      });
      const data = await response.json() as { result?: AICfoRunResult; error?: string };
      if (!response.ok || !data.result) throw new Error(data.error ?? "AI CFO persistence failed.");
      setHistory((items) => [data.result!, ...items].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI CFO answer could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function exportBrief() {
    const blob = new Blob([current.adviserBrief.content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${current.adviserBrief.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
            Vault-grounded decision support
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">AI CFO</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ask decision questions grounded in the Financial Vault, Digital Twin, Decision Centre, Structure Optimiser and rule provenance. Calculations come only from deterministic engines.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Vault confidence", `${current.context.knowledgeHealth.vaultConfidence}%`],
              ["Knowledge health", `${current.context.knowledgeHealth.digitalTwinConfidence}%`],
              ["Rule freshness", current.context.knowledgeHealth.ruleFreshness],
              ["Profile timestamp", new Date(current.context.financialVaultSnapshot.financial_profile.lastUpdatedAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Active context
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Digital Twin scenario</span>
              <select value={selectedScenarioId} onChange={(event) => setSelectedScenarioId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950">
                {inputs.twinState.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Workspace context</span>
              <select value={currentPage} onChange={(event) => setCurrentPage(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950">
                {["dashboard", "housing", "cash-flow", "investments", "structure-optimiser", "digital-twin"].map((page) => <option key={page}>{page}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Last calculation {new Date(current.context.knowledgeHealth.lastCalculation).toLocaleString()}. Engines consulted: {current.enginesConsulted.join(", ")}.
          </div>
        </article>
      </section>

      {dailyReview && <DailyReviewCard record={dailyReview} compact />}

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.52fr_0.4fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Conversation</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => { setQuery(prompt); void ask(prompt); }} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                {prompt}
              </button>
            ))}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void ask();
            }}
          >
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">
              Ask
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}

          <div className="mt-5 space-y-4">
            {(history.length ? history : [initialResult]).map((item) => (
              <article key={item.request.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">{item.request.userIntent.replaceAll("_", " ")} - {item.request.userQuery}</div>
                <div className="mt-3 rounded-lg bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-950">{item.answer.directAnswer}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(item.answer.confidence.label)}`}>
                      {item.answer.confidence.label} {item.answer.confidence.score}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer.executiveSummary}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">Expected impact</div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">{item.answer.expectedImpact}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">Best next action</div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">{item.answer.recommendedAction}</div>
                    </div>
                  </div>
                  {item.answer.professionalReviewRequired && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                      Professional review required before acting.
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-950">Context Panel</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Active scenario", current.context.selectedSimulation.scenarioName],
                ["Net worth", money(current.context.balanceSheet.netWorth)],
                ["Borrowing", money(current.context.selectedSimulation.borrowingCapacity)],
                ["Cash flow surplus", money(current.context.cashFlow.surplus)],
                ["Calculation snapshot", current.answer.calculationSnapshotId],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
                  <div className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Evidence</h2>
            <div className="mt-4 space-y-3">
              {current.answer.evidence.slice(0, 6).map((item) => (
                <div key={`${item.sourceId}-${item.factUsed}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-950">{item.sourceTitle}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">{item.factUsed}</div>
                  <div className="mt-2 text-[11px] font-semibold uppercase text-slate-500">{item.classification} - {item.confidence}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Missing data</h2>
            <div className="mt-4 space-y-2">
              {current.answer.missingInformation.length === 0 ? (
                <div className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> No material blocker detected.</div>
              ) : current.answer.missingInformation.map((item) => (
                <div key={item} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" /> {item}</div>
              ))}
            </div>
          </article>
        </aside>

        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Action Panel</h2>
          <div className="mt-4 space-y-3">
            {[
              [Save, "Save as decision", current.generatedDecision.actionHref],
              [CalendarPlus, "Add to timeline", "/timeline"],
              [GitCompare, "Compare scenarios", "/digital-twin"],
              [Landmark, "Open related workspace", current.answer.followUpActions[0]?.href ?? "/insights"],
              [BriefcaseBusiness, "Export adviser brief", "#export"],
            ].map(([Icon, label, href]) => {
              const TypedIcon = Icon as typeof Save;
              if (href === "#export") {
                return (
                  <button key={label as string} type="button" onClick={exportBrief} className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800">
                    <Download className="h-4 w-4 text-blue-600" />
                    {label as string}
                  </button>
                );
              }
              return (
                <a key={label as string} href={href as string} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800">
                  <TypedIcon className="h-4 w-4 text-blue-600" />
                  {label as string}
                </a>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            {saving ? "Persisting latest answer..." : "Answers persist with the exact calculation snapshot used."}
          </div>
        </aside>
      </section>
    </div>
  );
}
