import { getLatestBuildStatus } from "@/lib/buildPipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const latest = getLatestBuildStatus();
  return Response.json({
    ok: true,
    hasRecord: !!latest,
    status: latest?.status ?? "unknown",
    buildId: latest?.buildId ?? null,
    completedAt: latest?.completedAt ?? null,
    stagesSummary: latest
      ? latest.stages.map((s) => ({ name: s.name, status: s.status, durationMs: s.durationMs }))
      : [],
    semanticGate: latest?.semanticGate ?? null,
    note: latest ? null : "No build records yet — POST to /api/build-pipeline to run a build",
    checkedAt: new Date().toISOString(),
  });
}
