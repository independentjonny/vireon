/**
 * Supabase server/RSC client.
 * Requires SUPABASE_SERVICE_ROLE_KEY (server-only, never expose to browser).
 * Set in Cloudflare Pages / Vercel env vars before enabling server-side auth.
 */

export type SupabaseServerConfig = {
  url: string;
  serviceRoleKey: string;
  configured: boolean;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseServerConfigured =
  SUPABASE_URL.length > 0 && SERVICE_ROLE_KEY.length > 0;

export function getSupabaseServerConfig(): SupabaseServerConfig {
  return {
    url: SUPABASE_URL || "https://<project-ref>.supabase.co",
    serviceRoleKey: SERVICE_ROLE_KEY ? "[redacted]" : "<your-service-role-key>",
    configured: supabaseServerConfigured,
  };
}

export type ServerAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string };

export async function verifySupabaseToken(
  _authorizationHeader: string | null
): Promise<ServerAuthResult> {
  if (!supabaseServerConfigured) {
    return {
      ok: false,
      error: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  return {
    ok: false,
    error: "Install @supabase/ssr and implement JWT verification once credentials are set.",
  };
}
