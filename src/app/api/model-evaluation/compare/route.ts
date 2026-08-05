import { NextResponse } from "next/server";
import { compareEvaluationRuns } from "@/lib/modelEvaluation/comparison";
import { evaluationRepository } from "@/lib/modelEvaluation/store";
import { developerOnly, jsonError } from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = developerOnly(request);
  if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.leftRunId !== "string" || typeof body.rightRunId !== "string") {
    return jsonError("Provide leftRunId and rightRunId.");
  }
  const left = evaluationRepository.getRun(body.leftRunId);
  const right = evaluationRepository.getRun(body.rightRunId);
  if (!left || !right) return NextResponse.json({ error: "One or more evaluation runs were not found." }, { status: 404 });
  return NextResponse.json({ comparison: compareEvaluationRuns(left, right) });
}
