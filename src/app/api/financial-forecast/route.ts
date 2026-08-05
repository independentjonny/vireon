import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import type { ForecastHorizon } from "@/lib/financialForecasting";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 16 * 1024;

function horizonFrom(value: string | null): ForecastHorizon {
  const allowed: ForecastHorizon[] = ["30d", "90d", "12m", "3y", "5y", "custom"];
  return allowed.includes(value as ForecastHorizon) ? (value as ForecastHorizon) : "12m";
}

function requestTooLarge(request: Request): boolean {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  return Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES;
}

function safeForecastError(service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null, error: unknown) {
  const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable. No local fallback was used.", code: "POSTGRES_UNAVAILABLE", status: 503 };
  return Response.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  const url = new URL(request.url);
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    return Response.json({ ok: true, ...(await service.readFinancialForecast(current, horizonFrom(url.searchParams.get("horizon")))) });
  } catch (error) {
    return safeForecastError(service, error);
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  if (requestTooLarge(request)) return Response.json({ ok: false, error: "Forecast scenario request is too large.", code: "REQUEST_TOO_LARGE" }, { status: 413 });
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    const body = (await request.json()) as {
      horizon?: ForecastHorizon;
      scenario?: unknown;
    };
    return Response.json({ ok: true, ...(await service.runFinancialForecastScenario(current, body.scenario, horizonFrom(body.horizon ?? null))) });
  } catch (error) {
    return safeForecastError(service, error);
  }
}
