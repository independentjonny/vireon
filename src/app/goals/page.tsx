import AppShell from "../components/AppShell";
import GoalsPlanningClient from "../components/GoalsPlanningClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const session = await requireServerPageSession();
  const state = await createCoreDecisioningServiceFromEnv().readGoalState(session);

  return (
    <AppShell active="workspace">
      <GoalsPlanningClient initialSnapshot={state.snapshot} initialGoals={state.goals} initialScenarios={state.scenarios} />
    </AppShell>
  );
}
