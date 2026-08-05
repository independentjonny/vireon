import AppShell from "../components/AppShell";
import AiCfoClient from "../components/AiCfoClient";
import { AICfoOrchestrator } from "@/lib/aiCfo";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function AiCfoPage() {
  const session = await requireServerPageSession();
  const core = createCoreDecisioningServiceFromEnv();
  const inputs = await core.readAICfoInputs(session);
  const aiCfoState = await core.readAICfoState(session);
  const initialResult = AICfoOrchestrator.run(inputs, {
    userQuery: "What should I do next?",
    workspaceContext: "dashboard",
    selectedScenarioId: "current",
    riskTolerance: "medium",
    timeHorizon: 30,
  });
  const dailyReview = await core.getLatestDailyReview(session);

  return (
    <AppShell active="ai-cfo">
      <AiCfoClient initialResult={initialResult} persistedHistory={aiCfoState.history} inputs={inputs} dailyReview={dailyReview} />
    </AppShell>
  );
}
