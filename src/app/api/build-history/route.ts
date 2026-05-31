import { getBuildHistory } from "@/lib/buildPipeline";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);
  const history = getBuildHistory(limit);
  const greenCount = history.filter((b) => b.status === "green").length;
  const redCount = history.filter((b) => b.status === "red").length;
  return Response.json({
    ok: true,
    total: history.length,
    greenCount,
    redCount,
    builds: history,
    checkedAt: new Date().toISOString(),
  });
}
