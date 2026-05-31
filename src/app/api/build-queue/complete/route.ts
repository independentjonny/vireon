import { completeBuildJob } from "@/lib/buildQueue";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { jobId?: string; passed?: boolean; note?: string };
    if (!body.jobId) {
      return Response.json({ ok: false, error: "jobId is required" }, { status: 400 });
    }
    const passed = body.passed !== false;
    const note = body.note ?? (passed ? "Build completed successfully" : "Build failed");
    const job = completeBuildJob(body.jobId, passed, note);
    if (!job) {
      return Response.json({ ok: false, error: "Job not found" }, { status: 404 });
    }
    return Response.json({ ok: true, job });
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
