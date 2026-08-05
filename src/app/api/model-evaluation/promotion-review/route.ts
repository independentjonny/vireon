import { NextResponse } from "next/server";
import { createPromotionDecision } from "@/lib/modelEvaluation/promotion";
import { evaluationRepository } from "@/lib/modelEvaluation/store";
import { developerOnly, jsonError } from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = developerOnly(request);
  if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.runId !== "string") return jsonError("Provide runId.");
  const run = evaluationRepository.getRun(body.runId);
  if (!run) return NextResponse.json({ error: "Evaluation run not found." }, { status: 404 });
  const decision = createPromotionDecision(run);
  return NextResponse.json({ decision });
}
