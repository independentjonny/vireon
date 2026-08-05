import { accessService, adminSession, defaultAdminAuth, readJsonBody, resultResponse, type AdminAuth } from "@/app/api/admin/private-beta/_accessRouteHelpers";
import type { PrivateBetaInvitationServiceDeps } from "@/server/services/privateBetaInvitationService";

export const dynamic = "force-dynamic";

export function createRevokeInvitationHandler(deps?: Partial<PrivateBetaInvitationServiceDeps>, authorize: AdminAuth = defaultAdminAuth()) {
  return async function POST(request: Request, context: { params: Promise<{ id: string }> } | { params: { id: string } }) {
    const auth = await authorize(request);
    if (!auth.ok) return auth.response;
    const params = await context.params;
    const body = await readJsonBody(request);
    const result = await accessService(deps).revokeInvitation({
      admin: adminSession(auth.session),
      invitationId: params.id,
      reason: body.reason,
      correlationId: request.headers.get("x-correlation-id") ?? undefined,
    });
    return resultResponse(result);
  };
}

export const POST = createRevokeInvitationHandler();
