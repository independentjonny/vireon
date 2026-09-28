import AppShell from "../components/AppShell";
import GoalsPlanningClient from "../components/GoalsPlanningClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";
import { createFinancialVaultServiceFromEnv } from "@/server/services/financialVaultPostgresService";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";
import { confirmedPositionSummary } from "@/lib/confirmedPositionSummary";
export const dynamic = "force-dynamic";
export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await requireServerPageSession("/goals");
  const [state, trajectory, position, query] = await Promise.all([
    createCoreDecisioningServiceFromEnv().readGoalState(session),
    createFinancialVaultServiceFromEnv().getTrajectory(session),
    createFinancialPositionReadServiceFromEnv().read(session),
    searchParams,
  ]);
  return (
    <AppShell active="workspace">
      <GoalsPlanningClient
        initialSnapshot={state.snapshot}
        initialGoals={state.goals}
        initialScenarios={state.scenarios}
        initialTrajectory={trajectory}
        netWorth={confirmedPositionSummary(position).netPosition}
        openRetirement={query.edit === "retirement"}
      />
    </AppShell>
  );
}
