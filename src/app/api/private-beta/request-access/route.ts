import {
  createPrivateBetaInvitationService,
  createPrivateBetaInvitationServiceFromEnv,
  type PrivateBetaInvitationServiceDeps,
} from "@/server/services/privateBetaInvitationService";

export const dynamic = "force-dynamic";

const REQUEST_ACCESS_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_ACCESS_MAX_ATTEMPTS = 5;
const requestAccessRateLimit = new Map<string, { count: number; resetAt: number }>();

function requestIdentity(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || new URL(request.url).hostname || "unknown";
}

function isRateLimited(request: Request, now = Date.now()): boolean {
  const key = requestIdentity(request).slice(0, 128);
  const current = requestAccessRateLimit.get(key);
  if (!current || current.resetAt <= now) {
    requestAccessRateLimit.set(key, { count: 1, resetAt: now + REQUEST_ACCESS_WINDOW_MS });
    return false;
  }
  current.count += 1;
  requestAccessRateLimit.set(key, current);
  return current.count > REQUEST_ACCESS_MAX_ATTEMPTS;
}

export function clearPrivateBetaAccessRequestRateLimit() {
  requestAccessRateLimit.clear();
}

export function createRequestAccessHandler(deps?: Partial<PrivateBetaInvitationServiceDeps>) {
  return async function POST(request: Request) {
    if (isRateLimited(request)) {
      return Response.json({ ok: false, code: "PRIVATE_BETA_ACCESS_RATE_LIMITED", error: "Too many requests. Try again later." }, { status: 429 });
    }
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }
    let result: Awaited<ReturnType<ReturnType<typeof createPrivateBetaInvitationService>["requestAccess"]>>;
    try {
      const service = deps?.db && deps.signUpWithSupabase
        ? createPrivateBetaInvitationService(deps as PrivateBetaInvitationServiceDeps)
        : createPrivateBetaInvitationServiceFromEnv();
      result = await service.requestAccess({
        email: body.email,
        message: body.message,
        reason: body.reason,
        displayName: body.displayName,
        correlationId: request.headers.get("x-correlation-id") ?? undefined,
      });
    } catch {
      return Response.json(
        { ok: false, code: "PRIVATE_BETA_INVITATION_STORE_UNAVAILABLE", error: "Private beta access requests are temporarily unavailable." },
        { status: 503 }
      );
    }
    if (!result.ok) return Response.json({ ok: false, code: result.code, error: result.message }, { status: result.status });
    return Response.json({
      ok: true,
      invitationSent: false,
      message: "Request received for manual review. Vireon will not send or activate an invitation automatically.",
    });
  };
}

export const POST = createRequestAccessHandler();
