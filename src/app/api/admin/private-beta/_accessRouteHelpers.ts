import { authErrorResponse, requirePermission, type Session } from "@/lib/auth/middleware";
import {
  createPrivateBetaInvitationService,
  createPrivateBetaInvitationServiceFromEnv,
  type PrivateBetaInvitationServiceDeps,
} from "@/server/services/privateBetaInvitationService";

export type AdminAuth = (request: Request) => Promise<{ ok: true; session: Session } | { ok: false; response: Response }>;

export function defaultAdminAuth(permission = "manage:private_beta_access" as const): AdminAuth {
  return async (request: Request) => {
    const auth = await requirePermission(request, permission);
    if (!auth.ok) return { ok: false, response: authErrorResponse(auth) };
    return { ok: true, session: auth.session };
  };
}

export function accessService(deps?: Partial<PrivateBetaInvitationServiceDeps>) {
  return deps?.db && deps.signUpWithSupabase
    ? createPrivateBetaInvitationService(deps as PrivateBetaInvitationServiceDeps)
    : createPrivateBetaInvitationServiceFromEnv();
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function adminSession(session: Session) {
  return { userId: session.userId, email: session.email };
}

export function resultResponse(result: { ok: boolean; status?: number; code?: string; message?: string; [key: string]: unknown }) {
  if (!result.ok) {
    return Response.json(
      { ok: false, code: result.code || "PRIVATE_BETA_ACCESS_ERROR", error: result.message || "Private beta access operation failed." },
      { status: result.status || 500 }
    );
  }
  return Response.json(result);
}
