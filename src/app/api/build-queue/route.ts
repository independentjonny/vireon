import { addBuildJob, listBuildJobs } from "@/lib/buildQueue";

export const dynamic = "force-dynamic";

export async function GET() {
  const queue = listBuildJobs();
  return Response.json({ ok: true, ...queue });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { goal?: string; stages?: string[] };
    const goal = body.goal?.trim();
    if (!goal) {
      return Response.json({ ok: false, error: "goal is required" }, { status: 400 });
    }
    const job = addBuildJob(goal, body.stages);
    return Response.json({ ok: true, job });
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
