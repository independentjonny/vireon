import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);

  return Response.json({
    ok: false,
    error: "Runtime scheduler introspection is disabled through this API.",
  }, { status: 410 });
}
