import type { NextRequest } from "next/server.js";
import { NextResponse } from "next/server.js";
import { DEV_PROXY_SESSION_BEARER, requirePermission } from "@/lib/auth/middleware";
import type { Permission } from "@/lib/auth/rbac";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_COOKIE_NAMES = ["vireon_access_token", "sb-access-token", "supabase_access_token"];
const PUBLIC_AUTH_PATHS = new Set([
  "/api/private-beta/invitations/redeem",
  "/api/private-beta/access-requests",
  "/api/private-beta/request-access",
]);

function isPublicAuthPath(pathname: string, method: string): boolean {
  return method.toUpperCase() === "POST" && PUBLIC_AUTH_PATHS.has(pathname);
}

export function permissionForPath(pathname: string, method = "GET"): Permission {
  if (
    pathname.startsWith("/api/runtime") ||
    pathname.startsWith("/api/agent-hierarchy") ||
    pathname.startsWith("/api/agents") ||
    pathname.startsWith("/api/autonomous") ||
    pathname.startsWith("/api/build") ||
    pathname.startsWith("/api/command-policy") ||
    pathname.startsWith("/api/database-agent") ||
    pathname.startsWith("/api/engineering-loop") ||
    pathname.startsWith("/api/env-check") ||
    pathname.startsWith("/api/execution-queue") ||
    pathname.startsWith("/api/local-data") ||
    pathname.startsWith("/api/autonomy-status") ||
    pathname.startsWith("/api/release-candidate") ||
    pathname.startsWith("/api/release-promotion") ||
    pathname.startsWith("/api/production-readiness") ||
    pathname.startsWith("/api/analytics") ||
    pathname.startsWith("/api/logs") ||
    pathname.startsWith("/api/telemetry") ||
    pathname.startsWith("/api/test-runner") ||
    pathname.startsWith("/api/reset-local-data") ||
    pathname.startsWith("/api/backup/import") ||
    pathname.startsWith("/api/model-evaluation") ||
    pathname.startsWith("/api/model-orchestrator")
  ) {
    return "manage:workspace";
  }
  if (pathname.startsWith("/api/backup/export")) return "read:transactions";
  if (pathname.startsWith("/api/admin/private-beta")) {
    return "manage:private_beta_access";
  }
  if (pathname.startsWith("/api/executive-briefing")) return "read:transactions";
  if (pathname.startsWith("/api/architecture-map") || pathname.startsWith("/api/smoke")) {
    return "manage:workspace";
  }
  if (
    pathname.startsWith("/api/action-workflows") ||
    pathname.startsWith("/api/decisions") ||
    pathname.startsWith("/api/digital-twin") ||
    pathname.startsWith("/api/goals") ||
    pathname.startsWith("/api/transactions")
  ) {
    return READ_METHODS.has(method.toUpperCase()) ? "read:transactions" : "write:transactions";
  }
  if (pathname.startsWith("/api/housing-scenarios")) {
    return READ_METHODS.has(method.toUpperCase()) ? "read:transactions" : "write:transactions";
  }
  if (
    pathname.startsWith("/api/private-beta/deletion") ||
    pathname.startsWith("/api/private-beta/export") ||
    pathname.startsWith("/api/private-beta/operations") ||
    pathname.startsWith("/api/private-beta/onboarding") ||
    pathname.startsWith("/api/private-beta/feedback") ||
    pathname.startsWith("/api/private-beta/support")
  ) {
    return READ_METHODS.has(method.toUpperCase()) ? "read:transactions" : "manage:workspace";
  }
  if (pathname.startsWith("/api/subscriptions")) {
    return READ_METHODS.has(method.toUpperCase()) ? "read:subscriptions" : "write:subscriptions";
  }
  if (pathname.startsWith("/api/assets")) {
    return READ_METHODS.has(method.toUpperCase()) ? "read:transactions" : "write:transactions";
  }
  if (pathname.startsWith("/api/financial-vault")) {
    return READ_METHODS.has(method.toUpperCase()) ? "read:transactions" : "write:transactions";
  }
  if (pathname.startsWith("/api/ingest")) return "write:transactions";
  if (pathname.startsWith("/api/copilot") || pathname.startsWith("/api/ai-cfo")) return "invoke:agents";
  return "read:transactions";
}

export async function proxy(request: NextRequest) {
  if (isPublicAuthPath(request.nextUrl.pathname, request.method)) return NextResponse.next();
  const authRequest = request.headers.get("authorization") ? request : withCookieAuthorization(request);
  const auth = await requirePermission(authRequest, permissionForPath(request.nextUrl.pathname, request.method));
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  return NextResponse.next({ request: { headers: headersForDownstreamRequest(request, authRequest) } });
}

function withCookieAuthorization(request: NextRequest): Request {
  const cookies = request.cookies;
  const token = cookies ? AUTH_COOKIE_NAMES.map((name) => cookies.get(name)?.value).find(Boolean) : null;
  if (!token) return request;
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${token}`);
  return new Request(request.url, {
    method: request.method,
    headers,
  });
}

function headersForDownstreamRequest(original: NextRequest, authenticated: Request): Headers {
  const headers = new Headers(original.headers);
  const authorization = authenticated.headers.get("authorization");
  headers.set("authorization", authorization ?? `Bearer ${DEV_PROXY_SESSION_BEARER}`);
  return headers;
}

export const config = {
  matcher: [
    "/api/action-workflows/:path*",
    "/api/architecture-map",
    "/api/agent-hierarchy",
    "/api/agents",
    "/api/admin/private-beta/:path*",
    "/api/ai-cfo/:path*",
    "/api/analytics",
    "/api/assets",
    "/api/autonomous-engineer/:path*",
    "/api/autonomous-operations/:path*",
    "/api/autonomous-task/:path*",
    "/api/autonomy-status",
    "/api/backup/:path*",
    "/api/build-artifacts",
    "/api/build-history",
    "/api/build-orchestrator",
    "/api/build-pipeline",
    "/api/build-queue/:path*",
    "/api/build-status",
    "/api/command-policy",
    "/api/copilot",
    "/api/copilot-history",
    "/api/database-agent",
    "/api/decisions/:path*",
    "/api/digital-twin/:path*",
    "/api/engineering-loop/:path*",
    "/api/env-check",
    "/api/execution-queue/:path*",
    "/api/executive-briefing",
    "/api/financial-intelligence",
    "/api/financial-forecast/:path*",
    "/api/financial-vault/:path*",
    "/api/goals/:path*",
    "/api/health-score",
    "/api/housing-scenarios/:path*",
    "/api/ingest",
    "/api/ingestion-health",
    "/api/insights",
    "/api/local-data/:path*",
    "/api/logs/:path*",
    "/api/memory",
    "/api/model-evaluation/:path*",
    "/api/model-orchestrator/:path*",
    "/api/private-beta/:path*",
    "/api/production-readiness",
    "/api/recommendations",
    "/api/release-candidate",
    "/api/release-promotion",
    "/api/reset-local-data",
    "/api/runtime/:path*",
    "/api/runtime-operations/:path*",
    "/api/smoke",
    "/api/subscriptions/:path*",
    "/api/telemetry",
    "/api/test-runner",
    "/api/transactions",
  ],
};
