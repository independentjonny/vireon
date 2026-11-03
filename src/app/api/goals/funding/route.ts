import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createGoalFundingServiceFromEnv, GoalFundingError } from "@/server/services/goalFundingPostgresService";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await requireSession(request); if (!auth.ok) return authErrorResponse(auth);
  try { return Response.json({ ok: true, workspace: await createGoalFundingServiceFromEnv().read(auth.session) }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const auth = await requireSession(request); if (!auth.ok) return authErrorResponse(auth);
  try {
    const text = await request.text(); if (text.length > 300_000) throw new GoalFundingError("Funding plan is too large.", 413);
    const input = JSON.parse(text);
    if (!input || Object.keys(input).some(key => !["action", "plan", "expectedRevision", "requestId", "name"].includes(key))) throw new GoalFundingError("Unsupported funding-plan fields.");
    return Response.json({ ok: true, workspace: await createGoalFundingServiceFromEnv().save(auth.session, input) });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  const known = error instanceof GoalFundingError;
  return Response.json({ ok: false, error: known ? error.message : error instanceof SyntaxError ? "Invalid funding-plan JSON." : "The funding plan could not be loaded or saved. No local fallback was used." }, { status: known ? error.status : error instanceof SyntaxError ? 422 : 503 });
}
