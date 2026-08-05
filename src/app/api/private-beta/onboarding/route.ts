import { getRequestSession } from "@/lib/privateBetaRuntime";
import { ONBOARDING_STEPS, type BetaOnboardingStepId, type OnboardingStepStatus } from "@/lib/privateBetaFoundation";
import { createPrivateBetaOnboardingServiceFromEnv } from "@/server/services/privateBetaOnboardingPostgresService";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  const service = createPrivateBetaOnboardingServiceFromEnv();
  try {
    return Response.json({ ok: true, steps: ONBOARDING_STEPS, onboarding: await service.readOrCreate(session) });
  } catch (error) {
    const safe = service.toSafeError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  const service = createPrivateBetaOnboardingServiceFromEnv();
  try {
    const body = await request.json() as { step?: BetaOnboardingStepId; status?: OnboardingStepStatus; consent?: Record<string, boolean> };
    if (!body.step || !body.status) return Response.json({ ok: false, error: "INVALID_ONBOARDING_UPDATE" }, { status: 422 });
    const onboarding = await service.update(session, { step: body.step, status: body.status, consent: body.consent });
    return Response.json({ ok: true, onboarding });
  } catch (error) {
    const safe = service.toSafeError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}
