import { accessService, adminSession, defaultAdminAuth, resultResponse, type AdminAuth } from "@/app/api/admin/private-beta/_accessRouteHelpers";
import type { PrivateBetaInvitationServiceDeps } from "@/server/services/privateBetaInvitationService";

export const dynamic = "force-dynamic";

export function createAdminAccessRequestDetailHandler(deps?: Partial<PrivateBetaInvitationServiceDeps>, authorize: AdminAuth = defaultAdminAuth()) {
  return async function GET(request: Request, context: { params: Promise<{ id: string }> } | { params: { id: string } }) {
    const auth = await authorize(request);
    if (!auth.ok) return auth.response;
    const params = await context.params;
    const result = await accessService(deps).getAccessRequest({ admin: adminSession(auth.session), id: params.id });
    return resultResponse(result);
  };
}

export const GET = createAdminAccessRequestDetailHandler();
