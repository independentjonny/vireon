import AppShell from "../../components/AppShell";
import DailyReviewClient from "../../components/DailyReviewClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function DailyReviewPage({ searchParams }: { searchParams: Promise<{ reviewId?: string }> }) {
  const session = await requireServerPageSession();
  const params = await searchParams;
  const service = createCoreDecisioningServiceFromEnv();
  const state = await service.readDailyReviews(session);
  const requestedRecord = params.reviewId
    ? state.history.find((item) => item.review.id === params.reviewId)
    : undefined;
  const record = requestedRecord ?? state.history[0] ?? await service.getLatestDailyReview(session);

  return (
    <AppShell active="ai-cfo">
      <DailyReviewClient
        record={record}
        settings={state.settings}
        lastSuccessfulReviewAt={state.lastSuccessfulReviewAt}
      />
    </AppShell>
  );
}
