export async function GET() {
  const dbConfigured = Boolean(
    process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL
  );
  return Response.json({
    ok: true,
    service: "Liberva API",
    runtime: "Pass 2 multi-file autonomous editing",
    database: {
      status: dbConfigured ? "green" : "yellow",
      configured: dbConfigured,
      message: dbConfigured
        ? "Database configuration detected"
        : "Set DATABASE_URL or SUPABASE_DATABASE_URL to activate persistence",
    },
  });
}
