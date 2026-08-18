import type { ActionWorkflow } from "./actionWorkflows.ts";
import type { DailyReviewFinding, DailyReviewHistoryRecord } from "./aiCfoDailyReview.ts";
import type { AiDecision } from "./aiDecisionCentre.ts";
import { getReviewDirection, scoreFindingForBriefing, selectFeaturedFinding, selectFinancialWins, selectPriorityActions } from "./dailyReviewPresentation.ts";
import { buildFindingDisplay, type FindingTone } from "./dailyReviewDisplay.ts";

export type DashboardDirection = "improving" | "stable" | "mixed" | "deteriorating" | "partial";

export type DashboardAction = {
  id: string;
  source: "daily-review" | "decision" | "workflow";
  sourceEntityId: string;
  title: string;
  whyItMatters: string;
  impact: string;
  nextStep: string;
  status: string;
  confidence: "High" | "Medium" | "Low";
  priority: "Critical" | "High" | "Medium" | "Low";
  href: string;
  actionLabel: string;
  professionalReviewRequired: boolean;
  blockerDetail: string | null;
};

export type DashboardBriefing = {
  direction: DashboardDirection;
  label: string;
  headline: string;
  summary: string;
  reviewPeriod: string;
  attentionItems: Array<{
    id: string;
    title: string;
    detail: string;
    whyItMatters: string;
    impact: string;
    confidence: "High" | "Medium" | "Low";
    priority: "Critical" | "High" | "Medium" | "Low";
    type: DailyReviewFinding["type"];
    sourceEngine: string;
    calculationSnapshotId: string;
    calculationRule: string;
    assumptions: string[];
    actionLabel: string;
    actionHref: string;
    tone: FindingTone;
    statusLabel: string;
    changeLabel: string;
    previousLabel: string;
    previousValue: string;
    currentLabel: string;
    currentValue: string;
    timeBasis: string;
    evidence: Array<{
      sourceTitle: string;
      factUsed: string;
      classification: string;
      confidence: "High" | "Medium" | "Low";
      lastVerifiedAt: string;
      sourceLocation: string;
    }>;
  }>;
  primaryAction: DashboardAction | null;
};

const activeWorkflowStatuses = new Set<ActionWorkflow["status"]>([
  "In Progress",
  "Waiting on User",
  "Waiting on Document",
  "Waiting on Third Party",
  "Awaiting Verification",
  "Ready for Review",
  "Blocked",
  "Reopened",
]);

function priorityWeight(priority: DashboardAction["priority"]): number {
  if (priority === "Critical") return 4;
  if (priority === "High") return 3;
  if (priority === "Medium") return 2;
  return 1;
}

function confidenceWeight(confidence: DashboardAction["confidence"]): number {
  if (confidence === "High") return 3;
  if (confidence === "Medium") return 2;
  return 1;
}

function actionScore(action: DashboardAction): number {
  const sourceWeight = action.source === "workflow" ? 140 : action.source === "daily-review" ? 80 : 40;
  const reviewDependency = action.professionalReviewRequired ? -8 : 0;
  return sourceWeight + priorityWeight(action.priority) * 25 + confidenceWeight(action.confidence) * 6 + reviewDependency;
}

export function dashboardActionSourceKey(action: DashboardAction): string {
  return action.sourceEntityId || `${action.source}:${action.id}`;
}

function normaliseActionText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dashboardActionDuplicateKey(action: DashboardAction): string {
  const sourceKey = dashboardActionSourceKey(action);
  const title = normaliseActionText(action.title);
  const hrefBase = action.href.split("?")[0];
  return `${sourceKey}:${title}:${hrefBase}`;
}

function areDuplicateActions(a: DashboardAction, b: DashboardAction): boolean {
  if (dashboardActionSourceKey(a) === dashboardActionSourceKey(b)) return true;
  if (a.href === b.href && normaliseActionText(a.title) === normaliseActionText(b.title)) return true;
  return false;
}

function actionFromFinding(finding: DailyReviewFinding): DashboardAction {
  return {
    id: finding.id,
    source: "daily-review",
    sourceEntityId: finding.deduplicationKey || finding.id,
    title: finding.title,
    whyItMatters: finding.whyItMatters,
    impact: finding.expectedImpact,
    nextStep: finding.actionLabel,
    status: finding.deadline ? `Due ${finding.deadline}` : finding.state,
    confidence: finding.confidence,
    priority: finding.priority,
    href: finding.actionHref,
    actionLabel: finding.actionLabel,
    professionalReviewRequired: finding.professionalReviewRequired,
    blockerDetail: null,
  };
}

function actionFromDecision(decision: AiDecision): DashboardAction {
  return {
    id: decision.id,
    source: "decision",
    sourceEntityId: decision.id,
    title: decision.title,
    whyItMatters: decision.whyThisMatters,
    impact: decision.expectedImpact || decision.financialImpact,
    nextStep: decision.nextStep,
    status: decision.timeToComplete,
    confidence: decision.confidence,
    priority: decision.priority,
    href: decision.actionHref,
    actionLabel: decision.actionLabel,
    professionalReviewRequired: decision.source === "Housing Scenarios" || decision.source === "Balance Sheet",
    blockerDetail: null,
  };
}

function actionFromWorkflow(workflow: ActionWorkflow): DashboardAction {
  const currentStep = workflow.steps.find((step) => step.status === "In Progress" || step.status === "Blocked")
    ?? workflow.steps.find((step) => step.status === "Not Started");
  const blockerDocuments = workflow.blockers
    .filter((blocker) => /document/i.test(blocker))
    .map((blocker) => blocker.replace(/^missing document:\s*/i, "").trim())
    .filter(Boolean);
  const requiredDocuments = [...new Set([
    ...(currentStep?.requiredDocuments?.filter(Boolean) ?? []),
    ...blockerDocuments,
  ])];
  const workflowLabel = workflow.title.toLowerCase().endsWith("workflow") ? workflow.title : `${workflow.title} workflow`;
  const blockerDetail = workflow.status === "Waiting on Document"
    ? requiredDocuments.length > 0
      ? `The ${workflowLabel} cannot continue until you provide: ${requiredDocuments.join(", ")}.`
      : `The ${workflowLabel} is marked Waiting on Document, but no required document is persisted. Vireon cannot identify the document safely.`
    : currentStep?.blockedReason || workflow.blockers.find(Boolean) || null;
  return {
    id: workflow.id,
    source: "workflow",
    sourceEntityId: workflow.sourceDecisionId || workflow.id,
    title: workflow.title,
    whyItMatters: workflow.objective,
    impact: workflow.financialImpact,
    nextStep: workflow.nextActionLabel,
    status: workflow.status,
    confidence: workflow.confidence,
    priority: workflow.priority,
    href: workflow.nextActionHref || "/action-workflows",
    actionLabel: workflow.nextActionLabel,
    professionalReviewRequired: workflow.professionalReviewRequired,
    blockerDetail,
  };
}

function reviewPeriod(record: DailyReviewHistoryRecord): string {
  const formatDate = (value: string) => {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  };
  return `${formatDate(record.review.comparisonStartDate)} to ${formatDate(record.review.comparisonEndDate)}`;
}

export function selectDashboardAttentionFindings(findings: DailyReviewFinding[]): DailyReviewFinding[] {
  const seen = new Set<string>();
  return [...findings]
    .sort((a, b) => scoreFindingForBriefing(b) - scoreFindingForBriefing(a) || a.title.localeCompare(b.title))
    .filter((finding) => {
      const key = finding.deduplicationKey || finding.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export function excludeDisplayedFindingAction(
  candidate: DashboardAction | null,
  displayedFindings: DailyReviewFinding[],
): DashboardAction | null {
  if (!candidate) return null;
  const duplicatesFinding = displayedFindings.some((finding) =>
    candidate.id === finding.id
    || candidate.sourceEntityId === finding.deduplicationKey
    || (candidate.title === finding.title && candidate.href === finding.actionHref)
  );
  return duplicatesFinding ? null : candidate;
}

function attentionItems(record: DailyReviewHistoryRecord): DashboardBriefing["attentionItems"] {
  return selectDashboardAttentionFindings(record.review.findings)
    .map((finding) => {
      const display = buildFindingDisplay(finding, record.review.comparisonStartDate, record.review.comparisonEndDate);
      return {
      id: finding.id,
      title: finding.title,
      detail: finding.summary,
      whyItMatters: finding.whyItMatters,
      impact: finding.expectedImpact,
      confidence: finding.confidence,
      priority: finding.priority,
      type: finding.type,
      sourceEngine: finding.sourceEngine,
      calculationSnapshotId: finding.calculationSnapshotId,
      calculationRule: "Current review value minus previous review value equals the displayed change.",
      assumptions: finding.assumptions,
      actionLabel: finding.actionLabel,
      actionHref: finding.actionHref,
      ...display,
      evidence: finding.evidence.map((item) => ({
        sourceTitle: item.sourceTitle,
        factUsed: item.factUsed,
        classification: item.classification,
        confidence: item.confidence,
        lastVerifiedAt: item.lastVerifiedAt,
        sourceLocation: item.sourceLocation,
      })),
      };
    });
}

export function selectDashboardTopPriority(input: {
  findings: DailyReviewFinding[];
  decisions: AiDecision[];
  workflows: ActionWorkflow[];
}): DashboardAction | null {
  const activeWorkflowActions = input.workflows
    .filter((workflow) => activeWorkflowStatuses.has(workflow.status))
    .map(actionFromWorkflow);
  if (activeWorkflowActions.length > 0) {
    return activeWorkflowActions.sort((a, b) => actionScore(b) - actionScore(a) || a.title.localeCompare(b.title))[0];
  }

  const findingActions = selectPriorityActions(input.findings, input.findings.length).map(actionFromFinding);
  const decisionActions = input.decisions.filter((decision) => decision.priority !== "Low").map(actionFromDecision);
  const allActions = [...findingActions, ...decisionActions];
  return allActions.sort((a, b) => actionScore(b) - actionScore(a) || a.title.localeCompare(b.title))[0] ?? null;
}

export function selectDashboardSecondaryActions(input: {
  findings: DailyReviewFinding[];
  decisions: AiDecision[];
  workflows: ActionWorkflow[];
  topAction: DashboardAction | null;
  limit?: number;
}): DashboardAction[] {
  const top = input.topAction;
  const actions = [
    ...input.workflows.filter((workflow) => activeWorkflowStatuses.has(workflow.status)).map(actionFromWorkflow),
    ...selectPriorityActions(input.findings, input.findings.length).map(actionFromFinding),
    ...input.decisions.filter((decision) => decision.priority !== "Low").map(actionFromDecision),
  ];
  const seen = new Set<string>();
  return actions
    .filter((action) => !top || !areDuplicateActions(action, top))
    .filter((action) => {
      const key = dashboardActionDuplicateKey(action);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => actionScore(b) - actionScore(a) || a.title.localeCompare(b.title))
    .slice(0, input.limit ?? 3);
}

export function selectVerifiedFinancialWins(findings: DailyReviewFinding[], workflows: ActionWorkflow[], limit = 3): Array<{ id: string; title: string; impact: string; href: string }> {
  const reviewWins = selectFinancialWins(findings, findings.length).map((finding) => ({
    id: finding.id,
    title: finding.title,
    impact: finding.expectedImpact,
    href: finding.actionHref,
  }));
  const verifiedWorkflowWins = workflows
    .filter((workflow) => workflow.status === "Completed" && workflow.outcomeStatus === "Verified" && workflow.completedAt && workflow.verifiedFinancialImpact)
    .map((workflow) => ({
      id: workflow.id,
      title: workflow.title,
      impact: workflow.verifiedFinancialImpact ?? "",
      href: "/action-workflows",
    }));
  return [...reviewWins, ...verifiedWorkflowWins].slice(0, limit);
}

export function buildDashboardBriefing(record: DailyReviewHistoryRecord, topAction: DashboardAction | null): DashboardBriefing {
  const direction = getReviewDirection(record);
  const featured = selectFeaturedFinding(record.review.findings);
  const mappedDirection: DashboardDirection =
    direction === "improved" ? "improving" :
    direction === "deteriorated" ? "deteriorating" :
    direction;

  if (direction === "partial") {
    return {
      direction: "partial",
      label: "Dashboard partially updated",
      headline: "Your Dashboard is partially updated.",
      summary: "Some calculations were unavailable, so Vireon is showing only verified sections with reduced confidence.",
      reviewPeriod: reviewPeriod(record),
      attentionItems: attentionItems(record),
      primaryAction: topAction,
    };
  }

  if (direction === "stable") {
    return {
      direction: "stable",
      label: "Financial command centre",
      headline: "Your financial position is stable.",
      summary: "No material changes need attention since the previous verified review.",
      reviewPeriod: reviewPeriod(record),
      attentionItems: [],
      primaryAction: topAction,
    };
  }

  if (direction === "mixed") {
    return {
      direction: "mixed",
      label: "Financial command centre",
      headline: featured ? `Your position is mixed: ${featured.title}.` : "Your position is mixed.",
      summary: featured?.whyItMatters ?? "The latest verified review contains both progress and items that need action.",
      reviewPeriod: reviewPeriod(record),
      attentionItems: attentionItems(record),
      primaryAction: topAction,
    };
  }

  return {
    direction: mappedDirection,
    label: "Financial command centre",
    headline: direction === "improved" ? "Your position improved this period." : `${record.review.findings.length} financial item${record.review.findings.length === 1 ? "" : "s"} need attention.`,
    summary: featured?.whyItMatters ?? record.review.overallSummary.split(".")[0] + ".",
    reviewPeriod: reviewPeriod(record),
    attentionItems: attentionItems(record),
    primaryAction: topAction,
  };
}

export function scoreDashboardFindingForTest(finding: DailyReviewFinding): number {
  return scoreFindingForBriefing(finding);
}
