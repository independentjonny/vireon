import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { getRolePermissions } from "@/lib/auth/rbac";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);

  return Response.json({
    ok: true,
    mode: process.env.VIREON_DEV_AUTH_BYPASS === "true" ? "dev-bypass" : "supabase",
    session: auth.session,
    rbac: {
      role: auth.session.role,
      permissions: getRolePermissions(auth.session.role),
    },
  });
}
