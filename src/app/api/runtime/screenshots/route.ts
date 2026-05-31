import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, extname, basename } from "path";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const SCREENSHOT_DIRS = [
  join(ROOT, "screenshot"),
  join(ROOT, ".ai", "screenshots"),
];

function safeName(name: string | null): string | null {
  if (!name) return null;
  const clean = basename(name);
  if (!/^[a-z0-9._-]+\.(png|jpg|jpeg|webp)$/i.test(clean)) return null;
  return clean;
}

function findFile(name: string) {
  for (const dir of SCREENSHOT_DIRS) {
    const file = join(dir, name);
    if (existsSync(file)) return file;
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = safeName(url.searchParams.get("name"));

  if (name) {
    const file = findFile(name);
    if (!file) return Response.json({ ok: false, error: "Screenshot not found" }, { status: 404 });
    const ext = extname(file).toLowerCase();
    const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
    return new Response(readFileSync(file), { headers: { "Content-Type": contentType, "Cache-Control": "no-store" } });
  }

  const screenshots = [];
  const seen = new Set<string>();
  for (const dir of SCREENSHOT_DIRS) {
    if (!existsSync(dir)) continue;
    for (const fileName of readdirSync(dir)) {
      if (!safeName(fileName) || seen.has(fileName)) continue;
      const fullPath = join(dir, fileName);
      const stat = statSync(fullPath);
      screenshots.push({
        name: fileName,
        path: fullPath,
        sizeBytes: stat.size,
        updatedAt: new Date(stat.mtimeMs).toISOString(),
        url: `/api/runtime/screenshots?name=${encodeURIComponent(fileName)}`,
      });
      seen.add(fileName);
    }
  }

  screenshots.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  let manifest = null;
  const manifestPath = join(ROOT, "screenshot", "manifest.json");
  if (existsSync(manifestPath)) {
    try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { manifest = null; }
  }

  return Response.json({ ok: true, screenshots, manifest, directories: SCREENSHOT_DIRS });
}
