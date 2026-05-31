import { databaseAgent } from "@/lib/agents/databaseAgent";

export async function GET() {
  const report = await databaseAgent("health-check");
  return Response.json({ ok: true, report });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = typeof body.task === "string" && body.task.length > 0 ? body.task : "agent-task";
  const report = await databaseAgent(task);
  return Response.json({ ok: true, report });
}
