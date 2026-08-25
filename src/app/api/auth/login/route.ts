import { getDevSession, requireSession } from "@/lib/auth/middleware";
export async function POST(request: Request) {
  let body: { email?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return Response.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }

  const devSession = (() => {
    try {
      return getDevSession(request);
    } catch {
      return null;
    }
  })();
  if (devSession) {
    return Response.json({
      ok: true,
      mode: "dev-bypass",
      session: { ...devSession, email: body.email },
      message: "Development authentication bypass is explicitly enabled for this loopback request.",
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return Response.json({ ok: false, error: "Authentication is not configured." }, { status: 500 });
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: "no-store",
    });
    const auth = (await authResponse.json()) as { access_token?: string; expires_in?: number };
    if (!authResponse.ok || !auth.access_token) {
      return Response.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }

    // Do not tell the browser that sign-in succeeded until the token is also a
    // valid Vireon workspace session. Otherwise the UI navigates to `/`, the
    // server rejects the incomplete membership, and the user is silently sent
    // back to the login screen.
    const verified = await requireSession(new Request(new URL("/__login_session_check", request.url), {
      headers: { authorization: `Bearer ${auth.access_token}` },
    }));
    if (!verified.ok) {
      const error = verified.status === 403
        ? "Your Vireon workspace access is not configured. Redeem your invitation or request access."
        : verified.status === 500
          ? "Authentication is configured incorrectly. Please contact support."
          : "The issued session could not be verified. Please try again.";
      return Response.json({ ok: false, error }, { status: verified.status });
    }

    const response = Response.json({ ok: true, mode: "supabase" });
    const maxAge = Math.max(60, Math.min(auth.expires_in ?? 3600, 60 * 60 * 24 * 7));
    response.headers.append(
      "set-cookie",
      `vireon_access_token=${encodeURIComponent(auth.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
    );
    return response;
  } catch {
    return Response.json({ ok: false, error: "Authentication service is unavailable." }, { status: 503 });
  }
}
