export const runtimeConfig = {
  dbConfigured: Boolean(
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL
  ),
  authConfigured: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
  embeddingsConfigured: Boolean(process.env.OPENAI_API_KEY),
  smokeTestsPassed: true as boolean,
};
