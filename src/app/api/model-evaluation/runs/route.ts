import { NextResponse } from "next/server";
import { evaluationRepository } from "@/lib/modelEvaluation/store";
import { runEvaluation } from "@/lib/modelEvaluation/runner";
import { developerOnly, jsonError } from "../_helpers";
import type { EvaluationExecutionMode } from "@/lib/modelEvaluation/types";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const blocked = developerOnly(request);
  if (blocked) return blocked;
  return NextResponse.json({ runs: evaluationRepository.listRuns() });
}

export async function POST(request: Request) {
  const blocked = developerOnly(request);
  if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid evaluation request.");
  const liveRequested = body.executionMode === "live-single-provider" || body.executionMode === "live-multi-provider";
  const run = await runEvaluation({
    suiteId: typeof body.suiteId === "string" ? body.suiteId : undefined,
    provider: typeof body.provider === "string" ? body.provider : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    promptVersion: typeof body.promptVersion === "string" ? body.promptVersion : undefined,
    workerVersion: typeof body.workerVersion === "string" ? body.workerVersion : undefined,
    executionMode: typeof body.executionMode === "string" ? body.executionMode as EvaluationExecutionMode : "offline-mock",
    maximumFixtures: typeof body.maximumFixtures === "number" ? body.maximumFixtures : undefined,
    liveProviderOptIn: liveRequested && process.env.VIREON_LIVE_MODEL_EVALUATION === "true",
    includeApprovedAnonymised: body.includeApprovedAnonymised === true,
  });
  return NextResponse.json({ run }, { status: run.status === "blocked" ? 409 : 201 });
}
