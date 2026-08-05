import AppShell from "../../components/AppShell";
import DailyReviewClient from "../../components/DailyReviewClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function DailyReviewPage() {
  const session = await requireServerPageSession();
  const service = createCoreDecisioningServiceFromEnv();
  const state = await service.readDailyReviews(session);
  const record = state.history[0] ?? await service.getLatestDailyReview(session);

  return (
    <AppShell active="ai-cfo">
      <DailyReviewClient record={record} settings={state.settings} lastSuccessfulReviewAt={state.lastSuccessfulReviewAt} />
    </AppShell>
  );
}
