import assert from "node:assert/strict";
import test from "node:test";
import {
  redactPostgresPilotText,
  redactPostgresPilotValue,
  stringifyPostgresPilotReport,
} from "../../src/lib/postgresPilotRedaction.ts";

const secret = "s'e:c@r/e?t#%!\nnext";

test("PostgreSQL pilot redaction scrubs CREATE ROLE PASSWORD SQL", () => {
  const input = "create role vireon_app login password 'secret';";
  assert.equal(redactPostgresPilotText(input), "create role vireon_app login password '<redacted>';");
});

test("PostgreSQL pilot redaction scrubs ALTER ROLE PASSWORD SQL", () => {
  const input = "alter role vireon_app password 'secret';";
  assert.equal(redactPostgresPilotText(input), "alter role vireon_app password '<redacted>';");
});

test("PostgreSQL pilot redaction scrubs multiline role password SQL", () => {
  const input = "do $$\nbegin\n  alter role vireon_app\n  password 'secret';\nend $$;";
  const output = redactPostgresPilotText(input);
  assert.equal(output.includes("'secret'"), false);
  assert.equal(output.includes("password '<redacted>'"), true);
});

test("PostgreSQL pilot redaction scrubs connection URL userinfo", () => {
  const output = redactPostgresPilotText("postgresql://postgres:admin-secret@example.test/postgres?sslmode=require");
  assert.equal(output.includes("admin-secret"), false);
  assert.equal(output.includes("postgres://<redacted>@example.test"), true);
});

test("PostgreSQL pilot redaction scrubs PGPASSWORD values", () => {
  assert.equal(redactPostgresPilotText("PGPASSWORD=secret"), "PGPASSWORD=<redacted>");
  assert.equal(redactPostgresPilotText('"PGPASSWORD":"secret"'), '"PGPASSWORD":<redacted>');
});

test("PostgreSQL pilot redaction scrubs supplied secrets with quotes and special characters", () => {
  const output = redactPostgresPilotText(`stderr includes ${secret}`, [secret]);
  assert.equal(output.includes(secret), false);
  assert.equal(output.includes("<redacted-secret>"), true);
});

test("PostgreSQL pilot redaction scrubs nested process timeline objects", () => {
  const report = redactPostgresPilotValue({
    databaseProcessTimeline: [
      {
        argv: [
          "psql",
          "postgresql://postgres:admin-secret@example.test/postgres?sslmode=require",
          "--command",
          "alter role vireon_app password 'runtime-secret';",
        ],
        env: {
          PGPASSWORD: "runtime-secret",
        },
      },
    ],
  }, ["runtime-secret", "admin-secret"]);
  const output = JSON.stringify(report);
  assert.equal(output.includes("runtime-secret"), false);
  assert.equal(output.includes("admin-secret"), false);
  assert.equal(output.includes("password '<redacted>'"), true);
});

test("PostgreSQL pilot report stringify scrubs stderr and stdout", () => {
  const output = stringifyPostgresPilotReport({
    stderr: "ERROR near alter role vireon_app password 'secret';",
    stdout: "postgresql://postgres:admin-secret@example.test/postgres",
  }, ["secret", "admin-secret"]);
  assert.equal(output.includes("secret"), false);
  assert.equal(output.includes("admin-secret"), false);
  assert.equal(output.includes("<redacted>"), true);
});
