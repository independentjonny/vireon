import * as fs from "fs";
import * as path from "path";
import { generateArchitectureMap } from "./architectureMapper";

const AI_DIR = path.join(process.cwd(), ".ai");
const MAP_PATH = path.join(AI_DIR, "architecture", "map.json");

export interface DriftItem {
  type: "added" | "removed";
  kind: "route" | "module";
  name: string;
  detail: string;
}

export interface DriftReport {
  generatedAt: string;
  baselineAt: string | null;
  currentModules: number;
  baselineModules: number;
  currentRoutes: number;
  baselineRoutes: number;
  driftItems: DriftItem[];
  hasDrift: boolean;
  summary: string;
}

interface ArchMapSnapshot {
  generatedAt?: string;
  modules?: { name: string; path: string }[];
  routes?: { route: string; methods: string[] }[];
  summary?: { totalModules: number; totalRoutes: number };
}

export function detectArchitectureDrift(precomputed?: import("./architectureMapper").ArchitectureMap): DriftReport {
  let baseline: ArchMapSnapshot | null = null;
  let baselineAt: string | null = null;

  try {
    baseline = JSON.parse(fs.readFileSync(MAP_PATH, "utf-8")) as ArchMapSnapshot;
    baselineAt = baseline.generatedAt ?? null;
  } catch {
    // no baseline yet
  }

  const current = precomputed ?? generateArchitectureMap();
  const driftItems: DriftItem[] = [];

  if (baseline) {
    const baselineRouteSet = new Set((baseline.routes ?? []).map((r) => r.route));
    const currentRouteSet = new Set(current.routes.map((r) => r.route));

    for (const r of currentRouteSet) {
      if (!baselineRouteSet.has(r)) {
        driftItems.push({
          type: "added",
          kind: "route",
          name: r,
          detail: "New route added since last map",
        });
      }
    }
    for (const r of baselineRouteSet) {
      if (!currentRouteSet.has(r)) {
        driftItems.push({
          type: "removed",
          kind: "route",
          name: r,
          detail: "Route removed since last map",
        });
      }
    }

    const baselineModuleSet = new Set((baseline.modules ?? []).map((m) => m.name));
    const currentModuleSet = new Set(current.modules.map((m) => m.name));

    for (const m of currentModuleSet) {
      if (!baselineModuleSet.has(m)) {
        driftItems.push({
          type: "added",
          kind: "module",
          name: m,
          detail: "New module since last map",
        });
      }
    }
    for (const m of baselineModuleSet) {
      if (!currentModuleSet.has(m)) {
        driftItems.push({
          type: "removed",
          kind: "module",
          name: m,
          detail: "Module removed since last map",
        });
      }
    }
  }

  const baselineModules =
    baseline?.summary?.totalModules ?? (baseline?.modules?.length ?? 0);
  const baselineRoutes =
    baseline?.summary?.totalRoutes ?? (baseline?.routes?.length ?? 0);

  const hasDrift = driftItems.length > 0;
  const added = driftItems.filter((d) => d.type === "added").length;
  const removed = driftItems.filter((d) => d.type === "removed").length;

  const summary = !baseline
    ? "No baseline map — run GET /api/architecture-map to create one"
    : hasDrift
    ? `${added} added, ${removed} removed since ${baselineAt ? new Date(baselineAt).toLocaleDateString() : "last map"}`
    : "No drift — architecture is stable";

  return {
    generatedAt: new Date().toISOString(),
    baselineAt,
    currentModules: current.summary.totalModules,
    baselineModules,
    currentRoutes: current.summary.totalRoutes,
    baselineRoutes,
    driftItems: driftItems.slice(0, 20),
    hasDrift,
    summary,
  };
}
