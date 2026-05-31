import { generateInsights } from "@/lib/insightsEngine";

export async function GET() {
  return Response.json({
    ok: true,
    insights: generateInsights(),
  });
}
