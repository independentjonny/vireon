import { NextResponse } from "next/server";
import { buildCalibrationReport } from "@/lib/modelEvaluation/calibration";
import { evaluationRepository } from "@/lib/modelEvaluation/store";
import { developerOnly } from "../_helpers";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const blocked = developerOnly(request);
  if (blocked) return blocked;
  const latestRun = evaluationRepository.listRuns()[0];
  if (!latestRun) return NextResponse.json({ reports: [] });
  return NextResponse.json({ reports: [buildCalibrationReport(latestRun)] });
}
