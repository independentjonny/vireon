import { getSchedulerStatus } from "@/lib/runtimeControl";

export async function GET() {
  return Response.json({ ok: true, ...getSchedulerStatus() });
}
