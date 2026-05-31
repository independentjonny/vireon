import { supabaseConfigured } from "@/lib/supabase/client";
import { getDevSession } from "@/lib/auth/middleware";

export async function POST(request: Request) {
  let body: { email?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.email) {
    return Response.json({ ok: false, error: "email is required" }, { status: 400 });
  }

  if (!supabaseConfigured) {
    const session = getDevSession();
    return Response.json({
      ok: true,
      mode: "dev",
      session: { ...session, email: body.email },
      message:
        "Dev mode login — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable real authentication",
    });
  }

  return Response.json(
    {
      ok: false,
      error:
        "Install @supabase/ssr and call createBrowserClient().auth.signInWithPassword()",
      mode: "production",
    },
    { status: 501 }
  );
}
