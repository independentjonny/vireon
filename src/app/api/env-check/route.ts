import {
  validateEnv,
  getMissingRequired,
  isProductionReady,
  isDatabaseReady,
  isAuthReady,
  supabaseReadinessDiagnostics,
} from "@/lib/supabase/envValidator";

const PRISMA_MIGRATION_CHECKLIST = [
  { step: "Install Prisma CLI", command: "npm install prisma --save-dev", done: true },
  {
    step: "Set DATABASE_URL",
    command: "Add DATABASE_URL to Cloudflare Pages / Render environment variables",
    done: Boolean(process.env.DATABASE_URL),
  },
  { step: "Run initial migration", command: "npx prisma migrate dev --name init", done: false },
  { step: "Generate Prisma Client", command: "npx prisma generate", done: false },
  { step: "Verify schema sync", command: "npx prisma db pull", done: false },
  { step: "Seed initial data (optional)", command: "npx prisma db seed", done: false },
];

export async function GET() {
  const checks = validateEnv();
  const missing = getMissingRequired();
  const ready = isProductionReady();
  const dbReady = isDatabaseReady();

  return Response.json({
    ok: true,
    productionReady: ready,
    databaseReady: dbReady,
    authReady: isAuthReady(),
    missingRequired: missing,
    checks: checks.map(({ key, present, required, description, group }) => ({
      key,
      present,
      required,
      description,
      group,
      status: present ? "green" : required ? "red" : "yellow",
    })),
    supabaseReadiness: supabaseReadinessDiagnostics(),
    prismaMigrationChecklist: PRISMA_MIGRATION_CHECKLIST,
    nextStep:
      missing.length > 0
        ? `Set these environment variables: ${missing.join(", ")}`
        : "All required environment variables are configured.",
    checkedAt: new Date().toISOString(),
  });
}
