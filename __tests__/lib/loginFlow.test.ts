import test from "node:test";
import assert from "node:assert/strict";
import { POST as login } from "../../src/app/api/auth/login/route.ts";
import { POST as logout } from "../../src/app/api/auth/logout/route.ts";

test("Supabase password login creates a secure server-readable session cookie", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/auth/v1/token?grant_type=password")) {
      assert.equal(init?.method, "POST");
      return Response.json({ access_token: "verified-access-token", expires_in: 3600 });
    }
    assert.equal(String(input), "https://project.supabase.co/auth/v1/user");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer verified-access-token");
    return Response.json({ id: "user-1", email: "user@example.com", app_metadata: { vireon_workspace_id: "workspace-1", vireon_org_id: "org-1", vireon_role: "owner" } });
  };
  try {
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password" }),
    }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") ?? "", /vireon_access_token=verified-access-token/);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Lax/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("login rejects a Supabase account that has no Vireon workspace membership", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => String(input).endsWith("/auth/v1/token?grant_type=password")
    ? Response.json({ access_token: "unscoped-access-token", expires_in: 3600 })
    : Response.json({ id: "user-2", email: "unscoped@example.com", app_metadata: {} });
  try {
    const response = await login(new Request("https://vireon.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "unscoped@example.com", password: "password" }),
    }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.match(await response.text(), /workspace access is not configured/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid Supabase credentials fail without setting a cookie", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "invalid_grant" }, { status: 400 });
  try {
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "wrong-password" }),
    }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("logout expires the Vireon session cookie", async () => {
  const response = await logout();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /vireon_access_token=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});
