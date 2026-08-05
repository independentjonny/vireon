import { NextRequest, NextResponse } from "next/server";
import type { AiDecisionStatus } from "@/lib/aiDecisionCentre";
import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    return NextResponse.json({ ok: true, ...(await service.readDecisionCentre(current)) });
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    const body = (await request.json().catch(() => ({}))) as { decisionId?: string; status?: AiDecisionStatus };
    if (!body.decisionId || !body.status || !["New", "Reviewed", "Actioned", "Dismissed"].includes(body.status)) {
      return NextResponse.json({ ok: false, error: "Invalid decision status request" }, { status: 422 });
    }
    return NextResponse.json({ ok: true, states: await service.updateDecisionStatus(current, body.decisionId, body.status) });
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
