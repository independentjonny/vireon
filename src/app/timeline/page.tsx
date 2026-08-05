import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarDays, FileSearch, GitBranch, Milestone, SlidersHorizontal } from "lucide-react";
import AppShell from "../components/AppShell";
import { ExplainabilityEngine } from "@/lib/explainability";
import type { TimelineCategory, TimelineConfidence } from "@/lib/financialTimeline";
import { TimelineEngine } from "@/lib/timelineEngine";

export const dynamic = "force-dynamic";

type TimelineView = "timeline" | "compare" | "explain" | "milestones" | "journey";

const views: Array<{ id: TimelineView; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "compare", label: "Compare Dates" },
  { id: "explain", label: "Explain Recommendation" },
  { id: "milestones", label: "Major Milestones" },
  { id: "journey", label: "Financial Journey" },
];

const categories: Array<TimelineCategory | "all"> = ["all", "Financial Fact", "Financial Position", "Decision", "Workflow", "Digital Twin", "Goals", "Knowledge", "System"];
const confidenceOptions: Array<TimelineConfidence | "all"> = ["all", "High", "Medium", "Low"];

function currency(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString()}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function tone(category: TimelineCategory) {
  if (category === "Workflow" || category === "Decision") return "border-blue-200 bg-blue-50 text-blue-700";
  if (category === "Knowledge") return "border-amber-200 bg-amber-50 text-amber-700";
  if (category === "Goals") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (category === "System") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
}

function hrefFor(view: TimelineView, category: TimelineCategory | "all", confidence: TimelineConfidence | "all") {
  const params = new URLSearchParams();
  params.set("view", view);
  if (category !== "all") params.set("category", category);
  if (confidence !== "all") params.set("confidence", confidence);
  return `/timeline?${params.toString()}`;
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: TimelineView; category?: TimelineCategory | "all"; confidence?: TimelineConfidence | "all"; year?: string }>;
}) {
  const params = await searchParams;
  const view = views.some((item) => item.id === params.view) ? params.view ?? "timeline" : "timeline";
  const category = categories.includes(params.category ?? "all") ? params.category ?? "all" : "all";
  const confidence = confidenceOptions.includes(params.confidence ?? "all") ? params.confidence ?? "all" : "all";
  const year = params.year && params.year !== "all" ? Number(params.year) : "all";
  const state = TimelineEngine.build({ category, confidence, year: Number.isFinite(year) ? year : "all" });
  const allState = TimelineEngine.build();
  const latestEvent = allState.events[0];
  const compare = ExplainabilityEngine.compareDates(allState.events, "2026-06-01T00:00:00.000Z", allState.generatedAt);
  const explanation = allState.explanations[0] ?? null;
  const metricExplanation = ExplainabilityEngine.explainMetricChange(allState.events, "borrowingCapacity");

  return (
    <AppShell active="workspace">
      <main className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <BookOpenCheck className="h-3.5 w-3.5" />
                Financial memory
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Financial Timeline</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Trace recommendations, documents, calculations, workflows and verified outcomes through time. This is an explainable financial history, not an activity log.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:w-[520px]">
              {[
                ["Events", allState.events.length.toString()],
                ["Milestones", allState.journey.milestones.length.toString()],
                ["Years", allState.journey.yearlySummaries.length.toString()],
                ["Latest", latestEvent ? shortDate(latestEvent.timestamp) : "None"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <nav aria-label="Timeline views" className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
          {views.map((item) => (
            <Link key={item.id} href={hrefFor(item.id, category, confidence)} className={`h-10 shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${view === item.id ? "bg-[#10243b] text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
            Filters
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 7).map((item) => (
              <Link key={item} href={hrefFor(view, item, confidence)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${category === item ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {item === "all" ? "All categories" : item}
              </Link>
            ))}
            {confidenceOptions.map((item) => (
              <Link key={item} href={hrefFor(view, category, item)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${confidence === item ? "border-slate-400 bg-slate-100 text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {item === "all" ? "All confidence" : item}
              </Link>
            ))}
          </div>
        </section>

        {view === "timeline" && (
          <section className="grid gap-4 lg:grid-cols-[0.66fr_0.34fr]">
            <div className="space-y-3">
              {state.events.slice(0, 24).map((event) => (
                <article key={event.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone(event.category)}`}>{event.category}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{event.confidence} confidence</span>
                      </div>
                      <h2 className="mt-3 text-base font-semibold text-slate-950">{event.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{event.summary}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">Why: {event.whyItHappened}</p>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">{shortDate(event.timestamp)}</div>
                  </div>
                  <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">Evidence and calculation</summary>
                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <div className="font-semibold text-slate-950">Deterministic cause</div>
                        <p className="mt-1 leading-6 text-slate-600">{event.deterministicCause}</p>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-950">Affected metrics</div>
                        <p className="mt-1 leading-6 text-slate-600">{event.affectedMetrics.join(", ") || "None recorded"}</p>
                      </div>
                      <div className="md:col-span-2">
                        <div className="font-semibold text-slate-950">Evidence</div>
                        <ul className="mt-1 space-y-1 text-slate-600">
                          {event.evidence.map((item) => (
                            <li key={item.id}>{item.title}: {item.factUsed}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
            <aside className="space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                  <GitBranch className="h-4 w-4" />
                  Why borrowing changed
                </div>
                <p className="mt-2 text-sm leading-6 text-blue-900">{metricExplanation.summary}</p>
                <div className="mt-3 space-y-2">
                  {metricExplanation.causes.slice(0, 3).map((cause) => (
                    <div key={cause.cause} className="rounded-md bg-white p-3 text-xs text-slate-600">
                      <span className="font-semibold text-slate-950">{currency(cause.contribution)}</span> - {cause.cause}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        )}

        {view === "compare" && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              Today vs last verified month
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{compare.summary}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {compare.positionChanges.slice(0, 6).map((change) => (
                <div key={change.metric} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">{change.metric}</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{change.delta === null ? "Changed" : currency(change.delta)}</div>
                  <div className="mt-1 text-xs text-slate-500">From {String(change.before ?? "unknown")} to {String(change.after ?? "unknown")}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {compare.causes.slice(0, 8).map((cause) => (
                <div key={cause.title} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="font-semibold text-slate-950">{cause.title}</span>
                  <span className="ml-2 text-slate-500">{currency(cause.contribution)} contribution - {cause.confidence} confidence</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "explain" && explanation && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <FileSearch className="h-4 w-4 text-blue-600" />
              Recommendation explanation
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{explanation.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{explanation.why}</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">Engines contributed</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{explanation.engines.join(", ")}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">Could change this recommendation</div>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {explanation.couldChangeRecommendation.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">Confidence</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{explanation.confidence}. Every material claim is linked to evidence or labelled as an assumption.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Facts used</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {explanation.factsUsed.slice(0, 8).map((item) => <li key={item.id}>{item.title}: {item.factUsed}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Assumptions</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {explanation.assumptions.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </section>
        )}

        {view === "milestones" && (
          <section className="grid gap-3 md:grid-cols-2">
            {allState.journey.milestones.map((milestone) => (
              <article key={milestone.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <Milestone className="mt-1 h-5 w-5 text-emerald-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{milestone.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{milestone.summary}</p>
                    <div className="mt-2 text-xs text-slate-500">{milestone.year} - {milestone.confidence} confidence</div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {view === "journey" && (
          <section className="space-y-3">
            {allState.journey.yearlySummaries.map((year) => (
              <article key={year.year} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-slate-950">{year.year}</div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{year.aiSummary}</p>
                  </div>
                  <Link href={`/timeline?view=timeline&year=${year.year}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10243b] px-3 text-sm font-semibold text-white">
                    Open year
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  {[
                    ["Net worth", currency(year.netWorthChange)],
                    ["Debt", currency(year.debtChange)],
                    ["Borrowing", currency(year.borrowingChange)],
                    ["Super", currency(year.superChange)],
                    ["Documents", `+${year.verifiedDocuments}`],
                    ["Goals", year.goalsCompleted.toString()],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="mt-1 font-semibold text-slate-950">{value}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );
}
