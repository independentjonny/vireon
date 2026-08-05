export type Role = "owner" | "admin" | "member" | "viewer";

export type Permission =
  | "read:transactions"
  | "write:transactions"
  | "read:subscriptions"
  | "write:subscriptions"
  | "read:insights"
  | "write:insights"
  | "read:roadmap"
  | "write:roadmap"
  | "read:telemetry"
  | "write:telemetry"
  | "manage:users"
  | "manage:workspace"
  | "manage:private_beta_access"
  | "manage:billing"
  | "invoke:agents"
  | "read:memory"
  | "write:memory";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: [
    "read:transactions",
    "read:subscriptions",
    "read:insights",
    "read:roadmap",
    "read:memory",
  ],
  member: [
    "read:transactions",
    "write:transactions",
    "read:subscriptions",
    "write:subscriptions",
    "read:insights",
    "read:roadmap",
    "read:memory",
    "write:memory",
    "invoke:agents",
  ],
  admin: [
    "read:transactions",
    "write:transactions",
    "read:subscriptions",
    "write:subscriptions",
    "read:insights",
    "write:insights",
    "read:roadmap",
    "write:roadmap",
    "read:telemetry",
    "write:telemetry",
    "manage:users",
    "manage:private_beta_access",
    "read:memory",
    "write:memory",
    "invoke:agents",
  ],
  owner: [
    "read:transactions",
    "write:transactions",
    "read:subscriptions",
    "write:subscriptions",
    "read:insights",
    "write:insights",
    "read:roadmap",
    "write:roadmap",
    "read:telemetry",
    "write:telemetry",
    "manage:users",
    "manage:workspace",
    "manage:private_beta_access",
    "manage:billing",
    "read:memory",
    "write:memory",
    "invoke:agents",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function canInvokeAgent(role: Role): boolean {
  return hasPermission(role, "invoke:agents");
}
