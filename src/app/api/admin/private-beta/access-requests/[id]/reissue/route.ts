import { accessService, adminSession, defaultAdminAuth, readJsonBody, resultResponse, type AdminAuth } from "@/app/api/admin/private-beta/_accessRouteHelpers";
import { resolvePublicAppBaseUrl } from "@/lib/publicAppUrl";
import type { PrivateBetaInvitationServiceDeps } from "@/server/services/privateBetaInvitationService";

export const dynamic = "force-dynamic";

export function createReissueAccessRequestInvitationHandler(deps?: Partial<PrivateBetaInvitationServiceDeps>, authorize: AdminAuth = defaultAdminAuth()) {
  return async function POST(request: Request, context: { params: Promise<{ id: string }> } | { params: { id: string } }) {
    const auth = await authorize(request);
    if (!auth.ok) return auth.response;
    const params = await context.params;
    const body = await readJsonBody(request);
    const result = await accessService(deps).reissueInvitationForAccessRequest({
      admin: adminSession(auth.session),
      id: params.id,
      reviewReason: body.reason,
      correlationId: request.headers.get("x-correlation-id") ?? undefined,
      appUrl: resolvePublicAppBaseUrl({ request }),
    });
    return resultResponse(result);
  };
}

export const POST = createReissueAccessRequestInvitationHandler();
