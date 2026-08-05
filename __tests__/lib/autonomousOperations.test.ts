import assert from "node:assert/strict";
import test from "node:test";
import {
  AutonomousOperationsEngine,
  buildAutonomousContext,
  classifyWorkerResult,
  type AutonomousOpportunity,
  type AutonomousTask,
} from "@/lib/autonomousOperations";

test("creates persistent first-class goals with plans and evidence", () => {
  const state = AutonomousOperationsEngine.build({ now: "2026-07-20T09:00:00.000Z" });

  assert.ok(state.goals.length >= 3);
  assert.ok(state.goals.every((goal) => goal.priority && goal.targetDate && goal.evidence.length > 0));
  assert.ok(state.plans.length >= state.goals.length);
  assert.ok(state.plans.every((plan) => plan.editable && plan.resumable && plan.explainable));
});

test("suppresses duplicate opportunities and keeps stable task IDs", () => {
  const duplicateDecision = {
    id: "refinance-mortgage-rate",
    rank: 1,
    priority: "Critical" as const,
    category: "Mortgage",
    title: "Mortgage could be refinanced",
    financialImpact: "$186/mo",
    confidence: "High" as const,
    reason: "Duplicate test",
    recommendedAction: "Review",
    estimatedBenefit: "$2,232/year",
    actionLabel: "Review",
    actionHref: "/balance-sheet/mortgages",
    expectedImpact: "$186 lower monthly repayment",
    timeToComplete: "10 min",
    requiredData: ["Mortgage statement"],
    whyThisMatters: "Debt cost is material.",
    evidence: ["Mortgage evidence"],
    nextStep: "Review options",
    sourceData: ["Balance Sheet"],
    monthlySavingsEstimate: 186,
    missingDataBlocker: false,
    source: "Balance Sheet" as const,
  };
  const state = AutonomousOperationsEngine.build({ decisions: [duplicateDecision, duplicateDecision] });

  assert.equal(state.opportunities.filter((item) => item.sourceId === "refinance-mortgage-rate").length, 1);
  assert.equal(state.supervisor.duplicateSuppressedCount, 1);
});

test("enforces approval policy and blocks financial execution by default", () => {
  const state = AutonomousOperationsEngine.build();
  const refinanceTask = state.tasks.find((task) => task.title.toLowerCase().includes("refinance"));

  assert.ok(refinanceTask);
  assert.equal(refinanceTask.approvalClass, "Execute after approval");
  assert.equal(refinanceTask.approvalRequired, true);
  assert.equal(refinanceTask.canExecuteAutomatically, false);
  assert.equal(state.safety.gptCanModifyFinancialFacts, false);
  assert.equal(state.safety.financialActionsRequireApproval, true);
});

test("classifies worker output and rejects insufficiently approved execution", () => {
  const task: AutonomousTask = {
    id: "task-test",
    opportunityId: "opp-test",
    goalId: "goal-test",
    title: "Request mortgage refinance quote",
    status: "Waiting approval",
    approvalClass: "Execute after approval",
    approvalRequired: true,
    worker: "Debt Optimiser",
    expectedBenefit: "$2,000/year",
    requiredEvidence: ["Mortgage statement"],
    evidence: ["Mortgage statement evidence"],
    verification: ["Evidence check"],
    canExecuteAutomatically: false,
    rejectionReason: null,
    createdAt: "2026-07-20T09:00:00.000Z",
    updatedAt: "2026-07-20T09:00:00.000Z",
  };

  const result = classifyWorkerResult(task);
  assert.equal(result.classification, "Professional review required");
  assert.equal(result.approvedForExecution, false);
  assert.match(result.rejectedReason ?? "", /blocked/i);
});

test("assembles bounded worker context without unrelated payloads", () => {
  const state = AutonomousOperationsEngine.build();
  const context = buildAutonomousContext({
    goals: state.goals,
    tasks: state.tasks,
    decisions: [],
    vault: {
      uploaded_documents: [],
      financial_profile: {
        id: "profile-test",
        incomeMonthly: 0,
        incomeAnnual: 0,
        employmentType: "",
        employerName: "",
        mortgageBalance: 0,
        mortgageRepaymentMonthly: 0,
        interestRate: 0,
        superBalance: 0,
        monthlySpending: 0,
        recurringSubscriptions: 0,
        liabilities: 0,
        assets: 0,
        lastUpdatedAt: "2026-07-20T09:00:00.000Z",
        sources: {},
      },
      borrowing_capacity: {
        profileId: "profile-test",
        estimatedMaxBorrowing: 0,
        estimatedSafeBorrowing: 0,
        monthlyRepaymentAtCurrentRates: 0,
        surplusIncome: 0,
        riskLevel: "low",
        assumptions: [],
        warnings: [],
      },
      refinance_opportunities: [],
      savings_opportunities: [],
      lender_pack: {
        generatedAt: "2026-07-20T09:00:00.000Z",
        borrowerProfile: {
          id: "profile-test",
          incomeMonthly: 0,
          incomeAnnual: 0,
          employmentType: "",
          employerName: "",
          mortgageBalance: 0,
          mortgageRepaymentMonthly: 0,
          interestRate: 0,
          superBalance: 0,
          monthlySpending: 0,
          recurringSubscriptions: 0,
          liabilities: 0,
          assets: 0,
          lastUpdatedAt: "2026-07-20T09:00:00.000Z",
          sources: {},
        },
        incomeSummary: "",
        assetSummary: "",
        liabilitySummary: "",
        cashflowSummary: "",
        mortgageRefinanceSummary: "",
        documentChecklist: [],
        uploadedDocumentIndex: [],
        missingItems: [],
        riskFlags: [],
        assumptions: [],
      },
    },
  });

  assert.ok(context.goalIds.length > 0);
  assert.ok(context.currentTaskIds.length > 0);
  assert.match(context.excludedContextReason, /excluded/i);
});

test("creates supervisor state, event triggers, scheduled reviews and learning metrics", () => {
  const state = AutonomousOperationsEngine.build({
    acceptedRecommendations: 8,
    ignoredRecommendations: 1,
    dismissedRecommendations: 1,
    completedWorkflows: 4,
  });

  assert.ok(["Healthy", "Degraded", "Blocked"].includes(state.supervisor.status));
  assert.ok(state.events.some((event) => event.type === "new-document-uploaded"));
  assert.ok(state.events.some((event) => event.type === "workflow-completed"));
  assert.ok(state.scheduledReviews.some((review) => review.cadence === "Daily"));
  assert.equal(state.learning.acceptedRecommendations, 8);
  assert.ok(state.learning.recommendationQuality > state.learning.falsePositiveRate);
});

test("rejects autonomous mutation-style tasks", () => {
  const opportunity: AutonomousOpportunity = {
    id: "opp-delete-data",
    category: "Financial Vault",
    title: "Delete verified fact",
    expectedBenefit: "Not allowed",
    expectedBenefitAmount: 0,
    confidence: "Low",
    requiredEvidence: ["Verified fact"],
    expiry: null,
    priority: "Critical",
    sourceId: "dangerous-action",
    evidence: ["User request"],
  };
  const state = AutonomousOperationsEngine.build({
    decisions: [{
      id: opportunity.sourceId,
      rank: 1,
      priority: opportunity.priority,
      category: opportunity.category,
      title: opportunity.title,
      financialImpact: "N/A",
      confidence: opportunity.confidence,
      reason: "Dangerous action test",
      recommendedAction: "Do not run",
      estimatedBenefit: opportunity.expectedBenefit,
      actionLabel: "Blocked",
      actionHref: "/financial-vault",
      expectedImpact: "None",
      timeToComplete: "N/A",
      requiredData: opportunity.requiredEvidence,
      whyThisMatters: "Verified facts are protected.",
      evidence: opportunity.evidence,
      nextStep: "Manual review",
      sourceData: ["Financial Vault"],
      monthlySavingsEstimate: 0,
      missingDataBlocker: false,
      source: "Financial Vault",
    }],
  });

  const task = state.tasks.find((item) => item.opportunityId === "opp-dangerous-action");
  assert.ok(task);
  assert.equal(task.approvalClass, "Never autonomous");
  assert.equal(task.canExecuteAutomatically, false);
  assert.match(task.rejectionReason ?? "", /cannot run autonomously/i);
});
