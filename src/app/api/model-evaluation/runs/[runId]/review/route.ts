import { NextResponse } from "next/server";
import { developerOnly } from "../../../_helpers";
import { buildLiveReviewSummary, REVIEWED_LIVE_RUN_ID } from "@/lib/modelEvaluation/liveReviewSummary";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const blocked = developerOnly(request);
  if (blocked) return blocked;
  const { runId } = await params;
  if (runId !== REVIEWED_LIVE_RUN_ID) {
    return NextResponse.json({ error: "Live review report not found for this run." }, { status: 404 });
  }
  return NextResponse.json({ report: buildLiveReviewSummary() });
}
