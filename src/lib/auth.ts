export const authStatus = {
  provider: "supabase",
  features: ["email login", "user accounts", "session ownership", "multi-user isolation"],
  requiresEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
};
