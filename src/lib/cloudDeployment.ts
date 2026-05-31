export function cloudDeploymentReadiness() {
  return {
    frontend: "Cloudflare Pages ready",
    api: "Next.js API routes ready",
    database: "Supabase/Postgres ready",
    requiredEnv: [
      "DATABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ],
  };
}
