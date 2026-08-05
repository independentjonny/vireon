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

export const supabaseServerConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getSupabaseServerConfig(): SupabaseServerConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    url: supabaseUrl || "https://<project-ref>.supabase.co",
    serviceRoleKey: serviceRoleKey ? "[redacted]" : "<your-service-role-key>",
    configured: Boolean(supabaseUrl && serviceRoleKey),
  };
}

export type ServerAuthResult =
  | { ok: true; user: VerifiedSupabaseUser }
  | { ok: false; error: string; status: 401 | 500 };

export type VerifiedSupabaseUser = {
  userId: string;
  email: string;
  appMetadata: Record<string, unknown>;
};

function bearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function verifySupabaseToken(
  authorizationHeader: string | null,
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {}
): Promise<ServerAuthResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const token = bearerToken(authorizationHeader);

  if (!token) {
    return { ok: false, status: 401, error: "Missing bearer token." };
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      error: "Authentication is not configured.",
    };
  }

  try {
    const response = await fetchImpl(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, status: 401, error: "Invalid or expired authentication token." };
    }

    const user = (await response.json()) as Record<string, unknown>;
    const userId = typeof user.id === "string" ? user.id : "";
    const email = typeof user.email === "string" ? user.email : "";
    const appMetadata =
      user.app_metadata && typeof user.app_metadata === "object" && !Array.isArray(user.app_metadata)
        ? (user.app_metadata as Record<string, unknown>)
        : {};

    if (!userId) {
      return { ok: false, status: 401, error: "Invalid authentication token." };
    }

    return { ok: true, user: { userId, email, appMetadata } };
  } catch {
    return { ok: false, status: 500, error: "Authentication service is unavailable." };
  }
}
