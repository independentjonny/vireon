import { executiveRecommendations } from "@/lib/executiveEngine";

export async function GET() {
  return Response.json({
    ok: true,
    recommendations: executiveRecommendations(),
  });
}
