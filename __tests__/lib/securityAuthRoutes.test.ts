import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, describe, it } from "node:test";
import { DEV_PROXY_SESSION_BEARER, requireSession } from "../../src/lib/auth/middleware.ts";
import { verifySupabaseToken } from "../../src/lib/supabase/server.ts";
import { POST as ingestPost } from "../../src/app/api/ingest/route.ts";
import { GET as backupExportGet } from "../../src/app/api/backup/export/route.ts";
import { POST as backupImportPost } from "../../src/app/api/backup/import/route.ts";
import { POST as resetPost } from "../../src/app/api/reset-local-data/route.ts";
import { GET as testRunnerGet } from "../../src/app/api/test-runner/route.ts";
import { GET as memoryGet, PATCH as memoryPatch, POST as memoryPost } from "../../src/app/api/memory/route.ts";
import { POST as modelExecutePost } from "../../src/app/api/model-orchestrator/execute/route.ts";
import { GET as modelProvidersGet } from "../../src/app/api/model-orchestrator/providers/route.ts";
import { GET as modelRunGet } from "../../src/app/api/model-orchestrator/runs/[runId]/route.ts";
import { POST as modelRunCancelPost } from "../../src/app/api/model-orchestrator/runs/[runId]/cancel/route.ts";
import { getLocalImports, getLocalSubscriptions, getLocalTransactions, replaceLocalBackupCollections } from "../../src/lib/localStore.ts";
import { config as proxyConfig, permissionForPath, proxy } from "../../src/proxy.ts";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
}

function setSupabaseEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
}

function setEnv(key: string, value: string) {
  process.env[key] = value;
}

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  const text = JSON.stringify(body);
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(text.length), ...headers },
    body: text,
  });
}

function proxyRequest(url: string, headers: Record<string, string> = {}, method = "GET") {
  return Object.assign(new Request(url, { headers, method }), { nextUrl: new URL(url) });
}

function proxyCookieRequest(url: string, cookieName: string, cookieValue: string, method = "GET") {
  return Object.assign(new Request(url, { method }), {
    nextUrl: new URL(url),
    cookies: {
      get(name: string) {
        return name === cookieName ? { name, value: cookieValue } : undefined;
      },
    },
  });
}

function routeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

function apiPathForRouteFile(file: string): string {
  const rel = relative(join(process.cwd(), "src", "app", "api"), file).split(sep).join("/");
  return `/api/${rel.replace(/\/route\.ts$/, "").replace(/\[([^\]]+)\]/g, "{$1}")}`;
}

function matcherCovers(routePath: string): boolean {
  return proxyConfig.matcher.some((matcher) => {
    if (matcher.endsWith("/:path*")) return routePath === matcher.slice(0, -7) || routePath.startsWith(matcher.slice(0, -7) + "/");
    return routePath === matcher;
  });
}

function handlerHasGuard(file: string): boolean {
  const text = readFileSync(file, "utf-8");
  return /requirePermission|requireSession|getRequestSession|authErrorResponse|disabled|410/.test(text);
}

function fileSnapshot(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

describe("authentication middleware", () => {
  afterEach(restoreEnv);

  it("fails closed when Supabase credentials are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await requireSession(new Request("https://vireon.test/api", { headers: { authorization: "Bearer token" } }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 500);
  });

  it("rejects invalid or expired bearer tokens", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() => Promise.resolve(new Response("{}", { status: 401 }))) as typeof fetch;
    const result = await requireSession(new Request("https://vireon.test/api", { headers: { authorization: "Bearer expired" } }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  it("derives identity and membership from verified Supabase app metadata", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "verified-user",
        email: "verified@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "admin",
        },
      }))) as typeof fetch;

    const result = await requireSession(new Request("https://vireon.test/api", {
      headers: { authorization: "Bearer valid", "x-user-id": "forged-user", "x-role": "owner" },
    }));

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.session.userId, "verified-user");
      assert.equal(result.session.workspaceId, "workspace-a");
      assert.equal(result.session.role, "admin");
    }
  });

  it("rejects development bypass in production", async () => {
    setEnv("NODE_ENV", "production");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    const result = await requireSession(new Request("http://127.0.0.1/api"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  });

  it("allows explicit development bypass when Next proxy reports the development-server phase", async () => {
    setEnv("NODE_ENV", "production");
    process.env.NEXT_PHASE = "phase-development-server";
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    const result = await requireSession(new Request("http://127.0.0.1/api"));
    assert.equal(result.ok, true);
  });

  it("allows the explicit public development bypass flag only for local non-production proxy requests", async () => {
    setEnv("NODE_ENV", "test");
    process.env.NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS = "true";
    const loopback = await requireSession(new Request("http://127.0.0.1/api"));
    const remote = await requireSession(new Request("https://vireon.test/api"));
    assert.equal(loopback.ok, true);
    assert.equal(remote.ok, false);
  });

  it("rejects the public development bypass flag in production", async () => {
    setEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS = "true";
    const result = await requireSession(new Request("http://127.0.0.1/api"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  });

  it("allows the proxy-injected development session only on local requests", async () => {
    setEnv("NODE_ENV", "test");
    const local = await requireSession(new Request("http://127.0.0.1/api", {
      headers: { authorization: `Bearer ${DEV_PROXY_SESSION_BEARER}` },
    }));
    assert.equal(local.ok, true);

    const bindAll = await requireSession(new Request("http://0.0.0.0/api", {
      headers: { authorization: `Bearer ${DEV_PROXY_SESSION_BEARER}` },
    }));
    assert.equal(bindAll.ok, true);

    const remote = await requireSession(new Request("https://vireon.test/api", {
      headers: { authorization: `Bearer ${DEV_PROXY_SESSION_BEARER}` },
    }));
    assert.equal(remote.ok, false);
  });

  it("allows explicit development bypass only on loopback", async () => {
    setEnv("NODE_ENV", "test");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    const loopback = await requireSession(new Request("http://127.0.0.1/api"));
    const remote = await requireSession(new Request("https://vireon.test/api"));
    assert.equal(loopback.ok, true);
    assert.equal(remote.ok, false);
  });

  it("verifies Supabase tokens through the server-side user endpoint", async () => {
    let requestedUrl = "";
    const result = await verifySupabaseToken("Bearer token", {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co/",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      } as unknown as NodeJS.ProcessEnv,
      fetchImpl: ((url: string | URL | Request) => {
        requestedUrl = String(url);
        return Promise.resolve(Response.json({ id: "user-a", email: "a@example.test", app_metadata: {} }));
      }) as typeof fetch,
    });
    assert.equal(result.ok, true);
    assert.equal(requestedUrl, "https://project.supabase.co/auth/v1/user");
  });
});

describe("sensitive route guards", () => {
  afterEach(restoreEnv);

  it("rejects unauthenticated local data reset", async () => {
    const response = await resetPost(new Request("https://vireon.test/api/reset-local-data", { method: "POST" }));
    assert.equal(response.status, 401);
  });

  it("rejects forged ingest ownership fields", async () => {
    setEnv("NODE_ENV", "test");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    process.env.VIREON_DEV_AUTH_USER_ID = "user-a";
    process.env.VIREON_DEV_AUTH_WORKSPACE_ID = "workspace-a";
    const response = await ingestPost(jsonRequest("http://127.0.0.1/api/ingest", {
      userId: "user-b",
      workspaceId: "workspace-b",
      rows: [{ date: "2026-08-01", description: "Salary", amount: 100 }],
    }));
    assert.equal(response.status, 403);
  });

  it("does not locally persist ingest data when database configuration is present", async () => {
    setEnv("NODE_ENV", "test");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    process.env.VIREON_DEV_AUTH_USER_ID = "user-a";
    process.env.VIREON_DEV_AUTH_WORKSPACE_ID = "workspace-a";
    process.env.VIREON_PILOT_APPLICATION_DATABASE_URL = "postgresql://vireon_app.projectref@pooler.supabase.com:6543/postgres?sslmode=require";
    process.env.VIREON_PILOT_APPLICATION_ROLE_PASSWORD = "synthetic-test-password";
    process.env.VIREON_DB_QUERY_TIMEOUT_MS = "100";
    process.env.VIREON_DB_STATEMENT_TIMEOUT_MS = "100";
    const transactionPath = join(process.cwd(), ".ai", "local-data", "transactions.json");
    const importPath = join(process.cwd(), ".ai", "local-data", "imports.json");
    const beforeTransactions = fileSnapshot(transactionPath);
    const beforeImports = fileSnapshot(importPath);
    const response = await ingestPost(jsonRequest("http://127.0.0.1/api/ingest", {
      mode: "persist",
      rows: [{ date: "2026-08-01", description: "Salary", amount: 100 }],
    }));
    const body = await response.json() as { code?: string };
    assert.equal(response.status, 503);
    assert.equal(body.code, "POSTGRES_UNAVAILABLE");
    assert.equal(fileSnapshot(transactionPath), beforeTransactions);
    assert.equal(fileSnapshot(importPath), beforeImports);
  });

  it("blocks the test runner API in production even with bypass requested", async () => {
    setEnv("NODE_ENV", "production");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    const response = await testRunnerGet(new Request("http://127.0.0.1/api/test-runner?run=true"));
    assert.equal(response.status, 403);
  });

  it("disables the obsolete memory route instead of exposing process-memory authority", async () => {
    const getResponse = await memoryGet();
    const postResponse = await memoryPost();
    const patchResponse = await memoryPatch();
    const body = await getResponse.json() as { code?: string; error?: string };

    assert.equal(getResponse.status, 410);
    assert.equal(postResponse.status, 410);
    assert.equal(patchResponse.status, 410);
    assert.equal(body.code, "MEMORY_ROUTE_DISABLED");
    assert.match(body.error ?? "", /persisted AI CFO APIs/);
  });

  it("separates operational backup export from user-facing local JSON export", async () => {
    setEnv("NODE_ENV", "test");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    process.env.VIREON_DEV_AUTH_USER_ID = "owner-a";
    process.env.VIREON_DEV_AUTH_WORKSPACE_ID = "workspace-a";
    process.env.VIREON_DEV_AUTH_ROLE = "owner";
    const response = await backupExportGet(new Request("http://127.0.0.1/api/backup/export"));
    const body = await response.json() as { code?: string; source?: string; data?: unknown };

    assert.equal(response.status, 410);
    assert.equal(body.code, "OPERATIONAL_BACKUP_EXPORT_DISABLED");
    assert.equal(body.source, undefined);
    assert.equal(body.data, undefined);
  });

  it("rejects backup imports without the versioned schema", async () => {
    setEnv("NODE_ENV", "test");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    process.env.VIREON_DEV_AUTH_USER_ID = "user-a";
    process.env.VIREON_DEV_AUTH_WORKSPACE_ID = "workspace-a";
    const response = await backupImportPost(jsonRequest("http://127.0.0.1/api/backup/import", {
      data: { transactions: [], subscriptions: [], imports: [] },
    }));
    assert.equal(response.status, 400);
  });

  it("rejects malformed backup transaction records before persistence", async () => {
    setEnv("NODE_ENV", "test");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    process.env.VIREON_DEV_AUTH_USER_ID = "user-a";
    process.env.VIREON_DEV_AUTH_WORKSPACE_ID = "workspace-a";
    const response = await backupImportPost(jsonRequest("http://127.0.0.1/api/backup/import", {
      version: "1.0.0",
      data: {
        transactions: [{ id: "tx-1", merchant: "M", merchantCanonical: "m", amount: Number.NaN, currency: "AUD", date: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z" }],
        subscriptions: [],
        imports: [],
      },
    }));
    assert.equal(response.status, 400);
  });

  it("restores original local backup collections after an injected mid-commit failure", () => {
    const beforeTransactions = getLocalTransactions();
    const beforeSubscriptions = getLocalSubscriptions();
    const beforeImports = getLocalImports();
    assert.throws(
      () => replaceLocalBackupCollections({
        transactions: [{ ...beforeTransactions[0], id: "tx-injected-backup-failure" }].filter(Boolean),
        subscriptions: beforeSubscriptions,
        imports: beforeImports,
      }, { injectFailureAfterReplacements: 1 }),
      /Injected backup import replacement failure/,
    );
    assert.deepEqual(getLocalTransactions(), beforeTransactions);
    assert.deepEqual(getLocalSubscriptions(), beforeSubscriptions);
    assert.deepEqual(getLocalImports(), beforeImports);
  });

  it("central proxy blocks unauthenticated sensitive API access", async () => {
    const response = await proxy(proxyRequest("https://vireon.test/api/model-orchestrator/execute") as never);
    assert.equal(response.status, 401);
  });

  it("central proxy rejects insufficient roles for operational APIs", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "viewer-user",
        email: "viewer@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "viewer",
        },
      }))) as typeof fetch;
    const response = await proxy(proxyRequest("https://vireon.test/api/runtime/status", {
      authorization: "Bearer valid",
    }) as never);
    assert.equal(response.status, 403);
  });

  it("central proxy allows authorized sensitive API access", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "owner-user",
        email: "owner@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "owner",
        },
      }))) as typeof fetch;
    const response = await proxy(proxyRequest("https://vireon.test/api/runtime/status", {
      authorization: "Bearer valid",
    }) as never);
    assert.equal(response.status, 200);
  });

  it("central proxy authenticates browser API requests from the server session cookie", async () => {
    setSupabaseEnv();
    let authorizationHeader = "";
    globalThis.fetch = ((_, init) => {
      authorizationHeader = String((init?.headers as Record<string, string>)?.Authorization ?? "");
      return Promise.resolve(Response.json({
        id: "owner-user",
        email: "owner@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "owner",
        },
      }));
    }) as typeof fetch;
    const response = await proxy(proxyCookieRequest("https://vireon.test/api/private-beta/operations", "vireon_access_token", "cookie-token") as never);
    assert.equal(response.status, 200);
    assert.equal(authorizationHeader, "Bearer cookie-token");
    assert.equal(response.headers.get("x-middleware-request-authorization"), "Bearer cookie-token");
  });

  it("central proxy forwards an explicit local validation session to protected route handlers", async () => {
    setEnv("NODE_ENV", "test");
    process.env.VIREON_DEV_AUTH_BYPASS = "true";
    const response = await proxy(proxyRequest("http://127.0.0.1/api/private-beta/operations") as never);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-request-authorization"), `Bearer ${DEV_PROXY_SESSION_BEARER}`);
  });

  it("central proxy applies method-aware financial permissions", () => {
    assert.equal(permissionForPath("/api/subscriptions", "GET"), "read:subscriptions");
    assert.equal(permissionForPath("/api/subscriptions", "POST"), "write:subscriptions");
    assert.equal(permissionForPath("/api/assets", "GET"), "read:transactions");
    assert.equal(permissionForPath("/api/assets", "POST"), "write:transactions");
    assert.equal(permissionForPath("/api/financial-vault", "GET"), "read:transactions");
    assert.equal(permissionForPath("/api/financial-vault", "POST"), "write:transactions");
    assert.equal(permissionForPath("/api/housing-scenarios", "GET"), "read:transactions");
    assert.equal(permissionForPath("/api/housing-scenarios", "POST"), "write:transactions");
    assert.equal(permissionForPath("/api/action-workflows", "POST"), "write:transactions");
    assert.equal(permissionForPath("/api/decisions", "PATCH"), "write:transactions");
    assert.equal(permissionForPath("/api/digital-twin/scenarios", "POST"), "write:transactions");
    assert.equal(permissionForPath("/api/goals", "POST"), "write:transactions");
    assert.equal(permissionForPath("/api/transactions", "POST"), "write:transactions");
    assert.equal(permissionForPath("/api/architecture-map", "GET"), "manage:workspace");
    assert.equal(permissionForPath("/api/smoke", "GET"), "manage:workspace");
    assert.equal(permissionForPath("/api/production-readiness", "GET"), "manage:workspace");
    assert.equal(permissionForPath("/api/private-beta/deletion", "GET"), "read:transactions");
    assert.equal(permissionForPath("/api/private-beta/deletion", "POST"), "manage:workspace");
    assert.equal(permissionForPath("/api/private-beta/financial-data-reset", "POST"), "manage:workspace");
    assert.equal(permissionForPath("/api/private-beta/export", "POST"), "manage:workspace");
    assert.equal(permissionForPath("/api/private-beta/support", "POST"), "manage:workspace");
  });

  it("central proxy rejects read-only roles on mutating subscription requests", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "viewer-user",
        email: "viewer@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "viewer",
        },
      }))) as typeof fetch;
    const response = await proxy(proxyRequest("https://vireon.test/api/subscriptions", {
      authorization: "Bearer valid",
    }, "POST") as never);
    assert.equal(response.status, 403);
  });

  it("central proxy rejects read-only roles on mutating core decisioning requests", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "viewer-user",
        email: "viewer@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "viewer",
        },
      }))) as typeof fetch;
    const response = await proxy(proxyRequest("https://vireon.test/api/action-workflows", {
      authorization: "Bearer valid",
    }, "POST") as never);
    assert.equal(response.status, 403);
  });

  it("central proxy requires administrative permission for write-capable diagnostics", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "viewer-user",
        email: "viewer@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "viewer",
        },
      }))) as typeof fetch;
    const response = await proxy(proxyRequest("https://vireon.test/api/smoke", {
      authorization: "Bearer valid",
    }) as never);
    assert.equal(response.status, 403);
  });

  it("model orchestrator execution fails closed without authentication", async () => {
    const response = await modelExecutePost(jsonRequest("https://vireon.test/api/model-orchestrator/execute", {
      taskType: "conversational-answer",
      inputPayload: { prompt: "synthetic" },
    }) as never);
    assert.equal(response.status, 401);
  });

  it("model orchestrator execution rejects insufficient roles", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "viewer-user",
        email: "viewer@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "viewer",
        },
      }))) as typeof fetch;
    const response = await modelExecutePost(jsonRequest("https://vireon.test/api/model-orchestrator/execute", {
      taskType: "conversational-answer",
      inputPayload: { prompt: "synthetic" },
    }, { authorization: "Bearer valid", "x-vireon-user-id": "forged-user" }) as never);
    assert.equal(response.status, 403);
  });

  it("model orchestrator provider metadata requires workspace administration", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "member-user",
        email: "member@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "member",
        },
      }))) as typeof fetch;
    const response = await modelProvidersGet(new Request("https://vireon.test/api/model-orchestrator/providers", {
      headers: { authorization: "Bearer valid" },
    }) as never);
    assert.equal(response.status, 403);
  });

  it("model orchestrator ignores forged identity headers and scopes runs to verified users", async () => {
    setSupabaseEnv();
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "verified-member",
        email: "member@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "member",
        },
      }))) as typeof fetch;
    const execute = await modelExecutePost(jsonRequest("https://vireon.test/api/model-orchestrator/execute", {
      taskType: "conversational-answer",
      inputPayload: { prompt: "synthetic" },
      permittedProviders: ["mock"],
      fallbackAllowed: false,
    }, { authorization: "Bearer valid", "x-vireon-user-id": "forged-user", "x-vireon-session-id": "forged-session" }) as never);
    assert.equal(execute.status, 200);
    const executeBody = await execute.json() as { result?: { runId?: string } };
    assert.ok(executeBody.result?.runId);

    const ownRun = await modelRunGet(new Request(`https://vireon.test/api/model-orchestrator/runs/${executeBody.result.runId}`, {
      headers: { authorization: "Bearer valid", "x-vireon-user-id": "forged-user" },
    }) as never, { params: Promise.resolve({ runId: executeBody.result.runId }) });
    assert.equal(ownRun.status, 200);

    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "other-member",
        email: "other@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-b",
          vireon_org_id: "org-b",
          vireon_role: "member",
        },
      }))) as typeof fetch;
    const otherRun = await modelRunGet(new Request(`https://vireon.test/api/model-orchestrator/runs/${executeBody.result.runId}`, {
      headers: { authorization: "Bearer valid", "x-vireon-user-id": "verified-member" },
    }) as never, { params: Promise.resolve({ runId: executeBody.result.runId }) });
    assert.equal(otherRun.status, 404);

    globalThis.fetch = (() =>
      Promise.resolve(Response.json({
        id: "verified-member",
        email: "member@example.test",
        app_metadata: {
          vireon_workspace_id: "workspace-a",
          vireon_org_id: "org-a",
          vireon_role: "member",
        },
      }))) as typeof fetch;
    const cancel = await modelRunCancelPost(new Request(`https://vireon.test/api/model-orchestrator/runs/${executeBody.result.runId}/cancel`, {
      method: "POST",
      headers: { authorization: "Bearer valid", "x-vireon-user-id": "forged-user" },
    }) as never, { params: Promise.resolve({ runId: executeBody.result.runId }) });
    assert.equal(cancel.status, 200);
    const cancelBody = await cancel.json() as { userId?: string };
    assert.equal(cancelBody.userId, "verified-member");
  });

  it("sensitive API route files are explicitly public, handler guarded, or proxy covered", () => {
    const publicRoutes = new Set([
      "/api/architecture-drift",
      "/api/auth/login",
      "/api/auth/logout",
      "/api/dashboard-metrics",
      "/api/dependency-health",
      "/api/deployment-status",
      "/api/finance-health",
      "/api/financial-intelligence",
      "/api/health",
      "/api/health-score",
      "/api/infrastructure-activation",
      "/api/ingestion-health",
      "/api/insights",
      "/api/memory",
      "/api/merchant-intelligence",
      "/api/platform-status",
      "/api/private-beta/access-requests",
      "/api/private-beta/invitations/redeem",
      "/api/private-beta/request-access",
      "/api/production-status",
      "/api/recommendations",
      "/api/roadmap",
      "/api/system-health",
      "/api/workflow-status",
    ]);
    const routes = routeFiles(join(process.cwd(), "src", "app", "api"));
    assert.equal(routes.length, 122);
    const uncovered = routes
      .map((file) => ({ file, routePath: apiPathForRouteFile(file) }))
      .filter(({ file, routePath }) => !publicRoutes.has(routePath) && !handlerHasGuard(file) && !matcherCovers(routePath))
      .map(({ routePath }) => routePath);
    assert.deepEqual(uncovered, []);
  });

  it("server page auth redirects to a user-facing page instead of an API handler", () => {
    const source = readFileSync(join(process.cwd(), "src", "lib", "auth", "serverPageSession.ts"), "utf-8");
    assert.match(source, /redirect\(`\/login\?returnTo=/);
    assert.doesNotMatch(source, /redirect\(`\/api\/auth\/login/);
    assert.equal(existsSync(join(process.cwd(), "src", "app", "login", "page.tsx")), true);
  });

  it("keeps CSP enforced while permitting framework bootstrap scripts", () => {
    const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");
    assert.match(source, /key: "Content-Security-Policy"/);
    assert.doesNotMatch(source, /Content-Security-Policy-Report-Only/);
    assert.match(source, /script-src \$\{scriptSrc\}/);
    assert.match(source, /process\.env\.NODE_ENV === "production"/);
    assert.match(source, /\? "'self' 'unsafe-inline'"/);
    assert.match(source, /: "'self' 'unsafe-inline' 'unsafe-eval'"/);
    assert.match(source, /frame-ancestors 'none'/);
    assert.match(source, /object-src 'none'/);
  });
});
