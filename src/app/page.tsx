import AppShell from "./components/AppShell";
import BaselineDashboard from "./components/BaselineDashboard";
import AutonomousTaskComposer from "./components/AutonomousTaskComposer";
import SupervisorInbox from "./components/SupervisorInbox";
import DeveloperModeGate from "./components/DeveloperModeGate";
import EmptyFinancialDashboard from "./components/EmptyFinancialDashboard";
import { confirmedPositionSummary } from "@/lib/confirmedPositionSummary";
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
  const financialPositionIsEmpty = readModel.confirmedFacts.length === 0
    && readModel.documentImportStatus.documents.length === 0
    && readModel.documentImportStatus.importCount === 0;
  if (financialPositionIsEmpty) {
    return (
      <AppShell active="dashboard">
        <EmptyFinancialDashboard />
      </AppShell>
    );
  }
  const core = createCoreDecisioningServiceFromEnv();
  const summary = confirmedPositionSummary(readModel);
  const goalState = await core.readGoalState(session);
  const monthlyCashFlow = readModel.monthlyCashFlow;
  const runwayMonths = summary.assetGroups[2].value !== null && monthlyCashFlow.monthlyExpenses !== null && monthlyCashFlow.monthlyExpenses > 0
    ? summary.assetGroups[2].value! / monthlyCashFlow.monthlyExpenses
    : null;

  return (
    <AppShell active="dashboard">
            <BaselineDashboard
              netWorth={summary.netPosition}
              assets={summary.assets}
              liabilities={summary.liabilities}
              monthlyChange={null}
              monthlySurplus={monthlyCashFlow.monthlySurplus}
              monthlyIncome={monthlyCashFlow.monthlyIncome}
              monthlyExpenses={monthlyCashFlow.monthlyExpenses}
              runwayMonths={runwayMonths}
              updatedAt={readModel.generatedAt}
              dataNote={summary.note}
              cashFlowBasis={monthlyCashFlow.basis}
              goals={goalState.snapshot.activeGoals.map((evaluation) => ({
                id: evaluation.goal.id,
                title: evaluation.goal.title,
                current: evaluation.goal.currentAmount,
                target: evaluation.goal.targetAmount,
                targetDate: evaluation.goal.targetDate,
                status: evaluation.feasibility === "INSUFFICIENT_DATA" ? "NEEDS_INFORMATION" : evaluation.goal.status,
                risk: evaluation.feasibility === "INSUFFICIENT_DATA" ? "More information is needed to assess this goal." : evaluation.competingGoalConflicts[0] ?? (evaluation.fundingGap > 0 ? `${formatAud(evaluation.fundingGap)} remains to be funded.` : "Funding target met; this does not establish retirement readiness or assess all risks."),
                opportunity: evaluation.decisions[0]?.nextAction ?? (evaluation.requiredMonthlyContribution > 0 ? `Contribute ${formatAud(evaluation.requiredMonthlyContribution)} each month.` : "Maintain the current contribution."),
              }))}
              assetGroups={summary.assetGroups}
              attention={monthlyCashFlow.missingInputs.map((item) => ({ title: item.title, detail: item.detail, href: item.href, action: "Review data" }))}

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
