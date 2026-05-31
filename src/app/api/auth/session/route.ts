import { getDevSession } from "@/lib/auth/middleware";
import { supabaseServerConfigured } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!supabaseServerConfigured) {
    const session = getDevSession();
    return Response.json({
      ok: true,
      mode: "dev",
      session,
      rbac: {
        role: session.role,
        permissions: [
          "read:transactions",
          "write:transactions",
          "read:subscriptions",
          "write:subscriptions",
          "read:insights",
          "write:insights",
          "read:roadmap",
          "write:roadmap",
          "read:telemetry",
          "write:telemetry",
          "manage:users",
          "manage:workspace",
          "manage:billing",
          "read:memory",
          "write:memory",
          "invoke:agents",
        ],
      },
      message:
        "Development session active — set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY for production auth",
    });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { ok: false, error: "Missing Authorization header", mode: "production" },
      { status: 401 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "Install @supabase/ssr and implement JWT verification via verifySupabaseToken()",
      mode: "production",
    },
    { status: 501 }
  );
}
