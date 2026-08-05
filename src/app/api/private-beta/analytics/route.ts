import { BetaHardening } from "@/lib/betaHardening";
import { PrivateBetaFoundation } from "@/lib/privateBetaFoundation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const event = BetaHardening.validateAnalyticsPayload(payload, PrivateBetaFoundation.configFromEnv());
    const audit = PrivateBetaFoundation.createAuditEvent(
      { userId: "analytics-system", householdId: "analytics-system", expiresAt: "2099-01-01T00:00:00.000Z" },
      { eventType: "analytics.accepted", affectedResource: event.name, outcome: "success", actor: "system", metadata: { page: event.page, feature: event.feature, betaCohort: event.betaCohort } }
    );
    return Response.json({ ok: true, event, auditReference: audit.referenceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ANALYTICS_REJECTED";
    return Response.json({ ok: false, error: "ANALYTICS_REJECTED", reason: message }, { status: 400 });
  }
}
