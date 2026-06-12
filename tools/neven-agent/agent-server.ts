import http from "node:http";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = 4002;
const REPO = "C:\\Users\\summe\\liberva";
const LOG_DIR = path.join(REPO, ".ai-agent-runs");

fs.mkdirSync(LOG_DIR, { recursive: true });

type AgentMode = "auto" | "inspect" | "codex";
type AgentAction =
  | "health"
  | "gitStatus"
  | "gitDiff"
  | "readFile"
  | "writeFile"
  | "replaceText"
  | "typecheck"
  | "screenshot"
  | "evaluateFix"
  | "reviewUI"
  | "autoImproveUI"
  | "planFix"
  | "executeFix"
  | "autofix"
  | "autoLoop";

type AgentRequest = {
  action?: AgentAction;
  goal?: string;
  mode?: AgentMode;
  runValidation?: boolean;
  path?: string;
  content?: string;
  from?: string;
  to?: string;
};

function run(command: string, timeoutMs = 60_000) {
  try {
    return execSync(command, {
      cwd: REPO,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 50,
      shell: "powershell.exe",
      timeout: timeoutMs,
    });
  } catch (err: any) {
    return [
      `COMMAND FAILED OR TIMED OUT: ${command}`,
      err.stdout?.toString() ?? "",
      err.stderr?.toString() ?? "",
      err.message ?? "",
    ].join("\n");
  }
}

function save(name: string, content: string) {
  fs.writeFileSync(path.join(LOG_DIR, name), content, "utf8");
}

function json(res: http.ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload, null, 2));
}

function safePath(input: string) {
  const normalized = input.replaceAll("/", "\\").trim();
  const full = path.resolve(REPO, normalized);
  const repoRoot = path.resolve(REPO);
  const relative = path.relative(repoRoot, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe path outside repo: ${input}`);
  }
  return full;
}

function stripQuotes(input: string) {
  return input.trim().replace(/^["'`]|["'`]$/g, "");
}

function extractQuotedPath(goal: string) {
  const quoted = goal.match(/["'`](.+?)["'`]/);
  return quoted?.[1]?.trim() ?? "";
}

function extractLikelyPath(goal: string) {
  const quoted = extractQuotedPath(goal);
  if (quoted) return quoted;
  const pathMatch = goal.match(/([A-Za-z0-9_.\-\\/ ]+?\.(tsx|ts|js|jsx|json|css|md|txt|mjs|cjs|png|jpg|jpeg|webp))/i);
  return pathMatch?.[1]?.trim() ?? "";
}

function createFile(goal: string) {
  const match = goal.match(/^create file\s+(.+?)\s+containing exactly:\s*([\s\S]*)$/i);
  if (!match) return "";
  const target = stripQuotes(match[1]);
  const content = match[2];
  const fullPath = safePath(target);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  return `Created file: ${target}`;
}

function replaceFile(goal: string) {
  const match = goal.match(/^replace file\s+(.+?)\s+with exactly:\s*([\s\S]*)$/i);
  if (!match) return "";
  const target = stripQuotes(match[1]);
  const content = match[2];
  const fullPath = safePath(target);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  return `Replaced file: ${target}`;
}

function replaceText(goal: string) {
  const match = goal.match(/^replace text in file\s+(.+?)\s+from exactly:\s*([\s\S]*?)\s+to exactly:\s*([\s\S]*)$/i);
  if (!match) return "";

  const target = stripQuotes(match[1]);
  const oldText = match[2];
  const newText = match[3];
  const fullPath = safePath(target);

  const current = fs.readFileSync(fullPath, "utf8");
  if (!current.includes(oldText)) {
    return `Text not found in ${target}`;
  }

  fs.writeFileSync(fullPath, current.replace(oldText, newText), "utf8");
  return `Replaced text in file: ${target}`;
}

function takeScreenshots() {
  const desktopPath = ".ai-agent-runs/latest-desktop.png";
  const mobilePath = ".ai-agent-runs/latest-mobile.png";

  const desktop = run(`npx playwright screenshot --timeout=30000 --viewport-size=1440,1200 http://localhost:3000 ${desktopPath}`, 35_000);
  const mobile = run(`npx playwright screenshot --timeout=30000 --viewport-size=390,1200 http://localhost:3000 ${mobilePath}`, 35_000);

  return [
    "Screenshots captured:",
    desktopPath,
    mobilePath,
    "",
    "Desktop output:",
    desktop,
    "",
    "Mobile output:",
    mobile,
  ].join("\n");
}

function reviewUI() {
  takeScreenshots();
  return [
    "UI review screenshots ready.",
    "Desktop: .ai-agent-runs/latest-desktop.png",
    "Mobile: .ai-agent-runs/latest-mobile.png",
    "Screenshot vision review is not implemented yet. Inspect these screenshots manually for now.",
  ].join("\n");
}

type UIReviewFinding = {
  issue: string;
  likelyFile: string;
  recommendedTask: string;
};

function generateUIReviewPlaceholder(): UIReviewFinding[] {
  const desktopPath = path.join(REPO, ".ai-agent-runs", "latest-desktop.png");
  const mobilePath = path.join(REPO, ".ai-agent-runs", "latest-mobile.png");
  const pagePathCandidates = ["src/app/page.tsx", "app/page.tsx"];
  const likelyFileCandidates = [
    "src/app/page.tsx",
    "app/page.tsx",
    "src/components/dashboard.tsx",
    "src/components/Dashboard.tsx",
    "src/app/globals.css",
    "app/globals.css",
  ];
  const pagePath = pagePathCandidates.find((candidate) => fs.existsSync(path.join(REPO, candidate))) ?? "src/app/page.tsx";
  const likelyFile = likelyFileCandidates.find((candidate) => fs.existsSync(path.join(REPO, candidate))) ?? "src/app/page.tsx";
  const overviewFile = fs.existsSync(path.join(REPO, "src/app/components/OverviewV3.tsx"))
    ? "src/app/components/OverviewV3.tsx"
    : likelyFile;
  const pageSource = fs.existsSync(path.join(REPO, pagePath))
    ? fs.readFileSync(path.join(REPO, pagePath), "utf8")
    : "";
  const pageAlreadyUsesDesktopWidth = /\bw-full\b/.test(pageSource) && /\blg:px-(?:0|1|2|3|4)\b/.test(pageSource);

  const findings: UIReviewFinding[] = [];

  if (fs.existsSync(desktopPath)) {
    if (pageAlreadyUsesDesktopWidth) {
      findings.push({
        issue: "The page layout already uses full width with compact desktop gutters, so OverviewV3 needs a specific hero layout pass rather than more width.",
        likelyFile: overviewFile,
        recommendedTask: `Review ${overviewFile} and move Financial Health into the KPI row, creating a 5-card KPI grid while reducing hero vertical spacing without expanding the page width.`,
      });
    } else {
      findings.push({
        issue: "Content is likely not using the full desktop width, leaving excessive whitespace around the main dashboard area.",
        likelyFile,
        recommendedTask: `Review ${likelyFile} and widen the main layout container or grid so dashboard content uses available desktop space without oversized side gutters.`,
      });
    }
  }

  if (fs.existsSync(mobilePath)) {
    findings.push({
      issue: "Mobile card density may be too high, making dashboard cards feel stacked and hard to scan on narrow screens.",
      likelyFile,
      recommendedTask: `Review ${likelyFile} mobile breakpoints and adjust card spacing, stacking, and summary density for a 390px viewport.`,
    });
  }

  if (findings.length === 0) {
    findings.push({
      issue: pageAlreadyUsesDesktopWidth
        ? "OverviewV3 may need a specific hero layout pass now that the page layout already uses full width with compact desktop gutters."
        : "Dashboard cards may be too narrow or constrained by the current layout container.",
      likelyFile: pageAlreadyUsesDesktopWidth ? overviewFile : likelyFile,
      recommendedTask: pageAlreadyUsesDesktopWidth
        ? `Capture desktop and mobile screenshots, then review ${overviewFile} to move Financial Health into the KPI row, create a 5-card KPI grid, and reduce hero vertical spacing.`
        : `Capture desktop and mobile screenshots, then review ${likelyFile} for container width, grid columns, and card sizing issues.`,
    });
  }

  return findings;
}

function requireString(value: unknown, name: string) {
  if (typeof value !== "string") throw new Error(`Missing ${name}`);
  return value;
}

function summarizeOutput(output: string, maxLength = 12_000) {
  const trimmed = output.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}\n... truncated ${trimmed.length - maxLength} characters`;
}

function trackedModifiedFilesFromStatus(status: string) {
  return status
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith("??"))
    .map((line) => line.slice(3).replace(/^.* -> /, ""))
    .filter(Boolean);
}

function modifiedFilesFromStatus(status: string) {
  return status
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^.* -> /, "").replaceAll("\\", "/"))
    .filter(Boolean);
}

function targetFilesFromTask(task: string) {
  const matches = task.matchAll(/(?:^|\s)([A-Za-z0-9_.\-\\/]+\.(?:tsx|ts|js|jsx|json|css|md|txt|mjs|cjs|png|jpg|jpeg|webp))/gi);
  return Array.from(matches, (match) => match[1].replaceAll("\\", "/"));
}

function quotePowerShellPath(filePath: string) {
  return `'${filePath.replaceAll("'", "''")}'`;
}

function changedDiffLines(diffHunk: string) {
  return diffHunk
    .split(/\r?\n/)
    .filter((line) => /^[+-](?![+-]{2})/.test(line));
}

function diffHunks(diff: string) {
  return diff
    .split(/(?=^@@\s)/m)
    .filter((hunk) => hunk.startsWith("@@"));
}

function hasOverviewV3HeroStructuralChange(diff: string) {
  return diffHunks(diff).some((hunk) => {
    const changedLines = changedDiffLines(hunk);
    if (changedLines.length === 0) return false;

    const changesDataDeclaration =
      /\bconst\s+secondaryMetrics\b/.test(hunk) ||
      /\bconst\s+accentClass\b/.test(hunk);
    const hasHeroKpiContext =
      /Secondary metrics|secondaryMetrics\.map|Financial Health|healthScore|healthLabel/.test(hunk);
    if (!hasHeroKpiContext || changesDataDeclaration) return false;

    const hasGridClassNameChange = changedLines.some((line) =>
      /className=/.test(line) && /\bgrid\b|grid-cols/.test(line)
    );
    const hasFinancialHealthJsxChange =
      hunk.includes("Financial Health") &&
      changedLines.some((line) => {
        const text = line.slice(1).trim();
        return (
          text.includes("Financial Health") ||
          text.includes("healthScore") ||
          text.includes("healthLabel") ||
          text.includes("healthColor") ||
          text.includes("className=") ||
          text.includes("style=") ||
          /^<\/?[A-Za-z]/.test(text)
        );
      });

    return hasGridClassNameChange || hasFinancialHealthJsxChange;
  });
}

function evaluateFix(recommendedTask = generateUIReviewPlaceholder()[0]?.recommendedTask ?? "", executeFixOutput = "") {
  if (executeFixOutput.includes("COMMAND FAILED OR TIMED OUT")) return "FAIL";

  const gitStatusOutput = run("git status --short", 15_000);
  const diffStat = run("git diff --shortstat", 15_000).trim();
  const diffNameOutput = run("git diff --name-only", 15_000);
  if (
    gitStatusOutput.includes("COMMAND FAILED OR TIMED OUT") ||
    diffStat.includes("COMMAND FAILED OR TIMED OUT") ||
    diffNameOutput.includes("COMMAND FAILED OR TIMED OUT")
  ) {
    return "FAIL";
  }

  const diffChangedFiles = diffNameOutput
    .split(/\r?\n/)
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean);
  const changedFiles = Array.from(
    new Set([
      ...diffChangedFiles,
      ...modifiedFilesFromStatus(gitStatusOutput),
    ])
  );
  const targetFiles = targetFilesFromTask(recommendedTask);
  const relevantTargetModified =
    targetFiles.length > 0 && targetFiles.some((targetFile) => diffChangedFiles.includes(targetFile));
  const typecheck = run("npx tsc --noEmit", 60_000);
  if (typecheck.includes("COMMAND FAILED OR TIMED OUT")) return "FAIL";
  const screenshotsExist =
    fs.existsSync(path.join(REPO, ".ai-agent-runs", "latest-desktop.png")) &&
    fs.existsSync(path.join(REPO, ".ai-agent-runs", "latest-mobile.png"));

  if (!screenshotsExist || !relevantTargetModified) return "FAIL";

  const changedOnlyPage =
    changedFiles.length === 1 &&
    (changedFiles[0] === "src/app/page.tsx" || changedFiles[0] === "app/page.tsx");
  const changedOverviewV3 = changedFiles.includes("src/app/components/OverviewV3.tsx");
  const targetsOverviewV3Hero =
    recommendedTask.toLowerCase().includes("overviewv3") &&
    recommendedTask.toLowerCase().includes("hero");
  if (targetsOverviewV3Hero) {
    if (changedOnlyPage || !changedOverviewV3) return "FAIL";
    const overviewV3Diff = run("git diff -- src/app/components/OverviewV3.tsx", 15_000);
    if (
      overviewV3Diff.includes("COMMAND FAILED OR TIMED OUT") ||
      !hasOverviewV3HeroStructuralChange(overviewV3Diff)
    ) {
      return "FAIL";
    }
  }
  if (diffStat.length > 0) return "PASS";
  return "FAIL";
}

function evaluateFixOld(recommendedTask = generateUIReviewPlaceholder()[0]?.recommendedTask ?? "") {
  const diffStat = run("git diff --shortstat", 15_000).trim();
  const changedFiles = run("git diff --name-only", 15_000)
    .split(/\r?\n/)
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean);
  const typecheck = run("npx tsc --noEmit", 60_000);
  const screenshotsExist =
    fs.existsSync(path.join(REPO, ".ai-agent-runs", "latest-desktop.png")) &&
    fs.existsSync(path.join(REPO, ".ai-agent-runs", "latest-mobile.png"));

  const typecheckSucceeded = !typecheck.includes("COMMAND FAILED OR TIMED OUT");
  if (!typecheckSucceeded) return "FAIL";
  const changedOnlyPage =
    changedFiles.length === 1 &&
    (changedFiles[0] === "src/app/page.tsx" || changedFiles[0] === "app/page.tsx");
  const changedOverviewV3 = changedFiles.includes("src/app/components/OverviewV3.tsx");
  const targetsOverviewV3HeroDensity =
    recommendedTask.toLowerCase().includes("overviewv3") &&
    recommendedTask.toLowerCase().includes("hero") &&
    recommendedTask.toLowerCase().includes("density");
  if (targetsOverviewV3HeroDensity) {
    if (changedOnlyPage) return "FAIL";
    if (screenshotsExist && diffStat.length > 0 && changedOverviewV3) return "PASS";
    return "UNKNOWN";
  }
  if (screenshotsExist && diffStat.length > 0) return "PASS";
  return "UNKNOWN";
}

async function runStructuredAction(request: AgentRequest) {
  switch (request.action) {
    case "health":
      return "OK";

    case "gitStatus":
      return summarizeOutput(run("git status --short", 15_000)) || "No changes";

    case "gitDiff":
      return summarizeOutput(run("git diff --stat; git diff", 20_000)) || "No diff";

    case "readFile": {
      const target = requireString(request.path, "path");
      return summarizeOutput(fs.readFileSync(safePath(target), "utf8"));
    }

    case "writeFile": {
      const target = requireString(request.path, "path");
      const content = requireString(request.content, "content");
      const fullPath = safePath(target);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf8");
      return `Wrote file: ${target}`;
    }

    case "replaceText": {
      const target = requireString(request.path, "path");
      const oldText = requireString(request.from, "from");
      const newText = requireString(request.to, "to");
      const fullPath = safePath(target);
      const current = fs.readFileSync(fullPath, "utf8");
      if (!current.includes(oldText)) return `Text not found in ${target}`;
      fs.writeFileSync(fullPath, current.replace(oldText, newText), "utf8");
      return `Replaced text in file: ${target}`;
    }

    case "typecheck":
      return summarizeOutput(run("npx tsc --noEmit", 60_000));

    case "screenshot": {
      const output = takeScreenshots();
      if (output.includes("COMMAND FAILED OR TIMED OUT")) return summarizeOutput(output, 4_000);
      return "Screenshots captured: .ai-agent-runs/latest-desktop.png, .ai-agent-runs/latest-mobile.png";
    }

    case "evaluateFix":
      return evaluateFix();

    case "autoLoop": {
      const stages = ["autoImproveUI", "planFix", "executeFix", "evaluateFix"] as const;
      const report: string[] = [];

      for (const action of stages) {
        const output = await runStructuredAction({ ...request, action });
        report.push([`## ${action}`, output].join("\n"));
      }

      return summarizeOutput(report.join("\n\n"), 30_000);
    }

    case "reviewUI": {
      return reviewUI();
    }

    case "autoImproveUI": {
      reviewUI();
      const [topFinding] = generateUIReviewPlaceholder();
      return [
        "Auto UI improvement review ready.",
        "Desktop: .ai-agent-runs/latest-desktop.png",
        "Mobile: .ai-agent-runs/latest-mobile.png",
        `Top UI issue: ${topFinding.issue}`,
        `Likely file: ${topFinding.likelyFile}`,
        `Recommended Codex task: ${topFinding.recommendedTask}`,
      ].join("\n");
    }

    case "planFix": {
      const [topFinding] = generateUIReviewPlaceholder();
      return topFinding.recommendedTask;
    }

    case "executeFix": {
      // executeFix and planFix must share the same task source.
      const task = generateUIReviewPlaceholder()[0].recommendedTask;
      const beforeGitStatus = run("git status --short", 15_000);
      const { codexOutput, validation } = await runCodex(task, true);
      const gitStatus = summarizeOutput(run("git status --short", 15_000)) || "No changes";
      if (validation.includes("COMMAND FAILED OR TIMED OUT")) {
        const beforeModified = new Set(trackedModifiedFilesFromStatus(beforeGitStatus));
        const filesToRestore = trackedModifiedFilesFromStatus(gitStatus).filter((file) => !beforeModified.has(file));
        const rollbackOutput =
          filesToRestore.length > 0
            ? run(`git restore -- ${filesToRestore.map(quotePowerShellPath).join(" ")}`, 20_000)
            : "No new modified tracked files to restore.";
        const postRollbackGitStatus = summarizeOutput(run("git status --short", 15_000)) || "No changes";
        const evaluation = evaluateFix();

        return summarizeOutput(
          [
            "Executed fix task:",
            task,
            "",
            "Codex output:",
            codexOutput,
            "",
            "Validation:",
            validation,
            "",
            "Evaluation:",
            evaluation,
            "",
            "Rollback occurred: validation command failed or timed out.",
            "Rollback restored modified tracked files only; untracked files were not deleted.",
            "",
            "Initial git status:",
            summarizeOutput(beforeGitStatus) || "No changes",
            "",
            "Restored files:",
            filesToRestore.length > 0 ? filesToRestore.join("\n") : "None",
            "",
            "Rollback output:",
            rollbackOutput,
            "",
            "Git status after rollback:",
            postRollbackGitStatus,
          ].join("\n"),
          20_000
        );
      }
      const gitDiff = summarizeOutput(run("git diff --stat; git diff", 20_000)) || "No diff";
      const screenshots = takeScreenshots();
      const evaluation = evaluateFix();

      return summarizeOutput(
        [
          "Executed fix task:",
          task,
          "",
          "Codex output:",
          codexOutput,
          "",
          "Validation:",
          validation,
          "",
          "Initial git status:",
          summarizeOutput(beforeGitStatus) || "No changes",
          "",
          "Git status:",
          gitStatus,
          "",
          "Git diff:",
          gitDiff,
          "",
          "Screenshot capture:",
          screenshots,
          "",
          "Evaluation:",
          evaluation,
        ].join("\n"),
        20_000
      );
    }

    case "autofix": {
      const gitStatus = summarizeOutput(run("git status --short", 15_000)) || "No changes";
      const typecheck = summarizeOutput(run("npx tsc --noEmit", 60_000));
      const screenshots = takeScreenshots();
      const gitDiff = summarizeOutput(run("git diff --stat; git diff", 20_000)) || "No diff";

      return summarizeOutput(
        [
          "Git status:",
          gitStatus,
          "",
          "Typecheck:",
          typecheck,
          "",
          "Screenshot capture:",
          screenshots,
          "",
          "Git diff:",
          gitDiff,
        ].join("\n"),
        20_000
      );
    }

    default:
      throw new Error(`Unsupported action: ${request.action}`);
  }
}

function directInspect(goal: string) {
  const lower = goal.toLowerCase();

  if (lower.startsWith("create file")) return createFile(goal);
  if (lower.startsWith("replace file")) return replaceFile(goal);
  if (lower.startsWith("replace text in file")) return replaceText(goal);
  if (lower.includes("screenshot") || lower.includes("capture")) return takeScreenshots();
  if (lower.includes("git status")) return run("git status --short");
  if (lower.includes("git diff")) return run("git diff --stat; git diff");
  if (lower.includes("git log")) return run("git log --oneline -10");
  if (lower.includes("typescript") || lower.includes("tsc") || lower.includes("typecheck") || lower.includes("type check")) return run("npx tsc --noEmit");

  if (lower.startsWith("dir") || lower.includes("list files") || lower.includes("show files") || lower.includes("list directory") || lower.includes("show directory")) {
    const possiblePath = extractQuotedPath(goal);
    if (possiblePath) return run(`Get-ChildItem -Force "${safePath(possiblePath)}"`);
    return run("Get-ChildItem -Force");
  }

  if (lower.includes("read file") || lower.includes("show file") || lower.includes("type file") || lower.includes("output file") || lower.includes("contents of")) {
    const filePath = extractLikelyPath(goal);
    if (!filePath) return `No file path found. Use: Read file "src/app/page.tsx"`;
    return run(`Get-Content -Raw "${safePath(filePath)}"`);
  }

  if (lower.includes("find ") || lower.includes("search ")) {
    const quoted = [...goal.matchAll(/["'`](.+?)["'`]/g)].map((m) => m[1]);
    const needle = quoted[0];
    if (!needle) return `No search text found. Use: Search "AppleHome"`;

    return run(
      `Get-ChildItem -Path "${REPO}" -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.json,*.css,*.md | ` +
        `Where-Object { $_.FullName -notlike "*\\.next\\*" -and $_.FullName -notlike "*\\node_modules\\*" } | ` +
        `Select-String "${needle.replaceAll('"', '\\"')}"`
    );
  }

  return "";
}

function shouldInspectDirectly(goal: string, mode: AgentMode) {
  if (mode === "inspect") return true;
  if (mode === "codex") return false;

  const lower = goal.toLowerCase();

  return (
    lower.startsWith("create file") ||
    lower.startsWith("replace file") ||
    lower.startsWith("replace text in file") ||
    lower.includes("screenshot") ||
    lower.includes("capture") ||
    lower.includes("git status") ||
    lower.includes("git diff") ||
    lower.includes("git log") ||
    lower.includes("typescript") ||
    lower.includes("tsc") ||
    lower.includes("typecheck") ||
    lower.includes("type check") ||
    lower.startsWith("dir") ||
    lower.includes("list files") ||
    lower.includes("show files") ||
    lower.includes("list directory") ||
    lower.includes("show directory") ||
    lower.includes("read file") ||
    lower.includes("show file") ||
    lower.includes("type file") ||
    lower.includes("output file") ||
    lower.includes("contents of") ||
    lower.includes("find ") ||
    lower.includes("search ")
  );
}

async function runCodex(goal: string, runValidation: boolean) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const promptPath = path.join(LOG_DIR, `${timestamp}-codex-prompt.txt`);

  const codexPrompt = `
You are working in the Neven repo at C:\\Users\\summe\\liberva.

Goal:
${goal}

Rules:
- Follow the goal exactly.
- Make the smallest targeted change.
- Do not rewrite unrelated files.
- Do not modify package.json, package-lock.json, playwright.config.ts, next.config.ts, .ai/*, or API routes unless the goal explicitly requires it.
- Do not run npm run build unless the goal explicitly asks for it.
- Do not run tests unless the goal explicitly asks for them.
- If the goal asks to read or inspect only, do not modify files.
- At the end, summarize exactly what you did.
`;

  fs.writeFileSync(promptPath, codexPrompt, "utf8");

  const codexOutput = run(`Get-Content -Raw "${promptPath}" | codex exec -s workspace-write -`, 240_000);

  let validation = "";
  if (runValidation) {
    validation = run("npx tsc --noEmit", 60_000);
  }

  return { codexOutput, validation };
}

async function runAgent(request: AgentRequest) {
  const goal = String(request.goal || "").trim();
  const mode = request.mode ?? "auto";
  const runValidation = Boolean(request.runValidation);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (request.action) {
    const summary = await runStructuredAction(request);
    save(`${timestamp}-${request.action}-summary.txt`, summary);
    return { ok: true, summary };
  }

  if (!goal) throw new Error("Missing goal");

  save(`${timestamp}-goal.txt`, goal);

  if (shouldInspectDirectly(goal, mode)) {
    const output = directInspect(goal);
    save(`${timestamp}-direct-output.txt`, output);

    return {
      ok: true,
      summary: summarizeOutput(output),
    };
  }

  const { codexOutput, validation } = await runCodex(goal, runValidation);
  save(`${timestamp}-codex-output.txt`, codexOutput);

  const gitStatus = run("git status --short", 15_000);
  const gitDiff = run("git diff --stat; git diff", 20_000);

  save(`${timestamp}-git-status.txt`, gitStatus);
  save(`${timestamp}-git-diff.patch`, gitDiff);
  if (validation) save(`${timestamp}-validation.txt`, validation);

  return {
    ok: true,
    summary: summarizeOutput([codexOutput, validation, gitStatus, gitDiff].filter(Boolean).join("\n\n")),
  };
}

const server = http.createServer(async (req, res) => {
  req.setTimeout(125_000, () => {
    json(res, 408, { ok: false, summary: "Request timed out" });
    req.destroy();
  });

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, summary: "OK" });
    return;
  }

  if (req.method === "POST" && req.url === "/run-agent") {
    let body = "";
    let responded = false;

    req.on("data", (chunk) => {
      if (responded) return;
      body += chunk.toString();
      if (body.length > 1024 * 1024 * 5) {
        responded = true;
        json(res, 413, { ok: false, summary: "Request body too large" });
        req.destroy();
      }
    });

    req.on("end", async () => {
      if (responded) return;
      try {
        const parsed = JSON.parse(body || "{}") as AgentRequest;
        const result = await runAgent(parsed);
        responded = true;
        json(res, 200, result);
      } catch (err: any) {
        responded = true;
        json(res, 500, { ok: false, summary: err.message });
      }
    });

    return;
  }

  json(res, 404, { ok: false, summary: "Not found" });
});

server.headersTimeout = 130_000;
server.requestTimeout = 130_000;

server.listen(PORT, () => {
  console.log(`Neven agent server running on http://localhost:${PORT}`);
  console.log(`POST tasks to http://localhost:${PORT}/run-agent`);
});
