"use client";

import { useEffect, useState } from "react";

type Screenshot = {
  name: string;
  path: string;
  sizeBytes: number;
  updatedAt: string;
  url: string;
};

type Payload = {
  ok: boolean;
  screenshots: Screenshot[];
  manifest?: { generatedAt?: string; ok?: boolean } | null;
};

export default function LatestScreenshots() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/runtime/screenshots", { cache: "no-store" });
      setPayload(await res.json());
    } catch {
      setPayload({ ok: false, screenshots: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(id);
  }, []);

  const shots = payload?.screenshots ?? [];
  const latest = shots[0]?.updatedAt;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">Latest Screenshots</div>
          <div className="mt-1 text-[10px] text-white/35">
            {loading ? "Checking screenshot folder…" : latest ? `Last capture: ${new Date(latest).toLocaleString()}` : "No captures yet"}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold text-white/55 hover:bg-white/[0.08] hover:text-white"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {shots.length === 0 ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
            Run <span className="font-mono">npm run screenshot</span> to capture full-page screenshots into <span className="font-mono">/screenshot</span> and <span className="font-mono">/.ai/screenshots</span>.
          </div>
        ) : (
          shots.slice(0, 6).map((shot) => (
            <a
              key={shot.name}
              href={shot.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 transition hover:border-sky-400/30 hover:bg-sky-400/[0.05]"
            >
              <div className="truncate text-xs font-semibold text-white/70">{shot.name}</div>
              <div className="mt-1 truncate text-[10px] text-white/30">{shot.path}</div>
              <div className="mt-1 text-[10px] text-sky-300/70">{Math.round(shot.sizeBytes / 1024)} KB</div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
