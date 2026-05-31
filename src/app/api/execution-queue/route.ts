import { buildExecutionQueue, buildSprintPlan, getExecutionSummary } from "@/lib/roadmapExecution/executionEngine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sprint = searchParams.get("sprint");

  if (sprint) {
    return Response.json({
      ok: true,
      sprint: buildSprintPlan(sprint),
    });
  }

  return Response.json({
    ok: true,
    summary: getExecutionSummary(),
    queue: buildExecutionQueue(),
  });
}
