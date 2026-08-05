import { buildAiDecisions, type AiDecision } from "@/lib/aiDecisionCentre";
import { getFinancialBalanceSheet, type FinancialBalanceSheet } from "@/lib/financialBalanceSheet";
import {
  buildDefaultTwinScenarios,
  buildFinancialDigitalTwinFromVault,
  simulateDigitalTwinScenario,
  type FinancialDigitalTwin,
  type TwinSimulationOutput,
} from "@/lib/financialDigitalTwin";
import { createEmptyFinancialVaultState } from "@/lib/financialVaultEmptyState";
import type { FinancialVaultState } from "@/lib/financialVaultTypes";
import { buildDefaultHousingAffordabilityState } from "@/lib/housingAffordabilityState";
import type { HousingAffordabilityState } from "@/lib/housingAffordabilityTypes";
import { MODEL_OUTPUT_SCHEMAS, type ModelTaskRequest } from "@/lib/modelOrchestrator/index";

export type AutonomousGoalType =
  | "Reduce mortgage"
  | "Increase net worth"
  | "Improve cash flow"
  | "Maximise after-tax wealth"
  | "Save for holiday"
  | "Retire earlier"
  | "Buy investment property"
  | "Improve borrowing capacity"
  | "Reduce subscriptions"
  | "Optimise super";

export type AutonomyPriority = "Critical" | "High" | "Medium" | "Low";
export type AutonomyConfidence = "High" | "Medium" | "Low";
export type TaskStatus = "Detected" | "Planned" | "Waiting approval" | "Executing" | "Waiting verification" | "Completed" | "Cancelled" | "Failed";
export type WorkerName =
  | "Financial Analyst"
  | "Tax Analyst"
  | "Property Analyst"
  | "Cash Flow Analyst"
  | "Debt Optimiser"
  | "Investment Analyst"
  | "Document Analyst"
  | "Goal Planner"
  | "Workflow Manager"
  | "Risk Reviewer";
export type VerificationClass = "Deterministic" | "Evidence-backed" | "Calculated" | "Estimated" | "Speculative" | "Professional review required";
export type ApprovalClass = "Inform only" | "Suggest" | "Prepare" | "Execute after approval" | "Fully automatic" | "Never autonomous";

export type AutonomousGoal = {
  id: string;
  type: AutonomousGoalType;
  priority: AutonomyPriority;
  targetValue: number;
  targetDate: string;
  confidence: AutonomyConfidence;
  dependencies: string[];
  blockers: string[];
  currentProgress: number;
  projectedCompletion: string;
  owner: "user" | "vireon" | "professional";
  evidence: string[];
};

export type AutonomousPlan = {
  id: string;
  goalId: string;
  version: number;
  strategy: string;
  milestones: string[];
  tasks: string[];
  verification: string[];
  expectedBenefit: string;
  editable: true;
  resumable: true;
  explainable: true;
  evidence: string[];
};

export type AutonomousOpportunity = {
  id: string;
  category: string;
  title: string;
  expectedBenefit: string;
  expectedBenefitAmount: number;
  confidence: AutonomyConfidence;
  requiredEvidence: string[];
  expiry: string | null;
  priority: AutonomyPriority;
  sourceId: string;
  evidence: string[];
};

export type AutonomousTask = {
  id: string;
  opportunityId: string;
  goalId: string;
  title: string;
  status: TaskStatus;
  approvalClass: ApprovalClass;
  approvalRequired: boolean;
  worker: WorkerName;
  expectedBenefit: string;
  requiredEvidence: string[];
  evidence: string[];
  verification: string[];
  canExecuteAutomatically: boolean;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutonomousWorker = {
  name: WorkerName;
  capability: string;
  active: boolean;
  maxConcurrentTasks: number;
  currentTaskIds: string[];
};

export type WorkerResult = {
  id: string;
  worker: WorkerName;
  taskId: string;
  output: string;
  classification: VerificationClass;
  confidence: AutonomyConfidence;
  evidence: string[];
  approvedForExecution: boolean;
  rejectedReason: string | null;
};

export type SupervisorState = {
  id: string;
  status: "Healthy" | "Degraded" | "Blocked";
  activeWorkerCount: number;
  queuedTaskCount: number;
  waitingApprovalCount: number;
  duplicateSuppressedCount: number;
  retryCount: number;
  staleTaskCount: number;
  loopDetected: boolean;
  finalRecommendations: string[];
};

export type AutonomousContext = {
  goalIds: string[];
  vaultFactIds: string[];
  timelineEventIds: string[];
  currentTaskIds: string[];
  workflowIds: string[];
  previousDecisionIds: string[];
  taxRuleIds: string[];
  evidenceIds: string[];
  recentConversationIds: string[];
  excludedContextReason: string;
};

export type LearningRecord = {
  acceptedRecommendations: number;
  ignoredRecommendations: number;
  dismissedRecommendations: number;
  completedWorkflows: number;
  manualEdits: number;
  goalSuccessRate: number;
  recommendationQuality: number;
  falsePositiveRate: number;
  confidenceCalibration: number;
};

export type ScheduledReview = {
  id: string;
  cadence: "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Annual";
  nextRunAt: string;
  workerNames: WorkerName[];
  createsBriefing: boolean;
  createsTasks: boolean;
};

export type AutonomousEvent = {
  id: string;
  type:
    | "new-document-uploaded"
    | "salary-changed"
    | "mortgage-changed"
    | "bank-transaction-imported"
    | "interest-rates-changed"
    | "goal-added"
    | "tax-year-changed"
    | "super-balance-changed"
    | "property-valuation-changed"
    | "workflow-completed";
  sourceId: string;
  triggeredWorkerNames: WorkerName[];
  reason: string;
};

export type ExecutiveBriefing = {
  topPriority: string;
  financialWins: string[];
  emergingRisks: string[];
  goalProgress: string[];
  recommendedActions: string[];
  waitingApprovals: string[];
  recentAchievements: string[];
  projectedImpact: string;
};

export type AutonomousKnowledgeHealth = {
  score: number;
  missingDocuments: string[];
  staleValuations: string[];
  oldTaxRules: string[];
  missingEvidence: string[];
  conflictingFacts: string[];
  staleAssumptions: string[];
};

export type AutonomousMetrics = {
  tasksCompleted: number;
  approvalRate: number;
  recommendationAcceptance: number;
  goalCompletion: number;
  financialBenefitRealised: number;
  averageConfidence: number;
  aiLatencyMs: number;
  workerUtilisation: number;
  falsePositiveRate: number;
};

export type AutonomousOperationsState = {
  generatedAt: string;
  goals: AutonomousGoal[];
  plans: AutonomousPlan[];
  opportunities: AutonomousOpportunity[];
  tasks: AutonomousTask[];
  workers: AutonomousWorker[];
  workerResults: WorkerResult[];
  supervisor: SupervisorState;
  context: AutonomousContext;
  learning: LearningRecord;
  scheduledReviews: ScheduledReview[];
  events: AutonomousEvent[];
  executiveBriefing: ExecutiveBriefing;
  knowledgeHealth: AutonomousKnowledgeHealth;
  metrics: AutonomousMetrics;
  safety: {
    deterministicEnginesOnly: true;
    gptCanModifyFinancialFacts: false;
    financialActionsRequireApproval: true;
    duplicateSuppressionEnabled: true;
    auditTrailRequired: true;
  };
};

export type AutonomousOperationsInput = {
  now?: string;
  vault?: FinancialVaultState;
  balanceSheet?: FinancialBalanceSheet;
  housing?: HousingAffordabilityState;
  decisions?: AiDecision[];
  twin?: FinancialDigitalTwin;
  simulation?: TwinSimulationOutput;
  acceptedRecommendations?: number;
  ignoredRecommendations?: number;
  dismissedRecommendations?: number;
  completedWorkflows?: number;
};

const confidenceScore: Record<AutonomyConfidence, number> = { High: 0.9, Medium: 0.65, Low: 0.35 };
const priorityScore: Record<AutonomyPriority, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function dateAfter(now: string, days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function goalForDecision(decision: AiDecision): AutonomousGoalType {
  if (decision.category === "Mortgage") return "Reduce mortgage";
  if (decision.category === "Spending" || decision.category === "Subscriptions") return "Reduce subscriptions";
  if (decision.category === "Housing") return "Improve borrowing capacity";
  if (decision.category === "Financial Vault") return "Improve borrowing capacity";
  if (decision.category === "Goals") return "Increase net worth";
  return "Improve cash flow";
}

function workerForOpportunity(category: string): WorkerName {
  if (category === "Mortgage") return "Debt Optimiser";
  if (category === "Tax" || category === "Structure") return "Tax Analyst";
  if (category === "Housing") return "Property Analyst";
  if (category === "Subscriptions" || category === "Spending" || category === "Cash Flow") return "Cash Flow Analyst";
  if (category === "Documents" || category === "Financial Vault") return "Document Analyst";
  if (category === "Investments" || category === "Super") return "Investment Analyst";
  return "Financial Analyst";
}

function approvalClassFor(title: string, category: string): ApprovalClass {
  const normalized = `${title} ${category}`.toLowerCase();
  if (normalized.includes("verified fact") || normalized.includes("delete")) return "Never autonomous";
  if (normalized.includes("refinance") || normalized.includes("email") || normalized.includes("quote") || normalized.includes("accountant")) return "Execute after approval";
  if (normalized.includes("pack") || normalized.includes("summary") || normalized.includes("brief")) return "Prepare";
  if (normalized.includes("review") || normalized.includes("compare")) return "Suggest";
  return "Inform only";
}

function createGoals(input: { decisions: AiDecision[]; vault: FinancialVaultState; balanceSheet: FinancialBalanceSheet; housing: HousingAffordabilityState; now: string }): AutonomousGoal[] {
  const baseGoals: AutonomousGoal[] = [
    {
      id: "goal-improve-borrowing-capacity",
      type: "Improve borrowing capacity",
      priority: input.housing.house_readiness_score.score < 75 ? "High" : "Medium",
      targetValue: 85,
      targetDate: dateAfter(input.now, 180),
      confidence: "High",
      dependencies: ["Financial Vault", "Cash Flow", "Housing"],
      blockers: input.vault.lender_pack.documentChecklist.filter((item) => !item.available).map((item) => item.label),
      currentProgress: input.housing.house_readiness_score.score,
      projectedCompletion: dateAfter(input.now, 120),
      owner: "user",
      evidence: ["Housing readiness score", "Lender pack checklist", "Borrowing capacity model"],
    },
    {
      id: "goal-reduce-mortgage",
      type: "Reduce mortgage",
      priority: input.balanceSheet.refinance.monthlySaving > 150 ? "High" : "Medium",
      targetValue: Math.round(input.balanceSheet.refinance.annualSaving),
      targetDate: dateAfter(input.now, 90),
      confidence: input.balanceSheet.refinance.confidence === "High" ? "High" : "Medium",
      dependencies: ["Mortgage statement", "Debt engine", "Action Workflow"],
      blockers: input.balanceSheet.refinance.monthlySaving > 0 ? ["approval required before external refinance action"] : [],
      currentProgress: 0,
      projectedCompletion: dateAfter(input.now, 60),
      owner: "user",
      evidence: ["Balance Sheet refinance model", "Mortgage rate benchmark"],
    },
    {
      id: "goal-increase-net-worth",
      type: "Increase net worth",
      priority: "Medium",
      targetValue: input.balanceSheet.netWorth + 100_000,
      targetDate: dateAfter(input.now, 365),
      confidence: "Medium",
      dependencies: ["Cash Flow", "Digital Twin", "Goals"],
      blockers: [],
      currentProgress: input.balanceSheet.netWorth,
      projectedCompletion: dateAfter(input.now, 365),
      owner: "vireon",
      evidence: ["Balance Sheet net worth", "Digital Twin projection"],
    },
  ];

  for (const decision of input.decisions.slice(0, 5)) {
    const type = goalForDecision(decision);
    if (baseGoals.some((goal) => goal.type === type)) continue;
    baseGoals.push({
      id: `goal-${decision.id}`,
      type,
      priority: decision.priority,
      targetValue: decision.monthlySavingsEstimate * 12,
      targetDate: dateAfter(input.now, 120),
      confidence: decision.confidence,
      dependencies: decision.sourceData,
      blockers: decision.missingDataBlocker ? decision.requiredData : [],
      currentProgress: 0,
      projectedCompletion: dateAfter(input.now, 120),
      owner: "user",
      evidence: decision.evidence,
    });
  }

  return baseGoals;
}

function scanOpportunities(input: { decisions: AiDecision[]; vault: FinancialVaultState; balanceSheet: FinancialBalanceSheet; now: string }): AutonomousOpportunity[] {
  const opportunities = input.decisions.map((decision) => ({
    id: `opp-${decision.id}`,
    category: decision.category,
    title: decision.title,
    expectedBenefit: decision.estimatedBenefit,
    expectedBenefitAmount: decision.monthlySavingsEstimate * 12,
    confidence: decision.confidence,
    requiredEvidence: decision.requiredData,
    expiry: decision.category === "Mortgage" ? dateAfter(input.now, 30) : null,
    priority: decision.priority,
    sourceId: decision.id,
    evidence: decision.evidence,
  } satisfies AutonomousOpportunity));

  const missingDocs = input.vault.lender_pack.documentChecklist.filter((item) => !item.available);
  for (const doc of missingDocs) {
    opportunities.push({
      id: `opp-missing-doc-${doc.documentType}`,
      category: "Documents",
      title: `Verify ${doc.label}`,
      expectedBenefit: "Improves Vault confidence and borrowing readiness",
      expectedBenefitAmount: 0,
      confidence: "High",
      requiredEvidence: [doc.label],
      expiry: null,
      priority: "High",
      sourceId: `document-${doc.documentType}`,
      evidence: ["Financial Vault lender-pack checklist"],
    });
  }

  return opportunities;
}

function suppressDuplicates(opportunities: AutonomousOpportunity[]) {
  const seen = new Map<string, AutonomousOpportunity>();
  let suppressed = 0;
  for (const opportunity of opportunities) {
    const key = `${opportunity.category}:${opportunity.sourceId}`;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, opportunity);
      continue;
    }
    suppressed += 1;
    const previousScore = priorityScore[previous.priority] + confidenceScore[previous.confidence];
    const nextScore = priorityScore[opportunity.priority] + confidenceScore[opportunity.confidence];
    if (nextScore > previousScore) seen.set(key, opportunity);
  }
  return { opportunities: [...seen.values()], suppressed };
}

function buildPlans(goals: AutonomousGoal[], opportunities: AutonomousOpportunity[]): AutonomousPlan[] {
  return goals.map((goal) => {
    const related = opportunities.filter((opportunity) => goal.dependencies.some((dep) => opportunity.evidence.concat(opportunity.requiredEvidence, opportunity.category).join(" ").includes(dep.split(" ")[0])));
    const tasks = related.slice(0, 3).map((item) => `task-${item.id}`);
    return {
      id: `plan-${goal.id}`,
      goalId: goal.id,
      version: 1,
      strategy: `Prioritise ${goal.type.toLowerCase()} using verified data, deterministic calculations and approval-gated workflows.`,
      milestones: ["Confirm evidence", "Prepare action", "Request approval", "Verify outcome"],
      tasks,
      verification: ["Evidence-backed output", "Before/after snapshot", "Deterministic recalculation"],
      expectedBenefit: goal.targetValue > 0 ? `$${Math.round(goal.targetValue).toLocaleString()} target impact` : "Improved confidence and reduced uncertainty",
      editable: true,
      resumable: true,
      explainable: true,
      evidence: goal.evidence,
    };
  });
}

function createTasks(input: { opportunities: AutonomousOpportunity[]; goals: AutonomousGoal[]; now: string }): AutonomousTask[] {
  return input.opportunities.map((opportunity) => {
    const goal = input.goals.find((item) => item.type === goalForDecision({
      id: opportunity.sourceId,
      rank: 0,
      priority: opportunity.priority,
      category: opportunity.category,
      title: opportunity.title,
      financialImpact: "",
      confidence: opportunity.confidence,
      reason: "",
      recommendedAction: "",
      estimatedBenefit: opportunity.expectedBenefit,
      actionLabel: "",
      actionHref: "",
      expectedImpact: "",
      timeToComplete: "",
      requiredData: opportunity.requiredEvidence,
      whyThisMatters: "",
      evidence: opportunity.evidence,
      nextStep: "",
      sourceData: [],
      monthlySavingsEstimate: 0,
      missingDataBlocker: false,
      source: "Financial Vault",
    })) ?? input.goals[0];
    const approvalClass = approvalClassFor(opportunity.title, opportunity.category);
    const approvalRequired = approvalClass === "Execute after approval" || approvalClass === "Never autonomous";
    return {
      id: `task-${opportunity.id}`,
      opportunityId: opportunity.id,
      goalId: goal.id,
      title: opportunity.title.startsWith("Verify") ? opportunity.title : `Prepare: ${opportunity.title}`,
      status: approvalRequired ? "Waiting approval" : "Planned",
      approvalClass,
      approvalRequired,
      worker: workerForOpportunity(opportunity.category),
      expectedBenefit: opportunity.expectedBenefit,
      requiredEvidence: opportunity.requiredEvidence,
      evidence: opportunity.evidence,
      verification: ["Classify output", "Check evidence", "Require approval before execution", "Verify outcome after action"],
      canExecuteAutomatically: approvalClass === "Inform only" || approvalClass === "Fully automatic",
      rejectionReason: approvalClass === "Never autonomous" ? "This action may modify protected financial records and cannot run autonomously." : null,
      createdAt: input.now,
      updatedAt: input.now,
    };
  });
}

function getWorkers(tasks: AutonomousTask[]): AutonomousWorker[] {
  const workers: AutonomousWorker[] = [
    ["Financial Analyst", "Synthesises financial position and top opportunities"],
    ["Tax Analyst", "Reviews tax-sensitive opportunities and professional-review needs"],
    ["Property Analyst", "Assesses housing, property and borrowing implications"],
    ["Cash Flow Analyst", "Detects spending drift, bills, subscriptions and surplus actions"],
    ["Debt Optimiser", "Reviews mortgage and debt repayment opportunities"],
    ["Investment Analyst", "Reviews portfolio, super and contribution opportunities"],
    ["Document Analyst", "Finds missing, stale and conflicting evidence"],
    ["Goal Planner", "Builds goal-linked strategies and milestones"],
    ["Workflow Manager", "Routes approved work into Action Workflows"],
    ["Risk Reviewer", "Rejects low-evidence, duplicate or unsafe recommendations"],
  ].map(([name, capability]) => ({
    name: name as WorkerName,
    capability,
    active: tasks.some((task) => task.worker === name),
    maxConcurrentTasks: 2,
    currentTaskIds: tasks.filter((task) => task.worker === name).slice(0, 2).map((task) => task.id),
  }));
  return workers;
}

export function buildAutonomousContext(input: { goals: AutonomousGoal[]; tasks: AutonomousTask[]; decisions: AiDecision[]; vault: FinancialVaultState }): AutonomousContext {
  return {
    goalIds: input.goals.map((goal) => goal.id),
    vaultFactIds: Object.keys(input.vault.financial_profile.sources),
    timelineEventIds: ["timeline-latest-position", "timeline-latest-decision"],
    currentTaskIds: input.tasks.map((task) => task.id),
    workflowIds: input.tasks.filter((task) => task.approvalClass !== "Inform only").map((task) => `workflow-candidate-${task.id}`),
    previousDecisionIds: input.decisions.map((decision) => decision.id),
    taxRuleIds: ["ato-individual-tax-rates-2026", "smsf-borrowing-restrictions"],
    evidenceIds: input.tasks.flatMap((task) => task.evidence).slice(0, 12),
    recentConversationIds: ["ai-cfo-latest-grounded-answer"],
    excludedContextReason: "Unrelated documents, stale conversations and non-matching workspaces are excluded before any AI worker receives context.",
  };
}

export function classifyWorkerResult(task: AutonomousTask): WorkerResult {
  const hasEvidence = task.evidence.length > 0;
  const professionalReview = task.approvalClass === "Execute after approval" && /tax|structure|accountant|smsf|refinance/i.test(task.title);
  const classification: VerificationClass = professionalReview
    ? "Professional review required"
    : hasEvidence && task.expectedBenefit.includes("$")
    ? "Calculated"
    : hasEvidence
    ? "Evidence-backed"
    : "Speculative";
  const approvedForExecution = task.canExecuteAutomatically && classification !== "Speculative";
  return {
    id: `worker-result-${task.id}`,
    worker: task.worker,
    taskId: task.id,
    output: approvedForExecution
      ? `${task.worker} prepared a safe autonomous update for ${task.title}.`
      : `${task.worker} prepared a recommendation requiring user review for ${task.title}.`,
    classification,
    confidence: hasEvidence ? "High" : "Low",
    evidence: task.evidence,
    approvedForExecution,
    rejectedReason: approvedForExecution ? null : "Execution is blocked until evidence, approval or professional review requirements are satisfied.",
  };
}

function supervise(input: { tasks: AutonomousTask[]; results: WorkerResult[]; duplicateSuppressedCount: number }): SupervisorState {
  const waitingApprovalCount = input.tasks.filter((task) => task.status === "Waiting approval").length;
  const rejectedCount = input.results.filter((result) => !result.approvedForExecution).length;
  return {
    id: "autonomy-supervisor-current",
    status: rejectedCount > 0 ? "Degraded" : "Healthy",
    activeWorkerCount: new Set(input.tasks.map((task) => task.worker)).size,
    queuedTaskCount: input.tasks.filter((task) => task.status === "Planned").length,
    waitingApprovalCount,
    duplicateSuppressedCount: input.duplicateSuppressedCount,
    retryCount: 0,
    staleTaskCount: 0,
    loopDetected: false,
    finalRecommendations: input.tasks
      .sort((a, b) => Number(b.approvalRequired) - Number(a.approvalRequired))
      .slice(0, 3)
      .map((task) => task.title),
  };
}

function learning(input: AutonomousOperationsInput): LearningRecord {
  const accepted = input.acceptedRecommendations ?? 7;
  const ignored = input.ignoredRecommendations ?? 2;
  const dismissed = input.dismissedRecommendations ?? 1;
  const completed = input.completedWorkflows ?? 3;
  const total = Math.max(1, accepted + ignored + dismissed);
  return {
    acceptedRecommendations: accepted,
    ignoredRecommendations: ignored,
    dismissedRecommendations: dismissed,
    completedWorkflows: completed,
    manualEdits: 1,
    goalSuccessRate: completed / Math.max(1, completed + 1),
    recommendationQuality: accepted / total,
    falsePositiveRate: dismissed / total,
    confidenceCalibration: clamp(0.82 - dismissed * 0.03 + completed * 0.02, 0.1, 0.98),
  };
}

function scheduledReviews(now: string): ScheduledReview[] {
  return [
    { id: "review-daily", cadence: "Daily", nextRunAt: dateAfter(now, 1), workerNames: ["Financial Analyst", "Cash Flow Analyst", "Risk Reviewer"], createsBriefing: true, createsTasks: true },
    { id: "review-weekly", cadence: "Weekly", nextRunAt: dateAfter(now, 7), workerNames: ["Goal Planner", "Workflow Manager", "Investment Analyst"], createsBriefing: true, createsTasks: true },
    { id: "review-quarterly", cadence: "Quarterly", nextRunAt: dateAfter(now, 90), workerNames: ["Tax Analyst", "Property Analyst", "Debt Optimiser"], createsBriefing: true, createsTasks: false },
  ];
}

function events(tasks: AutonomousTask[]): AutonomousEvent[] {
  return [
    {
      id: "event-document-uploaded",
      type: "new-document-uploaded",
      sourceId: "financial-vault",
      triggeredWorkerNames: ["Document Analyst", "Risk Reviewer"],
      reason: "New documents can change confidence, borrowing readiness and task evidence requirements.",
    },
    {
      id: "event-mortgage-changed",
      type: "mortgage-changed",
      sourceId: tasks.find((task) => task.worker === "Debt Optimiser")?.id ?? "mortgage-facts",
      triggeredWorkerNames: ["Debt Optimiser", "Cash Flow Analyst", "Workflow Manager"],
      reason: "Mortgage facts affect cash flow, borrowing and refinance opportunities.",
    },
    {
      id: "event-workflow-completed",
      type: "workflow-completed",
      sourceId: "action-workflows",
      triggeredWorkerNames: ["Workflow Manager", "Goal Planner", "Risk Reviewer"],
      reason: "Completed workflows require outcome verification before realised benefit is learned.",
    },
  ];
}

function knowledgeHealth(vault: FinancialVaultState): AutonomousKnowledgeHealth {
  const missingDocuments = vault.lender_pack.documentChecklist.filter((item) => !item.available).map((item) => item.label);
  const coverage = vault.lender_pack.documentChecklist.length === 0 ? 1 : 1 - missingDocuments.length / vault.lender_pack.documentChecklist.length;
  return {
    score: Math.round(coverage * 100),
    missingDocuments,
    staleValuations: [],
    oldTaxRules: ["Review tax-rule provenance before implementing tax-sensitive structures"],
    missingEvidence: missingDocuments,
    conflictingFacts: [],
    staleAssumptions: ["Market and interest-rate assumptions require periodic review"],
  };
}

function executiveBriefing(input: { tasks: AutonomousTask[]; goals: AutonomousGoal[]; balanceSheet: FinancialBalanceSheet; simulation: TwinSimulationOutput; knowledge: AutonomousKnowledgeHealth }): ExecutiveBriefing {
  const topTask = input.tasks[0];
  const projectedNetWorthChange = input.simulation.netWorth - input.balanceSheet.netWorth;
  return {
    topPriority: topTask?.title ?? "No autonomous task requires attention",
    financialWins: [
      `Net worth is $${Math.round(input.balanceSheet.netWorth).toLocaleString()}`,
      `Emergency runway is ${input.balanceSheet.emergencyFundMonths.toFixed(1)} months`,
    ],
    emergingRisks: input.knowledge.missingDocuments.length > 0 ? [`Missing evidence: ${input.knowledge.missingDocuments[0]}`] : [],
    goalProgress: input.goals.slice(0, 3).map((goal) => `${goal.type}: ${Math.round(goal.currentProgress).toLocaleString()} progress`),
    recommendedActions: input.tasks.slice(0, 3).map((task) => task.title),
    waitingApprovals: input.tasks.filter((task) => task.approvalRequired).map((task) => task.title),
    recentAchievements: ["Workflow outcomes remain separated from checklist completion", "No autonomous financial mutations were attempted"],
    projectedImpact: topTask?.expectedBenefit ?? `$${Math.round(projectedNetWorthChange).toLocaleString()} projected Digital Twin net-worth change`,
  };
}

function metrics(tasks: AutonomousTask[], learningRecord: LearningRecord): AutonomousMetrics {
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const waitingApproval = tasks.filter((task) => task.approvalRequired).length;
  const averageConfidence = tasks.length === 0 ? 0 : tasks.reduce((sum, task) => sum + confidenceScore[task.requiredEvidence.length > 0 ? "High" : "Low"], 0) / tasks.length;
  return {
    tasksCompleted: completed,
    approvalRate: tasks.length === 0 ? 0 : waitingApproval / tasks.length,
    recommendationAcceptance: learningRecord.recommendationQuality,
    goalCompletion: learningRecord.goalSuccessRate,
    financialBenefitRealised: 0,
    averageConfidence,
    aiLatencyMs: 0,
    workerUtilisation: tasks.length / 20,
    falsePositiveRate: learningRecord.falsePositiveRate,
  };
}

function taskTypeForWorker(worker: WorkerName): ModelTaskRequest["taskType"] {
  if (worker === "Goal Planner") return "plan-generation";
  if (worker === "Workflow Manager") return "workflow-planning";
  if (worker === "Risk Reviewer") return "recommendation-critique";
  if (worker === "Document Analyst") return "evidence-mapping";
  if (worker === "Tax Analyst") return "rule-grounding";
  return "financial-synthesis";
}

function schemaForWorker(worker: WorkerName): ModelTaskRequest["outputSchema"] {
  if (worker === "Goal Planner") return MODEL_OUTPUT_SCHEMAS.Plan;
  if (worker === "Workflow Manager") return MODEL_OUTPUT_SCHEMAS.WorkflowProposal;
  if (worker === "Risk Reviewer") return MODEL_OUTPUT_SCHEMAS.RecommendationReview;
  if (worker === "Document Analyst") return MODEL_OUTPUT_SCHEMAS.EvidenceMap;
  return MODEL_OUTPUT_SCHEMAS.FinancialSynthesis;
}

function autonomyLevelForApproval(approvalClass: ApprovalClass): ModelTaskRequest["autonomyLevel"] {
  if (approvalClass === "Fully automatic") return "fully-automatic";
  if (approvalClass === "Execute after approval") return "execute-after-approval";
  if (approvalClass === "Prepare") return "prepare";
  if (approvalClass === "Inform only") return "inform-only";
  return "none";
}

export function createAutonomousWorkerModelTaskRequest(input: {
  task: AutonomousTask;
  context: AutonomousContext;
  userId: string;
  sessionId: string;
  correlationId: string;
  now?: string;
}): ModelTaskRequest {
  const { task, context, userId, sessionId, correlationId } = input;
  const highRisk = task.worker === "Tax Analyst" || task.worker === "Risk Reviewer" || task.approvalRequired;
  return {
    taskId: `autonomous-worker-${task.id}`,
    userId,
    sessionId,
    correlationId,
    taskType: taskTypeForWorker(task.worker),
    purpose: `${task.worker} support for ${task.title}`,
    sensitivity: "financial-sensitive",
    riskLevel: highRisk ? "high" : "medium",
    autonomyLevel: autonomyLevelForApproval(task.approvalClass),
    requiredCapabilities: ["text", "structured-output"],
    preferredCapabilities: highRisk ? ["reasoning"] : [],
    prohibitedProviders: [],
    permittedProviders: null,
    contextReferences: [
      ...context.goalIds.map((goalId) => `goal:${goalId}`),
      ...context.currentTaskIds.map((currentTaskId) => `task:${currentTaskId}`),
      ...context.previousDecisionIds.map((decisionId) => `decision:${decisionId}`),
    ],
    evidenceReferences: task.evidence,
    inputPayload: {
      taskId: task.id,
      worker: task.worker,
      approvalClass: task.approvalClass,
      expectedBenefit: task.expectedBenefit,
      requiredEvidence: task.requiredEvidence,
      verification: task.verification,
      guardrails: {
        canModifyFinancialFacts: false,
        canExecuteProviderNativeTools: false,
        financialActionsRequireApproval: task.approvalRequired,
      },
    },
    outputSchema: schemaForWorker(task.worker),
    maximumCost: 0.2,
    maximumLatencyMs: 15000,
    minimumConfidence: highRisk ? 0.72 : 0.6,
    professionalReviewRequired: task.worker === "Tax Analyst" || task.approvalClass === "Execute after approval",
    deterministicEngineRequired: false,
    fallbackAllowed: !highRisk,
    retryPolicy: { maxAttempts: 2, baseDelayMs: 250, retryableErrors: ["RATE_LIMITED", "TIMEOUT"] },
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export class AutonomousOperationsEngine {
  static build(input: AutonomousOperationsInput = {}): AutonomousOperationsState {
    const now = input.now ?? "2026-07-20T09:00:00.000Z";
    const vault = input.vault ?? createEmptyFinancialVaultState();
    const balanceSheet = input.balanceSheet ?? getFinancialBalanceSheet();
    const housing = input.housing ?? buildDefaultHousingAffordabilityState(vault);
    const decisions = input.decisions ?? buildAiDecisions({ vault, balanceSheet, housing });
    const twin = input.twin ?? buildFinancialDigitalTwinFromVault(vault, now);
    const simulation = input.simulation ?? simulateDigitalTwinScenario(twin, buildDefaultTwinScenarios(twin)[0]);
    const goals = createGoals({ decisions, vault, balanceSheet, housing, now });
    const scanned = scanOpportunities({ decisions, vault, balanceSheet, now });
    const deduped = suppressDuplicates(scanned);
    const plans = buildPlans(goals, deduped.opportunities);
    const tasks = createTasks({ opportunities: deduped.opportunities, goals, now })
      .sort((a, b) => {
        const ao = deduped.opportunities.find((opportunity) => opportunity.id === a.opportunityId);
        const bo = deduped.opportunities.find((opportunity) => opportunity.id === b.opportunityId);
        return (priorityScore[bo?.priority ?? "Low"] + confidenceScore[bo?.confidence ?? "Low"]) - (priorityScore[ao?.priority ?? "Low"] + confidenceScore[ao?.confidence ?? "Low"]);
      });
    const workers = getWorkers(tasks);
    const workerResults = tasks.map((task) => classifyWorkerResult(task));
    const supervisor = supervise({ tasks, results: workerResults, duplicateSuppressedCount: deduped.suppressed });
    const context = buildAutonomousContext({ goals, tasks, decisions, vault });
    const learningRecord = learning(input);
    const knowledge = knowledgeHealth(vault);

    return {
      generatedAt: now,
      goals,
      plans,
      opportunities: deduped.opportunities,
      tasks,
      workers,
      workerResults,
      supervisor,
      context,
      learning: learningRecord,
      scheduledReviews: scheduledReviews(now),
      events: events(tasks),
      executiveBriefing: executiveBriefing({ tasks, goals, balanceSheet, simulation, knowledge }),
      knowledgeHealth: knowledge,
      metrics: metrics(tasks, learningRecord),
      safety: {
        deterministicEnginesOnly: true,
        gptCanModifyFinancialFacts: false,
        financialActionsRequireApproval: true,
        duplicateSuppressionEnabled: true,
        auditTrailRequired: true,
      },
    };
  }
}
