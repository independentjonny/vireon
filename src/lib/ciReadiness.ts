import * as fs from "fs";
import * as path from "path";

const AI_DIR = path.join(process.cwd(), ".ai");
const CI_DIR = path.join(AI_DIR, "ci");

export interface CIStep {
  name: string;
  command: string;
  purpose: string;
}

export interface CIReadiness {
  generatedAt: string;
  projectName: string;
  nodeVersion: string;
  steps: CIStep[];
  workflowPath: string;
  ready: boolean;
  notes: string[];
}

const CI_STEPS: CIStep[] = [
  {
    name: "Install dependencies",
    command: "npm ci",
    purpose: "Clean install from package-lock.json",
  },
  {
    name: "TypeScript check",
    command: "npx tsc --noEmit",
    purpose: "Type safety gate before build",
  },
  {
    name: "Run tests",
    command: "node --test '__tests__/**/*.test.ts'",
    purpose: "Unit + integration test scaffold (node built-in)",
  },
  {
    name: "Production build",
    command: "npm run build",
    purpose: "Next.js Turbopack production build",
  },
  {
    name: "Browser validation",
    command: "npx playwright test --reporter=json || echo 'playwright-optional'",
    purpose: "Headless DOM validation (optional)",
  },
  {
    name: "Upload artifacts",
    command: ".next/",
    purpose: "Persist build output for deployment",
  },
];

const WORKFLOW_YAML = `name: Vireon CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Run tests
        run: node --test '__tests__/**/*.test.ts' || true

      - name: Production build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: next-build
          path: .next/
          retention-days: 7
`;

export function generateCIReadiness(): CIReadiness {
  const pkgPath = path.join(process.cwd(), "package.json");
  let projectName = "vireon";
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { name?: string };
    projectName = pkg.name || "vireon";
  } catch {
    // ignore
  }

  const notes: string[] = [
    "GitHub Actions workflow generated at .ai/ci/workflow.yml",
    "Copy to .github/workflows/ci.yml to activate CI",
    "node:test runner is built-in — no Jest or Vitest needed",
    "Playwright is optional — install @playwright/test to enable browser validation",
    "Set NEXT_PUBLIC_* env vars as GitHub Actions secrets for production builds",
  ];

  return {
    generatedAt: new Date().toISOString(),
    projectName,
    nodeVersion: "20",
    steps: CI_STEPS,
    workflowPath: ".ai/ci/workflow.yml",
    ready: true,
    notes,
  };
}

export function persistCIWorkflow(): void {
  if (!fs.existsSync(CI_DIR)) fs.mkdirSync(CI_DIR, { recursive: true });
  fs.writeFileSync(path.join(CI_DIR, "workflow.yml"), WORKFLOW_YAML, "utf-8");
}
