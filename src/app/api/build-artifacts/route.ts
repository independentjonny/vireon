import { getArtifactManifest, getArtifact } from "@/lib/buildArtifactManifest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const buildId = url.searchParams.get("buildId");
  if (buildId) {
    const artifact = getArtifact(buildId);
    if (!artifact) {
      return Response.json({ ok: false, error: `No artifact found for buildId: ${buildId}` }, { status: 404 });
    }
    return Response.json({ ok: true, artifact });
  }
  const manifest = getArtifactManifest();
  return Response.json({ ok: true, manifest });
}
