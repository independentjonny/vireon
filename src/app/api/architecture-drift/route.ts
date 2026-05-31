import { detectArchitectureDrift } from "@/lib/architectureDrift";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = detectArchitectureDrift();
  return Response.json({ ok: true, ...report });
}
