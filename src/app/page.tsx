import AppShell from "./components/AppShell";
import OverviewV3 from "./components/OverviewV3";
import AutonomousTaskComposer from "./components/AutonomousTaskComposer";
import SupervisorInbox from "./components/SupervisorInbox";
import DeveloperModeGate from "./components/DeveloperModeGate";
import { buildFinancialBalanceSheetFromReadModel } from "@/lib/financialBalanceSheet";
import { buildAiDecisions } from "@/lib/aiDecisionCentre";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

function SectionShell({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        {subtitle && <span className="text-sm text-slate-500">{subtitle}</span>}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        {children ?? (
          <p className="text-sm text-slate-500">
            Section placeholder restored after page recovery. Detailed module can be reattached safely.
          </p>
        )}
      </div>
    </section>
  );
}

function ScreenshotPanel() {
  const paths = [
    "screenshot/fullpage.png",
    "screenshot/overview.png",
    "screenshot/build-automation.png",
    ".ai/screenshots/fullpage.png",
  ];

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-blue-700">
        Latest Screenshot Paths
      </div>
      <div className="space-y-1 font-mono text-xs text-slate-600">
        {paths.map((p) => (
          <div key={p}>{p}</div>
        ))}
      </div>
    </div>
  );
}

function formatAud(value: number, compact = false) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: compact ? 2 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export default async function HomePage() {
  const session = await requireServerPageSession("/");
  let readModel;
  try {
    readModel = await createFinancialPositionReadServiceFromEnv().read(session);
  } catch {
    return (
      <AppShell active="dashboard">
        <main className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Financial data is unavailable. PostgreSQL-backed Financial Vault data could not be loaded, and no local fallback was used.
        </main>
      </AppShell>
    );
  }
  const vault = readModel.vault;
  const core = createCoreDecisioningServiceFromEnv();
  const housing = await core.readHousingAffordability(session);
  const balanceSheet = buildFinancialBalanceSheetFromReadModel(readModel);
  const decisions = buildAiDecisions({ vault, housing, balanceSheet });
  const workflowState = await core.readWorkflows(session, decisions);
  const dailyReview = await core.getLatestDailyReview(session);
  const primaryHousingScenario = housing.housing_scenarios[0];
  const largestHousingObstacle = primaryHousingScenario
    ? housing.housing_obstacles.find((obstacle) => obstacle.scenarioId === primaryHousingScenario.id)
    : null;
  const nextHousingAction = housing.housing_action_plans[0] ?? null;
  const vaultConfidence = Math.min(
    98,
    Math.round(Object.keys(vault.financial_profile.sources).length * 6.5 + vault.uploaded_documents.filter((doc) => doc.status === "extracted").length * 6)
  );
  const monthlyCashFlow = readModel.monthlyCashFlow;
  const savingsRate = monthlyCashFlow.monthlySurplus !== null && monthlyCashFlow.monthlyIncome !== null && monthlyCashFlow.monthlyIncome > 0
    ? `${Math.round((monthlyCashFlow.monthlySurplus / monthlyCashFlow.monthlyIncome) * 100)}%`
    : "Unknown";
  const runwayMonths = readModel.cashPosition.sourceRecordIds.length && monthlyCashFlow.monthlyExpenses !== null && monthlyCashFlow.monthlyExpenses > 0
    ? readModel.cashPosition.confirmedCash / monthlyCashFlow.monthlyExpenses
    : null;

  return (
    <AppShell active="dashboard">
            <OverviewV3
              netWorth={formatAud(balanceSheet.netWorth, true)}
              netWorthValue={balanceSheet.netWorth}
              netWorthTrend={`${formatAud(balanceSheet.monthlyNetChange)} persisted monthly change`}
              netWorthTrendValue={balanceSheet.monthlyNetChange}
              cashFlow={monthlyCashFlow.monthlySurplus === null ? "Unavailable" : formatAud(monthlyCashFlow.monthlySurplus)}
              savingsRate={savingsRate}
              runway={runwayMonths === null ? "Unknown" : `${runwayMonths.toFixed(1)} mo`}
              aiConfidence="Not calculated yet"
              healthScore={0}
              healthLabel="Needs confirmed data"
              insights={[]}
              portfolioAllocation={[]}
              healthScores={[]}
              dateStr={new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date())}
              vaultSummary={{
                documentsUploaded: vault.uploaded_documents.length,
                profileConfidence: vaultConfidence,
                estimatedBorrowingCapacity: vault.borrowing_capacity.estimatedSafeBorrowing,
                refinanceSavingEstimate: vault.refinance_opportunities[0]?.estimatedMonthlySaving ?? 0,
                lenderPackReadiness: vault.lender_pack.documentChecklist.filter((item) => item.available).length,
              }}
              housingSummary={{
                readinessScore: housing.house_readiness_score.score,
                readinessBand: housing.house_readiness_score.band,
                estimatedBorrowingCapacity: primaryHousingScenario?.estimatedBorrowingCapacity ?? 0,
                bestScenario: housing.housing_scenarios
                  .slice(0, 4)
                  .sort((a, b) => b.affordabilityScore - a.affordabilityScore)[0]?.propertyPrice ?? 0,
                largestObstacle: largestHousingObstacle?.category ?? "No major obstacle detected",
                nextRecommendedAction: nextHousingAction?.action ?? "Prepare lender documentation",
              }}
              decisions={decisions}
              workflows={workflowState.workflows}
              workflowSummary={workflowState.summary}
              dailyReview={dailyReview}
            />

            <DeveloperModeGate>
              <SectionShell id="roadmap" title="Roadmap" subtitle="Autonomous product roadmap" />

              <SectionShell id="telemetry" title="Telemetry" subtitle="Runtime event stream" />

              <SectionShell id="deployment" title="Deployment" subtitle="Local mode readiness">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Build", "Pass"],
                    ["TypeScript", "Pass"],
                    ["Local Mode", "Active"],
                  ].map(([label, status]) => (
                    <div key={label} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="mt-1 text-sm font-semibold text-emerald-700">Pass - {status}</div>
                    </div>
                  ))}
                </div>
              </SectionShell>

              <SectionShell id="remote-control" title="Remote Control" subtitle="Local autonomous controls" />

              <SectionShell id="supervisor-inbox" title="Supervisor Inbox" subtitle="Local task runner">
                <SupervisorInbox />
              </SectionShell>

              <SectionShell id="build-automation" title="Build Automation" subtitle="Submit tasks and monitor local automation">
                <div className="space-y-5">
                  <AutonomousTaskComposer
                    suggestedGoal="Stabilise local autonomous execution loop - run one task end-to-end with validation, screenshot capture, and report output."
                  />
                  <ScreenshotPanel />
                </div>
              </SectionShell>

              <SectionShell id="architecture-governance" title="Architecture Governance" subtitle="Componentisation and runtime structure" />
            </DeveloperModeGate>
    </AppShell>
  );
}
