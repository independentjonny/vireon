import { NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import {
  computeMerchantVariants,
  computeMerchantConfidence,
  computeCleanupEntries,
} from "@/lib/services/merchantService";
import { createTransactionsSubscriptionsServiceFromEnv, toSafeTransactionsError } from "@/server/services/transactionsSubscriptionsPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "read:transactions");
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const txs = (await createTransactionsSubscriptionsServiceFromEnv().listTransactions(auth.session)).transactions;
    const variants = computeMerchantVariants(txs);
    const confidence = computeMerchantConfidence(txs);
    const cleanup = computeCleanupEntries(txs);

    return NextResponse.json({
      ok: true,
      duplicateMerchants: variants,
      confidence,
      cleanup: cleanup.slice(0, 20),
      stats: {
        total: cleanup.length,
        duplicates: variants.length,
      },
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    const safe = toSafeTransactionsError(err);
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
