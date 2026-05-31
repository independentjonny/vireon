"use client";
import { useState } from "react";
import type { ReactNode } from "react";

const LABELS = [
  "UI v1 — Standard Dashboard",
  "UI v2 — Premium Command Centre",
  "UI v3 — Attention Flow",
];

export default function UIToggleWrapper({
  children,
  v2,
  v3,
}: {
  children: ReactNode;
  v2: ReactNode;
  v3?: ReactNode;
}) {
  const max = v3 ? 2 : 1;
  const [mode, setMode] = useState(max);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5">
        <span className="text-xs text-white/35 font-medium tabular-nums">
          {LABELS[mode]}
        </span>
        <button
          onClick={() => setMode((m) => (m + 1) % (max + 1))}
          className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white hover:border-white/30 active:scale-95"
        >
          Toggle UI
        </button>
      </div>
      {mode === 0 ? children : mode === 1 ? v2 : v3}
    </div>
  );
}
