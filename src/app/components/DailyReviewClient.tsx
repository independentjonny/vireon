"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Clock3, Settings2, ShieldAlert, SlidersHorizontal, Sparkles, TrendingUp } from "lucide-react";
import type { DailyReviewFinding, DailyReviewHistoryRecord, DailyReviewSettings } from "@/lib/aiCfoDailyReview";
import { buildSystemHealthSummary } from "@/lib/dailyReviewPresentation";
import { buildFindingDisplay, findingIsPositive } from "@/lib/dailyReviewDisplay";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function confidenceClass(label: string): string {
  if (label === "High") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function findingBorderClass(finding: DailyReviewFinding): string {
  if (findingIsPositive(finding)) return "border-l-emerald-500";
  if (finding.priority === "Critical") return "border-l-red-500";
  if (finding.priority === "High") return "border-l-amber-500";
  if (finding.type === "opportunity") return "border-l-blue-500";
  return "border-l-slate-300";
}

function findingStatusClass(finding: DailyReviewFinding): string {
  if (findingIsPositive(finding)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (finding.type === "risk" || finding.type === "negative-change" || finding.type === "missing-data" || finding.type === "stale-data") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function attributionChange(label: string, value: number): string {
  const direction = value < 0 ? "lower" : value > 0 ? "higher" : "unchanged";
  const magnitude = Math.abs(value);
  if (/rate/i.test(label)) return `${magnitude.toFixed(2)} percentage points ${direction}`;
  if (/coverage|score|progress/i.test(label)) return `${Math.round(magnitude).toLocaleString("en-AU")} points ${direction}`;
  const amount = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(magnitude);
  const cadence = /cash flow|income|spending/i.test(label) ? " per year" : "";
  return `${amount}${cadence} ${direction}`;
}

function ReviewStatusBanner({ record }: { record: DailyReviewHistoryRecord }) {
  const { review } = record;
  if (review.failures.length === 0) return null;

  return (
    <section className="rounded-lg border border-l-4 border-red-200 border-l-red-500 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold text-red-950">Review partially complete</h2>
          <p className="mt-1 text-sm leading-6 text-red-800">Some areas could not be checked. Available findings are shown with reduced confidence, and Vireon did not show No material changes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {review.failures.map((failure) => <span key={failure.engine} className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-800">{failure.engine} unavailable</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function SystemHealthDisclosure({
  record,
  categoriesEnabled,
  lowConfidenceInputs,
  professionalItems,
  lastSuccessfulReviewAt,
}: {
  record: DailyReviewHistoryRecord;
  categoriesEnabled: number;
  lowConfidenceInputs: number;
  professionalItems: number;
  lastSuccessfulReviewAt: string | null;
}) {
  const { review, currentSnapshot } = record;
  const health = buildSystemHealthSummary(record);
  const [open, setOpen] = useState(false);

  return (
    <section className={`rounded-lg border bg-white p-4 ${health.emphasise ? "border-amber-200" : "border-slate-200"}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="daily-review-system-health"
        onClick={() => setOpen((value) => !value)}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <TrendingUp className={`h-4 w-4 ${health.emphasise ? "text-amber-600" : "text-slate-500"}`} aria-hidden="true" />
              System Health
            </div>
            <div className={`mt-1 text-sm font-semibold ${health.emphasise ? "text-amber-700" : "text-slate-600"}`}>{health.label} - {health.confidenceScore}% confidence</div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </div>
      </button>
      {open && (
        <div id="daily-review-system-health">
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Review period", `${review.comparisonStartDate} to ${review.comparisonEndDate}`],
              ["Last successful", lastSuccessfulReviewAt ? formatDateTime(lastSuccessfulReviewAt) : "First review"],
              ["Calculation timestamp", formatDateTime(currentSnapshot.capturedAt)],
              ["Rule freshness", currentSnapshot.ruleLastVerified],
              ["Vault confidence", `${currentSnapshot.knowledgeHealthScore}/100`],
              ["Missing inputs", lowConfidenceInputs.toString()],
              ["Suppressed findings", review.suppressedFindings.length.toString()],
              ["Coverage", `${categoriesEnabled} categories, ${professionalItems} adviser-review items`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
          {health.reasons.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {health.reasons.join(". ")}.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FindingCard({
  finding,
  comparisonStartDate,
  comparisonEndDate,
  selected = false,
}: {
  finding: DailyReviewFinding;
  comparisonStartDate: string;
  comparisonEndDate: string;
  selected?: boolean;
}) {
  const [open, setOpen] = useState(selected);
  const detailId = `finding-detail-${finding.id}`;
  const display = buildFindingDisplay(finding, comparisonStartDate, comparisonEndDate);
  return (
    <article id={`finding-${finding.id}`} data-testid={selected ? "daily-review-selected-finding" : "daily-review-finding"} className={`scroll-mt-6 rounded-lg border border-l-4 bg-white p-4 ${selected ? "border-blue-300 shadow-[0_16px_40px_rgba(37,99,235,0.10)]" : "border-slate-200 shadow-[0_12px_34px_rgba(15,23,42,0.035)]"} ${findingBorderClass(finding)}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((value) => !value)}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${findingStatusClass(finding)}`}>{display.statusLabel}</span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(finding.confidence)}`}>{finding.confidence}</span>
              {finding.professionalReviewRequired && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Professional review</span>}
            </div>
            <div className="mt-3 text-xs font-semibold uppercase text-slate-500">{finding.category.replaceAll("-", " ")} - {finding.type.replaceAll("-", " ")}</div>
            <h3 className="mt-1 text-base font-semibold text-slate-950">{finding.title}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">{display.timeBasis}</p>
          </div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </div>
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Change", display.changeLabel],
          [display.previousLabel, display.previousValue],
          [display.currentLabel, display.currentValue],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={finding.actionHref} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">
          {finding.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {finding.deadline && <span className="inline-flex h-10 items-center rounded-lg border border-red-100 bg-red-50 px-3 text-sm font-semibold text-red-700">Due {finding.deadline}</span>}
      </div>

      {open && (
        <div id={detailId} className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">Why it matters</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{finding.whyItMatters}</p>
            <div className="mt-4 text-sm font-semibold text-slate-950">Attribution</div>
            <div className="mt-2 space-y-2">
              {finding.attribution.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="font-semibold text-slate-950">{attributionChange(item.label, item.change)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">Evidence and assumptions</div>
            <div className="mt-3 space-y-3">
              {finding.evidence.map((item) => (
                <div key={`${item.sourceId}-${item.factUsed}`} className="rounded-md bg-white p-3">
                  <div className="text-sm font-semibold text-slate-950">{item.sourceTitle}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">{item.factUsed}</div>
                  <div className="mt-2 text-[11px] font-semibold uppercase text-slate-500">{item.classification} - verified {formatDate(item.lastVerifiedAt)}</div>
                </div>
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
              {finding.assumptions.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </section>
        </div>
      )}
    </article>
  );
}

export default function DailyReviewClient({
  record,
  settings,
  lastSuccessfulReviewAt,
  selectedFindingId,
}: {
  record: DailyReviewHistoryRecord;
  settings: DailyReviewSettings;
  lastSuccessfulReviewAt: string | null;
  selectedFindingId?: string;
}) {
  const { review, previousSnapshot, currentSnapshot } = record;
  const [showSettings, setShowSettings] = useState(false);
  const isDemo = currentSnapshot.sourceMode === "demo";
  const selectedFinding = review.findings.find((finding) => finding.id === selectedFindingId) ?? null;
  const visibleFindings = selectedFinding ? review.findings.filter((finding) => finding.id !== selectedFinding.id) : review.findings;
  const categoriesEnabled = settings.enabledCategories.length;
  const lowConfidenceInputs = review.findings.filter((finding) => finding.confidence === "Low").length;
  const professionalItems = review.findings.filter((finding) => finding.professionalReviewRequired).length;
  const positiveCount = review.findings.filter((finding) => finding.type === "positive-change" || finding.type === "goal-improvement").length;
  const attentionCount = review.findings.length - positiveCount;
  const reviewPeriod = `${review.comparisonStartDate} to ${review.comparisonEndDate}`;

  return (
    <div className="mx-auto max-w-[1360px] space-y-6">
      <ReviewStatusBanner record={record} />

      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2 font-semibold text-blue-700"><Sparkles className="h-4 w-4" aria-hidden="true" />Daily Review</span>
          <span aria-hidden="true">·</span>
          <span>{reviewPeriod}</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">Daily Review</h1>
        <p className="mt-2 text-sm text-slate-600">{review.findings.length} distinct changes · {attentionCount} need attention · {positiveCount} positive · Updated {formatDateTime(currentSnapshot.capturedAt)}</p>
        {isDemo && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Demo review data. These findings are not live Financial Vault findings.</div>}
      </section>

      {review.findings.length === 0 && review.failures.length === 0 && (
        <section className="rounded-lg border border-emerald-200 bg-white p-5">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold text-slate-950">Your financial position is stable.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">No material changes need attention since the previous review.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href="/ai-cfo" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">Ask AI CFO</Link>
            <span className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">Next review: {settings.frequency}</span>
          </div>
        </section>
      )}

      {selectedFinding && (
        <section aria-label="Selected finding">
          <FindingCard finding={selectedFinding} comparisonStartDate={review.comparisonStartDate} comparisonEndDate={review.comparisonEndDate} selected />
        </section>
      )}

      {visibleFindings.length > 0 && (
        <section id="full-findings" className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-950">{selectedFinding ? "Other changes in this review" : "Changes in this review"}</h2>
          {visibleFindings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} comparisonStartDate={review.comparisonStartDate} comparisonEndDate={review.comparisonEndDate} />
          ))}
        </section>
      )}

      <SystemHealthDisclosure record={record} categoriesEnabled={categoriesEnabled} lowConfidenceInputs={lowConfidenceInputs} professionalItems={professionalItems} lastSuccessfulReviewAt={lastSuccessfulReviewAt} />

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-950">
          <Clock3 className="h-5 w-5 text-blue-600" />
          Audit snapshot
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Previous snapshot", previousSnapshot.id],
            ["Current snapshot", currentSnapshot.id],
            ["Generated decisions", review.generatedDecisions.length.toString()],
            ["Timeline events", review.generatedTimelineEvents.length.toString()],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
              <div className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </div>
        {review.findings.some((finding) => finding.professionalReviewRequired) && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            Professional review required before acting on flagged tax, ownership, lender-policy, legal or regulated advice matters.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <button type="button" onClick={() => setShowSettings((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Daily Review settings
        </button>

        {showSettings && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <SlidersHorizontal className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Stored separately from Financial Vault facts
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Frequency", settings.frequency],
                ["Minimum impact", settings.minimumImpact],
                ["Notification preference", settings.notificationPreference],
                ["Valuation sensitivity", settings.quiet.valuationSensitivity],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
