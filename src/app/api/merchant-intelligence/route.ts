import { NextResponse } from "next/server";
import { getLocalTransactions } from "@/lib/localStore";
import {
  computeMerchantVariants,
  computeMerchantConfidence,
  computeCleanupEntries,
} from "@/lib/services/merchantService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const txs = getLocalTransactions();
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
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
