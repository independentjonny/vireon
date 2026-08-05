import AppShell from "../components/AppShell";
import ActionWorkflowsClient from "../components/ActionWorkflowsClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function ActionWorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ decisionId?: string }>;
}) {
  const session = await requireServerPageSession();
  const state = await createCoreDecisioningServiceFromEnv().readWorkflows(session);
  const params = await searchParams;
  const initialWorkflowId = params.decisionId ? `workflow-${params.decisionId}` : undefined;

  return (
    <AppShell active="workspace">
      <ActionWorkflowsClient initialWorkflows={state.workflows} initialExecutions={state.executions} summary={state.summary} lastSyncedAt={state.lastSyncedAt} initialWorkflowId={initialWorkflowId} />
    </AppShell>
  );
}
