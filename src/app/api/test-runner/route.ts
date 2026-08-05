import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

interface TestResult {
  file: string;
  passed: boolean;
  output: string;
}

const MAX_TEST_FILES = 5;
const TEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 400;
const MAX_CONCURRENT_RUNS = 1;
let activeRuns = 0;

function productionBlocked(): Response | null {
  if (process.env.NODE_ENV !== "production") return null;
  return Response.json({ ok: false, error: "The test runner API is disabled in production." }, { status: 403 });
}

function runAllowedTest(absPath: string): Promise<{ passed: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test", absPath], {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timeout = setTimeout(() => child.kill(), TEST_TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.length > MAX_OUTPUT_CHARS * 3) child.kill();
    });
    child.stderr.on("data", (chunk: string) => {
      output += chunk;
      if (output.length > MAX_OUTPUT_CHARS * 3) child.kill();
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ passed: code === 0, output: output.trim().slice(0, MAX_OUTPUT_CHARS) });
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ passed: false, output: error.message.slice(0, MAX_OUTPUT_CHARS) });
    });
  });
}

export async function GET(req: Request) {
  const auth = await requirePermission(req, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);
  const blocked = productionBlocked();
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const run = searchParams.get("run") === "true";
  const testsDir = path.join(process.cwd(), "__tests__");
  const scaffoldExists = fs.existsSync(testsDir);

  if (!scaffoldExists) {
    return Response.json({
      ok: true,
      scaffoldReady: false,
      message: "No __tests__/ directory found - scaffold not yet created",
      testFiles: [],
      checkedAt: new Date().toISOString(),
    });
  }

  const testFiles = fs
    .readdirSync(testsDir, { recursive: true })
    .filter((file) => typeof file === "string" && file.endsWith(".test.ts"))
    .map((file) => file.toString())
    .sort();

  if (!run) {
    return Response.json({
      ok: true,
      scaffoldReady: true,
      testFiles,
      fileCount: testFiles.length,
      message: `${testFiles.length} test file(s) found. Add ?run=true to execute.`,
      runCommand: "node --test <allow-listed test file>",
      checkedAt: new Date().toISOString(),
    });
  }

  if (activeRuns >= MAX_CONCURRENT_RUNS) {
    return Response.json({ ok: false, error: "Another bounded test run is already active." }, { status: 429 });
  }
  activeRuns++;
  const results: TestResult[] = [];
  let allPassed = true;

  try {
    for (const file of testFiles.slice(0, MAX_TEST_FILES)) {
      const absPath = path.resolve(testsDir, file);
      if (!absPath.startsWith(path.resolve(testsDir) + path.sep)) {
        allPassed = false;
        results.push({ file, passed: false, output: "Rejected test path." });
        continue;
      }
      const result = await runAllowedTest(absPath);
      if (!result.passed) allPassed = false;
      results.push({ file, ...result });
    }

    return Response.json({
      ok: true,
      scaffoldReady: true,
      ran: true,
      allPassed,
      results,
      fileCount: testFiles.length,
      checkedAt: new Date().toISOString(),
    });
  } finally {
    activeRuns--;
  }
}
