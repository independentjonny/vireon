import { executiveBriefing } from "@/lib/executiveEngine";

export async function GET() {
  return Response.json(executiveBriefing());
}
