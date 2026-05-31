export type RepairClass =
  | "build_failure"
  | "typescript_error"
  | "module_not_found"
  | "browser_crash"
  | "dom_mismatch"
  | "route_failure"
  | "runtime_failure"
  | "unknown";

export type RepairClassification = {
  class: RepairClass;
  confidence: number;
  repairStrategy: string[];
  affectedLayer: "build" | "runtime" | "browser" | "unknown";
};

export const repairCategories: Record<
  Exclude<RepairClass, "unknown">,
  { layer: "build" | "runtime" | "browser"; summary: string }
> = {
  typescript_error:  { layer: "build",   summary: "Fix type annotation or interface mismatch" },
  module_not_found:  { layer: "build",   summary: "Verify import path and package.json dependency" },
  build_failure:     { layer: "build",   summary: "Fix syntax error and re-run build" },
  route_failure:     { layer: "runtime", summary: "Check route file exists with correct export signature" },
  runtime_failure:   { layer: "runtime", summary: "Investigate process exit, spawn error, or ENOENT" },
  browser_crash:     { layer: "browser", summary: "Add use client directive or move API to useEffect" },
  dom_mismatch:      { layer: "browser", summary: "Fix SSR/client render inconsistency" },
};

const patterns: Array<{
  class: RepairClass;
  matchers: RegExp[];
  strategy: string[];
  layer: "build" | "runtime" | "browser" | "unknown";
}> = [
  {
    class: "typescript_error",
    matchers: [/Type error/i, /TS\d{4}/i, /Property .* does not exist/i, /is not assignable to type/i],
    strategy: [
      "Identify mismatched type in the error message",
      "Add or fix the type annotation",
      "Run npm run build to verify",
    ],
    layer: "build",
  },
  {
    class: "module_not_found",
    matchers: [/Cannot find module/i, /Module not found/i, /Failed to resolve/i],
    strategy: [
      "Check import path for typos",
      "Verify file exists at the expected location",
      "Check package.json for missing dependency",
    ],
    layer: "build",
  },
  {
    class: "build_failure",
    matchers: [/Build failed/i, /Compilation error/i, /SyntaxError/i, /Unexpected token/i],
    strategy: [
      "Read the failing file",
      "Fix syntax error",
      "Run npm run build again",
    ],
    layer: "build",
  },
  {
    class: "route_failure",
    matchers: [/404/i, /API route/i, /route\.ts/i, /No handler/i],
    strategy: [
      "Check the route file exists in src/app/api/",
      "Verify the export signature (GET/POST/etc)",
      "Confirm the route returns a Response object",
    ],
    layer: "runtime",
  },
  {
    class: "browser_crash",
    matchers: [/Uncaught Error/i, /window is not defined/i, /document is not defined/i, /hydration/i],
    strategy: [
      "Identify server-only code running in client",
      "Add 'use client' directive if needed",
      "Wrap browser APIs in useEffect",
    ],
    layer: "browser",
  },
  {
    class: "dom_mismatch",
    matchers: [/DOM mismatch/i, /Hydration failed/i, /did not match server/i],
    strategy: [
      "Check for dynamic content rendered during SSR",
      "Use suppressHydrationWarning or move to client component",
      "Ensure consistent renders between server and client",
    ],
    layer: "browser",
  },
  {
    class: "runtime_failure",
    matchers: [/ENOENT/i, /EACCES/i, /spawn/i, /process exited/i, /killed/i, /SIGTERM/i, /SIGKILL/i],
    strategy: [
      "Check the file path exists before accessing",
      "Verify process permissions and environment variables",
      "Check for zombie processes or port conflicts",
      "Review daemon-state.json for stale activeRun locks",
    ],
    layer: "runtime",
  },
];

export function classifyRepair(errorOutput: string): RepairClassification {
  for (const pattern of patterns) {
    const matched = pattern.matchers.some((re) => re.test(errorOutput));
    if (matched) {
      return {
        class: pattern.class,
        confidence: 0.9,
        repairStrategy: pattern.strategy,
        affectedLayer: pattern.layer,
      };
    }
  }

  return {
    class: "unknown",
    confidence: 0.3,
    repairStrategy: [
      "Read the full error output",
      "Identify the failing file",
      "Apply minimal targeted fix",
      "Run npm run build",
    ],
    affectedLayer: "unknown",
  };
}
