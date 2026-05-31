import { getOrchestratorState, getOrchestratorSummary, runNextQueuedJob } from "@/lib/buildOrchestrator";
import { getNextQueuedJob } from "@/lib/buildQueue";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getOrchestratorState();
  const summary = getOrchestratorSummary();
  const nextJob = getNextQueuedJob();
  return Response.json({ ok: true, state, summary, nextQueuedJob: nextJob ?? null });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: string };
    const action = body.action?.trim();
    if (action === "run-next") {
      const result = runNextQueuedJob();
      if (!result) {
        return Response.json({ ok: true, message: "No queued jobs to run", result: null });
      }
      return Response.json({ ok: true, result });
    }
    return Response.json({ ok: false, error: "Unknown action. Use action=run-next." }, { status: 400 });
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
