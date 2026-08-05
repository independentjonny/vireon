import { NextResponse } from "next/server";
import { listEvaluationSuites, runFixtureValidation } from "@/lib/modelEvaluation/runner";
import { developerOnly } from "../_helpers";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const blocked = developerOnly(request);
  if (blocked) return blocked;
  return NextResponse.json({ suites: listEvaluationSuites(), validation: runFixtureValidation() });
}
