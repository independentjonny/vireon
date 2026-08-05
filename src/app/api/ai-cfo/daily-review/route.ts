import { NextRequest, NextResponse } from "next/server";
import type { DailyReviewMode, DailyReviewSettings } from "@/lib/aiCfoDailyReview";
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
    return NextResponse.json(await service.readDailyReviews(current));
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  const body = (await request.json().catch(() => ({}))) as {
    mode?: DailyReviewMode;
    settings?: Partial<DailyReviewSettings>;
    gptSummaryDraft?: string;
  };
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    const mode = body.mode ?? "live";
    const demoModeAllowed = process.env.VIREON_ALLOW_DAILY_REVIEW_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
    if (mode !== "live" && !demoModeAllowed) {
      return NextResponse.json({ ok: false, error: "Daily Review demo modes are disabled for live persistence.", code: "DEMO_MODE_DISABLED" }, { status: 403 });
    }
    service = createCoreDecisioningServiceFromEnv();
    return NextResponse.json(await service.runAndPersistDailyReview(current, {
      mode,
      settings: body.settings,
      gptSummaryDraft: body.gptSummaryDraft ?? null,
      engineFailures: mode === "partial-failure-demo" ? [{ engine: "Investments", reason: "Partial engine failure demo", recovered: true }] : undefined,
    }));
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
