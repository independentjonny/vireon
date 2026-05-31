#!/usr/bin/env node
// Liberva self-diagnosis script
// Run via: npm run doctor

const fs = require("fs");
const path = require("path");
const net = require("net");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const PASSED = [];
const WARNINGS = [];
const ERRORS = [];

function ok(name, detail) {
  PASSED.push({ name, detail: detail || "" });
  console.log(`  ✓  ${name}${detail ? " — " + detail : ""}`);
}

function warn(name, detail) {
  WARNINGS.push({ name, detail: detail || "" });
  console.log(`  ⚠  ${name}${detail ? " — " + detail : ""}`);
}

function fail(name, detail) {
  ERRORS.push({ name, detail: detail || "" });
  console.log(`  ✗  ${name}${detail ? " — " + detail : ""}`);
}

function checkAppRoot() {
  const pkgPath = path.join(ROOT, "package.json");
  if (fs.existsSync(pkgPath)) {
    ok("App root", "package.json found");
  } else {
    fail("App root", "package.json not found");
  }
}

function checkPackageScripts() {
  const pkgPath = path.join(ROOT, "package.json");
  if (!fs.existsSync(pkgPath)) {
    fail("Package scripts", "Cannot check — package.json missing");
    return;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  for (const s of ["dev", "build", "start"]) {
    if (pkg.scripts && pkg.scripts[s]) {
      ok("Script: " + s, pkg.scripts[s]);
    } else {
      fail("Script: " + s, "Missing from package.json scripts");
    }
  }
  if (pkg.scripts && pkg.scripts.doctor) {
    ok("Script: doctor", pkg.scripts.doctor);
  } else {
    warn("Script: doctor", "Not yet defined");
  }
}

function checkDuplicateNestedFolders() {
  const dirName = path.basename(ROOT);
  const nested = path.join(ROOT, dirName);
  if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
    fail("Duplicate nested folder", "Found " + dirName + "/" + dirName + " inside project root");
  } else {
    ok("No duplicate nested folder");
  }
  const srcDir = path.join(ROOT, "src");
  if (fs.existsSync(srcDir)) {
    const nestedSrc = path.join(srcDir, "src");
    if (fs.existsSync(nestedSrc)) {
      fail("Duplicate src folder", "Found src/src inside project");
    } else {
      ok("No duplicate src folder");
    }
  }
}

function checkPort(port) {
  return new Promise(function (resolve) {
    const server = net.createServer();
    server.listen(port, "127.0.0.1", function () {
      server.close(function () {
        resolve({ port: port, inUse: false });
      });
    });
    server.on("error", function () {
      resolve({ port: port, inUse: true });
    });
  });
}

async function checkPorts() {
  for (const port of [3000, 4001, 4002]) {
    const result = await checkPort(port);
    if (result.inUse) {
      ok("Port " + port, "In use (process running)");
    } else {
      warn("Port " + port, "Not in use");
    }
  }
}

function checkEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    ok(".env.local", "Present");
    return true;
  } else {
    warn(".env.local", "Not found — app runs in scaffold mode");
    return false;
  }
}

function checkDatabaseEnv() {
  if (process.env.DATABASE_URL) {
    ok("DATABASE_URL", "Set");
  } else {
    warn("DATABASE_URL", "Not set — local scaffold mode active");
  }
  if (process.env.SUPABASE_DATABASE_URL) {
    ok("SUPABASE_DATABASE_URL", "Set");
  } else {
    warn("SUPABASE_DATABASE_URL", "Not set");
  }
}

async function checkDatabaseConnectivity() {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!url) {
    warn("Database connectivity", "Skipped — no DATABASE_URL configured");
    return;
  }
  let pgAvailable = false;
  try {
    require("pg");
    pgAvailable = true;
  } catch (_e) {
    warn("Database connectivity", "pg not installed — skipping deep check");
  }
  if (!pgAvailable) return;
  try {
    const { Client } = require("pg");
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.end();
    ok("Database connectivity", "Connected successfully");
  } catch (e) {
    fail("Database connectivity", "Could not connect: " + (e && e.message ? e.message : String(e)));
  }
}

function checkNextDevServer() {
  return new Promise(function (resolve) {
    const req = http.get("http://localhost:3000", { timeout: 2000 }, function (res) {
      if (res.statusCode && res.statusCode < 500) {
        ok("Next.js dev server", "Running (HTTP " + res.statusCode + ")");
      } else {
        warn("Next.js dev server", "Returned HTTP " + res.statusCode);
      }
      res.resume();
      resolve(undefined);
    });
    req.on("error", function () {
      warn("Next.js dev server", "Not reachable on port 3000");
      resolve(undefined);
    });
    req.on("timeout", function () {
      req.destroy();
      warn("Next.js dev server", "Timed out connecting to port 3000");
      resolve(undefined);
    });
  });
}

function checkSmokeTests() {
  const smokeFile = path.join(ROOT, "tests", "smoke.spec.ts");
  if (fs.existsSync(smokeFile)) {
    ok("Smoke tests", "tests/smoke.spec.ts found");
  } else {
    warn("Smoke tests", "tests/smoke.spec.ts not found");
  }
  const pwConfig = path.join(ROOT, "playwright.config.ts");
  if (fs.existsSync(pwConfig)) {
    ok("Playwright config", "playwright.config.ts found");
  } else {
    warn("Playwright config", "playwright.config.ts not found");
  }
}

async function main() {
  console.log("\n╔═══════════════════════════════════╗");
  console.log("║   Liberva Doctor — Self-Diagnosis    ║");
  console.log("╚═══════════════════════════════════╝\n");

  checkAppRoot();
  checkPackageScripts();
  checkDuplicateNestedFolders();
  await checkPorts();
  checkEnvLocal();
  checkDatabaseEnv();
  await checkDatabaseConnectivity();
  await checkNextDevServer();
  checkSmokeTests();

  console.log("\n─────────────────────────────────────");
  console.log("  Passed:   " + PASSED.length);
  console.log("  Warnings: " + WARNINGS.length);
  console.log("  Errors:   " + ERRORS.length);
  console.log("─────────────────────────────────────\n");

  const report = {
    checkedAt: new Date().toISOString(),
    healthy: ERRORS.length === 0,
    passed: PASSED,
    warnings: WARNINGS,
    errors: ERRORS,
  };

  const reportPath = path.join(ROOT, ".ai", "doctor-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("  Report saved to .ai/doctor-report.json\n");

  if (ERRORS.length > 0) {
    process.exit(1);
  }
}

main().catch(function (e) {
  console.error("Doctor failed:", e);
  process.exit(1);
});
