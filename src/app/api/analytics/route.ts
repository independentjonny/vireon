import { executiveAnalytics } from "@/lib/analyticsEngine";

export async function GET() {
  return Response.json({
    ok: true,
    analytics: executiveAnalytics(),
  });
}
