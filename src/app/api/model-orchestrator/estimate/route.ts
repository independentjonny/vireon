import type { NextRequest } from "next/server";
import { estimateFromRequest } from "../_helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return estimateFromRequest(request);
}
