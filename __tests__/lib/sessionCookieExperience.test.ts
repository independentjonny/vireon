import test from "node:test";
import assert from "node:assert/strict";
import { config, proxy } from "../../src/proxy.ts";
import { GET as getSession } from "../../src/app/api/auth/session/route.ts";

test("browser session lookup verifies the login cookie and preserves user identity", async () => {
  const original = { ...process.env }, fetchBefore = globalThis.fetch;
  try {
    Object.assign(process.env, { NODE_ENV: "test" });
    delete process.env.VIREON_DEV_AUTH_BYPASS;
    delete process.env.NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-key";
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer cookie-token");
      return Response.json({ id: "test-user", email: "user@example.test", app_metadata: { vireon_role: "member", vireon_workspace_id: "w", vireon_org_id: "o" } });
    };
    assert.ok(config.matcher.includes("/api/auth/session"));
    const request = Object.assign(new Request("https://vireon.test/api/auth/session"), { nextUrl: new URL("https://vireon.test/api/auth/session"), cookies: { get: (name: string) => name === "vireon_access_token" ? { value: "cookie-token" } : undefined } });
    const response = await proxy(request as never);
    assert.equal(response.status, 200);
    const authorization = response.headers.get("x-middleware-request-authorization");
    assert.equal(authorization, "Bearer cookie-token");
    const session = await getSession(new Request(request.url, { headers: { authorization: authorization! } }));
    assert.equal(session.status, 200);
    assert.equal((await session.json()).session.userId, "test-user");
    globalThis.fetch = async () => Response.json({ error: "expired" }, { status: 401 });
    assert.equal((await proxy(request as never)).status, 401);
  } finally { process.env = original; globalThis.fetch = fetchBefore; }
});

