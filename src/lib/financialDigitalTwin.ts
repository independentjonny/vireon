import type { FinancialVaultState } from "@/lib/financialVaultTypes";

export type TwinConfidence = "High" | "Medium" | "Low";

export type RelationshipStatus = "single" | "partnered" | "married" | "separated";

export type EmploymentStatus = "employee" | "self_employed" | "business_owner" | "career_break" | "retired" | "redundant";

export type SimulationEventType =
  | "interest_rate_change"
  | "inflation_change"
  | "property_growth_change"
  | "share_growth_change"
  | "salary_increase"
  | "promotion"
  | "redundancy"
  | "career_break"
  | "children"
  | "marriage"
  | "divorce"
  | "inheritance"
  | "business_purchase"
  | "investment_property_purchase"
  | "etf_purchase"
  | "retirement"
  | "death"
  | "aged_pension_eligibility"
  | "super_drawdown"
  | "tax_law_change";

export type FinancialDigitalTwin = {
  id: string;
  calculatedAt: string;
  identity: {
    currentAge: number;
    retirementAge: number;
    relationshipStatus: RelationshipStatus;
    dependants: number;
    state: "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";
    employment: EmploymentStatus;
  };
  income: {
    salary: number;
    bonus: number;
    businessIncome: number;
    passiveIncome: number;
    rentalIncome: number;
    otherIncome: number;
  };
  assets: {
    cash: number;
    property: number;
    investments: number;
    super: number;
    businessInterests: number;
    vehicles: number;
    collectables: number;
  };
  liabilities: {
    mortgage: number;
    investmentLoans: number;
    personalLoans: number;
    creditCards: number;
    help: number;
    otherDebt: number;
  };
  cashFlow: {
    income: number;
    expenses: number;
    savingsRate: number;
    recurringCosts: number;
    subscriptions: number;
  };
  tax: {
    marginalTaxRate: number;
    medicare: number;
    hecs: number;
    company: number;
    trust: number;
    smsf: number;
    carryForwardLosses: number;
  };
  goals: {
    house: number;
    retirement: number;
    education: number;
    emergencyFund: number;
    passiveIncome: number;
  };
  documents: {
    financialVaultConfidence: number;
    documentCoverage: number;
    missingInputs: string[];
  };
  timeline: {
    pastEvents: TwinTimelineEvent[];
    futureEvents: TwinTimelineEvent[];
  };
  knowledgeHealth: TwinKnowledgeHealth;
};

export type TwinSimulationEvent = {
  id: string;
  type: SimulationEventType;
  label: string;
  year: number;
  amount?: number;
  rateDelta?: number;
  probability: number;
  confidence: TwinConfidence;
  assumptions: string[];
};

export type TwinScenario = {
  id: string;
  name: string;
  twinId: string;
  createdAt: string;
  horizonYears: number;
  probability: number;
  events: TwinSimulationEvent[];
};

export type TwinSimulationOutput = {
  scenarioId: string;
  scenarioName: string;
  calculatedAt: string;
  horizonYears: number;
  netWorth: number;
  cashFlow: number;
  borrowingCapacity: number;
  taxPaid: number;
  passiveIncome: number;
  debt: number;
  emergencyFund: number;
  goalProgress: number;
  houseReadiness: number;
  retirementScore: number;
  riskScore: number;
  confidence: TwinConfidence;
  timeToFinancialIndependenceYears: number | null;
  yearly: TwinYearProjection[];
  decisions: TwinDecision[];
  futureTimelineEvents: TwinTimelineEvent[];
  assumptions: string[];
  evidence: string[];
};

export type TwinYearProjection = {
  year: number;
  age: number;
  netWorth: number;
  cashFlow: number;
  borrowingCapacity: number;
  taxPaid: number;
  passiveIncome: number;
  debt: number;
  superBalance: number;
  investmentBalance: number;
  propertyValue: number;
  riskScore: number;
};

export type TwinScenarioComparison = {
  scenarioId: string;
  scenarioName: string;
  netWorth: number;
  borrowing: number;
  tax: number;
  cashFlow: number;
  risk: number;
  probability: number;
  confidence: TwinConfidence;
  goalCompletion: number;
  timeToFinancialIndependenceYears: number | null;
};

export type TwinDecision = {
  id: string;
  title: string;
  financialImpact: string;
  confidence: TwinConfidence;
  evidence: string[];
  assumptions: string[];
  actionLabel: string;
  actionRoute: string;
  professionalReviewRequired: boolean;
};

export type TwinTimelineEvent = {
  id: string;
  year: number;
  title: string;
  description: string;
  financialImpact: number;
  domains: string[];
  confidence: TwinConfidence;
};

export type TwinKnowledgeHealth = {
  digitalTwinConfidence: number;
  documentCoverage: number;
  missingInputs: string[];
  assumptionCount: number;
  ruleFreshness: TwinConfidence;
  lastCalculation: string;
  lastVerification: string;
};

export type TwinPersistedState = {
  twin: FinancialDigitalTwin;
  scenarios: TwinScenario[];
  simulationHistory: TwinSimulationOutput[];
  decisionHistory: TwinDecision[];
  timelineEvents: TwinTimelineEvent[];
  calculationSnapshots: TwinYearProjection[][];
};

const TAX_RULE_LAST_VERIFIED = "2026-07-18";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function totalIncome(twin: FinancialDigitalTwin): number {
  return Object.values(twin.income).reduce((total, value) => total + value, 0);
}

function totalAssets(twin: FinancialDigitalTwin): number {
  return Object.values(twin.assets).reduce((total, value) => total + value, 0);
}

function totalDebt(twin: FinancialDigitalTwin): number {
  return Object.values(twin.liabilities).reduce((total, value) => total + value, 0);
}

function calculateResidentTax(income: number): number {
  const taxableIncome = Math.max(0, income);
  if (taxableIncome <= 18200) return 0;
  if (taxableIncome <= 45000) return (taxableIncome - 18200) * 0.16;
  if (taxableIncome <= 135000) return 4288 + (taxableIncome - 45000) * 0.3;
  if (taxableIncome <= 190000) return 31288 + (taxableIncome - 135000) * 0.37;
  return 51638 + (taxableIncome - 190000) * 0.45;
}

function marginalRate(income: number): number {
  if (income <= 18200) return 0;
  if (income <= 45000) return 16;
  if (income <= 135000) return 30;
  if (income <= 190000) return 37;
  return 45;
}

function confidenceFromScore(score: number): TwinConfidence {
  if (score >= 80) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString()}`;
}

export function buildFinancialDigitalTwinFromVault(vault: FinancialVaultState, now = "2026-07-18T00:00:00.000Z"): FinancialDigitalTwin {
  const profile = vault.financial_profile;
  const sourceCount = Object.values(profile.sources).filter(Boolean).length;
  const documentCoverage = Math.round((vault.uploaded_documents.filter((doc) => doc.status === "extracted").length / 5) * 100);
  const missingInputs = [
    profile.incomeAnnual ? "" : "Salary or business income",
    profile.assets ? "" : "Asset balances",
    profile.liabilities || profile.mortgageBalance ? "" : "Liability balances",
    profile.superBalance ? "" : "Superannuation balance",
    profile.monthlySpending ? "" : "Recurring expenses",
  ].filter(Boolean);
  const incomeAnnual = profile.incomeAnnual || profile.incomeMonthly * 12;
  const annualExpenses = profile.monthlySpending * 12 || Math.round(incomeAnnual * 0.62);
  const annualSubscriptions = profile.recurringSubscriptions * 12;
  const totalAnnualIncome = incomeAnnual;
  const netCashFlow = totalAnnualIncome - annualExpenses;
  const confidenceScore = clamp(Math.round((sourceCount / 8) * 65 + documentCoverage * 0.35), 0, 100);
  const assets = Math.max(profile.assets, profile.mortgageBalance + profile.superBalance + 120000);

  return {
    id: "digital-twin-current",
    calculatedAt: now,
    identity: {
      currentAge: 36,
      retirementAge: 60,
      relationshipStatus: "partnered",
      dependants: 0,
      state: "NSW",
      employment: profile.employmentType.toLowerCase().includes("self") ? "self_employed" : "employee",
    },
    income: {
      salary: incomeAnnual,
      bonus: 0,
      businessIncome: 0,
      passiveIncome: 0,
      rentalIncome: 0,
      otherIncome: 0,
    },
    assets: {
      cash: Math.max(40_000, Math.round(assets * 0.12)),
      property: Math.max(0, assets - profile.superBalance - Math.max(40_000, Math.round(assets * 0.12))),
      investments: Math.max(15_000, Math.round(assets * 0.08)),
      super: profile.superBalance,
      businessInterests: 0,
      vehicles: 35_000,
      collectables: 0,
    },
    liabilities: {
      mortgage: profile.mortgageBalance,
      investmentLoans: 0,
      personalLoans: Math.max(0, profile.liabilities - profile.mortgageBalance),
      creditCards: 8_000,
      help: 0,
      otherDebt: 0,
    },
    cashFlow: {
      income: totalAnnualIncome,
      expenses: annualExpenses,
      savingsRate: totalAnnualIncome > 0 ? clamp((netCashFlow / totalAnnualIncome) * 100, -100, 100) : 0,
      recurringCosts: annualExpenses,
      subscriptions: annualSubscriptions,
    },
    tax: {
      marginalTaxRate: marginalRate(incomeAnnual),
      medicare: incomeAnnual * 0.02,
      hecs: 0,
      company: 0,
      trust: 0,
      smsf: 0,
      carryForwardLosses: 0,
    },
    goals: {
      house: 72,
      retirement: 54,
      education: 12,
      emergencyFund: clamp((Math.max(40_000, Math.round(assets * 0.12)) / Math.max(1, annualExpenses / 12 / 6)) * 100, 0, 100),
      passiveIncome: 18,
    },
    documents: {
      financialVaultConfidence: confidenceScore,
      documentCoverage,
      missingInputs,
    },
    timeline: {
      pastEvents: vault.uploaded_documents.map((doc) => ({
        id: `vault-${doc.id}`,
        year: new Date(doc.uploadedAt).getFullYear(),
        title: doc.fileName,
        description: `${doc.documentType.replaceAll("_", " ")} imported into the Financial Vault.`,
        financialImpact: 0,
        domains: ["documents", "financial-vault"],
        confidence: confidenceFromScore(doc.extractionConfidence * 100),
      })),
      futureEvents: [],
    },
    knowledgeHealth: {
      digitalTwinConfidence: confidenceScore,
      documentCoverage,
      missingInputs,
      assumptionCount: 24 + missingInputs.length,
      ruleFreshness: "High",
      lastCalculation: now,
      lastVerification: TAX_RULE_LAST_VERIFIED,
    },
  };
}

export function buildDefaultTwinScenarios(twin: FinancialDigitalTwin): TwinScenario[] {
  const baseYear = new Date(twin.calculatedAt).getFullYear();
  return [
    { id: "current", name: "Current", twinId: twin.id, createdAt: twin.calculatedAt, horizonYears: 30, probability: 0.82, events: [] },
    {
      id: "aggressive-investing",
      name: "Aggressive Investing",
      twinId: twin.id,
      createdAt: twin.calculatedAt,
      horizonYears: 30,
      probability: 0.62,
      events: [
        { id: "ai-etf-1", type: "etf_purchase", label: "Invest $1,500/month into ETFs", year: baseYear + 1, amount: 18_000, probability: 0.72, confidence: "Medium", assumptions: ["Annual ETF contribution continues until retirement"] },
        { id: "ai-share-growth", type: "share_growth_change", label: "Higher share growth assumption", year: baseYear + 1, rateDelta: 2, probability: 0.55, confidence: "Low", assumptions: ["Market returns remain volatile"] },
      ],
    },
    {
      id: "early-retirement",
      name: "Early Retirement",
      twinId: twin.id,
      createdAt: twin.calculatedAt,
      horizonYears: 30,
      probability: 0.58,
      events: [
        { id: "er-retire", type: "retirement", label: "Retire at 55", year: baseYear + Math.max(1, 55 - twin.identity.currentAge), probability: 0.55, confidence: "Medium", assumptions: ["Employment income stops at 55"] },
      ],
    },
    {
      id: "upgrade-house",
      name: "Upgrade House",
      twinId: twin.id,
      createdAt: twin.calculatedAt,
      horizonYears: 30,
      probability: 0.68,
      events: [
        { id: "uh-property", type: "investment_property_purchase", label: "Upgrade home with larger mortgage", year: baseYear + 2, amount: 350_000, probability: 0.68, confidence: "Medium", assumptions: ["Additional debt funds property upgrade"] },
      ],
    },
    {
      id: "start-business",
      name: "Start Business",
      twinId: twin.id,
      createdAt: twin.calculatedAt,
      horizonYears: 30,
      probability: 0.46,
      events: [
        { id: "sb-business", type: "business_purchase", label: "Buy into a business", year: baseYear + 3, amount: 120_000, probability: 0.46, confidence: "Low", assumptions: ["Business income ramps over three years"] },
      ],
    },
    {
      id: "retire-60",
      name: "Retire at 60",
      twinId: twin.id,
      createdAt: twin.calculatedAt,
      horizonYears: 30,
      probability: 0.74,
      events: [
        { id: "r60-retire", type: "retirement", label: "Retire at 60", year: baseYear + Math.max(1, 60 - twin.identity.currentAge), probability: 0.74, confidence: "Medium", assumptions: ["Employment income stops at 60"] },
      ],
    },
  ];
}

function applyEventToProjection(event: TwinSimulationEvent, projection: TwinYearProjection): TwinYearProjection {
  const next = { ...projection };
  if (event.type === "salary_increase" || event.type === "promotion") next.cashFlow += event.amount ?? 12_000;
  if (event.type === "redundancy") next.cashFlow -= event.amount ?? 55_000;
  if (event.type === "career_break") next.cashFlow -= event.amount ?? 45_000;
  if (event.type === "children") next.cashFlow -= event.amount ?? 18_000;
  if (event.type === "marriage") next.cashFlow += event.amount ?? 10_000;
  if (event.type === "divorce") {
    next.netWorth *= 0.72;
    next.cashFlow -= event.amount ?? 20_000;
    next.riskScore += 18;
  }
  if (event.type === "inheritance") {
    next.netWorth += event.amount ?? 150_000;
    next.cashFlow += 4_500;
  }
  if (event.type === "business_purchase") {
    next.netWorth += (event.amount ?? 120_000) * 0.6;
    next.cashFlow += 22_000;
    next.riskScore += 16;
  }
  if (event.type === "investment_property_purchase") {
    const amount = event.amount ?? 650_000;
    next.propertyValue += amount;
    next.debt += Math.round(amount * 0.78);
    next.cashFlow -= Math.round(amount * 0.025);
    next.borrowingCapacity -= Math.round(amount * 0.32);
    next.riskScore += 14;
  }
  if (event.type === "etf_purchase") {
    const amount = event.amount ?? 12_000;
    next.investmentBalance += amount;
    next.cashFlow -= amount;
  }
  if (event.type === "retirement") {
    next.cashFlow -= Math.max(0, next.cashFlow * 0.55);
    next.riskScore += 10;
  }
  if (event.type === "death") {
    next.cashFlow -= Math.max(0, next.cashFlow * 0.5);
    next.riskScore += 35;
  }
  if (event.type === "aged_pension_eligibility") next.cashFlow += event.amount ?? 21_000;
  if (event.type === "super_drawdown") {
    next.superBalance -= event.amount ?? 35_000;
    next.cashFlow += event.amount ?? 35_000;
  }
  if (event.type === "tax_law_change") next.taxPaid += event.amount ?? 3_000;
  next.riskScore = clamp(next.riskScore, 0, 100);
  next.netWorth = next.cashFlow + next.propertyValue + next.investmentBalance + next.superBalance - next.debt;
  return next;
}

export function simulateDigitalTwinScenario(twin: FinancialDigitalTwin, scenario: TwinScenario): TwinSimulationOutput {
  const currentYear = new Date(twin.calculatedAt).getFullYear();
  const baseIncome = totalIncome(twin);
  const baseDebt = totalDebt(twin);
  const startingNetWorth = totalAssets(twin) - baseDebt;
  const baseTax = calculateResidentTax(baseIncome) + twin.tax.medicare + twin.tax.hecs;
  const baseBorrowing = Math.max(0, Math.round((baseIncome - twin.cashFlow.expenses) * 5.2 - baseDebt * 0.18));
  const yearly: TwinYearProjection[] = [];
  const horizon = Math.max(1, scenario.horizonYears);
  let netWorth = startingNetWorth;
  let cashFlow = twin.cashFlow.income - twin.cashFlow.expenses - baseTax;
  let debt = baseDebt;
  let superBalance = twin.assets.super;
  let investmentBalance = twin.assets.investments;
  let propertyValue = twin.assets.property;
  const riskScore = clamp(42 + baseDebt / Math.max(1, totalAssets(twin)) * 35 - twin.documents.financialVaultConfidence * 0.18, 0, 100);
  const scenarioAssumptions = ["Australian resident individual tax brackets are deterministic and simplified", "Inflation, market returns and lender policy are scenario assumptions", ...scenario.events.flatMap((event) => event.assumptions)];
  const eventByYear = new Map<number, TwinSimulationEvent[]>();
  for (const event of scenario.events) {
    eventByYear.set(event.year, [...(eventByYear.get(event.year) ?? []), event]);
  }
  let propertyGrowth = 0.04;
  let shareGrowth = 0.06;
  let inflation = 0.03;
  let interestRateDelta = 0;
  let fiYear: number | null = null;

  for (let offset = 1; offset <= horizon; offset += 1) {
    const year = currentYear + offset;
    for (const event of eventByYear.get(year) ?? []) {
      if (event.type === "property_growth_change") propertyGrowth += (event.rateDelta ?? 0) / 100;
      if (event.type === "share_growth_change") shareGrowth += (event.rateDelta ?? 0) / 100;
      if (event.type === "inflation_change") inflation += (event.rateDelta ?? 0) / 100;
      if (event.type === "interest_rate_change") interestRateDelta += event.rateDelta ?? 0;
    }
    propertyValue *= 1 + propertyGrowth;
    investmentBalance *= 1 + shareGrowth;
    superBalance = superBalance * 1.065 + Math.max(0, baseIncome * 0.115);
    debt = Math.max(0, debt - Math.max(12_000, cashFlow * 0.18) + Math.max(0, interestRateDelta) * 1_800);
    cashFlow *= 1 + Math.max(0, 0.025 - inflation * 0.25);
    const taxableIncome = Math.max(0, baseIncome + Math.max(0, cashFlow * 0.12));
    const taxPaid = calculateResidentTax(taxableIncome) + taxableIncome * 0.02;
    let projection: TwinYearProjection = {
      year,
      age: twin.identity.currentAge + offset,
      netWorth,
      cashFlow,
      borrowingCapacity: Math.max(0, Math.round((taxableIncome - twin.cashFlow.expenses * Math.pow(1 + inflation, offset)) * 5.2 - debt * 0.18)),
      taxPaid,
      passiveIncome: Math.max(0, investmentBalance * 0.035 + propertyValue * 0.015 - debt * 0.012),
      debt,
      superBalance,
      investmentBalance,
      propertyValue,
      riskScore,
    };
    for (const event of eventByYear.get(year) ?? []) projection = applyEventToProjection(event, projection);
    netWorth = projection.netWorth = projection.propertyValue + projection.investmentBalance + projection.superBalance + twin.assets.cash + twin.assets.businessInterests + twin.assets.vehicles + twin.assets.collectables - projection.debt;
    if (!fiYear && projection.passiveIncome >= twin.cashFlow.expenses * 0.75) fiYear = year;
    yearly.push(projection);
  }

  const last = yearly.at(-1) ?? {
    year: currentYear,
    age: twin.identity.currentAge,
    netWorth: startingNetWorth,
    cashFlow,
    borrowingCapacity: baseBorrowing,
    taxPaid: baseTax,
    passiveIncome: twin.income.passiveIncome,
    debt: baseDebt,
    superBalance: twin.assets.super,
    investmentBalance: twin.assets.investments,
    propertyValue: twin.assets.property,
    riskScore,
  };
  const confidenceScore = clamp(twin.documents.financialVaultConfidence - scenario.events.filter((event) => event.confidence === "Low").length * 8 - Math.max(0, scenario.horizonYears - 20) * 0.8, 0, 100);
  const futureTimelineEvents = generateFutureTimelineEvents(twin, yearly, scenario);
  const output: TwinSimulationOutput = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    calculatedAt: new Date().toISOString(),
    horizonYears: scenario.horizonYears,
    netWorth: Math.round(last.netWorth),
    cashFlow: Math.round(last.cashFlow),
    borrowingCapacity: Math.round(last.borrowingCapacity),
    taxPaid: Math.round(last.taxPaid),
    passiveIncome: Math.round(last.passiveIncome),
    debt: Math.round(last.debt),
    emergencyFund: Math.round(clamp(twin.assets.cash / Math.max(1, twin.cashFlow.expenses / 12) * 100 / 6, 0, 100)),
    goalProgress: Math.round((twin.goals.house + twin.goals.retirement + twin.goals.emergencyFund + twin.goals.passiveIncome) / 4),
    houseReadiness: Math.round(clamp((twin.assets.cash / 180_000) * 55 + (last.borrowingCapacity / 750_000) * 45 - last.riskScore * 0.25, 0, 100)),
    retirementScore: Math.round(clamp((last.superBalance + last.investmentBalance) / Math.max(1, twin.cashFlow.expenses * 22) * 100, 0, 100)),
    riskScore: Math.round(last.riskScore),
    confidence: confidenceFromScore(confidenceScore),
    timeToFinancialIndependenceYears: fiYear ? fiYear - currentYear : null,
    yearly,
    decisions: [],
    futureTimelineEvents,
    assumptions: scenarioAssumptions,
    evidence: [`Financial Vault confidence ${twin.documents.financialVaultConfidence}%`, `${scenario.events.length} future events modelled`, `Tax rules last verified ${TAX_RULE_LAST_VERIFIED}`],
  };
  return { ...output, decisions: generateTwinDecisions(twin, output) };
}

export function compareTwinScenarios(twin: FinancialDigitalTwin, scenarios: TwinScenario[], maxScenarios = 4): TwinScenarioComparison[] {
  return scenarios.slice(0, maxScenarios).map((scenario) => {
    const output = simulateDigitalTwinScenario(twin, scenario);
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      netWorth: output.netWorth,
      borrowing: output.borrowingCapacity,
      tax: output.taxPaid,
      cashFlow: output.cashFlow,
      risk: output.riskScore,
      probability: scenario.probability,
      confidence: output.confidence,
      goalCompletion: output.goalProgress,
      timeToFinancialIndependenceYears: output.timeToFinancialIndependenceYears,
    };
  });
}

export function generateTwinDecisions(twin: FinancialDigitalTwin, output: TwinSimulationOutput): TwinDecision[] {
  const baseRetirementWealth = twin.assets.super + twin.assets.investments;
  const decisions: TwinDecision[] = [];
  const monthlyDiscretionary = Math.max(150, Math.round(twin.cashFlow.expenses * 0.08 / 12));
  const retirementImpact = Math.round(monthlyDiscretionary * 12 * 30 * 2.3);
  decisions.push({
    id: `${output.scenarioId}-spending-retirement`,
    title: `Reducing discretionary spending by ${money(monthlyDiscretionary)}/month may increase retirement wealth by approximately ${money(retirementImpact)}`,
    financialImpact: money(retirementImpact),
    confidence: output.confidence,
    evidence: [`Scenario ${output.scenarioName}`, `Starting retirement assets ${money(baseRetirementWealth)}`, `Savings rate ${Math.round(twin.cashFlow.savingsRate)}%`],
    assumptions: ["Savings are invested over 30 years", "Returns are scenario estimates", "No personal financial advice is provided"],
    actionLabel: "Model spending reduction",
    actionRoute: "/digital-twin",
    professionalReviewRequired: false,
  });
  if (output.debt > totalDebt(twin) + 100_000) {
    decisions.push({
      id: `${output.scenarioId}-borrowing-capacity`,
      title: `New debt in this scenario reduces borrowing capacity by approximately ${money(Math.max(0, totalDebt(twin) + output.borrowingCapacity - output.debt))}`,
      financialImpact: money(output.borrowingCapacity - Math.max(0, totalDebt(twin))),
      confidence: "Medium",
      evidence: [`Scenario debt ${money(output.debt)}`, `Scenario borrowing capacity ${money(output.borrowingCapacity)}`],
      assumptions: ["Borrowing capacity uses simplified serviceability proxy", "Lender policy is not guaranteed"],
      actionLabel: "Review borrowing impact",
      actionRoute: "/digital-twin",
      professionalReviewRequired: true,
    });
  }
  if (output.houseReadiness < 75) {
    decisions.push({
      id: `${output.scenarioId}-wait-two-years`,
      title: `Waiting and improving cash reserves may lift house readiness from ${output.houseReadiness} toward ${Math.min(95, output.houseReadiness + 15)}`,
      financialImpact: "Readiness improvement",
      confidence: "Medium",
      evidence: [`House readiness ${output.houseReadiness}/100`, `Emergency fund ${output.emergencyFund}/100`],
      assumptions: ["Cash reserves improve", "Debt does not increase materially", "Property prices follow scenario growth"],
      actionLabel: "Compare housing timing",
      actionRoute: "/digital-twin",
      professionalReviewRequired: false,
    });
  }
  return decisions;
}

export function generateFutureTimelineEvents(twin: FinancialDigitalTwin, yearly: TwinYearProjection[], scenario: TwinScenario): TwinTimelineEvent[] {
  const events: TwinTimelineEvent[] = [];
  const mortgageHalf = yearly.find((year) => twin.liabilities.mortgage > 0 && year.debt <= twin.liabilities.mortgage * 0.5);
  const portfolio500 = yearly.find((year) => year.investmentBalance >= 500_000);
  const super12 = yearly.find((year) => year.superBalance >= 1_200_000);
  const fi = yearly.find((year) => year.passiveIncome >= twin.cashFlow.expenses * 0.75);
  for (const event of scenario.events) {
    events.push({
      id: `scenario-${event.id}`,
      year: event.year,
      title: event.label,
      description: `${event.type.replaceAll("_", " ")} event applied to the simulation.`,
      financialImpact: event.amount ?? event.rateDelta ?? 0,
      domains: ["digital-twin", "scenario"],
      confidence: event.confidence,
    });
  }
  if (mortgageHalf) events.push({ id: `${scenario.id}-mortgage-half`, year: mortgageHalf.year, title: "Mortgage paid below 50%", description: "Total modelled debt has fallen below half the current mortgage balance.", financialImpact: mortgageHalf.debt, domains: ["debt", "housing"], confidence: "Medium" });
  if (portfolio500) events.push({ id: `${scenario.id}-portfolio-500`, year: portfolio500.year, title: "Investment portfolio reaches $500k", description: "Investments reach the $500k scenario milestone.", financialImpact: portfolio500.investmentBalance, domains: ["investments"], confidence: "Medium" });
  if (fi) events.push({ id: `${scenario.id}-fi`, year: fi.year, title: "Financial independence threshold reached", description: "Passive income reaches 75% of current annual expenses.", financialImpact: fi.passiveIncome, domains: ["retirement", "goals"], confidence: "Low" });
  if (super12) events.push({ id: `${scenario.id}-super-12`, year: super12.year, title: "Super exceeds $1.2M", description: "Superannuation projection passes the $1.2M milestone.", financialImpact: super12.superBalance, domains: ["super", "retirement"], confidence: "Medium" });
  return events.sort((a, b) => a.year - b.year);
}

export function createTwinPersistedState(vault: FinancialVaultState): TwinPersistedState {
  const twin = buildFinancialDigitalTwinFromVault(vault);
  const scenarios = buildDefaultTwinScenarios(twin);
  const simulationHistory = scenarios.map((scenario) => simulateDigitalTwinScenario(twin, scenario));
  return {
    twin,
    scenarios,
    simulationHistory,
    decisionHistory: simulationHistory.flatMap((simulation) => simulation.decisions),
    timelineEvents: [...twin.timeline.pastEvents, ...simulationHistory.flatMap((simulation) => simulation.futureTimelineEvents)],
    calculationSnapshots: simulationHistory.map((simulation) => simulation.yearly),
  };
}

export const FinancialDigitalTwinEngine = {
  buildFromVault: buildFinancialDigitalTwinFromVault,
  defaultScenarios: buildDefaultTwinScenarios,
  simulate: simulateDigitalTwinScenario,
  compare: compareTwinScenarios,
  generateDecisions: generateTwinDecisions,
  generateTimeline: generateFutureTimelineEvents,
  createPersistedState: createTwinPersistedState,
};
