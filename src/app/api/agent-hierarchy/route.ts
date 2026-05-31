import { getSupervisorState, supervisorRun } from "@/lib/multiagent/supervisor";
import { AGENT_CONTRACTS } from "@/lib/multiagent/coordinationContracts";

export async function GET() {
  return Response.json({
    ok: true,
    supervisorState: getSupervisorState(),
    contracts: AGENT_CONTRACTS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { goal: string };
    const result = await supervisorRun(body.goal ?? "autonomous platform improvement");
    return Response.json(result);
  } catch {
    return Response.json({ ok: false, error: "Supervisor run failed" }, { status: 500 });
  }
}
