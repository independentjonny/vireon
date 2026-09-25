type Diagnostic = { action: "request" | "update"; category: "configuration" | "provider" | "network"; status?: number; code: string; providerHost?: string };
type Options = { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; diagnostic?: (event: Diagnostic) => void };
// Only fixed classifications and public Supabase hostnames are logged: never messages, email, credentials, or full URLs.
const providerCodes = new Set(["unexpected_failure", "over_email_send_rate_limit", "email_address_not_authorized", "email_provider_disabled", "captcha_failed", "request_timeout", "validation_failed", "user_not_found", "email_not_found"]);
const message = "If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export function recoveryRedirect(requestUrl: string, env: NodeJS.ProcessEnv) {
  const configured = env.VIREON_PASSWORD_RESET_ORIGIN || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined) || env.VIREON_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL;
  const url = new URL(configured || requestUrl);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!configured && (env.NODE_ENV === "production" || !loopback)) || (!loopback && url.protocol !== "https:") || url.username || url.password) throw new Error("RECOVERY_ORIGIN_UNAVAILABLE");
  return `${url.origin}/login/reset-password`;
}

export async function handlePasswordRecovery(request: Request, action: "request" | "update", options: Options = {}) {
  const env = options.env ?? process.env, fetchImpl = options.fetchImpl ?? fetch;
  const diagnostic = options.diagnostic ?? ((event: Diagnostic) => console.warn("password_recovery_failure", event));
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ ok: false, error: "Please submit this form from Vireon." }, 403);
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 8192) return json({ ok: false, error: "Request is too large." }, 413);
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid body");
    body = value;
  } catch { return json({ ok: false, error: "Please check the form and try again." }, 400); }
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, ""), key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    diagnostic({ action, category: "configuration", code: "missing_auth_configuration" });
    return json({ ok: false, error: "Password recovery is not configured. Please contact support." }, 503);
  }
  try {
    if (action === "request") {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);
      const redirect = recoveryRedirect(request.url, env);
      const response = await fetchImpl(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, { method: "POST", headers: { apikey: key, "content-type": "application/json" }, body: JSON.stringify({ email }), cache: "no-store", signal: AbortSignal.timeout(15000) });
      const failure = !response.ok ? await response.json().catch(() => ({})) as { code?: string } : {};
      if (!response.ok) diagnostic({ action, category: "provider", status: response.status, code: failure.code && providerCodes.has(failure.code) ? failure.code : "unclassified_provider_error" });
      if (response.status === 429) return json({ ok: false, error: "Too many reset requests. Please wait a few minutes and try again." }, 429);
      if (response.status >= 500 || response.status === 401 || response.status === 403) return json({ ok: false, error: "The password-reset service is unavailable. Please try again later." }, 503);
      if (!response.ok) {
        if (failure.code !== "user_not_found" && failure.code !== "email_not_found") return json({ ok: false, error: "The reset email could not be sent. Please try again later." }, 503);
      }
      // Never reveal whether the email belongs to an account.
      return json({ ok: true, message });
    }
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ") || authorization.length < 12 || authorization.length > 6000) return json({ ok: false, error: "This reset link is invalid or expired. Request a new link." }, 401);
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 10 || password.length > 128) return json({ ok: false, error: "Use a password between 10 and 128 characters." }, 400);
    if (password !== body.confirmPassword) return json({ ok: false, error: "Passwords do not match." }, 400);
    // Supabase validates the token; no admin key, workspace grant, or bypass is used.
    const response = await fetchImpl(`${url}/auth/v1/user`, { method: "PUT", headers: { apikey: key, authorization, "content-type": "application/json" }, body: JSON.stringify({ password }), cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) return json({ ok: false, error: response.status === 401 || response.status === 403 ? "This reset link is invalid or expired. Request a new link." : response.status === 422 ? "Choose a different password that meets your account’s password requirements." : "The password could not be changed. Please try again or request a new link." }, response.status >= 500 ? 503 : response.status === 401 || response.status === 403 ? 401 : 400);
    const result = json({ ok: true, message: "Your password has been changed. Sign in with your new password." });
    for (const name of ["vireon_access_token", "sb-access-token", "supabase_access_token"]) result.headers.append("set-cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return result;
  } catch (error) {
    const cause = error instanceof Error ? (error.cause as { code?: string } | undefined)?.code : undefined;
    const code = error instanceof Error && error.message === "RECOVERY_ORIGIN_UNAVAILABLE" ? "invalid_callback_configuration"
      : cause === "ERR_INVALID_URL" || (error instanceof TypeError && error.message === "Invalid URL") ? "invalid_auth_url"
      : error instanceof Error && error.name === "TimeoutError" ? "provider_timeout"
      : cause && ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "CERT_HAS_EXPIRED"].includes(cause) ? cause : "provider_connection_failed";
    let providerHost: string | undefined;
    try { const host = new URL(url).hostname; if (/^[a-z0-9]{20}\.supabase\.co$/.test(host)) providerHost = host; } catch { /* Invalid configuration is classified above. */ }
    diagnostic({ action, category: code.startsWith("invalid_") ? "configuration" : "network", code, ...(providerHost ? { providerHost } : {}) });
    return json({ ok: false, error: "The password-reset service is unavailable. Please try again later." }, 503);
  }
}
