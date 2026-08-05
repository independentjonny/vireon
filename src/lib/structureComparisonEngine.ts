import type { FinancialVaultState } from "@/lib/financialVaultTypes";

export type OwnershipStructure =
  | "individual"
  | "joint_individual"
  | "company"
  | "discretionary_trust"
  | "discretionary_trust_corporate_trustee"
  | "unit_trust"
  | "smsf"
  | "partnership";

export type InvestmentType =
  | "residential_investment_property"
  | "commercial_property"
  | "shares"
  | "etfs"
  | "managed_funds"
  | "business_investment";

export type AustralianJurisdiction = "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";

export type ConfidenceLevel = "High" | "Medium" | "Low";
export type ComplexityLevel = "Low" | "Medium" | "High" | "Very High";
export type OutputClassification = "calculated" | "indicative" | "professional-review-required";
export type StructureLifecyclePhase = "purchase" | "annual_ownership" | "financing" | "distributions" | "sale" | "estate_transfer";

export type StructureLifecycleAssessment = {
  phase: StructureLifecyclePhase;
  label: string;
  summary: string;
  score: number;
  riskIds: string[];
};

export type TaxRuleReference = {
  id: string;
  ruleType: "income_tax" | "company_tax" | "capital_gains_tax" | "trust_tax" | "smsf" | "land_tax" | "modelling_policy";
  jurisdiction: "Australia" | AustralianJurisdiction;
  authority: string;
  sourceTitle: string;
  sourceUrl: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  lastVerifiedAt: string;
  ruleVersion: string;
  summary: string;
  applicableStructures: OwnershipStructure[];
  applicableInvestmentTypes: InvestmentType[];
  confidence: ConfidenceLevel;
  reviewStatus: "current" | "stale" | "expired" | "jurisdiction-review-required" | "fact-dependent" | "future-law-uncertain";
  professionalReviewRequired: boolean;
};

export type StructureCalculationEvidence = {
  outputKey: keyof Pick<
    StructureOutcome,
    | "estimatedAnnualTaxableIncome"
    | "estimatedAnnualTax"
    | "estimatedAfterTaxAnnualCashFlow"
    | "tenYearAfterTaxCashFlow"
    | "holdingPeriodAfterTaxCashFlow"
    | "estimatedSaleProceedsAfterIndicativeTax"
    | "estimatedLifetimeCost"
    | "lossTreatment"
    | "indicativeCapitalGainsTreatment"
    | "borrowingComplexity"
    | "assetProtectionScore"
    | "estatePlanningScore"
    | "administrativeComplexity"
    | "flexibilityScore"
  >;
  classification: OutputClassification;
  ruleIds: string[];
  assumptions: string[];
  confidence: ConfidenceLevel;
  professionalReviewRequired: boolean;
  professionalReviewReason: string;
};

export type StructureRisk = {
  id: string;
  label: string;
  severity: "Low" | "Medium" | "High";
  detail: string;
  evidenceRuleIds: string[];
};

export type StructureAssumptionSet = {
  state: AustralianJurisdiction;
  investmentType: InvestmentType;
  purchasePrice: number;
  deposit: number;
  loanAmount: number;
  interestRate: number;
  expectedAnnualIncome: number;
  expectedAnnualExpenses: number;
  expectedCapitalGrowth: number;
  expectedHoldingPeriod: number;
  userTaxableIncome: number;
  partnerTaxableIncome: number;
  expectedSaleYear: number;
  lossesExpected: boolean;
  incomeRetained: boolean;
  assetProtectionImportance: number;
  estatePlanningImportance: number;
  potentialBeneficiaries: number;
  existingStructures: {
    trust: boolean;
    company: boolean;
    smsf: boolean;
  };
  setupCosts: Partial<Record<OwnershipStructure, number>>;
  annualComplianceCosts: Partial<Record<OwnershipStructure, number>>;
  stateOfResidenceSource: "vault" | "assumption" | "override";
  vaultEvidence: string[];
};

export type StructureScenario = {
  id: string;
  label: string;
  structure: OwnershipStructure;
  assumptions: StructureAssumptionSet;
};

export type StructureOutcome = {
  scenarioId: string;
  structure: OwnershipStructure;
  label: string;
  estimatedAnnualTaxableIncome: number;
  estimatedAnnualTax: number;
  lossTreatment: string;
  indicativeCapitalGainsTreatment: string;
  estimatedAfterTaxAnnualCashFlow: number;
  tenYearAfterTaxCashFlow: number;
  holdingPeriodAfterTaxCashFlow: number;
  estimatedSaleProceedsAfterIndicativeTax: number;
  setupCost: number;
  annualComplianceCost: number;
  estimatedLifetimeCost: number;
  borrowingComplexity: ComplexityLevel;
  assetProtectionScore: number;
  estatePlanningScore: number;
  administrativeComplexity: ComplexityLevel;
  flexibilityScore: number;
  keyLimitations: string[];
  keyRisks: StructureRisk[];
  lifecycleAssessments: StructureLifecycleAssessment[];
  lifecycleScore: number;
  calculationEvidence: StructureCalculationEvidence[];
  professionalReviewItems: string[];
  lowConfidenceInputs: string[];
  confidenceLevel: ConfidenceLevel;
  taxRuleReferences: TaxRuleReference[];
};

export type StructureRecommendation = {
  id: string;
  title: string;
  category: string;
  financialImpact: string;
  confidence: ConfidenceLevel;
  evidence: string[];
  assumptions: string[];
  actionLabel: string;
  actionRoute: string;
  requiredData: string[];
  professionalReviewRequired: boolean;
};

export type StructureComparisonResult = {
  assumptions: StructureAssumptionSet;
  scenarios: StructureScenario[];
  outcomes: StructureOutcome[];
  recommendations: StructureRecommendation[];
  bestForAnnualCashFlow: StructureOutcome;
  bestForCapitalGrowth: StructureOutcome;
  bestForAssetProtection: StructureOutcome;
  lowestAdministration: StructureOutcome;
  highestFlexibility: StructureOutcome;
  lowestEstimatedLifetimeCost: StructureOutcome;
  mostSuitableUnderCurrentAssumptions: {
    outcome: StructureOutcome | null;
    why: string[];
    tradeOffs: string[];
    alternatives: string[];
    informationStillRequired: string[];
    professionalQuestions: string[];
  };
  rulesLastVerified: string;
  jurisdictionUsed: "Australia" | AustralianJurisdiction;
  assumptionCount: number;
  lowConfidenceInputs: string[];
  professionalReviewItems: string[];
  staleRuleWarnings: string[];
  blockedReasons: string[];
  disclaimer: string;
};

export type StructureComparisonOptions = {
  taxRules?: TaxRuleReference[];
  asOfDate?: string;
  reviewPeriodDays?: number;
  gptExplanation?: {
    outputClassificationOverrides?: Partial<Record<string, OutputClassification>>;
    removeProfessionalReviewFlags?: boolean;
    taxRateOverrides?: Record<string, number>;
  };
};

const DISCLAIMER =
  "Educational modelling only. Tax, trust, company, superannuation and property ownership outcomes depend on current law and individual circumstances. Obtain advice from a registered tax agent, accountant, solicitor and, where applicable, licensed financial adviser before acting.";

export const STRUCTURE_LABELS: Record<OwnershipStructure, string> = {
  individual: "Individual",
  joint_individual: "Joint individual ownership",
  company: "Company",
  discretionary_trust: "Discretionary trust",
  discretionary_trust_corporate_trustee: "Discretionary trust with corporate trustee",
  unit_trust: "Unit trust",
  smsf: "SMSF",
  partnership: "Partnership",
};

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  residential_investment_property: "Residential investment property",
  commercial_property: "Commercial property",
  shares: "Shares",
  etfs: "ETFs",
  managed_funds: "Managed funds",
  business_investment: "Business investment",
};

export const OWNERSHIP_STRUCTURES: OwnershipStructure[] = [
  "individual",
  "joint_individual",
  "company",
  "discretionary_trust",
  "discretionary_trust_corporate_trustee",
  "unit_trust",
  "smsf",
  "partnership",
];

const ALL_INVESTMENT_TYPES = Object.keys(INVESTMENT_TYPE_LABELS) as InvestmentType[];

export const TAX_RULE_REFERENCES: TaxRuleReference[] = [
  {
    id: "au-individual-rates-2024-later",
    ruleType: "income_tax",
    jurisdiction: "Australia",
    authority: "Treasury Laws Amendment (Cost of Living Tax Cuts) Act 2024 / Australian Taxation Office legal database",
    sourceTitle: "Income Tax Rates Act 1986 resident individual rates",
    sourceUrl: "https://www.ato.gov.au/law/view/document?DocNum=0000081364&FullDocument=true",
    effectiveFrom: "2024-07-01",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "2024-25-resident-rates-v1",
    summary: "Resident individual rates from 2024-25 include 16%, 30%, 37%, and 45% marginal brackets before Medicare levy, offsets, surcharges, and other adjustments.",
    applicableStructures: ["individual", "joint_individual", "partnership", "discretionary_trust", "discretionary_trust_corporate_trustee", "unit_trust"],
    applicableInvestmentTypes: ALL_INVESTMENT_TYPES,
    confidence: "High",
    reviewStatus: "current",
    professionalReviewRequired: false,
  },
  {
    id: "au-company-rate-passive",
    ruleType: "company_tax",
    jurisdiction: "Australia",
    authority: "Australian Taxation Office",
    sourceTitle: "Company tax rates",
    sourceUrl: "https://www.ato.gov.au/tax-rates-and-codes/company-tax-rates",
    effectiveFrom: "2021-07-01",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "company-rate-passive-review-v1",
    summary: "Companies may be taxed at 25% when they qualify as base rate entities, otherwise the general company tax rate is 30%. Passive investment companies commonly require review before assuming the lower rate.",
    applicableStructures: ["company"],
    applicableInvestmentTypes: ALL_INVESTMENT_TYPES,
    confidence: "Medium",
    reviewStatus: "fact-dependent",
    professionalReviewRequired: true,
  },
  {
    id: "au-cgt-discount",
    ruleType: "capital_gains_tax",
    jurisdiction: "Australia",
    authority: "Australian Taxation Office",
    sourceTitle: "About CGT concessions",
    sourceUrl: "https://www.ato.gov.au/forms-and-instructions/capital-gains-tax-concessions-for-small-business-guide-2013/about-cgt-concessions?anchor=CGT_discount",
    effectiveFrom: "1999-09-21",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "cgt-discount-v1",
    summary: "Individuals, partners in partnerships and trusts may generally access a 50% CGT discount after at least 12 months. Complying superannuation funds may receive a one-third discount. Companies cannot use the CGT discount.",
    applicableStructures: OWNERSHIP_STRUCTURES,
    applicableInvestmentTypes: ALL_INVESTMENT_TYPES,
    confidence: "High",
    reviewStatus: "current",
    professionalReviewRequired: false,
  },
  {
    id: "au-trust-losses",
    ruleType: "trust_tax",
    jurisdiction: "Australia",
    authority: "Australian Taxation Office",
    sourceTitle: "Trust income, losses and capital gains",
    sourceUrl: "https://www.ato.gov.au/businesses-and-organisations/trusts/trust-income-losses-and-capital-gains/trust-income?anchor=Taxrates",
    effectiveFrom: "2021-01-27",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "trust-loss-distribution-v1",
    summary: "A loss made by a trust cannot be distributed to beneficiaries and is generally carried forward for use against later trust income, subject to trust loss rules.",
    applicableStructures: ["discretionary_trust", "discretionary_trust_corporate_trustee", "unit_trust"],
    applicableInvestmentTypes: ALL_INVESTMENT_TYPES,
    confidence: "High",
    reviewStatus: "current",
    professionalReviewRequired: true,
  },
  {
    id: "au-trust-resolutions",
    ruleType: "trust_tax",
    jurisdiction: "Australia",
    authority: "Australian Taxation Office",
    sourceTitle: "Tax issues for trusts - tips and traps",
    sourceUrl: "https://www.ato.gov.au/businesses-and-organisations/trusts/trusts-tax-risks-and-compliance/tax-issues-for-trusts-tips-and-traps?page=1",
    effectiveFrom: "2021-01-27",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "trust-resolutions-v1",
    summary: "Trust distributions require eligible beneficiaries and annual trustee resolutions. Discretionary trust income resolutions are generally required by 30 June.",
    applicableStructures: ["discretionary_trust", "discretionary_trust_corporate_trustee", "unit_trust"],
    applicableInvestmentTypes: ALL_INVESTMENT_TYPES,
    confidence: "High",
    reviewStatus: "current",
    professionalReviewRequired: true,
  },
  {
    id: "au-smsf-restrictions",
    ruleType: "smsf",
    jurisdiction: "Australia",
    authority: "Australian Taxation Office",
    sourceTitle: "What are the SMSF investment restrictions?",
    sourceUrl: "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/self-managed-super-funds-smsf/investing/restrictions-on-investments/acquiring-assets-from-related-parties",
    effectiveFrom: "2025-04-22",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "smsf-investment-restrictions-v1",
    summary: "SMSFs must comply with investment restrictions including related-party acquisition rules, present-day benefit restrictions, in-house asset rules, and general borrowing restrictions.",
    applicableStructures: ["smsf"],
    applicableInvestmentTypes: ALL_INVESTMENT_TYPES,
    confidence: "High",
    reviewStatus: "current",
    professionalReviewRequired: true,
  },
  {
    id: "au-smsf-lrba",
    ruleType: "smsf",
    jurisdiction: "Australia",
    authority: "Australian Taxation Office legal database",
    sourceTitle: "Taxation Determination TD 2016/16",
    sourceUrl: "https://www.ato.gov.au/law/view/document?LocID=%22TXD%2FTD201616%2FNAT%2FATO%2Fft3%22&PiT=99991231235958",
    effectiveFrom: "2016-09-28",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "smsf-lrba-arm-length-v1",
    summary: "SMSF borrowing is restricted and limited recourse borrowing arrangements must be reviewed for arm's-length terms and superannuation law compliance.",
    applicableStructures: ["smsf"],
    applicableInvestmentTypes: ALL_INVESTMENT_TYPES,
    confidence: "Medium",
    reviewStatus: "fact-dependent",
    professionalReviewRequired: true,
  },
  {
    id: "au-state-land-tax",
    ruleType: "land_tax",
    jurisdiction: "Australia",
    authority: "State and territory revenue offices",
    sourceTitle: "Land tax",
    sourceUrl: "https://www.ato.gov.au/individuals-and-families/investments-and-assets/land-tax",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "state-land-tax-review-v1",
    summary: "Land tax, foreign owner surcharges and trust surcharge rules differ by state and territory and require jurisdiction-specific review.",
    applicableStructures: OWNERSHIP_STRUCTURES,
    applicableInvestmentTypes: ["residential_investment_property", "commercial_property"],
    confidence: "Medium",
    reviewStatus: "jurisdiction-review-required",
    professionalReviewRequired: true,
  },
  {
    id: "au-future-law-uncertainty",
    ruleType: "modelling_policy",
    jurisdiction: "Australia",
    authority: "Vireon modelling policy",
    sourceTitle: "Future law uncertainty modelling policy",
    sourceUrl: "https://www.ato.gov.au/",
    effectiveFrom: "2026-07-18",
    effectiveTo: null,
    lastVerifiedAt: "2026-07-18",
    ruleVersion: "future-law-warning-v1",
    summary: "Tax, superannuation, trust, company, lending and land tax rules can change. Long-horizon projections must show uncertainty.",
    applicableStructures: OWNERSHIP_STRUCTURES,
    applicableInvestmentTypes: ALL_INVESTMENT_TYPES,
    confidence: "Medium",
    reviewStatus: "future-law-uncertain",
    professionalReviewRequired: true,
  },
];

const DEFAULT_SETUP_COSTS: Record<OwnershipStructure, number> = {
  individual: 0,
  joint_individual: 0,
  company: 2200,
  discretionary_trust: 2800,
  discretionary_trust_corporate_trustee: 4200,
  unit_trust: 3600,
  smsf: 4500,
  partnership: 900,
};

const DEFAULT_ANNUAL_COMPLIANCE: Record<OwnershipStructure, number> = {
  individual: 450,
  joint_individual: 650,
  company: 1800,
  discretionary_trust: 2200,
  discretionary_trust_corporate_trustee: 3000,
  unit_trust: 2600,
  smsf: 3600,
  partnership: 1200,
};

const MATERIAL_RULE_IDS = [
  "au-individual-rates-2024-later",
  "au-company-rate-passive",
  "au-cgt-discount",
  "au-trust-losses",
  "au-trust-resolutions",
  "au-smsf-restrictions",
  "au-smsf-lrba",
  "au-state-land-tax",
  "au-future-law-uncertainty",
];

function normalizeOptions(options: StructureComparisonOptions = {}): Required<Pick<StructureComparisonOptions, "taxRules" | "asOfDate" | "reviewPeriodDays">> {
  return {
    taxRules: options.taxRules ?? TAX_RULE_REFERENCES,
    asOfDate: options.asOfDate ?? "2026-07-18",
    reviewPeriodDays: options.reviewPeriodDays ?? 365,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateResidentIndividualTax(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  if (income <= 18200) return 0;
  if (income <= 45000) return (income - 18200) * 0.16;
  if (income <= 135000) return 4288 + (income - 45000) * 0.3;
  if (income <= 190000) return 31288 + (income - 135000) * 0.37;
  return 51638 + (income - 190000) * 0.45;
}

function marginalTaxDelta(baseIncome: number, investmentIncome: number): number {
  return calculateResidentIndividualTax(baseIncome + investmentIncome) - calculateResidentIndividualTax(baseIncome);
}

function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString()}`;
}

function annualInterest(assumptions: StructureAssumptionSet): number {
  return assumptions.loanAmount * (assumptions.interestRate / 100);
}

function annualNetIncome(assumptions: StructureAssumptionSet): number {
  return assumptions.expectedAnnualIncome - assumptions.expectedAnnualExpenses - annualInterest(assumptions);
}

function futureValue(assumptions: StructureAssumptionSet): number {
  return assumptions.purchasePrice * Math.pow(1 + assumptions.expectedCapitalGrowth / 100, assumptions.expectedHoldingPeriod);
}

function capitalGain(assumptions: StructureAssumptionSet): number {
  return Math.max(0, futureValue(assumptions) - assumptions.purchasePrice);
}

function setupCost(structure: OwnershipStructure, assumptions: StructureAssumptionSet): number {
  return assumptions.setupCosts[structure] ?? DEFAULT_SETUP_COSTS[structure];
}

function annualComplianceCost(structure: OwnershipStructure, assumptions: StructureAssumptionSet): number {
  return assumptions.annualComplianceCosts[structure] ?? DEFAULT_ANNUAL_COMPLIANCE[structure];
}

function daysBetween(start: string, end: string): number {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);
}

function isRuleExpired(reference: TaxRuleReference, asOfDate: string): boolean {
  return reference.reviewStatus === "expired" || Boolean(reference.effectiveTo && reference.effectiveTo < asOfDate);
}

function isRuleStale(reference: TaxRuleReference, asOfDate: string, reviewPeriodDays: number): boolean {
  return reference.reviewStatus === "stale" || daysBetween(reference.lastVerifiedAt, asOfDate) > reviewPeriodDays;
}

function isRuleApplicable(reference: TaxRuleReference, structure: OwnershipStructure, assumptions: StructureAssumptionSet, asOfDate: string): boolean {
  const jurisdictionMatches = reference.jurisdiction === "Australia" || reference.jurisdiction === assumptions.state;
  return (
    jurisdictionMatches &&
    !isRuleExpired(reference, asOfDate) &&
    reference.effectiveFrom <= asOfDate &&
    reference.applicableStructures.includes(structure) &&
    reference.applicableInvestmentTypes.includes(assumptions.investmentType)
  );
}

function rule(
  ids: string[],
  context: { rules: TaxRuleReference[]; structure: OwnershipStructure; assumptions: StructureAssumptionSet; asOfDate: string },
): TaxRuleReference[] {
  return context.rules.filter((reference) => ids.includes(reference.id) && isRuleApplicable(reference, context.structure, context.assumptions, context.asOfDate));
}

function risk(id: string, label: string, severity: StructureRisk["severity"], detail: string, evidenceRuleIds: string[]): StructureRisk {
  return { id, label, severity, detail, evidenceRuleIds };
}

function individualSaleTax(assumptions: StructureAssumptionSet, ownerIncome: number, share = 1): number {
  const gain = capitalGain(assumptions) * share;
  const discount = assumptions.expectedHoldingPeriod >= 1 ? 0.5 : 0;
  return marginalTaxDelta(ownerIncome, gain * (1 - discount));
}

function trustDistributionTax(assumptions: StructureAssumptionSet, taxableAmount: number): number {
  if (taxableAmount <= 0) return 0;
  if (assumptions.potentialBeneficiaries <= 0) {
    return taxableAmount * 0.45;
  }
  const beneficiaryIncomes = [assumptions.userTaxableIncome, assumptions.partnerTaxableIncome];
  for (let i = 0; i < Math.max(0, assumptions.potentialBeneficiaries - 2); i += 1) {
    beneficiaryIncomes.push(45000);
  }
  const sorted = beneficiaryIncomes.sort((a, b) => a - b);
  const split = taxableAmount / sorted.length;
  return sorted.reduce((total, income) => total + marginalTaxDelta(income, split), 0);
}

function complexityScore(level: ComplexityLevel): number {
  return level === "Low" ? 1 : level === "Medium" ? 2 : level === "High" ? 3 : 4;
}

function collectLowConfidenceInputs(assumptions: StructureAssumptionSet): string[] {
  const items: string[] = [];
  if (assumptions.vaultEvidence.length < 3) items.push("Financial Vault evidence is incomplete");
  if (assumptions.stateOfResidenceSource !== "vault") items.push("State of residence is an assumption or override");
  if (assumptions.expectedAnnualIncome <= 0) items.push("Expected annual income is missing or zero");
  if (assumptions.expectedHoldingPeriod <= 0) items.push("Expected holding period is missing or invalid");
  if (assumptions.investmentType.includes("property")) items.push("Exact state land tax and surcharge data is not calculated in v1");
  return items;
}

function classifyOutput(
  outputKey: StructureCalculationEvidence["outputKey"],
  classification: OutputClassification,
  ruleIds: string[],
  assumptions: string[],
  professionalReviewReason: string,
  references: TaxRuleReference[],
): StructureCalculationEvidence {
  const linkedRules = references.filter((reference) => ruleIds.includes(reference.id));
  return {
    outputKey,
    classification,
    ruleIds: linkedRules.map((reference) => reference.id),
    assumptions,
    confidence: linkedRules.some((reference) => reference.confidence === "Low")
      ? "Low"
      : linkedRules.some((reference) => reference.confidence === "Medium" || reference.professionalReviewRequired)
        ? "Medium"
        : "High",
    professionalReviewRequired: classification === "professional-review-required" || linkedRules.some((reference) => reference.professionalReviewRequired),
    professionalReviewReason,
  };
}

function buildLifecycleAssessments(
  structure: OwnershipStructure,
  assumptions: StructureAssumptionSet,
  annualTax: number,
  cgtTax: number,
  risks: StructureRisk[],
  borrowingComplexity: ComplexityLevel,
  adminComplexity: ComplexityLevel,
  estatePlanningScore: number,
  flexibilityScore: number,
): StructureLifecycleAssessment[] {
  const netIncome = annualNetIncome(assumptions);
  const setup = setupCost(structure, assumptions);
  const annualCompliance = annualComplianceCost(structure, assumptions);
  const riskIds = (ids: string[]) => risks.filter((riskItem) => ids.includes(riskItem.id)).map((riskItem) => riskItem.id);
  const complexityPenalty = complexityScore(adminComplexity) * 8;
  const borrowingPenalty = complexityScore(borrowingComplexity) * 10;
  const lossPenalty = netIncome < 0 && ["company", "discretionary_trust", "discretionary_trust_corporate_trustee", "unit_trust", "smsf"].includes(structure) ? 28 : 0;
  const distributionPenalty = ["company", "discretionary_trust", "discretionary_trust_corporate_trustee", "unit_trust"].includes(structure)
    ? Math.max(0, 24 - assumptions.potentialBeneficiaries * 4)
    : 0;
  const salePenalty = structure === "company" && assumptions.expectedCapitalGrowth > 0 ? 34 : structure === "smsf" ? 12 : 0;

  return [
    {
      phase: "purchase",
      label: "Purchase",
      summary: setup > 0 ? `Indicative setup cost ${formatMoney(setup)} before purchase.` : "No separate entity setup cost modelled before purchase.",
      score: clamp(92 - setup / 180 - complexityPenalty, 0, 100),
      riskIds: riskIds(["future-law"]),
    },
    {
      phase: "annual_ownership",
      label: "Annual ownership",
      summary: `${formatMoney(netIncome)} annual taxable income before structure tax; ${formatMoney(annualTax)} indicative annual tax.`,
      score: clamp(76 + netIncome / 1800 - Math.max(0, annualTax) / 1200 - lossPenalty - annualCompliance / 220, 0, 100),
      riskIds: riskIds(["trust-loss", "loss-not-personal", "land-tax"]),
    },
    {
      phase: "financing",
      label: "Financing",
      summary: `${borrowingComplexity} borrowing complexity; lender policy and serviceability must be checked for the structure.`,
      score: clamp(95 - borrowingPenalty, 0, 100),
      riskIds: riskIds(["smsf-restrictions", "smsf-personal-use", "land-tax"]),
    },
    {
      phase: "distributions",
      label: "Distributions",
      summary: structure === "company"
        ? "Retained profits and later dividends can create owner-level tax consequences."
        : structure.includes("trust")
          ? "Trust distributions require eligible beneficiaries and valid annual resolutions."
          : "Income and losses generally follow the owner or ownership shares.",
      score: clamp(flexibilityScore + (netIncome < 0 ? -lossPenalty : 0) - distributionPenalty, 0, 100),
      riskIds: riskIds(["company-distribution", "trust-loss", "no-beneficiaries", "loss-not-personal"]),
    },
    {
      phase: "sale",
      label: "Sale",
      summary: `${formatMoney(cgtTax)} indicative CGT modelled before sale proceeds and professional adjustments.`,
      score: clamp(86 - salePenalty - cgtTax / 8000, 0, 100),
      riskIds: riskIds(["company-distribution", "future-law"]),
    },
    {
      phase: "estate_transfer",
      label: "Estate transfer",
      summary: "Estate transfer depends on ownership, control, governing documents, succession plans and legal review.",
      score: clamp(estatePlanningScore - complexityPenalty / 2, 0, 100),
      riskIds: riskIds(["future-law", "no-beneficiaries"]),
    },
  ];
}

function buildOutcome(structure: OwnershipStructure, assumptions: StructureAssumptionSet, options: Required<Pick<StructureComparisonOptions, "taxRules" | "asOfDate" | "reviewPeriodDays">>): StructureOutcome {
  const netIncome = annualNetIncome(assumptions);
  const costs = {
    setup: setupCost(structure, assumptions),
    annual: annualComplianceCost(structure, assumptions),
  };
  const limitations: string[] = [];
  const risks: StructureRisk[] = [
    risk("future-law", "Future law uncertainty", "Medium", "Long-horizon tax and superannuation outcomes can change before sale.", ["au-future-law-uncertainty"]),
  ];
  let annualTax = 0;
  let cgtTax = 0;
  let lossTreatment = "";
  let cgtTreatment = "";
  let borrowingComplexity: ComplexityLevel = "Medium";
  let adminComplexity: ComplexityLevel = "Medium";
  let assetProtectionScore = 45;
  let estatePlanningScore = 45;
  let flexibilityScore = 55;
  let confidence: ConfidenceLevel = "Medium";
  const ruleContext = { rules: options.taxRules, structure, assumptions, asOfDate: options.asOfDate };
  let references = rule(["au-individual-rates-2024-later", "au-cgt-discount", "au-state-land-tax", "au-future-law-uncertainty"], ruleContext);

  if (structure === "individual") {
    annualTax = marginalTaxDelta(assumptions.userTaxableIncome, netIncome);
    cgtTax = individualSaleTax(assumptions, assumptions.userTaxableIncome);
    lossTreatment = "Losses may reduce the individual's taxable income where deductibility conditions are met.";
    cgtTreatment = "Indicative individual 50% CGT discount assumed after 12 months.";
    borrowingComplexity = "Low";
    adminComplexity = "Low";
    assetProtectionScore = 20;
    estatePlanningScore = 35;
    flexibilityScore = 62;
    limitations.push("Personal ownership can expose the asset to personal creditor and estate-planning constraints.");
  }

  if (structure === "joint_individual") {
    annualTax = marginalTaxDelta(assumptions.userTaxableIncome, netIncome / 2) + marginalTaxDelta(assumptions.partnerTaxableIncome, netIncome / 2);
    cgtTax = individualSaleTax(assumptions, assumptions.userTaxableIncome, 0.5) + individualSaleTax(assumptions, assumptions.partnerTaxableIncome, 0.5);
    lossTreatment = "Losses generally follow legal ownership shares and may reduce each owner's taxable income where deductibility conditions are met.";
    cgtTreatment = "Indicative individual 50% CGT discount assumed for each owner after 12 months.";
    borrowingComplexity = "Low";
    adminComplexity = "Low";
    assetProtectionScore = 25;
    estatePlanningScore = 42;
    flexibilityScore = 58;
    limitations.push("Income, losses and capital gains are usually split by ownership percentage, not annually optimized.");
  }

  if (structure === "partnership") {
    annualTax = marginalTaxDelta(assumptions.userTaxableIncome, netIncome / 2) + marginalTaxDelta(assumptions.partnerTaxableIncome, netIncome / 2);
    cgtTax = individualSaleTax(assumptions, assumptions.userTaxableIncome, 0.5) + individualSaleTax(assumptions, assumptions.partnerTaxableIncome, 0.5);
    lossTreatment = "Losses generally flow to partners according to partnership interests, subject to deductibility and non-commercial loss rules.";
    cgtTreatment = "Indicative partner-level 50% CGT discount assumed after 12 months for individual partners.";
    borrowingComplexity = "Medium";
    adminComplexity = "Medium";
    assetProtectionScore = 30;
    estatePlanningScore = 45;
    flexibilityScore = 52;
    limitations.push("Partnership administration and partner liability need legal review.");
  }

  if (structure === "company") {
    annualTax = netIncome > 0 ? netIncome * 0.3 : 0;
    cgtTax = capitalGain(assumptions) * 0.3;
    lossTreatment = "Company losses remain in the company and do not directly reduce personal taxable income.";
    cgtTreatment = "Companies generally do not receive the individual 50% CGT discount; later distributions can create additional tax consequences.";
    borrowingComplexity = "High";
    adminComplexity = "High";
    assetProtectionScore = 68;
    estatePlanningScore = 58;
    flexibilityScore = 48;
    references = rule(["au-company-rate-passive", "au-cgt-discount", "au-state-land-tax", "au-future-law-uncertainty"], ruleContext);
    limitations.push("Company profits retained or distributed later can produce different tax outcomes.");
    risks.push(risk("company-distribution", "Company distribution tax consequences", "High", "Dividends, franking credits and shareholder tax can materially change the owner-level result.", ["au-company-rate-passive"]));
  }

  if (structure === "discretionary_trust" || structure === "discretionary_trust_corporate_trustee" || structure === "unit_trust") {
    const isUnit = structure === "unit_trust";
    const isCorporateTrustee = structure === "discretionary_trust_corporate_trustee";
    annualTax = netIncome > 0 ? trustDistributionTax(assumptions, netIncome) : 0;
    cgtTax = trustDistributionTax(assumptions, capitalGain(assumptions) * (assumptions.expectedHoldingPeriod >= 1 ? 0.5 : 1));
    lossTreatment = "Trust losses generally remain within the trust and cannot be distributed to beneficiaries.";
    cgtTreatment = "Trust capital gains may access CGT discount treatment, but beneficiary streaming and eligibility require deed and resolution review.";
    borrowingComplexity = isCorporateTrustee ? "High" : "Medium";
    adminComplexity = isCorporateTrustee ? "Very High" : "High";
    assetProtectionScore = isCorporateTrustee ? 80 : 66;
    estatePlanningScore = isUnit ? 58 : 78;
    flexibilityScore = isUnit ? 45 : 82;
    references = rule(["au-individual-rates-2024-later", "au-cgt-discount", "au-trust-losses", "au-trust-resolutions", "au-state-land-tax", "au-future-law-uncertainty"], ruleContext);
    limitations.push(isUnit ? "Unit trusts have fixed interests and less distribution flexibility than discretionary trusts." : "Distribution flexibility depends on eligible beneficiaries and valid annual resolutions.");
    risks.push(risk("trust-loss", "Trust loss quarantine", netIncome < 0 ? "High" : "Medium", "Losses generally stay in the trust and may not benefit current personal taxable income.", ["au-trust-losses"]));
    if (assumptions.potentialBeneficiaries <= 0) {
      risks.push(risk("no-beneficiaries", "No eligible beneficiaries modelled", "High", "The model cannot distribute trust income tax-effectively without eligible beneficiaries.", ["au-trust-resolutions"]));
      confidence = "Low";
    }
  }

  if (structure === "smsf") {
    annualTax = netIncome > 0 ? netIncome * 0.15 : 0;
    cgtTax = capitalGain(assumptions) * (assumptions.expectedHoldingPeriod >= 1 ? 0.1 : 0.15);
    lossTreatment = "Losses remain in the SMSF and do not offset personal taxable income.";
    cgtTreatment = "Complying superannuation fund CGT discount modelled as one-third after 12 months, producing an indicative 10% tax rate in accumulation phase.";
    borrowingComplexity = "Very High";
    adminComplexity = "Very High";
    assetProtectionScore = 82;
    estatePlanningScore = 68;
    flexibilityScore = 24;
    references = rule(["au-cgt-discount", "au-smsf-restrictions", "au-smsf-lrba", "au-state-land-tax", "au-future-law-uncertainty"], ruleContext);
    limitations.push("SMSF assets must satisfy superannuation law, sole-purpose and access restrictions.");
    risks.push(risk("smsf-restrictions", "SMSF investment restrictions", "High", "Related-party, personal-use, borrowing and lender policy restrictions require specialist review.", ["au-smsf-restrictions", "au-smsf-lrba"]));
    if (assumptions.investmentType === "residential_investment_property") {
      risks.push(risk("smsf-personal-use", "Personal-use restriction", "High", "SMSF residential property cannot provide present-day benefit to members or related parties.", ["au-smsf-restrictions"]));
    }
  }

  if (assumptions.investmentType.includes("property")) {
    risks.push(risk("land-tax", "State land tax and surcharge review", "High", `${assumptions.state} land tax, trust surcharge and foreign purchaser rules are not calculated in this v1 model.`, ["au-state-land-tax"]));
  }

  if (netIncome < 0 && ["company", "discretionary_trust", "discretionary_trust_corporate_trustee", "unit_trust", "smsf"].includes(structure)) {
    const lossRuleIds = structure === "company" ? ["au-company-rate-passive"] : structure === "smsf" ? ["au-smsf-restrictions"] : ["au-trust-losses"];
    risks.push(risk("loss-not-personal", "Loss may not reduce personal tax now", "High", "Negative cash flow does not necessarily create an immediate personal tax benefit in this structure.", lossRuleIds));
  }

  const afterTaxCashFlow = netIncome - annualTax - costs.annual;
  const holdingYears = Math.max(1, assumptions.expectedHoldingPeriod);
  const saleProceedsAfterTax = futureValue(assumptions) - assumptions.loanAmount - cgtTax;
  const lifetimeCost = costs.setup + costs.annual * holdingYears + Math.max(0, annualTax) * holdingYears + cgtTax;
  const confidencePenalty = assumptions.vaultEvidence.length < 3 || assumptions.stateOfResidenceSource !== "vault" ? 1 : 0;
  if (confidencePenalty && confidence === "Medium") confidence = "Low";
  if (references.some((reference) => isRuleStale(reference, options.asOfDate, options.reviewPeriodDays))) confidence = "Low";
  const missingMaterialRules = risks.flatMap((riskItem) => riskItem.evidenceRuleIds).filter((id, index, all) => all.indexOf(id) === index && !references.some((reference) => reference.id === id));
  if (missingMaterialRules.length > 0) {
    risks.push(risk("rule-provenance-unavailable", "Rule provenance unavailable", "High", `Material rule evidence is unavailable or blocked for: ${missingMaterialRules.join(", ")}.`, missingMaterialRules));
    confidence = "Low";
  }
  const adjustedAssetProtectionScore = clamp(assetProtectionScore + assumptions.assetProtectionImportance * 1.5, 0, 100);
  const adjustedEstatePlanningScore = clamp(estatePlanningScore + assumptions.estatePlanningImportance * 1.2, 0, 100);
  const lifecycleAssessments = buildLifecycleAssessments(
    structure,
    assumptions,
    annualTax,
    cgtTax,
    risks,
    borrowingComplexity,
    adminComplexity,
    adjustedEstatePlanningScore,
    flexibilityScore,
  );
  const lifecycleScore = Math.round(lifecycleAssessments.reduce((total, phase) => total + phase.score, 0) / lifecycleAssessments.length);
  const lowConfidenceInputs = collectLowConfidenceInputs(assumptions);
  const professionalReviewItems = [
    ...references.filter((reference) => reference.professionalReviewRequired).map((reference) => `${reference.sourceTitle}: ${reference.reviewStatus}`),
    ...risks.filter((riskItem) => riskItem.severity === "High").map((riskItem) => riskItem.label),
  ].filter((item, index, all) => all.indexOf(item) === index);
  const calculationEvidence: StructureCalculationEvidence[] = [
    classifyOutput("estimatedAnnualTaxableIncome", "calculated", ["au-individual-rates-2024-later", "au-company-rate-passive", "au-trust-losses", "au-smsf-restrictions"], ["Expected annual income", "Expected annual expenses", "Loan amount", "Interest rate"], "Taxable income is deterministic but deductibility and entity attribution need professional review.", references),
    classifyOutput("estimatedAnnualTax", "indicative", ["au-individual-rates-2024-later", "au-company-rate-passive", "au-trust-resolutions", "au-smsf-restrictions"], ["Taxable income", "User taxable income", "Partner taxable income", "Potential beneficiaries"], "Medicare levy, offsets, residency, trust deed, base-rate entity and distribution facts are not fully modelled.", references),
    classifyOutput("estimatedAfterTaxAnnualCashFlow", "indicative", ["au-individual-rates-2024-later", "au-company-rate-passive", "au-trust-losses", "au-smsf-restrictions"], ["Taxable income", "Indicative annual tax", "Annual compliance cost"], "After-tax cash flow depends on actual deductible expenses, ownership facts and professional cost estimates.", references),
    classifyOutput("tenYearAfterTaxCashFlow", "indicative", ["au-future-law-uncertainty"], ["First-year after-tax cash flow", "Setup cost"], "Ten-year projection assumes repeated annual cash flow and no law changes.", references),
    classifyOutput("holdingPeriodAfterTaxCashFlow", "indicative", ["au-future-law-uncertainty"], ["Holding period", "First-year after-tax cash flow", "Setup cost"], "Holding-period projection assumes repeated annual cash flow and no law changes.", references),
    classifyOutput("estimatedSaleProceedsAfterIndicativeTax", "indicative", ["au-cgt-discount", "au-company-rate-passive"], ["Purchase price", "Expected capital growth", "Holding period", "Loan amount"], "Sale result excludes exact cost base, depreciation, carried-forward losses, concessions, distribution timing and transaction costs.", references),
    classifyOutput("estimatedLifetimeCost", "indicative", ["au-future-law-uncertainty"], ["Setup cost", "Annual compliance cost", "Indicative tax", "Holding period"], "Lifetime cost is a scenario estimate and must be reconciled with professional quotes and tax advice.", references),
    classifyOutput("lossTreatment", "professional-review-required", ["au-individual-rates-2024-later", "au-trust-losses", "au-company-rate-passive", "au-smsf-restrictions"], ["Structure", "Expected annual taxable income"], "Loss deductibility, quarantine and use depend on entity, deed, trust loss tests and taxpayer facts.", references),
    classifyOutput("indicativeCapitalGainsTreatment", "professional-review-required", ["au-cgt-discount"], ["Structure", "Holding period", "Expected sale year"], "CGT treatment depends on ownership, residency, cost base, concessions, streaming and future law.", references),
    classifyOutput("borrowingComplexity", "professional-review-required", ["au-future-law-uncertainty", "au-smsf-lrba", "au-smsf-restrictions"], ["Structure", "Loan amount", "Investment type"], "Lender policy and SMSF borrowing availability require current specialist review.", references),
    classifyOutput("assetProtectionScore", "professional-review-required", ["au-future-law-uncertainty"], ["Structure", "Asset protection importance"], "Asset protection depends on legal ownership, control, guarantees, insolvency and family law facts.", references),
    classifyOutput("estatePlanningScore", "professional-review-required", ["au-future-law-uncertainty", "au-trust-resolutions"], ["Structure", "Estate-planning importance", "Potential beneficiaries"], "Estate transfer depends on governing documents, control succession and legal advice.", references),
    classifyOutput("administrativeComplexity", "indicative", ["au-future-law-uncertainty"], ["Structure", "Annual compliance cost"], "Administrative effort varies by provider, records, audits and structure documents.", references),
    classifyOutput("flexibilityScore", "professional-review-required", ["au-trust-resolutions", "au-future-law-uncertainty"], ["Structure", "Potential beneficiaries", "Income retained"], "Flexibility depends on legal documents, beneficiary eligibility, control and annual decisions.", references),
  ];

  return {
    scenarioId: `${structure}-scenario`,
    structure,
    label: STRUCTURE_LABELS[structure],
    estimatedAnnualTaxableIncome: Math.round(netIncome),
    estimatedAnnualTax: Math.round(annualTax),
    lossTreatment,
    indicativeCapitalGainsTreatment: cgtTreatment,
    estimatedAfterTaxAnnualCashFlow: Math.round(afterTaxCashFlow),
    tenYearAfterTaxCashFlow: Math.round(afterTaxCashFlow * 10 - costs.setup),
    holdingPeriodAfterTaxCashFlow: Math.round(afterTaxCashFlow * holdingYears - costs.setup),
    estimatedSaleProceedsAfterIndicativeTax: Math.round(saleProceedsAfterTax),
    setupCost: costs.setup,
    annualComplianceCost: costs.annual,
    estimatedLifetimeCost: Math.round(lifetimeCost),
    borrowingComplexity,
    assetProtectionScore: adjustedAssetProtectionScore,
    estatePlanningScore: adjustedEstatePlanningScore,
    administrativeComplexity: adminComplexity,
    flexibilityScore,
    keyLimitations: limitations,
    keyRisks: risks,
    lifecycleAssessments,
    lifecycleScore,
    calculationEvidence,
    professionalReviewItems,
    lowConfidenceInputs,
    confidenceLevel: confidence,
    taxRuleReferences: references,
  };
}

function rankBy<T>(items: T[], value: (item: T) => number, direction: "asc" | "desc" = "desc"): T {
  return [...items].sort((a, b) => direction === "desc" ? value(b) - value(a) : value(a) - value(b))[0];
}

export function buildStructureAssumptionsFromVault(vault: FinancialVaultState): StructureAssumptionSet {
  const profile = vault.financial_profile;
  const evidence = Object.entries(profile.sources).map(([field, source]) => `${field}: ${source?.fileName ?? "Vault source"}`);
  const purchasePrice = 850000;
  const deposit = Math.max(120000, Math.round((profile.assets || 250000) * 0.35));
  const loanAmount = Math.max(0, purchasePrice - deposit);

  return {
    state: "NSW",
    investmentType: "residential_investment_property",
    purchasePrice,
    deposit,
    loanAmount,
    interestRate: profile.interestRate || 6.35,
    expectedAnnualIncome: 42000,
    expectedAnnualExpenses: 11000,
    expectedCapitalGrowth: 4,
    expectedHoldingPeriod: 10,
    userTaxableIncome: profile.incomeAnnual || 145000,
    partnerTaxableIncome: 95000,
    expectedSaleYear: new Date().getFullYear() + 10,
    lossesExpected: false,
    incomeRetained: false,
    assetProtectionImportance: 7,
    estatePlanningImportance: 6,
    potentialBeneficiaries: 2,
    existingStructures: {
      trust: false,
      company: false,
      smsf: profile.superBalance > 0,
    },
    setupCosts: {},
    annualComplianceCosts: {},
    stateOfResidenceSource: "assumption",
    vaultEvidence: evidence,
  };
}

export function buildStructureRecommendations(outcomes: StructureOutcome[], assumptions: StructureAssumptionSet): StructureRecommendation[] {
  const recs: StructureRecommendation[] = [];
  const company = outcomes.find((outcome) => outcome.structure === "company");
  const trust = outcomes.find((outcome) => outcome.structure === "discretionary_trust");
  const individual = outcomes.find((outcome) => outcome.structure === "individual");
  const lowestCost = rankBy(outcomes, (outcome) => outcome.estimatedLifetimeCost, "asc");

  recs.push({
    id: "review-ownership-before-purchase",
    title: "Review ownership structure before purchase",
    category: "Tax and ownership",
    financialImpact: `Lifetime cost range ${formatMoney(Math.min(...outcomes.map((o) => o.estimatedLifetimeCost)))} to ${formatMoney(Math.max(...outcomes.map((o) => o.estimatedLifetimeCost)))}`,
    confidence: "High",
    evidence: [`${outcomes.length} structures compared`, `Investment type: ${INVESTMENT_TYPE_LABELS[assumptions.investmentType]}`, `Rules last verified ${rulesLastVerified()}`],
    assumptions: ["Uses deterministic modelling only", "Excludes personalised advice, stamp duty, exact land tax, offsets, Medicare levy, and lender-specific policy"],
    actionLabel: "Open structure optimiser",
    actionRoute: "/structure-optimiser",
    requiredData: ["State-specific land tax review", "Entity deeds or constitutions", "Personal tax advice"],
    professionalReviewRequired: true,
  });

  recs.push({
    id: "professional-advice-required",
    title: "Professional advice required before implementation",
    category: "Advice boundary",
    financialImpact: "Prevents acting on incomplete tax, legal, lending or superannuation assumptions",
    confidence: "High",
    evidence: [
      "Entity, tax, trust, company, SMSF, lending and property outcomes depend on individual circumstances",
      `Rules last verified ${rulesLastVerified()}`,
      "Vireon has generated educational scenarios only",
    ],
    assumptions: ["No personal tax, legal, credit or financial advice is provided", "Professional review occurs before any structure is implemented"],
    actionLabel: "Prepare adviser questions",
    actionRoute: "/structure-optimiser",
    requiredData: ["Tax agent review", "Accountant review", "Solicitor review", "Licensed financial adviser review where applicable"],
    professionalReviewRequired: true,
  });

  if (trust && assumptions.userTaxableIncome + assumptions.partnerTaxableIncome >= 240000 && assumptions.potentialBeneficiaries >= 2) {
    recs.push({
      id: "no-high-salary-family-trust-shortcut",
      title: "Do not default to a trust from high income and family profile",
      category: "Trust",
      financialImpact: "Depends on full lifecycle outcome",
      confidence: "High",
      evidence: [
        "Trust losses may be trapped rather than offsetting salary income",
        "Eligible beneficiaries and annual resolutions are required for distributions",
        "Sale, lending, setup cost, compliance cost and estate-transfer outcomes can outweigh annual income tax differences",
      ],
      assumptions: [
        "Trust suitability is evaluated across purchase, annual ownership, financing, distributions, sale and estate transfer",
        "No structure is recommended from salary level or family status alone",
      ],
      actionLabel: "Review lifecycle model",
      actionRoute: "/structure-optimiser",
      requiredData: ["Projected annual cash flow", "Beneficiary eligibility", "Trust deed", "Lender policy", "State land tax review", "Sale-year assumptions"],
      professionalReviewRequired: true,
    });
  }

  if (trust && annualNetIncome(assumptions) < 0) {
    recs.push({
      id: "trust-losses-may-not-help",
      title: "Trust losses may not benefit current personal income",
      category: "Trust",
      financialImpact: formatMoney(annualNetIncome(assumptions)),
      confidence: "High",
      evidence: trust.keyRisks.filter((item) => item.id.includes("trust") || item.id.includes("loss")).map((item) => item.detail),
      assumptions: ["Trust loss rules apply", "Loss deductibility and carry-forward tests require accountant review"],
      actionLabel: "Review trust loss treatment",
      actionRoute: "/structure-optimiser",
      requiredData: ["Trust deed", "Eligible beneficiaries", "Projected losses"],
      professionalReviewRequired: true,
    });
  }

  if (company && individual && company.estimatedSaleProceedsAfterIndicativeTax < individual.estimatedSaleProceedsAfterIndicativeTax) {
    recs.push({
      id: "company-cgt-treatment",
      title: "Company CGT treatment may reduce long-term sale outcome",
      category: "Company",
      financialImpact: formatMoney(company.estimatedSaleProceedsAfterIndicativeTax - individual.estimatedSaleProceedsAfterIndicativeTax),
      confidence: "High",
      evidence: ["Companies generally cannot use the 50% CGT discount", "Company distributions may create later owner-level tax consequences"],
      assumptions: ["Company rate modelled at 30% for passive investment scenario", "Sale occurs after more than 12 months"],
      actionLabel: "Compare sale and CGT",
      actionRoute: "/structure-optimiser",
      requiredData: ["Shareholder income at distribution", "Franking position", "Company tax residency and base-rate eligibility"],
      professionalReviewRequired: true,
    });
  }

  if (assumptions.investmentType.includes("property")) {
    recs.push({
      id: "land-tax-review-required",
      title: "Land-tax treatment requires state-specific review",
      category: "Property",
      financialImpact: "Not calculated in v1",
      confidence: "Medium",
      evidence: [`State selected: ${assumptions.state}`, "State land tax, surcharge and trust rules differ by jurisdiction"],
      assumptions: ["No foreign purchaser or absentee surcharge modelled", "No exact state land tax thresholds modelled"],
      actionLabel: "Review state land tax",
      actionRoute: "/structure-optimiser",
      requiredData: ["State revenue advice", "Existing land holdings", "Foreign owner status"],
      professionalReviewRequired: true,
    });
  }

  if (lowestCost.estimatedLifetimeCost < Math.min(...outcomes.filter((outcome) => outcome.structure !== lowestCost.structure).map((outcome) => outcome.estimatedLifetimeCost))) {
    recs.push({
      id: "structure-costs-matter",
      title: "Structure costs may outweigh estimated tax benefit",
      category: "Cost",
      financialImpact: `${lowestCost.label} currently has the lowest estimated lifetime cost`,
      confidence: lowestCost.confidenceLevel,
      evidence: [`Lowest estimated lifetime cost: ${formatMoney(lowestCost.estimatedLifetimeCost)}`, `Annual compliance: ${formatMoney(lowestCost.annualComplianceCost)}`],
      assumptions: ["Setup and compliance costs are indicative and overrideable", "Professional fees vary by provider and complexity"],
      actionLabel: "Review assumptions",
      actionRoute: "/structure-optimiser",
      requiredData: ["Accountant fee quote", "Legal setup quote", "Holding period"],
      professionalReviewRequired: true,
    });
  }

  return recs;
}

function rulesLastVerified(taxRules = TAX_RULE_REFERENCES): string {
  return taxRules.map((reference) => reference.lastVerifiedAt).sort().at(-1) ?? "Unknown";
}

function buildBlockedReasons(assumptions: StructureAssumptionSet, options: Required<Pick<StructureComparisonOptions, "taxRules" | "asOfDate" | "reviewPeriodDays">>): string[] {
  return MATERIAL_RULE_IDS.flatMap((id) => {
    const reference = options.taxRules.find((item) => item.id === id);
    if (!reference) return [`Rule ${id} is missing from the deterministic ruleset.`];
    if (isRuleExpired(reference, options.asOfDate)) return [`Rule ${id} is expired and was not used.`];
    if (reference.effectiveFrom > options.asOfDate) return [`Rule ${id} is not effective until ${reference.effectiveFrom}.`];
    const jurisdictionMatches = reference.jurisdiction === "Australia" || reference.jurisdiction === assumptions.state;
    if (!jurisdictionMatches) return [`Rule ${id} is for ${reference.jurisdiction}, but the scenario jurisdiction is ${assumptions.state}.`];
    return [];
  });
}

function buildStaleRuleWarnings(options: Required<Pick<StructureComparisonOptions, "taxRules" | "asOfDate" | "reviewPeriodDays">>): string[] {
  return options.taxRules
    .filter((reference) => MATERIAL_RULE_IDS.includes(reference.id) && !isRuleExpired(reference, options.asOfDate) && isRuleStale(reference, options.asOfDate, options.reviewPeriodDays))
    .map((reference) => `${reference.sourceTitle} (${reference.id}) was last verified ${reference.lastVerifiedAt}.`);
}

export function runStructureComparison(input: StructureAssumptionSet, rawOptions: StructureComparisonOptions = {}): StructureComparisonResult {
  const options = normalizeOptions(rawOptions);
  const assumptions = {
    ...input,
    loanAmount: input.loanAmount || Math.max(0, input.purchasePrice - input.deposit),
    lossesExpected: annualNetIncome(input) < 0 || input.lossesExpected,
  };
  const scenarios = OWNERSHIP_STRUCTURES.map((structure) => ({
    id: `${structure}-scenario`,
    label: STRUCTURE_LABELS[structure],
    structure,
    assumptions,
  }));
  const outcomes = scenarios.map((scenario) => buildOutcome(scenario.structure, scenario.assumptions, options));
  const bestForAnnualCashFlow = rankBy(outcomes, (outcome) => outcome.estimatedAfterTaxAnnualCashFlow);
  const bestForCapitalGrowth = rankBy(outcomes, (outcome) => outcome.estimatedSaleProceedsAfterIndicativeTax);
  const bestForAssetProtection = rankBy(outcomes, (outcome) => outcome.assetProtectionScore);
  const lowestAdministration = rankBy(outcomes, (outcome) => complexityScore(outcome.administrativeComplexity), "asc");
  const highestFlexibility = rankBy(outcomes, (outcome) => outcome.flexibilityScore);
  const lowestEstimatedLifetimeCost = rankBy(outcomes, (outcome) => outcome.estimatedLifetimeCost, "asc");
  const staleRuleWarnings = buildStaleRuleWarnings(options);
  const blockedReasons = buildBlockedReasons(assumptions, options);
  const lowConfidenceInputs = collectLowConfidenceInputs(assumptions);
  const professionalReviewItems = outcomes.flatMap((outcome) => outcome.professionalReviewItems).filter((item, index, all) => all.indexOf(item) === index);
  const topScore = (outcome: StructureOutcome) =>
    outcome.estimatedAfterTaxAnnualCashFlow * Math.min(assumptions.expectedHoldingPeriod, 10) +
    outcome.estimatedSaleProceedsAfterIndicativeTax * 0.08 +
    outcome.lifecycleScore * 900 +
    outcome.assetProtectionScore * assumptions.assetProtectionImportance * 60 +
    outcome.estatePlanningScore * assumptions.estatePlanningImportance * 45 +
    outcome.flexibilityScore * 50 -
    outcome.estimatedLifetimeCost * 0.35 -
    complexityScore(outcome.administrativeComplexity) * 1200;
  const ranked = [...outcomes].sort((a, b) => topScore(b) - topScore(a));
  const clear = ranked.length > 1 && topScore(ranked[0]) - topScore(ranked[1]) > 12000 && staleRuleWarnings.length === 0 && blockedReasons.length === 0;

  return {
    assumptions,
    scenarios,
    outcomes,
    recommendations: buildStructureRecommendations(outcomes, assumptions),
    bestForAnnualCashFlow,
    bestForCapitalGrowth,
    bestForAssetProtection,
    lowestAdministration,
    highestFlexibility,
    lowestEstimatedLifetimeCost,
    mostSuitableUnderCurrentAssumptions: {
      outcome: clear ? ranked[0] : null,
      why: clear
        ? [
          `${ranked[0].label} leads the weighted lifecycle score under the current assumptions.`,
          "The model compares purchase, annual ownership, financing, distributions, sale and estate transfer before showing suitability.",
          "The result is still educational and requires professional review.",
        ]
        : ["No single structure is clearly superior across tax, cash flow, asset protection, flexibility, administration and sale outcomes."],
      tradeOffs: [
        "Vireon does not use a high salary plus family equals trust rule; trusts are tested against the complete investment lifecycle.",
        "Tax-efficient structures can have higher setup, administration, lending and compliance costs.",
        "Structures that improve asset protection may reduce borrowing simplicity or flexibility.",
        "Long-term capital growth can make CGT treatment more important than first-year cash flow.",
      ],
      alternatives: [
        `${bestForAnnualCashFlow.label} currently leads annual after-tax cash flow.`,
        `${bestForCapitalGrowth.label} currently leads indicative sale proceeds.`,
        `${bestForAssetProtection.label} currently leads asset-protection scoring.`,
      ],
      informationStillRequired: [
        "Accountant confirmation of tax residency, deductibility, distribution and loss assumptions.",
        "Solicitor review of ownership, trust deed, company, partnership or SMSF structure documents.",
        "State revenue review for land tax, surcharge and foreign purchaser rules.",
        "Lender policy review for structure-specific financing availability.",
      ],
      professionalQuestions: [
        "How would losses be treated for this structure in my circumstances?",
        "Would the entity qualify for any lower company rate or CGT concessions?",
        "What land tax or surcharge rules apply in the selected state?",
        "How would income or capital gains be distributed, retained, or taxed later?",
        "What setup, accounting, audit, legal and lending costs should be budgeted?",
      ],
    },
    rulesLastVerified: rulesLastVerified(options.taxRules),
    jurisdictionUsed: assumptions.state,
    assumptionCount: Object.keys(assumptions).filter((key) => key !== "vaultEvidence").length + assumptions.vaultEvidence.length,
    lowConfidenceInputs,
    professionalReviewItems,
    staleRuleWarnings,
    blockedReasons,
    disclaimer: DISCLAIMER,
  };
}

export function buildStructureComparisonFromVault(vault: FinancialVaultState, overrides: Partial<StructureAssumptionSet> = {}): StructureComparisonResult {
  const assumptions = buildStructureAssumptionsFromVault(vault);
  return runStructureComparison({
    ...assumptions,
    ...overrides,
    existingStructures: { ...assumptions.existingStructures, ...overrides.existingStructures },
    setupCosts: { ...assumptions.setupCosts, ...overrides.setupCosts },
    annualComplianceCosts: { ...assumptions.annualComplianceCosts, ...overrides.annualComplianceCosts },
    vaultEvidence: overrides.vaultEvidence ?? assumptions.vaultEvidence,
  });
}

export const StructureComparisonEngine = {
  calculateResidentIndividualTax,
  buildStructureAssumptionsFromVault,
  run: runStructureComparison,
  fromVault: buildStructureComparisonFromVault,
};
