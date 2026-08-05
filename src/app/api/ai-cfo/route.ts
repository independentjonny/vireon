import { AICfoOrchestrator } from "@/lib/aiCfo";
import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  const body = await req.json().catch(() => ({}));
  const userQuery = String(body.userQuery || body.prompt || "What should I do next?");
  const workspaceContext = String(body.workspaceContext || "dashboard");
  const selectedScenarioId = String(body.selectedScenarioId || "current");
  const riskTolerance = body.riskTolerance === "low" || body.riskTolerance === "high" ? body.riskTolerance : "medium";
  const timeHorizon = Number.isFinite(Number(body.timeHorizon)) ? Number(body.timeHorizon) : 30;

  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    const { result, state } = await service.runAndPersistAICfo(current, { userQuery, workspaceContext, selectedScenarioId, riskTolerance, timeHorizon });
    return Response.json({ ok: true, result, persistedCounts: {
      history: state.history.length,
      decisions: state.decisions.length,
      timelineEvents: state.timelineEvents.length,
      adviserBriefs: state.adviserBriefs.length,
    } });
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return Response.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    route: "/api/ai-cfo",
    promptSuggestions: AICfoOrchestrator.suggestedPrompts("dashboard"),
  });
}
