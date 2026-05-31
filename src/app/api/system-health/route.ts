import { getSystemHealth } from "@/lib/telemetry/healthMonitor";

export async function GET() {
  return Response.json({
    ok: true,
    health: getSystemHealth(),
  });
}
