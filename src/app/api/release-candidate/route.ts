import { generateReleaseCandidate, getLatestReleaseCandidate } from "@/lib/releaseCandidate";

export const dynamic = "force-dynamic";

export async function GET() {
  const latest = getLatestReleaseCandidate();
  return Response.json({
    ok: true,
    hasRecord: !!latest,
    rc: latest,
    message: latest ? null : "No release candidate yet — POST to generate one",
    checkedAt: new Date().toISOString(),
  });
}

export async function POST() {
  const rc = generateReleaseCandidate();
  return Response.json({ ok: true, rc });
}
