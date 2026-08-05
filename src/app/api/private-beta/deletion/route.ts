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
    return Response.json({ ok: true, deletionRequests: await service.listDeletionRequests(auth.session) });
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
    const body = await request.json().catch(() => ({})) as { confirmation?: string };
    const deletion = await service.requestAccountDeletion(auth.session, body.confirmation ?? "", idempotencyKey(request));
    return Response.json({ ok: true, deletion, destructiveLiveExecutionRequiresHumanApproval: true }, { status: 202 });
  } catch (error) {
    const safe = service.toSafeError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}
