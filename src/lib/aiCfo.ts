import type { FinancialVaultState } from "@/lib/financialVaultTypes";
import type { FinancialBalanceSheet } from "@/lib/financialBalanceSheet";
import type { HousingAffordabilityState } from "@/lib/housingAffordabilityTypes";
import type { AiDecision } from "@/lib/aiDecisionCentre";
import type { StructureComparisonResult } from "@/lib/structureComparisonEngine";
import type { TwinPersistedState, TwinSimulationOutput } from "@/lib/financialDigitalTwin";
import { FinancialDigitalTwinEngine } from "@/lib/financialDigitalTwin";
import { MODEL_OUTPUT_SCHEMAS, type ModelTaskRequest } from "@/lib/modelOrchestrator/index";

export type AICfoIntent =
  | "affordability"
  | "debt"
  | "investing"
  | "retirement"
  | "tax_structure"
  | "cash_flow"
  | "goals"
  | "scenario_comparison"
  | "general_next_action"
  | "unavailable_calculation";

export type AICfoConfidence = "High" | "Medium" | "Low";

export type AICfoEvidenceClassification = "verified-fact" | "deterministic-calculation" | "rule-provenance" | "assumption" | "missing-data";

export type AICfoRequest = {
  id: string;
  userQuery: string;
  createdAt: string;
  workspaceContext: string;
  selectedScenarioId: string;
  requestedAnalysisType: AICfoIntent;
  userIntent: AICfoIntent;
  riskTolerance: "low" | "medium" | "high";
  timeHorizon: number;
};

export type AICfoEvidence = {
  type: AICfoEvidenceClassification;
  sourceId: string;
  sourceTitle: string;
  sourceLocation: string;
  factUsed: string;
  classification: AICfoEvidenceClassification;
  confidence: AICfoConfidence;
  lastVerifiedAt: string;
};

export type AICfoContext = {
  financialVaultSnapshot: FinancialVaultState;
  digitalTwinSnapshot: TwinPersistedState["twin"];
  selectedSimulation: TwinSimulationOutput;
  currentDecisions: AiDecision[];
  goals: Record<string, number>;
  balanceSheet: FinancialBalanceSheet;
  cashFlow: {
    income: number;
    expenses: number;
    savingsRate: number;
    surplus: number;
  };
  investments: {
    total: number;
    propertyConcentration: number;
    superBalance: number;
  };
  liabilities: FinancialBalanceSheet["liabilities"];
  structureScenarios: StructureComparisonResult;
  taxRuleEvidence: AICfoEvidence[];
  knowledgeHealth: {
    vaultConfidence: number;
    digitalTwinConfidence: number;
    documentCoverage: number;
    ruleFreshness: AICfoConfidence;
    lastCalculation: string;
    lastVerification: string;
  };
  missingInputs: string[];
  currentPage: string;
  visibleEntityIds: string[];
};

export type AICfoAnswer = {
  directAnswer: string;
  executiveSummary: string;
  recommendedAction: string;
  alternatives: string[];
  expectedImpact: string;
  downsideRisks: string[];
  evidence: AICfoEvidence[];
  assumptions: string[];
  confidence: {
    label: AICfoConfidence;
    score: number;
    reasons: string[];
  };
  missingInformation: string[];
  professionalReviewRequired: boolean;
  professionalReviewReasons: string[];
  adviserChecklist: {
    accountant: string[];
    solicitor: string[];
    mortgageBroker: string[];
    financialAdviser: string[];
  };
  followUpActions: { label: string; href: string; type: "workspace" | "decision" | "timeline" | "brief" }[];
  calculationSnapshotId: string;
  generatedAt: string;
};

export type AICfoGeneratedDecision = {
  title: string;
  category: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  expectedFinancialImpact: string;
  confidence: AICfoConfidence;
  evidence: AICfoEvidence[];
  assumptions: string[];
  actionLabel: string;
  actionHref: string;
  sourceQuestionId: string;
  calculationSnapshotId: string;
  professionalReviewRequired: boolean;
};

export type AICfoTimelineEvent = {
  id: string;
  year: number;
  title: string;
  description: string;
  questionId: string;
  decisionId: string | null;
  scenarioId: string;
  evidenceSnapshotIds: string[];
};

export type AICfoAdviserBrief = {
  id: string;
  format: "json" | "html";
  generatedAt: string;
  content: string;
};

export type AICfoRunResult = {
  request: AICfoRequest;
  context: AICfoContext;
  answer: AICfoAnswer;
  generatedDecision: AICfoGeneratedDecision;
  timelineEvent: AICfoTimelineEvent;
  adviserBrief: AICfoAdviserBrief;
  enginesConsulted: string[];
};

export type AICfoInputs = {
  vault: FinancialVaultState;
  twinState: TwinPersistedState;
  balanceSheet: FinancialBalanceSheet;
  housing: HousingAffordabilityState;
  decisions: AiDecision[];
  structureComparison: StructureComparisonResult;
};

export type AICfoModelDraft = Partial<AICfoAnswer> & {
  deterministicOverrides?: Record<string, number | string | boolean>;
};

const PROFESSIONAL_REVIEW_TERMS = [
  "trust",
  "company",
  "division 7a",
  "smsf",
  "tax",
  "legal ownership",
  "asset protection",
  "estate",
  "lender",
  "financial product",
  "structure",
];

function nowIso(): string {
  return new Date().toISOString();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "ai-cfo";
}

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString()}`;
}

function classifyIntent(query: string, workspaceContext = "dashboard"): AICfoIntent {
  const q = query.toLowerCase();
  if (q.includes("exact") && (q.includes("tax") || q.includes("capital gain") || q.includes("borrowing"))) return "unavailable_calculation";
  if (q.includes("scenario") || q.includes("compare") || q.includes("waiting") || q.includes("versus")) return "scenario_comparison";
  if (q.includes("retire") || q.includes("super") || q.includes("financial independence")) return "retirement";
  if (q.includes("trust") || q.includes("company") || q.includes("smsf") || q.includes("structure") || q.includes("accountant")) return "tax_structure";
  if (q.includes("house") || q.includes("property") || q.includes("private school") || q.includes("car") || q.includes("afford")) return "affordability";
  if (q.includes("refinance") || q.includes("mortgage") || q.includes("offset") || q.includes("debt")) return "debt";
  if (q.includes("etf") || q.includes("invest") || q.includes("markets") || q.includes("concentrated")) return "investing";
  if (q.includes("spending") || q.includes("save") || q.includes("cash flow") || q.includes("recurring")) return "cash_flow";
  if (q.includes("goal") || q.includes("prioritise") || q.includes("prioritize")) return "goals";
  if (workspaceContext.includes("structure")) return "tax_structure";
  if (workspaceContext.includes("digital-twin")) return "scenario_comparison";
  if (workspaceContext.includes("housing")) return "affordability";
  return "general_next_action";
}

function enginesForIntent(intent: AICfoIntent): string[] {
  const common = ["Financial Vault", "Decision Centre", "Balance Sheet", "Financial Digital Twin"];
  if (intent === "affordability") return [...common, "Housing", "Cash Flow", "Goals"];
  if (intent === "debt") return [...common, "Debt", "Cash Flow"];
  if (intent === "investing") return [...common, "Investments", "Cash Flow"];
  if (intent === "retirement") return [...common, "Retirement", "Super", "Goals"];
  if (intent === "tax_structure") return [...common, "Structure Optimiser", "Tax Rule Provenance"];
  if (intent === "cash_flow") return [...common, "Cash Flow", "Subscriptions"];
  if (intent === "scenario_comparison") return [...common, "Scenario Manager", "Timeline"];
  if (intent === "unavailable_calculation") return [...common, "Capability Registry"];
  return common;
}

function vaultConfidence(vault: FinancialVaultState): number {
  return Math.min(
    98,
    Math.round(Object.keys(vault.financial_profile.sources).length * 6.5 + vault.uploaded_documents.filter((doc) => doc.status === "extracted").length * 6)
  );
}

function buildEvidence(inputs: AICfoInputs, simulation: TwinSimulationOutput): AICfoEvidence[] {
  const profile = inputs.vault.financial_profile;
  const base: AICfoEvidence[] = [
    {
      type: "verified-fact",
      sourceId: profile.id,
      sourceTitle: "Financial Vault profile",
      sourceLocation: "/financial-vault",
      factUsed: `Income ${money(profile.incomeAnnual)}, spending ${money(profile.monthlySpending * 12)}, mortgage ${money(profile.mortgageBalance)}`,
      classification: "verified-fact",
      confidence: vaultConfidence(inputs.vault) >= 75 ? "High" : "Medium",
      lastVerifiedAt: profile.lastUpdatedAt,
    },
    {
      type: "deterministic-calculation",
      sourceId: simulation.scenarioId,
      sourceTitle: `Digital Twin simulation: ${simulation.scenarioName}`,
      sourceLocation: "/digital-twin",
      factUsed: `Net worth ${money(simulation.netWorth)}, borrowing ${money(simulation.borrowingCapacity)}, retirement score ${simulation.retirementScore}/100`,
      classification: "deterministic-calculation",
      confidence: simulation.confidence,
      lastVerifiedAt: simulation.calculatedAt,
    },
    {
      type: "deterministic-calculation",
      sourceId: "balance-sheet",
      sourceTitle: "Balance Sheet",
      sourceLocation: "/balance-sheet",
      factUsed: `Current net worth ${money(inputs.balanceSheet.netWorth)}, debt ${money(inputs.balanceSheet.liabilitiesTotal)}`,
      classification: "deterministic-calculation",
      confidence: "High",
      lastVerifiedAt: inputs.balanceSheet.asOf,
    },
  ];
  const rules = inputs.structureComparison.outcomes.flatMap((outcome) => outcome.taxRuleReferences);
  const uniqueRules = rules.filter((rule, index, all) => all.findIndex((item) => item.id === rule.id) === index);
  return [
    ...base,
    ...uniqueRules.slice(0, 6).map((rule): AICfoEvidence => ({
      type: "rule-provenance",
      sourceId: rule.id,
      sourceTitle: rule.sourceTitle,
      sourceLocation: rule.sourceUrl,
      factUsed: rule.summary,
      classification: "rule-provenance",
      confidence: rule.confidence,
      lastVerifiedAt: rule.lastVerifiedAt,
    })),
  ];
}

function missingInputsForIntent(intent: AICfoIntent, inputs: AICfoInputs): string[] {
  const missing = [...inputs.twinState.twin.documents.missingInputs, ...inputs.structureComparison.lowConfidenceInputs];
  if (intent === "affordability" && inputs.vault.lender_pack.documentChecklist.some((item) => !item.available)) {
    missing.push(...inputs.vault.lender_pack.documentChecklist.filter((item) => !item.available).map((item) => item.label));
  }
  if (intent === "tax_structure") {
    missing.push("Accountant confirmation of tax residency and deductibility", "Solicitor review of trust, company or SMSF documents");
  }
  if (intent === "unavailable_calculation") {
    missing.push("A deterministic engine for the requested exact calculation");
  }
  return missing.filter((item, index, all) => item && all.indexOf(item) === index);
}

function scoreConfidence(input: {
  vaultScore: number;
  simulation: TwinSimulationOutput;
  missingInputs: string[];
  structureComparison: StructureComparisonResult;
  professionalReviewRequired: boolean;
}): AICfoAnswer["confidence"] {
  const ruleComponent = input.structureComparison.professionalReviewItems.length < 2 ? 18 : 12;
  let score = Math.round(input.vaultScore * 0.34 + (input.simulation.confidence === "High" ? 92 : input.simulation.confidence === "Medium" ? 72 : 48) * 0.28 + ruleComponent);
  const reasons: string[] = [`Vault confidence ${input.vaultScore}%`, `Simulation confidence ${input.simulation.confidence}`];
  if (input.missingInputs.length > 0) {
    score -= Math.min(32, input.missingInputs.length * 6);
    reasons.push(`${input.missingInputs.length} missing inputs`);
  }
  if (input.structureComparison.staleRuleWarnings.length > 0) {
    score = Math.min(score, 54);
    reasons.push("Material tax rule freshness warning");
  }
  if (input.structureComparison.blockedReasons.length > 0) {
    score = Math.min(score, 49);
    reasons.push("Rule provenance blocker");
  }
  if (input.professionalReviewRequired) {
    score = Math.min(score, 74);
    reasons.push("Professional review required before acting");
  }
  score = Math.max(20, Math.min(96, score));
  return { label: score >= 80 ? "High" : score >= 55 ? "Medium" : "Low", score, reasons };
}

function professionalReasons(query: string, intent: AICfoIntent, structureComparison: StructureComparisonResult): string[] {
  const q = query.toLowerCase();
  const reasons = PROFESSIONAL_REVIEW_TERMS.filter((term) => q.includes(term)).map((term) => `${term} touched by the question`);
  if (intent === "tax_structure") reasons.push("Ownership structure, tax and legal outcomes require professional review");
  if (structureComparison.professionalReviewItems.length > 0 && intent === "tax_structure") reasons.push(...structureComparison.professionalReviewItems.slice(0, 4));
  return reasons.filter((item, index, all) => all.indexOf(item) === index);
}

function directAnswerFor(intent: AICfoIntent, query: string, context: AICfoContext): Pick<AICfoAnswer, "directAnswer" | "executiveSummary" | "recommendedAction" | "alternatives" | "expectedImpact" | "downsideRisks" | "assumptions"> {
  const simulation = context.selectedSimulation;
  const topDecision = context.currentDecisions[0];
  if (intent === "unavailable_calculation") {
    return {
      directAnswer: "Calculation unavailable. Vireon needs a deterministic engine for that exact result before AI CFO can answer with numbers.",
      executiveSummary: "I will not estimate this from generic model knowledge. The answer can still list required inputs and the engine needed.",
      recommendedAction: "Create or run the required deterministic calculation first.",
      alternatives: ["Use available Digital Twin scenario outputs", "Ask for an adviser checklist instead"],
      expectedImpact: "No financial estimate produced",
      downsideRisks: ["Unsupported precision would be misleading", "Professional advice may be required"],
      assumptions: ["No calculation was invented by GPT or AI CFO narrative"],
    };
  }
  if (intent === "affordability") {
    return {
      directAnswer: `Based on current deterministic models, borrowing capacity is ${money(simulation.borrowingCapacity)} and house readiness is ${simulation.houseReadiness}/100.`,
      executiveSummary: "Affordability is plausible only if repayments fit current cash flow and missing lender documents are resolved.",
      recommendedAction: "Open Housing and compare buying now versus waiting two years.",
      alternatives: ["Increase deposit before purchase", "Lower target property price", "Reduce discretionary spending first"],
      expectedImpact: `Scenario net worth ${money(simulation.netWorth)} and cash flow ${money(simulation.cashFlow)}`,
      downsideRisks: ["Lender policy may differ", "Interest rates and living expenses can change", "Missing documents reduce confidence"],
      assumptions: simulation.assumptions,
    };
  }
  if (intent === "tax_structure") {
    const structure = context.structureScenarios.mostSuitableUnderCurrentAssumptions.outcome?.label ?? "No single clear structure";
    return {
      directAnswer: `${structure} is the current deterministic structure outcome, but this is educational modelling only and needs professional review.`,
      executiveSummary: "Vireon compares the full lifecycle: purchase, annual ownership, financing, distributions, sale and estate transfer. It does not use a high salary plus family equals trust shortcut.",
      recommendedAction: "Prepare the accountant and solicitor checklist before acting.",
      alternatives: context.structureScenarios.mostSuitableUnderCurrentAssumptions.alternatives,
      expectedImpact: context.structureScenarios.lowestEstimatedLifetimeCost
        ? `Lowest estimated lifetime cost: ${context.structureScenarios.lowestEstimatedLifetimeCost.label}`
        : "Structure impact depends on unresolved assumptions",
      downsideRisks: context.structureScenarios.recommendations.map((rec) => rec.title).slice(0, 5),
      assumptions: context.structureScenarios.mostSuitableUnderCurrentAssumptions.tradeOffs,
    };
  }
  if (intent === "retirement") {
    return {
      directAnswer: `The selected Digital Twin scenario gives a retirement score of ${simulation.retirementScore}/100 and ${simulation.timeToFinancialIndependenceYears ?? "no"} modelled years to financial independence.`,
      executiveSummary: "Retirement confidence is driven by super, investments, expenses, savings rate and scenario assumptions.",
      recommendedAction: "Compare Current, Early Retirement and Retire at 60 scenarios.",
      alternatives: ["Increase monthly contributions", "Delay retirement", "Reduce target spending"],
      expectedImpact: `Projected super and investments: ${money((simulation.yearly.at(-1)?.superBalance ?? 0) + (simulation.yearly.at(-1)?.investmentBalance ?? 0))}`,
      downsideRisks: ["Market return assumptions are uncertain", "Inflation and tax law may change", "Spending in retirement is not fully verified"],
      assumptions: simulation.assumptions,
    };
  }
  if (intent === "debt") {
    return {
      directAnswer: topDecision?.category === "Mortgage" ? topDecision.title : `Current debt is ${money(context.balanceSheet.liabilitiesTotal)} with borrowing capacity ${money(simulation.borrowingCapacity)}.`,
      executiveSummary: "Debt actions should be ranked by cash-flow relief, interest saved, flexibility and borrowing impact.",
      recommendedAction: topDecision?.actionLabel ?? "Review mortgage and debt workspaces",
      alternatives: ["Use offset cash", "Refinance", "Repay high-interest debt first", "Keep liquidity buffer"],
      expectedImpact: topDecision?.expectedImpact ?? `Scenario debt ${money(simulation.debt)}`,
      downsideRisks: ["Refinance fees may outweigh benefit", "Reducing liquidity may increase risk", "Lender policy is not guaranteed"],
      assumptions: simulation.assumptions,
    };
  }
  if (intent === "investing") {
    return {
      directAnswer: `The scenario projects investments and super to ${money((simulation.yearly.at(-1)?.investmentBalance ?? 0) + (simulation.yearly.at(-1)?.superBalance ?? 0))}.`,
      executiveSummary: "Investing capacity depends on verified surplus cash flow, emergency fund coverage and concentration risk.",
      recommendedAction: "Compare debt reduction with ETF contribution scenarios in Digital Twin.",
      alternatives: ["Increase ETFs gradually", "Reduce mortgage first", "Hold cash until emergency fund target is met"],
      expectedImpact: `Passive income projection ${money(simulation.passiveIncome)}`,
      downsideRisks: ["Markets may fall", "Property concentration remains high", "This may become regulated financial advice"],
      assumptions: simulation.assumptions,
    };
  }
  if (intent === "cash_flow") {
    return {
      directAnswer: `Current modelled annual surplus is ${money(context.cashFlow.surplus)} and savings rate is ${Math.round(context.cashFlow.savingsRate)}%.`,
      executiveSummary: "The fastest cash-flow action is to review recurring costs and redirect savings to the highest-value goal.",
      recommendedAction: "Review subscriptions and dining/discretionary spend first.",
      alternatives: ["Refinance mortgage", "Cap discretionary spend", "Pause non-critical goals"],
      expectedImpact: topDecision?.estimatedBenefit ?? "Potential monthly savings available in Decision Centre",
      downsideRisks: ["Transaction categorisation may be incomplete", "Lifestyle assumptions may drive the result"],
      assumptions: ["Cash flow uses Vault monthly spending and deterministic Decision Centre recommendations"],
    };
  }
  if (intent === "scenario_comparison") {
    const comparison = context.digitalTwinSnapshot.timeline.futureEvents.length;
    return {
      directAnswer: `Compare up to four saved scenarios. The selected scenario projects net worth of ${money(simulation.netWorth)} with ${simulation.confidence} simulation confidence.`,
      executiveSummary: "Scenario trade-offs should use deterministic outputs: net worth, borrowing, tax, cash flow, risk and confidence.",
      recommendedAction: "Open Digital Twin and compare Current, Early Retirement, Upgrade House and Retire at 60.",
      alternatives: ["Create a new scenario", "Drag future timeline events", "Export adviser brief"],
      expectedImpact: `Scenario has ${comparison} saved future events and ${simulation.decisions.length} generated decisions`,
      downsideRisks: ["Long-horizon assumptions can dominate outcomes", "Low-confidence events reduce answer confidence"],
      assumptions: simulation.assumptions,
    };
  }
  return {
    directAnswer: topDecision ? topDecision.title : "The highest-value next action is to review the Decision Centre and complete missing Vault data.",
    executiveSummary: "AI CFO prioritises verified facts, deterministic simulations and ranked decisions over generic advice.",
    recommendedAction: topDecision?.actionLabel ?? "Open Decision Centre",
    alternatives: ["Review Financial Vault", "Open Digital Twin", "Open Housing", "Open Structure Optimiser"],
    expectedImpact: topDecision?.expectedImpact ?? `Current net worth ${money(context.balanceSheet.netWorth)}`,
    downsideRisks: ["Missing data can reduce confidence", "Professional review may be required for tax, legal, lending or advice topics"],
    assumptions: ["Uses current workspace context and Vireon deterministic engines"],
  };
}

function adviserChecklist(intent: AICfoIntent): AICfoAnswer["adviserChecklist"] {
  return {
    accountant: intent === "tax_structure" ? ["Confirm income, loss and distribution treatment", "Review tax residency and deductibility", "Check company, trust or SMSF tax consequences"] : ["Confirm tax assumptions if the action changes taxable income"],
    solicitor: intent === "tax_structure" ? ["Review ownership documents", "Review trust deed or company constitution", "Confirm asset-protection and estate-planning implications"] : ["Review legal ownership only if an asset or loan structure changes"],
    mortgageBroker: ["Confirm serviceability and lender policy", "Confirm refinance costs and borrowing capacity", "Stress test interest-rate changes"],
    financialAdviser: intent === "investing" || intent === "retirement" ? ["Review whether this is personal financial advice", "Confirm risk profile and product suitability", "Review superannuation and investment strategy"] : ["Review regulated advice boundaries if products or retirement strategy are involved"],
  };
}

function snapshotId(requestId: string, simulation: TwinSimulationOutput): string {
  return `snap-${requestId}-${simulation.scenarioId}-${simulation.calculatedAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
}

export function buildAICfoRequest(input: {
  userQuery: string;
  workspaceContext?: string;
  selectedScenarioId?: string;
  riskTolerance?: "low" | "medium" | "high";
  timeHorizon?: number;
  createdAt?: string;
}): AICfoRequest {
  const createdAt = input.createdAt ?? nowIso();
  const intent = classifyIntent(input.userQuery, input.workspaceContext);
  return {
    id: `q-${slug(input.userQuery)}-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
    userQuery: input.userQuery,
    createdAt,
    workspaceContext: input.workspaceContext ?? "dashboard",
    selectedScenarioId: input.selectedScenarioId ?? "current",
    requestedAnalysisType: intent,
    userIntent: intent,
    riskTolerance: input.riskTolerance ?? "medium",
    timeHorizon: input.timeHorizon ?? 30,
  };
}

export function buildAICfoContext(inputs: AICfoInputs, request: AICfoRequest): AICfoContext {
  const scenario = inputs.twinState.scenarios.find((item) => item.id === request.selectedScenarioId) ?? inputs.twinState.scenarios[0];
  const selectedSimulation = FinancialDigitalTwinEngine.simulate(inputs.twinState.twin, scenario);
  const taxRuleEvidence = buildEvidence(inputs, selectedSimulation).filter((item) => item.type === "rule-provenance");
  return {
    financialVaultSnapshot: inputs.vault,
    digitalTwinSnapshot: inputs.twinState.twin,
    selectedSimulation,
    currentDecisions: inputs.decisions,
    goals: inputs.twinState.twin.goals,
    balanceSheet: inputs.balanceSheet,
    cashFlow: {
      income: inputs.vault.financial_profile.incomeAnnual,
      expenses: inputs.vault.financial_profile.monthlySpending * 12,
      savingsRate: inputs.vault.financial_profile.incomeAnnual > 0 ? ((inputs.vault.financial_profile.incomeAnnual - inputs.vault.financial_profile.monthlySpending * 12) / inputs.vault.financial_profile.incomeAnnual) * 100 : 0,
      surplus: inputs.vault.financial_profile.incomeAnnual - inputs.vault.financial_profile.monthlySpending * 12,
    },
    investments: {
      total: inputs.twinState.twin.assets.investments + inputs.twinState.twin.assets.super,
      propertyConcentration: inputs.balanceSheet.assetsTotal > 0 ? inputs.twinState.twin.assets.property / inputs.balanceSheet.assetsTotal : 0,
      superBalance: inputs.vault.financial_profile.superBalance,
    },
    liabilities: inputs.balanceSheet.liabilities,
    structureScenarios: inputs.structureComparison,
    taxRuleEvidence,
    knowledgeHealth: {
      vaultConfidence: vaultConfidence(inputs.vault),
      digitalTwinConfidence: inputs.twinState.twin.knowledgeHealth.digitalTwinConfidence,
      documentCoverage: inputs.twinState.twin.knowledgeHealth.documentCoverage,
      ruleFreshness: inputs.structureComparison.staleRuleWarnings.length > 0 ? "Low" : "High",
      lastCalculation: selectedSimulation.calculatedAt,
      lastVerification: inputs.structureComparison.rulesLastVerified,
    },
    missingInputs: missingInputsForIntent(request.userIntent, inputs),
    currentPage: request.workspaceContext,
    visibleEntityIds: [scenario.id, ...inputs.decisions.slice(0, 5).map((item) => item.id)],
  };
}

export function validateModelDraft(answer: AICfoAnswer, draft?: AICfoModelDraft): AICfoAnswer {
  if (!draft) return answer;
  return {
    ...answer,
    executiveSummary: typeof draft.executiveSummary === "string" ? draft.executiveSummary : answer.executiveSummary,
    professionalReviewRequired: answer.professionalReviewRequired,
    confidence: answer.confidence,
    calculationSnapshotId: answer.calculationSnapshotId,
    evidence: answer.evidence,
  };
}

export function buildAICfoAnswer(request: AICfoRequest, context: AICfoContext, modelDraft?: AICfoModelDraft): AICfoAnswer {
  const professionalReviewReasons = professionalReasons(request.userQuery, request.userIntent, context.structureScenarios);
  const professionalReviewRequired = professionalReviewReasons.length > 0 || request.userIntent === "tax_structure";
  const confidence = scoreConfidence({
    vaultScore: context.knowledgeHealth.vaultConfidence,
    simulation: context.selectedSimulation,
    missingInputs: context.missingInputs,
    structureComparison: context.structureScenarios,
    professionalReviewRequired,
  });
  const base = directAnswerFor(request.userIntent, request.userQuery, context);
  const evidence = buildEvidence({
    vault: context.financialVaultSnapshot,
    twinState: {
      twin: context.digitalTwinSnapshot,
      scenarios: [],
      simulationHistory: [],
      decisionHistory: [],
      timelineEvents: [],
      calculationSnapshots: [],
    },
    balanceSheet: context.balanceSheet,
    housing: {} as HousingAffordabilityState,
    decisions: context.currentDecisions,
    structureComparison: context.structureScenarios,
  }, context.selectedSimulation);
  const answer: AICfoAnswer = {
    ...base,
    evidence,
    confidence,
    missingInformation: context.missingInputs,
    professionalReviewRequired,
    professionalReviewReasons,
    adviserChecklist: adviserChecklist(request.userIntent),
    followUpActions: [
      { label: base.recommendedAction, href: actionHrefForIntent(request.userIntent), type: "workspace" },
      { label: "Save as decision", href: "/ai-cfo", type: "decision" },
      { label: "Export adviser brief", href: "/ai-cfo", type: "brief" },
    ],
    calculationSnapshotId: snapshotId(request.id, context.selectedSimulation),
    generatedAt: nowIso(),
  };
  return validateModelDraft(answer, modelDraft);
}

function actionHrefForIntent(intent: AICfoIntent): string {
  if (intent === "affordability") return "/housing-scenarios";
  if (intent === "tax_structure") return "/structure-optimiser";
  if (intent === "scenario_comparison" || intent === "retirement" || intent === "investing") return "/digital-twin";
  if (intent === "cash_flow") return "/cash-flow";
  if (intent === "debt") return "/balance-sheet";
  if (intent === "goals") return "/goals";
  return "/insights";
}

export function createAICfoDecision(request: AICfoRequest, answer: AICfoAnswer, existing: AICfoGeneratedDecision[] = []): AICfoGeneratedDecision {
  const candidate: AICfoGeneratedDecision = {
    title: answer.recommendedAction,
    category: request.userIntent.replaceAll("_", " "),
    priority: answer.confidence.label === "High" ? "High" : answer.confidence.label === "Medium" ? "Medium" : "Low",
    expectedFinancialImpact: answer.expectedImpact,
    confidence: answer.confidence.label,
    evidence: answer.evidence,
    assumptions: answer.assumptions,
    actionLabel: answer.followUpActions[0]?.label ?? "Open AI CFO",
    actionHref: answer.followUpActions[0]?.href ?? "/ai-cfo",
    sourceQuestionId: request.id,
    calculationSnapshotId: answer.calculationSnapshotId,
    professionalReviewRequired: answer.professionalReviewRequired,
  };
  const duplicate = existing.find((item) => slug(item.title) === slug(candidate.title) && item.calculationSnapshotId === candidate.calculationSnapshotId);
  return duplicate ?? candidate;
}

export function createAICfoTimelineEvent(request: AICfoRequest, answer: AICfoAnswer, decision: AICfoGeneratedDecision): AICfoTimelineEvent {
  return {
    id: `tl-${slug(decision.title)}-${request.id}`,
    year: new Date(request.createdAt).getFullYear(),
    title: decision.title,
    description: `AI CFO answer: ${answer.directAnswer}`,
    questionId: request.id,
    decisionId: slug(decision.title),
    scenarioId: request.selectedScenarioId,
    evidenceSnapshotIds: answer.evidence.map((item) => item.sourceId),
  };
}

export function exportAICfoAdviserBrief(request: AICfoRequest, context: AICfoContext, answer: AICfoAnswer, format: "json" | "html" = "json"): AICfoAdviserBrief {
  const payload = {
    notice: "Educational modelling only. This is not formal tax, legal, credit or financial advice.",
    userQuestion: request.userQuery,
    currentFinancialSnapshot: {
      netWorth: context.balanceSheet.netWorth,
      income: context.cashFlow.income,
      expenses: context.cashFlow.expenses,
      borrowingCapacity: context.selectedSimulation.borrowingCapacity,
    },
    deterministicResults: context.selectedSimulation,
    assumptions: answer.assumptions,
    evidence: answer.evidence,
    ruleProvenance: context.taxRuleEvidence,
    unresolvedItems: answer.missingInformation,
    adviserQuestions: answer.adviserChecklist,
    professionalReviewReasons: answer.professionalReviewReasons,
  };
  return {
    id: `brief-${request.id}`,
    format,
    generatedAt: nowIso(),
    content: format === "json"
      ? JSON.stringify(payload, null, 2)
      : `<article><h1>AI CFO Adviser Brief</h1><p>${payload.notice}</p><h2>Question</h2><p>${request.userQuery}</p><h2>Direct answer</h2><p>${answer.directAnswer}</p><h2>Evidence</h2><ul>${answer.evidence.map((item) => `<li>${item.sourceTitle}: ${item.factUsed}</li>`).join("")}</ul></article>`,
  };
}

function aiCfoTaskTypeForIntent(intent: AICfoIntent): ModelTaskRequest["taskType"] {
  if (intent === "scenario_comparison" || intent === "retirement" || intent === "investing") return "scenario-explanation";
  if (intent === "tax_structure") return "recommendation-drafting";
  if (intent === "unavailable_calculation") return "evidence-mapping";
  return "financial-synthesis";
}

export function createAICfoModelTaskRequest(input: {
  request: AICfoRequest;
  context: AICfoContext;
  userId: string;
  sessionId: string;
  correlationId: string;
}): ModelTaskRequest {
  const { request, context, userId, sessionId, correlationId } = input;
  const highRisk = request.userIntent === "tax_structure" || request.userIntent === "affordability";
  const requiresDeterministicContext = request.userIntent !== "general_next_action";
  return {
    taskId: `ai-cfo-${request.id}`,
    userId,
    sessionId,
    correlationId,
    taskType: aiCfoTaskTypeForIntent(request.userIntent),
    purpose: `AI CFO explanation for ${request.userIntent.replaceAll("_", " ")}`,
    sensitivity: "financial-sensitive",
    riskLevel: highRisk ? "high" : "medium",
    autonomyLevel: "inform-only",
    requiredCapabilities: ["text", "structured-output"],
    preferredCapabilities: highRisk ? ["reasoning", "long-context"] : ["reasoning"],
    prohibitedProviders: [],
    permittedProviders: null,
    contextReferences: [
      `vault:${context.knowledgeHealth.lastVerification}`,
      `simulation:${context.selectedSimulation.scenarioId}`,
      `workspace:${context.currentPage}`,
    ],
    evidenceReferences: context.taxRuleEvidence.map((item) => item.sourceId),
    inputPayload: {
      userQuery: request.userQuery,
      intent: request.userIntent,
      deterministicOutputs: {
        netWorth: context.balanceSheet.netWorth,
        surplus: context.cashFlow.surplus,
        borrowingCapacity: context.selectedSimulation.borrowingCapacity,
        retirementScore: context.selectedSimulation.retirementScore,
        riskScore: context.selectedSimulation.riskScore,
      },
      missingInputs: context.missingInputs,
      professionalReviewRequired: highRisk,
    },
    outputSchema: MODEL_OUTPUT_SCHEMAS.FinancialSynthesis,
    maximumCost: 0.25,
    maximumLatencyMs: 12000,
    minimumConfidence: context.missingInputs.length > 0 ? 0.55 : 0.7,
    professionalReviewRequired: highRisk,
    deterministicEngineRequired: requiresDeterministicContext,
    fallbackAllowed: !highRisk,
    retryPolicy: { maxAttempts: 2, baseDelayMs: 200, retryableErrors: ["RATE_LIMITED", "TIMEOUT"] },
    createdAt: request.createdAt,
  };
}

export function runAICfoOrchestrator(inputs: AICfoInputs, rawRequest: Omit<AICfoRequest, "id" | "createdAt" | "requestedAnalysisType" | "userIntent"> & { id?: string; createdAt?: string }, modelDraft?: AICfoModelDraft): AICfoRunResult {
  const request = buildAICfoRequest(rawRequest);
  const context = buildAICfoContext(inputs, request);
  const answer = buildAICfoAnswer(request, context, modelDraft);
  const generatedDecision = createAICfoDecision(request, answer);
  const timelineEvent = createAICfoTimelineEvent(request, answer, generatedDecision);
  const adviserBrief = exportAICfoAdviserBrief(request, context, answer, "json");
  return {
    request,
    context,
    answer,
    generatedDecision,
    timelineEvent,
    adviserBrief,
    enginesConsulted: enginesForIntent(request.userIntent),
  };
}

export function suggestedAICfoPrompts(currentPage: string): string[] {
  if (currentPage.includes("housing")) return ["Can I afford this property?", "What needs to improve first?", "Compare buying now versus waiting."];
  if (currentPage.includes("cash-flow")) return ["Why did spending increase?", "Where can I save $500 per month?", "What is reducing borrowing capacity?"];
  if (currentPage.includes("invest")) return ["Am I too concentrated?", "Invest or repay debt?", "What happens if markets fall 30%?"];
  if (currentPage.includes("structure")) return ["Explain the leading structure.", "Which assumptions change the outcome?", "Prepare questions for my accountant."];
  if (currentPage.includes("digital-twin")) return ["Compare my saved scenarios.", "What is the safest route to early retirement?", "Which event has the biggest long-term impact?"];
  return ["What should I do next?", "What changed this month?", "What is my biggest financial risk?"];
}

export const AICfoOrchestrator = {
  classifyIntent,
  enginesForIntent,
  buildRequest: buildAICfoRequest,
  buildContext: buildAICfoContext,
  buildAnswer: buildAICfoAnswer,
  validateModelDraft,
  createDecision: createAICfoDecision,
  createTimelineEvent: createAICfoTimelineEvent,
  exportAdviserBrief: exportAICfoAdviserBrief,
  createModelTaskRequest: createAICfoModelTaskRequest,
  run: runAICfoOrchestrator,
  suggestedPrompts: suggestedAICfoPrompts,
};
