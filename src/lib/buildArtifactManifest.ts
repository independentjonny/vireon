import * as fs from "fs";
import * as path from "path";

const AI_DIR = path.join(process.cwd(), ".ai");
const ARTIFACTS_DIR = path.join(AI_DIR, "builds", "artifacts");

export interface BuildArtifact {
  buildId: string;
  createdAt: string;
  routeCount: number;
  diffStat: string;
  screenshotPath: string | null;
  releaseCandidateReport: string | null;
  dependencyHealth: { overall: string; passed: number; warned: number; failed: number } | null;
  architectureMapPath: string | null;
  reportPath: string | null;
  notes: string;
}

export interface ArtifactManifest {
  updatedAt: string;
  totalBuilds: number;
  artifacts: BuildArtifact[];
}

function ensureArtifactsDir(): void {
  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const MANIFEST_PATH = path.join(ARTIFACTS_DIR, "manifest.json");

function readManifest(): ArtifactManifest {
  ensureArtifactsDir();
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as ArtifactManifest;
    }
  } catch { /* ignore */ }
  return { updatedAt: new Date().toISOString(), totalBuilds: 0, artifacts: [] };
}

function writeManifest(manifest: ArtifactManifest): void {
  ensureArtifactsDir();
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}

export function recordBuildArtifact(artifact: Omit<BuildArtifact, "createdAt">): BuildArtifact {
  const full: BuildArtifact = { ...artifact, createdAt: new Date().toISOString() };
  const manifest = readManifest();
  manifest.artifacts.unshift(full);
  manifest.artifacts = manifest.artifacts.slice(0, 50);
  manifest.totalBuilds = manifest.artifacts.length;
  writeManifest(manifest);
  const artifactFilePath = path.join(ARTIFACTS_DIR, `${artifact.buildId}.json`);
  fs.writeFileSync(artifactFilePath, JSON.stringify(full, null, 2), "utf-8");
  return full;
}

export function getArtifactManifest(): ArtifactManifest {
  return readManifest();
}

export function getArtifact(buildId: string): BuildArtifact | null {
  try {
    const p = path.join(ARTIFACTS_DIR, `${buildId}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8")) as BuildArtifact;
  } catch { /* ignore */ }
  return null;
}

export function buildCurrentArtifactSnapshot(buildId: string, routeCount: number, diffStat: string): BuildArtifact {
  const screenshotPath = fs.existsSync(path.join(AI_DIR, "browser-check.png"))
    ? ".ai/browser-check.png"
    : null;
  const releaseCandidateReport = fs.existsSync(path.join(AI_DIR, "releases", "latest.json"))
    ? ".ai/releases/latest.json"
    : null;
  const architectureMapPath = fs.existsSync(path.join(AI_DIR, "architecture", "map.json"))
    ? ".ai/architecture/map.json"
    : null;
  const reportPath = fs.existsSync(path.join(AI_DIR, "claude-report.json"))
    ? ".ai/claude-report.json"
    : null;

  return recordBuildArtifact({
    buildId,
    routeCount,
    diffStat: diffStat.slice(0, 500),
    screenshotPath,
    releaseCandidateReport,
    dependencyHealth: null,
    architectureMapPath,
    reportPath,
    notes: `Artifact snapshot at ${new Date().toISOString()}`,
  });
}
