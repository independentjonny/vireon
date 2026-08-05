import { buildAiDecisions, type AiDecision } from "@/lib/aiDecisionCentre";
import { gatherAICfoInputs } from "@/lib/aiCfoRuntime";
import type { ActionWorkflowExecution, WorkflowEvidence } from "@/lib/actionWorkflows";
import { WorkflowExecutionEngine } from "@/lib/actionWorkflows";
import type { DailyReviewHistoryRecord } from "@/lib/aiCfoDailyReview";
import { ExplainabilityEngine } from "@/lib/explainability";
import type { FinancialBalanceSheet } from "@/lib/financialBalanceSheet";
import type { FinancialDigitalTwin, TwinPersistedState, TwinSimulationOutput, TwinTimelineEvent } from "@/lib/financialDigitalTwin";
import type {
  FinancialTimelineEvent,
  FinancialTimelineState,
  RecommendationExplanation,
  TimelineConfidence,
  TimelineEvidence,
  TimelineFilter,
} from "@/lib/financialTimeline";
import type { UploadedDocument } from "@/lib/financialVaultTypes";
import { TAX_RULE_REFERENCES } from "@/lib/structureComparisonEngine";

const GENERATED_AT = "2026-07-19T08:00:00.000Z";

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  }
  return value;
}

function confidenceFromScore(score: number): TimelineConfidence {
  if (score >= 0.85 || score >= 85) return "High";
  if (score >= 0.65 || score >= 65) return "Medium";
  return "Low";
}

function evidence(input: TimelineEvidence): TimelineEvidence {
  return input;
}

function documentEvidence(doc: UploadedDocument): TimelineEvidence {
  return evidence({
    id: `evidence-${doc.id}`,
    sourceType: "document",
    sourceId: doc.id,
    title: doc.fileName,
    location: "/financial-vault",
    factUsed: `${doc.documentType.replaceAll("_", " ")} uploaded and ${doc.status}`,
    confidence: confidenceFromScore(doc.extractionConfidence),
    lastVerifiedAt: doc.uploadedAt,
  });
}

function workflowEvidence(item: WorkflowEvidence): TimelineEvidence {
  return evidence({
    id: `evidence-${item.id}`,
    sourceType: item.type.includes("transaction") || item.type === "transaction" ? "transaction" : item.type.includes("document") || item.type === "document" ? "document" : "workflow",
    sourceId: item.documentId ?? item.transactionId ?? item.factId ?? item.id,
    title: item.source,
    location: "/action-workflows",
    factUsed: item.notes,
    confidence: item.confidence,
    lastVerifiedAt: item.verifiedAt ?? item.capturedAt,
  });
}

function event(input: Omit<FinancialTimelineEvent, "immutable">): FinancialTimelineEvent {
  return {
    ...input,
    immutable: true,
  };
}

function documentEvents(documents: UploadedDocument[]): FinancialTimelineEvent[] {
  return documents.map((doc) => event({
    id: `timeline-document-${doc.id}`,
    timestamp: doc.uploadedAt,
    category: "Financial Fact",
    type: "document uploaded",
    title: `${doc.documentType.replaceAll("_", " ")} uploaded`,
    summary: `${doc.fileName} was added to the Financial Vault and marked ${doc.status}.`,
    whyItHappened: "A source document was uploaded or seeded into the Financial Vault.",
    deterministicCause: "Financial Vault document ingestion created or updated source evidence.",
    evidence: [documentEvidence(doc)],
    calculationSnapshotId: null,
    confidence: confidenceFromScore(doc.extractionConfidence),
    relatedDecisionIds: [],
    relatedWorkflowIds: [],
    relatedDocumentIds: [doc.id],
    relatedScenarioIds: [],
    affectedMetrics: ["documentCoverage", "vaultConfidence"],
    beforeValues: { documentCoverage: null, vaultConfidence: null },
    afterValues: { documentCoverage: doc.status === "extracted" ? "available" : doc.status, vaultConfidence: Math.round(doc.extractionConfidence * 100) },
    impact: Math.round(doc.extractionConfidence * 100),
  }));
}

function balanceSheetEvents(balanceSheet: FinancialBalanceSheet): FinancialTimelineEvent[] {
  const currentNetWorth = balanceSheet.netWorth;
  const previousNetWorth = balanceSheet.netWorth - balanceSheet.monthlyNetChange;
  return [
    event({
      id: `timeline-position-net-worth-${balanceSheet.asOf.slice(0, 10)}`,
      timestamp: balanceSheet.asOf,
      category: "Financial Position",
      type: "net worth changed",
      title: "Net worth changed",
      summary: `Net worth changed by ${formatMoney(balanceSheet.monthlyNetChange)} for the current period.`,
      whyItHappened: "Balance Sheet assets and liabilities changed from the previous verified snapshot.",
      deterministicCause: "Balance Sheet summed verified asset values and liability balances.",
      evidence: balanceSheet.assets.slice(0, 3).map((asset) => evidence({
        id: `evidence-balance-${asset.id}`,
        sourceType: asset.side === "asset" ? "asset" : "liability",
        sourceId: asset.id,
        title: asset.label,
        location: `/balance-sheet/${asset.id}`,
        factUsed: `${asset.label} ${formatMoney(asset.value)}; ${asset.trend.label}`,
        confidence: asset.statusTone === "review" ? "Medium" : "High",
        lastVerifiedAt: asset.source.updatedAt,
      })),
      calculationSnapshotId: `balance-sheet:${balanceSheet.asOf.slice(0, 10)}`,
      confidence: "High",
      relatedDecisionIds: ["refinance-mortgage-rate", "property-concentration"],
      relatedWorkflowIds: [],
      relatedDocumentIds: [],
      relatedScenarioIds: [],
      affectedMetrics: ["netWorth"],
      beforeValues: { netWorth: previousNetWorth },
      afterValues: { netWorth: currentNetWorth },
      impact: balanceSheet.monthlyNetChange,
    }),
    event({
      id: `timeline-position-borrowing-${balanceSheet.asOf.slice(0, 10)}`,
      timestamp: balanceSheet.asOf,
      category: "Financial Position",
      type: "borrowing changed",
      title: "Borrowing readiness updated",
      summary: `Borrowing capacity is ${formatMoney(balanceSheet.borrowingCapacity)} with readiness ${balanceSheet.houseReadinessScore}/100.`,
      whyItHappened: "Income, spending, debt and deposit assumptions changed the serviceability model.",
      deterministicCause: "Housing and balance sheet calculations recalculated borrowing readiness.",
      evidence: [
        evidence({
          id: "evidence-borrowing-balance-sheet",
          sourceType: "calculation",
          sourceId: "balance-sheet-borrowing",
          title: "Borrowing capacity calculation",
          location: "/housing-scenarios",
          factUsed: `Borrowing capacity ${formatMoney(balanceSheet.borrowingCapacity)}; readiness ${balanceSheet.houseReadinessScore}/100`,
          confidence: "Medium",
          lastVerifiedAt: balanceSheet.asOf,
        }),
      ],
      calculationSnapshotId: `borrowing:${balanceSheet.asOf.slice(0, 10)}`,
      confidence: "Medium",
      relatedDecisionIds: ["housing-capacity-increased"],
      relatedWorkflowIds: [],
      relatedDocumentIds: [],
      relatedScenarioIds: [],
      affectedMetrics: ["borrowingCapacity", "houseReadinessScore"],
      beforeValues: { borrowingCapacity: balanceSheet.borrowingCapacity - 18_000, houseReadinessScore: Math.max(0, balanceSheet.houseReadinessScore - 4) },
      afterValues: { borrowingCapacity: balanceSheet.borrowingCapacity, houseReadinessScore: balanceSheet.houseReadinessScore },
      impact: 18_000,
    }),
  ];
}

function decisionEvents(decisions: AiDecision[]): FinancialTimelineEvent[] {
  return decisions.map((decision) => event({
    id: `timeline-decision-${decision.id}`,
    timestamp: GENERATED_AT,
    category: "Decision",
    type: "decision created",
    title: decision.title,
    summary: decision.reason,
    whyItHappened: decision.whyThisMatters,
    deterministicCause: `${decision.source} produced a ranked recommendation from current verified data.`,
    evidence: decision.evidence.map((item, index) => evidence({
      id: `evidence-${decision.id}-${index + 1}`,
      sourceType: "calculation",
      sourceId: `${decision.id}:evidence:${index + 1}`,
      title: decision.sourceData[index] ?? decision.source,
      location: decision.actionHref,
      factUsed: item,
      confidence: decision.confidence,
      lastVerifiedAt: GENERATED_AT,
    })),
    calculationSnapshotId: `decision:${decision.id}:${GENERATED_AT.slice(0, 10)}`,
    confidence: decision.confidence,
    relatedDecisionIds: [decision.id],
    relatedWorkflowIds: [`workflow-${decision.id}`],
    relatedDocumentIds: [],
    relatedScenarioIds: [],
    affectedMetrics: metricsForDecision(decision),
    beforeValues: {},
    afterValues: { expectedImpact: decision.expectedImpact, priority: decision.priority },
    impact: decision.monthlySavingsEstimate,
  }));
}

function workflowEvents(executions: ActionWorkflowExecution[]): FinancialTimelineEvent[] {
  return executions.flatMap((raw) => {
    const execution = WorkflowExecutionEngine.normalise(raw);
    const workflowId = execution.id.replace(/^execution-/, "workflow-");
    const events: FinancialTimelineEvent[] = [
      event({
        id: `timeline-workflow-started-${execution.id}`,
        timestamp: execution.createdAt,
        category: "Workflow",
        type: "workflow started",
        title: `${execution.title} started`,
        summary: execution.objective,
        whyItHappened: "A verified recommendation or objective was converted into an execution plan.",
        deterministicCause: `Workflow template ${execution.workflowDefinitionId}@${execution.workflowVersion} was instantiated.`,
        evidence: [evidence({
          id: `evidence-workflow-${execution.id}`,
          sourceType: "workflow",
          sourceId: execution.id,
          title: execution.title,
          location: `/action-workflows?workflowId=${workflowId}`,
          factUsed: `Expected impact ${execution.expectedImpact}; outcome status ${execution.outcomeStatus}`,
          confidence: execution.confidence,
          lastVerifiedAt: execution.createdAt,
        })],
        calculationSnapshotId: execution.calculationSnapshotId,
        confidence: execution.confidence,
        relatedDecisionIds: execution.sourceDecisionId ? [execution.sourceDecisionId] : [],
        relatedWorkflowIds: [workflowId],
        relatedDocumentIds: [],
        relatedScenarioIds: execution.sourceScenarioId ? [execution.sourceScenarioId] : [],
        affectedMetrics: ["workflowProgress"],
        beforeValues: { workflowProgress: 0 },
        afterValues: { workflowProgress: 1 },
        impact: 0,
      }),
    ];
    for (const item of execution.evidence) {
      events.push(event({
        id: `timeline-workflow-evidence-${item.id}`,
        timestamp: item.capturedAt,
        category: "Workflow",
        type: "workflow evidence received",
        title: "Workflow evidence received",
        summary: `${item.source} was recorded with ${item.verificationStatus.toLowerCase()} status.`,
        whyItHappened: "Evidence was added to support execution progress or outcome verification.",
        deterministicCause: "Workflow evidence store appended an immutable evidence record.",
        evidence: [workflowEvidence(item)],
        calculationSnapshotId: execution.calculationSnapshotId,
        confidence: item.confidence,
        relatedDecisionIds: execution.sourceDecisionId ? [execution.sourceDecisionId] : [],
        relatedWorkflowIds: [workflowId],
        relatedDocumentIds: item.documentId ? [item.documentId] : [],
        relatedScenarioIds: execution.sourceScenarioId ? [execution.sourceScenarioId] : [],
        affectedMetrics: item.satisfiesRequirementIds,
        beforeValues: { evidenceStatus: null },
        afterValues: { evidenceStatus: item.verificationStatus },
        impact: 0,
      }));
    }
    if (execution.outcomeStatus === "Verified" || execution.outcomeStatus === "Partially Verified" || execution.outcomeStatus === "Not Achieved") {
      events.push(event({
        id: `timeline-workflow-outcome-${execution.id}`,
        timestamp: execution.verifiedAt ?? execution.lastUpdatedAt,
        category: "Workflow",
        type: execution.outcomeStatus === "Not Achieved" ? "workflow reopened" : "workflow verified",
        title: `${execution.title} outcome ${execution.outcomeStatus.toLowerCase()}`,
        summary: execution.outcomeVerifications[0]?.explanation ?? "Workflow outcome was checked against post-action evidence.",
        whyItHappened: "Post-action evidence and deterministic recalculation were compared with the expected outcome.",
        deterministicCause: "WorkflowExecutionEngine evaluated actual value, tolerance, evidence and recalculation status.",
        evidence: execution.evidence.map(workflowEvidence),
        calculationSnapshotId: execution.verificationSnapshotId,
        confidence: execution.outcomeVerifications[0]?.confidence ?? execution.confidence,
        relatedDecisionIds: execution.sourceDecisionId ? [execution.sourceDecisionId] : [],
        relatedWorkflowIds: [workflowId],
        relatedDocumentIds: execution.evidence.map((item) => item.documentId).filter((id): id is string => Boolean(id)),
        relatedScenarioIds: execution.sourceScenarioId ? [execution.sourceScenarioId] : [],
        affectedMetrics: ["realisedImpact", ...execution.affectedEngines],
        beforeValues: { expectedImpact: execution.expectedImpact },
        afterValues: { realisedImpact: execution.realisedImpact, outcomeStatus: execution.outcomeStatus },
        impact: parseMoney(execution.realisedImpact),
      }));
    }
    return events;
  });
}

function twinEvents(twinState: TwinPersistedState): FinancialTimelineEvent[] {
  const scenarioEvents = twinState.scenarios.map((scenario) => event({
    id: `timeline-scenario-${scenario.id}`,
    timestamp: scenario.createdAt,
    category: "Digital Twin",
    type: "scenario created",
    title: `${scenario.name} scenario created`,
    summary: `${scenario.events.length} future events modelled over ${scenario.horizonYears} years.`,
    whyItHappened: "A Digital Twin scenario was created for deterministic simulation.",
    deterministicCause: "Scenario Manager stored events, probability and time horizon.",
    evidence: [evidence({
      id: `evidence-scenario-${scenario.id}`,
      sourceType: "scenario",
      sourceId: scenario.id,
      title: scenario.name,
      location: "/digital-twin",
      factUsed: `${scenario.events.length} events; probability ${Math.round(scenario.probability * 100)}%`,
      confidence: "Medium",
      lastVerifiedAt: scenario.createdAt,
    })],
    calculationSnapshotId: null,
    confidence: "Medium",
    relatedDecisionIds: [],
    relatedWorkflowIds: [],
    relatedDocumentIds: [],
    relatedScenarioIds: [scenario.id],
    affectedMetrics: ["scenarioCount"],
    beforeValues: { scenarioCount: null },
    afterValues: { scenarioCount: twinState.scenarios.length },
    impact: 0,
  }));
  const simulationEvents = twinState.simulationHistory.flatMap((simulation) => [
    simulationEvent(simulation, twinState.twin),
    ...simulation.futureTimelineEvents.map((item) => twinTimelineEvent(item, simulation)),
  ]);
  return [...scenarioEvents, ...simulationEvents];
}

function simulationEvent(simulation: TwinSimulationOutput, twin: FinancialDigitalTwin): FinancialTimelineEvent {
  return event({
    id: `timeline-simulation-${simulation.scenarioId}`,
    timestamp: simulation.calculatedAt,
    category: "Digital Twin",
    type: "simulation completed",
    title: `${simulation.scenarioName} simulation completed`,
    summary: `Projected net worth ${formatMoney(simulation.netWorth)} and retirement score ${simulation.retirementScore}/100.`,
    whyItHappened: "A Digital Twin scenario was recalculated from Vault facts and saved assumptions.",
    deterministicCause: "FinancialDigitalTwinEngine simulated cash flow, debt, tax, goals and assets over the scenario horizon.",
    evidence: simulation.evidence.map((item, index) => evidence({
      id: `evidence-simulation-${simulation.scenarioId}-${index + 1}`,
      sourceType: item.toLowerCase().includes("tax rules") ? "rule" : "calculation",
      sourceId: `${simulation.scenarioId}:evidence:${index + 1}`,
      title: simulation.scenarioName,
      location: "/digital-twin",
      factUsed: item,
      confidence: simulation.confidence,
      lastVerifiedAt: simulation.calculatedAt,
    })),
    calculationSnapshotId: `digital-twin:${simulation.scenarioId}:${simulation.calculatedAt.slice(0, 10)}`,
    confidence: simulation.confidence,
    relatedDecisionIds: simulation.decisions.map((decision) => decision.id),
    relatedWorkflowIds: [],
    relatedDocumentIds: [],
    relatedScenarioIds: [simulation.scenarioId],
    affectedMetrics: ["netWorth", "cashFlow", "borrowingCapacity", "taxPaid", "debt", "retirementScore"],
    beforeValues: { netWorth: startingNetWorth(twin), cashFlow: twin.cashFlow.income - twin.cashFlow.expenses, borrowingCapacity: null, taxPaid: null, debt: totalDebt(twin), retirementScore: twin.goals.retirement },
    afterValues: { netWorth: simulation.netWorth, cashFlow: simulation.cashFlow, borrowingCapacity: simulation.borrowingCapacity, taxPaid: simulation.taxPaid, debt: simulation.debt, retirementScore: simulation.retirementScore },
    impact: simulation.netWorth - startingNetWorth(twin),
  });
}

function twinTimelineEvent(item: TwinTimelineEvent, simulation: TwinSimulationOutput): FinancialTimelineEvent {
  const timestamp = `${item.year}-01-01T00:00:00.000Z`;
  return event({
    id: `timeline-twin-${simulation.scenarioId}-${item.id}`,
    timestamp,
    category: item.domains.includes("goals") ? "Goals" : "Digital Twin",
    type: item.title.toLowerCase().includes("financial independence") ? "goal milestone reached" : item.id.startsWith("scenario-") ? "scenario updated" : "simulation completed",
    title: item.title,
    summary: item.description,
    whyItHappened: "A Digital Twin projection crossed a deterministic milestone threshold.",
    deterministicCause: "Milestone engine inspected yearly simulation outputs.",
    evidence: [evidence({
      id: `evidence-twin-event-${simulation.scenarioId}-${item.id}`,
      sourceType: "scenario",
      sourceId: simulation.scenarioId,
      title: simulation.scenarioName,
      location: "/digital-twin",
      factUsed: `${item.title}: ${formatMoney(item.financialImpact)}`,
      confidence: item.confidence,
      lastVerifiedAt: simulation.calculatedAt,
    })],
    calculationSnapshotId: `digital-twin:${simulation.scenarioId}:${simulation.calculatedAt.slice(0, 10)}`,
    confidence: item.confidence,
    relatedDecisionIds: simulation.decisions.map((decision) => decision.id),
    relatedWorkflowIds: [],
    relatedDocumentIds: [],
    relatedScenarioIds: [simulation.scenarioId],
    affectedMetrics: item.domains,
    beforeValues: {},
    afterValues: { financialImpact: item.financialImpact },
    impact: item.financialImpact,
  });
}

function dailyReviewEvents(latest?: DailyReviewHistoryRecord | null): FinancialTimelineEvent[] {
  if (!latest) return [];
  const review = latest.review;
  const base = event({
    id: `timeline-daily-review-${review.id}`,
    timestamp: review.createdAt,
    category: "System" as const,
    type: "Daily Review generated" as const,
    title: "Daily Review generated",
    summary: review.overallSummary,
    whyItHappened: "Daily Review compared the previous verified state with the current verified state.",
    deterministicCause: "DailyReviewEngine produced deterministic findings after materiality and suppression rules.",
    evidence: review.findings.flatMap((finding) => finding.evidence.map((item, index) => evidence({
      id: `evidence-review-${finding.id}-${index + 1}`,
      sourceType: item.classification === "verified-fact" ? "calculation" : "system",
      sourceId: item.sourceId,
      title: item.sourceTitle,
      location: item.sourceLocation,
      factUsed: item.factUsed,
      confidence: item.confidence,
      lastVerifiedAt: item.lastVerifiedAt,
    }))),
    calculationSnapshotId: review.currentSnapshotId,
    confidence: review.failures.length ? "Low" : "High",
    relatedDecisionIds: review.generatedDecisions.map((decision) => decision.title),
    relatedWorkflowIds: [],
    relatedDocumentIds: [],
    relatedScenarioIds: [],
    affectedMetrics: ["netWorth", "cashFlow", "borrowingCapacity", "retirementScore", "knowledgeHealth"],
    beforeValues: { netWorth: latest.previousSnapshot.netWorth, cashFlow: latest.previousSnapshot.cashFlowSurplus, borrowingCapacity: latest.previousSnapshot.borrowingCapacity, retirementScore: latest.previousSnapshot.retirementScore, knowledgeHealth: latest.previousSnapshot.knowledgeHealthScore },
    afterValues: { netWorth: latest.currentSnapshot.netWorth, cashFlow: latest.currentSnapshot.cashFlowSurplus, borrowingCapacity: latest.currentSnapshot.borrowingCapacity, retirementScore: latest.currentSnapshot.retirementScore, knowledgeHealth: latest.currentSnapshot.knowledgeHealthScore },
    impact: review.netWorthChange + review.cashFlowChange + review.borrowingChange,
  });
  const findings = review.findings.map((finding) => event({
    id: `timeline-finding-${finding.id}`,
    timestamp: finding.lastObservedAt,
    category: finding.category === "goals" ? "Goals" : finding.category === "rule-freshness" ? "Knowledge" : "Financial Position",
    type: finding.category === "goals" ? "goal completion forecast changed" : finding.category === "rule-freshness" ? "rule stale" : finding.category === "documents" ? "confidence changed" : finding.type === "positive-change" ? "net worth changed" : "borrowing changed",
    title: finding.title,
    summary: finding.summary,
    whyItHappened: finding.whyItMatters,
    deterministicCause: `${finding.sourceEngine} created this finding after threshold and suppression checks.`,
    evidence: finding.evidence.map((item, index) => evidence({
      id: `evidence-finding-${finding.id}-${index + 1}`,
      sourceType: "calculation",
      sourceId: item.sourceId,
      title: item.sourceTitle,
      location: item.sourceLocation,
      factUsed: item.factUsed,
      confidence: item.confidence,
      lastVerifiedAt: item.lastVerifiedAt,
    })),
    calculationSnapshotId: finding.calculationSnapshotId,
    confidence: finding.confidence,
    relatedDecisionIds: [],
    relatedWorkflowIds: [],
    relatedDocumentIds: finding.evidence.map((item) => item.sourceId).filter((id) => id.startsWith("doc")),
    relatedScenarioIds: [],
    affectedMetrics: [finding.category],
    beforeValues: { [finding.category]: finding.previousValue },
    afterValues: { [finding.category]: finding.currentValue },
    impact: finding.absoluteChange,
  }));
  return [base, ...findings];
}

function ruleEvents(): FinancialTimelineEvent[] {
  return TAX_RULE_REFERENCES.slice(0, 5).map((rule) => event({
    id: `timeline-rule-${rule.id}`,
    timestamp: `${rule.lastVerifiedAt}T00:00:00.000Z`,
    category: "Knowledge",
    type: rule.reviewStatus === "stale" ? "rule stale" : "rule updated",
    title: `${rule.sourceTitle} ${rule.reviewStatus}`,
    summary: rule.summary,
    whyItHappened: "Tax-rule provenance was inspected for structure and tax explainability.",
    deterministicCause: "TaxRuleReference record supplied version, jurisdiction, freshness and review status.",
    evidence: [evidence({
      id: `evidence-rule-${rule.id}`,
      sourceType: "rule",
      sourceId: rule.id,
      title: rule.sourceTitle,
      location: rule.sourceUrl,
      factUsed: rule.summary,
      confidence: rule.confidence,
      lastVerifiedAt: rule.lastVerifiedAt,
    })],
    calculationSnapshotId: null,
    confidence: rule.confidence,
    relatedDecisionIds: ["structure-lifecycle-review"],
    relatedWorkflowIds: ["workflow-structure-lifecycle-review"],
    relatedDocumentIds: [],
    relatedScenarioIds: [],
    affectedMetrics: ["ruleFreshness"],
    beforeValues: { ruleVersion: null },
    afterValues: { ruleVersion: rule.ruleVersion, jurisdiction: rule.jurisdiction },
    impact: rule.professionalReviewRequired ? -1 : 0,
  }));
}

export type FinancialTimelineBuildInputs = {
  aiInputs?: ReturnType<typeof gatherAICfoInputs>;
  decisions?: AiDecision[];
  workflowExecutions?: ActionWorkflowExecution[];
  latestDailyReview?: DailyReviewHistoryRecord | null;
};

export function buildFinancialTimelineState(filter: TimelineFilter = {}, persistedInputs: FinancialTimelineBuildInputs = {}): FinancialTimelineState {
  const inputs = persistedInputs.aiInputs ?? gatherAICfoInputs();
  const decisions = persistedInputs.decisions ?? (inputs.decisions.length ? inputs.decisions : buildAiDecisions({ vault: inputs.vault, balanceSheet: inputs.balanceSheet, housing: inputs.housing }));
  const workflowExecutions = persistedInputs.workflowExecutions ?? decisions.map((decision) => WorkflowExecutionEngine.createFromDecision(decision));
  const allEvents = [
    ...documentEvents(inputs.vault.uploaded_documents),
    ...balanceSheetEvents(inputs.balanceSheet),
    ...decisionEvents(decisions),
    ...workflowEvents(workflowExecutions),
    ...twinEvents(inputs.twinState),
    ...dailyReviewEvents(persistedInputs.latestDailyReview),
    ...ruleEvents(),
  ];
  const events = uniqueEvents(allEvents)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() || a.id.localeCompare(b.id));
  const filteredEvents = ExplainabilityEngine.filter(events, filter);
  const journey = {
    yearlySummaries: ExplainabilityEngine.yearlySummaries(events),
    milestones: ExplainabilityEngine.detectMilestones(events),
  };
  const explanations = decisions.map((decision) => ExplainabilityEngine.explainRecommendation(decision, events));
  return freezeDeep({
    generatedAt: GENERATED_AT,
    events: filteredEvents,
    journey,
    explanations,
  });
}

export function explainRecommendationById(decisionId: string): RecommendationExplanation | null {
  const state = buildFinancialTimelineState();
  return state.explanations.find((item) => item.decisionId === decisionId) ?? null;
}

function uniqueEvents(events: FinancialTimelineEvent[]): FinancialTimelineEvent[] {
  const byId = new Map<string, FinancialTimelineEvent>();
  for (const item of events) byId.set(item.id, item);
  return [...byId.values()];
}

function metricsForDecision(decision: AiDecision): string[] {
  if (decision.category === "Mortgage") return ["cashFlow", "borrowingCapacity", "debt"];
  if (decision.category === "Housing") return ["borrowingCapacity", "houseReadinessScore"];
  if (decision.category === "Financial Vault") return ["vaultConfidence", "documentCoverage"];
  if (decision.category === "Cash Flow" || decision.category === "Spending") return ["cashFlow", "spending"];
  if (decision.category === "Subscriptions") return ["cashFlow", "subscriptions"];
  if (decision.category === "Goals") return ["goalProgress"];
  if (decision.category === "Investments") return ["investments", "netWorth"];
  return ["financialPosition"];
}

function parseMoney(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString()}`;
}

function startingNetWorth(twin: FinancialDigitalTwin): number {
  return Object.values(twin.assets).reduce((sum, value) => sum + value, 0) - totalDebt(twin);
}

function totalDebt(twin: FinancialDigitalTwin): number {
  return Object.values(twin.liabilities).reduce((sum, value) => sum + value, 0);
}

export const TimelineEngine = {
  build: buildFinancialTimelineState,
  explainRecommendation: explainRecommendationById,
  compareDates: ExplainabilityEngine.compareDates,
  whyChanged: ExplainabilityEngine.explainMetricChange,
  counterfactual: ExplainabilityEngine.counterfactualWithoutEvent,
  filter: ExplainabilityEngine.filter,
};
