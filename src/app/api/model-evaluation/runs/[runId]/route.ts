import { NextResponse } from "next/server";
import { evaluationRepository } from "@/lib/modelEvaluation/store";
import { developerOnly } from "../../_helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const blocked = developerOnly(request);
  if (blocked) return blocked;
  const { runId } = await params;
  const run = evaluationRepository.getRun(runId);
  if (!run) return NextResponse.json({ error: "Evaluation run not found." }, { status: 404 });
  return NextResponse.json({ run });
}
