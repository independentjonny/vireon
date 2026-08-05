import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import { createTransactionsSubscriptionsServiceFromEnv, toSafeTransactionsError } from "@/server/services/transactionsSubscriptionsPostgresService";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "read:subscriptions");
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const service = createTransactionsSubscriptionsServiceFromEnv();
    return Response.json({ ok: true, ...(await service.subscriptionIntelligence(auth.session)) });
  } catch (error) {
    const safe = toSafeTransactionsError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}
