import { getNextQueuedJob, startBuildJob } from "@/lib/buildQueue";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const autoStart = searchParams.get("start") === "true";

  const job = getNextQueuedJob();
  if (!job) {
    return Response.json({ ok: true, job: null, message: "Queue empty — no pending jobs" });
  }

  if (autoStart) {
    const started = startBuildJob(job.jobId);
    return Response.json({ ok: true, job: started, started: true });
  }

  return Response.json({ ok: true, job });
}
