import { createHash, timingSafeEqual } from "crypto";
import type { FinancialVaultState, ProfileValueKey } from "./financialVaultTypes.ts";
import type { FinancialDigitalTwin, TwinSimulationOutput } from "./financialDigitalTwin.ts";

export const PRODUCT_UPGRADE_PROGRAM_VERSION = "private-beta-platform-v1";

export type UpgradeGate = { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string; action: string | null };

const requiredProfileFields: Array<{ key: ProfileValueKey; label: string; weight: number }> = [
  { key: "incomeAnnual", label: "Verified annual income", weight: 16 },
  { key: "employerName", label: "Employment source", weight: 8 },
  { key: "assets", label: "Assets", weight: 12 },
  { key: "liabilities", label: "Liabilities", weight: 12 },
  { key: "mortgageBalance", label: "Mortgage balance", weight: 10 },
  { key: "interestRate", label: "Mortgage rate", weight: 8 },
  { key: "superBalance", label: "Superannuation", weight: 10 },
  { key: "monthlySpending", label: "Monthly spending", weight: 14 },
  { key: "recurringSubscriptions", label: "Recurring commitments", weight: 10 },
];

export function buildVaultCompletion(vault: FinancialVaultState) {
  const completed = requiredProfileFields.filter(({ key }) => {
    const value = vault.financial_profile[key];
    return (typeof value === "number" && value > 0) || (typeof value === "string" && value.trim().length > 0);
  });
  const score = completed.reduce((sum, item) => sum + item.weight, 0);
  const missing = requiredProfileFields
    .filter((item) => !completed.includes(item))
    .map((item) => ({ field: item.key, label: item.label, impact: item.weight, actionHref: "/financial-vault" }))
    .sort((a, b) => b.impact - a.impact);
  const stale = Object.entries(vault.financial_profile.sources)
    .filter(([, source]) => source && Date.now() - new Date(source.uploadedAt).getTime() > 180 * 86_400_000)
    .map(([field, source]) => ({ field, documentId: source!.documentId, uploadedAt: source!.uploadedAt }));
  return {
    score,
    status: score >= 90 && stale.length === 0 ? "complete" : score >= 65 ? "usable-with-gaps" : "incomplete",
    completedFields: completed.map((item) => item.key),
    missing,
    stale,
    nextBestAction: missing[0]?.label ?? (stale.length ? "Refresh stale financial evidence" : "Vault is ready"),
  } as const;
}

export function buildTwinResilienceReport(baseline: TwinSimulationOutput) {
  const final = baseline.yearly.at(-1);
  if (!final) throw new Error("Digital Twin resilience requires at least one projected year.");
  const shocks = [
    { id: "rates-up-2", label: "Interest rates +2%", cashFlowDelta: -Math.round(final.debt * 0.02), netWorthDelta: -Math.round(final.debt * 0.06), riskDelta: 18 },
    { id: "income-loss-6m", label: "Six-month income interruption", cashFlowDelta: -Math.round(Math.max(0, final.cashFlow) * 0.5), netWorthDelta: -Math.round(Math.max(0, final.cashFlow) * 0.35), riskDelta: 26 },
    { id: "markets-down-30", label: "Investment markets -30%", cashFlowDelta: 0, netWorthDelta: -Math.round(final.investmentBalance * 0.3), riskDelta: 16 },
  ].map((shock) => ({
    ...shock,
    stressedNetWorth: final.netWorth + shock.netWorthDelta,
    stressedCashFlow: final.cashFlow + shock.cashFlowDelta,
    stressedRisk: Math.min(100, final.riskScore + shock.riskDelta),
  }));
  const worst = [...shocks].sort((a, b) => a.stressedNetWorth - b.stressedNetWorth)[0];
  return {
    baselineScenarioId: baseline.scenarioId,
    shocks,
    worstCase: worst,
    resilient: shocks.every((shock) => shock.stressedCashFlow >= 0 && shock.stressedRisk < 80),
    nextAction: worst.stressedCashFlow < 0 ? "Increase emergency liquidity before taking additional risk." : "Review protection and debt buffers quarterly.",
    calculationType: "deterministic" as const,
  };
}

export type AICfoWorkflowKind = "improve-cash-flow" | "prepare-refinance" | "complete-vault" | "scenario-review";

export function buildAICfoWorkflow(kind: AICfoWorkflowKind, vault: FinancialVaultState) {
  const completion = buildVaultCompletion(vault);
  const workflows = {
    "improve-cash-flow": {
      title: "Improve monthly cash flow",
      expectedImpact: Math.round((vault.financial_profile.recurringSubscriptions * 0.2 + vault.financial_profile.monthlySpending * 0.05) * 12),
      steps: ["Review recurring commitments", "Confirm cancellable services", "Track the next full billing cycle", "Verify savings from transaction evidence"],
      evidence: ["Financial Vault monthly spending", "Recurring transaction history"],
    },
    "prepare-refinance": {
      title: "Prepare for a refinance review",
      expectedImpact: vault.refinance_opportunities[0]?.estimatedAnnualSaving ?? 0,
      steps: ["Complete mortgage evidence", "Confirm income and liabilities", "Compare fee-adjusted options", "Prepare broker questions"],
      evidence: ["Mortgage statement", "Payslip", "Liability records"],
    },
    "complete-vault": {
      title: "Complete the Financial Vault",
      expectedImpact: 0,
      steps: completion.missing.slice(0, 4).map((item) => `Add or verify ${item.label.toLowerCase()}`),
      evidence: completion.missing.map((item) => item.label),
    },
    "scenario-review": {
      title: "Review a Digital Twin decision",
      expectedImpact: 0,
      steps: ["Choose a baseline", "Define one decision change", "Run downside stresses", "Review assumptions with an adviser when material"],
      evidence: ["Digital Twin snapshot", "Vault source facts", "Scenario assumptions"],
    },
  } satisfies Record<AICfoWorkflowKind, { title: string; expectedImpact: number; steps: string[]; evidence: string[] }>;
  const selected = workflows[kind];
  return {
    id: `ai-cfo-workflow-${kind}`,
    ...selected,
    kind,
    status: "ready-to-start" as const,
    confidence: completion.score >= 80 ? "High" : completion.score >= 55 ? "Medium" : "Low",
    assumptions: ["Financial Vault values remain current", "Expected impact is indicative until verified after action"],
    professionalReviewRequired: kind === "prepare-refinance" || kind === "scenario-review",
    realisedImpact: null,
    verificationRequired: true,
  };
}

export function buildAdviserWorkspace(vault: FinancialVaultState, twin: FinancialDigitalTwin) {
  const completion = buildVaultCompletion(vault);
  const flags = [
    vault.borrowing_capacity.riskLevel === "high" ? "Borrowing serviceability needs review" : null,
    completion.stale.length ? `${completion.stale.length} source value(s) are stale` : null,
    completion.missing.length ? `${completion.missing.length} material Vault field(s) remain incomplete` : null,
  ].filter((value): value is string => Boolean(value));
  return {
    clientSummary: {
      netPosition: vault.financial_profile.assets - vault.financial_profile.liabilities - vault.financial_profile.mortgageBalance,
      income: vault.financial_profile.incomeAnnual,
      monthlySurplus: vault.borrowing_capacity.surplusIncome,
      vaultCompletion: completion.score,
      twinConfidence: twin.knowledgeHealth.digitalTwinConfidence,
    },
    evidenceIndex: vault.uploaded_documents.map((document) => ({ id: document.id, title: document.fileName, type: document.documentType, status: document.status, confidence: document.extractionConfidence })),
    reviewQueue: [...flags, ...completion.missing.slice(0, 3).map((item) => `Verify ${item.label.toLowerCase()}`)],
    permissions: { canViewEvidence: true, canComment: true, canEditVerifiedFacts: false, canExecuteFinancialActions: false },
    disclosure: "Adviser access is read-only by default. Recommendations and actions require the client's explicit approval.",
  };
}

export type OnboardingState = { acceptedTerms: boolean; privacyAcknowledged: boolean; identityVerified: boolean; dataModeConfirmed: boolean; vaultStarted: boolean; goalsCaptured: boolean; firstReviewCompleted: boolean };

export function buildBetaOnboarding(state: OnboardingState) {
  const steps = [
    ["terms", "Accept beta terms", state.acceptedTerms],
    ["privacy", "Understand financial-data privacy", state.privacyAcknowledged],
    ["identity", "Verify identity", state.identityVerified],
    ["data-mode", "Confirm live or demo data", state.dataModeConfirmed],
    ["vault", "Start the Financial Vault", state.vaultStarted],
    ["goals", "Choose financial priorities", state.goalsCaptured],
    ["review", "Complete the first financial review", state.firstReviewCompleted],
  ].map(([id, label, complete], index) => ({ id: String(id), label: String(label), complete: Boolean(complete), order: index + 1 }));
  const completed = steps.filter((step) => step.complete).length;
  return { steps, progress: Math.round((completed / steps.length) * 100), nextStep: steps.find((step) => !step.complete) ?? null, productAccess: state.acceptedTerms && state.privacyAcknowledged && state.identityVerified ? "enabled" : "restricted" } as const;
}

export function buildPerformanceBudget(metrics: { lcpMs: number; inpMs: number; cls: number; initialJsKb: number; apiP95Ms: number }) {
  const budgets = [
    { metric: "LCP", value: metrics.lcpMs, limit: 2500, unit: "ms" },
    { metric: "INP", value: metrics.inpMs, limit: 200, unit: "ms" },
    { metric: "CLS", value: metrics.cls, limit: 0.1, unit: "score" },
    { metric: "Initial JS", value: metrics.initialJsKb, limit: 250, unit: "KB" },
    { metric: "API p95", value: metrics.apiP95Ms, limit: 500, unit: "ms" },
  ].map((item) => ({ ...item, status: item.value <= item.limit ? "pass" as const : "fail" as const }));
  return { ok: budgets.every((item) => item.status === "pass"), budgets, cachePolicy: "private, no-store for financial data; immutable caching only for versioned static assets", paginationRequiredAbove: 100 };
}

export function buildSecurityHeaders(nonce: string) {
  return {
    "Content-Security-Policy": `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Cache-Control": "private, no-store",
  } as const;
}

export function verifyCsrfToken(expected: string, provided: string): boolean {
  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

export class SlidingWindowRateLimiter {
  private readonly attempts = new Map<string, number[]>();
  allow(key: string, nowMs = Date.now(), limit = 20, windowMs = 60_000): boolean {
    const recent = (this.attempts.get(key) ?? []).filter((value) => nowMs - value < windowMs);
    if (recent.length >= limit) return false;
    recent.push(nowMs);
    this.attempts.set(key, recent);
    return true;
  }
}

export function buildPrivateBetaReadiness(input: {
  openBankingReady: boolean;
  documentIngestionReady: boolean;
  vaultScore: number;
  digitalTwinReady: boolean;
  aiCfoReady: boolean;
  adviserWorkspaceReady: boolean;
  onboardingReady: boolean;
  performanceReady: boolean;
  securityReady: boolean;
  productionPersistenceReady: boolean;
  supportOwnerConfigured: boolean;
  incidentRunbookConfigured: boolean;
}) {
  const gates: UpgradeGate[] = [
    { id: "open-banking", label: "Open Banking", status: input.openBankingReady ? "pass" : "fail", detail: "Provider consent, token vault and sync controls.", action: input.openBankingReady ? null : "Configure the selected live provider." },
    { id: "documents", label: "Document ingestion", status: input.documentIngestionReady ? "pass" : "fail", detail: "PDF/CSV validation and review routing.", action: input.documentIngestionReady ? null : "Complete secure document processing." },
    { id: "vault", label: "Financial Vault", status: input.vaultScore >= 80 ? "pass" : input.vaultScore >= 60 ? "warn" : "fail", detail: `Vault completion is ${input.vaultScore}%.`, action: input.vaultScore >= 80 ? null : "Complete missing high-impact facts." },
    { id: "twin", label: "Digital Twin", status: input.digitalTwinReady ? "pass" : "fail", detail: "Scenario and downside-stress calculations.", action: input.digitalTwinReady ? null : "Validate simulation controls." },
    { id: "ai-cfo", label: "AI CFO workflows", status: input.aiCfoReady ? "pass" : "fail", detail: "Grounded, approval-aware action workflows.", action: input.aiCfoReady ? null : "Complete workflow validation." },
    { id: "adviser", label: "Adviser workspace", status: input.adviserWorkspaceReady ? "pass" : "fail", detail: "Read-only evidence and review queue.", action: input.adviserWorkspaceReady ? null : "Complete adviser permissions." },
    { id: "onboarding", label: "Beta onboarding", status: input.onboardingReady ? "pass" : "fail", detail: "Consent, privacy, identity and first-value journey.", action: input.onboardingReady ? null : "Complete onboarding gates." },
    { id: "performance", label: "Performance", status: input.performanceReady ? "pass" : "fail", detail: "Web and API budgets.", action: input.performanceReady ? null : "Resolve failed performance budgets." },
    { id: "security", label: "Security", status: input.securityReady ? "pass" : "fail", detail: "Headers, CSRF, rate limits and secret boundaries.", action: input.securityReady ? null : "Resolve security controls." },
    { id: "persistence", label: "Production persistence", status: input.productionPersistenceReady ? "pass" : "fail", detail: "Authenticated durable user-scoped storage.", action: input.productionPersistenceReady ? null : "Complete production database readiness." },
    { id: "support", label: "Beta operations", status: input.supportOwnerConfigured && input.incidentRunbookConfigured ? "pass" : "fail", detail: "Named support owner and incident response runbook.", action: input.supportOwnerConfigured && input.incidentRunbookConfigured ? null : "Assign support ownership and incident runbook." },
  ];
  return {
    ready: gates.every((gate) => gate.status === "pass"),
    decision: gates.every((gate) => gate.status === "pass") ? "READY FOR PRIVATE BETA" : "PRIVATE BETA BLOCKED",
    gates,
    blockers: gates.filter((gate) => gate.status === "fail"),
    warnings: gates.filter((gate) => gate.status === "warn"),
    generatedAt: new Date().toISOString(),
  } as const;
}
