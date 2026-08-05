import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import { createTransactionsSubscriptionsServiceFromEnv, toSafeTransactionsError } from "@/server/services/transactionsSubscriptionsPostgresService";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "read:transactions");
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const service = createTransactionsSubscriptionsServiceFromEnv();
    return Response.json({ ok: true, ...(await service.listTransactions(auth.session)) });
  } catch (error) {
    const safe = toSafeTransactionsError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "write:transactions");
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const service = createTransactionsSubscriptionsServiceFromEnv();
    const result = await service.archiveAllTransactions(auth.session);
    return Response.json({ ok: true, archivedCount: result.archivedCount, message: `Archived ${result.archivedCount} transaction(s).` });
  } catch (error) {
    const safe = toSafeTransactionsError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}
