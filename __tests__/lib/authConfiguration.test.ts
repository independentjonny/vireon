import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_VARIABLES, diagnoseAuthEnvironment } from "../../scripts/auth-diagnose.mjs";

const complete = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "configured-url",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "configured-publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "configured-server-key",
} as const;

test("missing authentication environment fails explicitly", () => {
  const result = diagnoseAuthEnvironment({ env: { NODE_ENV: "test" }, envLocalSource: "" });
  assert.equal(result.ok, false);
  assert.deepEqual(result.variables.map((item) => item.name), [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  assert.ok(result.variables.every((item) => !item.process.nonEmpty && !item.envLocal.nonEmpty));
});

test("complete authentication environment initializes safely", () => {
  assert.equal(diagnoseAuthEnvironment({ env: complete }).ok, true);
});

test("partial authentication configuration fails safely", () => {
  const result = diagnoseAuthEnvironment({
    env: { NODE_ENV: "test", NEXT_PUBLIC_SUPABASE_URL: complete.NEXT_PUBLIC_SUPABASE_URL },
  });
  assert.equal(result.ok, false);
  assert.equal(result.variables.find((item) => item.name === "NEXT_PUBLIC_SUPABASE_URL")?.process.nonEmpty, true);
  assert.equal(result.variables.find((item) => item.name === "NEXT_PUBLIC_SUPABASE_ANON_KEY")?.process.nonEmpty, false);
});

test("service-role credential is classified server-only and never as a browser consumer", () => {
  const service = AUTH_VARIABLES.find((item) => item.name === "SUPABASE_SERVICE_ROLE_KEY");
  assert.equal(service?.exposure, "server-only secret");
  assert.ok(service?.consumers.every((path) => !path.includes("supabase/client.ts")));
});

test(".env.local presence checks expose metadata rather than values", () => {
  const result = diagnoseAuthEnvironment({
    env: { NODE_ENV: "test" },
    envLocalSource: [
      "NEXT_PUBLIC_SUPABASE_URL=private-value-one",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=private-value-two",
      "SUPABASE_SERVICE_ROLE_KEY=private-value-three",
    ].join("\n"),
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /private-value/);
});
