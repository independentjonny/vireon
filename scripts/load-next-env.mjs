import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const SENSITIVE_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|URL)$/i;

export function resolveRepoRoot(input = {}) {
  return path.resolve(input.repoRoot || process.env.NEVEN_REPO || process.cwd());
}

export function readEnvLocalNames(repoRoot) {
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) return { path: envPath, exists: false, names: new Set(), values: new Map(), malformed: false };
  const source = fs.readFileSync(envPath, "utf8");
  const names = new Set();
  const values = new Map();
  let malformed = false;
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      names.add(match[1]);
      let value = match[2] ?? "";
      const quoted = value.match(/^(['"])(.*)\1\s*$/);
      value = quoted ? quoted[2] : value.replace(/\s+#.*$/, "").trim();
      values.set(match[1], value);
    }
    else malformed = true;
  }
  return { path: envPath, exists: true, names, values, malformed };
}

export function loadRepositoryNextEnv(options = {}) {
  const repoRoot = resolveRepoRoot(options);
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    throw new Error(`REPOSITORY_ROOT_NOT_FOUND: ${repoRoot}`);
  }
  const envLocal = readEnvLocalNames(repoRoot);
  if (envLocal.malformed && options.failOnMalformed) {
    throw new Error("MALFORMED_ENV_LOCAL");
  }
  const before = new Map(Object.entries(process.env));
  loadEnvConfig(repoRoot, process.env.NODE_ENV === "development", options.logger || { info() {}, error() {} }, false);
  for (const [name, value] of envLocal.values) {
    const hadProcessValue = typeof before.get(name) === "string" && String(before.get(name)).trim().length > 0;
    if (!hadProcessValue && (process.env[name] === undefined || process.env[name] === "")) {
      process.env[name] = value;
    }
  }
  const after = process.env;
  const names = options.variableNames || [];
  const variables = names.map((name) => {
    const present = typeof after[name] === "string" && after[name].trim().length > 0;
    const wasPresent = typeof before.get(name) === "string" && String(before.get(name)).trim().length > 0;
    const declaredInEnvLocal = envLocal.names.has(name);
    return {
      name,
      status: present ? "PRESENT" : "MISSING",
      source: wasPresent ? "process" : present && declaredInEnvLocal ? "repository-env" : present ? "other-env" : "missing",
      valueLogged: false,
    };
  });
  return {
    repoRoot,
    envLocalPath: envLocal.path,
    envLocalExists: envLocal.exists,
    envLocalMalformed: envLocal.malformed,
    sourceLoaded: envLocal.exists ? ".env.local" : "none",
    variables,
  };
}

export function formatEnvDiagnostics(report) {
  const lines = [
    `repositoryRoot=${report.repoRoot}`,
    `environmentSource=${report.sourceLoaded}`,
    `envLocalPath=${report.envLocalPath}`,
    `envLocalExists=${report.envLocalExists ? "true" : "false"}`,
  ];
  for (const variable of report.variables || []) {
    lines.push(`${variable.name}=${variable.status}; source=${variable.source}`);
  }
  return lines.join("\n");
}

export function assertNoSecretValuesInDiagnostics(reportText, env = process.env) {
  for (const [name, value] of Object.entries(env)) {
    if (!SENSITIVE_NAME_PATTERN.test(name)) continue;
    if (typeof value === "string" && value.length >= 8 && reportText.includes(value)) {
      throw new Error(`SECRET_VALUE_LOGGED:${name}`);
    }
  }
}
