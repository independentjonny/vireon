import { betaSafeError, getRequestSession, toBetaSession } from "@/lib/privateBetaRuntime";
import { ONBOARDING_STEPS, PrivateBetaFoundation, type BetaOnboardingStepId, type OnboardingStepStatus } from "@/lib/privateBetaFoundation";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  const betaSession = toBetaSession(session);
  if (!betaSession.userId || !betaSession.householdId) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  const state = PrivateBetaFoundation.mutateState((draft) => {
    let onboarding = draft.onboarding.find((item) => item.userId === betaSession.userId && item.householdId === betaSession.householdId);
    if (!onboarding && betaSession.userId && betaSession.householdId) {
      onboarding = PrivateBetaFoundation.defaultOnboardingState(betaSession.userId, betaSession.householdId);
      draft.onboarding.push(onboarding);
      draft.audit.push(PrivateBetaFoundation.createAuditEvent(betaSession, { eventType: "onboarding.started", affectedResource: onboarding.id, outcome: "success" }));
    }
    if (!onboarding) throw new Error("UNAUTHENTICATED");
    return onboarding;
  });
  return Response.json({ ok: true, steps: ONBOARDING_STEPS, onboarding: state });
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const betaSession = toBetaSession(session);
    const body = await request.json() as { step?: BetaOnboardingStepId; status?: OnboardingStepStatus; consent?: Record<string, boolean> };
    if (!body.step || !body.status) return Response.json({ ok: false, error: "INVALID_ONBOARDING_UPDATE" }, { status: 422 });
    const onboarding = PrivateBetaFoundation.mutateState((draft) => {
      let current = draft.onboarding.find((item) => item.userId === betaSession.userId && item.householdId === betaSession.householdId);
      if (!current && betaSession.userId && betaSession.householdId) {
        current = PrivateBetaFoundation.defaultOnboardingState(betaSession.userId, betaSession.householdId);
        draft.onboarding.push(current);
      }
      if (!current) throw new Error("UNAUTHENTICATED");
      const next = PrivateBetaFoundation.updateOnboardingState(current, { step: body.step!, status: body.status!, consent: body.consent });
      draft.onboarding = draft.onboarding.map((item) => item.id === next.id ? next : item);
      draft.audit.push(PrivateBetaFoundation.createAuditEvent(betaSession, { eventType: "onboarding.updated", affectedResource: next.id, outcome: "success", metadata: { step: body.step, status: body.status } }));
      return next;
    });
    return Response.json({ ok: true, onboarding });
  } catch (error) {
    return Response.json({ ok: false, ...betaSafeError(error) }, { status: 500 });
  }
}
