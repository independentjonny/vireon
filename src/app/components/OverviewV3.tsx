"use client";
import { useState } from "react";

interface OverviewV3Props {
  netWorth: string;
  netWorthTrend: string;
  cashFlow: string;
  savingsRate: string;
  runway: string;
  aiConfidence: string;
  healthScore: number;
  healthLabel: string;
  insights: string[];
  portfolioAllocation: { label: string; pct: number; color: string }[];
  healthScores: { label: string; score: number; note: string }[];
  dateStr: string;
  agents?: { label: string; value: string; role: string }[];
  telemetryEvents?: { event: string; level: "info" | "warn" | "error"; agent: string; detail: string }[];
  dbConfigured?: boolean;
  currentTask?: { runId: string; goal: string; startedAt: string } | null;
  lastTask?: { runId: string; goalPreview: string; status: string } | null;
  nextTask?: { id: string; title: string } | null;
  totalRuns?: number;
}

const LAYER_LABEL =
  "text-xs font-semibold uppercase tracking-[0.18em] text-white/45";

export default function OverviewV3({
  netWorth,
  netWorthTrend,
  cashFlow,
  savingsRate,
  runway,
  aiConfidence,
  healthScore,
  healthLabel,
  insights,
  portfolioAllocation,
  healthScores,
  dateStr,
  agents = [],
  telemetryEvents = [],
  dbConfigured = false,
  currentTask = null,
  lastTask = null,
  nextTask = null,
  totalRuns = 0,
}: OverviewV3Props) {
  const [runtimeOpen, setRuntimeOpen] = useState(false);

  const healthColor =
    healthScore >= 90
      ? "text-emerald-400"
      : healthScore >= 75
      ? "text-sky-400"
      : healthScore >= 60
      ? "text-amber-400"
      : "text-red-400";

  const secondaryMetrics: {
    label: string;
    value: string;
    accent: string;
    detail?: string;
    progress?: number;
  }[] = [
    { label: "Cash Flow", value: cashFlow, accent: "emerald" },
    { label: "Savings Rate", value: savingsRate, accent: "sky" },
    { label: "Runway", value: runway, accent: "white" },
    { label: "AI Score", value: aiConfidence, accent: "violet" },
    {
      label: "Financial Health",
      value: String(healthScore),
      accent: "health",
      detail: `${healthLabel} overall`,
      progress: healthScore,
    },
  ];

  const accentClass: Record<string, string> = {
    emerald: "text-emerald-400",
    sky: "text-sky-400",
    white: "text-white/70",
    violet: "text-violet-400",
    health: healthColor,
  };

  const levelColor: Record<string, string> = {
    info: "text-sky-400",
    warn: "text-amber-400",
    error: "text-red-400",
  };

  const levelBg: Record<string, string> = {
    info: "bg-sky-400/10",
    warn: "bg-amber-400/10",
    error: "bg-red-400/10",
  };

  const recommendations = [
    { title: "Offset mortgage", impact: "Save $2,400/yr", confidence: 94 },
    { title: "Review streaming bundle", impact: "Save $138/mo", confidence: 89 },
    { title: "Switch to annual plans", impact: "Save $340/yr", confidence: 82 },
  ];

  const opportunities = [
    { label: "Annual plan upgrade", saving: "$340/yr" },
    { label: "Cancel unused trial", saving: "$96/yr" },
    { label: "High-yield savings", saving: "+1.4% APY" },
  ];

  const predictions = [
    { label: "Q3 savings projection", value: "+$4,200", trend: "up" as const },
    { label: "Subscription renewal", value: "3 in 14 days", trend: "neutral" as const },
    { label: "Cash flow Aug", value: "+$6,800", trend: "up" as const },
  ];

  const healthScoreTone =
    healthScore >= 90
      ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300"
      : healthScore >= 75
      ? "border-sky-400/30 bg-sky-400/[0.08] text-sky-300"
      : healthScore >= 60
      ? "border-amber-400/30 bg-amber-400/[0.08] text-amber-300"
      : "border-red-400/30 bg-red-400/[0.08] text-red-300";

  const uniqueHealthScores = healthScores.filter((item, index) => {
    const label = item.label.trim().toLowerCase();
    return (
      healthScores.findIndex(
        (candidate) => candidate.label.trim().toLowerCase() === label
      ) === index
    );
  });

  const healthFocus = uniqueHealthScores.reduce<
    { label: string; score: number; note: string } | null
  >(
    (lowest, item) => (!lowest || item.score < lowest.score ? item : lowest),
    null
  );

  return (
    <div id="overview" className="space-y-12 sm:space-y-14">

      {/* ══════════════════════════════════════════════════════════════
          LAYER 1 — Financial Identity
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <div className={`${LAYER_LABEL} mb-4`}>
          Dashboard Snapshot
        </div>

        <section className="relative backdrop-blur-xl">
          {/* Background atmosphere */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#040f1e] via-[#060d18] to-[#030a12]" />
          <div className="absolute -top-24 -right-24 hidden h-[600px] w-[600px] rounded-full bg-emerald-500/[0.08] blur-[140px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 hidden h-[400px] w-[400px] rounded-full bg-sky-500/[0.05] blur-[120px] pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent rounded-t-3xl" />
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />

          <div className="relative px-5 py-6 sm:px-8 sm:py-7 lg:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
              Neven Financial OS &mdash; {dateStr}
            </p>

            {/* Net Worth — dominant anchor */}
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold text-white/55">
                Net Worth
              </div>
              <h1
                className="font-bold leading-none tracking-tight text-white"
                style={{ fontSize: "clamp(3.5rem, 9vw, 7.5rem)" }}
              >
                {netWorth}
              </h1>
              <div className="mt-3 flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-base">
                  <span>↑</span>
                  {netWorthTrend}
                </span>
                <span className="text-white/[0.12]">·</span>
                <span className="text-white/70 text-sm">Good morning, Alex</span>
              </div>
            </div>

            <div className="mt-6 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

            {/* KPI row */}
            <div className="mt-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {secondaryMetrics.map((m) => (
                  <div key={m.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                    <div className="mb-2 text-xs font-medium text-white/55">
                      {m.label}
                    </div>
                    <div
                      className={`font-bold tabular-nums leading-none ${accentClass[m.accent]}`}
                      style={{ fontSize: "clamp(1.65rem, 3.5vw, 2.35rem)" }}
                    >
                      {m.value}
                    </div>
                    {m.detail && (
                      <div className={`mt-1.5 text-xs font-semibold ${accentClass[m.accent]} opacity-60`}>
                        {m.detail}
                      </div>
                    )}
                    {m.progress !== undefined && (
                      <div className="mt-2 h-[2px] w-20 rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </section>

        {/* Portfolio + Health sub-scores below hero */}
        <div className="mt-7 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 xl:col-span-2">
            <h2 className="pb-4 text-sm font-semibold text-white border-b border-white/[0.08]">
              Portfolio Allocation
            </h2>
            <div className="mt-5 space-y-5">
              {portfolioAllocation.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${item.color}`} />
                      <span className="text-sm font-medium text-white/68">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-white/78">{item.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${item.color} opacity-80`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/15 bg-white/[0.03] p-5 shadow-[0_0_42px_rgba(16,185,129,0.06)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Health Indicators
                </h2>
                <p className="mt-1 text-xs text-white/42">
                  Drivers behind the Financial Health score
                </p>
              </div>
              <div className={`rounded-xl border px-3 py-2 text-right ${healthScoreTone}`}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
                  Financial Health
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums leading-none">
                  {healthScore}
                </div>
                <div className="mt-1 text-[10px] font-semibold opacity-70">
                  {healthLabel}
                </div>
              </div>
            </div>

            {healthFocus && (
              <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    Focus area
                  </span>
                  <span className="text-xs font-semibold text-white/55">
                    {healthLabel} overall
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-4">
                  <span className="text-sm font-semibold text-white/78">
                    {healthFocus.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-amber-300">
                    {healthFocus.score}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/42">{healthFocus.note}</p>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {uniqueHealthScores.map((item) => {
                const borderCol =
                  item.score >= 90 ? "border-emerald-400/35" :
                  item.score >= 75 ? "border-sky-400/35" :
                  item.score >= 60 ? "border-amber-400/35" : "border-red-400/35";
                const numCol =
                  item.score >= 90 ? "text-emerald-400" :
                  item.score >= 75 ? "text-sky-400" :
                  item.score >= 60 ? "text-amber-400" : "text-red-400";
                const barCol =
                  item.score >= 90 ? "bg-emerald-400" :
                  item.score >= 75 ? "bg-sky-400" :
                  item.score >= 60 ? "bg-amber-400" : "bg-red-400";
                return (
                  <div key={item.label} className={`rounded-xl border bg-white/[0.035] p-3 ${borderCol}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white/72">
                          {item.label}
                        </div>
                        <div className="mt-1 text-xs text-white/40">{item.note}</div>
                      </div>
                      <div className={`text-2xl font-bold tabular-nums leading-none ${numCol}`}>
                        {item.score}
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${barCol}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          LAYER 2 — Intelligence Workspace
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <div className={`${LAYER_LABEL} mb-5`}>
          Intelligence Workspace
        </div>

        <div className="space-y-12">

          {/* Signals + Recommendations row */}
          <div className="grid gap-12 xl:grid-cols-[1.4fr_1fr]">

            {/* Intelligence Signals */}
            <div>
              <div className="flex items-baseline gap-3 pb-5 border-b border-white/[0.06]">
                <h2 className="text-sm font-semibold text-white">
                  Signals
                </h2>
                <span className="text-xs text-white/45">{insights.length} active</span>
              </div>
              <div>
                {insights.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-5 py-6 border-b border-white/[0.04] last:border-0"
                  >
                    <span className="shrink-0 text-emerald-400 font-bold text-sm leading-none mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm text-white/68 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h2 className="pb-5 text-sm font-semibold text-white border-b border-white/[0.08]">
                Recommendations
              </h2>
              <div className="mt-5 space-y-5">
                {recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full border border-emerald-400/25 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-emerald-400/60">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/72">{r.title}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-emerald-400 font-semibold">{r.impact}</span>
                        <span className="text-[9px] text-white/20">{r.confidence}% confidence</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Opportunities + Predictions row */}
          <div className="grid gap-12 xl:grid-cols-2">

            {/* Opportunities */}
            <div>
              <h2 className="pb-5 text-sm font-semibold text-white border-b border-white/[0.08]">
                Opportunities
              </h2>
              <div className="mt-5 space-y-3">
                {opportunities.map((o, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-1 w-4 rounded-full bg-emerald-400/30" />
                      <span className="text-sm text-white/65">{o.label}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums">{o.saving}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Predictions */}
            <div>
              <h2 className="pb-5 text-sm font-semibold text-white border-b border-white/[0.08]">
                Predictions
              </h2>
              <div className="mt-5 space-y-3">
                {predictions.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-white/62">{p.label}</span>
                    <div className="flex items-center gap-2">
                      {p.trend === "up" && <span className="text-[10px] text-emerald-400">↑</span>}
                      <span className="text-xs font-semibold text-white/60 tabular-nums">{p.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Copilot CTA */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center border-t border-b border-white/[0.05] py-10">
            <div className="flex-1 min-w-0">
              <h2 className="text-[9px] uppercase tracking-[0.28em] text-white/20 font-semibold mb-2">
                Copilot
              </h2>
              <p className="text-sm text-white/38 leading-relaxed max-w-md">
                Semantic memory-augmented intelligence — ask about your portfolio, cash flow, subscriptions, or goals.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <button className="rounded-xl border border-white/[0.06] px-4 py-2 text-xs text-white/35 hover:border-emerald-400/20 hover:text-white/60 hover:bg-emerald-400/[0.04] transition">
                Can I afford a larger PPOR?
              </button>
              <button className="rounded-xl border border-white/[0.06] px-4 py-2 text-xs text-white/35 hover:border-emerald-400/20 hover:text-white/60 hover:bg-emerald-400/[0.04] transition">
                Review subscription spend
              </button>
              <button className="rounded-xl border border-white/[0.06] px-4 py-2 text-xs text-white/35 hover:border-emerald-400/20 hover:text-white/60 hover:bg-emerald-400/[0.04] transition">
                Optimise savings rate
              </button>
              <button className="rounded-2xl bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-[#040f1e] hover:bg-emerald-300 transition">
                Start Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          LAYER 3 — Runtime Layer (collapsed by default)
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <button
          onClick={() => setRuntimeOpen((o) => !o)}
          className="flex w-full items-center justify-between group"
          aria-expanded={runtimeOpen}
        >
          <div className="flex items-center gap-3">
            <span className={`${LAYER_LABEL}`}>
              03 &nbsp;/&nbsp; Runtime Layer
            </span>
            <span className="text-[8px] uppercase tracking-widest text-white/10 font-semibold">
              Telemetry · Agents · Deployment · Orchestration · Infrastructure
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/15 group-hover:text-white/30 transition tabular-nums">
              {runtimeOpen ? "collapse" : "expand"}
            </span>
            <span
              className={`text-white/15 group-hover:text-white/30 transition text-xs transform ${runtimeOpen ? "rotate-180" : ""}`}
              style={{ transition: "transform 0.2s" }}
            >
              ▾
            </span>
          </div>
        </button>

        {runtimeOpen && (
          <div className="mt-8 space-y-8">

            {/* Daemon Status — current / last / next task */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="text-[8px] uppercase tracking-[0.2em] text-white/20 font-semibold pb-3 border-b border-white/[0.05] mb-4">
                Autonomous Build Status &mdash; {totalRuns} total runs
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {/* Current Task */}
                <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {currentTask ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-white/20 shrink-0" />
                    )}
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-sky-400/70">
                      Current Task
                    </span>
                  </div>
                  {currentTask ? (
                    <>
                      <div className="text-xs text-white/70 leading-relaxed line-clamp-3">
                        {currentTask.goal.split("\n")[0]}
                      </div>
                      <div className="mt-2 font-mono text-[9px] text-white/25 truncate">{currentTask.runId}</div>
                      <div className="mt-1 text-[9px] text-white/20" suppressHydrationWarning>
                        {(() => { const d = new Date(currentTask.startedAt); return `Started ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`; })()}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-white/30 italic">No active run</div>
                  )}
                </div>

                {/* Last Task */}
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${lastTask?.status === "green" ? "bg-emerald-400" : lastTask ? "bg-red-400" : "bg-white/15"}`} />
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-white/30">
                      Last Task
                    </span>
                  </div>
                  {lastTask ? (
                    <>
                      <div className="text-xs text-white/55 leading-relaxed line-clamp-3">
                        {lastTask.goalPreview}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${lastTask.status === "green" ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                          {lastTask.status}
                        </span>
                        <span className="font-mono text-[9px] text-white/20 truncate">{lastTask.runId.slice(-8)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-white/25 italic">No prior run</div>
                  )}
                </div>

                {/* Next Task */}
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${nextTask ? "bg-amber-400" : "bg-white/15"}`} />
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-amber-400/60">
                      Next Task
                    </span>
                  </div>
                  {nextTask ? (
                    <>
                      <div className="text-xs text-white/60 leading-relaxed line-clamp-3">
                        {nextTask.title}
                      </div>
                      <div className="mt-2 font-mono text-[9px] text-white/20 truncate">{nextTask.id}</div>
                    </>
                  ) : (
                    <div className="text-xs text-white/25 italic">Queue empty</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1fr_1fr_1fr] opacity-70">

              {/* Agent Runtime */}
              {agents.length > 0 && (
                <div>
                  <div className="text-[8px] uppercase tracking-[0.2em] text-white/15 font-semibold pb-3 border-b border-white/[0.04] mb-4">
                    Agents
                  </div>
                  <div className="space-y-2">
                    {agents.map((a) => (
                      <div key={a.role} className="flex items-center gap-2 py-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                            a.value === "Online" ? "bg-emerald-400" :
                            a.value === "Ready" ? "bg-sky-400" : "bg-white/20"
                          }`}
                        />
                        <span className="text-[10px] text-white/28 truncate flex-1">{a.label}</span>
                        <span className="text-[9px] text-white/15 shrink-0">{a.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Telemetry Event Stream */}
              {telemetryEvents.length > 0 && (
                <div>
                  <div className="text-[8px] uppercase tracking-[0.2em] text-white/15 font-semibold pb-3 border-b border-white/[0.04] mb-4">
                    Telemetry
                  </div>
                  <div className="space-y-3">
                    {telemetryEvents.map((e) => (
                      <div key={e.event + e.agent} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase ${levelBg[e.level] || "bg-white/5"} ${levelColor[e.level] || "text-white/30"}`}
                        >
                          {e.level}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono text-white/22 truncate">{e.event}</div>
                          <div className="text-[9px] text-white/16 truncate">{e.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deployment + Orchestration */}
              <div>
                <div className="text-[8px] uppercase tracking-[0.2em] text-white/15 font-semibold pb-3 border-b border-white/[0.04] mb-4">
                  Deployment &amp; Orchestration
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Build Pipeline", status: "green" as const, note: "28 routes compiled" },
                    { label: "API Layer", status: "green" as const, note: "Nominal" },
                    { label: "Agent Runtime", status: "green" as const, note: "10/10 online" },
                    { label: "Database", status: (dbConfigured || process.env.NEXT_PUBLIC_SUPABASE_URL ? "green" : "yellow") as "green" | "yellow", note: dbConfigured || process.env.NEXT_PUBLIC_SUPABASE_URL ? "Connected" : "Scaffold mode" },
                    { label: "Auth", status: "yellow" as const, note: "Credentials needed" },
                  ].map((c) => (
                    <div key={c.label} className="flex items-center gap-2 py-1">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          c.status === "green" ? "bg-emerald-400" :
                          c.status === "yellow" ? "bg-amber-400" : "bg-red-400"
                        }`}
                      />
                      <span className="text-[10px] text-white/28 flex-1 truncate">{c.label}</span>
                      <span className="text-[9px] text-white/15 shrink-0">{c.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
