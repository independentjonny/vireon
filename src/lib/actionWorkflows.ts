import type { AiDecision } from "@/lib/aiDecisionCentre";

export type ActionWorkflowStatus =
  | "Draft"
  | "Ready"
  | "Not Started"
  | "In Progress"
  | "Waiting on User"
  | "Waiting on Document"
  | "Waiting on Third Party"
  | "Awaiting Verification"
  | "Ready for Review"
  | "Completed"
  | "Completed with Variance"
  | "Blocked"
  | "Dismissed"
  | "Cancelled"
  | "Reopened";

export type ActionWorkflowStepStatus = "Not Started" | "In Progress" | "Completed" | "Blocked" | "Skipped";
export type OutcomeVerificationStatus = "Not Required" | "Not Started" | "Evidence Pending" | "Verification Pending" | "Verified" | "Partially Verified" | "Not Achieved" | "Inconclusive" | "Expired";
export type WorkflowStepType = "review" | "data-entry" | "document-upload" | "deterministic-calculation" | "scenario-comparison" | "decision" | "approval" | "professional-consultation" | "communication" | "external-action" | "waiting-period" | "outcome-verification";
export type WorkflowEvidenceStatus = "Unverified" | "Verified" | "Rejected" | "Superseded" | "Inconclusive";
export type WorkflowEvidenceType =
  | "uploaded document"
  | "verified Vault fact"
  | "transaction pattern"
  | "lender confirmation"
  | "provider confirmation"
  | "adviser document"
  | "signed agreement"
  | "statement"
  | "repayment history"
  | "contribution record"
  | "user attestation"
  | "system calculation"
  | "document"
  | "transaction"
  | "fact"
  | "professional-note"
  | "external-confirmation"
  | "calculation-snapshot";

export type ActionWorkflowStep = {
  id: string;
  title: string;
  description: string;
  type?: WorkflowStepType;
  status: ActionWorkflowStepStatus;
  order?: number;
  required?: boolean;
  owner: "user" | "vireon" | "professional";
  dueDate?: string | null;
  estimatedMinutes: number;
  blockedReason?: string | null;
  prerequisites?: string[];
  requiredInputs?: string[];
  requiredDocuments?: string[];
  requiredEvidence?: string[];
  generatedArtefacts?: string[];
  evidenceRequirements?: string[];
  requiredData: string[];
  evidence: string[];
  actionHref: string;
  professionalReviewRequired: boolean;
  completedAt: string | null;
  validationRules?: string[];
};

export type ActionWorkflowAuditEvent = {
  id: string;
  at: string;
  eventType: "created" | "step-started" | "step-completed" | "status-changed" | "blocked" | "dismissed" | "evidence-added" | "evidence-rejected" | "deterministic-calculation" | "artefact-generated" | "professional-review-recorded" | "outcome-verification" | "workflow-reopened" | "cancelled";
  summary: string;
  immutable?: boolean;
  supersedesEventId?: string | null;
};

export type WorkflowEvidence = {
  id: string;
  workflowId: string;
  stepId: string | null;
  type: WorkflowEvidenceType;
  source: string;
  documentId: string | null;
  factId: string | null;
  transactionId: string | null;
  uploadedAt: string | null;
  capturedAt: string;
  effectiveDate: string | null;
  verifiedAt: string | null;
  confidence: "High" | "Medium" | "Low";
  verificationStatus: WorkflowEvidenceStatus;
  notes: string;
  immutable: boolean;
  satisfiesRequirementIds: string[];
  supersedesEvidenceId: string | null;
};

export type WorkflowEvidenceInput = Omit<
  WorkflowEvidence,
  "id" | "workflowId" | "stepId" | "capturedAt" | "immutable" | "transactionId" | "verificationStatus" | "supersedesEvidenceId"
> &
  Partial<Pick<WorkflowEvidence, "workflowId" | "stepId" | "transactionId" | "verificationStatus" | "supersedesEvidenceId">>;

export type WorkflowArtefact = {
  id: string;
  type: "mortgage-review-brief" | "accountant-structure-review-pack" | "broker-information-pack" | "spending-reduction-plan" | "cancellation-checklist" | "adviser-question-list" | "scenario-comparison-report" | "financial-vault-missing-information-request" | "retirement-improvement-plan" | "workflow-completion-report" | "outcome-verification-report";
  title: string;
  format: "json" | "html";
  createdAt: string;
  calculationSnapshotId: string;
  evidenceIds: string[];
  disclaimer: string;
  status: "Current" | "Superseded" | "Draft";
  supersededBy: string | null;
  version: string;
  content: string;
};

export type WorkflowCommunication = {
  id: string;
  type: "lender-negotiation" | "broker-enquiry" | "accountant-briefing" | "adviser-appointment-note" | "provider-cancellation" | "document-request";
  title: string;
  draftBody: string;
  status: "Draft" | "Sent Externally" | "Superseded";
  createdAt: string;
  workflowId: string;
  disclaimer: string;
};

export type OutcomeVerification = {
  id: string;
  workflowId: string;
  metric: string;
  baselineValue: number;
  expectedValue: number;
  actualValue: number | null;
  tolerance: number;
  expectedEffectiveDate: string;
  comparisonDate: string;
  verificationMethod: "document-evidence" | "transaction-history" | "verified-fact" | "professional-evidence" | "calculation-snapshot";
  evidenceIds: string[];
  result: OutcomeVerificationStatus;
  variance: number | null;
  confidence: "High" | "Medium" | "Low";
  explanation: string;
  recalculationRequired: boolean;
  completedAt: string | null;
};

export type WorkflowTemplate = {
  id: string;
  version: string;
  title: string;
  category: string;
  eligibility: string[];
  requiredDeterministicCalculations: string[];
  requiredInputs: string[];
  steps: Array<Pick<ActionWorkflowStep, "id" | "title" | "description" | "type" | "owner" | "requiredData" | "professionalReviewRequired">>;
  evidenceRequirements: string[];
  professionalReviewPoints: string[];
  generatedArtefacts: WorkflowArtefact["type"][];
  expectedOutcomes: string[];
  verificationRules: string[];
  automaticClosureRules: string[];
  reopeningConditions: string[];
};

export type ActionWorkflowExecution = {
  id: string;
  workflowDefinitionId: string;
  workflowVersion: string;
  templateVersion: string;
  sourceDecisionId: string | null;
  sourceDailyReviewFindingId: string | null;
  sourceAiCfoQuestionId: string | null;
  sourceScenarioId: string | null;
  title: string;
  objective: string;
  category: string;
  executionStatus: ActionWorkflowStatus;
  status: ActionWorkflowStatus;
  outcomeStatus: OutcomeVerificationStatus;
  priority: AiDecision["priority"];
  owner: "user" | "vireon" | "professional";
  createdAt: string;
  startedAt: string | null;
  targetCompletionDate: string | null;
  completedAt: string | null;
  verificationDueAt: string | null;
  verifiedAt: string | null;
  reopenedAt: string | null;
  lastUpdatedAt: string;
  expectedImpact: string;
  realisedImpact: string | null;
  impactVariance: string | null;
  confidence: AiDecision["confidence"];
  professionalReviewRequired: boolean;
  steps: ActionWorkflowStep[];
  dependencies: string[];
  blockers: string[];
  evidence: WorkflowEvidence[];
  artefacts: WorkflowArtefact[];
  communications: WorkflowCommunication[];
  milestones: string[];
  calculationSnapshotId: string;
  baselineSnapshotId: string;
  completionSnapshotId: string | null;
  verificationSnapshotId: string | null;
  currentStepId: string | null;
  nextBestAction: { label: string; href: string; reason: string };
  outcomeVerifications: OutcomeVerification[];
  outcomeChecks: OutcomeVerification[];
  affectedEngines: string[];
  decisionUpdateStatus: "Not Started" | "In Progress" | "Needs Attention" | "Awaiting Outcome" | "Completed" | "Reopened" | "Review Required";
  dailyReviewDeduplicationKeys: string[];
  timelineEventIds: string[];
  auditEvents: ActionWorkflowAuditEvent[];
};

export type ActionWorkflow = {
  id: string;
  sourceDecisionId: string;
  title: string;
  category: string;
  objective: string;
  priority: AiDecision["priority"];
  financialImpact: string;
  verifiedFinancialImpact: string | null;
  confidence: AiDecision["confidence"];
  status: ActionWorkflowStatus;
  outcomeStatus: OutcomeVerificationStatus | null;
  progress: number;
  nextActionLabel: string;
  nextActionHref: string;
  timeToComplete: string;
  requiredData: string[];
  blockers: string[];
  evidence: string[];
  assumptions: string[];
  professionalReviewRequired: boolean;
  professionalReviewReasons: string[];
  outputs: string[];
  steps: ActionWorkflowStep[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  dismissedAt: string | null;
  auditTrail: ActionWorkflowAuditEvent[];
};

export type ActionWorkflowSummary = {
  total: number;
  active: number;
  waitingOnUser: number;
  waitingOnDocument: number;
  completed: number;
  blocked: number;
  estimatedMonthlySavings: number;
};

export type WorkflowTransitionResult = {
  workflow: ActionWorkflow;
  changed: boolean;
};

const REVIEW_REQUIRED_CATEGORIES = new Set(["Mortgage", "Tax", "Ownership Structure", "Investments", "Housing"]);
const TEMPLATE_VERSION = "workflow-execution-v1.0";
const EDUCATIONAL_DISCLAIMER = "Educational execution planning only. Vireon calculations are not formal tax, legal, lending or financial advice. Obtain appropriate professional advice before acting.";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function nowIso(now = "2026-07-18T08:00:00.000Z"): string {
  return now;
}

function createAudit(eventType: ActionWorkflowAuditEvent["eventType"], summary: string, now: string): ActionWorkflowAuditEvent {
  return {
    id: `audit-${slug(eventType)}-${now.replace(/[^0-9]/g, "").slice(0, 14)}`,
    at: now,
    eventType,
    summary,
    immutable: true,
    supersedesEventId: null,
  };
}

function templateStep(
  id: string,
  title: string,
  description: string,
  type: WorkflowStepType,
  owner: ActionWorkflowStep["owner"],
  requiredData: string[] = [],
  professionalReviewRequired = false
): WorkflowTemplate["steps"][number] {
  return { id, title, description, type, owner, requiredData, professionalReviewRequired };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "mortgage-refinance",
    version: TEMPLATE_VERSION,
    title: "Mortgage refinance",
    category: "Mortgage",
    eligibility: ["Decision relates to mortgage refinance or lender negotiation", "Current loan facts are present or requested"],
    requiredDeterministicCalculations: ["current effective interest cost", "indicative refinance benefit", "switching-cost break-even", "cash flow", "borrowing", "housing", "retirement"],
    requiredInputs: ["loan balance", "interest rate", "repayment", "fees", "loan statement"],
    steps: [
      templateStep("confirm-current-loan-facts", "Confirm current loan facts", "Verify balance, rate, repayment and offset assumptions.", "review", "user", ["Current mortgage balance", "Interest rate", "Monthly repayment"]),
      templateStep("validate-loan-statement-freshness", "Validate loan statement freshness", "Confirm the uploaded loan statement is recent enough for modelling.", "document-upload", "user", ["Loan statement"]),
      templateStep("calculate-current-interest-cost", "Calculate current effective interest cost", "Run deterministic current-loan cost calculation.", "deterministic-calculation", "vireon", ["Loan facts"]),
      templateStep("calculate-refinance-benefit", "Calculate indicative refinance benefit", "Run refinance benefit and break-even calculation.", "deterministic-calculation", "vireon", ["Benchmark rate", "Switching costs"]),
      templateStep("confirm-switching-costs", "Confirm switching costs and break costs", "Record lender fees, discharge fees and fixed-rate break costs.", "data-entry", "user", ["Switching fees"]),
      templateStep("compare-options", "Compare loan options", "Compare retain current loan, refinance at modelled rate, and negotiate with current lender.", "scenario-comparison", "vireon", ["Modelled rate"]),
      templateStep("generate-mortgage-review-brief", "Generate mortgage review brief", "Produce a structured review brief for lender or broker discussion.", "communication", "vireon", ["Calculation snapshot"]),
      templateStep("record-lender-response", "Record lender or broker response", "Capture lender or broker reply as external evidence.", "communication", "user", ["Lender response"], true),
      templateStep("record-approved-terms", "Record approved rate, fees and loan terms", "Enter approved rate, repayment, fees and loan start date.", "data-entry", "user", ["Approved terms"], true),
      templateStep("upload-new-loan-evidence", "Upload or verify new loan evidence", "Attach statement or approval evidence before outcome verification.", "document-upload", "user", ["New loan evidence"]),
      templateStep("recalculate-affected-engines", "Recalculate affected engines", "Rerun debt, cash flow, borrowing, housing and retirement.", "deterministic-calculation", "vireon", ["Post-action evidence"]),
      templateStep("verify-realised-savings", "Verify realised monthly and annual savings", "Compare expected savings with verified repayment pattern or new loan evidence.", "outcome-verification", "vireon", ["Verified repayment evidence"]),
    ],
    evidenceRequirements: ["loan statement", "lender response", "approved rate and fee evidence", "post-action repayment pattern"],
    professionalReviewPoints: ["broker or lender review", "break costs", "serviceability"],
    generatedArtefacts: ["mortgage-review-brief", "broker-information-pack", "outcome-verification-report"],
    expectedOutcomes: ["monthly repayment reduction", "annual saving", "payback period"],
    verificationRules: ["Savings remain unverified until new loan evidence or verified repayment pattern supports them"],
    automaticClosureRules: ["All required steps complete and outcome verification is Verified or Partially Verified"],
    reopeningConditions: ["actual repayment differs beyond tolerance", "fees exceed modelled fees", "recalculation fails"],
  },
  {
    id: "reduce-recurring-spending",
    version: TEMPLATE_VERSION,
    title: "Reduce recurring spending",
    category: "Subscriptions",
    eligibility: ["Decision relates to subscription, recurring expense or spending reduction"],
    requiredDeterministicCalculations: ["merchant recurrence", "baseline spend", "double-counting prevention", "realised monthly saving"],
    requiredInputs: ["target saving", "merchant list", "effective dates"],
    steps: [
      templateStep("select-target-saving", "Select target savings amount", "Confirm the monthly saving target to pursue.", "data-entry", "user", ["Target savings amount"]),
      templateStep("identify-expenses", "Identify candidate expenses", "Rank discretionary, essential and contractual expenses.", "review", "vireon", ["Transactions"]),
      templateStep("separate-spend-types", "Separate spending types", "Prevent essential or contractual expenses being treated as easy savings.", "deterministic-calculation", "vireon", ["Expense categories"]),
      templateStep("approve-reductions", "Approve selected reductions", "Choose cancellations, downgrades or negotiation targets.", "approval", "user", ["Approved merchants"]),
      templateStep("create-provider-actions", "Create provider actions", "Prepare cancellation, downgrade or negotiation actions.", "communication", "vireon", ["Provider details"]),
      templateStep("track-effective-dates", "Track expected effective dates", "Record when the change should show in transaction data.", "waiting-period", "vireon", ["Expected effective date"]),
      templateStep("observe-subsequent-transactions", "Observe subsequent transactions", "Wait for the next billing period and check charges.", "outcome-verification", "vireon", ["Transaction history"]),
      templateStep("calculate-realised-savings", "Calculate realised monthly savings", "Compare expected saving with verified lower or absent charges.", "deterministic-calculation", "vireon", ["Post-action transactions"]),
    ],
    evidenceRequirements: ["cancellation evidence", "provider confirmation", "no subsequent charge", "lower verified charge"],
    professionalReviewPoints: [],
    generatedArtefacts: ["spending-reduction-plan", "cancellation-checklist", "outcome-verification-report"],
    expectedOutcomes: ["reduced recurring monthly spend"],
    verificationRules: ["User clicking cancelled is not sufficient verification"],
    automaticClosureRules: ["No subsequent charge or lower verified charge after expected period"],
    reopeningConditions: ["charge reappears", "saving falls below tolerance"],
  },
  {
    id: "complete-financial-vault",
    version: TEMPLATE_VERSION,
    title: "Complete missing Financial Vault information",
    category: "Financial Vault",
    eligibility: ["Decision has missing data blocker or stale document requirement"],
    requiredDeterministicCalculations: ["missing fact ranking", "confidence score", "affected engine map"],
    requiredInputs: ["missing fact list", "required documents"],
    steps: [
      templateStep("identify-missing-facts", "Identify missing facts", "Rank missing facts by decision impact.", "review", "vireon", ["Missing facts"]),
      templateStep("request-necessary-documents", "Request only necessary documents", "Ask for the minimum documents needed to unblock decisions.", "document-upload", "user", ["Required documents"]),
      templateStep("detect-document-type", "Detect uploaded document type", "Classify uploaded document before extracting proposed facts.", "deterministic-calculation", "vireon", ["Uploaded document"]),
      templateStep("present-conflicts", "Present conflicts", "Show conflicts between extracted values and existing verified facts.", "review", "user", ["Extracted facts"]),
      templateStep("confirm-updates", "Confirm accepted updates", "Accept only equal-or-higher confidence updates.", "approval", "user", ["Proposed facts"]),
      templateStep("rerun-affected-calculations", "Rerun affected calculations", "Rerun decisions impacted by the new verified facts.", "deterministic-calculation", "vireon", ["Accepted facts"]),
    ],
    evidenceRequirements: ["uploaded document", "extracted facts", "conflict resolution"],
    professionalReviewPoints: [],
    generatedArtefacts: ["financial-vault-missing-information-request", "workflow-completion-report"],
    expectedOutcomes: ["fewer missing facts", "higher knowledge health"],
    verificationRules: ["Do not overwrite verified facts with lower-confidence values"],
    automaticClosureRules: ["Required facts verified and affected calculations rerun"],
    reopeningConditions: ["document confidence drops", "conflicting value appears"],
  },
  {
    id: "investment-structure-professional-review",
    version: TEMPLATE_VERSION,
    title: "Investment structure professional review",
    category: "Tax",
    eligibility: ["Decision or question touches tax structures, estate planning, asset protection, SMSF, lender policy or regulated advice"],
    requiredDeterministicCalculations: ["structure lifecycle comparison", "rule freshness", "scenario sensitivity"],
    requiredInputs: ["structure scenarios", "tax rule evidence", "unresolved questions"],
    steps: [
      templateStep("generate-adviser-brief", "Generate adviser brief", "Separate deterministic findings from assumptions and include rule provenance.", "communication", "vireon", ["Rule provenance"], true),
      templateStep("record-appointment", "Track appointment date", "Record adviser type, date and purpose.", "data-entry", "user", ["Appointment date"], true),
      templateStep("record-adviser-conclusion", "Record adviser conclusion", "Capture conclusion as external evidence without treating it as independently verified.", "professional-consultation", "professional", ["Adviser conclusion"], true),
      templateStep("accept-supported-changes", "Accept supported changes", "Only accept changes supported by documentation or explicit user confirmation.", "approval", "user", ["Supporting documents"], true),
      templateStep("recalculate-structure-scenarios", "Recalculate affected scenarios", "Rerun structure, tax, cash flow and estate assumptions.", "deterministic-calculation", "vireon", ["Accepted changes"], true),
    ],
    evidenceRequirements: ["adviser notes", "supporting documentation", "rule provenance"],
    professionalReviewPoints: ["tax", "legal ownership", "estate planning", "SMSF", "lender policy"],
    generatedArtefacts: ["accountant-structure-review-pack", "adviser-question-list", "scenario-comparison-report"],
    expectedOutcomes: ["reviewed structure assumptions", "updated lifecycle result"],
    verificationRules: ["Professional review completion does not mean Vireon endorses the advice"],
    automaticClosureRules: ["adviser evidence recorded and affected calculations rerun"],
    reopeningConditions: ["new rule stale warning", "unresolved legal or tax item remains"],
  },
  {
    id: "increase-investment-contributions",
    version: TEMPLATE_VERSION,
    title: "Increase monthly investment contributions",
    category: "Investments",
    eligibility: ["Decision recommends investing or contribution increase"],
    requiredDeterministicCalculations: ["cash flow capacity", "investment projection", "goal impact", "retirement impact"],
    requiredInputs: ["planned monthly amount", "cash buffer", "risk tolerance"],
    steps: [templateStep("confirm-monthly-capacity", "Confirm monthly capacity", "Check surplus and cash buffer before increasing contributions.", "review", "user"), templateStep("model-contribution", "Model contribution scenario", "Rerun Digital Twin with proposed contribution.", "scenario-comparison", "vireon"), templateStep("observe-contribution", "Verify observed contribution", "Check transaction history for the planned contribution.", "outcome-verification", "vireon")],
    evidenceRequirements: ["observed contribution transaction"],
    professionalReviewPoints: ["financial product advice where applicable"],
    generatedArtefacts: ["scenario-comparison-report"],
    expectedOutcomes: ["observed monthly contribution", "portfolio projection change"],
    verificationRules: ["planned amount must be observed in transactions"],
    automaticClosureRules: ["contribution observed within tolerance"],
    reopeningConditions: ["missed contributions"],
  },
  {
    id: "improve-housing-readiness",
    version: TEMPLATE_VERSION,
    title: "Improve housing readiness",
    category: "Housing",
    eligibility: ["Decision relates to housing readiness or borrowing capacity"],
    requiredDeterministicCalculations: ["borrowing", "deposit gap", "repayment stress", "cash flow"],
    requiredInputs: ["target property", "deposit", "income", "liabilities"],
    steps: [templateStep("review-readiness-blockers", "Review readiness blockers", "Identify deposit, serviceability, document or spending blockers.", "review", "vireon"), templateStep("choose-readiness-action", "Choose readiness action", "Select the highest impact action.", "decision", "user"), templateStep("rerun-housing-scenario", "Rerun housing scenario", "Recalculate readiness after accepted changes.", "deterministic-calculation", "vireon")],
    evidenceRequirements: ["updated housing scenario"],
    professionalReviewPoints: ["lender policy"],
    generatedArtefacts: ["scenario-comparison-report", "broker-information-pack"],
    expectedOutcomes: ["housing readiness score improvement"],
    verificationRules: ["readiness improvement must come from recalculated scenario"],
    automaticClosureRules: ["target readiness threshold met or blockers resolved"],
    reopeningConditions: ["capacity declines", "deposit gap widens"],
  },
  {
    id: "retirement-plan-improvement",
    version: TEMPLATE_VERSION,
    title: "Retirement plan improvement",
    category: "Retirement",
    eligibility: ["Decision relates to retirement confidence or retirement date"],
    requiredDeterministicCalculations: ["retirement projection", "super projection", "cash flow", "tax assumptions"],
    requiredInputs: ["retirement age", "contribution amount", "spending assumption"],
    steps: [templateStep("review-retirement-gap", "Review retirement gap", "Identify the assumption or contribution gap.", "review", "vireon"), templateStep("model-plan-change", "Model plan change", "Compare current and improved retirement scenario.", "scenario-comparison", "vireon"), templateStep("verify-plan-update", "Verify plan update", "Confirm observed contribution or accepted scenario change.", "outcome-verification", "vireon")],
    evidenceRequirements: ["scenario snapshot", "contribution evidence where applicable"],
    professionalReviewPoints: ["licensed advice where product choice is involved"],
    generatedArtefacts: ["retirement-improvement-plan", "scenario-comparison-report"],
    expectedOutcomes: ["retirement score improvement"],
    verificationRules: ["score change must come from deterministic recalculation"],
    automaticClosureRules: ["retirement confidence improves within tolerance"],
    reopeningConditions: ["projection drifts below threshold"],
  },
  {
    id: "upload-reconcile-tax-documents",
    version: TEMPLATE_VERSION,
    title: "Upload and reconcile tax documents",
    category: "Tax",
    eligibility: ["Decision references missing tax records or stale tax documents"],
    requiredDeterministicCalculations: ["document extraction", "tax evidence coverage", "rule freshness"],
    requiredInputs: ["tax return", "income statement", "deductions"],
    steps: [templateStep("upload-tax-documents", "Upload tax documents", "Upload current tax return and income statement.", "document-upload", "user", ["Tax documents"], true), templateStep("reconcile-tax-facts", "Reconcile tax facts", "Compare extracted facts with existing Vault facts.", "review", "user", ["Extracted tax facts"], true), templateStep("rerun-tax-dependent-engines", "Rerun tax-dependent engines", "Rerun structure, cash flow and borrowing assumptions.", "deterministic-calculation", "vireon", ["Accepted tax facts"], true)],
    evidenceRequirements: ["tax return", "income statement", "reconciled tax facts"],
    professionalReviewPoints: ["registered tax agent review"],
    generatedArtefacts: ["financial-vault-missing-information-request", "accountant-structure-review-pack"],
    expectedOutcomes: ["improved tax evidence coverage"],
    verificationRules: ["tax fact updates require accepted evidence"],
    automaticClosureRules: ["tax documents verified and engines rerun"],
    reopeningConditions: ["conflict appears", "rule becomes stale"],
  },
  {
    id: "review-insurance-coverage",
    version: TEMPLATE_VERSION,
    title: "Review insurance coverage",
    category: "Insurance",
    eligibility: ["Decision relates to insurance cost, renewal or coverage"],
    requiredDeterministicCalculations: ["coverage gap", "premium comparison", "cash-flow impact"],
    requiredInputs: ["policy schedule", "premium", "renewal date"],
    steps: [templateStep("review-policy", "Review policy", "Confirm cover, premium and renewal date.", "review", "user"), templateStep("compare-premium", "Compare premium", "Compare current premium against modelled alternatives.", "deterministic-calculation", "vireon"), templateStep("verify-new-policy", "Verify new policy or premium", "Attach updated policy or verified lower charge.", "outcome-verification", "vireon")],
    evidenceRequirements: ["policy schedule", "premium transaction"],
    professionalReviewPoints: ["licensed advice if product recommendation is needed"],
    generatedArtefacts: ["workflow-completion-report"],
    expectedOutcomes: ["coverage clarity or premium reduction"],
    verificationRules: ["new premium must be supported by policy or transaction evidence"],
    automaticClosureRules: ["policy evidence verified"],
    reopeningConditions: ["renewal changes premium", "coverage conflict appears"],
  },
  {
    id: "resolve-transaction-document-conflict",
    version: TEMPLATE_VERSION,
    title: "Resolve transaction or document conflict",
    category: "Financial Vault",
    eligibility: ["Vault facts conflict across transaction, document or manual source"],
    requiredDeterministicCalculations: ["source confidence comparison", "conflict detection", "affected engine map"],
    requiredInputs: ["conflicting facts", "source documents"],
    steps: [templateStep("review-conflict", "Review conflict", "Inspect conflicting values and source confidence.", "review", "user"), templateStep("choose-source", "Choose accepted source", "Accept the higher-confidence source or request more evidence.", "approval", "user"), templateStep("rerun-affected-engines", "Rerun affected engines", "Recalculate decisions affected by the corrected fact.", "deterministic-calculation", "vireon")],
    evidenceRequirements: ["source comparison", "accepted source"],
    professionalReviewPoints: [],
    generatedArtefacts: ["workflow-completion-report"],
    expectedOutcomes: ["resolved conflict", "higher confidence"],
    verificationRules: ["lower-confidence evidence cannot overwrite verified Vault fact"],
    automaticClosureRules: ["conflict resolved and engines rerun"],
    reopeningConditions: ["new conflict appears"],
  },
];

function workflowTitle(decision: AiDecision): string {
  if (decision.id.includes("refinance")) return "Refinancing Wizard";
  if (decision.id.includes("missing-document")) return "Complete My Financial Profile";
  if (decision.category === "Subscriptions") return "Reduce Monthly Spending";
  if (decision.category === "Cash Flow") return "Allocate Monthly Surplus";
  if (decision.category === "Alerts") return "Resolve Time-Sensitive Alert";
  if (decision.category === "Goals") return "Improve Goal Progress";
  if (decision.category === "Housing") return "Run Housing Readiness Plan";
  return decision.actionLabel;
}

function professionalReasons(decision: AiDecision): string[] {
  const reasons: string[] = [];
  if (decision.category === "Mortgage" || decision.source === "Balance Sheet") reasons.push("Lender policy and switching costs should be reviewed before acting.");
  if (decision.category === "Housing") reasons.push("Borrowing capacity is an estimate, not lender approval.");
  if (decision.category === "Investments") reasons.push("Investment product decisions may require licensed financial advice.");
  if (decision.category.toLowerCase().includes("tax") || decision.category.toLowerCase().includes("structure")) reasons.push("Tax and legal structure decisions require professional review.");
  return reasons;
}

function baseSteps(decision: AiDecision): ActionWorkflowStep[] {
  const evidence = decision.evidence;
  if (decision.id.includes("refinance")) {
    return [
      step("verify-loan", "Verify current loan facts", "Confirm balance, rate, repayment, offset balance and fixed-rate constraints.", "user", 5, decision.requiredData, evidence, "/balance-sheet/mortgages"),
      step("compare-options", "Compare refinance options", "Use deterministic refinance assumptions to compare repayment, fees and break-even.", "vireon", 4, ["Benchmark rate", "Switching fees"], evidence, "/balance-sheet/mortgages"),
      step("prepare-lender-pack", "Prepare lender pack", "Gather payslip, loan statement, ID and current liabilities for broker or lender review.", "user", 10, ["Payslip", "Loan statement", "Liabilities"], evidence, "/financial-vault"),
      step("professional-review", "Review with broker", "Confirm lender policy, serviceability and switching costs before submitting.", "professional", 15, ["Lender options", "Serviceability estimate"], evidence, "/housing-scenarios", true),
    ];
  }
  if (decision.id.includes("missing-document")) {
    return [
      step("identify-document", "Identify required document", "Confirm which missing document is blocking the Financial Vault profile.", "vireon", 2, decision.requiredData, evidence, "/financial-vault"),
      step("upload-document", "Upload document", "Add the current document to the Financial Vault without changing verified values manually.", "user", 4, decision.requiredData, evidence, "/financial-vault"),
      step("verify-extraction", "Verify extracted facts", "Check confidence, dates and values before the document updates downstream engines.", "user", 5, ["Extracted values", "Document confidence"], evidence, "/financial-vault"),
    ];
  }
  if (decision.category === "Subscriptions" || decision.category === "Spending") {
    return [
      step("review-merchants", "Review recurring merchants", "Open the relevant merchants and confirm whether each cost is still needed.", "user", 5, ["Recurring merchants"], evidence, decision.actionHref),
      step("choose-cancellations", "Select costs to remove", "Mark subscriptions or merchants for cancellation, downgrade or weekly cap.", "user", 6, ["Merchant list", "Renewal dates"], evidence, decision.actionHref),
      step("track-cash-flow", "Track recovered cash flow", "Monitor the next review for lower recurring spend and updated goal impact.", "vireon", 3, ["Next cash-flow snapshot"], evidence, "/ai-cfo/daily-review"),
    ];
  }
  if (decision.category === "Cash Flow" || decision.category === "Goals") {
    return [
      step("confirm-surplus", "Confirm available surplus", "Review current surplus and ensure the amount is repeatable.", "user", 4, ["Income", "Expenses", "Goal contribution"], evidence, "/cash-flow"),
      step("assign-contribution", "Assign contribution", "Move the chosen amount to the target goal, offset account or debt action.", "user", 4, decision.requiredData, evidence, decision.actionHref),
      step("monitor-goal", "Monitor goal impact", "Check the next Daily Review for progress, slippage or competing-goal conflict.", "vireon", 2, ["Goal snapshot"], evidence, "/ai-cfo/daily-review"),
    ];
  }
  return [
    step("review-evidence", "Review evidence", "Check the facts Vireon used before starting the action.", "user", 4, decision.requiredData, evidence, decision.actionHref),
    step("complete-action", decision.actionLabel, decision.nextStep, "user", 8, decision.requiredData, evidence, decision.actionHref),
    step("confirm-outcome", "Confirm outcome", "Mark the decision actioned once the result is visible in the Financial Vault or next review.", "user", 3, ["Updated evidence"], evidence, "/insights"),
  ];
}

function templateForDecision(decision: AiDecision): WorkflowTemplate {
  if (decision.id.includes("refinance")) return WORKFLOW_TEMPLATES.find((item) => item.id === "mortgage-refinance")!;
  if (decision.id.includes("missing-document")) return WORKFLOW_TEMPLATES.find((item) => item.id === "complete-financial-vault")!;
  if (decision.category === "Subscriptions" || decision.category === "Spending") return WORKFLOW_TEMPLATES.find((item) => item.id === "reduce-recurring-spending")!;
  if (decision.category === "Investments") return WORKFLOW_TEMPLATES.find((item) => item.id === "increase-investment-contributions")!;
  if (decision.category === "Housing") return WORKFLOW_TEMPLATES.find((item) => item.id === "improve-housing-readiness")!;
  if (decision.category === "Retirement") return WORKFLOW_TEMPLATES.find((item) => item.id === "retirement-plan-improvement")!;
  if (decision.category === "Tax") return WORKFLOW_TEMPLATES.find((item) => item.id === "upload-reconcile-tax-documents")!;
  if (decision.category === "Insurance") return WORKFLOW_TEMPLATES.find((item) => item.id === "review-insurance-coverage")!;
  if (decision.category === "Financial Vault") return WORKFLOW_TEMPLATES.find((item) => item.id === "complete-financial-vault")!;
  return WORKFLOW_TEMPLATES.find((item) => item.id === "resolve-transaction-document-conflict")!;
}

function executionSteps(template: WorkflowTemplate, decision: AiDecision): ActionWorkflowStep[] {
  return template.steps.map((item, index) => ({
    ...step(
      item.id,
      item.title,
      item.description,
      item.owner,
      item.owner === "vireon" ? 3 : 8,
      item.requiredData.length > 0 ? item.requiredData : decision.requiredData,
      decision.evidence,
      decision.actionHref,
      item.professionalReviewRequired
    ),
    type: item.type,
    order: index + 1,
    required: true,
    dueDate: null,
    blockedReason: null,
    prerequisites: index === 0 ? [] : [template.steps[index - 1].id],
    requiredInputs: item.requiredData,
    requiredDocuments: item.type === "document-upload" ? item.requiredData : [],
    requiredEvidence: item.type === "outcome-verification" ? template.evidenceRequirements : [],
    generatedArtefacts: item.type === "communication" ? template.generatedArtefacts : [],
    evidenceRequirements: template.evidenceRequirements,
    validationRules: template.verificationRules,
  }));
}

function numericImpact(decision: AiDecision): number {
  const monthly = decision.financialImpact.match(/\$([0-9,]+)\/mo/i);
  if (monthly) return Number(monthly[1].replaceAll(",", ""));
  const dollars = decision.financialImpact.match(/\$([0-9,]+)/);
  return dollars ? Number(dollars[1].replaceAll(",", "")) : decision.monthlySavingsEstimate;
}

function affectedEnginesFor(template: WorkflowTemplate): string[] {
  if (template.id === "mortgage-refinance") return ["debt", "cash-flow", "borrowing", "housing", "retirement"];
  if (template.id === "reduce-recurring-spending") return ["cash-flow", "borrowing", "goals", "retirement"];
  if (template.id === "increase-investment-contributions") return ["investments", "cash-flow", "goals", "retirement"];
  if (template.id === "investment-structure-professional-review") return ["structure-optimiser", "tax", "cash-flow", "estate-transfer", "saved-scenarios"];
  return ["financial-vault", "decision-centre", "daily-review"];
}

function baselineSnapshotId(decision: AiDecision, now: string): string {
  return `baseline:${decision.id}:${now.slice(0, 10)}`;
}

function createOutcomeVerification(template: WorkflowTemplate, decision: AiDecision, now: string): OutcomeVerification {
  const expected = numericImpact(decision);
  const metric = template.id === "mortgage-refinance" ? "monthly mortgage saving" : template.id === "reduce-recurring-spending" ? "monthly recurring saving" : template.expectedOutcomes[0] ?? "workflow outcome";
  const workflowId = `execution-${decision.id}`;
  return {
    id: `verification-${decision.id}`,
    workflowId,
    metric,
    baselineValue: 0,
    expectedValue: expected,
    actualValue: null,
    tolerance: Math.max(10, expected * 0.1),
    expectedEffectiveDate: now.slice(0, 10),
    comparisonDate: now.slice(0, 10),
    verificationMethod: template.id === "reduce-recurring-spending" ? "transaction-history" : "document-evidence",
    evidenceIds: [],
    result: expected > 0 ? "Evidence Pending" : "Not Started",
    variance: null,
    confidence: decision.confidence,
    explanation: "Outcome verification requires post-action evidence. Completing workflow steps alone is not enough.",
    recalculationRequired: true,
    completedAt: null,
  };
}

function syncExecutionDerived(execution: ActionWorkflowExecution): ActionWorkflowExecution {
  const nextAction = determineNextBestAction(execution);
  const currentStep = execution.steps.find((item) => item.required !== false && item.status !== "Completed" && item.status !== "Skipped") ?? null;
  return {
    ...execution,
    executionStatus: execution.status,
    currentStepId: currentStep?.id ?? null,
    nextBestAction: nextAction,
    outcomeChecks: execution.outcomeVerifications,
  };
}

export function normaliseWorkflowExecution(execution: ActionWorkflowExecution): ActionWorkflowExecution {
  const outcomeVerifications = execution.outcomeVerifications ?? execution.outcomeChecks ?? [];
  const workflowVersion = execution.workflowVersion ?? execution.templateVersion ?? TEMPLATE_VERSION;
  const status = execution.status ?? execution.executionStatus ?? "Ready";
  const evidence = (execution.evidence ?? []).map((item) => {
    const legacyType = item.type === "document" || item.type === "transaction" || item.type === "fact" || item.type === "professional-note" || item.type === "external-confirmation" || item.type === "calculation-snapshot";
    const verificationStatus = item.verificationStatus ?? (item.verifiedAt && item.type !== "user attestation" ? "Verified" : "Unverified");
    return {
      ...item,
      workflowId: item.workflowId ?? execution.id,
      stepId: item.stepId ?? null,
      transactionId: item.transactionId ?? null,
      verificationStatus,
      immutable: item.immutable ?? true,
      satisfiesRequirementIds: item.satisfiesRequirementIds ?? [],
      supersedesEvidenceId: item.supersedesEvidenceId ?? null,
      type: legacyType ? item.type : item.type,
    };
  });
  const normalised: ActionWorkflowExecution = {
    ...execution,
    workflowVersion,
    templateVersion: execution.templateVersion ?? workflowVersion,
    executionStatus: execution.executionStatus ?? status,
    status,
    verificationDueAt: execution.verificationDueAt ?? outcomeVerifications[0]?.expectedEffectiveDate ?? null,
    reopenedAt: execution.reopenedAt ?? null,
    currentStepId: execution.currentStepId ?? null,
    nextBestAction: execution.nextBestAction ?? { label: "Review workflow", href: "/action-workflows", reason: "Migrated workflow requires review." },
    outcomeVerifications,
    outcomeChecks: execution.outcomeChecks ?? outcomeVerifications,
    steps: (execution.steps ?? []).map((step) => ({
      ...step,
      requiredEvidence: step.requiredEvidence ?? step.evidenceRequirements ?? [],
    })),
    evidence,
    auditEvents: execution.auditEvents ?? [],
  };
  return syncExecutionDerived(normalised);
}

export function createWorkflowExecutionFromDecision(decision: AiDecision, now = nowIso()): ActionWorkflowExecution {
  const template = templateForDecision(decision);
  const steps = executionSteps(template, decision);
  const workflowBlockers = blockers(decision);
  const reviewReasons = [...professionalReasons(decision), ...template.professionalReviewPoints];
  const professionalReviewRequired = reviewReasons.length > 0 || steps.some((item) => item.professionalReviewRequired);
  const outcome = createOutcomeVerification(template, decision, now);
  const execution: ActionWorkflowExecution = {
    id: `execution-${decision.id}`,
    workflowDefinitionId: template.id,
    workflowVersion: template.version,
    templateVersion: template.version,
    sourceDecisionId: decision.id,
    sourceDailyReviewFindingId: null,
    sourceAiCfoQuestionId: null,
    sourceScenarioId: null,
    title: template.title,
    objective: decision.recommendedAction,
    category: decision.category,
    executionStatus: workflowBlockers.length > 0 ? computeStatus(steps, workflowBlockers, null) : "Ready",
    status: workflowBlockers.length > 0 ? computeStatus(steps, workflowBlockers, null) : "Ready",
    outcomeStatus: outcome.result,
    priority: decision.priority,
    owner: "user",
    createdAt: now,
    startedAt: null,
    targetCompletionDate: null,
    completedAt: null,
    verificationDueAt: outcome.expectedEffectiveDate,
    verifiedAt: null,
    reopenedAt: null,
    lastUpdatedAt: now,
    expectedImpact: decision.financialImpact,
    realisedImpact: null,
    impactVariance: null,
    confidence: decision.confidence,
    professionalReviewRequired,
    steps,
    dependencies: [],
    blockers: workflowBlockers,
    evidence: [],
    artefacts: [],
    communications: [],
    milestones: ["workflow start", "expected verification date", "completion", "verified outcome"],
    calculationSnapshotId: `calculation:${decision.id}:${now.slice(0, 10)}`,
    baselineSnapshotId: baselineSnapshotId(decision, now),
    completionSnapshotId: null,
    verificationSnapshotId: null,
    currentStepId: steps[0]?.id ?? null,
    nextBestAction: { label: steps[0]?.title ?? decision.actionLabel, href: decision.actionHref, reason: "Initial workflow step." },
    outcomeVerifications: [outcome],
    outcomeChecks: [outcome],
    affectedEngines: affectedEnginesFor(template),
    decisionUpdateStatus: "Not Started",
    dailyReviewDeduplicationKeys: [`workflow:${decision.id}:overdue`, `workflow:${decision.id}:verification`],
    timelineEventIds: [`timeline-workflow-start-${decision.id}`],
    auditEvents: [createAudit("created", `Execution created from template ${template.id}@${template.version}.`, now)],
  };
  return syncExecutionDerived(execution);
}

function requiredStepBlocked(execution: ActionWorkflowExecution, step: ActionWorkflowStep): string | null {
  const unmet = step.prerequisites?.find((id) => execution.steps.find((candidate) => candidate.id === id)?.status !== "Completed");
  if (unmet) return `Prerequisite ${unmet} is not complete`;
  if (step.evidenceRequirements?.length && step.type === "outcome-verification" && execution.evidence.length === 0) return "Outcome evidence is pending";
  if (step.professionalReviewRequired && execution.professionalReviewRequired && execution.evidence.every((item) => item.type !== "professional-note" && item.type !== "external-confirmation")) return "Professional-review evidence is pending";
  return null;
}

function evidenceCanVerifyOutcome(evidence: WorkflowEvidence): boolean {
  if (evidence.verificationStatus !== "Verified") return false;
  if (!evidence.verifiedAt) return false;
  if (evidence.type === "user attestation") return false;
  return true;
}

function verificationEvidenceFor(execution: ActionWorkflowExecution, evidenceIds: string[]): WorkflowEvidence[] {
  const requested = new Set(evidenceIds);
  return execution.evidence.filter((item) => requested.has(item.id));
}

function confidenceRank(confidence: "High" | "Medium" | "Low"): number {
  if (confidence === "High") return 3;
  if (confidence === "Medium") return 2;
  return 1;
}

export function canEvidenceUpdateVaultFact(existingFactConfidence: "High" | "Medium" | "Low", evidence: WorkflowEvidence): boolean {
  if (!evidenceCanVerifyOutcome(evidence)) return false;
  return confidenceRank(evidence.confidence) >= confidenceRank(existingFactConfidence);
}

export function determineNextBestAction(execution: ActionWorkflowExecution): { label: string; href: string; reason: string } {
  if (execution.blockers.length > 0) return { label: execution.blockers[0], href: "/financial-vault", reason: "Blocker must be resolved before execution can continue." };
  const next = execution.steps.find((item) => item.required !== false && item.status !== "Completed" && item.status !== "Skipped");
  if (!next) {
    if (execution.outcomeStatus !== "Verified" && execution.outcomeStatus !== "Not Required") return { label: "Request outcome verification", href: "/action-workflows", reason: "Checklist execution is complete but financial outcome is not verified." };
    return { label: "Review completed workflow", href: "/action-workflows", reason: "Workflow is complete and verified." };
  }
  const blockedReason = requiredStepBlocked(execution, next);
  if (blockedReason) return { label: blockedReason, href: next.actionHref, reason: "Selected deterministically from unmet prerequisites or evidence." };
  return { label: next.title, href: next.actionHref, reason: "Selected from dependency order, required evidence and workflow status." };
}

export function transitionExecutionStep(execution: ActionWorkflowExecution, stepId: string, status: ActionWorkflowStepStatus, actor: "user" | "vireon" | "gpt" = "user", now = nowIso()): WorkflowTransitionResult & { execution: ActionWorkflowExecution } {
  if (actor === "gpt") return { workflow: executionToWorkflow(execution), execution, changed: false };
  const index = execution.steps.findIndex((item) => item.id === stepId);
  if (index === -1) return { workflow: executionToWorkflow(execution), execution, changed: false };
  const currentStep = execution.steps[index];
  const blockedReason = status === "Completed" ? requiredStepBlocked(execution, currentStep) : null;
  const nextStep = blockedReason ? { ...currentStep, status: "Blocked" as const, blockedReason } : { ...currentStep, status, completedAt: status === "Completed" ? now : currentStep.completedAt, blockedReason: null };
  const steps = execution.steps.map((item, itemIndex) => itemIndex === index ? nextStep : item);
  const allRequiredComplete = steps.every((item) => item.required === false || item.status === "Completed" || item.status === "Skipped");
  const firstOutcomeStepIndex = steps.findIndex((item) => item.type === "outcome-verification");
  const executionCompleteButOutcomePending = firstOutcomeStepIndex >= 0
    ? steps.slice(0, firstOutcomeStepIndex).every((item) => item.required === false || item.status === "Completed" || item.status === "Skipped")
    : false;
  const executionStatus: ActionWorkflowStatus = blockedReason ? "Blocked" : allRequiredComplete || executionCompleteButOutcomePending ? "Awaiting Verification" : "In Progress";
  const next: ActionWorkflowExecution = {
    ...execution,
    steps,
    status: executionStatus,
    executionStatus,
    startedAt: execution.startedAt ?? now,
    completedAt: allRequiredComplete ? now : execution.completedAt,
    completionSnapshotId: allRequiredComplete ? `completion:${execution.id}:${now.slice(0, 10)}` : execution.completionSnapshotId,
    outcomeStatus: allRequiredComplete && execution.outcomeStatus === "Not Started" ? "Evidence Pending" : execution.outcomeStatus,
    decisionUpdateStatus: allRequiredComplete ? "Awaiting Outcome" : "In Progress",
    lastUpdatedAt: now,
    auditEvents: [
      createAudit(blockedReason ? "blocked" : status === "Completed" ? "step-completed" : "step-started", blockedReason ? `${currentStep.title} blocked: ${blockedReason}` : `${currentStep.title} set to ${status}.`, now),
      ...execution.auditEvents,
    ],
  };
  const synced = syncExecutionDerived(next);
  return { workflow: executionToWorkflow(synced), execution: synced, changed: true };
}

export function addWorkflowEvidence(execution: ActionWorkflowExecution, evidence: WorkflowEvidenceInput, actor: "user" | "vireon" | "gpt" = "user", now = nowIso()): { execution: ActionWorkflowExecution; accepted: boolean; reason: string } {
  if (actor === "gpt") return { execution, accepted: false, reason: "GPT cannot create or approve workflow evidence." };
  const verificationStatus: WorkflowEvidenceStatus =
    evidence.verificationStatus ??
    (evidence.verifiedAt && evidence.type !== "user attestation" ? "Verified" : "Unverified");
  const acceptedEvidence: WorkflowEvidence = {
    ...evidence,
    id: `evidence-${execution.id}-${execution.evidence.length + 1}`,
    workflowId: execution.id,
    stepId: evidence.stepId ?? null,
    transactionId: evidence.transactionId ?? null,
    capturedAt: now,
    verificationStatus,
    immutable: true,
    supersedesEvidenceId: evidence.supersedesEvidenceId ?? null,
  };
  const next: ActionWorkflowExecution = {
    ...execution,
    evidence: [acceptedEvidence, ...execution.evidence],
    outcomeStatus: execution.outcomeStatus === "Evidence Pending" ? "Verification Pending" : execution.outcomeStatus,
    lastUpdatedAt: now,
    auditEvents: [createAudit("evidence-added", `Evidence added from ${acceptedEvidence.source}.`, now), ...execution.auditEvents],
  };
  return { execution: syncExecutionDerived(next), accepted: true, reason: "Evidence recorded as immutable workflow evidence." };
}

export function evaluateOutcomeVerification(execution: ActionWorkflowExecution, actualValue: number | null, evidenceIds: string[], recalculationSucceeded = true, now = nowIso()): ActionWorkflowExecution {
  const current = execution.outcomeVerifications[0];
  if (!current) return execution;
  if (!recalculationSucceeded) {
    const failed = { ...current, result: "Inconclusive" as const, actualValue, evidenceIds, explanation: "Selective recalculation failed, so the outcome cannot be fully verified.", recalculationRequired: true, completedAt: now };
    return syncExecutionDerived({ ...execution, outcomeStatus: "Inconclusive", outcomeVerifications: [failed], outcomeChecks: [failed], decisionUpdateStatus: "Review Required", auditEvents: [createAudit("outcome-verification", failed.explanation, now), ...execution.auditEvents], lastUpdatedAt: now });
  }
  const suppliedEvidence = verificationEvidenceFor(execution, evidenceIds);
  const verifiedEvidence = suppliedEvidence.filter(evidenceCanVerifyOutcome);
  if (evidenceIds.length === 0 || actualValue === null || suppliedEvidence.length === 0 || verifiedEvidence.length === 0) {
    const explanation = suppliedEvidence.some((item) => item.type === "user attestation")
      ? "User attestation alone cannot verify realised financial impact. Verified post-action evidence is required."
      : "Verified post-action evidence is required before realised impact can be populated.";
    const pending = { ...current, result: "Evidence Pending" as const, actualValue, evidenceIds, explanation, recalculationRequired: true, completedAt: now };
    return syncExecutionDerived({ ...execution, outcomeStatus: "Evidence Pending", realisedImpact: null, impactVariance: null, outcomeVerifications: [pending], outcomeChecks: [pending], auditEvents: [createAudit("outcome-verification", pending.explanation, now), ...execution.auditEvents], lastUpdatedAt: now });
  }
  const variance = actualValue - current.expectedValue;
  const absVariance = Math.abs(variance);
  const result: OutcomeVerificationStatus = absVariance <= current.tolerance ? "Verified" : actualValue > 0 ? "Partially Verified" : "Not Achieved";
  const verified = {
    ...current,
    actualValue,
    evidenceIds,
    result,
    variance,
    confidence: "High" as const,
    explanation: result === "Verified" ? "Actual result is within tolerance of expected impact." : "Actual result differs materially from expected impact; external factors may have contributed.",
    recalculationRequired: false,
    completedAt: now,
  };
  const next: ActionWorkflowExecution = {
    ...execution,
    status: result === "Verified" ? "Completed" : result === "Partially Verified" ? "Completed with Variance" : "Reopened",
    executionStatus: result === "Verified" ? "Completed" : result === "Partially Verified" ? "Completed with Variance" : "Reopened",
    outcomeStatus: result,
    realisedImpact: `$${Math.round(actualValue).toLocaleString()}`,
    impactVariance: `$${Math.round(variance).toLocaleString()}`,
    verifiedAt: now,
    reopenedAt: result === "Not Achieved" ? now : execution.reopenedAt,
    verificationSnapshotId: `verification:${execution.id}:${now.slice(0, 10)}`,
    outcomeVerifications: [verified],
    outcomeChecks: [verified],
    decisionUpdateStatus: result === "Verified" ? "Completed" : result === "Not Achieved" ? "Reopened" : "Review Required",
    timelineEventIds: [...execution.timelineEventIds, `timeline-outcome-${execution.id}`],
    auditEvents: [createAudit("outcome-verification", verified.explanation, now), ...execution.auditEvents],
    lastUpdatedAt: now,
  };
  return syncExecutionDerived(next);
}

export function generateWorkflowArtefact(execution: ActionWorkflowExecution, type: WorkflowArtefact["type"], now = nowIso()): ActionWorkflowExecution {
  const artefact: WorkflowArtefact = {
    id: `artefact-${execution.id}-${type}-${execution.artefacts.length + 1}`,
    type,
    title: type.replaceAll("-", " "),
    format: "json",
    createdAt: now,
    calculationSnapshotId: execution.calculationSnapshotId,
    evidenceIds: execution.evidence.map((item) => item.id),
    disclaimer: EDUCATIONAL_DISCLAIMER,
    status: "Current",
    supersededBy: null,
    version: `artefact-${TEMPLATE_VERSION}`,
    content: JSON.stringify({
      workflowId: execution.id,
      title: execution.title,
      expectedImpact: execution.expectedImpact,
      realisedImpact: execution.realisedImpact,
      assumptions: execution.steps.flatMap((item) => item.validationRules ?? []),
      evidenceIds: execution.evidence.map((item) => item.id),
      professionalReviewRequired: execution.professionalReviewRequired,
      disclaimer: EDUCATIONAL_DISCLAIMER,
    }),
  };
  return {
    ...execution,
    artefacts: [artefact, ...execution.artefacts.map((item) => item.type === type && item.status === "Current" ? { ...item, status: "Superseded" as const, supersededBy: artefact.id } : item)],
    auditEvents: [createAudit("artefact-generated", `${artefact.title} generated.`, now), ...execution.auditEvents],
    lastUpdatedAt: now,
  };
}

export function executionToWorkflow(execution: ActionWorkflowExecution): ActionWorkflow {
  const progressValue = progress(execution.steps);
  const nextAction = determineNextBestAction(execution);
  return {
    id: execution.id.replace(/^execution-/, "workflow-"),
    sourceDecisionId: execution.sourceDecisionId ?? execution.id,
    title: execution.title,
    category: execution.category,
    objective: execution.objective,
    priority: execution.priority,
    financialImpact: execution.expectedImpact,
    verifiedFinancialImpact: execution.outcomeStatus === "Verified" || execution.outcomeStatus === "Partially Verified" ? execution.realisedImpact : null,
    confidence: execution.confidence,
    status: execution.status,
    outcomeStatus: execution.outcomeStatus,
    progress: progressValue,
    nextActionLabel: nextAction.label,
    nextActionHref: nextAction.href,
    timeToComplete: `${execution.steps.reduce((sum, item) => sum + item.estimatedMinutes, 0)} min`,
    requiredData: Array.from(new Set(execution.steps.flatMap((item) => item.requiredData))),
    blockers: execution.blockers,
    evidence: execution.evidence.length > 0 ? execution.evidence.map((item) => item.notes) : execution.steps.flatMap((item) => item.evidence).slice(0, 6),
    assumptions: execution.outcomeVerifications.map((item) => item.explanation),
    professionalReviewRequired: execution.professionalReviewRequired,
    professionalReviewReasons: execution.steps.filter((item) => item.professionalReviewRequired).map((item) => item.title),
    outputs: execution.artefacts.map((item) => item.title),
    steps: execution.steps,
    createdAt: execution.createdAt,
    updatedAt: execution.lastUpdatedAt,
    completedAt: execution.completedAt,
    dismissedAt: execution.status === "Dismissed" || execution.status === "Cancelled" ? execution.lastUpdatedAt : null,
    auditTrail: execution.auditEvents,
  };
}

function step(
  id: string,
  title: string,
  description: string,
  owner: ActionWorkflowStep["owner"],
  estimatedMinutes: number,
  requiredData: string[],
  evidence: string[],
  actionHref: string,
  professionalReviewRequired = false
): ActionWorkflowStep {
  return {
    id,
    title,
    description,
    status: "Not Started",
    owner,
    estimatedMinutes,
    requiredData,
    evidence,
    actionHref,
    professionalReviewRequired,
    completedAt: null,
  };
}

function computeStatus(steps: ActionWorkflowStep[], blockers: string[], dismissedAt: string | null): ActionWorkflowStatus {
  if (dismissedAt) return "Dismissed";
  if (blockers.length > 0) return blockers.some((item) => item.toLowerCase().includes("document")) ? "Waiting on Document" : "Blocked";
  if (steps.every((item) => item.status === "Completed" || item.status === "Skipped")) return "Completed";
  if (steps.some((item) => item.status === "In Progress" || item.status === "Completed")) return "In Progress";
  return "Not Started";
}

function progress(steps: ActionWorkflowStep[]): number {
  if (steps.length === 0) return 0;
  const complete = steps.filter((stepItem) => stepItem.status === "Completed" || stepItem.status === "Skipped").length;
  return Math.round((complete / steps.length) * 100);
}

function blockers(decision: AiDecision): string[] {
  if (decision.missingDataBlocker && decision.category === "Financial Vault") return decision.requiredData.map((item) => `Missing document: ${item}`);
  if (decision.missingDataBlocker) return decision.requiredData.map((item) => `Missing required data: ${item}`);
  return [];
}

export function createActionWorkflowFromDecision(decision: AiDecision, now = nowIso()): ActionWorkflow {
  const steps = baseSteps(decision);
  const workflowBlockers = blockers(decision);
  const reviewReasons = professionalReasons(decision);
  const professionalReviewRequired = reviewReasons.length > 0 || REVIEW_REQUIRED_CATEGORIES.has(decision.category);
  const status = computeStatus(steps, workflowBlockers, null);

  return {
    id: `workflow-${decision.id}`,
    sourceDecisionId: decision.id,
    title: workflowTitle(decision),
    category: decision.category,
    objective: decision.recommendedAction,
    priority: decision.priority,
    financialImpact: decision.financialImpact,
    verifiedFinancialImpact: null,
    confidence: decision.confidence,
    status,
    outcomeStatus: null,
    progress: progress(steps),
    nextActionLabel: steps[0]?.title ?? decision.actionLabel,
    nextActionHref: steps[0]?.actionHref ?? decision.actionHref,
    timeToComplete: decision.timeToComplete,
    requiredData: decision.requiredData,
    blockers: workflowBlockers,
    evidence: decision.evidence,
    assumptions: [decision.reason, decision.expectedImpact],
    professionalReviewRequired,
    professionalReviewReasons: reviewReasons,
    outputs: ["Updated workflow status", "Linked Decision Centre action", "Audit trail", "Next Daily Review evidence check"],
    steps,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    dismissedAt: null,
    auditTrail: [createAudit("created", `Workflow created from decision ${decision.id}.`, now)],
  };
}

export function mergeActionWorkflows(decisions: AiDecision[], existing: ActionWorkflow[] = [], now = nowIso()): ActionWorkflow[] {
  const byDecision = new Map(existing.map((workflow) => [workflow.sourceDecisionId, workflow]));
  const workflows = decisions.map((decision) => {
    const current = byDecision.get(decision.id);
    if (!current) return createActionWorkflowFromDecision(decision, now);
    const nextBlockers = blockers(decision);
    const nextStatus = computeStatus(current.steps, nextBlockers, current.dismissedAt);
    return {
      ...current,
      priority: decision.priority,
      financialImpact: decision.financialImpact,
      confidence: decision.confidence,
      blockers: nextBlockers,
      evidence: decision.evidence,
      status: nextStatus,
      progress: progress(current.steps),
      updatedAt: now,
    };
  });
  return workflows.sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority) || b.financialImpact.localeCompare(a.financialImpact));
}

export function transitionWorkflowStep(workflow: ActionWorkflow, stepId: string, status: ActionWorkflowStepStatus, now = nowIso()): WorkflowTransitionResult {
  const stepIndex = workflow.steps.findIndex((item) => item.id === stepId);
  if (stepIndex === -1) return { workflow, changed: false };
  const steps = workflow.steps.map((item, index) => index === stepIndex ? { ...item, status, completedAt: status === "Completed" ? now : item.completedAt } : item);
  const nextProgress = progress(steps);
  const nextStatus = computeStatus(steps, workflow.blockers, workflow.dismissedAt);
  const next: ActionWorkflow = {
    ...workflow,
    steps,
    progress: nextProgress,
    status: nextStatus,
    nextActionLabel: steps.find((item) => item.status !== "Completed" && item.status !== "Skipped")?.title ?? "Review completed workflow",
    nextActionHref: steps.find((item) => item.status !== "Completed" && item.status !== "Skipped")?.actionHref ?? workflow.nextActionHref,
    completedAt: nextStatus === "Completed" ? now : workflow.completedAt,
    updatedAt: now,
    auditTrail: [
      createAudit(status === "Completed" ? "step-completed" : "step-started", `${steps[stepIndex].title} set to ${status}.`, now),
      ...workflow.auditTrail,
    ],
  };
  return { workflow: next, changed: true };
}

export function summariseActionWorkflows(workflows: ActionWorkflow[], decisions: AiDecision[]): ActionWorkflowSummary {
  const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));
  return {
    total: workflows.length,
    active: workflows.filter((workflow) => ["Ready", "Not Started", "In Progress", "Ready for Review", "Awaiting Verification", "Reopened"].includes(workflow.status)).length,
    waitingOnUser: workflows.filter((workflow) => workflow.status === "Waiting on User").length,
    waitingOnDocument: workflows.filter((workflow) => workflow.status === "Waiting on Document").length,
    completed: workflows.filter((workflow) => workflow.status === "Completed").length,
    blocked: workflows.filter((workflow) => workflow.status === "Blocked").length,
    estimatedMonthlySavings: workflows.reduce((sum, workflow) => sum + (decisionById.get(workflow.sourceDecisionId)?.monthlySavingsEstimate ?? 0), 0),
  };
}

function priorityValue(priority: AiDecision["priority"]): number {
  return priority === "Critical" ? 4 : priority === "High" ? 3 : priority === "Medium" ? 2 : 1;
}

export const ActionWorkflowEngine = {
  createFromDecision: createActionWorkflowFromDecision,
  merge: mergeActionWorkflows,
  transitionStep: transitionWorkflowStep,
  summarise: summariseActionWorkflows,
};

export const WorkflowExecutionEngine = {
  templates: WORKFLOW_TEMPLATES,
  createFromDecision: createWorkflowExecutionFromDecision,
  normalise: normaliseWorkflowExecution,
  determineNextBestAction,
  transitionStep: transitionExecutionStep,
  addEvidence: addWorkflowEvidence,
  evaluateOutcome: evaluateOutcomeVerification,
  generateArtefact: generateWorkflowArtefact,
  toWorkflow: executionToWorkflow,
};
