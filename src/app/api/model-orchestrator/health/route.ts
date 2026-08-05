import type { NextRequest } from "next/server";
import { healthResponse } from "../_helpers.ts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return await healthResponse(request);
}
