import { scanDependencyHealth } from "@/lib/dependencyScanner";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = scanDependencyHealth();
  return Response.json({ ok: report.summary.overallHealth !== "red", ...report });
}
