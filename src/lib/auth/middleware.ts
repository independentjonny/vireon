import type { Permission, Role } from "./rbac";
import { hasPermission } from "./rbac";

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
  | { ok: false; error: string; status: 401 | 403 };

export function getSession(_request: Request): Session | null {
  return null;
}

export function requireSession(request: Request): AuthResult {
  const session = getSession(request);
  if (!session) {
    return {
      ok: false,
      error: "Not authenticated. Please sign in via Supabase Auth.",
      status: 401,
    };
  }
  return { ok: true, session };
}

export function requirePermission(request: Request, permission: Permission): AuthResult {
  const authResult = requireSession(request);
  if (!authResult.ok) return authResult;

  const { session } = authResult;
  if (!hasPermission(session.role, permission)) {
    return {
      ok: false,
      error: `Insufficient permissions. Role '${session.role}' cannot '${permission}'.`,
      status: 403,
    };
  }

  return { ok: true, session };
}

export function getDevSession(): Session {
  return {
    userId: "dev-user-001",
    workspaceId: "dev-workspace-001",
    orgId: "dev-org-001",
    role: "owner",
    email: "alex.becker1@outlook.com",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
}
