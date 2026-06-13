"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const SUPERVISOR_API = "http://localhost:4010";

type SupervisorTask = {
  id: string;
  status?: string;
};

type SupervisorStatus = {
  state?: { status?: string };
  tasks?: SupervisorTask[];
};

type SupervisorReport = {
  report?: {
    error?: string;
    status?: string;
    lastBuildHealth?: { summary?: string };
  };
};

type TaskResponse = {
  ok?: boolean;
  error?: string;
  task?: { id?: string };
};

function summarizeReport(payload: SupervisorReport) {
  const report = payload.report ?? {};
  if (report.error) return report.error;
  if (report.lastBuildHealth?.summary) return report.lastBuildHealth.summary;
  if (report.status) return `Latest report: ${report.status}`;
  return "No report yet.";
}

function isTaskRunning(task?: SupervisorTask) {
  return task
    ? ["queued", "running", "paused", "needs_approval"].includes(task.status ?? "")
    : false;
}

export default function SupervisorInbox() {
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState("Supervisor: checking");
  const [report, setReport] = useState("Loading latest report.");
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const activeTaskId = useRef("");

  const refresh = useCallback(async () => {
    try {
      const statusRes = await fetch(`${SUPERVISOR_API}/status`, { cache: "no-store" });
      const statusPayload = (await statusRes.json()) as SupervisorStatus;
      const tasks = Array.isArray(statusPayload.tasks) ? statusPayload.tasks : [];
      const latest = activeTaskId.current
        ? tasks.find((task) => task.id === activeTaskId.current)
        : tasks[tasks.length - 1];
      const supervisorState = statusPayload.state?.status ?? "unknown";
      const taskState = latest?.status ?? "no task";

      setStatus(`Supervisor: ${supervisorState} | Task: ${taskState}`);
      setRunning(isTaskRunning(latest));

      const reportRes = await fetch(`${SUPERVISOR_API}/report`, { cache: "no-store" });
      setReport(summarizeReport((await reportRes.json()) as SupervisorReport));
    } catch (error) {
      setStatus("Supervisor unavailable.");
      setReport(error instanceof Error ? error.message : "Unable to reach supervisor.");
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 3000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = goal.trim();
    if (!value) {
      setReport("Enter a goal before running.");
      return;
    }

    setSubmitting(true);
    setStatus("Submitting task...");

    try {
      const response = await fetch(`${SUPERVISOR_API}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: value, approved: true }),
      });
      const payload = (await response.json()) as TaskResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Task submission failed.");
      }

      activeTaskId.current = payload.task?.id ?? "";
      setReport("Task queued.");
      await refresh();
    } catch (error) {
      setStatus("Task submission failed.");
      setReport(error instanceof Error ? error.message : "Unable to submit task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <textarea
          rows={4}
          className="w-full resize-none rounded-xl border border-white/[0.1] bg-black/25 px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/60"
          placeholder="Enter a supervisor goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || running}
            className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#07111f] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
          >
            Run
          </button>
          <div className="text-sm text-white/55">{status}</div>
        </div>
      </form>

      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/35">
          Latest Report
        </div>
        <div className="text-sm leading-relaxed text-white/60">{report}</div>
      </div>
    </div>
  );
}
