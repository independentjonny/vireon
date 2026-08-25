import AppShell from "../components/AppShell";
import GoalsPlanningClient from "../components/GoalsPlanningClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const session = await requireServerPageSession();
  const service = createCoreDecisioningServiceFromEnv();
  await service.ensureDefaultRetirementGoal(session);
  const state = await service.readGoalState(session);

  return (
    <AppShell active="workspace">
      <GoalsPlanningClient initialSnapshot={state.snapshot} initialGoals={state.goals} initialScenarios={state.scenarios} />
    </AppShell>
  );
}
