import * as fs from "fs";
import * as path from "path";

const SRC = path.join(process.cwd(), "src");
const AI_DIR = path.join(process.cwd(), ".ai");

export interface ModuleInfo {
  name: string;
  path: string;
  type: "domain-service" | "api-adapter" | "persistence" | "runtime-control" | "ui-composition" | "utility";
  lineCount: number;
  exports: string[];
}

export interface RouteInfo {
  route: string;
  fsPath: string;
  methods: string[];
}

export interface ArchitectureMap {
  generatedAt: string;
  modules: ModuleInfo[];
  routes: RouteInfo[];
  domainBoundaries: Record<string, string[]>;
  dataFlows: { from: string; to: string; via: string }[];
  riskAreas: { file: string; risk: string; severity: "low" | "medium" | "high" }[];
  summary: {
    totalModules: number;
    totalRoutes: number;
    liveRoutes: number;
    scaffoldRoutes: number;
    riskCount: number;
  };
}

function countLines(filePath: string): number {
  try {
    return fs.readFileSync(filePath, "utf-8").split("\n").length;
  } catch {
    return 0;
  }
}

function extractExports(filePath: string): string[] {
  try {
    const src = fs.readFileSync(filePath, "utf-8");
    const matches = src.match(/^export (?:function|const|class|type|interface) (\w+)/gm) ?? [];
    return matches.map((m) => m.replace(/^export (?:function|const|class|type|interface) /, ""));
  } catch {
    return [];
  }
}

function classifyModule(name: string): ModuleInfo["type"] {
  if (["financeService", "merchantService", "subscriptionService"].includes(name)) return "domain-service";
  if (["localStore", "db"].includes(name)) return "persistence";
  if (name.includes("persistence") || name.includes("schema") || name.includes("repositories")) return "persistence";
  if (["runtimeControl", "daemonRuntime", "semanticDiffVerifier", "architectureMapper", "buildPipeline", "dependencyScanner"].includes(name)) return "runtime-control";
  if (name.includes("Engine") || name.includes("Agent") || name.includes("Loop") || name.includes("Planner")) return "utility";
  return "utility";
}

function scanLibModules(): ModuleInfo[] {
  const libDir = path.join(SRC, "lib");
  if (!fs.existsSync(libDir)) return [];
  const modules: ModuleInfo[] = [];

  function scanDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        const name = entry.name.replace(".ts", "");
        const rel = path.relative(SRC, full).replace(/\\/g, "/");
        modules.push({
          name,
          path: rel,
          type: classifyModule(name),
          lineCount: countLines(full),
          exports: extractExports(full),
        });
      }
    }
  }

  scanDir(libDir);
  return modules;
}

function scanApiRoutes(): RouteInfo[] {
  const apiDir = path.join(SRC, "app", "api");
  if (!fs.existsSync(apiDir)) return [];
  const routes: RouteInfo[] = [];

  function scanDir(dir: string, prefix = "/api"): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full, `${prefix}/${entry.name}`);
      } else if (entry.name === "route.ts" || entry.name === "route.js") {
        try {
          const src = fs.readFileSync(full, "utf-8");
          const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) =>
            new RegExp(`export async function ${m}|export function ${m}`).test(src)
          );
          routes.push({
            route: prefix,
            fsPath: path.relative(SRC, full).replace(/\\/g, "/"),
            methods,
          });
        } catch {
          // skip
        }
      }
    }
  }

  scanDir(apiDir);
  return routes;
}

function buildDomainBoundaries(modules: ModuleInfo[]): Record<string, string[]> {
  const boundaries: Record<string, string[]> = {
    "Domain Services": [],
    "API Adapters": [],
    "Local Persistence": [],
    "Runtime Control": [],
    "UI Composition": [],
    "Utilities": [],
  };
  for (const m of modules) {
    switch (m.type) {
      case "domain-service": boundaries["Domain Services"].push(m.name); break;
      case "api-adapter": boundaries["API Adapters"].push(m.name); break;
      case "persistence": boundaries["Local Persistence"].push(m.name); break;
      case "runtime-control": boundaries["Runtime Control"].push(m.name); break;
      case "ui-composition": boundaries["UI Composition"].push(m.name); break;
      default: boundaries["Utilities"].push(m.name);
    }
  }
  return boundaries;
}

function detectRiskAreas(modules: ModuleInfo[], routes: RouteInfo[]): ArchitectureMap["riskAreas"] {
  const risks: ArchitectureMap["riskAreas"] = [];
  for (const m of modules) {
    if (m.lineCount > 500) {
      risks.push({ file: m.path, risk: `Large file (${m.lineCount} lines) — consider splitting`, severity: "medium" });
    }
    if (m.lineCount > 800) {
      risks.push({ file: m.path, risk: `Very large file (${m.lineCount} lines) — high coupling risk`, severity: "high" });
    }
  }
  if (routes.length === 0) {
    risks.push({ file: "src/app/api", risk: "No API routes detected", severity: "high" });
  }
  return risks;
}

export function generateArchitectureMap(): ArchitectureMap {
  const modules = scanLibModules();
  const routes = scanApiRoutes();
  const domainBoundaries = buildDomainBoundaries(modules);
  const riskAreas = detectRiskAreas(modules, routes);

  const dataFlows: ArchitectureMap["dataFlows"] = [
    { from: "browser", to: "Next.js API routes", via: "HTTP GET/POST" },
    { from: "API routes", to: "domain-services", via: "function call" },
    { from: "domain-services", to: "localStore", via: "read/write JSON" },
    { from: "localStore", to: ".ai/local-data/", via: "fs read/write" },
    { from: "runtimeControl", to: ".ai/daemon-state.json", via: "fs read" },
    { from: "buildPipeline", to: ".ai/builds/", via: "fs write" },
    { from: "architectureMapper", to: ".ai/architecture/", via: "fs write" },
  ];

  const map: ArchitectureMap = {
    generatedAt: new Date().toISOString(),
    modules,
    routes,
    domainBoundaries,
    dataFlows,
    riskAreas,
    summary: {
      totalModules: modules.length,
      totalRoutes: routes.length,
      liveRoutes: routes.filter((r) => r.methods.includes("GET")).length,
      scaffoldRoutes: routes.filter((r) => r.methods.length === 0).length,
      riskCount: riskAreas.length,
    },
  };

  return map;
}

export function persistArchitectureMap(map: ArchitectureMap): void {
  const archDir = path.join(AI_DIR, "architecture");
  if (!fs.existsSync(archDir)) fs.mkdirSync(archDir, { recursive: true });
  fs.writeFileSync(path.join(archDir, "map.json"), JSON.stringify(map, null, 2), "utf-8");
}
