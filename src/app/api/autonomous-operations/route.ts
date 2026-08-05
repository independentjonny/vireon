import { NextResponse } from "next/server";
import { AutonomousOperationsEngine } from "@/lib/autonomousOperations";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = AutonomousOperationsEngine.build();
  return NextResponse.json({
    ok: true,
    generatedAt: state.generatedAt,
    supervisor: state.supervisor,
    goals: state.goals,
    plans: state.plans,
    tasks: state.tasks,
    workers: state.workers,
    workerResults: state.workerResults,
    executiveBriefing: state.executiveBriefing,
    knowledgeHealth: state.knowledgeHealth,
    metrics: state.metrics,
    safety: state.safety,
  });
}
