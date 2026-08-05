import type { NextRequest } from "next/server";
import { providersResponse } from "../_helpers.ts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return providersResponse(request);
}
