export type PurchaseState = "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";

export type HousingRiskLevel = "low" | "medium" | "high" | "critical";

export type AffordabilityOutcome = "affordable" | "borderline" | "not_affordable";

export type ReadinessBand = "Not Ready" | "Needs Improvement" | "Nearly Ready" | "Ready";

export type HousingScenarioInput = {
  propertyPrice: number;
  deposit: number;
  purchaseState: PurchaseState;
  estimatedInterestRate: number;
  loanTermYears: number;
  stampDutyOverride?: number | null;
  expectedRentalIncome?: number;
  partnerIncome?: number;
  futureSalaryIncrease?: number;
};

export type HousingScenario = {
  id: string;
  profileId: string;
  propertyPrice: number;
  deposit: number;
  purchaseState: PurchaseState;
  estimatedLoanAmount: number;
  estimatedInterestRate: number;
  loanTermYears: number;
  stampDuty: number;
  totalPurchaseCost: number;
  estimatedMonthlyRepayment: number;
  estimatedBorrowingCapacity: number;
  affordabilityScore: number;
  riskLevel: HousingRiskLevel;
  outcome: AffordabilityOutcome;
  confidenceScore: number;
  debtToIncomeRatio: number;
  repaymentToIncomeRatio: number;
  monthlySurplusBefore: number;
  monthlySurplusAfter: number;
  serviceabilityBuffer: number;
  borrowingGap: number;
  savingsRequired: number;
  assumptions: string[];
  createdAt: string;
};

export type HousingObstacle = {
  scenarioId: string;
  category: string;
  severity: HousingRiskLevel;
  description: string;
  recommendedAction: string;
};

export type HousingActionPlan = {
  scenarioId: string;
  priority: number;
  action: string;
  estimatedImpact: string;
  timeframe: string;
  confidence: "low" | "medium" | "high";
};

export type HousingAiAnalysis = {
  scenarioId: string;
  generatedAt: string;
  provider: "openai" | "deterministic";
  executiveSummary: string;
  risks: string[];
  opportunities: string[];
  recommendations: string[];
};

export type HouseReadinessScore = {
  score: number;
  band: ReadinessBand;
  components: {
    label: string;
    score: number;
    explanation: string;
  }[];
};

export type PurchaseReadinessReport = {
  scenarioId: string;
  generatedAt: string;
  html: string;
  json: {
    financialProfileSummary: string;
    borrowingCapacity: number;
    scenarioComparison: HousingScenario[];
    affordabilityAssessment: string;
    obstacles: HousingObstacle[];
    actionPlan: HousingActionPlan[];
    houseReadinessScore: HouseReadinessScore;
    supportingDocuments: string[];
    assumptions: string[];
  };
};

export type HousingAffordabilityState = {
  housing_scenarios: HousingScenario[];
  housing_obstacles: HousingObstacle[];
  housing_action_plans: HousingActionPlan[];
  housing_ai_analysis: HousingAiAnalysis[];
  house_readiness_score: HouseReadinessScore;
  purchase_readiness_report: PurchaseReadinessReport | null;
};
