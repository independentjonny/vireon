import { getOvernightStatus } from "@/lib/runtimeControl";

export async function GET() {
  return Response.json({ ok: true, ...getOvernightStatus() });
}
