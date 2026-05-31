import { createMessage, type AgentMessage, type AgentRole } from "./coordinationContracts";

// --- Types ---

export type FailureType =
  | "app-code-failure"
  | "validation-infrastructure-failure"
  | "environment-failure"
  | "dependency-failure"
  | "browser-test-failure"
  | "git-state-failure"
  | "unknown";

export type SeverityLevel = "critical" | "blocking" | "warning" | "informational";

export type FailureFingerprint = {
  hash: string;
  errorMessage: string;
  stackFile: string;
  failingPhase: string;
  command: string;
};

export type ClassifiedFailure = {
  type: FailureType;
  severity: SeverityLevel;
  fingerprint: FailureFingerprint;
  raw: string;
  canTriggerRepair: boolean;
  repairStrategies: string[];
  detectedAt: string;
};

export type RepairLoopResult = {
  ok: boolean;
  failure: ClassifiedFailure;
  directives: AgentMessage[];
  attempts: number;
  skippedReason?: string;
};

// --- Classification patterns ---

const classificationPatterns: Array<{
  type: FailureType;
  matchers: RegExp[];
  strategies: string[];
}> = [
  {
    type: "app-code-failure",
    matchers: [
      /Type error/i,
      /TS\d{4}/i,
      /SyntaxError/i,
      /is not assignable to type/i,
      /Property .* does not exist/i,
      /Unexpected token/i,
      /Build failed/i,
      /Compilation error/i,
    ],
    strategies: [
      "Identify the failing file from the error message",
      "Fix the type annotation or syntax error",
      "Run npm run build to verify the fix",
    ],
  },
  {
    type: "validation-infrastructure-failure",
    matchers: [
      /Test suite failed/i,
      /jest/i,
      /expect\(.*\)\.to/i,
      /assertion failed/i,
      /AssertionError/i,
      /FAIL.*\.test\./i,
    ],
    strategies: [
      "Inspect the failing test suite",
      "Fix the test setup or underlying assertion",
      "Re-run npm test to confirm resolution",
    ],
  },
  {
    type: "environment-failure",
    matchers: [
      /EACCES/i,
      /ENOENT/i,
      /permission denied/i,
      /Cannot read properties of undefined/i,
      /NEXT_PUBLIC_/i,
      /env.*missing/i,
      /missing environment/i,
    ],
    strategies: [
      "Check that required environment variables are set",
      "Verify file paths and directory permissions",
      "Confirm .env.local contains required values",
    ],
  },
  {
    type: "dependency-failure",
    matchers: [
      /Cannot find module/i,
      /Module not found/i,
      /Failed to resolve/i,
      /npm install/i,
      /ENOPACKAGE/i,
      /peer dep/i,
    ],
    strategies: [
      "Check import path for typos",
      "Verify the dependency exists in package.json",
      "Run npm install to restore missing packages",
    ],
  },
  {
    type: "browser-test-failure",
    matchers: [
      /hydration/i,
      /window is not defined/i,
      /document is not defined/i,
      /Uncaught Error/i,
      /DOM mismatch/i,
      /Hydration failed/i,
      /did not match server/i,
      /playwright/i,
      /puppeteer/i,
    ],
    strategies: [
      "Add 'use client' directive to the offending component",
      "Move browser-only APIs into useEffect",
      "Fix SSR/client render inconsistency",
    ],
  },
  {
    type: "git-state-failure",
    matchers: [
      /git/i,
      /merge conflict/i,
      /detached HEAD/i,
      /not a git repository/i,
      /uncommitted changes/i,
      /untracked files/i,
      /fatal:.*git/i,
    ],
    strategies: [
      "Run git status to inspect the current state",
      "Resolve any merge conflicts before proceeding",
      "Ensure the working tree is clean before a build",
    ],
  },
];

// --- Severity assignment ---

const severityRules: Array<{
  type: FailureType;
  severity: SeverityLevel;
}> = [
  { type: "app-code-failure",               severity: "critical"      },
  { type: "dependency-failure",             severity: "critical"      },
  { type: "environment-failure",            severity: "blocking"      },
  { type: "git-state-failure",              severity: "blocking"      },
  { type: "validation-infrastructure-failure", severity: "warning"   },
  { type: "browser-test-failure",           severity: "warning"       },
  { type: "unknown",                        severity: "informational" },
];

// --- Fingerprinting ---

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}

export function createFingerprint(
  errorMessage: string,
  stackFile: string,
  failingPhase: string,
  command: string
): FailureFingerprint {
  const raw = `${errorMessage}|${stackFile}|${failingPhase}|${command}`;
  return {
    hash: simpleHash(raw),
    errorMessage: errorMessage.slice(0, 200),
    stackFile,
    failingPhase,
    command,
  };
}

// --- Classification ---

export function classifyFailure(
  errorOutput: string,
  opts: { stackFile?: string; failingPhase?: string; command?: string } = {}
): ClassifiedFailure {
  const stackFile = opts.stackFile ?? extractStackFile(errorOutput);
  const failingPhase = opts.failingPhase ?? "unknown";
  const command = opts.command ?? "unknown";

  let type: FailureType = "unknown";
  let strategies: string[] = [
    "Read the full error output",
    "Identify the failing file",
    "Apply minimal targeted fix",
    "Run npm run build",
  ];

  for (const pattern of classificationPatterns) {
    if (pattern.matchers.some((re) => re.test(errorOutput))) {
      type = pattern.type;
      strategies = pattern.strategies;
      break;
    }
  }

  const severity = severityRules.find((r) => r.type === type)?.severity ?? "informational";
  const canTriggerRepair = severity === "critical" || severity === "blocking";

  const firstLine = errorOutput.split("\n").find((l) => l.trim().length > 0) ?? errorOutput.slice(0, 120);
  const fingerprint = createFingerprint(firstLine, stackFile, failingPhase, command);

  return {
    type,
    severity,
    fingerprint,
    raw: errorOutput,
    canTriggerRepair,
    repairStrategies: strategies,
    detectedAt: new Date().toISOString(),
  };
}

function extractStackFile(output: string): string {
  const m = output.match(/(?:at\s+\S+\s+\()?([^\s(]+\.[jt]sx?(?::\d+:\d+)?)\)?/);
  return m ? m[1] : "unknown";
}

// --- Supervisor Orchestrator ---

export class SupervisorOrchestrator {
  private maxRepairAttempts: number;

  constructor(opts: { maxRepairAttempts?: number } = {}) {
    this.maxRepairAttempts = opts.maxRepairAttempts ?? 3;
  }

  runRepairLoop(
    errorOutput: string,
    opts: { stackFile?: string; failingPhase?: string; command?: string; attempt?: number } = {}
  ): RepairLoopResult {
    const failure = classifyFailure(errorOutput, opts);
    const attempt = opts.attempt ?? 1;

    if (!failure.canTriggerRepair) {
      return {
        ok: false,
        failure,
        directives: [],
        attempts: attempt,
        skippedReason: `Severity '${failure.severity}' does not meet the threshold for repair (need critical or blocking)`,
      };
    }

    if (attempt > this.maxRepairAttempts) {
      return {
        ok: false,
        failure,
        directives: [],
        attempts: attempt,
        skippedReason: `Exceeded max repair attempts (${this.maxRepairAttempts})`,
      };
    }

    const directives = this.buildDirectives(failure);

    return { ok: true, failure, directives, attempts: attempt };
  }

  private buildDirectives(failure: ClassifiedFailure): AgentMessage[] {
    const repairTarget = this.resolveRepairTarget(failure.type);
    return [
      createMessage(
        "repair-governor",
        repairTarget,
        "directive",
        {
          failureType: failure.type,
          severity: failure.severity,
          fingerprint: failure.fingerprint,
          strategies: failure.repairStrategies,
        },
        failure.severity === "critical" ? "critical" : "high"
      ),
      createMessage(
        "repair-governor",
        "qa-orchestrator",
        "directive",
        { action: "validate", fingerprint: failure.fingerprint },
        "medium"
      ),
    ];
  }

  private resolveRepairTarget(type: FailureType): AgentRole {
    switch (type) {
      case "app-code-failure":
      case "dependency-failure":
        return "backend-agent";
      case "browser-test-failure":
        return "ui-agent";
      default:
        return "backend-agent";
    }
  }
}

export const supervisorOrchestrator = new SupervisorOrchestrator();
