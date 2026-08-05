import {
  createPrivateBetaInvitationService,
  createPrivateBetaInvitationServiceFromEnv,
  type InvitationRedemptionResult,
  type PrivateBetaInvitationServiceDeps,
} from "@/server/services/privateBetaInvitationService";

export const dynamic = "force-dynamic";

function sessionCookie(result: Extract<InvitationRedemptionResult, { ok: true }>): string | null {
  if (!result.session?.accessToken) return null;
  const maxAge = Math.max(60, Math.min(result.session.expiresIn ?? 3600, 60 * 60 * 24 * 7));
  return `vireon_access_token=${encodeURIComponent(result.session.accessToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function createRedeemInvitationHandler(deps?: Partial<PrivateBetaInvitationServiceDeps>) {
  return async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    let result: InvitationRedemptionResult;
    try {
      const service = deps?.db && deps.signUpWithSupabase
        ? createPrivateBetaInvitationService(deps as PrivateBetaInvitationServiceDeps)
        : createPrivateBetaInvitationServiceFromEnv();
      result = await service.redeem({
        token: body.token,
        email: body.email,
        password: body.password,
        confirmPassword: body.confirmPassword,
        correlationId: request.headers.get("x-correlation-id") ?? undefined,
      });
    } catch {
      return Response.json(
        { ok: false, code: "PRIVATE_BETA_INVITATION_STORE_UNAVAILABLE", error: "Private beta invitations are temporarily unavailable." },
        { status: 503 }
      );
    }

    if (!result.ok) {
      return Response.json({ ok: false, code: result.code, error: result.message }, { status: result.status });
    }

    const response = Response.json({
      ok: true,
      redirectTo: result.redirectTo,
      confirmationRequired: result.confirmationRequired,
      message: result.confirmationRequired
        ? "Account created. Check your email to confirm your address, then sign in."
        : "Account created. Continue to beta onboarding.",
    });
    const cookie = sessionCookie(result);
    if (cookie) response.headers.append("set-cookie", cookie);
    return response;
  };
}

export const POST = createRedeemInvitationHandler();
