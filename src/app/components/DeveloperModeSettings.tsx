"use client";

import { useEffect, useState } from "react";

export default function DeveloperModeSettings() {
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? false : window.localStorage.getItem("vireon-developer-mode") === "true"
  );

  useEffect(() => {
    const sync = () => setEnabled(window.localStorage.getItem("vireon-developer-mode") === "true");
    window.addEventListener("vireon-developer-mode-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vireon-developer-mode-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function update(enabledNext: boolean) {
    setEnabled(enabledNext);
    window.localStorage.setItem("vireon-developer-mode", enabledNext ? "true" : "false");
    window.dispatchEvent(new CustomEvent("vireon-developer-mode-change", { detail: enabledNext }));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Developer Mode</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Shows build automation, deployment, runtime, telemetry, roadmap, and supervisor tools. Shortcut: Ctrl+Shift+D.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
          Enable Developer Mode
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => update(event.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
        </label>
      </div>
    </section>
  );
}
