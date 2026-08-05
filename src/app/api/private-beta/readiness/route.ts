import { PrivateBetaFoundation } from "@/lib/privateBetaFoundation";

export async function GET() {
  const report = PrivateBetaFoundation.buildPrivateBetaReadinessReport(PrivateBetaFoundation.configFromEnv());
  return Response.json({ ok: true, report });
}
