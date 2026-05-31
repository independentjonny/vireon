import { initialLoopState, loopStatus } from "@/lib/engineeringLoop";

export async function GET() {
  const state = initialLoopState();
  return Response.json({
    ok: true,
    loop: loopStatus(state),
    state: {
      running: state.running,
      startedAt: state.startedAt,
      completedCount: state.completedCount,
      failedCount: state.failedCount,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const goals: string[] = Array.isArray(body.goals) ? body.goals : [];
  const state = initialLoopState(goals);
  return Response.json({
    ok: true,
    created: goals.length,
    loop: loopStatus(state),
  });
}
