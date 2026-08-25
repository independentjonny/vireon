import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import {
  ArrowRight,
  CircleDollarSign,
  FileCheck2,
  Home,
  MessageCircle,
  PiggyBank,
  Sparkles,
  WalletCards,
} from "lucide-react";
import type { ActionWorkflow, ActionWorkflowSummary } from "@/lib/actionWorkflows";
import type { AiDecision } from "@/lib/aiDecisionCentre";
import type { DailyReviewHistoryRecord } from "@/lib/aiCfoDailyReview";
import type { GoalPlanningSnapshot } from "@/lib/goalPlanning";
import type { FinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import IntegratedGoalsWidget from "./IntegratedGoalsWidget";
import FinancialHealthIndicatorsWidget from "./FinancialHealthIndicatorsWidget";
import {
  buildDashboardBriefing,
  excludeDisplayedFindingAction,
  selectDashboardAttentionFindings,
  selectDashboardTopPriority,
  type DashboardAction,
  type DashboardBriefing,
} from "@/lib/dashboardPresentation";

interface OverviewV3Props {
  netWorth: string;
  netWorthValue: number;
  netWorthTrend: string;
  netWorthTrendValue: number;
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
  vaultSummary?: {
    documentsUploaded: number;
    profileConfidence: number;
    estimatedBorrowingCapacity: number;
    refinanceSavingEstimate: number;
    lenderPackReadiness: number;
  };
  housingSummary?: {
    readinessScore: number;
    readinessBand: string;
    estimatedBorrowingCapacity: number;
    bestScenario: number;
    largestObstacle: string;
    nextRecommendedAction: string;
  };
  decisions: AiDecision[];
  workflows?: ActionWorkflow[];
  workflowSummary?: ActionWorkflowSummary;
  dailyReview?: DailyReviewHistoryRecord;
  goalsSnapshot: GoalPlanningSnapshot;
  financialHealth: FinancialHealthSnapshot;
}

const netWorthSeries = [
  { date: "Mar", value: 1360000 },
  { date: "Apr", value: 1540000 },
  { date: "May", value: 1760000 },
  { date: "Jun", value: 1840000 },
  { date: "Jul", value: 2000000 },
];

function formatMoney(value: number, compact = false) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function toneForAction(action: DashboardAction | null): string {
  if (!action) return "border-l-emerald-500";
  if (action.priority === "Critical") return "border-l-red-500";
  if (action.priority === "High") return "border-l-amber-500";
  if (action.source === "workflow") return "border-l-blue-500";
  return "border-l-slate-300";
}

function actionButtonLabel(action: DashboardAction | null): string {
  if (!action) return "Ask AI CFO";
  if (action.source === "workflow") return "Continue workflow";
  return action.actionLabel;
}

function DashboardBriefingHero() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 sm:px-6">
      <div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><Sparkles className="h-4 w-4" aria-hidden="true" />Vireon overview</div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">Your financial position</h1>
        <p className="mt-1 text-sm text-slate-600">What you own, owe, earn and should do next.</p>
      </div>
    </section>
  );
}

function NetWorthSparkline({ value }: { value: number }) {
  const series = netWorthSeries.map((point, index) => index === netWorthSeries.length - 1 ? { ...point, value } : point);
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = series.map((point, index) => {
    const x = 4 + index * (84 / Math.max(series.length - 1, 1));
    const y = 30 - ((point.value - min) / Math.max(max - min, 1)) * 24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 92 36" role="img" aria-label={`Net worth sparkline ending at ${formatMoney(value)}`} className="h-9 w-24 shrink-0">
      <polyline points={points} fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
    </svg>
  );
}

function CurrentPositionMetric({
  label,
  value,
  change,
  href,
  confidence,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  change: string;
  href: string;
  confidence?: string;
  icon: ElementType;
  children?: ReactNode;
}) {
  return (
    <article data-testid="dashboard-position-metric" className="group min-h-[88px] rounded-lg border border-slate-200 bg-white px-4 py-3 transition duration-150 hover:border-blue-200 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)] motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 truncate text-lg font-semibold tracking-normal text-slate-950 tabular-nums">{value}</div>
          </Link>
        </div>
        {children ?? <Icon className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-700">{change}</span>
        {confidence && <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{confidence}</span>}
      </div>
    </article>
  );
}

function PriorityActionPanel({ action }: { action: DashboardAction | null }) {
  if (!action) return null;

  return (
    <section data-testid="dashboard-primary-workflow" className={`rounded-lg border border-l-4 border-slate-200 bg-white p-5 ${toneForAction(action)}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="text-slate-500">NEXT BEST ACTION</span><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">{action.status}</span></div>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{action.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{action.blockerDetail ?? action.nextStep}</p>
        </div>
        <Link href={action.href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          {actionButtonLabel(action)}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function formatVerifiedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Australia/Sydney" }).format(date);
}

function confidenceClass(confidence: "High" | "Medium" | "Low"): string {
  if (confidence === "High") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function changeTone(item: DashboardBriefing["attentionItems"][number]): string {
  if (item.tone === "positive") return "border-l-emerald-500";
  if (item.tone === "attention") return "border-l-amber-500";
  return "border-l-blue-500";
}

function changeStatusClass(item: DashboardBriefing["attentionItems"][number]): string {
  if (item.tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (item.tone === "attention") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function RecentChanges({ items, reviewId, reviewPeriod }: { items: DashboardBriefing["attentionItems"]; reviewId?: string; reviewPeriod: string }) {
  return (
    <section data-testid="dashboard-recent-changes">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">What changed</h2>
        <p className="mt-1 text-sm text-slate-500">Compared with your previous confirmed position · {reviewPeriod}</p>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} data-testid="dashboard-recent-change" className={`flex flex-col rounded-lg border border-l-4 border-slate-200 bg-white p-4 ${changeTone(item)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${changeStatusClass(item)}`}>{item.statusLabel}</span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(item.confidence)}`}>{item.confidence} confidence</span>
            </div>
            <h3 className="mt-3 text-base font-semibold leading-6 text-slate-950">{item.title}</h3>
            <div className="mt-2 text-lg font-semibold tabular-nums text-slate-950">{item.changeLabel}</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.timeBasis}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.previousLabel}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-slate-950">{item.previousValue}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.currentLabel}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-slate-950">{item.currentValue}</div>
              </div>
            </div>
            <div className="mt-3 rounded-md bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{item.evidence[0]?.sourceTitle ?? item.sourceEngine}</div>
              {item.evidence[0] && <>
                <div className="mt-1 text-xs leading-5 text-slate-600">{item.evidence[0].factUsed}</div>
                <div className="mt-1 text-xs text-slate-500">Verified {formatVerifiedDate(item.evidence[0].lastVerifiedAt)}</div>
              </>}
            </div>
            <div className="mt-auto pt-4">
              <Link
                href={{ pathname: "/ai-cfo/daily-review", query: { ...(reviewId ? { reviewId } : {}), findingId: item.id } }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {item.actionLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
        {items.length === 0 && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 lg:col-span-3">No material changes in the latest review.</div>}
      </div>
    </section>
  );
}

function AppPathCard({ title, value, href, icon: Icon }: { title: string; value: string; href: string; icon: ElementType }) {
  return (
    <Link href={href} className="group rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm">
      <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-blue-600" aria-hidden="true" /><ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" aria-hidden="true" /></div>
      <div className="mt-4 text-sm font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
    </Link>
  );
}

function ProductMap({ netWorth, cashFlow, housingSummary, vaultSummary }: { netWorth: string; cashFlow: string; housingSummary?: OverviewV3Props["housingSummary"]; vaultSummary?: OverviewV3Props["vaultSummary"] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-950">Explore your finances</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AppPathCard title="Financial position" value={netWorth} href="/financial-profile" icon={CircleDollarSign} />
        <AppPathCard title="Cash flow" value={`${cashFlow} / month`} href="/cash-flow" icon={WalletCards} />
        <AppPathCard title="Housing" value={housingSummary ? `${housingSummary.readinessScore}/100 ready` : "Add details"} href="/housing-scenarios" icon={Home} />
        <AppPathCard title="Document Vault" value={vaultSummary ? `${vaultSummary.profileConfidence}% confidence` : "Add documents"} href="/financial-vault" icon={FileCheck2} />
      </div>
    </section>
  );
}

function AiCfoEntry({ topAction, housingSummary }: { topAction: DashboardAction | null; housingSummary?: OverviewV3Props["housingSummary"] }) {
  const prompts = [
    topAction ? `Why is ${topAction.title.toLowerCase()} the priority?` : "What should I prioritise this month?",
    housingSummary ? "Why did my borrowing readiness change?" : "What changed most this month?",
  ].slice(0, 2);
  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 px-5 py-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <MessageCircle className="h-5 w-5 text-blue-700" aria-hidden="true" />
        Ask Vireon about your position
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {prompts.map((prompt) => (
          <Link key={prompt} data-testid="dashboard-ai-cfo-prompt" href={`/ai-cfo?prompt=${encodeURIComponent(prompt)}`} className="rounded-full border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-blue-800">
            {prompt}
          </Link>
        ))}
        <Link href="/ai-cfo" className="px-2 py-2 text-sm font-semibold text-blue-800">View more prompts</Link>
      </div>
    </section>
  );
}

export default function OverviewV3({
  netWorth,
  netWorthValue,
  netWorthTrend,
  cashFlow,
  savingsRate,
  runway,
  vaultSummary,
  housingSummary,
  decisions,
  workflows = [],
  dailyReview,
  goalsSnapshot,
  financialHealth,
}: OverviewV3Props) {
  const candidateTopAction = dailyReview ? selectDashboardTopPriority({ findings: dailyReview.review.findings, decisions, workflows }) : null;
  const displayedFindings = dailyReview ? selectDashboardAttentionFindings(dailyReview.review.findings) : [];
  const topAction = excludeDisplayedFindingAction(candidateTopAction, displayedFindings);
  const briefing = dailyReview ? buildDashboardBriefing(dailyReview, topAction) : {
    label: "Financial command centre",
    headline: "Complete your financial picture to unlock personalised decisions.",
    summary: "Upload the most valuable missing input so Vireon can rank actions by verified financial impact.",
    reviewPeriod: "Not available until the first verified review",
    attentionItems: [],
    primaryAction: topAction,
  };

  return (
    <main id="overview" className="mx-auto max-w-[1180px] space-y-4 pb-24">
      <DashboardBriefingHero />

      <section aria-label="Current position" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CurrentPositionMetric label="Net worth" value={netWorth} change={netWorthTrend} href="/balance-sheet" confidence="Confirmed" icon={CircleDollarSign}>
          <NetWorthSparkline value={netWorthValue} />
        </CurrentPositionMetric>
        <CurrentPositionMetric label="Monthly surplus" value={cashFlow} change={`${savingsRate} savings rate`} href="/cash-flow" icon={WalletCards} />
        <CurrentPositionMetric label="Emergency runway" value={runway} change="At current monthly expenses" href="/financial-vault" icon={PiggyBank} />
        <CurrentPositionMetric label="Borrowing readiness" value={housingSummary ? `${housingSummary.readinessScore}/100` : "Needs data"} change={housingSummary ? housingSummary.readinessBand : "Upload lending inputs"} href="/housing-scenarios" confidence={housingSummary ? "Modelled" : undefined} icon={Home} />
      </section>

      <IntegratedGoalsWidget snapshot={goalsSnapshot} />

      <FinancialHealthIndicatorsWidget health={financialHealth} goals={goalsSnapshot} />

      <PriorityActionPanel action={topAction} />

      <RecentChanges items={briefing.attentionItems} reviewId={dailyReview?.review.id} reviewPeriod={briefing.reviewPeriod} />

      <ProductMap netWorth={netWorth} cashFlow={cashFlow} housingSummary={housingSummary} vaultSummary={vaultSummary} />

      <AiCfoEntry topAction={topAction} housingSummary={housingSummary} />

      <div className="sr-only" aria-live="polite">
        Dashboard summary: {briefing.headline} Top action: {topAction?.title ?? "none"}.
      </div>
    </main>
  );
}
