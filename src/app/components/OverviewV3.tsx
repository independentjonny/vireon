import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import {
  ArrowRight,
  ChevronDown,
  CheckCircle2,
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
import {
  buildDashboardBriefing,
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

function DashboardBriefingHero({
  reviewPeriod,
  attentionItems,
}: {
  reviewPeriod: string;
  attentionItems: DashboardBriefing["attentionItems"];
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><Sparkles className="h-4 w-4" aria-hidden="true" />Vireon overview</div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">Your financial position</h1>
        <p className="mt-1 text-sm text-slate-600">What you own, owe, earn and should do next.</p>
      </div>
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <Link href="#changes-to-review" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:border-amber-400 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
          Review {attentionItems.length} change{attentionItems.length === 1 ? "" : "s"}
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Link>
        <span className="text-xs text-slate-500">Review period: {reviewPeriod}</span>
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
  if (!action) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />No action needed now</div>
      </section>
    );
  }

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

function RecentChanges({ items }: { items: DashboardBriefing["attentionItems"] }) {
  return (
    <section id="changes-to-review" className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-5 target:border-amber-400 target:ring-2 target:ring-amber-200">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">What changed</h2><Link href="/ai-cfo/daily-review" className="text-sm font-semibold text-blue-700">View review</Link></div>
      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <Link href={item.actionHref} className="font-semibold text-slate-950 hover:text-blue-700">{item.title}</Link>
              <p className="mt-0.5 truncate text-xs text-slate-500">{item.evidence[0]?.sourceTitle ?? item.sourceEngine} · {item.confidence} confidence</p>
            </div>
            <div className="font-semibold tabular-nums text-slate-800">{item.impact}</div>
          </li>
        ))}
        {items.length === 0 && <li className="py-3 text-sm text-slate-600">No material changes in the latest review.</li>}
      </ul>
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
}: OverviewV3Props) {
  const topAction = dailyReview ? selectDashboardTopPriority({ findings: dailyReview.review.findings, decisions, workflows }) : null;
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
      <DashboardBriefingHero reviewPeriod={briefing.reviewPeriod} attentionItems={briefing.attentionItems} />

      <section aria-label="Current position" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CurrentPositionMetric label="Net worth" value={netWorth} change={netWorthTrend} href="/balance-sheet" confidence="Confirmed" icon={CircleDollarSign}>
          <NetWorthSparkline value={netWorthValue} />
        </CurrentPositionMetric>
        <CurrentPositionMetric label="Monthly surplus" value={cashFlow} change={`${savingsRate} savings rate`} href="/cash-flow" icon={WalletCards} />
        <CurrentPositionMetric label="Emergency runway" value={runway} change="At current monthly expenses" href="/financial-vault" icon={PiggyBank} />
        <CurrentPositionMetric label="Borrowing readiness" value={housingSummary ? `${housingSummary.readinessScore}/100` : "Needs data"} change={housingSummary ? housingSummary.readinessBand : "Upload lending inputs"} href="/housing-scenarios" confidence={housingSummary ? "Modelled" : undefined} icon={Home} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <PriorityActionPanel action={topAction} />
        <RecentChanges items={briefing.attentionItems} />
      </section>

      <ProductMap netWorth={netWorth} cashFlow={cashFlow} housingSummary={housingSummary} vaultSummary={vaultSummary} />

      <AiCfoEntry topAction={topAction} housingSummary={housingSummary} />

      <div className="sr-only" aria-live="polite">
        Dashboard summary: {briefing.headline} Top action: {topAction?.title ?? "none"}.
      </div>
    </main>
  );
}
