export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    hasRecord: false,
    rc: null,
    message: "Filesystem-backed release candidate review is intentionally excluded from this public route bundle.",
    checkedAt: new Date().toISOString(),
  });
}

export async function POST() {
  return Response.json({
    ok: false,
    code: "RELEASE_CANDIDATE_GENERATION_REQUIRES_OPERATIONAL_TOOLING",
    message: "Release candidate generation must run through bounded operational tooling, not this route.",
  }, { status: 403 });
}
