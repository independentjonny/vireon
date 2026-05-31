/**
 * Supabase browser client.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * These must be set in Cloudflare Pages / Vercel env vars before enabling auth.
 */

export type SupabaseClientStub = {
  auth: {
    getSession: () => Promise<{ data: { session: null }; error: null }>;
    signInWithPassword: (opts: { email: string; password: string }) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
  };
  from: (table: string) => {
    select: (cols?: string) => Promise<{ data: unknown[]; error: null }>;
  };
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export function getSupabaseClientConfig() {
  return {
    url: SUPABASE_URL || "https://<project-ref>.supabase.co",
    anonKey: SUPABASE_ANON_KEY || "<your-anon-key>",
    configured: supabaseConfigured,
  };
}

export function createBrowserClient(): SupabaseClientStub {
  if (!supabaseConfigured) {
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithPassword: async () => ({ error: "Supabase not configured" }),
        signOut: async () => {},
      },
      from: () => ({
        select: async () => ({ data: [], error: null }),
      }),
    };
  }

  throw new Error(
    "Install @supabase/ssr and call createBrowserClient(url, key) once NEXT_PUBLIC_SUPABASE_URL is set."
  );
}
