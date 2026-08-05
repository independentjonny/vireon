import { betaSafeError, getRequestSession, toBetaSession } from "@/lib/privateBetaRuntime";
import { PrivateBetaFoundation, type FeedbackType } from "@/lib/privateBetaFoundation";

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const betaSession = toBetaSession(session);
    const body = await request.json() as { type?: FeedbackType; page?: string; feature?: string; description?: string; screenshotAttached?: boolean };
    const feedback = PrivateBetaFoundation.mutateState((state) => {
      const record = PrivateBetaFoundation.createFeedback(betaSession, {
        type: body.type ?? "general",
        page: body.page ?? "unknown",
        feature: body.feature ?? "private-beta",
        description: body.description,
        screenshotAttached: body.screenshotAttached,
      });
      state.feedback.push(record);
      state.audit.push(PrivateBetaFoundation.createAuditEvent(betaSession, { eventType: "feedback.created", affectedResource: record.id, outcome: "success", metadata: { type: record.type, page: record.page } }));
      return record;
    });
    return Response.json({ ok: true, feedback });
  } catch (error) {
    return Response.json({ ok: false, ...betaSafeError(error) }, { status: 500 });
  }
}
