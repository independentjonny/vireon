import { runFinancialIntelligenceAgent } from "@/lib/multiagent/financialIntelligenceAgent";

export async function GET() {
  const report = runFinancialIntelligenceAgent();
  return Response.json({ ok: true, report });
}
