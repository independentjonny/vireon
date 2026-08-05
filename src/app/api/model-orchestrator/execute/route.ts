import type { NextRequest } from "next/server";
import { executeFromRequest } from "../_helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return executeFromRequest(request);
}
