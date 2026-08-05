import type { FinancialProfile, UploadedDocument } from "@/lib/financialVaultTypes";
import type {
  HouseReadinessScore,
  HousingActionPlan,
  HousingAiAnalysis,
  HousingObstacle,
  HousingRiskLevel,
  HousingScenario,
  HousingScenarioInput,
  PurchaseReadinessReport,
  PurchaseState,
} from "@/lib/housingAffordabilityTypes";

const ADVICE_DISCLAIMER = "Estimates are indicative only and do not constitute financial, credit, tax, legal, or lending advice.";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

export function monthlyRepayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  const payments = years * 12;
  if (monthlyRate <= 0) return Math.round(principal / payments);
  return Math.round((principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments)));
}

function estimateTaxMonthly(annualIncome: number): number {
  if (annualIncome <= 0) return 0;
  if (annualIncome <= 45000) return annualIncome * 0.17 / 12;
  if (annualIncome <= 120000) return annualIncome * 0.27 / 12;
  if (annualIncome <= 180000) return annualIncome * 0.32 / 12;
  return annualIncome * 0.37 / 12;
}

function estimateStampDuty(propertyPrice: number, state: PurchaseState): number {
  const stateMultiplier: Record<PurchaseState, number> = {
    NSW: 0.041,
    VIC: 0.052,
    QLD: 0.036,
    WA: 0.043,
    SA: 0.047,
    TAS: 0.04,
    ACT: 0.043,
    NT: 0.049,
  };
  return Math.round(propertyPrice * stateMultiplier[state]);
}

function riskFromScore(score: number): HousingRiskLevel {
  if (score < 35) return "critical";
  if (score < 55) return "high";
  if (score < 75) return "medium";
  return "low";
}

function severityRank(severity: HousingRiskLevel) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity];
}

export function analyseHousingScenario(input: HousingScenarioInput, profile: FinancialProfile, id = makeHousingId("scenario")): HousingScenario {
  const now = new Date().toISOString();
  const purchaseCostsBuffer = Math.round(input.propertyPrice * 0.018);
  const stampDuty = input.stampDutyOverride ?? estimateStampDuty(input.propertyPrice, input.purchaseState);
  const totalPurchaseCost = input.propertyPrice + stampDuty + purchaseCostsBuffer;
  const estimatedLoanAmount = Math.max(0, totalPurchaseCost - input.deposit);
  const assessmentRate = input.estimatedInterestRate + 3;
  const repayment = monthlyRepayment(estimatedLoanAmount, input.estimatedInterestRate, input.loanTermYears);
  const stressedRepayment = monthlyRepayment(estimatedLoanAmount, assessmentRate, input.loanTermYears);

  const grossAnnualIncome = profile.incomeAnnual + (input.partnerIncome ?? 0) + (input.futureSalaryIncrease ?? 0);
  const grossMonthlyIncome = grossAnnualIncome / 12 + (input.expectedRentalIncome ?? 0);
  const netMonthlyIncome = grossMonthlyIncome - estimateTaxMonthly(grossAnnualIncome);
  const coreExpenses = Math.max(profile.monthlySpending || 0, 3200);
  const existingDebtLoad = Math.max(profile.liabilities * 0.015, 0);
  const currentMonthlySurplus = Math.round(netMonthlyIncome - coreExpenses - profile.mortgageRepaymentMonthly - existingDebtLoad);
  const afterPurchaseSurplus = Math.round(netMonthlyIncome - coreExpenses - repayment - existingDebtLoad);
  const serviceabilityBuffer = Math.round(netMonthlyIncome - coreExpenses - stressedRepayment - existingDebtLoad);
  const estimatedBorrowingCapacity = Math.max(0, Math.round((netMonthlyIncome - coreExpenses - existingDebtLoad) * 12 * 6.2));
  const borrowingGap = Math.max(0, estimatedLoanAmount - estimatedBorrowingCapacity);
  const savingsRequired = Math.max(0, totalPurchaseCost - input.deposit - estimatedBorrowingCapacity);
  const debtToIncomeRatio = grossAnnualIncome > 0 ? estimatedLoanAmount / grossAnnualIncome : 0;
  const repaymentToIncomeRatio = netMonthlyIncome > 0 ? repayment / netMonthlyIncome : 0;
  const depositRatio = input.propertyPrice > 0 ? input.deposit / input.propertyPrice : 0;

  const scoreParts = [
    depositRatio >= 0.2 ? 22 : depositRatio >= 0.12 ? 14 : 6,
    borrowingGap <= 0 ? 25 : borrowingGap < 75000 ? 14 : 3,
    repaymentToIncomeRatio <= 0.32 ? 20 : repaymentToIncomeRatio <= 0.42 ? 11 : 2,
    afterPurchaseSurplus >= 2500 ? 18 : afterPurchaseSurplus >= 800 ? 10 : 2,
    serviceabilityBuffer >= 1200 ? 15 : serviceabilityBuffer >= 0 ? 8 : 1,
  ];
  const affordabilityScore = clamp(scoreParts.reduce((sum, part) => sum + part, 0), 0, 100);
  const outcome = affordabilityScore >= 75 ? "affordable" : affordabilityScore >= 55 ? "borderline" : "not_affordable";
  const confidenceScore = clamp(62 + Object.keys(profile.sources).length * 3, 45, 96);

  return {
    id,
    profileId: profile.id,
    propertyPrice: input.propertyPrice,
    deposit: input.deposit,
    purchaseState: input.purchaseState,
    estimatedLoanAmount,
    estimatedInterestRate: input.estimatedInterestRate,
    loanTermYears: input.loanTermYears,
    stampDuty,
    totalPurchaseCost,
    estimatedMonthlyRepayment: repayment,
    estimatedBorrowingCapacity,
    affordabilityScore,
    riskLevel: riskFromScore(affordabilityScore),
    outcome,
    confidenceScore,
    debtToIncomeRatio: Math.round(debtToIncomeRatio * 100) / 100,
    repaymentToIncomeRatio: Math.round(repaymentToIncomeRatio * 100) / 100,
    monthlySurplusBefore: currentMonthlySurplus,
    monthlySurplusAfter: afterPurchaseSurplus,
    serviceabilityBuffer,
    borrowingGap,
    savingsRequired,
    assumptions: [
      ADVICE_DISCLAIMER,
      `Stamp duty uses a local ${input.purchaseState} placeholder unless overridden.`,
      "Purchase costs include a 1.8% allowance for conveyancing, inspections, moving, and settlement buffers.",
      "Serviceability buffer models repayments at the entered rate plus 3.0 percentage points.",
      "Borrowing capacity is an indicative local estimate and does not represent lender approval.",
    ],
    createdAt: now,
  };
}

export function generateComparisonScenarios(base: HousingScenarioInput, profile: FinancialProfile): HousingScenario[] {
  const waitDeposit = base.deposit + Math.max(24000, Math.round(Math.max(profile.incomeMonthly - profile.monthlySpending, 0) * 6));
  return [
    analyseHousingScenario(base, profile, "scenario-a-target"),
    analyseHousingScenario({ ...base, propertyPrice: Math.round(base.propertyPrice * 0.85) }, profile, "scenario-b-lower-price"),
    analyseHousingScenario({ ...base, deposit: base.deposit + 75000 }, profile, "scenario-c-larger-deposit"),
    analyseHousingScenario({ ...base, deposit: waitDeposit, futureSalaryIncrease: (base.futureSalaryIncrease ?? 0) + 12000 }, profile, "scenario-d-wait-12-months"),
  ];
}

export function detectHousingObstacles(scenario: HousingScenario, profile: FinancialProfile): HousingObstacle[] {
  const obstacles: HousingObstacle[] = [];
  const depositRatio = scenario.deposit / scenario.propertyPrice;

  if (depositRatio < 0.2) {
    obstacles.push({
      scenarioId: scenario.id,
      category: "Deposit too small",
      severity: depositRatio < 0.1 ? "critical" : "high",
      description: `Deposit is ${Math.round(depositRatio * 100)}% of property price before costs. A stronger deposit would reduce loan size and lender risk.`,
      recommendedAction: `Increase deposit toward ${money(scenario.propertyPrice * 0.2)} plus purchase costs.`,
    });
  }
  if (scenario.borrowingGap > 0) {
    obstacles.push({
      scenarioId: scenario.id,
      category: "Borrowing capacity gap",
      severity: scenario.borrowingGap > 150000 ? "critical" : "high",
      description: `Indicative borrowing capacity is short by ${money(scenario.borrowingGap)}.`,
      recommendedAction: "Lower the target price, increase deposit, add income, or reduce existing debt.",
    });
  }
  if (profile.monthlySpending > Math.max(6500, profile.incomeMonthly * 0.45)) {
    obstacles.push({
      scenarioId: scenario.id,
      category: "High spending",
      severity: "high",
      description: `Monthly spending of ${money(profile.monthlySpending)} materially reduces surplus income.`,
      recommendedAction: "Reduce discretionary spending and document three months of lower expenses.",
    });
  }
  if (profile.recurringSubscriptions > 180) {
    obstacles.push({
      scenarioId: scenario.id,
      category: "High subscription load",
      severity: "medium",
      description: `Recurring subscriptions total ${money(profile.recurringSubscriptions)}/month.`,
      recommendedAction: "Cancel unused subscriptions and redirect savings to deposit or debt reduction.",
    });
  }
  if (profile.liabilities > 10000) {
    obstacles.push({
      scenarioId: scenario.id,
      category: "Large debt obligations",
      severity: profile.liabilities > 40000 ? "high" : "medium",
      description: `Other liabilities of ${money(profile.liabilities)} reduce serviceability.`,
      recommendedAction: "Pay down or refinance high-interest debt before applying.",
    });
  }
  if (profile.assets < Math.max(25000, scenario.estimatedMonthlyRepayment * 4)) {
    obstacles.push({
      scenarioId: scenario.id,
      category: "Insufficient emergency fund",
      severity: "medium",
      description: "Liquid assets may not cover a conservative post-purchase emergency buffer.",
      recommendedAction: "Keep at least four months of new repayments outside the deposit.",
    });
  }
  if (!profile.employmentType || profile.employmentType.toLowerCase().includes("self")) {
    obstacles.push({
      scenarioId: scenario.id,
      category: "Employment uncertainty",
      severity: profile.employmentType ? "medium" : "high",
      description: "Employment stability may need stronger documentation.",
      recommendedAction: "Prepare payslips, tax returns, and employer confirmation before lender review.",
    });
  }
  if (scenario.repaymentToIncomeRatio > 0.42) {
    obstacles.push({
      scenarioId: scenario.id,
      category: "High repayment ratio",
      severity: scenario.repaymentToIncomeRatio > 0.5 ? "critical" : "high",
      description: `Repayments consume ${Math.round(scenario.repaymentToIncomeRatio * 100)}% of estimated net income.`,
      recommendedAction: "Reduce loan size or increase household income to lower repayment pressure.",
    });
  }

  return obstacles.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export function generateHousingActionPlan(scenario: HousingScenario, obstacles: HousingObstacle[]): HousingActionPlan[] {
  const actions: HousingActionPlan[] = [];
  const has = (category: string) => obstacles.some((obstacle) => obstacle.category === category);

  if (has("High spending")) {
    actions.push({
      scenarioId: scenario.id,
      priority: 1,
      action: "Reduce discretionary spending by $400/month",
      estimatedImpact: "Improves monthly surplus and raises indicative serviceability by roughly $30k.",
      timeframe: "30-90 days",
      confidence: "high",
    });
  }
  if (has("High subscription load")) {
    actions.push({
      scenarioId: scenario.id,
      priority: actions.length + 1,
      action: "Eliminate unused subscriptions",
      estimatedImpact: "Frees $50-$150/month and improves lender cash-flow presentation.",
      timeframe: "This month",
      confidence: "medium",
    });
  }
  if (has("Deposit too small") || scenario.savingsRequired > 0) {
    actions.push({
      scenarioId: scenario.id,
      priority: actions.length + 1,
      action: `Increase deposit by ${money(Math.max(50000, Math.min(125000, scenario.savingsRequired || scenario.propertyPrice * 0.05)))}`,
      estimatedImpact: "Reduces loan size, lowers repayments, and improves deposit strength.",
      timeframe: "6-18 months",
      confidence: "high",
    });
  }
  if (has("Borrowing capacity gap") || scenario.riskLevel === "critical") {
    actions.push({
      scenarioId: scenario.id,
      priority: actions.length + 1,
      action: "Model a 12 month wait scenario",
      estimatedImpact: "Allows deposit growth, cleaner bank statements, and possible income uplift.",
      timeframe: "12 months",
      confidence: "medium",
    });
  }
  if (has("Large debt obligations")) {
    actions.push({
      scenarioId: scenario.id,
      priority: actions.length + 1,
      action: "Refinance or repay existing debt",
      estimatedImpact: "Reduces monthly debt load and improves debt-to-income ratio.",
      timeframe: "1-3 months",
      confidence: "medium",
    });
  }

  if (actions.length === 0) {
    actions.push({
      scenarioId: scenario.id,
      priority: 1,
      action: "Prepare lender documentation and compare pre-approval options",
      estimatedImpact: "Improves confidence and reduces approval friction.",
      timeframe: "2-4 weeks",
      confidence: "medium",
    });
  }

  return actions.map((action, index) => ({ ...action, priority: index + 1 }));
}

export function calculateHouseReadiness(profile: FinancialProfile, documents: UploadedDocument[], primaryScenario?: HousingScenario): HouseReadinessScore {
  const docTypes = new Set(documents.filter((doc) => doc.status === "extracted").map((doc) => doc.documentType));
  const documentationScore = Math.round((docTypes.size / 5) * 100);
  const depositStrength = primaryScenario ? clamp(Math.round((primaryScenario.deposit / primaryScenario.propertyPrice) * 420), 0, 100) : 40;
  const cashflowStrength = primaryScenario ? clamp(50 + Math.round(primaryScenario.monthlySurplusAfter / 80), 0, 100) : 45;
  const debtScore = clamp(100 - Math.round((profile.liabilities / Math.max(profile.incomeAnnual, 1)) * 200), 0, 100);
  const emergencyBuffer = primaryScenario ? clamp(Math.round((profile.assets / Math.max(primaryScenario.estimatedMonthlyRepayment * 6, 1)) * 100), 0, 100) : 50;
  const incomeStability = profile.employmentType ? (profile.employmentType.toLowerCase().includes("payg") ? 88 : 68) : 45;

  const components = [
    { label: "Income Stability", score: incomeStability, explanation: profile.employmentType || "Employment type is not yet documented." },
    { label: "Deposit Strength", score: depositStrength, explanation: primaryScenario ? `${Math.round((primaryScenario.deposit / primaryScenario.propertyPrice) * 100)}% deposit against target property.` : "Create a scenario to score deposit strength." },
    { label: "Debt Position", score: debtScore, explanation: `${money(profile.liabilities)} in other liabilities is included in serviceability.` },
    { label: "Cashflow Strength", score: cashflowStrength, explanation: primaryScenario ? `${money(primaryScenario.monthlySurplusAfter)} estimated monthly surplus after purchase.` : "Create a scenario to score post-purchase cashflow." },
    { label: "Emergency Buffer", score: emergencyBuffer, explanation: `${money(profile.assets)} in liquid assets before preserving deposit assumptions.` },
    { label: "Documentation Completeness", score: documentationScore, explanation: `${docTypes.size}/5 core lender document types are available.` },
  ];
  const score = Math.round(components.reduce((sum, item) => sum + item.score, 0) / components.length);
  const band = score >= 82 ? "Ready" : score >= 68 ? "Nearly Ready" : score >= 45 ? "Needs Improvement" : "Not Ready";

  return { score, band, components };
}

export function deterministicHousingCoach(scenario: HousingScenario, obstacles: HousingObstacle[], actions: HousingActionPlan[]): HousingAiAnalysis {
  const repaymentPct = Math.round(scenario.repaymentToIncomeRatio * 100);
  const topObstacle = obstacles[0];
  return {
    scenarioId: scenario.id,
    generatedAt: new Date().toISOString(),
    provider: "deterministic",
    executiveSummary: `Based on the current Financial Profile Vault, a ${money(scenario.propertyPrice)} property is ${scenario.outcome.replace("_", " ")}. Monthly repayments are estimated at ${money(scenario.estimatedMonthlyRepayment)} and would consume about ${repaymentPct}% of estimated net income. ${topObstacle ? `The largest obstacle is ${topObstacle.category.toLowerCase()}.` : "No critical obstacle was detected."}`,
    risks: obstacles.slice(0, 4).map((obstacle) => `${obstacle.severity.toUpperCase()}: ${obstacle.description}`),
    opportunities: [
      scenario.borrowingGap > 0 ? `Close the ${money(scenario.borrowingGap)} borrowing gap through lower price, larger deposit, or higher income.` : "Scenario sits within indicative borrowing capacity.",
      scenario.monthlySurplusAfter < 1000 ? "Improving monthly surplus would materially reduce cash-flow risk." : "Post-purchase surplus is a useful planning buffer.",
    ],
    recommendations: actions.slice(0, 5).map((action) => action.action),
  };
}

export async function generateHousingCoachAnalysis(scenario: HousingScenario, obstacles: HousingObstacle[], actions: HousingActionPlan[]): Promise<HousingAiAnalysis> {
  const fallback = deterministicHousingCoach(scenario, obstacles, actions);
  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "You are a cautious Australian home affordability planning assistant. Do not give financial advice or claim lender approval. Return strict JSON.",
          },
          {
            role: "user",
            content: JSON.stringify({
              scenario,
              obstacles,
              actions,
              requiredShape: {
                executiveSummary: "string",
                risks: ["string"],
                opportunities: ["string"],
                recommendations: ["string"],
              },
            }),
          },
        ],
        text: { format: { type: "json_object" } },
      }),
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      output_text?: string;
      output?: { content?: { text?: string }[] }[];
    };
    const outputText =
      data.output_text ??
      data.output?.flatMap((item) => item.content ?? []).map((item) => item.text).find(Boolean) ??
      "{}";
    const parsed = JSON.parse(outputText) as Partial<HousingAiAnalysis>;
    return {
      ...fallback,
      provider: "openai",
      executiveSummary: parsed.executiveSummary || fallback.executiveSummary,
      risks: parsed.risks?.length ? parsed.risks : fallback.risks,
      opportunities: parsed.opportunities?.length ? parsed.opportunities : fallback.opportunities,
      recommendations: parsed.recommendations?.length ? parsed.recommendations : fallback.recommendations,
    };
  } catch {
    return fallback;
  }
}

export function buildPurchaseReadinessReport(args: {
  scenario: HousingScenario;
  comparison: HousingScenario[];
  obstacles: HousingObstacle[];
  actions: HousingActionPlan[];
  readiness: HouseReadinessScore;
  documents: UploadedDocument[];
}): PurchaseReadinessReport {
  const supportingDocuments = args.documents.map((doc) => `${doc.fileName} (${doc.documentType}, ${doc.status})`);
  const affordabilityAssessment = `${args.scenario.outcome.replace("_", " ")} with score ${args.scenario.affordabilityScore}/100 and risk level ${args.scenario.riskLevel}.`;
  const html = `
    <section>
      <h1>Vireon Home Purchase Report</h1>
      <p>${ADVICE_DISCLAIMER}</p>
      <h2>Affordability Assessment</h2>
      <p>${affordabilityAssessment}</p>
      <h2>Borrowing Capacity</h2>
      <p>Indicative capacity: ${money(args.scenario.estimatedBorrowingCapacity)}. Estimated loan: ${money(args.scenario.estimatedLoanAmount)}.</p>
      <h2>House Readiness Score</h2>
      <p>${args.readiness.score}/100 - ${args.readiness.band}</p>
      <h2>Top Obstacles</h2>
      <ul>${args.obstacles.map((item) => `<li>${item.severity}: ${item.category} - ${item.description}</li>`).join("")}</ul>
      <h2>Action Plan</h2>
      <ol>${args.actions.map((item) => `<li>${item.action} (${item.timeframe})</li>`).join("")}</ol>
    </section>
  `.trim();

  return {
    scenarioId: args.scenario.id,
    generatedAt: new Date().toISOString(),
    html,
    json: {
      financialProfileSummary: "Uses the current persisted Financial Vault values and source-traced documents.",
      borrowingCapacity: args.scenario.estimatedBorrowingCapacity,
      scenarioComparison: args.comparison,
      affordabilityAssessment,
      obstacles: args.obstacles,
      actionPlan: args.actions,
      houseReadinessScore: args.readiness,
      supportingDocuments,
      assumptions: args.scenario.assumptions,
    },
  };
}

function makeHousingId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
