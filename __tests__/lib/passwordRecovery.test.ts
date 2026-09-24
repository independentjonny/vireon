import test from "node:test";
import assert from "node:assert/strict";
import { handlePasswordRecovery, recoveryRedirect } from "../../src/lib/auth/passwordRecovery.ts";

const env = { NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public-key", VERCEL_URL: "preview.example.test" } as NodeJS.ProcessEnv;
const request = (body: unknown, token?: string, origin = "https://preview.example.test") => new Request("https://preview.example.test/api/auth/recovery", { method: "POST", headers: { origin, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

test("recovery sends the requested email to Supabase with a configured fixed callback", async () => {
  let calls = 0;
  const response = await handlePasswordRecovery(request({ email: " user@example.test ", redirectTo: "https://evil.test" }), "request", { env, fetchImpl: async (input, init) => {
    calls++;
    assert.equal(String(input), "https://project.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Fpreview.example.test%2Flogin%2Freset-password");
    assert.deepEqual(JSON.parse(String(init?.body)), { email: "user@example.test" });
    assert.equal(new Headers(init?.headers).get("apikey"), "test-public-key");
    return Response.json({});
  } });
  assert.equal(calls, 1); assert.equal(response.status, 200);
  assert.match((await response.json()).message, /If an account exists/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("cross-origin and malformed inputs never reach the provider", async () => {
  const fetchImpl: typeof fetch = async () => { throw new Error("Provider must not be called"); };
  assert.equal((await handlePasswordRecovery(request({ email: "u@example.test" }, undefined, "https://evil.test"), "request", { env, fetchImpl })).status, 403);
  assert.equal((await handlePasswordRecovery(request({ email: 12 }), "request", { env, fetchImpl })).status, 400);
  assert.equal((await handlePasswordRecovery(request(null), "request", { env, fetchImpl })).status, 400);
  assert.equal((await handlePasswordRecovery(request({ password: "1234567890", confirmPassword: "1234567890" }), "update", { env, fetchImpl })).status, 401);
});
test("reset validates matching passwords before an authenticated provider update", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    calls++; assert.equal(String(input), "https://project.supabase.co/auth/v1/user"); assert.equal(init?.method, "PUT");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer recovery-test-token");
    assert.deepEqual(JSON.parse(String(init?.body)), { password: "test-new-password" });
    return Response.json({ id: "test-user" });
  };
  const invalid = await handlePasswordRecovery(request({ password: "test-new-password", confirmPassword: "different" }, "recovery-test-token"), "update", { env, fetchImpl });
  assert.equal(invalid.status, 400); assert.equal(calls, 0);
  const response = await handlePasswordRecovery(request({ password: "test-new-password", confirmPassword: "test-new-password" }, "recovery-test-token"), "update", { env, fetchImpl });
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.match(response.headers.get("set-cookie") ?? "", /vireon_access_token=;.*Max-Age=0; Secure/);
  assert.doesNotMatch(await response.text(), /recovery-test-token|test-new-password/);
});
test("expired recovery tokens fail without creating a session or leaking provider errors", async () => {
  const response = await handlePasswordRecovery(request({ password: "test-new-password", confirmPassword: "test-new-password" }, "expired-test-token"), "update", { env, fetchImpl: async () => Response.json({ error: "private provider details" }, { status: 401 }) });
  assert.equal(response.status, 401); assert.equal(response.headers.get("set-cookie"), null);
  assert.match(await response.text(), /invalid or expired/);
});
test("rate limiting and service failures are actionable", async () => {
  for (const status of [429, 500]) {
    const response = await handlePasswordRecovery(request({ email: "user@example.test" }), "request", { env, fetchImpl: async () => Response.json({}, { status }) });
    assert.equal(response.status, status === 429 ? 429 : 503);
  }
});
test("unknown accounts remain private while email configuration errors are not reported as success", async () => {
  const run = (code: string) => handlePasswordRecovery(request({ email: "user@example.test" }), "request", { env, fetchImpl: async () => Response.json({ code }, { status: 400 }) });
  assert.equal((await run("user_not_found")).status, 200);
  assert.equal((await run("captcha_failed")).status, 503);
});
test("recovery redirect never trusts an arbitrary production Host or body redirect", () => {
  assert.throws(() => recoveryRedirect("https://evil.test", { NODE_ENV: "production" }), /RECOVERY_ORIGIN/);
  assert.throws(() => recoveryRedirect("https://preview.example.test", { ...env, VIREON_PASSWORD_RESET_ORIGIN: "http://insecure.test" }), /RECOVERY_ORIGIN/);
  assert.equal(recoveryRedirect("http://localhost:3027", { NODE_ENV: "development" }), "http://localhost:3027/login/reset-password");
});
