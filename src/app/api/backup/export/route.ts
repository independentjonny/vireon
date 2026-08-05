import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);
  return Response.json(
    {
      ok: false,
      code: "OPERATIONAL_BACKUP_EXPORT_DISABLED",
      error: "Operational backup export is not available through the application API. Use the PostgreSQL operator backup and rollback procedure instead.",
    },
    { status: 410 },
  );
}
