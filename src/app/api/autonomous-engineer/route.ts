import { productionStatus } from "@/lib/productionAgent";
import { selfRepairPlan } from "@/lib/selfRepairEngine";

export async function POST(req: Request) {
  const body = await req.json();

  return Response.json({
    ok: true,
    goal: body.goal || "Run autonomous engineer",
    status: productionStatus(),
    repairPlan: selfRepairPlan(body.error),
  });
}
