export type ErrorClass =
  | "BuildError"
  | "TypeScriptError"
  | "RuntimeError"
  | "NetworkError"
  | "EnvironmentError"
  | "AuthError"
  | "DatabaseError"
  | "AgentError"
  | "ValidationError"
  | "UnknownError";

export type ClassifiedError = {
  raw: string;
  errorClass: ErrorClass;
  severity: "low" | "medium" | "high" | "critical";
  repairSuggestion: string;
  autoRepair: boolean;
};

const CLASSIFIERS: Array<{
  pattern: RegExp;
  errorClass: ErrorClass;
  severity: ClassifiedError["severity"];
  suggestion: string;
  autoRepair: boolean;
}> = [
  {
    pattern: /Type error|TypeScript/i,
    errorClass: "TypeScriptError",
    severity: "high",
    suggestion: "Fix TypeScript type mismatch in the indicated file and line.",
    autoRepair: true,
  },
  {
    pattern: /Cannot find module|Module not found/i,
    errorClass: "BuildError",
    severity: "high",
    suggestion: "Run npm install or check the import path.",
    autoRepair: false,
  },
  {
    pattern: /ENOTFOUND|ECONNREFUSED|fetch failed/i,
    errorClass: "NetworkError",
    severity: "medium",
    suggestion: "Check network connectivity and API endpoint configuration.",
    autoRepair: false,
  },
  {
    pattern: /DATABASE_URL|prisma|pg.*error/i,
    errorClass: "DatabaseError",
    severity: "critical",
    suggestion: "Ensure DATABASE_URL is set and the database is reachable.",
    autoRepair: false,
  },
  {
    pattern: /SUPABASE|auth.*invalid|token.*expired/i,
    errorClass: "AuthError",
    severity: "high",
    suggestion: "Verify Supabase credentials and session token validity.",
    autoRepair: false,
  },
  {
    pattern: /process\.env|undefined.*env/i,
    errorClass: "EnvironmentError",
    severity: "medium",
    suggestion: "Set the missing environment variable in .env.local and deployment platform.",
    autoRepair: false,
  },
  {
    pattern: /agent.*failed|agent.*error/i,
    errorClass: "AgentError",
    severity: "medium",
    suggestion: "Check agent configuration and retry. Escalate to repair governor if persists.",
    autoRepair: true,
  },
  {
    pattern: /zod|validation|invalid input/i,
    errorClass: "ValidationError",
    severity: "low",
    suggestion: "Ensure request payload matches expected schema.",
    autoRepair: false,
  },
];

export function classifyError(rawError: string): ClassifiedError {
  for (const c of CLASSIFIERS) {
    if (c.pattern.test(rawError)) {
      return {
        raw: rawError,
        errorClass: c.errorClass,
        severity: c.severity,
        repairSuggestion: c.suggestion,
        autoRepair: c.autoRepair,
      };
    }
  }
  return {
    raw: rawError,
    errorClass: "UnknownError",
    severity: "medium",
    repairSuggestion: "Inspect the error trace and check recent code changes.",
    autoRepair: false,
  };
}
