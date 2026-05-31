import { getTelemetryBuffer, getTelemetrySummary, ingestTelemetry } from "@/lib/telemetry/telemetryIngestion";

export async function GET() {
  return Response.json({
    ok: true,
    summary: getTelemetrySummary(),
    events: getTelemetryBuffer().slice(0, 50),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      event: string;
      level?: "info" | "warn" | "error" | "critical";
      agent?: string;
      payload?: Record<string, unknown>;
    };

    const record = ingestTelemetry(
      body.event,
      body.level ?? "info",
      body.agent ?? "unknown",
      body.payload ?? {},
    );

    return Response.json({ ok: true, record }, { status: 201 });
  } catch {
    return Response.json({ ok: false, error: "Invalid telemetry payload" }, { status: 400 });
  }
}
