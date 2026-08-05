import { betaSafeError, buildPrivateBetaContext, getRequestSession, toBetaSession } from "@/lib/privateBetaRuntime";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const context = await buildPrivateBetaContext(toBetaSession(session));
    return Response.json({
      ok: true,
      briefing: context.briefing,
      health: context.health,
      forecast: context.forecast,
      goals: context.goals,
      provenance: context.provenance,
      readiness: context.readiness,
    });
  } catch (error) {
    return Response.json({ ok: false, ...betaSafeError(error) }, { status: 500 });
  }
}
