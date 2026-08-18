"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronDown, Clock3, EyeOff, FileSearch, Settings2, ShieldAlert, SlidersHorizontal, Sparkles, Trophy, TrendingUp } from "lucide-react";
import type { DailyReviewFinding, DailyReviewHistoryRecord, DailyReviewSettings } from "@/lib/aiCfoDailyReview";
import { selectDashboardAttentionFindings } from "@/lib/dashboardPresentation";
import { buildBriefingHeadline, buildExecutiveSummary, buildSystemHealthSummary, getReviewDirection, selectFeaturedFinding, selectFinancialWins, selectPriorityActions } from "@/lib/dailyReviewPresentation";

const sectionMap: Array<{ title: string; test: (finding: DailyReviewFinding) => boolean }> = [
  { title: "Needs attention", test: (finding) => ["Critical", "High"].includes(finding.priority) && !["positive-change", "goal-improvement"].includes(finding.type) },
  { title: "Opportunities", test: (finding) => finding.type === "opportunity" },
  { title: "Positive progress", test: (finding) => finding.type === "positive-change" || finding.type === "goal-improvement" },
  { title: "Upcoming deadlines", test: (finding) => Boolean(finding.deadline) },
  { title: "Missing or stale information", test: (finding) => finding.type === "missing-data" || finding.type === "stale-data" },
];

function money(value: number): string {
  const sign = value < 0 ? "-" : "+";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

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

function priorityClass(label: string): string {
  if (label === "Critical") return "border-red-200 bg-red-50 text-red-700";
  if (label === "High") return "border-orange-200 bg-orange-50 text-orange-700";
  if (label === "Medium") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function findingBorderClass(finding: DailyReviewFinding): string {
  if (finding.priority === "Critical") return "border-l-red-500";
  if (finding.priority === "High") return "border-l-amber-500";
  if (finding.type === "positive-change" || finding.type === "goal-improvement") return "border-l-emerald-500";
  if (finding.type === "opportunity") return "border-l-blue-500";
  return "border-l-slate-300";
}

function daypart(timestamp: string) {
  const date = new Date(timestamp);
  const hour = Number(new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ConfidenceIndicator({ confidence }: { confidence: DailyReviewFinding["confidence"] }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${confidenceClass(confidence)}`}>{confidence} confidence</span>;
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

function FeaturedFinding({ finding }: { finding: DailyReviewFinding | null }) {
  if (!finding) {
    return (
      <div className="rounded-lg border border-l-4 border-emerald-200 border-l-emerald-500 bg-white p-4">
        <div className="text-sm font-semibold text-emerald-800">Stable</div>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">No action needs attention.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">No deterministic finding crossed the configured materiality threshold.</p>
      </div>
    );
  }

  return (
    <article className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 ${findingBorderClass(finding)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-500">{finding.category.replaceAll("-", " ")}</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{finding.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{finding.whyItMatters}</p>
        </div>
        <ConfidenceIndicator confidence={finding.confidence} />
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">Financial impact</div>
          <div className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 tabular-nums">{finding.expectedImpact}</div>
        </div>
        <Link href={finding.actionHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          {finding.actionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function PriorityActionCard({ finding }: { finding: DailyReviewFinding }) {
  return (
    <article className={`flex min-h-[178px] flex-col rounded-lg border border-l-4 border-slate-200 bg-white p-4 transition duration-150 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${findingBorderClass(finding)}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${priorityClass(finding.priority)}`}>{finding.priority}</span>
        <ConfidenceIndicator confidence={finding.confidence} />
      </div>
      <h3 className="mt-3 text-base font-semibold leading-6 text-slate-950">{finding.title}</h3>
      <div className="mt-3 grid gap-2 text-sm">
        <div>
          <div className="text-slate-500">Potential effect</div>
          <div className="font-semibold text-slate-950 tabular-nums">{finding.expectedImpact}</div>
        </div>
        <div className="text-slate-600">{finding.deadline ? `Deadline ${finding.deadline}` : "Estimated effort 10 minutes"}</div>
      </div>
      <Link href={finding.actionHref} className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        {finding.actionLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

function FinancialWinsList({ wins }: { wins: DailyReviewFinding[] }) {
  if (wins.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Trophy className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          Financial wins
        </h2>
        {wins.length > 3 && <Link href="#positive-progress" className="text-sm font-semibold text-blue-700">View all progress</Link>}
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-3">
        {wins.slice(0, 3).map((win) => (
          <li key={win.id} className="flex items-start gap-2">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span><span className="font-semibold text-slate-950">{win.title}</span> <span className="text-slate-500">{win.expectedImpact}</span></span>
          </li>
        ))}
      </ul>
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

function FindingCard({ finding }: { finding: DailyReviewFinding }) {
  const [open, setOpen] = useState(false);
  const detailId = `finding-detail-${finding.id}`;
  return (
    <article className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.035)] ${findingBorderClass(finding)}`}>
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
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass(finding.priority)}`}>{finding.priority}</span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(finding.confidence)}`}>{finding.confidence}</span>
              {finding.professionalReviewRequired && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Professional review</span>}
            </div>
            <div className="mt-3 text-xs font-semibold uppercase text-slate-500">{finding.category.replaceAll("-", " ")} - {finding.type.replaceAll("-", " ")}</div>
            <h3 className="mt-1 text-base font-semibold text-slate-950">{finding.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{finding.summary}</p>
          </div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </div>
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Impact", finding.expectedImpact],
          ["Previous", finding.previousValue.toLocaleString()],
          ["Current", finding.currentValue.toLocaleString()],
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
                  <span className="font-semibold text-slate-950">{money(item.change)}</span>
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

function OverviewChanges({ findings, reviewPeriod }: { findings: DailyReviewFinding[]; reviewPeriod: string }) {
  return (
    <section data-testid="overview-review-changes" className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-700">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to overview
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Review {findings.length} changes</h1>
          <p className="mt-1 text-sm text-slate-600">The same changes shown on your overview · {reviewPeriod}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {findings.map((finding) => {
          const evidence = finding.evidence[0];
          return (
            <article key={finding.id} data-testid="overview-review-change" className={`flex flex-col rounded-lg border border-l-4 border-slate-200 bg-white p-4 ${findingBorderClass(finding)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(finding.confidence)}`}>{finding.confidence} confidence</span>
                <span className="text-sm font-semibold tabular-nums text-slate-950">{finding.expectedImpact}</span>
              </div>
              <h2 className="mt-3 text-base font-semibold leading-6 text-slate-950">{finding.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{finding.summary}</p>
              <div className="mt-3 rounded-md bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</div>
                {evidence ? (
                  <>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{evidence.sourceTitle}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">{evidence.factUsed}</div>
                    <div className="mt-1 text-xs text-slate-500">Verified {formatDate(evidence.lastVerifiedAt)}</div>
                  </>
                ) : <div className="mt-1 text-sm text-slate-600">No source evidence is attached to this finding.</div>}
              </div>
              <Link href={finding.actionHref} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">
                {finding.actionLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function DailyReviewClient({
  record,
  settings,
  lastSuccessfulReviewAt,
  showOverviewChanges = false,
}: {
  record: DailyReviewHistoryRecord;
  settings: DailyReviewSettings;
  lastSuccessfulReviewAt: string | null;
  showOverviewChanges?: boolean;
}) {
  const { review, previousSnapshot, currentSnapshot } = record;
  const [showSettings, setShowSettings] = useState(false);
  const isDemo = currentSnapshot.sourceMode === "demo";
  const sections = useMemo(() => sectionMap.map((section) => ({ ...section, findings: review.findings.filter(section.test) })), [review.findings]);
  const categoriesEnabled = settings.enabledCategories.length;
  const lowConfidenceInputs = review.findings.filter((finding) => finding.confidence === "Low").length;
  const professionalItems = review.findings.filter((finding) => finding.professionalReviewRequired).length;
  const featuredFinding = useMemo(() => selectFeaturedFinding(review.findings), [review.findings]);
  const topActions = useMemo(() => selectPriorityActions(review.findings, 3), [review.findings]);
  const wins = useMemo(() => selectFinancialWins(review.findings, review.findings.length), [review.findings]);
  const overviewChanges = useMemo(() => selectDashboardAttentionFindings(review.findings), [review.findings]);
  const briefingHeadline = buildBriefingHeadline(record);
  const executiveSummary = buildExecutiveSummary(record);
  const direction = getReviewDirection(record);
  const directionText = direction === "partial" ? "Partial review" : direction === "stable" ? "Stable" : direction === "improved" ? "Improved" : direction === "deteriorated" ? "Deteriorated" : "Mixed";
  const reviewPeriod = `${review.comparisonStartDate} to ${review.comparisonEndDate}`;

  return (
    <div className="mx-auto max-w-[1360px] space-y-6">
      {showOverviewChanges && <OverviewChanges findings={overviewChanges} reviewPeriod={reviewPeriod} />}
      <ReviewStatusBanner record={record} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.045)] sm:p-5 lg:min-h-[calc(100vh-56px)] lg:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 font-semibold text-blue-700">
                <Sparkles className="h-4 w-4 fill-blue-600 text-blue-600" aria-hidden="true" />
                Daily Financial Brief
              </span>
              <span aria-hidden="true">/</span>
              <span>{reviewPeriod}</span>
              <span aria-hidden="true">/</span>
              <span>Fresh {formatDateTime(currentSnapshot.capturedAt)}</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-600">{daypart(currentSnapshot.capturedAt)}, Alex - {directionText}</div>
              <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-8 tracking-normal text-slate-950 sm:text-3xl">{briefingHeadline}</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{executiveSummary}</p>
              {isDemo && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Demo review data. These findings are not live Financial Vault findings.</div>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="#full-findings" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                Review all changes
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="#evidence" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                View full evidence
              </Link>
            </div>
          </div>

          <FeaturedFinding finding={featuredFinding} />
        </div>

        {topActions.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {topActions.map((finding) => <PriorityActionCard key={finding.id} finding={finding} />)}
          </div>
        )}
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

      <FinancialWinsList wins={wins} />

      <SystemHealthDisclosure record={record} categoriesEnabled={categoriesEnabled} lowConfidenceInputs={lowConfidenceInputs} professionalItems={professionalItems} lastSuccessfulReviewAt={lastSuccessfulReviewAt} />

      <div id="full-findings" className="space-y-6">
      {sections.map((section) => section.findings.length > 0 && (
        <section key={section.title} id={section.title === "Positive progress" ? "positive-progress" : undefined} className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
          {section.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
        </section>
      ))}
      </div>

      <section id="evidence" className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <FileSearch className="h-5 w-5 text-blue-600" />
            Evidence
          </div>
          <div className="mt-4 space-y-3">
            {review.findings.flatMap((finding) => finding.evidence.map((item) => ({ finding, item }))).slice(0, 10).map(({ finding, item }) => (
              <div key={`${finding.id}-${item.sourceId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-950">{item.sourceTitle}</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">{item.factUsed}</div>
                <div className="mt-2 text-[11px] font-semibold uppercase text-slate-500">Affects {finding.title} - {item.classification} - {item.confidence}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Bell className="h-5 w-5 text-blue-600" />
            Suppressed changes
          </div>
          {review.suppressedFindings.length === 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              No duplicate, snoozed, expected, muted or low-evidence findings were suppressed in this run.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {review.suppressedFindings.map((finding) => (
                <div key={finding.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-950">{finding.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{finding.suppressionReason}</div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

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
