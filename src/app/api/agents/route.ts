import { runAgents } from "@/lib/agents/orchestratorAgent";

export async function POST(req: Request) {
  const body = await req.json();

  const goal =
    body.goal ||
    "Run Liberva specialist agents";

  const result =
    await runAgents(goal);

  return Response.json({
    ok: true,
    result,
  });
}
