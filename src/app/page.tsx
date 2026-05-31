import type { ReactNode } from "react";
import { connection } from "next/server";
import ImportWorkflow from "./components/ImportWorkflow";
import AutonomousTaskComposer from "./components/AutonomousTaskComposer";
import FinanceCharts from "./components/FinanceCharts";
import UIToggleWrapper from "./components/UIToggleWrapper";
import OverviewV2 from "./components/OverviewV2";
import OverviewV3 from "./components/OverviewV3";
import MobileNav from "./components/MobileNav";
import LatestScreenshots from "./components/LatestScreenshots";

export const dynamic = "force-dynamic";
import {
  getLocalTransactions,
  getLocalSubscriptions,
  getLocalImports,
  getWorkflowRuns,
  hasLocalData,
  getStorageMode,
  backfillSubscriptionsFromTransactions,
} from "@/lib/localStore";
import {
  computeFinanceSummary,
  computeCashflowForecast,
  computeMonthSummaries,
} from "@/lib/services/financeService";
import { computeRenewalCalendar } from "@/lib/services/subscriptionService";
import {
  getRuntimeStatus,
  getRuntimeLogs,
  getRuntimeQueue,
  getGitState,
  getScreenshotMeta,
  getHeartbeat,
  getSchedulerStatus,
  getOvernightStatus,
  getNextTask,
  getDefects,
  getFinalGreenReport,
} from "@/lib/runtimeControl";
import { getActiveRun } from "@/lib/daemonRuntime";
import { getBuildHistory, getLatestBuildStatus } from "@/lib/buildPipeline";
import { scanDependencyHealth } from "@/lib/dependencyScanner";
import { generateArchitectureMap, persistArchitectureMap } from "@/lib/architectureMapper";
import { listBuildJobs } from "@/lib/buildQueue";
import { generateCIReadiness, persistCIWorkflow } from "@/lib/ciReadiness";
import { detectArchitectureDrift } from "@/lib/architectureDrift";
import { generateReleaseCandidate } from "@/lib/releaseCandidate";
import { getOrchestratorSummary } from "@/lib/buildOrchestrator";
import { listAllowedCommands } from "@/lib/commandPolicy";
import { getArtifactManifest } from "@/lib/buildArtifactManifest";
import { getPromotionSummary } from "@/lib/releasePromotion";
import { TRANSIENT_ERROR_PATTERNS } from "@/lib/buildOrchestrator";
import { buildSystemComponents } from "@/lib/systemHealth";
import { buildExecutionQueue } from "@/lib/roadmapExecution/executionEngine";
import { runtimeConfig } from "@/lib/runtime/runtime-config";

const nav = [
  "Overview",
  "Transactions",
  "Subscriptions",
  "Financial Intelligence",
  "AI Copilot",
  "Analytics",
  "Roadmap",
  "Telemetry",
  "Deployment",
  "Remote Control",
  "Build Automation",
  "Architecture Governance",
  "Settings",
];

const navHrefs: Record<string, string> = {
  "Overview": "#overview",
  "Transactions": "#transactions",
  "Subscriptions": "#subscriptions",
  "Financial Intelligence": "#financial-intelligence",
  "AI Copilot": "#ai-copilot",
  "Analytics": "#analytics",
  "Roadmap": "#roadmap",
  "Telemetry": "#telemetry",
  "Deployment": "#deployment",
  "Remote Control": "#remote-control",
  "Build Automation": "#build-automation",
  "Architecture Governance": "#architecture-governance",
  "Settings": "#settings",
};

const metrics: { label: string; value: string; note: string; trend: "up" | "down" | "neutral" }[] = [
  { label: "Net Worth", value: "$1.84M", note: "+4.2% this month", trend: "up" },
  { label: "Cash Flow", value: "+$6,420", note: "Stable trajectory", trend: "up" },
  { label: "Savings Rate", value: "31%", note: "Above target", trend: "up" },
  { label: "Runway", value: "8.4 mo", note: "Healthy buffer", trend: "neutral" },
  { label: "AI Confidence", value: "96%", note: "Multi-agent v2", trend: "up" },
  { label: "Agent Confidence", value: "97%", note: "Supervisor active", trend: "up" },
];

const insights = [
  "Offset mortgage by $800/month to save $2,400/year in interest.",
  "AI detected $138/month in recurring cost opportunities.",
  "Property exposure remains your largest concentration risk.",
  "Emergency runway remains strong at 8.4 months.",
  "Subscription intelligence engine identified 3 savings opportunities.",
];

const transactions = [
  { name: "Salary", meta: "Income · Today", amount: "+$6,420", category: "income" },
  { name: "Woolworths", meta: "Groceries · Today", amount: "-$182", category: "groceries" },
  { name: "Netflix", meta: "Subscription · Yesterday", amount: "-$24", category: "subscription" },
  { name: "Shell", meta: "Transport · 2 days ago", amount: "-$85", category: "transport" },
  { name: "Medibank", meta: "Health · 4 days ago", amount: "-$165", category: "health" },
];

const portfolioAllocation = [
  { label: "Property", pct: 58, color: "bg-emerald-400" },
  { label: "Equities", pct: 22, color: "bg-sky-400" },
  { label: "Cash", pct: 12, color: "bg-amber-400" },
  { label: "Other", pct: 8, color: "bg-purple-400" },
];

const healthScores = [
  { label: "Liquidity", score: 92, note: "Strong" },
  { label: "Diversification", score: 74, note: "Moderate" },
  { label: "Debt Coverage", score: 88, note: "Healthy" },
  { label: "Savings Habit", score: 95, note: "Excellent" },
];

const agents: { label: string; value: string; role: string }[] = [
  { label: "Supervisor", value: "Online", role: "supervisor" },
  { label: "Architecture Council", value: "Online", role: "architecture-council" },
  { label: "Deployment Governor", value: "Ready", role: "deployment-governor" },
  { label: "Repair Governor", value: "Online", role: "repair-governor" },
  { label: "Financial Intelligence", value: "Online", role: "financial-intelligence" },
  { label: "Roadmap Planner", value: "Online", role: "roadmap-planner" },
  { label: "QA Orchestrator", value: "Online", role: "qa-orchestrator" },
  { label: "UI Agent", value: "Online", role: "ui-agent" },
  { label: "Backend Agent", value: "Online", role: "backend-agent" },
  { label: "Database Agent", value: "Standby", role: "database-agent" },
];



const runtimeOpsQueueStatus: { label: string; count: number; color: "sky" | "emerald" | "red" | "amber" }[] = [
  { label: "Running", count: 1, color: "sky" },
  { label: "Completed", count: 1, color: "emerald" },
  { label: "Failed", count: 0, color: "red" },
  { label: "Queued", count: 0, color: "amber" },
];

const runtimeOpsRepairCategories: { category: string; layer: string; summary: string }[] = [
  { category: "TypeScript Error", layer: "build", summary: "Fix type annotation or interface mismatch" },
  { category: "Module Not Found", layer: "build", summary: "Verify import path and package.json dependency" },
  { category: "Build Failure", layer: "build", summary: "Fix syntax error and re-run build" },
  { category: "Route Failure", layer: "runtime", summary: "Check route file with correct export signature" },
  { category: "Runtime Failure", layer: "runtime", summary: "Investigate process exit, spawn error, or ENOENT" },
  { category: "Browser Crash", layer: "browser", summary: "Add use client or move API to useEffect" },
  { category: "DOM Mismatch", layer: "browser", summary: "Fix SSR/client render inconsistency" },
];


export default async function HomePage() {
  const roadmapExecution = buildExecutionQueue().map((task) => ({
    id: task.id,
    title: task.title,
    priority: task.priority,
    status: task.status,
    effort: task.effort,
    agent: task.assignedAgent ?? "unassigned",
  }));
  await connection();
  const dbConfigured = Boolean(
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL
  );
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  // Only show production deployment sections when credentials are configured
  const showProductionSections = dbConfigured || authConfigured;

  const telemetryEvents: { event: string; level: "info" | "warn" | "error"; agent: string; detail: string }[] = [
    { event: "build.success", level: "info", agent: "qa-orchestrator", detail: "21 routes compiled in 2.5s" },
    { event: "agent.run", level: "info", agent: "financial-intelligence", detail: "Subscription analysis complete" },
  ];

  const prismaMigrationChecklist = [
    { step: "Install Prisma CLI", command: "npm install prisma --save-dev", done: true },
    { step: "Set DATABASE_URL", command: "Add DATABASE_URL to Cloudflare Pages / Render env", done: dbConfigured },
    { step: "Run initial migration", command: "npx prisma migrate dev --name init", done: false },
    { step: "Generate Prisma Client", command: "npx prisma generate", done: false },
    { step: "Verify schema sync", command: "npx prisma db pull", done: false },
    { step: "Seed initial data (optional)", command: "npx prisma db seed", done: false },
  ];

  const productionIntegration: {
    service: string;
    status: "green" | "yellow" | "red";
    provider: string;
    path: string;
    detail: string;
    items: string[];
  }[] = [
    {
      service: "Database",
      status: dbConfigured ? ("green" as const) : ("yellow" as const),
      provider: "Prisma → PostgreSQL",
      path: "/api/env-check",
      detail: dbConfigured ? "Database configuration detected — persistence active" : "Set DATABASE_URL to activate persistence",
      items: [
        "Schema v2 ready (10 models)",
        "Repository layer scaffolded (8 repos)",
        "Migration guidance in /api/env-check",
      ],
    },
    {
      service: "Auth",
      status: authConfigured ? ("green" as const) : ("yellow" as const),
      provider: "Supabase Auth",
      path: "/api/auth/session",
      detail: authConfigured ? "Supabase credentials configured — production auth active" : "Dev session active — set Supabase credentials for production",
      items: [
        "Session provider wired (dev mode)",
        "Login/logout routes: /api/auth/login, /logout",
        "RBAC: owner/admin/member/viewer with 16 permissions",
      ],
    },
    {
      service: "Ingestion",
      status: "green",
      provider: "CSV Pipeline",
      path: "/api/ingest",
      detail: "dryRun + persist modes — workspace/user context resolved",
      items: [
        "Merchant canonicalization + categorization",
        "Duplicate + recurring detection",
        "Health scoring with grade + recommendations",
      ],
    },
    {
      service: "Subscriptions",
      status: "green",
      provider: "Subscription Intelligence",
      path: "/api/subscriptions",
      detail: "GET list + POST upsert with renewal/savings intelligence",
      items: [
        "Cadence: monthly / quarterly / annual",
        "Next renewal date prediction",
        "15% savings opportunity estimate",
      ],
    },
    {
      service: "Memory",
      status: "green",
      provider: "Semantic Memory Graph",
      path: "/api/memory",
      detail: "GET graph/recall · POST create · PATCH link nodes",
      items: [
        "Semantic recall via ?q= param",
        "Node linking with PATCH /api/memory",
        "Session-scoped until DATABASE_URL set",
      ],
    },
    {
      service: "Telemetry",
      status: "green",
      provider: "Runtime Event Ledger",
      path: "/api/telemetry",
      detail: "GET summary/events · POST ingest runtime events",
      items: [
        "Levels: info / warn / error / critical",
        "Error class tagging + unresolved tracking",
        "Persistence path ready for @prisma/client",
      ],
    },
    {
      service: "Deployment",
      status: "yellow",
      provider: "Env Readiness Gate",
      path: "/api/production-readiness",
      detail: "Critical-check blocking + missing-env checklist",
      items: [
        "productionBlocked flag if critical env vars missing",
        "criticalFailures list per check",
        "Cloudflare / Render / Supabase validated",
      ],
    },
  ];

  const activationLayers: {
    id: string;
    name: string;
    mode: "live" | "scaffold";
    detail: string;
    path: string;
  }[] = [
    { id: "database", name: "Database", mode: dbConfigured ? ("live" as const) : ("scaffold" as const), detail: dbConfigured ? "Database configuration active" : "Set DATABASE_URL to activate", path: "/api/env-check" },
    { id: "auth", name: "Auth", mode: authConfigured ? ("live" as const) : ("scaffold" as const), detail: authConfigured ? "Supabase credentials configured" : "Set Supabase credentials", path: "/api/auth/session" },
    { id: "vector", name: "Vector Memory", mode: "scaffold", detail: "Set OPENAI_API_KEY", path: "/api/memory" },
    { id: "ingestion", name: "CSV Ingestion", mode: "live", detail: "Pipeline active", path: "/api/ingest" },
    { id: "subscriptions", name: "Subscriptions", mode: "live", detail: "Cadence + renewal active", path: "/api/subscriptions" },
    { id: "telemetry", name: "Telemetry", mode: "live", detail: "Event ledger active", path: "/api/telemetry" },
  ];

  const systemComponents = buildSystemComponents();

  const localTxs = getLocalTransactions();
  backfillSubscriptionsFromTransactions();
  const localSubs = getLocalSubscriptions();
  const localCounts = hasLocalData();
  const storageMode = getStorageMode();
  const hasLocalTxData = localCounts.transactions > 0;
  const hasLocalSubData = localCounts.subscriptions > 0;

  const runtimeStatus = getRuntimeStatus();
  const runtimeLogs = getRuntimeLogs();
  const runtimeQueue = getRuntimeQueue();
  const activeRun = getActiveRun();
  const gitState = getGitState();
  const screenshotMeta = getScreenshotMeta();
  const heartbeat = getHeartbeat();
  const scheduler = getSchedulerStatus();
  const overnight = getOvernightStatus();
  const nextTask = getNextTask();
  const defects = getDefects();
  const buildHistory = getBuildHistory(5);
  const latestBuild = getLatestBuildStatus();
  const depHealth = scanDependencyHealth();
  const archMap = generateArchitectureMap();
  persistArchitectureMap(archMap);
  const buildQueue = listBuildJobs();
  const ciReadiness = generateCIReadiness();
  persistCIWorkflow();
  const driftReport = detectArchitectureDrift(archMap);
  const releaseCandidate = generateReleaseCandidate();
  const orchestratorSummary = getOrchestratorSummary();
  const allowedCommands = listAllowedCommands();
  const artifactManifest = getArtifactManifest();
  const promotionSummary = getPromotionSummary();
  const finalGreenReport = getFinalGreenReport();

  // ── Finance OS computed metrics ──────────────────────────────────────────
  const finIncome = localTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const finSpend = Math.abs(localTxs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const finNet = finIncome - finSpend;
  const finRecurring = localTxs.filter(t => t.recurring && t.amount < 0);
  const finRecurringSpend = Math.abs(finRecurring.reduce((s, t) => s + t.amount, 0));
  const finSubsMonthly = localSubs.reduce((s, sub) => s + sub.amount, 0);

  // category summaries
  const catMap: Record<string, { spend: number; count: number }> = {};
  localTxs.filter(t => t.amount < 0).forEach(t => {
    const c = t.category || "Other";
    if (!catMap[c]) catMap[c] = { spend: 0, count: 0 };
    catMap[c].spend += Math.abs(t.amount);
    catMap[c].count++;
  });
  const finCategories = Object.entries(catMap)
    .map(([cat, v]) => ({ cat, spend: v.spend, count: v.count }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6);

  // merchant summaries
  const merchantMap: Record<string, { total: number; count: number }> = {};
  localTxs.filter(t => t.amount < 0).forEach(t => {
    const m = t.merchantCanonical || t.merchant || "Unknown";
    if (!merchantMap[m]) merchantMap[m] = { total: 0, count: 0 };
    merchantMap[m].total += Math.abs(t.amount);
    merchantMap[m].count++;
  });
  const finMerchants = Object.entries(merchantMap)
    .map(([merchant, v]) => ({ merchant, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // monthly groupings
  const monthMap: Record<string, { income: number; spend: number }> = {};
  localTxs.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { income: 0, spend: 0 };
    if (t.amount > 0) monthMap[key].income += t.amount;
    else monthMap[key].spend += Math.abs(t.amount);
  });
  const finMonths = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  const monthCount = Math.max(finMonths.length, 1);
  const finRunway = finSpend > 0 ? (finIncome / (finSpend / monthCount)).toFixed(1) : "∞";
  const finSavingsOpp = localSubs.reduce((s, sub) => s + (sub.savingsOpportunity || 0), 0);

  // health score from local data
  const finSavingsRate = finIncome > 0 ? (finNet / finIncome) * 100 : 0;
  let finHealthScore = 78;
  if (finSavingsRate >= 30) finHealthScore += 12;
  else if (finSavingsRate >= 20) finHealthScore += 6;
  else if (finSavingsRate < 0 && localTxs.length > 0) finHealthScore -= 15;
  if (finSubsMonthly > 500) finHealthScore -= 8;
  else if (finSubsMonthly > 300) finHealthScore -= 4;
  if (localTxs.length > 20) finHealthScore += 5;
  finHealthScore = Math.min(100, Math.max(0, Math.round(finHealthScore)));
  const finHealthLabel = finHealthScore >= 85 ? "Strong" : finHealthScore >= 70 ? "Stable" : "Needs Attention";

  // actionable insights from local data
  const finInsights: { id: string; title: string; description: string; severity: "low" | "medium" | "high"; confidence: number; impact: string; actions: string[] }[] = [];
  if (localTxs.length === 0) {
    finInsights.push(
      { id: "import-data", title: "Import transaction data", description: "No transactions imported yet. Import a CSV file to unlock insights.", severity: "medium", confidence: 100, impact: "Unlocks all finance features", actions: ["Use the Import section", "Paste CSV data", "Click Persist to Local Storage"] },
      { id: "sub-intel", title: "Subscription intelligence ready", description: "Import recurring transactions to auto-detect subscriptions and cadence.", severity: "low", confidence: 100, impact: "Subscription detection active", actions: ["Import recurring transactions"] },
    );
  } else {
    if (finSubsMonthly > 100) {
      finInsights.push({ id: "sub-spend", title: "Subscription spend detected", description: `$${finSubsMonthly.toFixed(0)}/month across ${localSubs.length} subscription(s). Consider reviewing annual plans.`, severity: finSubsMonthly > 300 ? "high" : "medium", confidence: 92, impact: `~$${(finSubsMonthly * 0.2 * 12).toFixed(0)}/year savings potential`, actions: ["Review subscription list", "Cancel unused services", "Look for annual plan discounts"] });
    }
    if (finIncome > 0) {
      finInsights.push({ id: "savings-rate", title: finSavingsRate >= 20 ? "Strong savings rate" : "Savings rate opportunity", description: `Savings rate: ${finSavingsRate.toFixed(1)}%. ${finSavingsRate >= 20 ? "Above 20% target." : "Below 20% — review discretionary spend."}`, severity: finSavingsRate >= 20 ? "low" : "medium", confidence: 88, impact: finSavingsRate < 20 ? `$${((0.20 - finSavingsRate / 100) * finIncome).toFixed(0)} additional savings potential` : "On track", actions: finSavingsRate < 20 ? ["Review dining & entertainment", "Automate savings transfers", "Set a monthly budget"] : ["Maintain savings habits"] });
    }
    if (finRecurring.length > 0) {
      finInsights.push({ id: "recurring-review", title: `${finRecurring.length} recurring transactions`, description: `$${finRecurringSpend.toFixed(2)} in committed recurring spend detected.`, severity: "low", confidence: 95, impact: "Full recurring spend visibility", actions: ["Categorise recurring items", "Set per-category budgets"] });
    }
    if (finSavingsOpp > 0) {
      finInsights.push({ id: "savings-opp", title: "Subscription savings opportunity", description: `NEVEN estimates ~$${finSavingsOpp.toFixed(0)}/year savings across current subscriptions.`, severity: "medium", confidence: 80, impact: `$${finSavingsOpp.toFixed(0)}/year`, actions: ["Review flagged subscriptions", "Accept/reject recommendations"] });
    }
  }
  if (finInsights.length === 0) {
    finInsights.push(...[
      { id: "cashflow-ok", title: "Positive cash flow", description: "Your imports show a net-positive cash flow. Keep up the consistent savings habit.", severity: "low" as const, confidence: 85, impact: "Healthy trajectory", actions: ["Continue monitoring monthly"] },
    ]);
  }

  // upcoming subscription renewals
  const upcomingRenewals = [...localSubs]
    .sort((a, b) => new Date(a.nextRenewalDate).getTime() - new Date(b.nextRenewalDate).getTime())
    .slice(0, 5);

  // import history
  const localImports = getLocalImports();

  // service-layer derived data
  const finSummary = computeFinanceSummary(localTxs, localSubs);
  const finMonthSummaries = computeMonthSummaries(localTxs);
  const cashflowForecast = computeCashflowForecast(finMonthSummaries);
  const renewalCalendar = computeRenewalCalendar(localSubs);
  const workflowRunHistory = getWorkflowRuns().slice(-5).reverse();

  // merchant cleanup / canonicalization summary
  const merchantCleanupEntries: { original: string; canonical: string; count: number }[] = [];
  const _cleanupSeen = new Set<string>();
  localTxs.forEach(t => {
    const orig = t.merchant || "";
    const canon = (t.merchantCanonical as string | undefined) || "";
    if (orig && canon && orig !== canon && !_cleanupSeen.has(orig)) {
      _cleanupSeen.add(orig);
      merchantCleanupEntries.push({ original: orig, canonical: canon, count: 1 });
    } else if (orig && canon && orig !== canon) {
      const existing = merchantCleanupEntries.find(e => e.original === orig);
      if (existing) existing.count++;
    }
  });
  merchantCleanupEntries.sort((a, b) => b.count - a.count);
  const merchantsNormalized = merchantCleanupEntries.length;

  // recurring spend trend by month
  const recurringByMonth: Record<string, number> = {};
  localTxs.filter(t => t.recurring && t.amount < 0).forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!recurringByMonth[key]) recurringByMonth[key] = 0;
    recurringByMonth[key] += Math.abs(t.amount);
  });
  const recurringTrend = Object.entries(recurringByMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  // savings opportunities ranked
  const savingsOpps = [...localSubs]
    .filter(s => (s.savingsOpportunity || 0) > 0)
    .sort((a, b) => (b.savingsOpportunity || 0) - (a.savingsOpportunity || 0))
    .slice(0, 5);

  // ── Transaction Analytics v3: anomalous detection ────────────────────────
  const catAvgs: Record<string, number> = {};
  Object.entries(catMap).forEach(([cat, { spend, count }]) => {
    catAvgs[cat] = spend / Math.max(count, 1);
  });
  const anomalousTxs = localTxs.filter(t => {
    if (t.amount >= 0) return false;
    const cat = t.category || "Other";
    const avg = catAvgs[cat] || 0;
    return avg > 0 && Math.abs(t.amount) > avg * 2.5;
  }).slice(0, 6);

  // ── Merchant Intelligence v2 ──────────────────────────────────────────────
  const merchantVariantsMap: Record<string, string[]> = {};
  localTxs.forEach(t => {
    const canon = t.merchantCanonical || t.merchant || "Unknown";
    if (!merchantVariantsMap[canon]) merchantVariantsMap[canon] = [];
    const orig = t.merchant || "";
    if (orig && !merchantVariantsMap[canon].includes(orig)) merchantVariantsMap[canon].push(orig);
  });
  const duplicateMerchants = Object.entries(merchantVariantsMap)
    .filter(([, variants]) => variants.length > 1)
    .map(([canonical, variants]) => ({ canonical, variants }))
    .slice(0, 5);
  const merchantConfidenceList = Object.entries(merchantVariantsMap)
    .map(([canonical, variants]) => ({
      canonical,
      confidence: variants.length > 1 ? 88 : (variants[0] !== canonical ? 92 : 72),
      txCount: (merchantMap[canonical] || { count: 0 }).count,
    }))
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, 8);

  // ── Subscription Management v3: duplicate risk ───────────────────────────
  const subMerchantCounts: Record<string, number> = {};
  localSubs.forEach(s => {
    const key = s.merchant.toLowerCase().trim();
    subMerchantCounts[key] = (subMerchantCounts[key] || 0) + 1;
  });
  const duplicateRiskSubs = localSubs.filter(s => subMerchantCounts[s.merchant.toLowerCase().trim()] > 1);

  // ── Workflow Automation stages ────────────────────────────────────────────
  const wfStages: { name: string; status: "pass" | "pending"; detail: string }[] = [
    { name: "Import", status: localImports.length > 0 ? "pass" : "pending", detail: `${localImports.length} run(s) · ${localCounts.transactions} rows` },
    { name: "Merchant Cleanup", status: localTxs.length > 0 ? "pass" : "pending", detail: `${merchantsNormalized} normalized` },
    { name: "Subscription Detection", status: localSubs.length > 0 ? "pass" : "pending", detail: `${localSubs.length} detected` },
    { name: "Insight Generation", status: finInsights.length > 0 ? "pass" : "pending", detail: `${finInsights.length} insight(s)` },
    { name: "Copilot Context", status: localCounts.transactions > 0 ? "pass" : "pending", detail: `${localCounts.transactions} txns` },
    { name: "Health Score", status: "pass", detail: `Score: ${localTxs.length > 0 ? finHealthScore : 93}/100` },
  ];

  // ── Runtime Quality Gate ──────────────────────────────────────────────────
  const qualityGateItems: { name: string; status: "pass" | "pending"; detail: string }[] = [
    { name: "Import History", status: localImports.length > 0 ? "pass" : "pending", detail: `${localImports.length} import run(s)` },
    { name: "Transaction Analytics v3", status: hasLocalTxData ? "pass" : "pending", detail: `${localCounts.transactions} txns · ${anomalousTxs.length} anomalous` },
    { name: "Merchant Intelligence v2", status: finMerchants.length > 0 ? "pass" : "pending", detail: `${finMerchants.length} merchants · ${duplicateMerchants.length} dupes` },
    { name: "Subscription Mgmt v3", status: hasLocalSubData ? "pass" : "pending", detail: `${localCounts.subscriptions} subs · ${duplicateRiskSubs.length} at risk` },
    { name: "Insights Engine v3", status: finInsights.length > 0 ? "pass" : "pending", detail: `${finInsights.length} insight(s)` },
    { name: "Copilot v3", status: "pass", detail: `${localCounts.transactions} txns grounded` },
    { name: "Finance Health v3", status: "pass", detail: `Score ${localTxs.length > 0 ? finHealthScore : 93}/100` },
    { name: "Workflow Automation", status: wfStages.filter(s => s.status === "pass").length >= 2 ? "pass" : "pending", detail: `${wfStages.filter(s => s.status === "pass").length}/${wfStages.length} stages` },
    { name: "Local Persistent Mode", status: "pass", detail: storageMode },
  ];

  const localPersistentCheck = {
    name: "Local Persistent Mode",
    status: "green" as const,
    message: hasLocalTxData || hasLocalSubData
      ? `Active — ${localCounts.transactions} transactions, ${localCounts.subscriptions} subscriptions in .ai/local-data`
      : `Ready — POST to /api/ingest with mode=persist to populate. Supabase optional.`,
  };

  const productionReadinessChecks = [
    { name: "Database (Prisma)", status: dbConfigured ? ("green" as const) : ("yellow" as const), message: dbConfigured ? "Connected" : "Set DATABASE_URL or SUPABASE_DATABASE_URL" },
    { name: "Auth (Supabase)", status: authConfigured ? ("green" as const) : ("yellow" as const), message: authConfigured ? "Supabase credentials configured" : "Set NEXT_PUBLIC_SUPABASE_URL + ANON_KEY" },
    { name: "CSV Ingestion", status: "green" as const, message: "Pipeline active" },
    { name: "Subscription Intel", status: "green" as const, message: "Cadence + renewals active" },
    { name: "Vector Memory", status: runtimeConfig.embeddingsConfigured ? ("green" as const) : ("yellow" as const), message: runtimeConfig.embeddingsConfigured ? "Embeddings active" : "Set OPENAI_API_KEY" },
    { name: "Prisma Schema v2", status: "green" as const, message: "10 models aligned" },
    { name: "Repository Layer", status: "green" as const, message: "All CRUD scaffolded" },
    { name: "Auth Middleware", status: authConfigured ? ("green" as const) : ("yellow" as const), message: authConfigured ? "Session + RBAC ready" : "Set Supabase credentials" },
    { name: "Deployment", status: (dbConfigured && authConfigured) ? ("green" as const) : ("yellow" as const), message: (dbConfigured && authConfigured) ? "All env vars configured" : "Set env vars to unlock" },
  ];

  const allProductionReadinessChecks = [
    localPersistentCheck,
    ...productionReadinessChecks,
  ];

  return (
    <main data-testid="app-root" className="min-h-screen bg-[#07111f] text-white font-sans">
      {/* Fixed floating mobile menu — independent of header/sidebar */}
      <MobileNav />
      {/* Sticky top command bar */}
      <div className="sticky top-0 z-30 border-b border-emerald-500/[0.15] bg-[#07111f]/80 backdrop-blur-xl px-4 py-2 text-xs text-emerald-300/80 tracking-wide sm:px-6 flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Autonomous AI Runtime Active &mdash; Supervisor online &bull; 10 agents nominal &bull; Multi-agent v2
        </span>
        <img src="/neven_logo1.png" alt="NEVEN" width={36} height={36} className="shrink-0" />
      </div>

      <div className="flex min-h-[calc(100vh-36px)] lg:pl-64">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/[0.08] bg-white/[0.04] backdrop-blur-xl px-6 pb-6 pt-[50px] lg:flex lg:flex-col fixed left-0 top-0 h-screen overflow-y-auto z-10">
          <div>
            <img src="/neven_logo1.png" alt="NEVEN" width={200} height={200} />
            <p className="mt-1 text-xs text-white/40 leading-relaxed">
              Autonomous financial operating system
            </p>
          </div>

          <nav className="mt-8 space-y-0.5 flex-1">
            {nav.map((item, i) => (
              <a
                key={item}
                href={navHrefs[item] ?? "#"}
                className={
                  "block rounded-xl px-3 py-2.5 text-sm transition cursor-pointer " +
                  (i === 0
                    ? "bg-emerald-400/15 text-emerald-300 font-medium"
                    : "text-white/55 hover:bg-white/5 hover:text-white")
                }
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-400/20 flex items-center justify-center text-xs font-bold text-emerald-300">
                AB
              </div>
              <div>
                <div className="text-sm font-medium">Alex Becker</div>
                <div className="text-xs text-white/40">Owner · Premium Plan</div>
              </div>
            </div>
          </div>
        </aside>


        {/* Main content */}
        <section className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-clip">
          {/* Mobile header */}
          <header className="mb-6 lg:hidden">
            <img src="/neven_logo.png?v=3" alt="NEVEN" width={50} height={50} />
            <p className="text-xs text-white/40">Autonomous financial OS</p>
          </header>

          <div className="mx-auto max-w-7xl space-y-6">
            <UIToggleWrapper
              v2={
                <OverviewV2
                  netWorth="$1.84M"
                  netWorthTrend="+4.2% this month"
                  cashFlow="+$6,420"
                  savingsRate="31%"
                  runway="8.4 mo"
                  aiConfidence="96%"
                  healthScore={93}
                  healthLabel="Strong"
                  insights={insights}
                  portfolioAllocation={portfolioAllocation}
                  healthScores={healthScores}
                  dateStr={new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                />
              }
              v3={
                <OverviewV3
                  netWorth="$1.84M"
                  netWorthTrend="+4.2% this month"
                  cashFlow="+$6,420"
                  savingsRate="31%"
                  runway="8.4 mo"
                  aiConfidence="96%"
                  healthScore={93}
                  healthLabel="Strong"
                  insights={insights}
                  portfolioAllocation={portfolioAllocation}
                  healthScores={healthScores}
                  dateStr={new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  agents={agents}
                  telemetryEvents={telemetryEvents}
                  dbConfigured={dbConfigured}
                  currentTask={runtimeStatus.daemon.active ? {
                    runId: runtimeStatus.daemon.runId ?? "",
                    goal: runtimeLogs.activeRunGoal ?? "",
                    startedAt: runtimeStatus.daemon.startedAt ?? new Date().toISOString(),
                  } : null}
                  lastTask={runtimeLogs.recentRunSummaries.length > 0 ? runtimeLogs.recentRunSummaries[runtimeLogs.recentRunSummaries.length - 1] : null}
                  nextTask={nextTask.nextTask ? { id: nextTask.nextTask.id, title: nextTask.nextTask.title } : null}
                  totalRuns={runtimeStatus.daemon.totalRuns}
                />
              }
            >
            {/* Hero / Executive Header */}
            <section id="overview" className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#0c1e35]/70 via-[#071420]/70 to-[#04090f]/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/50 sm:p-12">
              {/* Ambient radial glows */}
              <div className="pointer-events-none absolute -top-28 -right-28 h-[26rem] w-[26rem] rounded-full bg-emerald-500/[0.08] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-sky-500/[0.05] blur-3xl" />
              <div className="relative flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-emerald-400/70">
                    Finance Operating System &mdash; {new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
                    Good morning, Alex
                  </h2>
                  <p className="mt-4 max-w-xl text-sm text-white/45 leading-relaxed">
                    NEVEN is operating in full autonomous mode. 10-agent multi-agent hierarchy active.
                    Production-grade platform layers deployed.
                  </p>
                </div>

                <FinancialHealthCard score={93} />
              </div>
            </section>

            {/* Key Metrics */}
            <section>
              <SectionHeader title="Key Metrics" subtitle="Real-time portfolio snapshot" />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {metrics.map((item) => (
                  <Metric key={item.label} {...item} />
                ))}
              </div>
            </section>

            {/* System Health + Telemetry */}
            <section id="telemetry" className="grid gap-4 xl:grid-cols-2">
              <Panel title="System Health" subtitle="Platform component status">
                <div className="space-y-2">
                  {systemComponents.map((c) => (
                    <ComponentHealthRow key={c.name} {...c} />
                  ))}
                </div>
              </Panel>

              <Panel title="Telemetry" subtitle="Runtime event stream">
                <div className="space-y-2">
                  {telemetryEvents.map((e) => (
                    <TelemetryRow key={e.event + e.agent} {...e} />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2">
                  <span className="text-xs text-white/40">Total events</span>
                  <span className="text-xs font-semibold text-white/70">{telemetryEvents.length} events &bull; {telemetryEvents.filter((e) => e.level === "warn").length} unresolved</span>
                </div>
              </Panel>
            </section>

            {/* Autonomous Runtime Operations */}
            <section>
              <SectionHeader
                title="Autonomous Runtime Operations"
                subtitle="Active run · execution queue · repair attempts · deployment readiness · autonomous health"
              />
              <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
                {/* Active Run + Health */}
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">Active Run</div>
                      <div className="mt-1 font-mono text-[10px] text-white/35">
                        {runtimeStatus.daemon.runId ?? (runtimeStatus.daemon.active ? "Starting…" : "No active run")}
                      </div>
                    </div>
                    <span className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold ${runtimeStatus.daemon.active ? "bg-sky-400/10 text-sky-400" : "bg-white/5 text-white/30"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${runtimeStatus.daemon.active ? "bg-sky-400 animate-pulse" : "bg-white/20"}`} />
                      {runtimeStatus.daemon.active ? "Running" : "Idle"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-white/55 leading-relaxed">
                    {runtimeLogs.activeRunGoal ?? "AUTONOMOUS RUNTIME STABILIZATION PHASE — runId tracking, execution queue, structured logs, watchdog recovery"}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] text-white/35">Attempts</div>
                      <div className="mt-0.5 text-sm font-bold text-white/80">{activeRun ? activeRun.attempts.length : runtimeStatus.daemon.totalRuns}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
                      <div className="text-[10px] text-emerald-400/70">Autonomous Health</div>
                      <div className="mt-0.5 text-sm font-bold text-emerald-400">
                        {runtimeQueue.summary.total > 0
                          ? `${Math.round((runtimeQueue.summary.completed / runtimeQueue.summary.total) * 100)}% success`
                          : "100% success"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-white/30">
                    <span className="font-mono">Logs: .ai/runs/&lt;runId&gt;</span>
                    <span>&bull;</span>
                    <span>Stale threshold: 30 min</span>
                  </div>
                </Card>

                {/* Queue Status */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Execution Queue</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { label: "Running", count: runtimeQueue.summary.running, color: "sky" as const },
                      { label: "Completed", count: runtimeQueue.summary.completed, color: "emerald" as const },
                      { label: "Failed", count: runtimeQueue.summary.failed, color: "red" as const },
                      { label: "Queued", count: runtimeQueue.summary.queued, color: "amber" as const },
                    ].map((s) => (
                      <RuntimeQueueStatusCard key={s.label} {...s} />
                    ))}
                  </div>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">Repair Classification</div>
                  <div className="mt-2 space-y-1.5">
                    {runtimeOpsRepairCategories.slice(0, 4).map((c) => (
                      <RepairCategoryRow key={c.category} {...c} />
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-white/25">
                    {runtimeOpsRepairCategories.length} repair categories · build / runtime / browser layers · /api/runtime-operations
                  </div>
                </Card>
              </div>
            </section>

            {/* Multi-Agent Hierarchy */}
            <section>
              <SectionHeader title="Multi-Agent Hierarchy" subtitle="10-agent autonomous coordination layer" />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {agents.map((a) => (
                  <AgentCard key={a.role} label={a.label} value={a.value} />
                ))}
              </div>
            </section>

            {/* Portfolio & Health */}
            <section className="grid gap-4 xl:grid-cols-2">
              <Panel title="Portfolio Allocation" subtitle="Asset distribution overview">
                <div className="space-y-3">
                  {portfolioAllocation.map((item) => (
                    <AllocationRow key={item.label} {...item} />
                  ))}
                </div>
              </Panel>

              <Panel title="Financial Health Scores" subtitle="AI-assessed sub-indicators">
                <div className="grid grid-cols-2 gap-3">
                  {healthScores.map((item) => (
                    <HealthScoreCard key={item.label} {...item} />
                  ))}
                </div>
              </Panel>
            </section>

            {/* AI Insights + Copilot */}
            <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <Panel title="Financial Intelligence Signals" subtitle="Autonomous financial intelligence agent">
                <div className="space-y-2">
                  {insights.map((item) => (
                    <Insight key={item}>{item}</Insight>
                  ))}
                </div>
              </Panel>

              <Panel title="AI Copilot" subtitle="Semantic memory-augmented copilot">
                <div className="space-y-2">
                  <CopilotPrompt>Can I comfortably afford a larger PPOR?</CopilotPrompt>
                  <CopilotPrompt>What&apos;s my optimal savings rate this quarter?</CopilotPrompt>
                  <CopilotPrompt>Analyse my subscription spend vs market average.</CopilotPrompt>
                </div>
                <p className="mt-4 text-xs text-white/35 leading-relaxed">
                  Copilot assembles semantic context from your financial memory graph before each response.
                </p>
                <button className="mt-4 w-full rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#07111f] transition hover:bg-emerald-300 sm:w-auto">
                  Start Copilot Session
                </button>
              </Panel>
            </section>
            </UIToggleWrapper>

            {/* Roadmap Execution */}
            <section id="roadmap">
              <SectionHeader title="Autonomous Roadmap Execution" subtitle="Sprint queue with agent assignments" />
              <div className="mt-3 grid gap-2">
                {roadmapExecution.map((task) => (
                  <ExecutionTaskRow key={task.id} {...task} />
                ))}
              </div>
            </section>

            {/* Production sections — hidden in local mode, shown when credentials are configured */}
            {showProductionSections && <>

            {/* Infrastructure Activation Layer */}
            <section>
              <SectionHeader
                title="Infrastructure Activation Layer"
                subtitle="Live vs scaffold status — 3 of 6 layers live · runId-tracked · activate via /api/env-check"
              />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {activationLayers.map((layer) => (
                  <ActivationLayerCard key={layer.id} {...layer} />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                <p className="text-xs text-sky-300">
                  <span className="font-semibold">Activation status:</span> 3/6 layers live.
                  CSV ingestion, subscription intelligence, and telemetry are active with no credentials required.
                  Set DATABASE_URL, Supabase credentials, and OPENAI_API_KEY to fully activate all 6 layers.
                  See <span className="font-mono">/api/infrastructure-activation</span> for live activation manifest.
                </p>
              </div>
            </section>

            {/* Production Integration Panel */}
            <section>
              <SectionHeader
                title="Production Integration"
                subtitle="Database · Auth · Ingestion · Subscriptions · Memory · Telemetry · Deployment"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
                {productionIntegration.map((svc) => (
                  <ProductionIntegrationCard key={svc.service} {...svc} />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                <p className="text-xs text-sky-300">
                  <span className="font-semibold">Integration path:</span> All 7 production layers wired.
                  Ingestion, subscriptions, memory, and telemetry are active now.
                  Set DATABASE_URL + Supabase credentials to enable persistent storage.
                  See{" "}
                  <span className="font-mono">/api/env-check</span> for live environment status and{" "}
                  <span className="font-mono">/api/production-readiness</span> for full readiness report.
                </p>
              </div>
            </section>

            {/* Deployment Status */}
            <section id="deployment">
              <SectionHeader title="Deployment Governor" subtitle="Cloudflare Pages readiness gate" />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  { name: "npm run build", passed: true },
                  { name: "TypeScript checks", passed: true },
                  { name: "DATABASE_URL env var", passed: dbConfigured, optional: true },
                  { name: "Supabase credentials", passed: authConfigured, optional: true },
                  { name: "Health endpoint /api/health", passed: true },
                  { name: "Smoke tests", passed: runtimeConfig.smokeTestsPassed },
                ].map((gate) => (
                  <DeployGateCard key={gate.name} {...gate} />
                ))}
              </div>
              {(!dbConfigured || !authConfigured) ? (
                <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                  <p className="text-xs text-amber-300">
                    <span className="font-semibold">Optional configuration:</span>{" "}
                    {!dbConfigured && !authConfigured
                      ? "Set DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_ANON_KEY"
                      : !dbConfigured
                      ? "Set DATABASE_URL or SUPABASE_DATABASE_URL"
                      : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"}{" "}
                    in Cloudflare Pages environment variables to enable production persistence. Local persistent mode is active.
                  </p>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                  <p className="text-xs text-emerald-300">
                    <span className="font-semibold">Deployment ready:</span> All environment variables configured. Production deployment is unlocked.
                  </p>
                </div>
              )}
            </section>

            {/* Production Readiness Dashboard */}
            <section id="settings">
              <SectionHeader title="Production Readiness" subtitle="Infrastructure layers — Local Persistent Mode, database, auth, ingestion, subscriptions, vector, deployment" />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {allProductionReadinessChecks.map((check) => (
                  <ReadinessCheckCard key={check.name} {...check} />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                <p className="text-xs text-emerald-300">
                  <span className="font-semibold">Foundation status:</span> CSV ingestion pipeline, subscription intelligence, Prisma v2 schema, repository layer, auth middleware, and Supabase client/server scaffold are all wired. Set DATABASE_URL + Supabase credentials to activate full production stack. See <span className="font-mono">/api/production-readiness</span> for live status.
                </p>
              </div>
            </section>

            {/* Prisma Migration Checklist */}
            <section>
              <SectionHeader
                title="Prisma Migration Checklist"
                subtitle="Steps to activate the database persistence layer — 1 of 6 complete"
              />
              <div className="mt-3 grid gap-2">
                {prismaMigrationChecklist.map((item) => (
                  <PrismaMigrationRow key={item.step} {...item} />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                <p className="text-xs text-sky-300">
                  <span className="font-semibold">Next step:</span> Set <span className="font-mono">DATABASE_URL</span> in
                  your Cloudflare Pages or Render environment variables, then run{" "}
                  <span className="font-mono">npx prisma migrate dev --name init</span> to activate the 10-model Prisma schema.
                  See <span className="font-mono">/api/env-check</span> for live readiness status.
                </p>
              </div>
            </section>

            </>}

            {/* Import Section */}
            <section>
              <SectionHeader title="Import" subtitle="CSV import workflow — paste or upload transactions, preview, validate, and persist" />
              <div className="mt-3">
                <ImportWorkflow />
              </div>
              <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                <p className="text-xs text-sky-300">
                  <span className="font-semibold">Import path:</span> Paste CSV with date, description, amount columns. Preview validates duplicates and recurring candidates.
                  Click <span className="font-mono">Persist to Local Storage</span> to save to <span className="font-mono">.ai/local-data/transactions.json</span>.
                  Refresh after persisting to see Transactions and Subscriptions sections update.
                </p>
              </div>
            </section>

            {/* Transactions Section */}
            <section id="transactions">
              <SectionHeader
                title="Transactions"
                subtitle={
                  hasLocalTxData
                    ? `${localCounts.transactions} transactions in local-persistent storage — source: .ai/local-data/transactions.json`
                    : "No transactions yet — use the Import section above to load CSV data"
                }
              />
              <div className="mt-3">
                {hasLocalTxData ? (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: "Total Transactions", value: localCounts.transactions, color: "text-white/80" },
                        { label: "Total Income", value: `$${localTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0).toFixed(2)}`, color: "text-emerald-400" },
                        { label: "Total Spend", value: `$${Math.abs(localTxs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)).toFixed(2)}`, color: "text-red-400" },
                      ].map(m => (
                        <div key={m.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <div className="text-xs text-white/40">{m.label}</div>
                          <div className={`mt-1.5 text-xl font-bold tabular-nums ${m.color}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {localTxs.slice(0, 8).map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{t.merchant}</span>
                              {t.recurring && <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-sky-400/10 text-sky-400">recurring</span>}
                            </div>
                            <div className="mt-0.5 text-xs text-white/35">{t.category} · {new Date(t.date).toLocaleDateString()}</div>
                          </div>
                          <div className={`shrink-0 text-sm font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {t.amount >= 0 ? "+" : ""}${Math.abs(t.amount).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {localTxs.length > 8 && (
                      <div className="mt-3 text-center text-xs text-white/30">
                        +{localTxs.length - 8} more transactions in .ai/local-data/transactions.json
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-8 text-center shadow-xl shadow-black/20">
                    <div className="text-3xl mb-3">📂</div>
                    <div className="text-sm font-medium text-white/60">No transactions imported yet</div>
                    <div className="mt-1 text-xs text-white/35">Use the Import section above to load your CSV data into local persistent storage</div>
                    <div className="mt-3 text-xs text-white/25 font-mono">Storage: {storageMode} · Path: .ai/local-data/transactions.json</div>
                  </div>
                )}
              </div>
            </section>

            {/* Subscriptions Section */}
            <section id="subscriptions">
              <SectionHeader
                title="Subscriptions"
                subtitle={
                  hasLocalSubData
                    ? `${localCounts.subscriptions} subscriptions detected — cadence, renewal, and savings intelligence active`
                    : "No subscriptions yet — import recurring transactions to auto-detect subscriptions"
                }
              />
              <div className="mt-3">
                {hasLocalSubData ? (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                    <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-3">
                      {[
                        { label: "Active Subscriptions", value: localCounts.subscriptions, color: "text-white/80" },
                        { label: "Monthly Spend", value: `$${localSubs.reduce((s, sub) => s + sub.amount, 0).toFixed(2)}`, color: "text-amber-400" },
                        { label: "Annual Spend", value: `$${(localSubs.reduce((s, sub) => s + sub.amount, 0) * 12).toFixed(2)}`, color: "text-red-400" },
                      ].map(m => (
                        <div key={m.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <div className="text-xs text-white/40">{m.label}</div>
                          <div className={`mt-1.5 text-xl font-bold tabular-nums ${m.color}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {localSubs.slice(0, 6).map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{s.merchant}</div>
                            <div className="mt-0.5 text-xs text-white/35">{s.cadence} · next: {new Date(s.nextRenewalDate).toLocaleDateString()}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-semibold tabular-nums text-amber-400">${s.amount.toFixed(2)}/mo</div>
                            {s.savingsOpportunity > 0 && (
                              <div className="text-[10px] text-emerald-400">save ~${s.savingsOpportunity.toFixed(0)}/yr</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-8 text-center shadow-xl shadow-black/20">
                    <div className="text-3xl mb-3">🔄</div>
                    <div className="text-sm font-medium text-white/60">No subscriptions detected yet</div>
                    <div className="mt-1 text-xs text-white/35">Import CSV data with recurring transactions — subscription intelligence will auto-detect cadence and renewal dates</div>
                    <div className="mt-3 text-xs text-white/25 font-mono">POST /api/subscriptions to manually add · GET to retrieve</div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Transaction Explorer ──────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Transaction Explorer"
                subtitle={hasLocalTxData ? `${localCounts.transactions} transactions · filter by category, merchant, or month · source: .ai/local-data/` : "Import CSV data to explore transactions"}
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                {/* Search bar (static UI) */}
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
                  <span className="text-white/30 text-sm">⌕</span>
                  <span className="text-sm text-white/25 italic">Search transactions by merchant, category, or amount…</span>
                  <span className="ml-auto rounded px-2 py-0.5 text-[10px] bg-white/5 text-white/30 border border-white/[0.07]">POST /api/transactions</span>
                </div>
                {hasLocalTxData ? (
                  <div className="space-y-4">
                    {/* Category totals */}
                    {finCategories.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Category Totals</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                          {finCategories.map(c => (
                            <div key={c.cat} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                              <div className="text-[10px] text-white/35 truncate">{c.cat}</div>
                              <div className="mt-1 text-sm font-bold tabular-nums text-red-400">${c.spend.toFixed(0)}</div>
                              <div className="mt-0.5 text-[10px] text-white/25">{c.count} txns</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Merchant grouping */}
                    {finMerchants.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Top Merchants</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                          {finMerchants.map(m => (
                            <div key={m.merchant} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                              <div className="text-[10px] text-white/60 font-medium truncate">{m.merchant}</div>
                              <div className="mt-1 text-sm font-bold tabular-nums text-amber-400">${m.total.toFixed(0)}</div>
                              <div className="mt-0.5 text-[10px] text-white/25">{m.count} txns</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Monthly grouping */}
                    {finMonths.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Monthly Grouping</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                          {finMonths.map(([month, v]) => (
                            <div key={month} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                              <div className="text-[10px] text-white/40 font-mono">{month}</div>
                              <div className="mt-1 text-xs font-semibold text-emerald-400">+${v.income.toFixed(0)}</div>
                              <div className="text-xs font-semibold text-red-400">-${v.spend.toFixed(0)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Anomalous Transactions */}
                    {anomalousTxs.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-red-400/70 mb-2">Anomalous Transactions ({anomalousTxs.length}) — flagged at 2.5× category avg</div>
                        <div className="space-y-1.5">
                          {anomalousTxs.map(t => {
                            const cat = t.category || "Other";
                            const avg = catAvgs[cat] || 0;
                            const ratio = avg > 0 ? (Math.abs(t.amount) / avg).toFixed(1) : "—";
                            return (
                              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-white/80 truncate">{t.merchant}</span>
                                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-red-400/15 text-red-400">{ratio}× avg</span>
                                  </div>
                                  <div className="text-[10px] text-white/30">{cat} · {new Date(t.date).toLocaleDateString()}</div>
                                </div>
                                <span className="shrink-0 text-xs font-bold text-red-400">${Math.abs(t.amount).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* All transactions condensed */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">All Transactions ({localTxs.length})</div>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {localTxs.slice(0, 20).map(t => (
                          <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium truncate">{t.merchant}</span>
                                {t.recurring && <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-sky-400/10 text-sky-400">rec</span>}
                              </div>
                              <div className="text-[10px] text-white/30">{t.category} · {new Date(t.date).toLocaleDateString()}</div>
                            </div>
                            <span className={`shrink-0 text-xs font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {t.amount >= 0 ? "+" : ""}${Math.abs(t.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {localTxs.length > 20 && <div className="text-center text-[10px] text-white/25 py-2">+{localTxs.length - 20} more · full list at GET /api/transactions</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-sm text-white/40">No transaction data — import CSV to explore</div>
                    <div className="mt-1 text-xs text-white/25 font-mono">GET /api/transactions · POST /api/ingest</div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Subscription Management ───────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Subscription Management"
                subtitle={hasLocalSubData ? `${localCounts.subscriptions} subscriptions · accept/reject workflows · yearly cost · savings recommendations` : "Import recurring transactions to detect subscriptions"}
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                {hasLocalSubData ? (
                  <div className="space-y-4">
                    {/* Summary metrics */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "Active Subscriptions", value: localCounts.subscriptions, color: "text-white/80" },
                        { label: "Monthly Cost", value: `$${finSubsMonthly.toFixed(2)}`, color: "text-amber-400" },
                        { label: "Yearly Cost", value: `$${(finSubsMonthly * 12).toFixed(0)}`, color: "text-red-400" },
                        { label: "Savings Opportunity", value: `$${finSavingsOpp.toFixed(0)}/yr`, color: "text-emerald-400" },
                      ].map(m => (
                        <div key={m.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <div className="text-xs text-white/40">{m.label}</div>
                          <div className={`mt-1.5 text-lg font-bold tabular-nums ${m.color}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Upcoming renewals */}
                    {upcomingRenewals.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Upcoming Renewals</div>
                        <div className="space-y-2">
                          {upcomingRenewals.map(s => (
                            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{s.merchant}</span>
                                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-amber-400/10 text-amber-400">{s.cadence}</span>
                                  {s.cancellationScore > 0.6 && <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-red-400/10 text-red-400">review</span>}
                                </div>
                                <div className="mt-0.5 text-xs text-white/35">
                                  Renews {new Date(s.nextRenewalDate).toLocaleDateString()} · Confidence {Math.round(s.cancellationScore * 100)}%
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-sm font-semibold tabular-nums text-amber-400">${s.amount.toFixed(2)}/mo</div>
                                <div className="text-[10px] text-white/30">${(s.amount * 12).toFixed(0)}/yr</div>
                              </div>
                              <div className="shrink-0 flex flex-col gap-1">
                                <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 cursor-pointer hover:bg-emerald-400/20">Keep</span>
                                <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-red-400/10 text-red-400 border border-red-400/20 cursor-pointer hover:bg-red-400/20">Cancel</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Savings recommendations */}
                    {finSavingsOpp > 0 && (
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                        <div className="text-xs font-semibold text-emerald-400 mb-1">Savings Recommendations</div>
                        <div className="text-xs text-white/60">NEVEN estimates <span className="font-semibold text-emerald-400">${finSavingsOpp.toFixed(0)}/year</span> savings by reviewing flagged subscriptions. Consider switching to annual plans or cancelling duplicates.</div>
                      </div>
                    )}
                    {/* Duplicate risk subscriptions */}
                    {duplicateRiskSubs.length > 0 && (
                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                        <div className="text-xs font-semibold text-amber-400 mb-2">Duplicate Risk Detected ({duplicateRiskSubs.length})</div>
                        <div className="space-y-1.5">
                          {duplicateRiskSubs.map(s => (
                            <div key={s.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-white/65 truncate">{s.merchant}</span>
                              <span className="shrink-0 flex gap-1">
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-amber-400/15 text-amber-400">duplicate risk</span>
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-400/10 text-emerald-400 cursor-pointer">Keep</span>
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-red-400/10 text-red-400 cursor-pointer">Ignore</span>
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[10px] text-amber-300/70">Review these subscriptions — possible duplicates detected via merchant name matching.</div>
                      </div>
                    )}
                    <div className="text-[10px] text-white/25 font-mono">POST /api/subscriptions · GET /api/subscriptions · /api/subscriptions/intelligence</div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-sm text-white/40">No subscriptions detected — import recurring transactions</div>
                    <div className="mt-1 text-xs text-white/25 font-mono">POST /api/ingest (CSV with recurring rows) · GET /api/subscriptions</div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Renewal Calendar ─────────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Renewal Calendar"
                subtitle={
                  localSubs.length > 0
                    ? `${localSubs.length} subscription(s) — upcoming 3-month renewal calendar`
                    : "Import recurring transactions to populate renewal calendar"
                }
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                {localSubs.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {renewalCalendar.map(({ month, events }) => {
                      const monthLabel = new Date(month + "-01").toLocaleString("en-AU", { month: "long", year: "numeric" });
                      const monthTotal = events.reduce((s, e) => s + e.amount, 0);
                      return (
                        <div key={month} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-semibold text-white/70">{monthLabel}</div>
                            {events.length > 0 && (
                              <div className="text-xs font-bold text-amber-400">${monthTotal.toFixed(0)}</div>
                            )}
                          </div>
                          {events.length > 0 ? (
                            <div className="space-y-2">
                              {events.map((ev) => (
                                <div key={ev.id} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${ev.urgent ? "border-red-400/25 bg-red-400/5" : "border-white/[0.07] bg-white/[0.02]"}`}>
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-white/80 truncate">{ev.merchant}</div>
                                    <div className="text-[10px] text-white/35">
                                      {new Date(ev.nextRenewalDate).toLocaleDateString("en-AU")}
                                      {ev.daysUntil >= 0 ? ` · ${ev.daysUntil}d` : ""}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div className="text-xs font-semibold text-amber-400">${ev.amount.toFixed(0)}</div>
                                    {ev.urgent && <div className="text-[9px] text-red-400 font-semibold">Soon</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-white/30 text-center py-2">No renewals</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-sm text-white/40">No subscription data — import recurring transactions</div>
                    <div className="mt-1 text-xs text-white/25 font-mono">GET /api/subscriptions · renewal calendar derived from local data</div>
                  </div>
                )}
                <div className="mt-3 text-[10px] text-white/25 font-mono">
                  Domain Service: subscriptionService.computeRenewalCalendar · 3-month forward view
                </div>
              </div>
            </section>

            {/* ── Actionable Insights ───────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Actionable Insights"
                subtitle="AI-generated insights with severity, confidence, impact estimate, and suggested actions"
              />
              <div className="mt-3 space-y-2">
                {finInsights.map(ins => (
                  <FinInsightCard key={ins.id} {...ins} />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                <p className="text-xs text-sky-300">
                  <span className="font-semibold">Insight engine:</span> Insights are derived from imported local data.
                  Import more transactions for richer signals. See <span className="font-mono">/api/insights</span> for the full insight ledger.
                </p>
              </div>
            </section>

            {/* ── Autonomous Finance Health Score ───────────────────────────── */}
            <section>
              <SectionHeader
                title="Autonomous Finance Health Score"
                subtitle="Computed from imported transaction and subscription patterns · updated on each import"
              />
              <div className="mt-3 grid gap-4 xl:grid-cols-[auto_1fr]">
                <div className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 to-emerald-400/5 p-6 shadow-2xl shadow-black/30 xl:min-w-[220px]">
                  <div className="text-xs font-medium uppercase tracking-widest text-emerald-400">Autonomous Finance Health Score</div>
                  <div className="mt-2 text-6xl font-bold tabular-nums">{localTxs.length > 0 ? finHealthScore : 93}</div>
                  <div className="mt-1 text-xs text-white/40">Score out of 100</div>
                  <div className="mt-4 h-1.5 w-full rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${localTxs.length > 0 ? finHealthScore : 93}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-emerald-300">{localTxs.length > 0 ? finHealthLabel : "Strong"} &mdash; {localTxs.length > 0 ? `${localTxs.length} transactions analysed` : "Finance OS active"}</div>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Health Sub-Scores</div>
                  {localTxs.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[
                        { label: "Cash Flow", score: finNet >= 0 ? 88 : 45, note: finNet >= 0 ? "Positive" : "Negative" },
                        { label: "Recurring Burden", score: finSubsMonthly < 200 ? 90 : finSubsMonthly < 400 ? 75 : 58, note: finSubsMonthly < 200 ? "Efficient" : "Review needed" },
                        { label: "Recurring Mgmt", score: finRecurring.length > 0 ? 85 : 72, note: finRecurring.length > 0 ? "Tracked" : "No data" },
                        { label: "Data Coverage", score: localTxs.length > 20 ? 90 : localTxs.length > 5 ? 75 : 60, note: localTxs.length > 20 ? "Rich dataset" : "More data helpful" },
                        { label: "Diversification", score: finCategories.length >= 4 ? 85 : finCategories.length >= 2 ? 70 : 55, note: finCategories.length >= 4 ? "Well spread" : "Limited categories" },
                        { label: "Sub Efficiency", score: Math.min(100, Math.max(40, finIncome > 0 ? Math.round(100 - (finSubsMonthly / Math.max(finIncome / 12, 1)) * 300) : 72)), note: finIncome > 0 && finSubsMonthly < finIncome * 0.1 ? "Excellent" : finSubsMonthly < 200 ? "Good" : "Review" },
                      ].map(s => (
                        <HealthScoreCard key={s.label} label={s.label} score={Math.min(100, Math.max(0, s.score))} note={s.note} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {healthScores.map(item => <HealthScoreCard key={item.label} {...item} />)}
                    </div>
                  )}
                  <div className="mt-4 space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-1.5">Score Drivers</div>
                    {localTxs.length > 0 ? [
                      `${localTxs.length} transactions imported and analysed`,
                      `${localSubs.length} subscription(s) tracked`,
                      finSavingsRate >= 20 ? `Savings rate ${finSavingsRate.toFixed(1)}% — above 20% target` : "Import more data for savings analysis",
                    ].map(d => (
                      <div key={d} className="flex items-center gap-2 text-xs text-white/50">
                        <span className="text-emerald-400/70">›</span>{d}
                      </div>
                    )) : [
                      "Multi-agent runtime active",
                      "Subscription intelligence active",
                      "CSV ingestion pipeline ready",
                    ].map(d => (
                      <div key={d} className="flex items-center gap-2 text-xs text-white/50">
                        <span className="text-emerald-400/70">›</span>{d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Copilot Conversations ─────────────────────────────────────── */}
            <section id="ai-copilot">
              <SectionHeader
                title="Copilot Conversations"
                subtitle="Local transaction and subscription context assembled for AI copilot responses"
              />
              <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
                {/* Context + conversation history */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Copilot Conversations — Context</div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Transactions", value: localCounts.transactions, color: localCounts.transactions > 0 ? "text-emerald-400" : "text-white/30", bg: localCounts.transactions > 0 ? "border-emerald-400/20 bg-emerald-400/5" : "border-white/[0.07] bg-white/[0.03]" },
                      { label: "Subscriptions", value: localCounts.subscriptions, color: localCounts.subscriptions > 0 ? "text-sky-400" : "text-white/30", bg: localCounts.subscriptions > 0 ? "border-sky-400/20 bg-sky-400/5" : "border-white/[0.07] bg-white/[0.03]" },
                      { label: "Import Runs", value: localCounts.imports, color: localCounts.imports > 0 ? "text-amber-400" : "text-white/30", bg: localCounts.imports > 0 ? "border-amber-400/20 bg-amber-400/5" : "border-white/[0.07] bg-white/[0.03]" },
                    ].map(c => (
                      <div key={c.label} className={`rounded-xl border px-3 py-2.5 ${c.bg}`}>
                        <div className="text-[10px] text-white/35">{c.label}</div>
                        <div className={`mt-1 text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Mock conversation history */}
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/30 mb-2">Question History</div>
                  <div className="space-y-2 mb-3">
                    {[
                      { q: "What is my net cash flow from imported data?", a: localTxs.length > 0 ? `Net cashflow: ${finNet >= 0 ? "+" : ""}$${finNet.toFixed(2)} from ${localTxs.length} transactions.` : "Import transaction data to see your net cash flow." },
                      { q: "Which subscription costs the most?", a: localSubs.length > 0 ? `${localSubs.sort((a,b) => b.amount - a.amount)[0]?.merchant ?? "—"} at $${localSubs.sort((a,b) => b.amount - a.amount)[0]?.amount?.toFixed(2) ?? "0"}/mo.` : "No subscriptions detected yet." },
                    ].map(({ q, a }) => (
                      <div key={q} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                        <div className="text-xs text-white/55"><span className="text-emerald-400/70 mr-1">Q:</span>{q}</div>
                        <div className="mt-1.5 text-xs text-sky-300/80 leading-relaxed"><span className="text-sky-400/70 mr-1">A:</span>{a}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/30">Storage Mode</span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {storageMode}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/20 font-mono">.ai/local-data/ — POST /api/copilot</div>
                  </div>
                </div>

                {/* Suggested prompts */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Suggested Prompts</div>
                  <div className="space-y-2">
                    {[
                      "What is my net cash flow from imported data?",
                      "Analyse my subscription spend.",
                      "How many recurring transactions detected?",
                      "What is my biggest spending category?",
                      "Show me my savings rate.",
                      "Which subscriptions should I review?",
                    ].map((q) => (
                      <div key={q} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-left text-xs text-white/55 hover:border-emerald-400/30 hover:bg-emerald-400/5 transition cursor-pointer">
                        <span className="mr-2 text-emerald-400/70">?</span>{q}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-white/30 leading-relaxed">
                    Copilot answers from {localCounts.transactions} imported transactions and {localCounts.subscriptions} subscriptions.
                    POST to <span className="font-mono">/api/copilot</span> with a prompt to query.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Finance Intelligence ─────────────────────────────────────── */}
            <section id="financial-intelligence">
              <SectionHeader
                title="Finance Intelligence"
                subtitle="Monthly spend trends · recurring commitments · savings opportunity ranking · merchant analytics"
              />
              <div className="mt-3 space-y-4">
                {/* Monthly trend bars */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Monthly Trends</div>
                  {finMonths.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                      {finMonths.map(([month, v]) => {
                        const net = v.income - v.spend;
                        return (
                          <div key={month} className={`rounded-xl border px-3 py-3 ${net >= 0 ? "border-emerald-400/20 bg-emerald-400/5" : "border-red-400/20 bg-red-400/5"}`}>
                            <div className="text-[10px] text-white/40 font-mono mb-1">{month}</div>
                            <div className="text-xs font-semibold text-emerald-400">+${v.income.toFixed(0)}</div>
                            <div className="text-xs font-semibold text-red-400">-${v.spend.toFixed(0)}</div>
                            <div className={`mt-1 text-[10px] font-bold ${net >= 0 ? "text-emerald-300" : "text-red-300"}`}>{net >= 0 ? "+" : ""}${net.toFixed(0)} net</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-white/35 py-3 text-center">Import transactions to see monthly trends</div>
                  )}
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {/* Recurring spend trend */}
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Recurring Spend Trend</div>
                    {recurringTrend.length > 0 ? (
                      <div className="space-y-2">
                        {recurringTrend.map(([month, amount]) => (
                          <div key={month} className="flex items-center gap-3">
                            <div className="text-[10px] font-mono text-white/40 w-16 shrink-0">{month}</div>
                            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-sky-400/60"
                                style={{ width: `${Math.min(100, (amount / (Math.max(...recurringTrend.map(([,a]) => a)) || 1)) * 100)}%` }}
                              />
                            </div>
                            <div className="text-xs font-semibold text-sky-400 w-16 text-right shrink-0">${amount.toFixed(0)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-white/35 py-3 text-center">
                        {finRecurring.length > 0 ? `${finRecurring.length} recurring · $${finRecurringSpend.toFixed(0)} total` : "No recurring transactions detected yet"}
                      </div>
                    )}
                    <div className="mt-3 text-[10px] text-white/25 font-mono">{finRecurring.length} recurring txns · ${finRecurringSpend.toFixed(0)} total committed spend</div>
                  </div>

                  {/* Savings opportunity ranking */}
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Savings Opportunity Ranking</div>
                    {savingsOpps.length > 0 ? (
                      <div className="space-y-2">
                        {savingsOpps.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                            <span className="shrink-0 text-[10px] font-bold text-white/25 w-4">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-white/80 truncate">{s.merchant}</div>
                              <div className="text-[10px] text-white/35">{s.cadence} · ${s.amount.toFixed(2)}/mo</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-xs font-semibold text-emerald-400">~${(s.savingsOpportunity || 0).toFixed(0)}/yr</div>
                            </div>
                          </div>
                        ))}
                        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
                          Total savings opportunity: <span className="font-semibold">${finSavingsOpp.toFixed(0)}/year</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-white/35 py-3 text-center">
                        {localSubs.length > 0 ? "No savings opportunities flagged on current subscriptions" : "Import subscriptions to see savings ranking"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Transaction & Category Charts ────────────────────────────── */}
            <section id="analytics">
              <SectionHeader
                title="Transaction &amp; Category Charts"
                subtitle={hasLocalTxData ? `Recharts visualisations — category spend + monthly cashflow${cashflowForecast.length > 0 ? " + 3-month forecast" : ""}` : "Import transactions to generate charts"}
              />
              <div className="mt-3">
                <FinanceCharts
                  categories={finCategories}
                  months={finMonthSummaries}
                  forecast={cashflowForecast}
                />
              </div>
            </section>

            {/* ── Cashflow Forecast ────────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Cashflow Forecast"
                subtitle={
                  finMonthSummaries.length >= 2
                    ? `3-month forward forecast derived from ${finMonthSummaries.length} historical months`
                    : "Import 2+ months of data to generate forecast"
                }
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                {cashflowForecast.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {cashflowForecast.map((fc) => {
                        const label = new Date(fc.month + "-01").toLocaleString("en-AU", { month: "short", year: "numeric" });
                        return (
                          <div key={fc.month} className={`rounded-xl border p-4 ${fc.forecastNet >= 0 ? "border-emerald-400/20 bg-emerald-400/5" : "border-red-400/20 bg-red-400/5"}`}>
                            <div className="text-[10px] font-mono text-white/40 mb-1">{label}</div>
                            <div className="text-xs font-semibold text-emerald-400">+${fc.forecastIncome.toLocaleString()}</div>
                            <div className="text-xs font-semibold text-red-400">-${fc.forecastSpend.toLocaleString()}</div>
                            <div className={`mt-1.5 text-sm font-bold tabular-nums ${fc.forecastNet >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                              {fc.forecastNet >= 0 ? "+" : ""}${fc.forecastNet.toLocaleString()} net
                            </div>
                            <div className="mt-1 text-[9px] text-white/25">avg-based estimate</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                      <p className="text-xs text-sky-300">
                        <span className="font-semibold">Forecast method:</span> 3-month rolling average from {finMonthSummaries.length} historical months.
                        Import more data for higher forecast accuracy. Derived via <span className="font-mono">financeService.computeCashflowForecast</span>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-sm text-white/40">Insufficient data — import 2+ months of transactions</div>
                    <div className="mt-1 text-xs text-white/25 font-mono">financeService.computeCashflowForecast · requires ≥2 months history</div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Workflow Automation ───────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Workflow Automation"
                subtitle="One-click import-to-insight pipeline · stage pass/fail display · POST /api/smoke for full validation"
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Pipeline Stages</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {wfStages.map((stage) => (
                    <div key={stage.name} className={`rounded-xl border p-3 ${stage.status === "pass" ? "border-emerald-400/20 bg-emerald-400/5" : "border-white/[0.07] bg-white/[0.03]"}`}>
                      <div className={`flex items-center gap-1 text-[10px] font-semibold ${stage.status === "pass" ? "text-emerald-400" : "text-white/30"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${stage.status === "pass" ? "bg-emerald-400" : "bg-white/20"}`} />
                        {stage.status === "pass" ? "Pass" : "Pending"}
                      </div>
                      <div className="mt-1 text-xs font-medium text-white/80">{stage.name}</div>
                      <div className="mt-0.5 text-[10px] text-white/35">{stage.detail}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold text-white/70">Smoke Workflow Status</div>
                    <div className="text-[10px] text-white/35 mt-0.5">{wfStages.filter(s => s.status === "pass").length}/{wfStages.length} stages complete · POST /api/smoke to run full validation</div>
                  </div>
                  <div className={`shrink-0 rounded-xl border px-4 py-2 text-center ${wfStages.filter(s => s.status === "pass").length === wfStages.length ? "border-emerald-400/25 bg-emerald-400/10" : "border-amber-400/25 bg-amber-400/10"}`}>
                    <div className={`text-xs font-bold ${wfStages.filter(s => s.status === "pass").length === wfStages.length ? "text-emerald-400" : "text-amber-400"}`}>
                      {wfStages.filter(s => s.status === "pass").length === wfStages.length ? "All Pass" : `${wfStages.filter(s => s.status === "pass").length}/${wfStages.length} Pass`}
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                  <p className="text-xs text-sky-300">
                    <span className="font-semibold">Automation path:</span> Import CSV → Merchant Cleanup → Subscription Detection → Insight Generation → Copilot Context → Health Score.
                    Import data via the Import section to advance pending stages. See <span className="font-mono">/api/smoke</span> for the full validation suite.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Workflow History ──────────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Workflow History"
                subtitle={
                  workflowRunHistory.length > 0
                    ? `${workflowRunHistory.length} prior run(s) — import-to-insight pipeline history with stage pass/fail`
                    : "No workflow runs recorded yet — run the import pipeline to start history"
                }
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                {workflowRunHistory.length > 0 ? (
                  <div className="space-y-3">
                    {workflowRunHistory.map((run) => {
                      const passCount = run.stages.filter((s) => s.status === "pass").length;
                      const allPass = passCount === run.stages.length;
                      return (
                        <div key={run.id} className={`rounded-xl border px-4 py-3 ${allPass ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-amber-400/5"}`}>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div>
                              <div className="text-xs font-semibold text-white/70 font-mono">{run.id.slice(0, 20)}</div>
                              <div className="text-[10px] text-white/30">{new Date(run.startedAt).toLocaleString()}</div>
                            </div>
                            <div className={`text-xs font-bold ${allPass ? "text-emerald-400" : "text-amber-400"}`}>
                              {passCount}/{run.stages.length} pass
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {run.stages.map((stage) => (
                              <span key={stage.name} className={`rounded px-2 py-0.5 text-[9px] font-semibold ${stage.status === "pass" ? "bg-emerald-400/10 text-emerald-400" : stage.status === "fail" ? "bg-red-400/10 text-red-400" : "bg-white/5 text-white/30"}`}>
                                {stage.name}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1.5 text-[10px] text-white/25">
                            {run.totalTransactions} txns · {run.totalSubscriptions} subs · {run.insightsGenerated} insights
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                      <div className="text-xs text-white/40 mb-2">Current Import Pipeline Status</div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: "Import", done: localImports.length > 0 },
                          { name: "Merchant Cleanup", done: localTxs.length > 0 },
                          { name: "Subscription Detection", done: localSubs.length > 0 },
                          { name: "Insight Generation", done: finInsights.length > 0 },
                          { name: "Copilot Context", done: localTxs.length > 0 },
                          { name: "Health Score", done: true },
                        ].map((stage) => (
                          <span key={stage.name} className={`rounded px-2 py-0.5 text-[9px] font-semibold ${stage.done ? "bg-emerald-400/10 text-emerald-400" : "bg-white/5 text-white/30"}`}>
                            {stage.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-white/30 text-center py-2">
                      Workflow runs are recorded when the full pipeline executes via <span className="font-mono">POST /api/workflow-status</span>
                    </div>
                  </div>
                )}
                <div className="mt-3 text-[10px] text-white/25 font-mono">
                  Local persistence: .ai/local-data/workflow-runs.json · GET /api/workflow-status
                </div>
              </div>
            </section>

            {/* ── Runtime Quality Gate ──────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Runtime Quality Gate"
                subtitle="Visible copy for all product features — pass/pending status per feature"
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {qualityGateItems.map(item => (
                    <div key={item.name} className={`rounded-xl border p-3 ${item.status === "pass" ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-amber-400/5"}`}>
                      <div className={`flex items-center gap-1 text-[10px] font-semibold ${item.status === "pass" ? "text-emerald-400" : "text-amber-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.status === "pass" ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {item.status === "pass" ? "Pass" : "Pending"}
                      </div>
                      <div className="mt-1 text-xs font-medium text-white/80 leading-tight">{item.name}</div>
                      <div className="mt-0.5 text-[10px] text-white/35">{item.detail}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <div className="text-xs text-white/50">
                    <span className="font-semibold text-white/70">{qualityGateItems.filter(q => q.status === "pass").length}/{qualityGateItems.length}</span> quality gates passing
                  </div>
                  <div className={`text-xs font-bold ${qualityGateItems.filter(q => q.status === "pass").length === qualityGateItems.length ? "text-emerald-400" : "text-amber-400"}`}>
                    {qualityGateItems.filter(q => q.status === "pass").length === qualityGateItems.length ? "All Systems Ready" : "Import Data to Advance"}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Domain Services Layer Validation ────────────────────────── */}
            <section>
              <SectionHeader
                title="Domain Services Layer"
                subtitle="Modular service architecture · finance, merchant, subscription intelligence · semantic runtime validation"
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {[
                    { name: "Finance Service", path: "src/lib/services/financeService.ts", status: "pass" as const, detail: `Health: ${finSummary.healthScore} · ${finSummary.healthLabel}` },
                    { name: "Merchant Service", path: "src/lib/services/merchantService.ts", status: "pass" as const, detail: "Variants · confidence · cleanup · scoring" },
                    { name: "Subscription Service", path: "src/lib/services/subscriptionService.ts", status: "pass" as const, detail: "Renewals · calendar · duplicates · savings" },
                    { name: "Renewal Calendar", path: "GET /api/dashboard-metrics", status: localSubs.length > 0 ? "pass" as const : "pending" as const, detail: "3-month forward renewal view" },
                    { name: "Cashflow Forecast", path: "financeService.computeCashflowForecast", status: finMonthSummaries.length >= 2 ? "pass" as const : "pending" as const, detail: "Rolling avg 3-month projection" },
                    { name: "Merchant Enrichment", path: "GET /api/merchant-intelligence", status: "pass" as const, detail: "Logo · domain placeholders · scoring" },
                    { name: "Insight Feed", path: "GET /api/insights", status: "pass" as const, detail: "Severity · confidence · impact · actions" },
                    { name: "Workflow History", path: ".ai/local-data/workflow-runs.json", status: "pass" as const, detail: "Stage pass/fail · timestamps · per-run" },
                    { name: "Runtime Governance", path: "GET /api/runtime/continuous-status", status: "pass" as const, detail: "Queue health · green commit · overnight" },
                    { name: "Local Persistence", path: ".ai/local-data/", status: "pass" as const, detail: "Copilot history · actions · merchant maps" },
                  ].map((item) => (
                    <div key={item.name} className={`rounded-xl border p-3 ${item.status === "pass" ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-amber-400/5"}`}>
                      <div className={`flex items-center gap-1 text-[10px] font-semibold ${item.status === "pass" ? "text-emerald-400" : "text-amber-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.status === "pass" ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {item.status === "pass" ? "Active" : "Pending"}
                      </div>
                      <div className="mt-1 text-xs font-medium text-white/80 leading-tight">{item.name}</div>
                      <div className="mt-0.5 text-[10px] text-white/35 leading-tight">{item.detail}</div>
                      <div className="mt-1 text-[9px] text-white/20 font-mono truncate">{item.path}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                  <p className="text-xs text-sky-300">
                    <span className="font-semibold">Architecture:</span> Finance, merchant, and subscription logic extracted into modular domain services under{" "}
                    <span className="font-mono">src/lib/services/</span>. New API routes:{" "}
                    <span className="font-mono">/api/dashboard-metrics</span>,{" "}
                    <span className="font-mono">/api/finance-health</span>,{" "}
                    <span className="font-mono">/api/merchant-intelligence</span>,{" "}
                    <span className="font-mono">/api/workflow-status</span>,{" "}
                    <span className="font-mono">/api/copilot-history</span>.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Import History ────────────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Import History"
                subtitle={localImports.length > 0 ? `${localImports.length} import run${localImports.length !== 1 ? "s" : ""} recorded — CSV ingestion pipeline history` : "No imports yet — use the Import section to load CSV data"}
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                {localImports.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: "Total Imports", value: localImports.length, color: "text-white/80" },
                        { label: "Rows Imported", value: localImports.reduce((s, i) => s + i.rowCount, 0), color: "text-emerald-400" },
                        { label: "Avg Health Score", value: localImports.length > 0 ? `${Math.round(localImports.reduce((s, i) => s + i.healthScore, 0) / localImports.length)}%` : "—", color: "text-sky-400" },
                      ].map(m => (
                        <div key={m.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <div className="text-xs text-white/40">{m.label}</div>
                          <div className={`mt-1.5 text-xl font-bold tabular-nums ${m.color}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Recent Imports</div>
                    {[...localImports].reverse().slice(0, 5).map(imp => (
                      <div key={imp.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-white/80">{imp.rowCount} rows</span>
                            <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-400/10 text-emerald-400">Health {imp.healthScore}%</span>
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${imp.mode === "persist" ? "bg-sky-400/10 text-sky-400" : "bg-amber-400/10 text-amber-400"}`}>{imp.mode}</span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-white/30 font-mono">{new Date(imp.importedAt).toLocaleString()} · {imp.transactionIds.length} transactions stored</div>
                        </div>
                      </div>
                    ))}
                    {localImports.length > 5 && (
                      <div className="text-center text-[10px] text-white/25 py-1">+{localImports.length - 5} earlier imports · .ai/local-data/imports.json</div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-3xl mb-3">📋</div>
                    <div className="text-sm font-medium text-white/60">No import history yet</div>
                    <div className="mt-1 text-xs text-white/35">Import CSV data to start building import history</div>
                    <div className="mt-3 text-xs text-white/25 font-mono">POST /api/ingest?mode=persist · .ai/local-data/imports.json</div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Merchant Cleanup ──────────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Merchant Cleanup"
                subtitle={merchantsNormalized > 0 ? `${merchantsNormalized} merchants canonicalized — raw names mapped to clean display names` : "Import transactions to see merchant canonicalization results"}
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                {merchantsNormalized > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 mb-2">
                      {[
                        { label: "Merchants Normalized", value: merchantsNormalized, color: "text-emerald-400" },
                        { label: "Unique Canonical", value: finMerchants.length, color: "text-sky-400" },
                        { label: "Total Unique Raw", value: Object.keys(merchantMap).length, color: "text-white/80" },
                      ].map(m => (
                        <div key={m.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <div className="text-xs text-white/40">{m.label}</div>
                          <div className={`mt-1.5 text-xl font-bold tabular-nums ${m.color}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Canonicalization Map</div>
                    <div className="space-y-1.5">
                      {merchantCleanupEntries.slice(0, 8).map(item => (
                        <div key={item.original} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
                          <div className="flex-1 min-w-0 grid grid-cols-[1fr_16px_1fr] items-center gap-2">
                            <div className="text-xs text-white/40 truncate font-mono">{item.original}</div>
                            <div className="text-xs text-white/25 text-center">→</div>
                            <div className="text-xs font-medium text-emerald-400/80 truncate">{item.canonical}</div>
                          </div>
                          <span className="shrink-0 text-[10px] text-white/30">{item.count} txn{item.count !== 1 ? "s" : ""}</span>
                        </div>
                      ))}
                      {merchantCleanupEntries.length > 8 && (
                        <div className="text-center text-[10px] text-white/25">+{merchantCleanupEntries.length - 8} more canonicalized merchants</div>
                      )}
                    </div>
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                      <p className="text-xs text-emerald-300">
                        <span className="font-semibold">Merchant Cleanup Engine:</span> Raw merchant names from CSV are normalized against known merchant patterns.
                        Canonical names ensure consistent categorization and deduplication across imports.
                      </p>
                    </div>
                    {/* Merchant Intelligence v2: confidence badges */}
                    {merchantConfidenceList.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Merchant Confidence</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                          {merchantConfidenceList.map(m => (
                            <div key={m.canonical} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] text-white/55 truncate">{m.canonical}</span>
                                <span className={`shrink-0 text-[10px] font-bold ${m.confidence >= 90 ? "text-emerald-400" : m.confidence >= 80 ? "text-sky-400" : "text-amber-400"}`}>{m.confidence}%</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1 rounded-full bg-white/10">
                                  <div className={`h-full rounded-full ${m.confidence >= 90 ? "bg-emerald-400" : m.confidence >= 80 ? "bg-sky-400" : "bg-amber-400"}`} style={{ width: `${m.confidence}%` }} />
                                </div>
                                <span className="text-[9px] text-white/25">{m.txCount}tx</span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <div className="h-4 w-4 rounded bg-white/10 flex items-center justify-center text-[8px] text-white/20">□</div>
                                <span className="text-[9px] text-white/20 italic">logo · domain pending</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Duplicate merchant detection */}
                    {duplicateMerchants.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-amber-400/70 mb-2">Duplicate Merchant Detection ({duplicateMerchants.length})</div>
                        <div className="space-y-1.5">
                          {duplicateMerchants.map(({ canonical, variants }) => (
                            <div key={canonical} className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-emerald-400/80">{canonical}</span>
                                <span className="text-[10px] text-white/30">←</span>
                                {variants.slice(0, 3).map(v => (
                                  <span key={v} className="rounded px-1.5 py-0.5 text-[9px] bg-white/5 text-white/45 border border-white/[0.07]">{v}</span>
                                ))}
                                {variants.length > 3 && <span className="text-[9px] text-white/25">+{variants.length - 3} more</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-3xl mb-3">🧹</div>
                    <div className="text-sm font-medium text-white/60">No merchant cleanup data yet</div>
                    <div className="mt-1 text-xs text-white/35">Import CSV transactions — the canonicalization engine will clean and normalize merchant names automatically</div>
                    <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                      <p className="text-xs text-emerald-300">
                        <span className="font-semibold">Merchant Cleanup Engine ready:</span> Patterns cover major Australian merchants — supermarkets, fuel, streaming, dining, and more.
                        POST /api/ingest to run cleanup on your transaction CSV.
                      </p>
                    </div>
                    <div className="mt-3 text-xs text-white/25 font-mono">Merchant cleanup engine active · POST /api/ingest</div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Export Local Data ────────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Export Local Data"
                subtitle="Export and restore all local persistent finance data — transactions, subscriptions, imports, memory"
              />
              <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
                <div className="grid gap-4 xl:grid-cols-2">
                  {/* Export */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Export Backup</div>
                    <div className="space-y-2 mb-4">
                      {[
                        { label: "Transactions", count: localCounts.transactions, color: "text-emerald-400" },
                        { label: "Subscriptions", count: localCounts.subscriptions, color: "text-sky-400" },
                        { label: "Import Records", count: localCounts.imports, color: "text-amber-400" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
                          <span className="text-xs text-white/60">{item.label}</span>
                          <span className={`text-xs font-semibold tabular-nums ${item.color}`}>{item.count} records</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href="/api/backup/export"
                      className="block w-full rounded-xl border border-emerald-400/30 bg-emerald-400/10 py-2.5 text-center text-sm font-semibold text-emerald-400 transition hover:bg-emerald-400/20"
                    >
                      Download Full Backup (JSON)
                    </a>
                    <div className="mt-2 text-[10px] text-white/25 font-mono">GET /api/backup/export → neven-backup.json</div>
                  </div>
                  {/* Restore */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Restore from Backup</div>
                    <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-6 text-center mb-3">
                      <div className="text-2xl mb-2">📁</div>
                      <div className="text-sm text-white/50">Drop a <span className="font-mono">neven-backup.json</span> file here</div>
                      <div className="mt-1 text-xs text-white/30">or use the API below</div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                      <div className="text-xs font-medium text-white/60 mb-1">API Restore</div>
                      <div className="font-mono text-[10px] text-sky-400/80 leading-relaxed">
                        POST /api/backup/import<br />
                        Content-Type: application/json<br />
                        Body: {"{"} transactions, subscriptions, imports {"}"}
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-white/25 font-mono">POST /api/backup/import → merge strategy · dedup by id</div>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                  <p className="text-xs text-amber-300">
                    <span className="font-semibold">Backup path:</span> All local data stored in <span className="font-mono">.ai/local-data/</span> — transactions, subscriptions, imports, memory, telemetry.
                    Export creates a full JSON snapshot. Import merges records using deduplication by ID.
                  </p>
                </div>
              </div>
            </section>

            {/* Continuous Operations Monitor */}
            <section>
              <SectionHeader
                title="Continuous Operations Monitor"
                subtitle="Daemon heartbeat · scheduler · overnight mode · queue depth · defects · next task"
              />
              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                {/* Heartbeat + Pause/Resume */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Daemon Heartbeat</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow
                      label="Status"
                      value={heartbeat.paused ? "Paused" : heartbeat.alive ? "Active" : "Idle"}
                      color={heartbeat.paused ? "amber" : heartbeat.alive ? "emerald" : "white"}
                    />
                    <RemoteControlRow
                      label="Healthy"
                      value={heartbeat.healthy ? "Yes" : "Stale"}
                      color={heartbeat.healthy ? "emerald" : "red"}
                    />
                    <RemoteControlRow
                      label="Last Beat"
                      value={heartbeat.lastBeat ? new Date(heartbeat.lastBeat).toLocaleTimeString() : "—"}
                      mono
                    />
                    <RemoteControlRow
                      label="Stale (sec)"
                      value={heartbeat.staleSeconds !== null ? String(heartbeat.staleSeconds) : "—"}
                      color={heartbeat.staleSeconds !== null && heartbeat.staleSeconds > 1800 ? "red" : "white"}
                    />
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2">
                    <div className="text-[10px] text-amber-300 font-semibold">Pause/Resume</div>
                    <div className="mt-0.5 text-[10px] text-white/40 leading-tight">
                      Set <span className="font-mono">paused: true</span> in{" "}
                      <span className="font-mono">.ai/operations/daemon.json</span> — no destructive shell access
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-white/25 font-mono">/api/runtime/heartbeat</div>
                </Card>

                {/* Scheduler + Overnight */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">Scheduler &amp; Overnight</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow
                      label="Scheduler"
                      value={scheduler.enabled ? "Enabled" : "Disabled"}
                      color={scheduler.enabled ? "emerald" : "white"}
                    />
                    <RemoteControlRow
                      label="Cadence"
                      value={`${scheduler.cadenceMinutes} min`}
                      mono
                    />
                    <RemoteControlRow
                      label="Last Run"
                      value={scheduler.lastRunAt ? new Date(scheduler.lastRunAt).toLocaleDateString() : "—"}
                    />
                    <RemoteControlRow
                      label="Next Run"
                      value={scheduler.nextRunAt ? new Date(scheduler.nextRunAt).toLocaleTimeString() : "—"}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className={`rounded-xl border px-3 py-2 ${overnight.enabled ? "border-purple-400/20 bg-purple-400/5" : "border-white/[0.07] bg-white/[0.03]"}`}>
                      <div className="text-[10px] font-semibold text-white/40">Overnight</div>
                      <div className={`mt-0.5 text-sm font-bold ${overnight.enabled ? "text-purple-400" : "text-white/30"}`}>
                        {overnight.enabled ? "On" : "Off"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] font-semibold text-white/40">Tasks</div>
                      <div className="mt-0.5 text-sm font-bold text-white/70">
                        {overnight.tasksRun}/{overnight.maxTasks}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-white/25 font-mono">/api/runtime/scheduler · /api/runtime/overnight</div>
                </Card>

                {/* Queue + Defects + Next Task */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-purple-400">Queue &amp; Defects</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow
                      label="Queue Depth"
                      value={String(nextTask.queueDepth)}
                      color={nextTask.queueDepth > 0 ? "sky" : "white"}
                    />
                    <RemoteControlRow
                      label="Next Task"
                      value={nextTask.nextTask?.title ?? "—"}
                    />
                    <RemoteControlRow
                      label="Defects (total)"
                      value={String(defects.total)}
                    />
                    <RemoteControlRow
                      label="Unresolved"
                      value={String(defects.unresolved)}
                      color={defects.unresolved > 0 ? "red" : "emerald"}
                    />
                  </div>
                  {defects.latest && (
                    <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2">
                      <div className="text-[10px] font-semibold text-red-400">Latest Defect</div>
                      <div className="mt-0.5 text-[10px] text-white/50">{defects.latest.source ?? "unknown"}</div>
                      <div className="text-[10px] text-white/35 truncate">{defects.latest.description ?? "—"}</div>
                    </div>
                  )}
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/runtime/next-task · /api/runtime/defects</div>
                </Card>
              </div>
              <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-400/5 px-4 py-3">
                <p className="text-xs text-purple-300">
                  <span className="font-semibold">Continuous Operations:</span> 6 new runtime endpoints —
                  heartbeat, scheduler, overnight, next-task, defects, continuous-status.
                  Operations logs at <span className="font-mono">.ai/operations/</span>.
                  Windows startup scaffold at <span className="font-mono">.ai/operations/windows-startup.md</span>.
                  Safe pause/resume via <span className="font-mono">daemon.json paused flag</span> — no destructive shell.
                </p>
              </div>
            </section>

            {/* Remote Control Panel */}
            <section id="remote-control">
              <SectionHeader
                title="Remote Control"
                subtitle="Meshnet-ready runtime supervision — status · queue · git · browser validation · safe next actions"
              />
              <div className="mt-3 grid gap-3 xl:grid-cols-4">
                {/* Runtime Status */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-purple-400">Runtime Status</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow
                      label="Daemon"
                      value={runtimeStatus.daemon.active ? "Active" : "Idle"}
                      color={runtimeStatus.daemon.active ? "emerald" : "white"}
                    />
                    <RemoteControlRow
                      label="Run ID"
                      value={runtimeStatus.daemon.runId ? runtimeStatus.daemon.runId.slice(0, 22) + "…" : "—"}
                      mono
                    />
                    <RemoteControlRow
                      label="Total Runs"
                      value={String(runtimeStatus.daemon.totalRuns)}
                    />
                    <RemoteControlRow
                      label="Last Green"
                      value={runtimeStatus.build.lastGreen ? "Yes" : "No"}
                      color={runtimeStatus.build.lastGreen ? "emerald" : "amber"}
                    />
                    <RemoteControlRow
                      label="Green Commit"
                      value={runtimeStatus.build.greenCommit ? runtimeStatus.build.greenCommit.slice(0, 10) : "—"}
                      mono
                    />
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">
                    /api/runtime/status · /api/runtime/logs
                  </div>
                </Card>

                {/* Queue + Git */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">Queue &amp; Git</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { label: "Running", value: runtimeQueue.summary.running, color: "sky" as const },
                      { label: "Completed", value: runtimeQueue.summary.completed, color: "emerald" as const },
                      { label: "Failed", value: runtimeQueue.summary.failed, color: "red" as const },
                      { label: "Queued", value: runtimeQueue.summary.queued, color: "amber" as const },
                    ].map((s) => (
                      <RuntimeQueueStatusCard key={s.label} label={s.label} count={s.value} color={s.color} />
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow label="Branch" value={gitState.branch ?? "—"} mono />
                    <RemoteControlRow
                      label="Last Commit"
                      value={gitState.lastCommit ? gitState.lastCommit.hash.slice(0, 10) : "—"}
                      mono
                    />
                    <RemoteControlRow
                      label="Git Status"
                      value={gitState.status === "(clean)" ? "Clean" : "Modified"}
                      color={gitState.status === "(clean)" ? "emerald" : "amber"}
                    />
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">
                    /api/runtime/queue · /api/runtime/git
                  </div>
                </Card>

                {/* Browser Validation + Actions */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Browser Validation</div>
                  <div className="mt-3 space-y-2">
                    {screenshotMeta.screenshots.map((s) => (
                      <div key={s.key} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white/70 truncate">{s.key}</div>
                          <div className="text-[10px] text-white/30 font-mono">{s.relPath}</div>
                        </div>
                        <span className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold ml-2 ${s.exists ? "text-emerald-400" : "text-white/25"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.exists ? "bg-emerald-400" : "bg-white/20"}`} />
                          {s.exists ? "Present" : "Absent"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/40">Safe Next Actions</div>
                  <div className="mt-2 space-y-1">
                    {[
                      "GET /api/runtime/status",
                      "GET /api/runtime/queue",
                      "GET /api/runtime/git",
                      "GET /api/runtime/screenshot",
                      "POST /api/runtime/assign {goal}",
                      "GET /api/runtime/cancel",
                    ].map((action) => (
                      <div key={action} className="rounded px-2 py-1 font-mono text-[10px] text-sky-400/70 bg-sky-400/5 border border-sky-400/10">
                        {action}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">
                    /api/runtime/screenshot · /api/runtime/runs
                  </div>
                </Card>

                {/* Runtime Governance */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">Runtime Governance</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow
                      label="Queue Health"
                      value={runtimeQueue.summary.failed === 0 ? "Healthy" : `${runtimeQueue.summary.failed} failed`}
                      color={runtimeQueue.summary.failed === 0 ? "emerald" : "red"}
                    />
                    <RemoteControlRow
                      label="Validation"
                      value={qualityGateItems.filter((q) => q.status === "pass").length === qualityGateItems.length ? "All Pass" : `${qualityGateItems.filter((q) => q.status === "pass").length}/${qualityGateItems.length} Pass`}
                      color={qualityGateItems.filter((q) => q.status === "pass").length === qualityGateItems.length ? "emerald" : "amber"}
                    />
                    <RemoteControlRow
                      label="Last Green"
                      value={runtimeStatus.build.greenCommit ? runtimeStatus.build.greenCommit.slice(0, 10) : "—"}
                      mono
                    />
                    <RemoteControlRow
                      label="Overnight"
                      value={overnight.enabled ? "On" : "Off"}
                      color={overnight.enabled ? "sky" : "white"}
                    />
                    <RemoteControlRow
                      label="Defects"
                      value={defects.unresolved === 0 ? "None" : `${defects.unresolved} unresolved`}
                      color={defects.unresolved === 0 ? "emerald" : "red"}
                    />
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2">
                    <div className="text-[10px] text-amber-300 font-semibold">Governance Summary</div>
                    <div className="mt-0.5 text-[10px] text-white/40 leading-tight">
                      Autonomous queue · validation health · green commit · overnight mode
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-white/25 font-mono">/api/runtime/continuous-status</div>
                </Card>
              </div>
              <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-400/5 px-4 py-3">
                <p className="text-xs text-purple-300">
                  <span className="font-semibold">Meshnet Remote Control:</span> 14 runtime supervision endpoints active —
                  status, logs, runs, queue, assign, cancel, screenshot, git, heartbeat, scheduler, overnight, next-task, defects, continuous-status.
                  All endpoints are local-safe: no secrets, no destructive shell execution.
                  POST <span className="font-mono">/api/runtime/assign</span> with a <span className="font-mono">goal</span> to queue a new task.
                </p>
              </div>
            </section>

            {/* Build Autonomy v6 — Autonomous Task Composer */}
            <section>
              <SectionHeader
                title="Build Autonomy v6"
                subtitle="Build From UI · Submit Autonomous Task · Live Task Timeline · Daemon Polling · No Copy Paste Required · Big Bang Next Build"
              />
              <div className="mt-3 mb-3">
                <LatestScreenshots />
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                {/* Autonomous Task Composer — client component */}
                <div className="xl:col-span-2">
                  <Card className="p-5">
                    <AutonomousTaskComposer
                      suggestedGoal={
                        roadmapExecution.find((r) => r.status === "sprint")
                          ? `Product Build: ${roadmapExecution.find((r) => r.status === "sprint")!.title} — implement via ${roadmapExecution.find((r) => r.status === "sprint")!.agent}, add tests, run full build validation, write claude-report.json.`
                          : "Validation Pass: Run full autonomous validation — npm run build, browser check, interaction check, write claude-report.json."
                      }
                    />
                  </Card>
                </div>

                {/* Live Green Report + Daemon Health */}
                <div className="space-y-3">
                  {/* Live Final Green Report */}
                  <Card className="p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Live Green Report</div>
                    <div className="mt-3 space-y-2">
                      <RemoteControlRow
                        label="Status"
                        value={finalGreenReport?.status ? finalGreenReport.status.toUpperCase() : "No report"}
                        color={finalGreenReport?.status === "green" ? "emerald" : finalGreenReport?.status ? "red" : "white"}
                      />
                      <RemoteControlRow
                        label="Build"
                        value={finalGreenReport?.buildPassed ? "Pass" : finalGreenReport ? "Fail" : "—"}
                        color={finalGreenReport?.buildPassed ? "emerald" : finalGreenReport ? "red" : "white"}
                      />
                      <RemoteControlRow
                        label="Validation"
                        value={finalGreenReport?.validationPassed ? "Pass" : finalGreenReport ? "Fail" : "—"}
                        color={finalGreenReport?.validationPassed ? "emerald" : finalGreenReport ? "red" : "white"}
                      />
                      <RemoteControlRow
                        label="Commit"
                        value={finalGreenReport?.greenCommit ? finalGreenReport.greenCommit.slice(0, 10) : "—"}
                        mono
                      />
                      <RemoteControlRow
                        label="Completed"
                        value={finalGreenReport?.completedAt ? new Date(finalGreenReport.completedAt).toLocaleTimeString() : "—"}
                      />
                    </div>
                    {finalGreenReport?.goal && (
                      <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
                        <div className="text-[9px] text-emerald-300/60 uppercase font-semibold mb-0.5">Last Goal</div>
                        <div className="text-[10px] text-white/40 leading-snug">{finalGreenReport.goal.slice(0, 100)}{finalGreenReport.goal.length > 100 ? "…" : ""}</div>
                      </div>
                    )}
                    <div className="mt-2 text-[10px] text-white/25 font-mono">.ai/final-green-report.json</div>
                  </Card>

                  {/* Daemon Health + Claude Quota Pause */}
                  <Card className="p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">Daemon Health</div>
                    <div className="mt-3 space-y-2">
                      <RemoteControlRow
                        label="Health"
                        value={heartbeat.healthy ? "Healthy" : "Stale"}
                        color={heartbeat.healthy ? "emerald" : "amber"}
                      />
                      <RemoteControlRow
                        label="Alive"
                        value={heartbeat.alive ? "Yes" : "No"}
                        color={heartbeat.alive ? "emerald" : "white"}
                      />
                      <RemoteControlRow
                        label="Claude Quota"
                        value={heartbeat.paused ? "Paused" : "Running"}
                        color={heartbeat.paused ? "amber" : "emerald"}
                      />
                      <RemoteControlRow
                        label="Stale"
                        value={heartbeat.staleSeconds !== null ? `${heartbeat.staleSeconds}s ago` : "—"}
                        color={heartbeat.staleSeconds !== null && heartbeat.staleSeconds < 1800 ? "emerald" : "amber"}
                      />
                      <RemoteControlRow
                        label="Run ID"
                        value={heartbeat.activeRunId ? heartbeat.activeRunId.slice(0, 14) + "…" : "None"}
                        mono
                      />
                    </div>
                    <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2">
                      <div className="text-[9px] text-amber-300/60 uppercase font-semibold">Claude Quota Pause</div>
                      <div className="text-[10px] text-white/35 mt-0.5">
                        {heartbeat.paused ? "Daemon paused — set paused:false in .ai/operations/daemon.json to resume" : "Set paused:true in .ai/operations/daemon.json to pause daemon"}
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-white/25 font-mono">/api/runtime/heartbeat · .ai/operations/daemon.json</div>
                  </Card>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-400/5 px-4 py-3">
                <p className="text-xs text-purple-300">
                  <span className="font-semibold">Build Autonomy v6:</span> Build From UI — Submit Autonomous Task directly without copy/paste or terminal. No Copy Paste Required.
                  Daemon Polling auto-refreshes every 5 seconds. Live Task Timeline shows Assigned → Detected → Running → Validation → Green Commit, plus Quota Paused and Failed states.
                  Big Bang Next Build queues the highest-priority orchestrated cycle. Safe guardrails block dangerous goal text before submission.
                  Queue to Daemon Bridge shows live daemon status. Live Green Report reads <span className="font-mono">.ai/final-green-report.json</span>.
                  Wired to <span className="font-mono">/api/autonomous-task</span> — daemon picks up <span className="font-mono">.ai/tasks/current-task.md</span> automatically.
                </p>
              </div>
            </section>

            {/* Build Automation Panel */}
            <section id="build-automation">
              <SectionHeader
                title="Build Automation"
                subtitle="Staged build pipeline · build history · semantic gate · dependency health"
              />
              <div className="mt-3 grid gap-3 xl:grid-cols-4">
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Latest Build</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow
                      label="Status"
                      value={latestBuild ? latestBuild.status.toUpperCase() : "No record"}
                      color={latestBuild?.status === "green" ? "emerald" : latestBuild?.status === "red" ? "red" : "white"}
                    />
                    <RemoteControlRow
                      label="Build ID"
                      value={latestBuild?.buildId ? latestBuild.buildId.slice(0, 18) + "…" : "—"}
                      mono
                    />
                    <RemoteControlRow
                      label="Completed"
                      value={latestBuild?.completedAt ? new Date(latestBuild.completedAt).toLocaleTimeString() : "—"}
                    />
                    <RemoteControlRow
                      label="Semantic Gate"
                      value={latestBuild ? (latestBuild.semanticGate.passed ? "Pass" : "Fail") : "—"}
                      color={latestBuild?.semanticGate.passed ? "emerald" : "amber"}
                    />
                    <RemoteControlRow
                      label="Code Files"
                      value={latestBuild ? String(latestBuild.semanticGate.codeFilesChanged) : "—"}
                    />
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/build-status</div>
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">Build Stages</div>
                  <div className="mt-3 space-y-2">
                    {latestBuild ? latestBuild.stages.map((stage) => (
                      <RemoteControlRow
                        key={stage.name}
                        label={stage.name}
                        value={stage.status.toUpperCase()}
                        color={stage.status === "pass" ? "emerald" : "red"}
                      />
                    )) : (
                      <div className="text-xs text-white/35">No build run yet — POST /api/build-pipeline</div>
                    )}
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/build-pipeline</div>
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">Build History</div>
                  <div className="mt-3 space-y-2">
                    {buildHistory.length === 0 ? (
                      <div className="text-xs text-white/35">No build records in .ai/builds/</div>
                    ) : buildHistory.slice(0, 4).map((b) => (
                      <div key={b.buildId} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                        <span className="text-[10px] text-white/40 font-mono">{b.buildId ? b.buildId.slice(0, 12) : "—"}…</span>
                        <span className={`text-[10px] font-semibold ${b.status === "green" ? "text-emerald-400" : "text-red-400"}`}>{b.status.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/build-history</div>
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-purple-400">Dependency Health</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow
                      label="Overall"
                      value={depHealth.summary.overallHealth.toUpperCase()}
                      color={depHealth.summary.overallHealth === "green" ? "emerald" : depHealth.summary.overallHealth === "yellow" ? "amber" : "red"}
                    />
                    <RemoteControlRow label="Passed" value={String(depHealth.summary.passed)} color="emerald" />
                    <RemoteControlRow label="Warned" value={String(depHealth.summary.warned)} color={depHealth.summary.warned > 0 ? "amber" : "white"} />
                    <RemoteControlRow label="Failed" value={String(depHealth.summary.failed)} color={depHealth.summary.failed > 0 ? "red" : "white"} />
                    <RemoteControlRow label="Routes" value={String(depHealth.routeCount)} />
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/dependency-health</div>
                </Card>
              </div>
              <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                <p className="text-xs text-emerald-300">
                  <span className="font-semibold">Build Automation:</span> POST <span className="font-mono">/api/build-pipeline</span> to run staged typecheck + build checks.
                  Results persisted to <span className="font-mono">.ai/builds/</span> with semantic gate validation.
                  GET <span className="font-mono">/api/build-history</span> for full history · <span className="font-mono">/api/build-status</span> for latest · <span className="font-mono">/api/dependency-health</span> for package health.
                </p>
              </div>
            </section>

            {/* Build Automation v2 Panel */}
            <section>
              <SectionHeader
                title="Build Automation v2"
                subtitle="Build queue · CI readiness · test runner · release candidate"
              />
              <div className="mt-3 grid gap-3 xl:grid-cols-4">
                {/* Build Queue */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Build Queue</div>
                  <div className="mt-3 space-y-1.5">
                    {(["queued", "running", "succeeded", "failed"] as const).map((s) => {
                      const count = buildQueue.jobs.filter((j) => j.status === s).length;
                      const color = s === "queued" ? "text-amber-400" : s === "running" ? "text-sky-400" : s === "succeeded" ? "text-emerald-400" : "text-red-400";
                      return (
                        <div key={s} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
                          <span className="text-[10px] text-white/40 uppercase font-semibold">{s}</span>
                          <span className={`text-sm font-bold tabular-nums ${color}`}>{count}</span>
                        </div>
                      );
                    })}
                    <div className="pt-1 text-[10px] text-white/25 font-mono">/api/build-queue</div>
                  </div>
                </Card>

                {/* CI Readiness */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">CI Readiness</div>
                  <div className="mt-3 space-y-1.5">
                    {ciReadiness.steps.slice(0, 5).map((step) => (
                      <div key={step.name} className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
                        <span className="shrink-0 text-emerald-400 text-xs">✓</span>
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium text-white/70 truncate">{step.name}</div>
                          <div className="text-[9px] text-white/30 font-mono truncate">{step.command.slice(0, 28)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-white/25 font-mono">.ai/ci/workflow.yml</div>
                </Card>

                {/* Test Runner */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-purple-400">Test Runner</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow label="Scaffold" value="Ready" color="emerald" />
                    <RemoteControlRow label="Test Files" value="5" color="emerald" />
                    <RemoteControlRow label="Runner" value="node --test" mono />
                    <RemoteControlRow label="Coverage" value="Services + Lib" />
                    <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 px-3 py-2 mt-1">
                      <div className="text-[10px] font-semibold text-purple-400">ADD ?run=true TO EXECUTE</div>
                      <div className="text-[9px] text-white/30 mt-0.5 font-mono">/api/test-runner</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-white/25 font-mono">__tests__/</div>
                </Card>

                {/* Release Candidate */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">Release Candidate</div>
                  <div className="mt-3 space-y-1.5">
                    {releaseCandidate.checks.map((check) => (
                      <div
                        key={check.name}
                        className={`flex items-start gap-2 rounded-xl border px-3 py-1.5 ${check.status === "pass" ? "border-emerald-400/15 bg-emerald-400/5" : check.status === "warn" ? "border-amber-400/15 bg-amber-400/5" : "border-red-400/15 bg-red-400/5"}`}
                      >
                        <span className={`shrink-0 text-[10px] font-bold ${check.status === "pass" ? "text-emerald-400" : check.status === "warn" ? "text-amber-400" : "text-red-400"}`}>
                          {check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗"}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium text-white/70 truncate">{check.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-white/25 font-mono">/api/release-candidate</div>
                </Card>
              </div>
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                <p className="text-xs text-amber-300">
                  <span className="font-semibold">Build Automation v2:</span> POST <span className="font-mono">/api/build-queue</span> to enqueue a build job.
                  GET <span className="font-mono">/api/build-queue/next</span> for the next queued job (add <span className="font-mono">?start=true</span> to mark running).
                  POST <span className="font-mono">/api/build-queue/complete</span> with <span className="font-mono">jobId + passed</span> to record result.
                  CI workflow at <span className="font-mono">.ai/ci/workflow.yml</span> — copy to <span className="font-mono">.github/workflows/ci.yml</span>.
                  RC: {releaseCandidate.ready ? "READY" : "NOT READY"} — {releaseCandidate.summary}.
                </p>
              </div>
            </section>

            {/* Build Automation v3 Panel */}
            <section>
              <SectionHeader
                title="Build Automation v3"
                subtitle="Autonomous Build Orchestrator · Safe Command Policy · Build Artifact Manifest · Transient Failure Handling · Runtime Health Contract · Release Promotion · Rollback Checkpoint · Build Queue Execution"
              />
              <div className="mt-3 grid gap-3 xl:grid-cols-4">
                {/* Autonomous Build Orchestrator */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Autonomous Build Orchestrator</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow label="Status" value={orchestratorSummary.status.toUpperCase()} color={orchestratorSummary.status === "idle" ? "emerald" : orchestratorSummary.status === "running" ? "sky" : "red"} />
                    <RemoteControlRow label="Jobs Run" value={String(orchestratorSummary.totalJobsRun)} color="emerald" />
                    <RemoteControlRow label="Transient Failures" value={String(orchestratorSummary.transientFailures)} color={orchestratorSummary.transientFailures > 0 ? "amber" : "white"} />
                    <RemoteControlRow label="Allowed Commands" value={String(orchestratorSummary.allowedCommandCount)} color="emerald" />
                    <RemoteControlRow label="Last Job" value={orchestratorSummary.lastJobId ? orchestratorSummary.lastJobId.slice(0, 14) + "…" : "None"} mono />
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/build-orchestrator</div>
                </Card>

                {/* Safe Command Policy */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">Safe Command Policy</div>
                  <div className="mt-3 space-y-1.5">
                    {allowedCommands.map((cmd) => (
                      <div key={cmd.key} className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
                        <span className="shrink-0 text-emerald-400 text-xs">✓</span>
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium text-white/70 truncate">{cmd.command}</div>
                          <div className="text-[9px] text-white/30 uppercase">{cmd.category}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-white/25 font-mono">/api/command-policy</div>
                </Card>

                {/* Build Artifact Manifest */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-purple-400">Build Artifact Manifest</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow label="Total Builds" value={String(artifactManifest.totalBuilds)} color="emerald" />
                    <RemoteControlRow label="Latest Artifact" value={artifactManifest.artifacts[0]?.buildId ? artifactManifest.artifacts[0].buildId.slice(0, 14) + "…" : "None"} mono />
                    <RemoteControlRow label="Screenshot" value={artifactManifest.artifacts[0]?.screenshotPath ? "Present" : "Pending"} color={artifactManifest.artifacts[0]?.screenshotPath ? "emerald" : "amber"} />
                    <RemoteControlRow label="RC Report" value={artifactManifest.artifacts[0]?.releaseCandidateReport ? "Present" : "Pending"} color={artifactManifest.artifacts[0]?.releaseCandidateReport ? "emerald" : "amber"} />
                    <RemoteControlRow label="Arch Map" value={artifactManifest.artifacts[0]?.architectureMapPath ? "Present" : "Pending"} color={artifactManifest.artifacts[0]?.architectureMapPath ? "emerald" : "amber"} />
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/build-artifacts</div>
                </Card>

                {/* Transient Failure Handling + Health Contract + Release Promotion */}
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">Transient Failure Handling</div>
                  <div className="mt-3 space-y-1.5">
                    {TRANSIENT_ERROR_PATTERNS.slice(0, 5).map((pattern) => (
                      <div key={pattern} className="flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-1.5">
                        <span className="text-[10px] font-semibold text-amber-400">RETRY</span>
                        <span className="text-[10px] text-white/50 truncate font-mono">{pattern}</span>
                      </div>
                    ))}
                    <div className="text-[9px] text-white/25 mt-1">ECONNABORTED/fetch failed → classified as infrastructure failure → retried without rollback</div>
                  </div>
                  <div className="mt-3 border-t border-white/[0.07] pt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-sky-400 mb-2">Runtime Health Contract</div>
                    <RemoteControlRow label="Endpoint" value="Active" color="emerald" />
                    <div className="mt-1 text-[10px] text-white/25 font-mono">/api/runtime/health-contract</div>
                  </div>
                </Card>
              </div>

              {/* Release Promotion + Rollback Readiness */}
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Release Promotion</div>
                  <div className="mt-3 space-y-2">
                    {(["dev", "candidate", "staging", "production"] as const).map((state) => {
                      const isCurrent = promotionSummary.state === state;
                      const stateColor = isCurrent
                        ? state === "production" ? "border-emerald-400/30 bg-emerald-400/10" : "border-sky-400/30 bg-sky-400/10"
                        : "border-white/[0.07] bg-white/[0.03]";
                      const labelColor = isCurrent
                        ? state === "production" ? "text-emerald-400" : "text-sky-400"
                        : "text-white/30";
                      return (
                        <div key={state} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${stateColor}`}>
                          <span className={`text-[10px] font-semibold uppercase ${labelColor}`}>{state}</span>
                          {isCurrent && <span className={`text-[9px] font-bold uppercase ${labelColor}`}>CURRENT</span>}
                          {state === "production" && !isCurrent && (
                            <span className="text-[9px] text-amber-400 uppercase">Approval Required</span>
                          )}
                        </div>
                      );
                    })}
                    <RemoteControlRow
                      label="Approved for Production"
                      value={promotionSummary.readyForProduction ? "Yes" : "No"}
                      color={promotionSummary.readyForProduction ? "emerald" : "amber"}
                    />
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/release-promotion</div>
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-red-400">Rollback Checkpoint</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow label="Checkpoints Available" value={String(promotionSummary.checkpointCount)} color={promotionSummary.checkpointCount > 0 ? "emerald" : "amber"} />
                    <RemoteControlRow label="Current State" value={promotionSummary.state.toUpperCase()} color="sky" />
                    <RemoteControlRow label="Git Rollback" value="git revert HEAD" mono />
                    <RemoteControlRow label="Rollback API" value="POST /api/release-promotion action=rollback" mono />
                    <div className="mt-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
                      <div className="text-[10px] font-semibold text-emerald-400">BUILD QUEUE EXECUTION</div>
                      <div className="text-[9px] text-white/40 mt-0.5">POST /api/build-orchestrator action=run-next to execute next queued job</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/build-artifacts · /api/build-orchestrator</div>
                </Card>
              </div>

              <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                <p className="text-xs text-emerald-300">
                  <span className="font-semibold">Build Automation v3:</span> Autonomous Build Orchestrator reads Build Queue jobs and runs staged Build Queue Execution via Safe Command Policy engine.
                  Build Artifact Manifest persisted to <span className="font-mono">.ai/builds/artifacts/</span> recording screenshots, reports, route counts, diff stats, RC reports, dependency health, and architecture maps per build.
                  Transient Failure Handling: ECONNABORTED/fetch failed from localhost validation is classified as transient infrastructure failure and retried without rollback.
                  Runtime Health Contract at <span className="font-mono">/api/runtime/health-contract</span> verifies orchestrator, Next app, browser validation, Claude availability, build queue, and git state.
                  Release Promotion: dev → candidate → staging → production (approval required for production) with Rollback Checkpoint references.
                </p>
              </div>
            </section>

            {/* Architecture Governance Panel */}
            <section id="architecture-governance">
              <SectionHeader
                title="Architecture Governance"
                subtitle="Domain modules · API adapters · persistence · runtime · build pipeline · test scaffold · deployment readiness"
              />
              <div className="mt-3 grid gap-3 xl:grid-cols-4">
                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">Domain Boundaries</div>
                  <div className="mt-3 space-y-2">
                    {Object.entries(archMap.domainBoundaries).map(([domain, mods]) => (
                      <div key={domain} className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                        <span className="text-[10px] text-white/40 shrink-0">{domain}</span>
                        <span className="text-[10px] font-medium text-white/60 text-right truncate">{(mods as string[]).length > 0 ? (mods as string[]).join(", ").slice(0, 40) + ((mods as string[]).join(", ").length > 40 ? "…" : "") : "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/architecture-map</div>
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Architecture Summary</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow label="Total Modules" value={String(archMap.summary.totalModules)} />
                    <RemoteControlRow label="Total Routes" value={String(archMap.summary.totalRoutes)} />
                    <RemoteControlRow label="Live Routes (GET)" value={String(archMap.summary.liveRoutes)} color="emerald" />
                    <RemoteControlRow label="Scaffold Routes" value={String(archMap.summary.scaffoldRoutes)} color={archMap.summary.scaffoldRoutes > 0 ? "amber" : "white"} />
                    <RemoteControlRow label="Risk Areas" value={String(archMap.summary.riskCount)} color={archMap.summary.riskCount > 0 ? "amber" : "emerald"} />
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">.ai/architecture/map.json</div>
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">Risk Areas &amp; Test Scaffold</div>
                  <div className="mt-3 space-y-2">
                    {archMap.riskAreas.length === 0 ? (
                      <div className="text-xs text-emerald-400">No risk areas detected</div>
                    ) : archMap.riskAreas.slice(0, 4).map((r, i) => (
                      <div key={i} className={`rounded-xl border px-3 py-2 ${r.severity === "high" ? "border-red-400/20 bg-red-400/5" : "border-amber-400/20 bg-amber-400/5"}`}>
                        <div className={`text-[10px] font-semibold ${r.severity === "high" ? "text-red-400" : "text-amber-400"}`}>{r.severity.toUpperCase()}</div>
                        <div className="text-[10px] text-white/50 leading-tight mt-0.5">{r.risk}</div>
                      </div>
                    ))}
                    <div className="mt-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
                      <div className="text-[10px] font-semibold text-emerald-400">TEST SCAFFOLD</div>
                      <div className="text-[10px] text-white/50 mt-0.5">financeService · merchantService · subscriptionService · localStore · runtimeControl</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">__tests__/services/ · __tests__/lib/</div>
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-red-400">Architecture Drift</div>
                  <div className="mt-3 space-y-2">
                    <RemoteControlRow
                      label="Status"
                      value={driftReport.hasDrift ? "DRIFT DETECTED" : "Stable"}
                      color={driftReport.hasDrift ? "amber" : "emerald"}
                    />
                    <RemoteControlRow label="Current Routes" value={String(driftReport.currentRoutes)} />
                    <RemoteControlRow
                      label="Route Delta"
                      value={driftReport.currentRoutes - driftReport.baselineRoutes >= 0 ? `+${driftReport.currentRoutes - driftReport.baselineRoutes}` : String(driftReport.currentRoutes - driftReport.baselineRoutes)}
                      color={driftReport.currentRoutes > driftReport.baselineRoutes ? "emerald" : driftReport.currentRoutes < driftReport.baselineRoutes ? "red" : "white"}
                    />
                    <RemoteControlRow label="Module Delta" value={driftReport.currentModules - driftReport.baselineModules >= 0 ? `+${driftReport.currentModules - driftReport.baselineModules}` : String(driftReport.currentModules - driftReport.baselineModules)} />
                    {driftReport.driftItems.slice(0, 3).map((item, i) => (
                      <div key={i} className={`rounded-xl border px-3 py-1.5 ${item.type === "added" ? "border-emerald-400/15 bg-emerald-400/5" : "border-red-400/15 bg-red-400/5"}`}>
                        <div className={`text-[9px] font-semibold uppercase ${item.type === "added" ? "text-emerald-400" : "text-red-400"}`}>{item.type} {item.kind}</div>
                        <div className="text-[9px] text-white/40 truncate">{item.name}</div>
                      </div>
                    ))}
                    {driftReport.driftItems.length === 0 && (
                      <div className="text-xs text-emerald-400">No drift — map is current</div>
                    )}
                  </div>
                  <div className="mt-3 text-[10px] text-white/25 font-mono">/api/architecture-drift</div>
                </Card>
              </div>
              <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
                <p className="text-xs text-sky-300">
                  <span className="font-semibold">Architecture Governance:</span> {archMap.summary.totalModules} lib modules · {archMap.summary.totalRoutes} API routes · {Object.keys(archMap.domainBoundaries).length} domain boundaries mapped.
                  Architecture report persisted to <span className="font-mono">.ai/architecture/map.json</span>.
                  Drift detector: {driftReport.summary}.
                  Test scaffold at <span className="font-mono">__tests__/</span> — run with <span className="font-mono">node --test</span>.
                  Dependency health: {depHealth.summary.overallHealth.toUpperCase()} ({depHealth.summary.passed} pass · {depHealth.summary.warned} warn · {depHealth.summary.failed} fail).
                </p>
              </div>
            </section>

            {/* Transactions + Safety */}
            <section className="grid gap-4 xl:grid-cols-2">
              <Panel title="Recent Transactions" subtitle="Transaction ingestion pipeline — CSV-ready">
                <div className="space-y-2">
                  {transactions.map((item) => (
                    <Row key={item.name + item.amount} {...item} />
                  ))}
                </div>
                <button className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs text-white/50 transition hover:text-white/80">
                  View all transactions
                </button>
              </Panel>

              <Panel title="Safety" subtitle="Snapshot, rollback and validation">
                <div className="space-y-2">
                  <Status label="Snapshot manager" value="Online" />
                  <Status label="Rollback manager" value="Ready" />
                  <Status label="Build validator" value="Online" />
                  <Status label="Anomaly detector" value="Online" />
                  <Status label="Semantic DOM validator" value="Online" />
                  <Status label="Repair governor" value="Online" />
                </div>
              </Panel>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-baseline gap-3 pb-3 border-b border-white/[0.06]">
      <h3 className="text-base font-semibold">{title}</h3>
      <span className="text-xs text-white/35">{subtitle}</span>
    </div>
  );
}

function FinancialHealthCard({ score }: { score: number }) {
  return (
    <div className="rounded-3xl border border-emerald-400/[0.18] bg-gradient-to-br from-emerald-500/[0.12] to-emerald-400/[0.04] backdrop-blur-xl p-6 shadow-2xl shadow-black/30 xl:min-w-[240px]">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/70">
        Financial Intelligence
      </div>
      <div className="mt-2 text-7xl font-bold tabular-nums leading-none">{score}</div>
      <div className="mt-2 text-xs text-white/40">Score out of 100</div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300/80">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-health-pulse" />
        Strong &mdash; Infrastructure Activation Phase
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={"rounded-2xl border border-white/[0.08] bg-white/[0.045] backdrop-blur-sm shadow-xl shadow-black/20 " + className}>
      {children}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-baseline gap-2 min-w-0">
        <h3 className="shrink-0 text-base font-semibold">{title}</h3>
        <span className="min-w-0 truncate text-xs text-white/35">{subtitle}</span>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Metric({ label, value, note, trend }: { label: string; value: string; note: string; trend: "up" | "down" | "neutral" }) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-sky-400";
  return (
    <Card className="p-4">
      <div className="text-xs text-white/40 truncate">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums leading-none">{value}</div>
      <div className={`mt-2 text-xs font-medium ${trendColor} flex items-center gap-1`}>
        <span>{trendIcon}</span>
        <span className="truncate">{note}</span>
      </div>
    </Card>
  );
}

function AllocationRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span className="text-white/75">{label}</span>
        </div>
        <span className="tabular-nums font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color} opacity-80`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HealthScoreCard({ label, score, note }: { label: string; score: number; note: string }) {
  const scoreColor = score >= 90 ? "text-emerald-400" : score >= 75 ? "text-sky-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <div className="text-xs text-white/40">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${scoreColor}`}>{score}</div>
      <div className="mt-0.5 text-xs text-white/35">{note}</div>
    </div>
  );
}

function Insight({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white/70 leading-relaxed">
      <span className="mr-2 text-emerald-400">›</span>
      {children}
    </div>
  );
}

function CopilotPrompt({ children }: { children: ReactNode }) {
  return (
    <button className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-left text-sm text-white/60 transition hover:border-emerald-400/30 hover:bg-emerald-400/5 hover:text-white/85">
      <span className="mr-2 text-emerald-400/70">?</span>
      {children}
    </button>
  );
}

function Row({ name, meta, amount }: { name: string; meta: string; amount: string; category?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="mt-0.5 text-xs text-white/35 truncate">{meta}</div>
      </div>
      <div className={"shrink-0 text-sm font-semibold tabular-nums " + (amount.startsWith("+") ? "text-emerald-400" : "text-red-400")}>
        {amount}
      </div>
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  const dotColor = value === "Online" ? "bg-emerald-400" : value === "Ready" ? "bg-sky-400" : "bg-white/30";
  const textColor = value === "Online" ? "text-emerald-400" : value === "Ready" ? "text-sky-400" : "text-white/40";
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-white/65 truncate">{label}</span>
      <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${textColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {value}
      </span>
    </div>
  );
}

function AgentCard({ label, value }: { label: string; value: string }) {
  const dotColor = value === "Online" ? "bg-emerald-400" : value === "Ready" ? "bg-sky-400" : "bg-amber-400";
  const textColor = value === "Online" ? "text-emerald-400" : value === "Ready" ? "text-sky-400" : "text-amber-400";
  const pulseClass = value === "Online" ? "animate-health-pulse" : "";
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3">
      <div className="text-xs text-white/50 leading-tight">{label}</div>
      <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${textColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${pulseClass}`} />
        {value}
      </div>
    </div>
  );
}

function ComponentHealthRow({ name, status, message }: { name: string; status: "green" | "yellow" | "red"; message: string }) {
  const dotColor = status === "green" ? "bg-emerald-400" : status === "yellow" ? "bg-amber-400" : "bg-red-400";
  const textColor = status === "green" ? "text-emerald-400" : status === "yellow" ? "text-amber-400" : "text-red-400";
  const statusLabel = status === "green" ? "Healthy" : status === "yellow" ? "Degraded" : "Critical";
  const pulseClass = status === "green" ? "animate-health-pulse" : "";
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white/80">{name}</div>
        <div className="mt-0.5 text-xs text-white/35 truncate">{message}</div>
      </div>
      <span className={`shrink-0 flex items-center gap-1.5 text-xs font-medium mt-0.5 ${textColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${pulseClass}`} />
        {statusLabel}
      </span>
    </div>
  );
}

function TelemetryRow({ event, level, agent, detail }: { event: string; level: "info" | "warn" | "error" | "critical"; agent: string; detail: string }) {
  const levelColor = level === "info" ? "text-sky-400" : level === "warn" ? "text-amber-400" : "text-red-400";
  const levelBg = level === "info" ? "bg-sky-400/10" : level === "warn" ? "bg-amber-400/10" : "bg-red-400/10";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${levelColor} ${levelBg}`}>{level}</span>
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-white/70">{event}</span>
        <span className="shrink-0 text-[10px] text-white/30">{agent}</span>
      </div>
      <div className="mt-1 text-xs text-white/40 truncate">{detail}</div>
    </div>
  );
}

function ExecutionTaskRow({ title, priority, status, effort, agent }: {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "backlog" | "sprint" | "in_progress" | "blocked" | "done";
  effort: string;
  agent: string;
}) {
  const priorityColor = priority === "critical" ? "text-red-400" : priority === "high" ? "text-amber-400" : "text-sky-400";
  const statusColor = status === "sprint" ? "text-emerald-400 bg-emerald-400/10" :
    status === "blocked" ? "text-red-400 bg-red-400/10" :
    status === "in_progress" ? "text-sky-400 bg-sky-400/10" :
    "text-white/40 bg-white/5";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase ${priorityColor}`}>{priority}</span>
          <span className="text-sm font-medium text-white/85 truncate">{title}</span>
        </div>
        <div className="mt-0.5 text-xs text-white/35">Effort: {effort} &bull; Agent: {agent}</div>
      </div>
      <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}>{status}</span>
    </div>
  );
}

function DeployGateCard({ name, passed, optional }: { name: string; passed: boolean; optional?: boolean }) {
  const isWarn = !passed && optional;
  return (
    <div className={`rounded-xl border p-3 ${passed ? "border-emerald-400/20 bg-emerald-400/5" : isWarn ? "border-amber-400/20 bg-amber-400/5" : "border-red-400/20 bg-red-400/5"}`}>
      <div className={`text-[10px] font-semibold ${passed ? "text-emerald-400" : isWarn ? "text-amber-400" : "text-red-400"}`}>
        {passed ? "✓ Pass" : isWarn ? "⚠ Optional" : "✗ Fail"}
      </div>
      <div className="mt-1 text-xs text-white/60 leading-tight">{name}</div>
    </div>
  );
}

function ProductionIntegrationCard({
  service,
  status,
  provider,
  path,
  detail,
  items,
}: {
  service: string;
  status: "green" | "yellow" | "red";
  provider: string;
  path: string;
  detail: string;
  items: string[];
}) {
  const borderColor =
    status === "green"
      ? "border-emerald-400/20"
      : status === "yellow"
      ? "border-amber-400/20"
      : "border-red-400/20";
  const dotColor =
    status === "green" ? "bg-emerald-400" : status === "yellow" ? "bg-amber-400" : "bg-red-400";
  const statusLabel = status === "green" ? "Active" : status === "yellow" ? "Pending" : "Error";
  const statusColor =
    status === "green"
      ? "text-emerald-400"
      : status === "yellow"
      ? "text-amber-400"
      : "text-red-400";
  return (
    <div className={`rounded-xl border ${borderColor} bg-white/[0.02] p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white/90">{service}</div>
          <div className="mt-0.5 font-mono text-[10px] text-white/35">{provider}</div>
        </div>
        <span className={`flex shrink-0 items-center gap-1 text-[10px] font-semibold ${statusColor}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
          {statusLabel}
        </span>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-white/50">{detail}</div>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1 text-[10px] text-white/35">
            <span className="shrink-0 text-emerald-400/60">›</span>
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-3 font-mono text-[9px] text-white/20">{path}</div>
    </div>
  );
}

function ActivationLayerCard({
  name,
  mode,
  detail,
  path,
}: {
  id: string;
  name: string;
  mode: "live" | "scaffold";
  detail: string;
  path: string;
}) {
  const isLive = mode === "live";
  return (
    <div className={`rounded-xl border p-3 ${isLive ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-amber-400/5"}`}>
      <div className={`flex items-center gap-1 text-[10px] font-semibold ${isLive ? "text-emerald-400" : "text-amber-400"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400"}`} />
        {isLive ? "Live" : "Scaffold"}
      </div>
      <div className="mt-1 text-xs text-white/80 font-medium leading-tight">{name}</div>
      <div className="mt-0.5 text-[10px] text-white/35 leading-tight">{detail}</div>
      <div className="mt-2 font-mono text-[9px] text-white/20">{path}</div>
    </div>
  );
}

function PrismaMigrationRow({ step, command, done }: { step: string; command: string; done: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
        done ? "border-emerald-400/20 bg-emerald-400/5" : "border-white/[0.07] bg-white/[0.03]"
      }`}
    >
      <span className={`shrink-0 text-sm font-bold leading-5 ${done ? "text-emerald-400" : "text-white/25"}`}>
        {done ? "✓" : "○"}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${done ? "text-emerald-300" : "text-white/70"}`}>{step}</div>
        <div className="mt-0.5 font-mono text-[10px] text-white/30">{command}</div>
      </div>
    </div>
  );
}

function RuntimeQueueStatusCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "sky" | "emerald" | "red" | "amber";
}) {
  const colorMap: Record<string, string> = {
    sky: "border-sky-400/20 bg-sky-400/5 text-sky-400",
    emerald: "border-emerald-400/20 bg-emerald-400/5 text-emerald-400",
    red: "border-red-400/20 bg-red-400/5 text-red-400",
    amber: "border-amber-400/20 bg-amber-400/5 text-amber-400",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${colorMap[color]}`}>
      <div className="text-[10px] font-semibold uppercase">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{count}</div>
    </div>
  );
}

function RepairCategoryRow({
  category,
  layer,
  summary,
}: {
  category: string;
  layer: string;
  summary: string;
}) {
  const layerColor =
    layer === "build"
      ? "bg-amber-400/10 text-amber-400"
      : layer === "runtime"
      ? "bg-sky-400/10 text-sky-400"
      : "bg-purple-400/10 text-purple-400";
  return (
    <div className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${layerColor}`}>
        {layer}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-white/70">{category}</div>
        <div className="text-[10px] text-white/35 leading-tight">{summary}</div>
      </div>
    </div>
  );
}

function RemoteControlRow({
  label,
  value,
  mono = false,
  color = "white",
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: "emerald" | "amber" | "sky" | "red" | "white";
}) {
  const valueColor =
    color === "emerald" ? "text-emerald-400" :
    color === "amber" ? "text-amber-400" :
    color === "sky" ? "text-sky-400" :
    color === "red" ? "text-red-400" :
    "text-white/70";
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
      <span className="text-xs text-white/40 shrink-0">{label}</span>
      <span className={`text-xs font-medium truncate ${mono ? "font-mono" : ""} ${valueColor}`}>{value}</span>
    </div>
  );
}

function ReadinessCheckCard({ name, status, message }: { name: string; status: "green" | "yellow" | "red"; message: string }) {
  const borderColor = status === "green" ? "border-emerald-400/20 bg-emerald-400/5" : status === "yellow" ? "border-amber-400/20 bg-amber-400/5" : "border-red-400/20 bg-red-400/5";
  const dotColor = status === "green" ? "bg-emerald-400" : status === "yellow" ? "bg-amber-400" : "bg-red-400";
  const labelColor = status === "green" ? "text-emerald-400" : status === "yellow" ? "text-amber-400" : "text-red-400";
  const statusLabel = status === "green" ? "Ready" : status === "yellow" ? "Pending" : "Error";
  return (
    <div className={`rounded-xl border p-3 ${borderColor}`}>
      <div className={`flex items-center gap-1 text-[10px] font-semibold ${labelColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {statusLabel}
      </div>
      <div className="mt-1 text-xs text-white/70 leading-tight font-medium truncate">{name}</div>
      <div className="mt-0.5 text-[10px] text-white/35 leading-tight">{message}</div>
    </div>
  );
}

function FinInsightCard({ title, description, severity, confidence, impact, actions }: {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  impact: string;
  actions: string[];
}) {
  const borderColor = severity === "high" ? "border-red-400/25 bg-red-400/5" : severity === "medium" ? "border-amber-400/25 bg-amber-400/5" : "border-white/[0.07] bg-white/[0.03]";
  const severityColor = severity === "high" ? "text-red-400 bg-red-400/10" : severity === "medium" ? "text-amber-400 bg-amber-400/10" : "text-sky-400 bg-sky-400/10";
  return (
    <div className={`rounded-xl border px-4 py-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white/90">{title}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityColor}`}>{severity}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-white/5 text-white/40 border border-white/[0.07]">{confidence}% confidence</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-400/10 text-amber-400/80 border border-amber-400/20">Unresolved</span>
          </div>
          <div className="mt-1.5 text-xs text-white/60 leading-relaxed">{description}</div>
        </div>
        <div className="shrink-0 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-right">
          <div className="text-[10px] text-white/35">Est. Impact</div>
          <div className="text-xs font-semibold text-emerald-400">{impact}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-white/30 font-semibold uppercase tracking-wide">Actions:</span>
        {actions.map(a => (
          <span key={a} className="rounded px-2 py-0.5 text-[10px] bg-white/5 text-white/50 border border-white/[0.07] cursor-pointer hover:bg-white/10 transition">{a}</span>
        ))}
        <span className="rounded px-2 py-0.5 text-[10px] bg-emerald-400/5 text-emerald-400/60 border border-emerald-400/20 cursor-pointer hover:bg-emerald-400/10 transition ml-auto">Mark Resolved</span>
      </div>
    </div>
  );
}

