import { NextRequest, NextResponse } from "next/server";
import type { TwinScenario } from "@/lib/financialDigitalTwin";
import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    return NextResponse.json({ ok: true, state: await service.readDigitalTwin(current) });
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    const body = (await request.json().catch(() => ({}))) as { action?: "save-scenario" | "run-scenario"; scenario?: TwinScenario; scenarioId?: string };
    if (body.action === "save-scenario" && body.scenario) {
      return NextResponse.json({ ok: true, state: await service.saveTwinScenario(current, body.scenario) });
    }
    if (body.action === "run-scenario" && body.scenarioId) {
      return NextResponse.json({ ok: true, state: await service.runTwinScenario(current, body.scenarioId) });
    }
    return NextResponse.json({ ok: true, state: await service.readDigitalTwin(current) });
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
