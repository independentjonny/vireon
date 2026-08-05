import { BetaPilotOperations } from "@/lib/betaPilotOperations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const record = BetaPilotOperations.createSupportRecord({
      feature: String(payload.feature ?? "unknown"),
      errorCategory: String(payload.errorCategory ?? "general"),
      cohortId: typeof payload.cohortId === "string" ? payload.cohortId : undefined,
      safeDiagnostics: typeof payload.safeDiagnostics === "object" && payload.safeDiagnostics ? payload.safeDiagnostics : {},
      linkedFeedbackId: typeof payload.linkedFeedbackId === "string" ? payload.linkedFeedbackId : null,
    });
    return Response.json({ ok: true, record });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "SUPPORT_RECORD_FAILED" }, { status: 400 });
  }
}
