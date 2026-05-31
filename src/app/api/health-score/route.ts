import { calculateHealthScore } from "@/lib/healthEngine";

export async function GET() {
  return Response.json({
    ok: true,
    health: calculateHealthScore(),
  });
}
