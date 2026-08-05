import { accessService, adminSession, defaultAdminAuth, resultResponse, type AdminAuth } from "@/app/api/admin/private-beta/_accessRouteHelpers";
import type { PrivateBetaInvitationServiceDeps } from "@/server/services/privateBetaInvitationService";

export const dynamic = "force-dynamic";

export function createAdminAccessRequestsHandler(deps?: Partial<PrivateBetaInvitationServiceDeps>, authorize: AdminAuth = defaultAdminAuth()) {
  return async function GET(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) return auth.response;
    const url = new URL(request.url);
    const result = await accessService(deps).listAccessRequests({
      admin: adminSession(auth.session),
      status: url.searchParams.get("status") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });
    return resultResponse(result);
  };
}

export const GET = createAdminAccessRequestsHandler();
