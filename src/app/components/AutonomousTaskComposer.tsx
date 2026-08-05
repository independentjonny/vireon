"use client";

import { useState, useEffect, useCallback } from "react";

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdrop\s+table\b/i,
  /\bdelete\s+from\b/i,
  /format\s+[a-z]:/i,
  /(?:^|\s)(?:cat|type|more|copy|xcopy|del|erase|rm|echo|set-content|add-content)\s+[^\n]*\.env\b/i,
  /\bgit\s+push\s+--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-f\b/i,
  /\bdrop\s+database\b/i,
  /\btruncate\s+table\b/i,
  /\bshutdown\b/i,
  /\bkill\s+-9\b/i,
];

const TASK_TEMPLATES = [
  {
    label: "Product Build",
    goal: "Product Build: Extend finance product features — improve transaction analytics, add budget tracking, enhance subscription management UI, add charts, and run browser validation.",
  },
  {
    label: "Architecture Build",
    goal: "Architecture Build: Harden platform architecture — add missing domain boundaries, improve module organization, enforce API conventions, run architecture map refresh and drift detection.",
  },
  {
    label: "UI Polish",
    goal: "UI Polish: Refine UI components — improve card layouts, add loading states, enhance color consistency, fix spacing issues, and run browser interaction validation.",
  },
  {
    label: "Repair Pass",
    goal: "Repair Pass: Diagnose and fix all known defects — check error logs, repair TypeScript issues, fix broken API routes, resolve runtime warnings, run full validation.",
  },
  {
    label: "Validation Pass",
    goal: "Validation Pass: Run full autonomous validation — npm run build, browser check, interaction check, screenshot capture, semantic gate, write claude-report.json.",
  },
  {
    label: "Release Candidate",
    goal: "Release Candidate: Prepare release candidate — run full build, validation, dependency health check, update release manifest, verify all production readiness gates.",
  },
  {
    label: "Deployment Prep",
    goal: "Deployment Prep: Prepare for production deployment — validate env vars, check database readiness, verify CI workflow, confirm release promotion gates, document deployment steps.",
  },
  {
    label: "Big Bang Next Build",
    goal: "Big Bang Next Build: Execute the highest-priority autonomous build cycle — product features, architecture hardening, UI polish, repair pass, validation, and green commit all in one orchestrated run.",
  },
];

type AssignResult = {
  ok: boolean;
  runId?: string;
  status?: string;
  note?: string;
  error?: string;
};

type BridgeStatus = {
  running: number;
  completed: number;
  failed: number;
  queued: number;
  daemonActive: boolean;
  daemonPaused: boolean;
  lastRunId: string | null;
  latestGreenCommit: string | null;
  latestGreenGoal: string | null;
};

type TaskTimelineState =
  | "idle"
  | "assigned"
  | "detected"
  | "running"
  | "validation"
  | "green"
  | "paused"
  | "failed";

function deriveTimelineState(bridge: BridgeStatus | null, lastAssigned: boolean): TaskTimelineState {
  if (!bridge) return "idle";
  if (bridge.daemonPaused) return "paused";
  if (bridge.running > 0 && bridge.daemonActive) return "running";
  if (bridge.daemonActive && lastAssigned) return "detected";
  if (bridge.failed > 0 && !bridge.daemonActive) return "failed";
  if (bridge.completed > 0 && !bridge.daemonActive) return "green";
  if (lastAssigned) return "assigned";
  return "idle";
}

const TIMELINE_STEPS: { key: TaskTimelineState; label: string; color: string }[] = [
  { key: "assigned", label: "Assigned", color: "text-purple-400" },
  { key: "detected", label: "Detected", color: "text-sky-400" },
  { key: "running", label: "Running", color: "text-blue-400" },
  { key: "validation", label: "Validation", color: "text-amber-400" },
  { key: "green", label: "Green Commit", color: "text-emerald-400" },
  { key: "paused", label: "Quota Paused", color: "text-amber-300" },
  { key: "failed", label: "Failed", color: "text-red-400" },
];

const STEP_ORDER: TaskTimelineState[] = ["assigned", "detected", "running", "validation", "green"];

export default function AutonomousTaskComposer({ suggestedGoal }: { suggestedGoal?: string }) {
  const [goal, setGoal] = useState(suggestedGoal ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [bridge, setBridge] = useState<BridgeStatus | null>(null);
  const [lastAssigned, setLastAssigned] = useState(false);
  const [dangerWarning, setDangerWarning] = useState<string | null>(null);
  const [timelineState, setTimelineState] = useState<TaskTimelineState>("idle");

  const fetchBridgeStatus = useCallback(async () => {
    try {
      const [qRes, sRes, hRes] = await Promise.all([
        fetch("/api/runtime/queue"),
        fetch("/api/runtime/status"),
        fetch("/api/runtime/heartbeat"),
      ]);
      const q = await qRes.json() as { summary?: { running?: number; completed?: number; failed?: number; queued?: number } };
      const s = await sRes.json() as { daemon?: { active?: boolean; runId?: string }; build?: { greenCommit?: string | null; latestGreenGoal?: string | null } };
      const h = await hRes.json() as { paused?: boolean };
      const next: BridgeStatus = {
        running: q.summary?.running ?? 0,
        completed: q.summary?.completed ?? 0,
        failed: q.summary?.failed ?? 0,
        queued: q.summary?.queued ?? 0,
        daemonActive: s.daemon?.active ?? false,
        daemonPaused: h.paused ?? false,
        lastRunId: s.daemon?.runId ?? null,
        latestGreenCommit: s.build?.greenCommit ?? null,
        latestGreenGoal: s.build?.latestGreenGoal ?? null,
      };
      setBridge(next);
      setTimelineState(deriveTimelineState(next, lastAssigned));
    } catch {
      // ignore transient network errors
    }
  }, [lastAssigned]);

  // Auto-poll every 5 seconds — Daemon Polling
  useEffect(() => {
    const warmup = window.setTimeout(fetchBridgeStatus, 0);
    const id = setInterval(fetchBridgeStatus, 5000);
    return () => {
      window.clearTimeout(warmup);
      clearInterval(id);
    };
  }, [fetchBridgeStatus]);

  function validateGoal(text: string): string | null {
    for (const pat of DANGEROUS_PATTERNS) {
      if (pat.test(text)) {
        return `Blocked: goal contains a dangerous pattern (matched: ${pat.source}). Remove it and try again.`;
      }
    }
    return null;
  }

  function handleGoalChange(text: string) {
    setGoal(text);
    setDangerWarning(validateGoal(text));
  }

  async function handleSubmit() {
    const trimmed = goal.trim();
    if (!trimmed) return;
    const danger = validateGoal(trimmed);
    if (danger) {
      setDangerWarning(danger);
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/autonomous-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed, forceNew: true }),
      });
      const data = await res.json() as AssignResult;
      setResult(data);
      if (data.ok) {
        setLastAssigned(true);
        setTimelineState("assigned");
        // fetchBridgeStatus is memoized with lastAssigned; calling it here would use the
        // stale lastAssigned=false closure and override "assigned" back to "idle".
        // The useEffect re-runs automatically when lastAssigned changes, so no manual call needed.
      }
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  function selectTemplate(templateGoal: string) {
    setGoal(templateGoal);
    setResult(null);
    setDangerWarning(null);
  }

  function useNextRecommended() {
    const next =
      suggestedGoal ??
      "Big Bang Next Build: Execute the highest-priority autonomous build cycle — product features, architecture hardening, UI polish, repair pass, validation, and green commit all in one orchestrated run.";
    setGoal(next);
    setResult(null);
    setDangerWarning(null);
  }

  const daemonBridgeLabel = bridge
    ? bridge.daemonActive
      ? bridge.running > 0
        ? "Running"
        : "Active — Idle"
      : bridge.daemonPaused
      ? "Paused"
      : "Idle"
    : "—";

  const daemonBridgeColor = bridge
    ? bridge.daemonActive
      ? bridge.running > 0
        ? "text-sky-400"
        : "text-emerald-400"
      : bridge.daemonPaused
      ? "text-amber-400"
      : "text-white/40"
    : "text-white/25";

  const activeStep = STEP_ORDER.indexOf(timelineState);

  return (
    <div className="space-y-4 text-black [&_*]:!text-black [&_textarea::placeholder]:!text-black/60">
      {/* Header — Build From UI / No Copy Paste Required */}
      <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 px-4 py-3">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-purple-300">
          <span>Build From UI</span>
          <span className="text-purple-400/40">&bull;</span>
          <span>Submit Autonomous Task</span>
          <span className="text-purple-400/40">&bull;</span>
          <span>Live Task Timeline</span>
          <span className="text-purple-400/40">&bull;</span>
          <span>Daemon Polling</span>
          <span className="text-purple-400/40">&bull;</span>
          <span>No Copy Paste Required</span>
          <span className="text-purple-400/40">&bull;</span>
          <span>Big Bang Next Build</span>
        </div>
        <div className="mt-0.5 text-[10px] text-white/40 leading-relaxed">
          Select a Task Template or type a custom goal, then click Submit Autonomous Task.
          The goal writes to <span className="font-mono">.ai/tasks/current-task.md</span> and the daemon picks it up automatically — no terminal needed.
          Live Task Timeline and Daemon Polling update every 5 seconds.
        </div>
      </div>

      {/* Task Templates — includes Big Bang Next Build */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-purple-400 mb-2">Task Templates</div>
        <div className="flex flex-wrap gap-2">
          {TASK_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => selectTemplate(t.goal)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors min-h-[44px] flex items-center touch-manipulation ${
                t.label === "Big Bang Next Build"
                  ? "border-sky-400/30 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20"
                  : "border-purple-400/20 bg-purple-400/10 text-purple-300 hover:bg-purple-400/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Goal textarea */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2">Build Goal</div>
        <textarea
          suppressHydrationWarning
          value={goal}
          onChange={(e) => handleGoalChange(e.target.value)}
          placeholder="Describe the build goal — or pick a Task Template above…"
          rows={4}
          className={`w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-xs text-white/80 placeholder-white/20 focus:outline-none resize-y transition-colors ${
            dangerWarning
              ? "border-red-400/60 focus:border-red-400"
              : "border-white/10 focus:border-purple-400/50"
          }`}
        />
        {dangerWarning && (
          <div className="mt-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-[10px] text-red-300">
            {dangerWarning}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !goal.trim() || !!dangerWarning}
          className="w-full sm:w-auto rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3 text-xs font-semibold text-white transition-colors min-h-[44px] touch-manipulation"
        >
          {submitting ? "Submitting…" : "Submit Autonomous Task"}
        </button>
        <button
          type="button"
          onClick={useNextRecommended}
          className="w-full sm:w-auto rounded-xl border border-sky-400/30 bg-sky-400/10 hover:bg-sky-400/20 px-5 py-3 text-xs font-semibold text-sky-300 transition-colors min-h-[44px] touch-manipulation"
        >
          Big Bang Next Build
        </button>
      </div>

      {/* Submission result + post-submit instructions */}
      {result && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            result.ok ? "border-emerald-400/30 bg-emerald-400/10" : "border-red-400/30 bg-red-400/10"
          }`}
        >
          <div className={`text-xs font-semibold ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
            {result.ok ? "Task Assigned — Daemon Will Pick It Up Automatically" : "Assignment Failed"}
          </div>
          {result.ok && result.runId && (
            <div className="mt-1 text-[10px] text-white/50 font-mono">Run ID: {result.runId}</div>
          )}
          {result.ok && result.status && (
            <div className="mt-0.5 text-[10px] text-white/40">Status: {result.status}</div>
          )}
          {result.ok && (
            <div className="mt-2 text-[10px] text-white/30 leading-relaxed">
              The daemon monitors <span className="font-mono">.ai/tasks/current-task.md</span> on its next cycle and will begin executing the task automatically.
              No PowerShell or terminal required. Live Task Timeline below will update as the daemon progresses.
            </div>
          )}
          {result.error && (
            <div className="mt-1 text-[10px] text-red-300">{result.error}</div>
          )}
          {result.ok && result.note && (
            <div className="mt-0.5 text-[10px] text-white/25">{result.note}</div>
          )}
        </div>
      )}

      {/* Live Task Timeline */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-400 mb-2">
          Live Task Timeline — Daemon Polling
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
          {timelineState === "idle" ? (
            <div className="text-[10px] text-white/30 text-center py-1">
              No active task — submit a goal above to start
            </div>
          ) : timelineState === "paused" ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-amber-300">Quota Paused — daemon awaiting resume</span>
            </div>
          ) : timelineState === "failed" ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-[11px] font-semibold text-red-400">Failed — check .ai/operations/logs/ for details</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex items-center gap-0 min-w-max">
              {STEP_ORDER.map((step, i) => {
                const stepDef = TIMELINE_STEPS.find((s) => s.key === step)!;
                const isActive = step === timelineState;
                const isPast = activeStep > i;
                return (
                  <div key={step} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-3 w-3 rounded-full border-2 transition-all ${
                          isActive
                            ? "border-sky-400 bg-sky-400 scale-125"
                            : isPast
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-white/20 bg-transparent"
                        }`}
                      />
                      <div
                        className={`mt-1 text-[9px] font-medium whitespace-nowrap ${
                          isActive ? stepDef.color : isPast ? "text-emerald-400/70" : "text-white/20"
                        }`}
                      >
                        {stepDef.label}
                      </div>
                    </div>
                    {i < STEP_ORDER.length - 1 && (
                      <div
                        className={`mx-1.5 h-0.5 w-6 rounded-full transition-all ${
                          isPast ? "bg-emerald-400/60" : "bg-white/10"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Queue to Daemon Bridge status — auto-polled */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-400 mb-2">Queue to Daemon Bridge</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Running", value: bridge?.running ?? 0, color: "text-sky-400" },
            { label: "Completed", value: bridge?.completed ?? 0, color: "text-emerald-400" },
            { label: "Failed", value: bridge?.failed ?? 0, color: "text-red-400" },
            { label: "Queued", value: bridge?.queued ?? 0, color: "text-amber-400" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-center"
            >
              <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-white/30">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span
            className={`h-2 w-2 rounded-full ${
              bridge?.daemonActive ? "bg-emerald-400" : bridge?.daemonPaused ? "bg-amber-400" : "bg-white/20"
            } ${bridge?.running && bridge.running > 0 ? "animate-pulse" : ""}`}
          />
          <span className={`text-[10px] font-semibold ${daemonBridgeColor}`}>
            Daemon: {daemonBridgeLabel}
          </span>
          {bridge?.lastRunId && (
            <span className="text-[10px] text-white/25 font-mono">{bridge.lastRunId.slice(0, 22)}…</span>
          )}
          <span className="ml-auto text-[9px] text-white/20">auto-polling 5s</span>
        </div>
        {bridge?.latestGreenCommit && (
          <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
            <div className="text-[9px] text-emerald-400/60 uppercase font-semibold mb-0.5">Latest Green Commit</div>
            <div className="text-[10px] text-emerald-300 font-mono">{bridge.latestGreenCommit.slice(0, 12)}</div>
            {bridge.latestGreenGoal && (
              <div className="mt-0.5 text-[9px] text-white/30 leading-snug">{bridge.latestGreenGoal.slice(0, 90)}{bridge.latestGreenGoal.length > 90 ? "…" : ""}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
