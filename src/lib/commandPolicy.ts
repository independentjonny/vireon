import { execSync } from "child_process";

export interface AllowedCommand {
  key: string;
  command: string;
  description: string;
  category: "build" | "test" | "git";
  safe: boolean;
}

export const ALLOWED_COMMANDS: AllowedCommand[] = [
  { key: "npm-build", command: "npm run build", description: "Compile TypeScript and generate Next.js build output", category: "build", safe: true },
  { key: "npm-test", command: "npm test", description: "Run test suite via npm test script", category: "test", safe: true },
  { key: "node-test", command: "node --test", description: "Run node built-in test runner against __tests__/ directory", category: "test", safe: true },
  { key: "git-status", command: "git status", description: "Show working tree status — read-only, no side effects", category: "git", safe: true },
  { key: "git-diff-stat", command: "git diff --stat", description: "Show summary of changed files — read-only", category: "git", safe: true },
  { key: "git-rev-parse", command: "git rev-parse HEAD", description: "Resolve HEAD commit SHA — read-only", category: "git", safe: true },
];

const ALLOWED_KEYS = new Set(ALLOWED_COMMANDS.map((c) => c.key));

export type PolicyDecision = "allow" | "deny";

export interface PolicyResult {
  decision: PolicyDecision;
  key: string;
  command: string;
  reason: string;
}

export function evaluateCommandPolicy(key: string): PolicyResult {
  const entry = ALLOWED_COMMANDS.find((c) => c.key === key);
  if (!entry) {
    return { decision: "deny", key, command: "", reason: `Command key '${key}' is not in the safe command allowlist.` };
  }
  return { decision: "allow", key, command: entry.command, reason: `Permitted: ${entry.description}` };
}

export function runAllowedCommand(
  key: string,
  cwd = process.cwd()
): { ok: boolean; output: string; durationMs: number; decision: PolicyDecision } {
  const policy = evaluateCommandPolicy(key);
  if (policy.decision === "deny") {
    return { ok: false, output: `[POLICY DENIED] ${policy.reason}`, durationMs: 0, decision: "deny" };
  }
  const start = Date.now();
  try {
    const output = execSync(policy.command, {
      cwd,
      timeout: 120_000,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    return { ok: true, output: output.slice(0, 2000), durationMs: Date.now() - start, decision: "allow" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const entry = ALLOWED_COMMANDS.find((c) => c.key === key);
    // git commands fail gracefully when the project is not a git repository
    if (entry?.category === "git" && msg.includes("not a git repository")) {
      return { ok: true, output: "(not a git repository — skipped)", durationMs: Date.now() - start, decision: "allow" };
    }
    return { ok: false, output: msg.slice(0, 1000), durationMs: Date.now() - start, decision: "allow" };
  }
}

export function listAllowedCommands(): AllowedCommand[] {
  return ALLOWED_COMMANDS;
}

export function isKeyAllowed(key: string): boolean {
  return ALLOWED_KEYS.has(key);
}
