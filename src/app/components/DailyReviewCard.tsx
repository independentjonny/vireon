"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, EyeOff, ShieldAlert, Sparkles } from "lucide-react";
import type { DailyReviewHistoryRecord } from "@/lib/aiCfoDailyReview";

function money(value: number): string {
  const sign = value < 0 ? "-" : "+";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function formatSnapshotTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${byType.day}/${byType.month}/${byType.year}, ${byType.hour}:${byType.minute}:${byType.second}`;
}

function confidenceClass(label: string): string {
  if (label === "High") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function priorityWeight(label: string): number {
  if (label === "Critical") return 4;
  if (label === "High") return 3;
  if (label === "Medium") return 2;
  return 1;
}

export default function DailyReviewCard({
  record,
  compact = false,
}: {
  record: DailyReviewHistoryRecord;
  compact?: boolean;
}) {
  const { review, currentSnapshot } = record;
  const sortedFindings = [...review.findings].sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange));
  const topFinding = sortedFindings.find((finding) => finding.type !== "positive-change" && finding.type !== "goal-improvement") ?? sortedFindings[0] ?? null;
  const topWin = review.findings.find((finding) => finding.type === "positive-change" || finding.type === "goal-improvement") ?? null;
  const isDemo = currentSnapshot.sourceMode === "demo";
  const incomplete = review.status === "Failed Safely" || review.failures.length > 0;

  if (compact) {
    return (
      <article data-testid="dashboard-daily-review-row" className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:min-h-[82px] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 text-blue-700">
              <Sparkles className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
              AI CFO Daily Review
            </span>
            <span className="text-slate-400" aria-hidden="true">-</span>
            <span className="text-slate-600">
              {review.status === "No Material Changes" ? "No material changes" : incomplete ? "Partially complete" : `${review.findings.length} material change${review.findings.length === 1 ? "" : "s"}`}
            </span>
            <span className="text-slate-400" aria-hidden="true">-</span>
            <span className="text-slate-500">Snapshot {formatSnapshotTime(currentSnapshot.capturedAt)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950">
            {topFinding ? `Top update: ${topFinding.title}.` : review.overallSummary}
          </p>
          {isDemo && <div className="mt-1 text-xs font-semibold text-amber-700">Demo review data. Not live Financial Vault findings.</div>}
        </div>
        <Link href="/ai-cfo/daily-review" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800">
          Open review
          <ArrowRight className="h-4 w-4" />
        </Link>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
            AI CFO Daily Review
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-950">
            {review.status === "No Material Changes" ? "No material changes" : incomplete ? "Review incomplete" : `${review.findings.length} material change${review.findings.length === 1 ? "" : "s"}`}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {compact && topFinding ? `Top update: ${topFinding.title}.` : review.overallSummary}
          </p>
          {isDemo && <div className="mt-2 text-xs font-semibold text-amber-700">Demo review data. Not live Financial Vault findings.</div>}
        </div>
        <Link href="/ai-cfo/daily-review" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">
          Open review
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {topFinding ? (
        <div className="mt-4 rounded-lg border border-l-4 border-slate-200 border-l-amber-500 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Top priority</div>
              <div className="mt-1 text-base font-semibold text-slate-950">{topFinding.title}</div>
              <div className="mt-2 text-sm font-semibold text-slate-700">{topFinding.expectedImpact}</div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(topFinding.confidence)}`}>{topFinding.confidence}</span>
          </div>
          {!compact && <p className="mt-2 text-sm leading-6 text-slate-600">{topFinding.whyItMatters}</p>}
          <Link href={topFinding.actionHref} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">
            Start
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          No deterministic finding crossed the configured materiality thresholds.
        </div>
      )}

      {topWin && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div className="text-xs font-semibold uppercase text-emerald-700">Financial win</div>
          <div className="mt-1 text-sm font-semibold text-emerald-950">{topWin.title}</div>
          <div className="mt-1 text-xs text-emerald-800">{topWin.expectedImpact}</div>
        </div>
      )}

      {!compact && (
        <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
          <summary className="cursor-pointer list-none">System Health</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Net worth {money(review.netWorthChange)}</span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Knowledge {review.knowledgeHealthChange >= 0 ? "+" : ""}{review.knowledgeHealthChange}</span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Suppressed {review.suppressedFindings.length}</span>
          </div>
        </details>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
          <Clock3 className="h-3.5 w-3.5" />
          Snapshot {formatSnapshotTime(currentSnapshot.capturedAt)}
        </span>
        {incomplete && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Partial confidence
          </span>
        )}
        {review.findings.some((finding) => finding.professionalReviewRequired) && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
            <ShieldAlert className="h-3.5 w-3.5" />
            Professional review items
          </span>
        )}
        {!compact && review.suppressedFindings.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
            <EyeOff className="h-3.5 w-3.5" />
            Noise suppressed
          </span>
        )}
      </div>
    </article>
  );
}
