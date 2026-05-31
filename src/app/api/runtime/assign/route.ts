import { assignRun } from "@/lib/runtimeControl";

export async function POST(req: Request) {
  let goal = "";
  try {
    const body = await req.json();
    goal = (body?.goal as string) ?? "";
  } catch {
    // no body or invalid JSON
  }
  if (!goal) {
    return Response.json({ ok: false, error: "goal is required" }, { status: 400 });
  }
  return Response.json({ ok: true, ...assignRun(goal) });
}
