"use client";
import { useViewMode, type ViewMode } from "./ViewModeContext";

const MODES: { id: ViewMode; label: string; desc: string; active: string }[] = [
  {
    id: "executive",
    label: "Executive",
    desc: "Financial overview & intelligence",
    active: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
  },
  {
    id: "operator",
    label: "Operator",
    desc: "Transactions, subscriptions & workflows",
    active: "bg-sky-400/20 text-sky-300 border-sky-400/30",
  },
  {
    id: "engineering",
    label: "Engineering",
    desc: "Build systems, agents & architecture",
    active: "bg-amber-400/20 text-amber-300 border-amber-400/30",
  },
  {
    id: "runtime",
    label: "Autonomous Runtime",
    desc: "Daemon, orchestration & telemetry",
    active: "bg-purple-400/20 text-purple-300 border-purple-400/30",
  },
];

export default function ViewModeBar() {
  const { mode, setMode } = useViewMode();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mr-1 shrink-0">
        View
      </span>
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          title={m.desc}
          className={`rounded-lg px-3 py-1 text-xs font-semibold transition border ${
            mode === m.id
              ? m.active
              : "border-transparent text-white/35 hover:text-white/65 hover:bg-white/5"
          }`}
        >
          {m.label}
        </button>
      ))}
      <span className="ml-auto text-[9px] text-white/20 hidden lg:block">
        {MODES.find((m) => m.id === mode)?.desc ?? ""}
      </span>
    </div>
  );
}
