import type { FinancialVaultState } from "@/lib/financialVaultTypes";
import type { FinancialBalanceSheet } from "@/lib/financialBalanceSheet";
import type { HousingAffordabilityState } from "@/lib/housingAffordabilityTypes";

export type AiDecisionPriority = "Critical" | "High" | "Medium" | "Low";
export type AiDecisionStatus = "New" | "Reviewed" | "Actioned" | "Dismissed";

export type AiDecision = {
  id: string;
  rank: number;
  priority: AiDecisionPriority;
  category: string;
  title: string;
  financialImpact: string;
  confidence: "High" | "Medium" | "Low";
  reason: string;
  recommendedAction: string;
  estimatedBenefit: string;
  actionLabel: string;
  actionHref: string;
  expectedImpact: string;
  timeToComplete: string;
  requiredData: string[];
  whyThisMatters: string;
  evidence: string[];
  nextStep: string;
  sourceData: string[];
  monthlySavingsEstimate: number;
  missingDataBlocker: boolean;
  source: "Financial Vault" | "Balance Sheet" | "Housing Scenarios" | "Cash Flow" | "Subscriptions" | "Goals" | "Alerts";
};

const priorityScore: Record<AiDecisionPriority, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function score(decision: Omit<AiDecision, "rank">) {
  const confidenceBoost = decision.confidence === "High" ? 0.3 : decision.confidence === "Medium" ? 0.15 : 0;
  return priorityScore[decision.priority] + confidenceBoost;
}

export function buildAiDecisions(input: {
  vault: FinancialVaultState;
  balanceSheet: FinancialBalanceSheet;
  housing: HousingAffordabilityState;
}): AiDecision[] {
  const { vault, balanceSheet, housing } = input;
  const housingReadinessScore = housing.house_readiness_score.score;
  const missingDocuments = vault.lender_pack.documentChecklist.filter((item) => !item.available);
  const availableDocuments = vault.lender_pack.documentChecklist.filter((item) => item.available).length;
  const refinanceMonthlySaving = Math.round(balanceSheet.refinance.monthlySaving);
  const refinanceAnnualSaving = Math.round(balanceSheet.refinance.annualSaving);
  const refinanceOpportunity = vault.refinance_opportunities[0];
  const profileConfidence = Math.min(
    98,
    Math.round(Object.keys(vault.financial_profile.sources).length * 6.5 + vault.uploaded_documents.filter((doc) => doc.status === "extracted").length * 6)
  );

  const decisions: Omit<AiDecision, "rank">[] = [
    {
      id: "refinance-mortgage-rate",
      priority: "Critical",
      category: "Mortgage",
      title: "Mortgage could be refinanced",
      financialImpact: `$${refinanceMonthlySaving.toLocaleString()}/mo`,
      confidence: balanceSheet.refinance.confidence === "High" ? "High" : "Medium",
      reason: "Your current mortgage rate is above the benchmark assumption used by Vireon.",
      recommendedAction: "Compare refinance options and fee break-even.",
      estimatedBenefit: `$${refinanceAnnualSaving.toLocaleString()}/year before fees`,
      actionLabel: "Review mortgage options",
      actionHref: "/balance-sheet/mortgages",
      expectedImpact: `$${refinanceMonthlySaving.toLocaleString()} lower monthly repayment before fees`,
      timeToComplete: "10-15 min",
      requiredData: ["Current mortgage balance", "Interest rate", "Monthly repayment", "Refinance benchmark"],
      whyThisMatters: "Mortgage repayments are usually the largest controllable monthly cost. Even a modest rate improvement can improve cash flow and borrowing capacity.",
      evidence: [
        refinanceOpportunity
          ? `Current rate ${refinanceOpportunity.currentRate.toFixed(2)}% vs benchmark ${refinanceOpportunity.benchmarkRate.toFixed(2)}%`
          : "Current mortgage rate is above benchmark assumption",
        `Estimated annual saving before fees is $${refinanceAnnualSaving.toLocaleString()}`,
        `Confidence: ${balanceSheet.refinance.confidence}`,
      ],
      nextStep: "Open the mortgage workspace, compare the current loan against the benchmark, and check break-even after switching costs.",
      sourceData: ["Balance Sheet mortgage category", "Mortgage Statement source", "Refinance opportunity model"],
      monthlySavingsEstimate: refinanceMonthlySaving,
      missingDataBlocker: false,
      source: "Balance Sheet",
    },
    {
      id: "housing-capacity-increased",
      priority: "High",
      category: "Housing",
      title: "Borrowing capacity has improved",
      financialImpact: "+$18,000 capacity",
      confidence: "Medium",
      reason: `Positive monthly cash flow and a house readiness score of ${housingReadinessScore}/100 support a stronger serviceability estimate.`,
      recommendedAction: "Run the $1.3M home affordability scenario.",
      estimatedBenefit: "Clearer purchase range and risk score",
      actionLabel: "Open housing scenarios",
      actionHref: "/housing-scenarios",
      expectedImpact: "Updated borrowing gap, repayment estimate, and readiness score",
      timeToComplete: "5-8 min",
      requiredData: ["Income", "Deposit", "Liabilities", "Monthly surplus", "Property target"],
      whyThisMatters: "Borrowing capacity changes are only useful when translated into repayments, cash-flow pressure, and deposit gaps.",
      evidence: [
        `House readiness score is ${housingReadinessScore}/100`,
        "Cash flow remains positive after core expenses",
        "Scenario model can compare target price, larger deposit, and wait-12-month options",
      ],
      nextStep: "Open Housing Scenarios and run the target property price against your current deposit.",
      sourceData: ["Housing affordability engine", "Financial Profile Vault", "Balance Sheet deposit and liabilities"],
      monthlySavingsEstimate: 0,
      missingDataBlocker: false,
      source: "Housing Scenarios",
    },
    {
      id: "vault-missing-document",
      priority: missingDocuments.length > 0 ? "High" : "Low",
      category: "Financial Vault",
      title: missingDocuments.length > 0 ? `Upload ${missingDocuments[0].label.toLowerCase()}` : "Vault profile is nearly complete",
      financialImpact: `${availableDocuments}/5 docs ready`,
      confidence: "High",
      reason: missingDocuments.length > 0
        ? "A missing document reduces lender-pack readiness and profile traceability."
        : "Core lender documents are available for the current profile.",
      recommendedAction: missingDocuments.length > 0 ? "Upload the missing document to improve confidence." : "Generate or review the lender pack.",
      estimatedBenefit: "Higher profile confidence",
      actionLabel: missingDocuments.length > 0 ? "Upload document" : "Review vault",
      actionHref: "/financial-vault",
      expectedImpact: missingDocuments.length > 0 ? "Improves lender-pack readiness and source confidence" : "Keeps source documents fresh",
      timeToComplete: "3-5 min",
      requiredData: missingDocuments.length > 0 ? [missingDocuments[0].label] : ["Current lender pack"],
      whyThisMatters: "Profile values are more useful when they can be traced to a recent source document. Missing documents lower confidence in borrowing and lender-pack outputs.",
      evidence: [
        `${availableDocuments} of 5 core document categories are ready`,
        missingDocuments.length > 0 ? `${missingDocuments[0].label} is missing` : "All core documents are available",
        `Profile confidence is ${profileConfidence}%`,
      ],
      nextStep: missingDocuments.length > 0 ? `Upload the latest ${missingDocuments[0].label.toLowerCase()} in Financial Vault.` : "Open Financial Vault and review the lender pack summary.",
      sourceData: ["Financial Vault document checklist", "Profile confidence score", "Lender pack readiness"],
      monthlySavingsEstimate: 0,
      missingDataBlocker: missingDocuments.length > 0,
      source: "Financial Vault",
    },
    {
      id: "cash-flow-surplus",
      priority: "Medium",
      category: "Cash Flow",
      title: "Cash flow improved",
      financialImpact: "$6,420 surplus",
      confidence: "High",
      reason: "Income continues to exceed core expenses and debt repayments this month.",
      recommendedAction: "Move surplus into the home deposit goal or offset account.",
      estimatedBenefit: "$400/mo extra savings improves readiness",
      actionLabel: "Review cash flow",
      actionHref: "/cash-flow",
      expectedImpact: "$400/month redirected toward deposit or offset",
      timeToComplete: "5 min",
      requiredData: ["Current monthly income", "Core expenses", "Goal contribution"],
      whyThisMatters: "A recurring surplus is most powerful when it is assigned to a goal, offset account, or debt reduction instead of left unallocated.",
      evidence: ["Monthly surplus is $6,420", "$400/month extra savings improves housing readiness", "Income exceeds core expenses and debt repayments"],
      nextStep: "Open Cash Flow and allocate the next surplus slice to the home deposit or offset account.",
      sourceData: ["Cash Flow workspace", "Financial Vault monthly spending", "Goal tracker"],
      monthlySavingsEstimate: 400,
      missingDataBlocker: false,
      source: "Cash Flow",
    },
    {
      id: "dining-spend-above-average",
      priority: "Medium",
      category: "Spending",
      title: "Dining spend exceeded budget",
      financialImpact: "$142 over budget",
      confidence: "Medium",
      reason: "Dining is tracking 18% above the recent average.",
      recommendedAction: "Review dining transactions and set a tighter weekly cap.",
      estimatedBenefit: "$120-$180/mo potential saving",
      actionLabel: "Review dining transactions",
      actionHref: "/transactions",
      expectedImpact: "$120-$180/month potential spending reduction",
      timeToComplete: "8-10 min",
      requiredData: ["Recent transactions", "Dining category", "Monthly budget"],
      whyThisMatters: "Small discretionary leaks reduce deposit speed and borrowing-capacity confidence because they lower repeatable monthly surplus.",
      evidence: ["Dining is 18% above recent average", "$142 over current budget", "Category is visible in imported transactions"],
      nextStep: "Open Transactions, filter to dining, and identify merchants to cap or reduce this week.",
      sourceData: ["Transactions", "Cash Flow category trend", "Budget variance"],
      monthlySavingsEstimate: 142,
      missingDataBlocker: false,
      source: "Cash Flow",
    },
    {
      id: "subscription-review",
      priority: "Medium",
      category: "Subscriptions",
      title: "Subscriptions are ready for review",
      financialImpact: "$268/mo recurring",
      confidence: "Medium",
      reason: "Recurring subscription load is high enough to warrant cancellation review.",
      recommendedAction: "Review duplicate, unused, or recently increased subscriptions.",
      estimatedBenefit: "$59/mo estimated saving",
      actionLabel: "Review subscriptions",
      actionHref: "/subscriptions",
      expectedImpact: "$59/month estimated subscription saving",
      timeToComplete: "5-7 min",
      requiredData: ["Recurring merchants", "Renewal dates", "Monthly subscription spend"],
      whyThisMatters: "Subscriptions are repeatable cash-flow commitments. Removing unused services improves surplus every month without changing income.",
      evidence: ["Recurring subscriptions total $268/month", "$59/month estimated saving", "Renewal calendar is available"],
      nextStep: "Open Subscriptions and cancel duplicate, unused, or recently increased recurring payments.",
      sourceData: ["Subscriptions API", "Recurring transaction detector", "Cash Flow recurring expenses"],
      monthlySavingsEstimate: 59,
      missingDataBlocker: false,
      source: "Subscriptions",
    },
    {
      id: "home-deposit-goal",
      priority: "Medium",
      category: "Goals",
      title: "Goal contribution path needs review",
      financialImpact: "Not calculated yet",
      confidence: "High",
      reason: "Goal progress should be reviewed against confirmed cash flow before changing contributions.",
      recommendedAction: "Open Goals and compare a contribution scenario.",
      estimatedBenefit: "Earlier deposit readiness",
      actionLabel: "Open goals",
      actionHref: "/goals",
      expectedImpact: "Goal timing will be recalculated from saved goal and cash-flow inputs.",
      timeToComplete: "4-6 min",
      requiredData: ["Goal balance", "Monthly contribution", "Target date"],
      whyThisMatters: "Goal shortfalls are easiest to fix while cash flow is positive. A small recurring increase compounds into a faster deposit timeline.",
      evidence: ["Saved goal", "Confirmed monthly surplus", "Deterministic goal planner"],
      nextStep: "Open Goals and compare the baseline with a contribution scenario before changing real commitments.",
      sourceData: ["Goals workspace", "Cash Flow surplus", "Housing readiness model"],
      monthlySavingsEstimate: 0,
      missingDataBlocker: false,
      source: "Goals",
    },
    {
      id: "credit-card-payment",
      priority: "High",
      category: "Alerts",
      title: "Credit card payment due soon",
      financialImpact: "$95 due",
      confidence: "High",
      reason: "A card payment is due in the next 3 days and should be cleared to protect borrowing capacity.",
      recommendedAction: "Open credit cards and confirm payment.",
      estimatedBenefit: "Avoid fees and serviceability drag",
      actionLabel: "Open credit cards",
      actionHref: "/balance-sheet/credit-cards",
      expectedImpact: "Avoid fees and protect serviceability",
      timeToComplete: "2-4 min",
      requiredData: ["Credit card balance", "Due date", "Payment account"],
      whyThisMatters: "Late or outstanding revolving debt can create avoidable fees and weaken lender serviceability calculations.",
      evidence: ["$95 due in the next 3 days", "Credit card utilisation is visible in Balance Sheet", "Liability affects borrowing capacity"],
      nextStep: "Open Credit Cards and confirm the minimum payment or full payment has been scheduled.",
      sourceData: ["Balance Sheet credit-card category", "Active alerts", "Borrowing capacity assumptions"],
      monthlySavingsEstimate: 0,
      missingDataBlocker: false,
      source: "Alerts",
    },
    {
      id: "property-concentration",
      priority: "Low",
      category: "Investments",
      title: "Property concentration remains high",
      financialImpact: "Largest wealth driver",
      confidence: "Medium",
      reason: "Property is the largest balance-sheet exposure, which increases concentration risk.",
      recommendedAction: "Review future contributions toward diversified investments.",
      estimatedBenefit: "Improved diversification",
      actionLabel: "Review investments",
      actionHref: "/investments",
      expectedImpact: "Clearer diversification plan",
      timeToComplete: "8-12 min",
      requiredData: ["Asset allocation", "Property values", "Investment balances"],
      whyThisMatters: "A concentrated balance sheet can perform well, but it increases exposure to one asset class and can limit flexibility.",
      evidence: ["Property is the largest wealth driver", "Investments are smaller than property equity", "Diversification health is moderate"],
      nextStep: "Open Investments and compare future contributions against property exposure.",
      sourceData: ["Balance Sheet assets", "Investment allocation", "AI category insight"],
      monthlySavingsEstimate: 0,
      missingDataBlocker: false,
      source: "Balance Sheet",
    },
  ];

  return decisions
    .sort((a, b) => score(b) - score(a))
    .map((decision, index) => ({ ...decision, rank: index + 1 }));
}
