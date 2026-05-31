import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();

export interface DependencyCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface DependencyHealthReport {
  generatedAt: string;
  checks: DependencyCheck[];
  routeCount: number;
  scriptCount: number;
  summary: {
    passed: number;
    warned: number;
    failed: number;
    overallHealth: "green" | "yellow" | "red";
  };
}

function checkPackageScripts(): DependencyCheck {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    const scripts = Object.keys(pkg.scripts ?? {});
    const required = ["build", "dev"];
    const missing = required.filter((s) => !scripts.includes(s));
    if (missing.length > 0) {
      return { name: "package-scripts", status: "fail", detail: `Missing scripts: ${missing.join(", ")}` };
    }
    return { name: "package-scripts", status: "pass", detail: `${scripts.length} scripts defined: ${scripts.join(", ")}` };
  } catch {
    return { name: "package-scripts", status: "fail", detail: "Could not read package.json" };
  }
}

function checkLockfile(): DependencyCheck {
  const lockFiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"];
  const found = lockFiles.filter((f) => fs.existsSync(path.join(ROOT, f)));
  if (found.length === 0) {
    return { name: "lockfile", status: "warn", detail: "No lockfile found — reproducible installs not guaranteed" };
  }
  if (found.length > 1) {
    return { name: "lockfile", status: "warn", detail: `Multiple lockfiles: ${found.join(", ")} — use one package manager` };
  }
  return { name: "lockfile", status: "pass", detail: `${found[0]} present` };
}

function checkNextConfig(): DependencyCheck {
  const candidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
  const found = candidates.find((f) => fs.existsSync(path.join(ROOT, f)));
  if (!found) {
    return { name: "next-config", status: "warn", detail: "No next.config file found" };
  }
  return { name: "next-config", status: "pass", detail: `${found} present` };
}

function checkEnvPlaceholders(): DependencyCheck {
  const candidates = [".env.example", ".env.local.example", ".env.template"];
  const found = candidates.find((f) => fs.existsSync(path.join(ROOT, f)));
  if (!found) {
    return { name: "env-placeholders", status: "warn", detail: "No .env.example file — document required env vars" };
  }
  return { name: "env-placeholders", status: "pass", detail: `${found} present` };
}

function countRoutes(): number {
  const apiDir = path.join(ROOT, "src", "app", "api");
  if (!fs.existsSync(apiDir)) return 0;
  let count = 0;
  function scan(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scan(path.join(dir, entry.name));
        } else if (entry.name === "route.ts" || entry.name === "route.js") {
          count++;
        }
      }
    } catch { /* ignore */ }
  }
  scan(apiDir);
  return count;
}

function checkRouteCountDrift(): DependencyCheck {
  const snapshotPath = path.join(ROOT, ".ai", "architecture", "route-count-snapshot.json");
  const current = countRoutes();
  let prevCount: number | null = null;
  try {
    if (fs.existsSync(snapshotPath)) {
      prevCount = (JSON.parse(fs.readFileSync(snapshotPath, "utf-8")) as { count: number }).count;
    }
  } catch { /* ignore */ }

  if (prevCount === null) {
    fs.mkdirSync(path.join(ROOT, ".ai", "architecture"), { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify({ count: current, recordedAt: new Date().toISOString() }, null, 2));
    return { name: "route-count-drift", status: "pass", detail: `${current} routes — baseline recorded` };
  }

  const drift = Math.abs(current - prevCount);
  if (drift > 5) {
    return { name: "route-count-drift", status: "warn", detail: `Route count changed from ${prevCount} to ${current} (drift: ${drift})` };
  }
  return { name: "route-count-drift", status: "pass", detail: `${current} routes (prev: ${prevCount}, drift: ${drift})` };
}

function checkTsConfig(): DependencyCheck {
  const tsConfigPath = path.join(ROOT, "tsconfig.json");
  if (!fs.existsSync(tsConfigPath)) {
    return { name: "tsconfig", status: "fail", detail: "tsconfig.json not found" };
  }
  try {
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, "utf-8"));
    const hasStrict = tsConfig.compilerOptions?.strict === true;
    return {
      name: "tsconfig",
      status: "pass",
      detail: `tsconfig.json present. strict=${hasStrict}`,
    };
  } catch {
    return { name: "tsconfig", status: "warn", detail: "Could not parse tsconfig.json" };
  }
}

export function scanDependencyHealth(): DependencyHealthReport {
  const checks: DependencyCheck[] = [
    checkPackageScripts(),
    checkLockfile(),
    checkNextConfig(),
    checkEnvPlaceholders(),
    checkRouteCountDrift(),
    checkTsConfig(),
  ];

  const routeCount = countRoutes();

  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
  } catch { /* ignore */ }
  const scriptCount = Object.keys((pkg.scripts as Record<string, string>) ?? {}).length;

  const passed = checks.filter((c) => c.status === "pass").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const overallHealth = failed > 0 ? "red" : warned > 0 ? "yellow" : "green";

  return {
    generatedAt: new Date().toISOString(),
    checks,
    routeCount,
    scriptCount,
    summary: { passed, warned, failed, overallHealth },
  };
}
