import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import { createTransactionsSubscriptionsServiceFromEnv, toSafeTransactionsError } from "@/server/services/transactionsSubscriptionsPostgresService";
import type { SubscriptionRecord } from "@/lib/persistence/schema";

function validCadence(value: unknown): value is SubscriptionRecord["cadence"] {
  return value === "monthly" || value === "quarterly" || value === "annual";
}

export async function GET(request: Request) {
  const auth = await requirePermission(request, "read:subscriptions");
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const service = createTransactionsSubscriptionsServiceFromEnv();
    return Response.json({ ok: true, ...(await service.listSubscriptions(auth.session)) });
  } catch (error) {
    const safe = toSafeTransactionsError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "write:subscriptions");
  if (!auth.ok) return authErrorResponse(auth);

  let body: { merchant?: string; amount?: number; cadence?: string; workspaceId?: string; userId?: string; transactionId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.workspaceId === "string" || typeof body.userId === "string") {
    return Response.json({ ok: false, error: "Client-supplied ownership fields are not accepted." }, { status: 403 });
  }
  if (!body.merchant || !Number.isFinite(body.amount) || Number(body.amount) <= 0) {
    return Response.json({ ok: false, error: "merchant and positive amount are required" }, { status: 400 });
  }
  const cadence = validCadence(body.cadence) ? body.cadence : "monthly";

  try {
    const service = createTransactionsSubscriptionsServiceFromEnv();
    const subscription = await service.addSubscription(auth.session, {
      merchant: body.merchant,
      amount: Number(body.amount),
      cadence,
      transactionId: body.transactionId ?? null,
      idempotencyKey: request.headers.get("idempotency-key"),
    });
    const annualisedCost = cadence === "monthly" ? subscription.amount * 12 : cadence === "quarterly" ? subscription.amount * 4 : subscription.amount;
    return Response.json({
      ok: true,
      storageMode: "postgres",
      subscription: { ...subscription, annualisedCost },
      persisted: true,
      persistMessage: `Subscription for ${subscription.merchant} persisted to PostgreSQL.`,
    }, { status: 201 });
  } catch (error) {
    const safe = toSafeTransactionsError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "write:subscriptions");
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const service = createTransactionsSubscriptionsServiceFromEnv();
    const result = await service.archiveAllSubscriptions(auth.session);
    return Response.json({ ok: true, archivedCount: result.archivedCount, message: `Archived ${result.archivedCount} subscription(s).` });
  } catch (error) {
    const safe = toSafeTransactionsError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}
