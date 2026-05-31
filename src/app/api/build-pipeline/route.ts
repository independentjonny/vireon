import { runBuildPipeline } from "@/lib/buildPipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { runId?: string };
  const record = runBuildPipeline(body.runId ?? null);
  return Response.json({ ok: record.status === "green", ...record });
}

export async function GET() {
  return Response.json({
    ok: true,
    note: "POST to /api/build-pipeline with optional { runId } to trigger a build pipeline run",
    stages: ["typecheck", "build"],
    outputDir: ".ai/builds/",
  });
}
