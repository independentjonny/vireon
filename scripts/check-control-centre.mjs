import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { checkGeometry, checkRaster } from "../tools/control-centre-checker/assertions.mjs";

const root = process.cwd(), out = path.join(root, ".verification/control-centre");
const npm = process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
await fs.mkdir(out, { recursive: true });
const write = (name, value) => fs.writeFile(path.join(out, name), JSON.stringify(value, null, 2));
async function command(args, name, env = {}) {
  const log = createWriteStream(path.join(out, name + ".log"));
  const processChild = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  processChild.stdout.pipe(log); processChild.stderr.pipe(log);
  const code = await new Promise((resolve, reject) => { processChild.once("error", reject); processChild.once("exit", resolve); });
  await new Promise(resolve => log.end(resolve));
  if (code !== 0) throw new Error(`${name} failed (${code}); see ${path.relative(root, out)}/${name}.log`);
}
const stage = process.argv[2];
if (!stage) {
  await command([npm, "run", "verify:outcome", "--", ".ai/verification-task.json"], "outcome", { VIREON_VERIFICATION_RECEIPT: ".verification/control-centre/receipt.json" });
  await command([npm, "run", "completion:check"], "completion", { VIREON_VERIFICATION_RECEIPT: ".verification/control-centre/receipt.json" });
  console.log("Control Centre checker passed. Receipt: .verification/control-centre/receipt.json");
} else if (stage === "quality") {
  for (const [name, args, env] of [
    ["checker-self-tests", ["--test", "tests/control-centre-checker.test.mjs", "tests/completion-gate.test.mjs", "tests/local-store-isolation.test.mjs"], {}],
    ["tests", [npm, "test"], { VIREON_ENABLE_LIVE_PG_RUNTIME_TESTS: "true", VIREON_ENABLE_LIVE_FUNDING_TESTS: "true", NODE_ENV: "test", LOCAL_DATA_DIR_OVERRIDE: path.join(out, "legacy-test-data") }],
    ["typecheck", [npm, "run", "typecheck"], {}],
    ["lint", [npm, "run", "lint"], {}],
    ["build", [npm, "run", "build"], {}],
  ]) { console.log(`Checking ${name}`); await command(args, name, env); }
  if (existsSync("src/app/funding-qa-preview")) throw new Error("Temporary fixture exists in production router");
  await write("quality.json", { passed: true, checks: ["checker negative tests", "full unit and live PostgreSQL suite", "typecheck", "lint", "production build", "no fixture route"], authenticatedBrowser: false, deployed: false });
} else if (stage === "ui") {
  const harness = path.join(root, ".verification/control-centre-harness");
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, "127.0.0.1", () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  await fs.mkdir(path.join(harness, "app/goals"), { recursive: true });
  await fs.writeFile(path.join(harness, "package.json"), JSON.stringify({ name: "vireon-isolated-checker", private: true }));
  await fs.writeFile(path.join(harness, "tsconfig.json"), JSON.stringify({ extends: "../../tsconfig.json", compilerOptions: { paths: { "@/*": ["../../src/*"] } }, include: ["app/**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }));
  await fs.writeFile(path.join(harness, "next.config.mjs"), `export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
  await fs.copyFile("postcss.config.mjs", path.join(harness, "postcss.config.mjs"));
  await fs.cp("public", path.join(harness, "public"), { recursive: true });
  await fs.writeFile(path.join(harness, "app/checker.css"), '@import "../../../src/app/globals.css"; @source "../../../src";');
  await fs.writeFile(path.join(harness, "app/layout.tsx"), 'import "./checker.css"; export { default, metadata } from "../../../src/app/layout";');
  await fs.writeFile(path.join(harness, "app/page.tsx"), 'export { default } from "../../../tools/control-centre-checker/Fixture";');
  await fs.writeFile(path.join(harness, "app/goals/page.tsx"), 'export { GoalsFixture as default } from "../../../../tools/control-centre-checker/Fixture";');
  const log = createWriteStream(path.join(out, "server.log"));
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", harness, "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  server.stdout.pipe(log); server.stderr.pipe(log);
  try {
    let ready = false;
    for (let n = 0; n < 90; n++) { try { const r = await fetch(`http://127.0.0.1:${port}`); if (r.ok) { ready = true; break; } if (r.status >= 500) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
    if (!ready) throw new Error("Isolated UI server did not become ready; see server.log");
    await command(["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "tools/control-centre-checker/browser.mjs"], "browser", { VIREON_CHECKER_BASE: `http://127.0.0.1:${port}`, VIREON_CHECKER_OUT: out });
  } finally {
    // taskkill targets only the server process tree created above, not other dev sessions.
    if (process.platform === "win32") await new Promise(resolve => { const stop = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); stop.once("exit", resolve); stop.once("error", resolve); });
    else server.kill("SIGTERM");
    log.end();
  }
} else if (stage === "interaction") {
  const ui = JSON.parse(await fs.readFile(path.join(out, "ui.json"), "utf8"));
  assert.equal(ui.passed, true); assert.equal(ui.confirmedFactsUnchanged, true); assert.deepEqual(ui.writes, ["alternative", "adopt"]); assert.equal(ui.order.positionAfter, true); assert.equal(ui.order.last, true);
  assert.deepEqual(ui.retirementWrite.settings, { retirementDate: "2040-11-03", monthlyIncome: 2000, monthlyExpenses: 1500 });
  await write("interaction.json", { passed: true, source: "Fresh completed browser journey", fixtureOnly: true, writes: ui.writes, order: ui.order, confirmedFactsUnchanged: ui.confirmedFactsUnchanged, retirementWrite: ui.retirementWrite });
} else if (stage === "geometry") {
  const ui = JSON.parse(await fs.readFile(path.join(out, "ui.json"), "utf8"));
  checkGeometry(ui.geometry);
  await write("geometry.json", { passed: true, samples: ui.geometry, toleranceCssPixels: 1 });
} else if (stage === "visual") {
  const { default: sharp } = await import("sharp");
  const reviews = [];
  for (const file of ["desktop.png", "mobile-390.png", "mobile-320.png"]) {
    const bytes = await fs.readFile(path.join(out, file));
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let dark = 0, teal = 0, alpha = 0;
    for (let n = 0; n < data.length; n += 4) { const [r, g, b, a] = data.subarray(n, n + 4); if (Math.max(r, g, b) < 145) dark++; if (g > 230 && g - r >= 7 && g - b >= 2) teal++; if (a === 255) alpha++; }
    const pixels = info.width * info.height, review = { file, width: info.width, height: info.height, dark: dark / pixels, teal: teal / pixels, alpha: alpha / pixels, sha256: createHash("sha256").update(bytes).digest("hex") };
    checkRaster(review); reviews.push(review);
  }
  await write("visual.json", { passed: true, method: "Actual screenshot raster checks plus DOM clipping/geometry checks; subjective design still requires visual inspection.", reviews });
} else if (stage === "account") {
  await command(["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "tools/control-centre-checker/account.mjs"], "account-readback");
} else throw new Error(`Unknown checker stage: ${stage}`);
