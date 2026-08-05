import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createPrivateBetaLifecycleServiceFromEnv } from "@/server/services/privateBetaLifecyclePostgresService";

export const dynamic = "force-dynamic";

function idempotencyKey(request: Request): string {
  const header = request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key") ?? "";
  return /^[a-zA-Z0-9._:-]{1,120}$/.test(header) ? header : "default";
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const service = createPrivateBetaLifecycleServiceFromEnv();
  try {
    return Response.json({ ok: true, exports: await service.listExports(auth.session) });
  } catch (error) {
    const safe = service.toSafeError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const service = createPrivateBetaLifecycleServiceFromEnv();
  try {
    return Response.json({ ok: true, export: await service.requestExport(auth.session, idempotencyKey(request)) }, { status: 202 });
  } catch (error) {
    const safe = service.toSafeError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}
