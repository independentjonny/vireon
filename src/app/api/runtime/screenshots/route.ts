import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);

  return Response.json({
    ok: false,
    error: "Direct runtime screenshot filesystem access is disabled.",
    replacement: "/api/runtime/screenshot",
  }, { status: 410 });
}
