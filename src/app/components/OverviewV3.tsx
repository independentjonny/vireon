import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  Goal,
  Home,
  ListChecks,
  MessageCircle,
  PiggyBank,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import DailyReviewCard from "./DailyReviewCard";
import type { ActionWorkflow, ActionWorkflowSummary } from "@/lib/actionWorkflows";
import type { AiDecision } from "@/lib/aiDecisionCentre";
import type { DailyReviewHistoryRecord } from "@/lib/aiCfoDailyReview";
import {
  buildDashboardBriefing,
  selectDashboardSecondaryActions,
  selectDashboardTopPriority,
  selectVerifiedFinancialWins,
  type DashboardAction,
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

function confidenceClass(confidence: DashboardAction["confidence"]): string {
  if (confidence === "High") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function actionButtonLabel(action: DashboardAction | null): string {
  if (!action) return "Ask AI CFO";
  if (action.source === "workflow") return "Continue workflow";
  return action.actionLabel;
}

function priorityStatusLine(action: DashboardAction | null): string {
  if (!action) return "No urgent action currently requires execution.";
  if (action.source === "workflow" && /vault|document|information/i.test(action.title)) return `Complete financial profile - ${action.status}`;
  if (action.source === "workflow") return `${action.title} - ${action.status}`;
  return `${action.title} - ${action.impact}`;
}

function DashboardBriefingHero({
  label,
  headline,
  summary,
  topAction,
}: {
  label: string;
  headline: string;
  summary: string;
  topAction: DashboardAction | null;
}) {
  return (
    <section className={`rounded-lg border border-l-4 border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)] sm:p-6 ${toneForAction(topAction)}`}>
      <div className="min-w-0">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
          <Sparkles className="h-4 w-4 fill-blue-600 text-blue-600" aria-hidden="true" />
          {label}
        </div>
        <h1 className="mt-3 max-w-4xl text-2xl font-semibold leading-8 tracking-normal text-slate-950 sm:text-3xl">
          {headline}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{summary}</p>
        <div className="mt-4 flex flex-col">
          <div className="order-2 mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:order-1 sm:mt-0">
            <span className="font-semibold text-slate-500">Current priority: </span>
            <span className="font-semibold text-slate-950">{priorityStatusLine(topAction)}</span>
          </div>
          <div className="order-1 flex flex-col gap-2 sm:order-2 sm:mt-5 sm:flex-row">
            <Link href={topAction?.href ?? "/ai-cfo"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              {actionButtonLabel(topAction)}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/ai-cfo/daily-review" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              Open Daily Review
            </Link>
          </div>
        </div>
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
  explanation,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  change: string;
  href: string;
  confidence?: string;
  explanation: string;
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
      <details className="mt-3 text-xs leading-5 text-slate-500">
        <summary className="cursor-pointer font-semibold text-slate-700">How this is calculated</summary>
        <p className="mt-1">{explanation}</p>
      </details>
    </article>
  );
}

function priorityImpactText(action: DashboardAction, vaultSummary?: OverviewV3Props["vaultSummary"]): string {
  if (action.source === "workflow" && /vault|document|information/i.test(action.title) && vaultSummary) {
    return `Current Vault confidence is ${vaultSummary.profileConfidence}%; this resolves the remaining high-impact fact gap.`;
  }
  return action.impact;
}

function PriorityActionPanel({ action, vaultSummary }: { action: DashboardAction | null; vaultSummary?: OverviewV3Props["vaultSummary"] }) {
  if (!action) {
    return (
      <section className="rounded-lg border border-emerald-100 bg-white p-5">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-slate-950">No high-priority action is active.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your next scheduled review will check for new material changes.</p>
      </section>
    );
  }

  return (
    <section data-testid="dashboard-primary-workflow" className={`rounded-lg border border-l-4 border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)] ${toneForAction(action)}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{action.source === "workflow" ? "Active workflow" : "Top priority"}</span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(action.confidence)}`}>{action.confidence} confidence</span>
            {action.professionalReviewRequired && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Professional review</span>}
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-7 text-slate-950">{action.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{action.whyItMatters}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-sm text-slate-500">Expected effect</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{priorityImpactText(action, vaultSummary)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Next step</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{action.nextStep}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Status</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{action.status}</div>
            </div>
          </div>
        </div>
        <Link href={action.href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          {actionButtonLabel(action)}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function SecondaryActionCard({ action }: { action: DashboardAction; emphasised?: boolean }) {
  return (
    <article data-testid="dashboard-secondary-action" className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-h-[78px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">{action.source === "workflow" ? "Workflow" : action.priority}</div>
          <h3 className="mt-1 truncate text-base font-semibold leading-6 text-slate-950">{action.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm leading-5 text-slate-600">{action.impact}</p>
        </div>
        <Link href={action.href} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          {action.actionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function FinancialProgress({ wins }: { wins: Array<{ id: string; title: string; impact: string; href: string }> }) {
  if (wins.length === 0) return null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        Financial progress
      </h2>
      <ul className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-3">
        {wins.map((win) => (
          <li key={win.id} className="flex items-start gap-2">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <Link href={win.href} className="font-semibold text-slate-950 hover:text-blue-700">{win.title} <span className="font-medium text-slate-500">{win.impact}</span></Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActiveWorkflowSummary({ workflows, summary, primaryWorkflowRendered }: { workflows: ActionWorkflow[]; summary?: ActionWorkflowSummary; primaryWorkflowRendered: boolean }) {
  if (!primaryWorkflowRendered) return null;
  const active = summary?.active ?? workflows.filter((item) => !["Completed", "Cancelled", "Dismissed"].includes(item.status)).length;
  const waiting = summary ? summary.waitingOnUser + summary.waitingOnDocument : workflows.filter((item) => item.status.includes("Waiting") || item.status === "Awaiting Verification").length;
  if (active <= 1 && waiting === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <ListChecks className="h-5 w-5 text-blue-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-800">{active} active workflow{active === 1 ? "" : "s"}{waiting > 0 ? ` · ${waiting} waiting on evidence` : ""}</p>
      </div>
      <Link href="/action-workflows" className="text-sm font-semibold text-blue-700">View all workflows</Link>
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

function PriorityGoal() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Goal className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Goal planning
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create or review a goal to see deterministic milestones, required contributions and cash-flow trade-offs. Vireon will not show a progress percentage until a saved goal is available.
          </p>
        </div>
        <Link href="/goals" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800">View all goals</Link>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-2 rounded-full bg-slate-300" style={{ width: "0%" }} />
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-700">Projected completion: not calculated yet</div>
    </section>
  );
}

function ContextualWorkspaceLink({ title, detail, href, icon: Icon }: { title: string; detail: string; href: string; icon: ElementType }) {
  return (
    <Link href={href} data-testid="dashboard-workspace-link" className="rounded-lg border border-slate-200 bg-white p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
      <Icon className="h-5 w-5 text-blue-600" aria-hidden="true" />
      <div className="mt-3 text-base font-semibold text-slate-950">{title}</div>
      <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
    </Link>
  );
}

function selectWorkspaceLinks(vaultSummary: OverviewV3Props["vaultSummary"], housingSummary: OverviewV3Props["housingSummary"], topAction: DashboardAction | null) {
  const links = [
    {
      title: "Financial Vault",
      detail: vaultSummary ? `${vaultSummary.lenderPackReadiness} of 5 required documents verified; confidence ${vaultSummary.profileConfidence}%.` : "Verify high-impact facts before relying on recommendations.",
      href: "/financial-vault",
      icon: FileCheck2,
      score: topAction?.title.toLowerCase().includes("vault") || topAction?.title.toLowerCase().includes("document") ? 100 : vaultSummary ? 70 : 60,
    },
    {
      title: "Housing",
      detail: housingSummary ? `Borrowing readiness is ${housingSummary.readinessScore}/100. ${housingSummary.largestObstacle}.` : "Add borrowing inputs to model readiness.",
      href: "/housing-scenarios",
      icon: Home,
      score: topAction?.title.toLowerCase().includes("borrow") || topAction?.title.toLowerCase().includes("mortgage") ? 95 : housingSummary ? 80 : 50,
    },
    {
      title: "Cash Flow",
      detail: "Review recurring spending before adjusting borrowing or goals.",
      href: "/cash-flow",
      icon: WalletCards,
      score: topAction?.title.toLowerCase().includes("spending") || topAction?.title.toLowerCase().includes("cash") ? 90 : 45,
    },
  ];
  return links.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 2);
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
  workflowSummary,
  dailyReview,
}: OverviewV3Props) {
  const topAction = dailyReview ? selectDashboardTopPriority({ findings: dailyReview.review.findings, decisions, workflows }) : null;
  const briefing = dailyReview ? buildDashboardBriefing(dailyReview, topAction) : {
    label: "Financial command centre",
    headline: "Complete your financial picture to unlock personalised decisions.",
    summary: "Upload the most valuable missing input so Vireon can rank actions by verified financial impact.",
    primaryAction: topAction,
  };
  const secondaryActions = dailyReview ? selectDashboardSecondaryActions({ findings: dailyReview.review.findings, decisions, workflows, topAction, limit: 3 }) : decisions.slice(0, 3).map((decision) => ({
    id: decision.id,
    source: "decision" as const,
    sourceEntityId: decision.id,
    title: decision.title,
    whyItMatters: decision.whyThisMatters,
    impact: decision.expectedImpact,
    nextStep: decision.nextStep,
    status: decision.timeToComplete,
    confidence: decision.confidence,
    priority: decision.priority,
    href: decision.actionHref,
    actionLabel: decision.actionLabel,
    professionalReviewRequired: false,
  }));
  const wins = dailyReview ? selectVerifiedFinancialWins(dailyReview.review.findings, workflows, 3) : [];
  const activeDecisionCount = decisions.filter((decision) => decision.priority !== "Low").length;
  const topWin = wins[0] ?? null;
  const primaryWorkflowRendered = topAction?.source === "workflow";
  const workspaceLinks = selectWorkspaceLinks(vaultSummary, housingSummary, topAction);

  return (
    <main id="overview" className="mx-auto max-w-[1180px] space-y-4 pb-24">
      <DashboardBriefingHero label={briefing.label} headline={briefing.headline} summary={briefing.summary} topAction={topAction} />

      <section aria-label="Current position" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CurrentPositionMetric label="Net worth" value={netWorth} change={netWorthTrend} href="/balance-sheet" confidence={dailyReview?.review.findings.some((finding) => finding.category === "net-worth") ? "Verified" : undefined} explanation="Assets minus liabilities from confirmed Financial Vault inputs and persisted financial read-model data." icon={CircleDollarSign}>
          <NetWorthSparkline value={netWorthValue} />
        </CurrentPositionMetric>
        <CurrentPositionMetric label="Monthly surplus" value={cashFlow} change={`${savingsRate} savings rate`} href="/cash-flow" explanation="Confirmed monthly income minus recurring spending and required debt repayments. Missing inputs are not treated as zero." icon={WalletCards} />
        <CurrentPositionMetric label="Emergency runway" value={runway} change="Available cash buffer" href="/financial-vault" explanation="Liquid cash divided by confirmed monthly spending. The result changes when cash balances or spending facts are refreshed." icon={PiggyBank} />
        <CurrentPositionMetric label="Borrowing readiness" value={housingSummary ? `${housingSummary.readinessScore}/100` : "Needs data"} change={housingSummary ? housingSummary.readinessBand : "Upload lending inputs"} href="/housing-scenarios" confidence={housingSummary ? "Modelled" : undefined} explanation="A deterministic readiness score from income, spending, liabilities, property and document completeness. It is not loan approval." icon={Home} />
      </section>

      <PriorityActionPanel action={topAction} vaultSummary={vaultSummary} />

      {secondaryActions.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Secondary actions</h2>
            {activeDecisionCount > secondaryActions.length && <Link href="/insights" className="text-sm font-semibold text-blue-700">View all decisions</Link>}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {secondaryActions.map((action, index) => <SecondaryActionCard key={`${action.source}-${action.id}`} action={action} emphasised={index === 0} />)}
          </div>
        </section>
      )}

      <AiCfoEntry topAction={topAction} housingSummary={housingSummary} />

      {topWin && <FinancialProgress wins={wins} />}

      <PriorityGoal />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Deeper analysis</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {workspaceLinks.map((workspace) => (
            <ContextualWorkspaceLink key={workspace.href} title={workspace.title} detail={workspace.detail} href={workspace.href} icon={workspace.icon} />
          ))}
        </div>
        <Link href="/insights" className="mt-3 inline-flex text-sm font-semibold text-blue-700">View all financial workspaces</Link>
      </section>

      {dailyReview && <DailyReviewCard record={dailyReview} compact />}

      <ActiveWorkflowSummary workflows={workflows} summary={workflowSummary} primaryWorkflowRendered={primaryWorkflowRendered} />

      {briefing.headline.includes("Complete your financial picture") && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <ShieldAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-slate-950">Most valuable missing input</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">Upload the latest payslip or loan statement to improve borrowing and cash-flow confidence.</p>
          <Link href="/financial-vault" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">Complete Financial Vault</Link>
        </section>
      )}

      <div className="sr-only" aria-live="polite">
        Dashboard summary: {briefing.headline} Top action: {topAction?.title ?? "none"}. Strongest win: {topWin?.title ?? "none"}.
      </div>
    </main>
  );
}
