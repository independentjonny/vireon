import { getIngestionHealthReport } from "@/lib/ingestion/healthScorer";
import { ingestCSV } from "@/lib/ingestion/csvPipeline";

export async function GET() {
  const mockRows = [
    { date: "2026-05-01", description: "Netflix", amount: -24 },
    { date: "2026-05-01", description: "Salary", amount: 6420 },
    { date: "2026-05-02", description: "Woolworths", amount: -182 },
    { date: "2026-05-03", description: "Shell", amount: -85 },
    { date: "2026-05-04", description: "Medibank", amount: -165 },
  ];

  const result = ingestCSV(mockRows);
  const healthReport = getIngestionHealthReport(result.transactions, result.errors);

  return Response.json({
    ok: true,
    ingestion: result,
    health: healthReport,
  });
}
