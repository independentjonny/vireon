import { NextRequest, NextResponse } from "next/server";
import {
  getCopilotHistory,
  appendCopilotHistory,
  type CopilotHistoryEntry,
} from "@/lib/localStore";
import { hasLocalData } from "@/lib/localStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const history = getCopilotHistory();
    return NextResponse.json({
      ok: true,
      history: history.slice(-20).reverse(),
      total: history.length,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, answer } = body as { question?: string; answer?: string };
    if (!question || !answer) {
      return NextResponse.json(
        { ok: false, error: "question and answer required" },
        { status: 400 }
      );
    }
    const counts = hasLocalData();
    const entry: CopilotHistoryEntry = {
      id: `ch-${Date.now()}`,
      question,
      answer,
      askedAt: new Date().toISOString(),
      context: { transactions: counts.transactions, subscriptions: counts.subscriptions },
    };
    appendCopilotHistory(entry);
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
