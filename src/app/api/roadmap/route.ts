import { generateRoadmap, getTopPriorities } from "@/lib/roadmapPlanner";

export async function GET() {
  return Response.json({
    ok: true,
    roadmap: generateRoadmap(),
    topPriorities: getTopPriorities(3),
  });
}
