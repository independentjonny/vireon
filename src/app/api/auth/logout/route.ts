import { supabaseConfigured } from "@/lib/supabase/client";

export async function POST() {
  if (!supabaseConfigured) {
    return Response.json({
      ok: true,
      mode: "dev",
      message: "Dev session cleared",
    });
  }

  return Response.json(
    {
      ok: false,
      error:
        "Install @supabase/ssr and call createBrowserClient().auth.signOut()",
      mode: "production",
    },
    { status: 501 }
  );
}
