import {
  getPromotionRecord,
  getPromotionSummary,
  initPromotion,
  promoteRelease,
  approveForProduction,
  rollbackPromotion,
  PromotionState,
} from "@/lib/releasePromotion";
import { getGitState } from "@/lib/runtimeControl";

export const dynamic = "force-dynamic";

export async function GET() {
  const record = getPromotionRecord();
  const summary = getPromotionSummary();
  return Response.json({ ok: true, record, summary });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      to?: PromotionState;
      by?: string;
      note?: string;
    };

    const action = body.action?.trim();
    const by = body.by?.trim() ?? "api";
    const note = body.note?.trim() ?? "";
    const gitState = getGitState();
    const gitRef = gitState.lastCommit?.hash ?? "HEAD";

    if (action === "init") {
      const record = initPromotion(gitRef);
      return Response.json({ ok: true, record });
    }

    if (action === "promote") {
      const to = body.to;
      if (!to) return Response.json({ ok: false, error: "'to' state required for promote action" }, { status: 400 });
      const result = promoteRelease(to, by, gitRef, note);
      return Response.json({ ok: result.ok, record: result.record, error: result.error });
    }

    if (action === "approve-production") {
      const record = approveForProduction(by);
      return Response.json({ ok: true, record });
    }

    if (action === "rollback") {
      const result = rollbackPromotion(by, note || "Manual rollback via API");
      return Response.json({ ok: result.ok, record: result.record, error: result.error });
    }

    return Response.json({ ok: false, error: "Unknown action. Use: init, promote, approve-production, rollback." }, { status: 400 });
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
