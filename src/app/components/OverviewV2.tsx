interface OverviewV2Props {
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
}

export default function OverviewV2({
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
}: OverviewV2Props) {
  const secondaryStats = [
    { label: "Cash Flow", value: cashFlow, color: "text-emerald-400" },
    { label: "Savings Rate", value: savingsRate, color: "text-sky-400" },
    { label: "Runway", value: runway, color: "text-white/75" },
    { label: "AI Confidence", value: aiConfidence, color: "text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Cinematic hero */}
      <section
        id="overview"
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0c1e35] via-[#071420] to-[#04090f] backdrop-blur-xl p-8 shadow-2xl shadow-black/60 sm:p-14"
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-[30rem] w-[30rem] rounded-full bg-emerald-500/[0.09] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-sky-500/[0.06] blur-3xl" />

        <div className="relative flex flex-col gap-10 xl:flex-row xl:items-center xl:justify-between">
          {/* Left: dominant financial number */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/60">
              Finance OS &mdash; {dateStr}
            </p>
            <p className="mt-2 text-sm text-white/35 font-medium">Good morning, Alex</p>

            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-widest text-white/22 font-medium">Net Worth</div>
              <div className="mt-1.5 text-7xl font-bold tracking-tight text-white leading-none sm:text-8xl">
                {netWorth}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-emerald-400 text-sm font-bold">↑</span>
                <span className="text-emerald-400/80 text-sm font-medium">{netWorthTrend}</span>
              </div>
            </div>

            {/* Secondary stats — inline, no cards */}
            <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/[0.07] pt-7 sm:grid-cols-4">
              {secondaryStats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-[10px] uppercase tracking-wide text-white/22 font-semibold">
                    {stat.label}
                  </div>
                  <div className={`mt-1.5 text-2xl font-bold tabular-nums leading-none ${stat.color}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: health score — dominant accent */}
          <div className="xl:shrink-0">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-400/[0.18] bg-emerald-500/[0.08] backdrop-blur-xl px-10 py-8">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-semibold">
                Financial Health
              </div>
              <div className="text-[5.5rem] font-bold leading-none text-white tabular-nums">
                {healthScore}
              </div>
              <div className="text-sm font-semibold text-emerald-300">{healthLabel}</div>
              <div className="w-28 h-1.5 rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${healthScore}%` }}
                />
              </div>
              <div className="text-[10px] text-white/22 font-medium">out of 100</div>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence + Portfolio — 2 open columns */}
      <section className="grid gap-8 xl:grid-cols-[1.3fr_1fr]">
        {/* Intelligence signals — divider style, no cards */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-white/25 font-semibold border-b border-white/[0.07] pb-3">
            Intelligence Signals
          </h3>
          <div>
            {insights.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-4 border-b border-white/[0.05] last:border-0"
              >
                <span className="text-emerald-400 mt-0.5 shrink-0 text-sm font-bold">›</span>
                <p className="text-sm text-white/62 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio + health scores */}
        <div className="space-y-7">
          {/* Portfolio allocation — thin bars, open layout */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-white/25 font-semibold border-b border-white/[0.07] pb-3">
              Portfolio Allocation
            </h3>
            <div className="mt-5 space-y-4">
              {portfolioAllocation.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
                      <span className="text-white/55">{item.label}</span>
                    </div>
                    <span className="font-bold tabular-nums text-white/75">{item.pct}%</span>
                  </div>
                  <div className="h-[2px] w-full rounded-full bg-white/[0.07]">
                    <div
                      className={`h-full rounded-full ${item.color} opacity-70`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Health sub-scores — left border accent, no cards */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-white/25 font-semibold border-b border-white/[0.07] pb-3">
              Health Indicators
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-5">
              {healthScores.map((item) => {
                const borderColor =
                  item.score >= 90
                    ? "border-emerald-400/35"
                    : item.score >= 75
                    ? "border-sky-400/35"
                    : item.score >= 60
                    ? "border-amber-400/35"
                    : "border-red-400/35";
                const numColor =
                  item.score >= 90
                    ? "text-emerald-400"
                    : item.score >= 75
                    ? "text-sky-400"
                    : item.score >= 60
                    ? "text-amber-400"
                    : "text-red-400";
                return (
                  <div key={item.label} className={`border-l-2 pl-3 ${borderColor}`}>
                    <div className="text-[10px] text-white/30 font-medium">{item.label}</div>
                    <div className={`text-2xl font-bold mt-0.5 tabular-nums ${numColor}`}>
                      {item.score}
                    </div>
                    <div className="text-[10px] text-white/25 mt-0.5">{item.note}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* AI Copilot — minimal strip */}
      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl px-6 py-5 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-white/22 font-semibold">
            AI Copilot
          </div>
          <p className="mt-1 text-sm text-white/42 leading-relaxed">
            Semantic memory-augmented &mdash; ask anything about your portfolio, cash flow, or subscriptions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-white/45 hover:border-emerald-400/30 hover:text-white/75 hover:bg-emerald-400/5 transition">
            Can I afford a larger PPOR?
          </button>
          <button className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#07111f] hover:bg-emerald-300 transition">
            Start Session
          </button>
        </div>
      </section>
    </div>
  );
}
