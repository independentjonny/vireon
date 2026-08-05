import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  buildApplicationPsqlInvocation,
  buildSanitizedPsqlEnvironment,
} from "../src/lib/postgresPilotBootstrap.ts";
import { POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV } from "../src/lib/postgresPilotRoleProvisioning.ts";
import { redactPostgresPilotText, stringifyPostgresPilotReport } from "../src/lib/postgresPilotRedaction.ts";

function redact(value) {
  return redactPostgresPilotText(value, [process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV]]);
}

function resolvePsqlExecutable(command) {
  if (process.platform === "win32") {
    const result = spawnSync("where.exe", [command], { encoding: "utf8", timeout: 5_000 });
    return (result.stdout || "").trim().split(/\r?\n/).filter(Boolean)[0] || command;
  }
  const result = spawnSync("command", ["-v", command], { encoding: "utf8", timeout: 5_000, shell: true });
  return (result.stdout || "").trim().split(/\r?\n/).filter(Boolean)[0] || command;
}

function passwordBytes(value) {
  const buffer = Buffer.from(value || "", "utf8");
  return {
    byteLength: buffer.length,
    utf8HexFingerprint: createHash("sha256").update(buffer).digest("hex").slice(0, 12),
    firstByte: buffer.length > 0 ? buffer[0] : null,
    lastByte: buffer.length > 0 ? buffer[buffer.length - 1] : null,
    containsNullByte: buffer.includes(0),
    containsCR: buffer.includes(13),
    containsLF: buffer.includes(10),
  };
}

function selectedEnv(env) {
  const keys = Object.keys(env);
  const count = (name) => keys.filter((key) => key.toUpperCase() === name).length;
  return {
    keyCount: keys.length,
    duplicateSensitiveKeys: {
      PGPASSWORD: count("PGPASSWORD"),
      PGSSLMODE: count("PGSSLMODE"),
      PGUSER: count("PGUSER"),
      PGSERVICE: count("PGSERVICE"),
      PGPASSFILE: count("PGPASSFILE"),
    },
    hasVireonKeys: keys.some((key) => key.startsWith("VIREON_")),
    pgPassword: env.PGPASSWORD ? "<present>" : null,
    pgSslMode: env.PGSSLMODE || null,
  };
}

function run(label, executable, args, env) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
    env,
    shell: false,
    windowsHide: true,
  });
  return {
    label,
    ok: result.status === 0,
    status: result.status,
    stdout: redact(result.stdout || "").trim(),
    stderr: redact(result.stderr || "").trim(),
    environment: selectedEnv(env),
  };
}

const applicationUrl = process.env.VIREON_PILOT_APPLICATION_DATABASE_URL;
const password = process.env[POSTGRES_PILOT_APPLICATION_ROLE_PASSWORD_ENV];
const invocation = buildApplicationPsqlInvocation({ applicationUrl, password });

if (!applicationUrl || !password || !invocation.ok) {
  console.error(stringifyPostgresPilotReport({
    ok: false,
    status: "POSTGRES PILOT VERIFY ROLE ISOLATION BLOCKED",
    reason: invocation.reason || "missing application URL or password",
  }, [password]));
  process.exit(1);
}

const executable = resolvePsqlExecutable(process.env.VIREON_PILOT_PSQL_COMMAND || "psql");
const args = [
  ...invocation.baseArgs,
  "-c",
  "select current_user || '|' || session_user;",
];
const minimalEnv = buildSanitizedPsqlEnvironment({
  baseEnv: process.env,
  password,
  sslMode: invocation.sslMode,
});
const inheritedEnv = {
  ...process.env,
  PGPASSWORD: password,
  PGSSLMODE: invocation.sslMode || "require",
  PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || "10",
};

const report = {
  ok: true,
  status: "POSTGRES PILOT VERIFY ROLE ISOLATION COMPLETE",
  executable,
  argv: [...invocation.baseArgs, "-c", "<identity sql>"],
  username: invocation.connectionUsername,
  host: invocation.host,
  database: invocation.database,
  passwordByteDiagnostics: {
    sourceApplicationPassword: passwordBytes(password),
    minimalPgPassword: passwordBytes(minimalEnv.PGPASSWORD),
    inheritedPgPassword: passwordBytes(inheritedEnv.PGPASSWORD),
  },
  minimalEnvironmentResult: run("minimal child environment", executable, args, minimalEnv),
  inheritedEnvironmentResult: run("full inherited environment", executable, args, inheritedEnv),
};

console.log(stringifyPostgresPilotReport(report, [password]));
process.exit(report.minimalEnvironmentResult.ok && report.inheritedEnvironmentResult.ok ? 0 : 1);
