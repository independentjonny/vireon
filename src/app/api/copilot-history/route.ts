import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    const result = await service.readCopilotHistory(auth.session, 20);
    return NextResponse.json({
      ok: true,
      history: result.history,
      total: result.total,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return authErrorResponse(auth);
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    const body = await req.json().catch(() => ({}));
    const { question, answer } = body as { question?: string; answer?: string };
    const entry = await service.appendCopilotHistory(auth.session, {
      question: String(question ?? ""),
      answer: String(answer ?? ""),
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
