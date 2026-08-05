import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "vireon-bridge-sanitization-"));
const canary = `canary-bridge-smoke-${Date.now()}-never-print`;
const sentinel = join(tempRoot, "command-injection-executed.txt");

mkdirSync(join(tempRoot, ".ai", "operations"), { recursive: true });
writeFileSync(
  join(tempRoot, ".ai", "operations", "defects.json"),
  JSON.stringify([
    {
      id: "defect-smoke",
      code: "BRIDGE_SANITIZATION",
      severity: "high",
      category: "runtime",
      title: `Defect with Bearer ${canary}`,
      summary: `Summary with postgresql://user:${canary}@db.example/postgres`,
      evidence: [{ note: `ALTER ROLE vireon_app PASSWORD '${canary}'`, command: `node -e "require('fs').writeFileSync('${sentinel.replaceAll("\\", "\\\\")}','bad')"` }],
      affectedFiles: ["src/app/api/runtime/defects/route.ts"],
      acceptanceCriterion: `No ${canary}`,
      remediation: "Redact and discard unexpected fields.",
      status: "open",
      detectedAt: "2026-07-31T00:00:00.000Z",
      source: `PGPASSWORD=${canary}`,
      description: `Description ${canary}`,
      repairTaskId: "repair-smoke",
      resolved: false,
      rawSecret: canary,
      password: canary,
      apiKey: canary,
      token: canary,
      shell: `powershell ${canary}`,
      env: { PGPASSWORD: canary },
      connectionString: `postgresql://user:${canary}@db.example/postgres`,
    },
  ]),
  "utf8",
);
writeFileSync(
  join(tempRoot, ".ai", "operations", "queue.json"),
  JSON.stringify({
    items: [{
      id: "queued-smoke",
      title: `Queue task ${canary}`,
      source: `postgresql://queue:${canary}@db.example/vireon`,
      addedAt: "2026-07-31T00:01:00.000Z",
      status: "queued",
      unexpected: { token: canary },
    }],
  }),
  "utf8",
);
writeFileSync(
  join(tempRoot, ".ai", "final-green-report.json"),
  JSON.stringify({
    status: "green",
    goal: `Final report with PASSWORD '${canary}'`,
    completedAt: "2026-07-31T00:02:00.000Z",
    validation: { ok: true, buildBrowser: { ok: true }, stderr: canary },
    reviewer: { finding: canary },
  }),
  "utf8",
);

const originalCwd = process.cwd();
process.chdir(tempRoot);

const [{ GET: getDefects }, { GET: getQueue }, { GET: getStatus }, { GET: getContinuous }] = await Promise.all([
  import("../src/app/api/runtime/defects/route.ts"),
  import("../src/app/api/runtime/queue/route.ts"),
  import("../src/app/api/runtime/status/route.ts"),
  import("../src/app/api/runtime/continuous-status/route.ts"),
]);

const responses = {
  defects: await (await getDefects()).json(),
  queue: await (await getQueue()).json(),
  status: await (await getStatus()).json(),
  continuous: await (await getContinuous()).json(),
};

process.chdir(originalCwd);

const responseText = JSON.stringify(responses);
const result = {
  status: "PASS",
  secretLeakDetected: responseText.includes(canary),
  unexpectedFieldsPresent: /rawSecret|apiKey|connectionString|shell|env/.test(responseText),
  schemaValid: responses.defects?.ok === true && Array.isArray(responses.defects?.defects) && responses.queue?.ok === true && responses.status?.ok === true,
  commandInjectionExecuted: existsSync(sentinel),
  allowedFieldsUsable: responses.defects?.latest?.code === "BRIDGE_SANITIZATION" && responses.defects?.latest?.status === "open",
  discardedUnexpectedFieldCount: responses.defects?.discardedUnexpectedFieldCount ?? null,
  generatedAt: new Date().toISOString(),
};

if (result.secretLeakDetected || result.unexpectedFieldsPresent || !result.schemaValid || result.commandInjectionExecuted || !result.allowedFieldsUsable) {
  result.status = "FAIL";
}

const evidenceDir = resolve(repoRoot, ".ai-supervisor", "evidence");
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, "bridge-sanitization-smoke.json"), JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result, null, 2));
if (result.status !== "PASS") process.exit(1);
