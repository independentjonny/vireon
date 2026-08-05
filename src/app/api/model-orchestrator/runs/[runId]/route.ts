import type { NextRequest } from "next/server";
import { runResponse } from "../../_helpers.ts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return await runResponse(request, runId);
}
