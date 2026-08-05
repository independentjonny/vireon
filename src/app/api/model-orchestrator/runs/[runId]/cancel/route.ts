import type { NextRequest } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import { serverUser } from "../../../_helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const auth = await requirePermission(request, "invoke:agents");
  if (!auth.ok) return authErrorResponse(auth);
  const user = serverUser(auth.session);
  return Response.json({
    ok: true,
    runId,
    userId: user.userId,
    status: "cancel-request-recorded",
    note: "Local v1 adapters complete synchronously; live provider cancellation will use adapter cancel hooks.",
  });
}
