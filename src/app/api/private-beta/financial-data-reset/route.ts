import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createFinancialDataResetServiceFromEnv } from "@/server/services/financialDataResetPostgresService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const service = createFinancialDataResetServiceFromEnv();
  try {
    const body = await request.json().catch(() => ({})) as { confirmation?: string };
    const result = await service.reset(auth.session, body.confirmation ?? "");
    return Response.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    const safe = service.toSafeError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}
