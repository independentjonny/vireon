import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

interface TestResult {
  file: string;
  passed: boolean;
  output: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const run = searchParams.get("run") === "true";

  const testsDir = path.join(process.cwd(), "__tests__");
  const scaffoldExists = fs.existsSync(testsDir);

  if (!scaffoldExists) {
    return Response.json({
      ok: true,
      scaffoldReady: false,
      message: "No __tests__/ directory found — scaffold not yet created",
      testFiles: [],
      checkedAt: new Date().toISOString(),
    });
  }

  const testFiles = fs
    .readdirSync(testsDir, { recursive: true })
    .filter((f) => typeof f === "string" && f.endsWith(".test.ts"))
    .map((f) => f.toString());

  if (!run) {
    return Response.json({
      ok: true,
      scaffoldReady: true,
      testFiles,
      fileCount: testFiles.length,
      message: `${testFiles.length} test file(s) found. Add ?run=true to execute.`,
      runCommand: "node --test '__tests__/**/*.test.ts'",
      checkedAt: new Date().toISOString(),
    });
  }

  const results: TestResult[] = [];
  let allPassed = true;

  for (const file of testFiles.slice(0, 5)) {
    const absPath = path.join(testsDir, file);
    try {
      const output = execSync(`node --test "${absPath}"`, {
        timeout: 30_000,
        encoding: "utf-8",
        stdio: "pipe",
      }).trim();
      results.push({ file, passed: true, output: output.slice(0, 400) });
    } catch (err: unknown) {
      allPassed = false;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ file, passed: false, output: msg.slice(0, 400) });
    }
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
}
