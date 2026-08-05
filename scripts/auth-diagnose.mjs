import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const AUTH_VARIABLES = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    exposure: "browser-safe",
    consumers: [
      "src/lib/supabase/client.ts",
      "src/lib/supabase/server.ts",
      "src/app/api/auth/login/route.ts",
    ],
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    exposure: "browser-safe publishable credential",
    consumers: [
      "src/lib/supabase/client.ts",
      "src/app/api/auth/login/route.ts",
    ],
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    exposure: "server-only secret",
    consumers: [
      "src/lib/supabase/server.ts",
      "src/lib/auth/middleware.ts (through token verification)",
    ],
  },
];

export function parseEnvPresence(source = "") {
  const result = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const raw = match[2].trim();
    result.set(match[1], { declared: true, nonEmpty: raw.length > 0 && raw !== "''" && raw !== '\"\"' });
  }
  return result;
}

export function diagnoseAuthEnvironment({ env = process.env, envLocalSource = "" } = {}) {
  const local = parseEnvPresence(envLocalSource);
  const variables = AUTH_VARIABLES.map((variable) => ({
    ...variable,
    process: {
      present: Object.prototype.hasOwnProperty.call(env, variable.name),
      nonEmpty: typeof env[variable.name] === "string" && env[variable.name].trim().length > 0,
    },
    envLocal: local.get(variable.name) ?? { declared: false, nonEmpty: false },
  }));
  return {
    ok: variables.every((item) => item.process.nonEmpty || item.envLocal.nonEmpty),
    variables,
    restartRequired: true,
    guidance: "After updating .env.local, fully restart the Next.js development server.",
  };
}

function printReport(report) {
  console.log("Vireon authentication configuration (values never displayed)");
  for (const variable of report.variables) {
    console.log(`- ${variable.name}`);
    console.log(`  classification: ${variable.exposure}`);
    console.log(`  process: ${variable.process.present ? "present" : "missing"}, ${variable.process.nonEmpty ? "non-empty" : "empty/missing"}`);
    console.log(`  .env.local: ${variable.envLocal.declared ? "present" : "missing"}, ${variable.envLocal.nonEmpty ? "non-empty" : "empty/missing"}`);
    console.log(`  consumers: ${variable.consumers.join(", ")}`);
  }
  console.log(report.guidance);
  console.log(report.ok ? "AUTH_CONFIGURATION=READY" : "AUTH_CONFIGURATION=MISSING");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const envPath = resolve(process.cwd(), ".env.local");
  const report = diagnoseAuthEnvironment({
    env: process.env,
    envLocalSource: existsSync(envPath) ? readFileSync(envPath, "utf8") : "",
  });
  printReport(report);
  process.exitCode = report.ok ? 0 : 1;
}
