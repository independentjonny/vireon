import { getDeployReadiness } from "@/lib/multiagent/deploymentGovernor";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = (searchParams.get("target") ?? "cloudflare-pages") as Parameters<typeof getDeployReadiness>[0];

  const readiness = getDeployReadiness(target);

  return Response.json({
    ok: true,
    readiness,
  });
}
