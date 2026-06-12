import http from "node:http";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = 4002;
const REPO = "C:\\Users\\summe\\liberva";
const LOG_DIR = path.join(REPO, ".ai-agent-runs");

function loadLocalEnv() {
  const envPath = path.join(REPO, ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = value.replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();
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
  | "aiReviewUI"
  | "aiAutoLoop"
  | "autonomousBuild"
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
  iterations?: number;
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
  targetArea: string;
  recommendedTask: string;
  category: UIReviewCategory;
  confidence: number;
  currentScore: number;
  successCriteria: string;
};

type UIReviewCategory =
  | "information_hierarchy"
  | "navigation"
  | "workflow"
  | "feature_gap"
  | "dashboard_insight"
  | "accessibility"
  | "responsiveness"
  | "layout";

const UI_REVIEW_CATEGORIES: UIReviewCategory[] = [
  "information_hierarchy",
  "navigation",
  "workflow",
  "feature_gap",
  "dashboard_insight",
  "accessibility",
  "responsiveness",
  "layout",
];

const UI_REVIEW_CATEGORY_PRIORITY: UIReviewCategory[] = [
  "feature_gap",
  "workflow",
  "information_hierarchy",
  "navigation",
  "dashboard_insight",
  "accessibility",
  "responsiveness",
  "layout",
];

function isUIReviewCategory(value: unknown): value is UIReviewCategory {
  return typeof value === "string" && UI_REVIEW_CATEGORIES.includes(value as UIReviewCategory);
}

function screenshotInputImage(fileName: string) {
  const fullPath = path.join(REPO, ".ai-agent-runs", fileName);
  if (!fs.existsSync(fullPath)) return null;
  const base64 = fs.readFileSync(fullPath).toString("base64");
  return {
    type: "input_image",
    image_url: `data:image/png;base64,${base64}`,
  };
}

function responseTextFromOpenAI(payload: any) {
  if (typeof payload.output_text === "string") return payload.output_text;

  const parts: string[] = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function uiReviewJsonFormat() {
  return {
    format: {
      type: "json_schema",
      name: "ui_review",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          issue: { type: "string" },
          likelyFile: {
            type: "string",
            enum: [
              "src/app/page.tsx",
              "src/app/components/OverviewV3.tsx",
              "src/app/components/MobileNav.tsx",
              "src/app/components/sections/TransactionsSection.tsx",
              "src/app/components/sections/SubscriptionsSection.tsx",
              "src/app/components/ImportWorkflow.tsx",
            ],
          },
          targetArea: { type: "string" },
          recommendedTask: { type: "string" },
          category: {
            type: "string",
            enum: UI_REVIEW_CATEGORIES,
          },
          confidence: { type: "number" },
          currentScore: { type: "number" },
          successCriteria: { type: "string" },
        },
        required: [
          "issue",
          "likelyFile",
          "targetArea",
          "recommendedTask",
          "category",
          "confidence",
          "currentScore",
          "successCriteria",
        ],
      },
    },
  };
}

async function requestUIReview(apiKey: string, content: any[]) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content,
        },
      ],
      text: uiReviewJsonFormat(),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      [
        "OpenAI Responses API failed.",
        `Status: ${response.status}`,
        `Status text: ${response.statusText}`,
        "JSON error body:",
        summarizeOutput(JSON.stringify(payload), 2_000),
      ].join("\n")
    );
  }

  const text = responseTextFromOpenAI(payload);
  if (!text) throw new Error("OpenAI Responses API returned no review text.");
  return text;
}

function fallbackUIReviewJson(issue: string): string {
  const overviewFile = fs.existsSync(path.join(REPO, "src/app/components/OverviewV3.tsx"))
    ? "src/app/components/OverviewV3.tsx"
    : "src/app/page.tsx";

  return JSON.stringify(
    {
      issue,
      likelyFile: overviewFile,
      targetArea: "dashboard-spacing",
      recommendedTask: `Review ${overviewFile} against the captured desktop and mobile screenshots and make the smallest visible spacing or hierarchy improvement.`,
      category: "layout",
      confidence: 0,
      currentScore: 1,
      successCriteria: "The next desktop and mobile screenshots show a clearer dashboard hierarchy with no new visible layout regressions.",
    },
    null,
    2
  );
}

async function aiReviewUI(captureScreenshots = true) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackUIReviewJson("OPENAI_API_KEY is missing, so screenshot vision review could not run.");
  }

  if (captureScreenshots) takeScreenshots();
  const prompt = [
    "You are a senior product designer reviewing the visible Neven dashboard screenshots.",
    "Use only the screenshot images, screenshot paths, and valid likelyFile values below.",
    "Identify the single highest-impact visible UI issue.",
    "Assign category using exactly one of: information_hierarchy, navigation, workflow, feature_gap, dashboard_insight, accessibility, responsiveness, layout.",
    `Use this priority order when multiple issues exist: ${UI_REVIEW_CATEGORY_PRIORITY.join(", ")}.`,
    "Never recommend spacing, padding, margin, border radius, gap, or font-size changes if a hierarchy, navigation, workflow, information architecture, feature, dashboard insight, responsiveness, accessibility, or content issue exists.",
    "Only use category=layout when no higher-priority category applies and confidence is at least 0.9.",
    "Set currentScore to a number from 1 to 10 based only on the visible screenshots.",
    "Set targetArea to a short stable UI area key such as hero-kpi-row, mobile-navigation, dashboard-spacing, portfolio-health-section, or import-workflow.",
    "Set successCriteria to one concise sentence that can be judged from the next desktop and mobile screenshots.",
    "Valid likelyFile values are src/app/page.tsx, src/app/components/OverviewV3.tsx, src/app/components/MobileNav.tsx, src/app/components/sections/TransactionsSection.tsx, src/app/components/sections/SubscriptionsSection.tsx, src/app/components/ImportWorkflow.tsx.",
    "Prefer OverviewV3 for dashboard hero/cards/portfolio/health issues.",
    "Do not mention recent code changes, git diff, git status, commits, or screenshots being generated.",
    "Return strict JSON only with issue, likelyFile, targetArea, recommendedTask, category, confidence, currentScore, successCriteria.",
    "Return summary only.",
    "",
    "Screenshot paths:",
    ".ai-agent-runs/latest-desktop.png",
    ".ai-agent-runs/latest-mobile.png",
  ].join("\n");

  const desktopImage = screenshotInputImage("latest-desktop.png");
  const mobileImage = screenshotInputImage("latest-mobile.png");
  const imageContent = [
    { type: "input_text", text: prompt },
    desktopImage,
    mobileImage,
  ].filter(Boolean) as any[];

  if (desktopImage && mobileImage) {
    try {
      return await requestUIReview(apiKey, imageContent);
    } catch {
      // Fall through to the current text-only review when vision input fails.
    }
  }

  const fallbackPrompt = prompt.replace(
    "You are a senior product designer reviewing the visible Neven dashboard screenshots.",
    "You are a senior product designer reviewing the Neven dashboard screenshot paths.\nDo not assume screenshot image contents are available yet."
  );

  try {
    return await requestUIReview(apiKey, [{ type: "input_text", text: fallbackPrompt }]);
  } catch (err: any) {
    return fallbackUIReviewJson(err.message ?? "OpenAI Responses API failed.");
  }
}

function generateUIReviewPlaceholder(): UIReviewFinding[] {
  const desktopPath = path.join(REPO, ".ai-agent-runs", "latest-desktop.png");
  const mobilePath = path.join(REPO, ".ai-agent-runs", "latest-mobile.png");
  const likelyFileCandidates = [
    "src/app/page.tsx",
    "app/page.tsx",
    "src/components/dashboard.tsx",
    "src/components/Dashboard.tsx",
    "src/app/globals.css",
    "app/globals.css",
  ];
  const likelyFile = likelyFileCandidates.find((candidate) => fs.existsSync(path.join(REPO, candidate))) ?? "src/app/page.tsx";
  const overviewFile = fs.existsSync(path.join(REPO, "src/app/components/OverviewV3.tsx"))
    ? "src/app/components/OverviewV3.tsx"
    : likelyFile;

  const findings: UIReviewFinding[] = [];

  if (fs.existsSync(desktopPath)) {
    findings.push({
      issue: "OverviewV3 needs a specific hero layout pass with a denser KPI row.",
      likelyFile: overviewFile,
      targetArea: "hero-kpi-row",
      recommendedTask: `Review ${overviewFile} and move Financial Health into the KPI row, creating a 5-card KPI grid while reducing hero vertical spacing.`,
      category: "information_hierarchy",
      confidence: 0.5,
      currentScore: 5,
      successCriteria: "The hero KPI row is denser on desktop and remains readable on mobile without crowding or overlap.",
    });
  }

  if (fs.existsSync(mobilePath)) {
    findings.push({
      issue: "Mobile card density may be too high, making dashboard cards feel stacked and hard to scan on narrow screens.",
      likelyFile,
      targetArea: "dashboard-spacing",
      recommendedTask: `Review ${likelyFile} mobile breakpoints and adjust card spacing, stacking, and summary density for a 390px viewport.`,
      category: "responsiveness",
      confidence: 0.5,
      currentScore: 5,
      successCriteria: "The 390px mobile screenshot shows clearer stacked dashboard sections with comfortable spacing and no clipped text.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      issue: "OverviewV3 may need a specific hero layout pass with a denser KPI row.",
      likelyFile: overviewFile,
      targetArea: "hero-kpi-row",
      recommendedTask: `Capture desktop and mobile screenshots, then review ${overviewFile} to move Financial Health into the KPI row, create a 5-card KPI grid, and reduce hero vertical spacing.`,
      category: "information_hierarchy",
      confidence: 0.25,
      currentScore: 5,
      successCriteria: "The captured screenshots show a denser hero KPI row with balanced spacing on desktop and mobile.",
    });
  }

  return findings;
}

function parseUIReviewFinding(output: string) {
  try {
    const parsed = JSON.parse(output.trim()) as Partial<UIReviewFinding>;
    if (
      typeof parsed.issue !== "string" ||
      typeof parsed.likelyFile !== "string" ||
      typeof parsed.targetArea !== "string" ||
      typeof parsed.recommendedTask !== "string" ||
      !isUIReviewCategory(parsed.category) ||
      typeof parsed.confidence !== "number" ||
      typeof parsed.currentScore !== "number" ||
      typeof parsed.successCriteria !== "string" ||
      parsed.recommendedTask.trim().length === 0
    ) {
      return null;
    }
    return {
      issue: parsed.issue,
      likelyFile: parsed.likelyFile,
      targetArea: parsed.targetArea,
      recommendedTask: parsed.recommendedTask,
      category: parsed.category,
      confidence: parsed.confidence,
      currentScore: Math.min(10, Math.max(1, parsed.currentScore)),
      successCriteria: parsed.successCriteria,
    };
  } catch {
    return null;
  }
}

function scoreFromReviewOutput(output: string) {
  try {
    const parsed = JSON.parse(output.trim()) as Partial<UIReviewFinding>;
    if (typeof parsed.currentScore === "number") {
      return Math.min(10, Math.max(1, parsed.currentScore));
    }
    if (typeof parsed.confidence === "number") {
      return parsed.confidence;
    }
  } catch {
    return null;
  }
  return null;
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

function copyLatestScreenshots(label: string) {
  const paths = {
    desktop: `.ai-agent-runs/${label}-desktop.png`,
    mobile: `.ai-agent-runs/${label}-mobile.png`,
  };
  for (const [source, target] of [
    ["latest-desktop.png", paths.desktop],
    ["latest-mobile.png", paths.mobile],
  ] as const) {
    const sourcePath = path.join(REPO, ".ai-agent-runs", source);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, path.join(REPO, target));
    }
  }
  return paths;
}

function isTrackedAppFile(filePath: string) {
  const normalized = filePath.replaceAll("\\", "/");
  return (
    normalized !== "tools/neven-agent/agent-server.ts" &&
    (normalized.startsWith("src/app/") || normalized.startsWith("app/"))
  );
}

function trackedAppFileSnapshot() {
  const files = run("git ls-files -- src/app app", 15_000)
    .split(/\r?\n/)
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean)
    .filter(isTrackedAppFile);
  const snapshot = new Map<string, string>();
  for (const file of files) {
    const fullPath = path.join(REPO, file);
    if (fs.existsSync(fullPath)) snapshot.set(file, fs.readFileSync(fullPath, "utf8"));
  }
  return snapshot;
}

function restoreTrackedAppFiles(snapshot: Map<string, string>) {
  const modifiedTrackedAppFiles = trackedModifiedFilesFromStatus(run("git status --short", 15_000))
    .map((file) => file.replaceAll("\\", "/"))
    .filter(isTrackedAppFile);
  const restored: string[] = [];

  for (const file of modifiedTrackedAppFiles) {
    const previousContent = snapshot.get(file);
    if (previousContent === undefined) continue;
    const fullPath = path.join(REPO, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, previousContent, "utf8");
    restored.push(file);
  }

  return restored;
}

function rollbackAppFiles(snapshot: Map<string, string>) {
  const restored = restoreTrackedAppFiles(snapshot);
  const createdAppFiles = modifiedFilesFromStatus(run("git status --short", 15_000))
    .map((file) => file.replaceAll("\\", "/"))
    .filter(isTrackedAppFile)
    .filter((file) => !snapshot.has(file));

  for (const file of createdAppFiles) {
    fs.rmSync(path.join(REPO, file), { force: true, recursive: true });
  }

  return restored;
}

function normalizedIterations(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 3;
  return Math.min(10, Math.max(1, Math.floor(value)));
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

function isLowValueUiChange(diff: string): boolean {
  const changedLines = changedDiffLines(diff).filter((line) => line.slice(1).trim().length > 0);
  if (changedLines.length < 5) return true;

  const changedText = changedLines.map((line) => line.slice(1).trim());
  const spacingClassPattern =
    /\b(?:m[trblxy]?|p[trblxy]?|gap|space-x|space-y)-\[[^\]]+\]|\b(?:m[trblxy]?|p[trblxy]?|gap|space-x|space-y)-[A-Za-z0-9./-]+/g;
  const layoutOnlyClassPattern =
    /\b(?:m[trblxy]?|p[trblxy]?|gap|space-x|space-y|rounded(?:-[trbl]{1,2})?|w)-\[[^\]]+\]|\b(?:m[trblxy]?|p[trblxy]?|gap|space-x|space-y|rounded(?:-[trbl]{1,2})?|w)-[A-Za-z0-9./%()-]+|\btext-\[[^\]]+\]|\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g;
  const cssLayoutOnlyPattern =
    /\b(?:border-radius|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|gap|width|font-size)\s*:\s*[^;"']+;?/gi;
  const hasSpacingClassPattern =
    /\b(?:m[trblxy]?|p[trblxy]?|gap|space-x|space-y)-\[[^\]]+\]|\b(?:m[trblxy]?|p[trblxy]?|gap|space-x|space-y)-[A-Za-z0-9./-]+/;
  const hasLayoutOnlyClassPattern =
    /\b(?:m[trblxy]?|p[trblxy]?|gap|space-x|space-y|rounded(?:-[trbl]{1,2})?|w)-\[[^\]]+\]|\b(?:m[trblxy]?|p[trblxy]?|gap|space-x|space-y|rounded(?:-[trbl]{1,2})?|w)-[A-Za-z0-9./%()-]+|\btext-\[[^\]]+\]|\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/;
  const hasCssLayoutOnlyPattern =
    /\b(?:border-radius|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|gap|width|font-size)\s*:\s*[^;"']+;?/i;
  const jsxStructurePattern =
    /^[+-]\s*(?:<\/?[A-Za-z][\w.:-]*\b|<>|<\/>)/;
  const componentChangePattern =
    /^[+-]\s*(?:export\s+default\s+)?(?:function\s+[A-Z][A-Za-z0-9_]*\b|const\s+[A-Z][A-Za-z0-9_]*\s*=|class\s+[A-Z][A-Za-z0-9_]*\s+extends\s+)/;

  const normalizeLine = (line: string, pattern: RegExp) =>
    line
      .replace(pattern, "")
      .replace(cssLayoutOnlyPattern, "")
      .replace(/\s+/g, " ")
      .trim();

  const onlySpacingClassChanges = changedText.every((line) => {
    if (!/(?:className|class=)/.test(line)) return false;
    return normalizeLine(line, spacingClassPattern).length === 0 || normalizeLine(line, spacingClassPattern) === line.replace(spacingClassPattern, "").replace(/\s+/g, " ").trim();
  });
  if (
    onlySpacingClassChanges &&
    changedText.some((line) => hasSpacingClassPattern.test(line))
  ) {
    return true;
  }

  const onlyLayoutValueChanges = changedText.every((line) => {
    const normalized = normalizeLine(line, layoutOnlyClassPattern);
    return normalized.length === 0 || normalized === line.replace(layoutOnlyClassPattern, "").replace(cssLayoutOnlyPattern, "").replace(/\s+/g, " ").trim();
  });
  if (
    onlyLayoutValueChanges &&
    changedText.some((line) => hasLayoutOnlyClassPattern.test(line) || hasCssLayoutOnlyPattern.test(line))
  ) {
    return true;
  }

  const hasJsxStructureChange = changedLines.some((line) => jsxStructurePattern.test(line));
  if (!hasJsxStructureChange) return true;

  const hasComponentAddRemove = changedLines.some((line) => componentChangePattern.test(line));
  if (!hasComponentAddRemove) return true;

  return false;
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

  const changedPage = changedFiles.includes("src/app/page.tsx");
  const changedOverviewV3 = changedFiles.includes("src/app/components/OverviewV3.tsx");
  const targetsOverviewV3 = targetFiles.includes("src/app/components/OverviewV3.tsx");
  if (targetsOverviewV3) {
    if (changedPage || !changedOverviewV3) return "FAIL";
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

    case "aiReviewUI":
      return aiReviewUI();

    case "aiAutoLoop": {
      const loopId = new Date().toISOString().replace(/[:.]/g, "-");
      const appFileSnapshot = trackedAppFileSnapshot();
      const reviewOutput = await aiReviewUI();
      const beforeScreenshots = copyLatestScreenshots(`${loopId}-before`);
      const parsedReview = parseUIReviewFinding(reviewOutput) ?? generateUIReviewPlaceholder()[0];
      const selectedTask = [
        "Improve the Neven UI based on this screenshot-only AI review.",
        `Likely file: ${parsedReview.likelyFile}`,
        `Target area: ${parsedReview.targetArea}`,
        `Category: ${parsedReview.category}`,
        `Recommended task: ${parsedReview.recommendedTask}`,
        `Success criteria: ${parsedReview.successCriteria}`,
        "",
        "Rules:",
        "- Make the smallest targeted UI change needed to satisfy the success criteria.",
        "- Never recommend or make spacing, padding, margin, border radius, gap, or font-size changes if a hierarchy, navigation, workflow, information architecture, feature, dashboard insight, responsiveness, accessibility, or content issue exists.",
        "- Modify only the likely file unless the requested UI area clearly requires a directly related component file.",
        "- Do not modify API routes, package files, Next config, Playwright config, or .ai files.",
        "- Do not commit changes.",
      ].join("\n");
      const { codexOutput } = await runCodex(selectedTask, false);
      const afterScreenshotOutput = takeScreenshots();
      const afterScreenshots = copyLatestScreenshots(`${loopId}-after`);
      const afterReviewOutput = await aiReviewUI(false);
      const parsedAfterReview = parseUIReviewFinding(afterReviewOutput);
      const beforeScore = parsedReview.currentScore;
      const afterScore = parsedAfterReview?.currentScore ?? beforeScore;
      const improved = afterScore > beforeScore;
      const typecheck = run("npx tsc --noEmit", 60_000);
      const restoredFiles = afterScore < beforeScore ? restoreTrackedAppFiles(appFileSnapshot) : [];
      const gitDiff = summarizeOutput(run("git diff --stat; git diff", 20_000)) || "No diff";

      return summarizeOutput(
        JSON.stringify(
          {
            beforeScore,
            afterScore,
            improved,
            selectedTask: {
              likelyFile: parsedReview.likelyFile,
              targetArea: parsedReview.targetArea,
              recommendedTask: parsedReview.recommendedTask,
              successCriteria: parsedReview.successCriteria,
            },
            codexOutput: summarizeOutput(codexOutput, 10_000),
            typecheck: summarizeOutput(typecheck, 6_000),
            gitDiff,
            screenshotPaths: {
              before: beforeScreenshots,
              after: afterScreenshots,
            },
            afterScreenshotCapture: summarizeOutput(afterScreenshotOutput, 3_000),
            rollback:
              afterScore < beforeScore
                ? {
                    occurred: true,
                    reason: "afterScore is lower than beforeScore",
                    restoredTrackedAppFiles: restoredFiles,
                    excluded: "tools/neven-agent/agent-server.ts",
                  }
                : {
                    occurred: false,
                    restoredTrackedAppFiles: [],
                  },
          },
          null,
          2
        ),
        30_000
      );
    }

    case "autonomousBuild": {
      const requestedIterations = normalizedIterations(request.iterations);
      const report: Array<{
        iteration: number;
        issue: string;
        file: string;
        category: UIReviewCategory;
        task: string;
        beforeScore: number | null;
        afterScore: number | null;
        improved: boolean | null;
        rejectionReason?: string;
        rollback: {
          occurred: boolean;
          restoredTrackedAppFiles: string[];
          rollbackError?: string;
        };
        gitStatus: string;
        screenshotPaths: {
          before: {
            desktop: string;
            mobile: string;
          };
          after: {
            desktop: string;
            mobile: string;
          };
        };
      }> = [];

      for (let iteration = 1; iteration <= requestedIterations; iteration += 1) {
        const iterationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-autonomous-${iteration}`;
        const appFileSnapshot = trackedAppFileSnapshot();
        let beforeReviewOutput = await aiReviewUI();
        const beforeScreenshots = copyLatestScreenshots(`${iterationId}-before`);
        let beforeReview = parseUIReviewFinding(beforeReviewOutput) ?? generateUIReviewPlaceholder()[0];
        if (beforeReview.category === "layout" && beforeReview.confidence < 0.9) {
          beforeReviewOutput = await aiReviewUI(false);
          beforeReview = parseUIReviewFinding(beforeReviewOutput) ?? generateUIReviewPlaceholder()[0];
        }
        if (beforeReview.category === "layout" && beforeReview.confidence < 0.9) {
          const replacementReviewOutput = await aiReviewUI(false);
          const replacementReview = parseUIReviewFinding(replacementReviewOutput);
          const gitStatus = summarizeOutput(run("git status --short", 15_000), 2_000) || "No changes";
          const afterScreenshots = copyLatestScreenshots(`${iterationId}-after`);

          report.push({
            iteration,
            issue: beforeReview.issue,
            file: beforeReview.likelyFile,
            category: beforeReview.category,
            task: beforeReview.recommendedTask,
            beforeScore: beforeReview.currentScore,
            afterScore: null,
            improved: false,
            rejectionReason: "Rejected category=layout review with confidence below 0.9 and requested another aiReviewUI task.",
            rollback: {
              occurred: false,
              restoredTrackedAppFiles: [],
            },
            gitStatus,
            screenshotPaths: {
              before: beforeScreenshots,
              after: afterScreenshots,
            },
          });

          if (replacementReview && replacementReview.category !== "layout") {
            continue;
          }
          continue;
        }
        const beforeScore = scoreFromReviewOutput(beforeReviewOutput) ?? beforeReview.currentScore ?? beforeReview.confidence ?? null;
        const selectedTask = [
          "Improve the Neven UI based on this screenshot-only AI review.",
          `Likely file: ${beforeReview.likelyFile}`,
          `Target area: ${beforeReview.targetArea}`,
          `Category: ${beforeReview.category}`,
          `Recommended task: ${beforeReview.recommendedTask}`,
          `Success criteria: ${beforeReview.successCriteria}`,
          "",
          "Rules:",
          "- Make the smallest targeted UI change needed to satisfy the success criteria.",
          "- Never recommend or make spacing, padding, margin, border radius, gap, or font-size changes if a hierarchy, navigation, workflow, information architecture, feature, dashboard insight, responsiveness, accessibility, or content issue exists.",
          "- Modify only the likely file unless the requested UI area clearly requires a directly related component file.",
          "- Do not modify API routes, package files, Next config, Playwright config, package files, or .ai files.",
          "- Do not commit changes.",
          "- Return summary only.",
        ].join("\n");

        await runCodex(selectedTask, false);
        const appDiff = run("git diff -- src/app app", 20_000);
        if (appDiff.includes("COMMAND FAILED OR TIMED OUT") || isLowValueUiChange(appDiff)) {
          let rollbackError: string | undefined;
          let restoredTrackedAppFiles: string[] = [];
          try {
            restoredTrackedAppFiles = rollbackAppFiles(appFileSnapshot);
          } catch (err: any) {
            rollbackError = err.message ?? String(err);
          }
          const replacementReviewOutput = await aiReviewUI(false);
          const replacementReview = parseUIReviewFinding(replacementReviewOutput);
          const gitStatus = summarizeOutput(run("git status --short", 15_000), 2_000) || "No changes";
          const afterScreenshots = copyLatestScreenshots(`${iterationId}-after`);

          report.push({
            iteration,
            issue: beforeReview.issue,
            file: beforeReview.likelyFile,
            category: beforeReview.category,
            task: beforeReview.recommendedTask,
            beforeScore,
            afterScore: replacementReview?.currentScore ?? null,
            improved: false,
            rejectionReason: appDiff.includes("COMMAND FAILED OR TIMED OUT")
              ? "Rejected because app diff could not be inspected."
              : "Rejected low-value UI change and requested another aiReviewUI task.",
            rollback: {
              occurred: true,
              restoredTrackedAppFiles,
              ...(rollbackError ? { rollbackError } : {}),
            },
            gitStatus,
            screenshotPaths: {
              before: beforeScreenshots,
              after: afterScreenshots,
            },
          });

          continue;
        }
        run("npx tsc --noEmit", 60_000);
        takeScreenshots();
        const afterScreenshots = copyLatestScreenshots(`${iterationId}-after`);
        const afterReviewOutput = await aiReviewUI(false);
        const afterScore = scoreFromReviewOutput(afterReviewOutput);
        const improved =
          beforeScore === null || afterScore === null
            ? null
            : afterScore > beforeScore;
        const rollbackOccurred =
          beforeScore !== null &&
          afterScore !== null &&
          afterScore < beforeScore;
        let rollbackError: string | undefined;
        let restoredTrackedAppFiles: string[] = [];
        if (rollbackOccurred) {
          try {
            restoredTrackedAppFiles = rollbackAppFiles(appFileSnapshot);
          } catch (err: any) {
            rollbackError = err.message ?? String(err);
          }
        }
        const gitStatus = summarizeOutput(run("git status --short", 15_000), 2_000) || "No changes";

        report.push({
          iteration,
          issue: beforeReview.issue,
          file: beforeReview.likelyFile,
          category: beforeReview.category,
          task: beforeReview.recommendedTask,
          beforeScore,
          afterScore,
          improved,
          rollback: {
            occurred: rollbackOccurred,
            restoredTrackedAppFiles,
            ...(rollbackError ? { rollbackError } : {}),
          },
          gitStatus,
          screenshotPaths: {
            before: beforeScreenshots,
            after: afterScreenshots,
          },
        });

        if (afterScore !== null && afterScore >= 8.5) break;
      }

      return summarizeOutput(JSON.stringify({ iterations: report }, null, 2), 30_000);
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
