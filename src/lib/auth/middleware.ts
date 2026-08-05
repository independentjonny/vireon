import type { Permission, Role } from "@/lib/auth/rbac";
import { hasPermission } from "@/lib/auth/rbac";
import { verifySupabaseToken } from "@/lib/supabase/server";

export type Session = {
  userId: string;
  workspaceId: string;
  orgId: string;
  role: Role;
  email: string;
  expiresAt: string;
};

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: string; status: 401 | 403 | 500 };

export const DEV_PROXY_SESSION_BEARER = "__vireon_local_dev_proxy_session__";

const ROLE_VALUES: Role[] = ["owner", "admin", "member", "viewer"];

function stringMetadata(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function roleMetadata(metadata: Record<string, unknown>): Role | null {
  const raw = stringMetadata(metadata, ["vireon_role", "role"]);
  return raw && ROLE_VALUES.includes(raw as Role) ? (raw as Role) : null;
}

function isProduction(): boolean {
  if (process.env.NEXT_PHASE === "phase-development-server") return false;
  return process.env.NODE_ENV === "production";
}

function isLoopbackRequest(request: Request): boolean {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function developmentBypassFlagEnabled(): boolean {
  return process.env.VIREON_DEV_AUTH_BYPASS === "true" || process.env.NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS === "true";
}

function developmentBypassEnabled(request: Request): boolean {
  return developmentBypassFlagEnabled() && !isProduction() && isLoopbackRequest(request);
}

function developmentBypassEnabledWithoutRequest(): boolean {
  return developmentBypassFlagEnabled() && !isProduction();
}

function devSession(): Session {
  const role = process.env.VIREON_DEV_AUTH_ROLE as Role | undefined;
  return {
    userId: process.env.VIREON_DEV_AUTH_USER_ID || "dev-user-001",
    workspaceId: process.env.VIREON_DEV_AUTH_WORKSPACE_ID || "dev-workspace-001",
    orgId: process.env.VIREON_DEV_AUTH_ORG_ID || "dev-org-001",
    role: role && ROLE_VALUES.includes(role) ? role : "owner",
    email: process.env.VIREON_DEV_AUTH_EMAIL || "dev@localhost.invalid",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function maybeDevSession(request: Request): Session | null {
  if (!developmentBypassEnabled(request)) return null;
  return devSession();
}

function maybeDevProxySession(request: Request): Session | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${DEV_PROXY_SESSION_BEARER}`) return null;
  if (!isLoopbackRequest(request)) return null;
  return devSession();
}

export function getDevSession(request?: Request): Session {
  if (request) {
    const session = maybeDevSession(request);
    if (session) return session;
  } else if (developmentBypassEnabledWithoutRequest()) {
    return devSession();
  }
  throw new Error("Development authentication bypass is not enabled for this request.");
}

export function getSession(_request: Request): never {
  throw new Error("getSession() is disabled. Use requireSession(request) or requireServerPageSession().");
}

export async function requireSession(request: Request): Promise<AuthResult> {
  const bypass = maybeDevSession(request);
  if (bypass) return { ok: true, session: bypass };
  const proxyBypass = maybeDevProxySession(request);
  if (proxyBypass) return { ok: true, session: proxyBypass };
  if (developmentBypassFlagEnabled() && isProduction()) {
    return { ok: false, error: "Development authentication bypass is disabled in production.", status: 403 };
  }

  const auth = await verifySupabaseToken(request.headers.get("authorization"));
  if (!auth.ok) return { ok: false, error: auth.error, status: auth.status };

  const metadata = auth.user.appMetadata;
  const workspaceId = stringMetadata(metadata, ["vireon_workspace_id", "workspace_id"]);
  const orgId = stringMetadata(metadata, ["vireon_org_id", "org_id"]);
  const role = roleMetadata(metadata);

  if (!workspaceId || !orgId || !role) {
    return { ok: false, error: "Workspace membership is not configured for this user.", status: 403 };
  }

  return {
    ok: true,
    session: {
      userId: auth.user.userId,
      workspaceId,
      orgId,
      role,
      email: auth.user.email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };
}

export async function requirePermission(
  request: Request,
  permission: Permission
): Promise<AuthResult> {
  const authResult = await requireSession(request);
  if (!authResult.ok) return authResult;

  if (!hasPermission(authResult.session.role, permission)) {
    return { ok: false, error: `Missing permission: ${permission}`, status: 403 };
  }

  return authResult;
}

export function authErrorResponse(result: Extract<AuthResult, { ok: false }>): Response {
  return Response.json({ ok: false, error: result.error }, { status: result.status });
}
