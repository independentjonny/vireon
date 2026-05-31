import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PRIMARY_DIR = join(ROOT, "screenshot");
const AI_DIR = join(ROOT, ".ai", "screenshots");
const baseUrl = process.env.NEVEN_BASE_URL || process.argv[2] || "http://localhost:3000";

mkdirSync(PRIMARY_DIR, { recursive: true });
mkdirSync(AI_DIR, { recursive: true });

const targets = [
  { url: `${baseUrl}/`, file: "fullpage.png", label: "Full page" },
  { url: `${baseUrl}/#overview`, file: "overview.png", label: "Overview" },
  { url: `${baseUrl}/#build-automation`, file: "build-automation.png", label: "Build automation" },
  { url: `${baseUrl}/#deployment`, file: "deployment.png", label: "Deployment" },
];

async function captureTarget(context, target) {
  const page = await context.newPage();
  const consoleMessages = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (!text.includes("Download the React DevTools")) {
      consoleMessages.push({ type: msg.type(), text: text.slice(0, 1000) });
    }
  });

  await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("main", { timeout: 30000 });
  await page.waitForTimeout(1200);

  const primaryPath = join(PRIMARY_DIR, target.file);
  const aiPath = join(AI_DIR, target.file);
  await page.screenshot({ path: primaryPath, fullPage: true });
  await page.screenshot({ path: aiPath, fullPage: true });
  await page.close();

  return {
    ...target,
    ok: true,
    primaryPath,
    aiPath,
    consoleMessages,
    capturedAt: new Date().toISOString(),
  };
}

const results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: Number(process.env.NEVEN_SCREENSHOT_WIDTH || 1440), height: Number(process.env.NEVEN_SCREENSHOT_HEIGHT || 1200) },
    deviceScaleFactor: 1,
  });

  for (const target of targets) {
    try {
      const result = await captureTarget(context, target);
      results.push(result);
      console.log(`Saved ${target.label}: ${result.primaryPath}`);
    } catch (error) {
      const failed = { ...target, ok: false, error: String(error), capturedAt: new Date().toISOString() };
      results.push(failed);
      console.error(`Screenshot failed for ${target.label}: ${String(error)}`);
    }
  }
} finally {
  if (browser) await browser.close();
}

const manifest = {
  ok: results.every((r) => r.ok),
  baseUrl,
  outputDirectories: [PRIMARY_DIR, AI_DIR],
  results,
  generatedAt: new Date().toISOString(),
};

writeFileSync(join(PRIMARY_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(AI_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

if (!manifest.ok) process.exitCode = 1;
