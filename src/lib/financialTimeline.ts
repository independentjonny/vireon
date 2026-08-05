export type TimelineConfidence = "High" | "Medium" | "Low";

export type TimelineCategory =
  | "Financial Fact"
  | "Financial Position"
  | "Decision"
  | "Workflow"
  | "Digital Twin"
  | "Goals"
  | "Knowledge"
  | "System";

export type TimelineEventType =
  | "document uploaded"
  | "fact verified"
  | "fact corrected"
  | "confidence changed"
  | "conflict resolved"
  | "net worth changed"
  | "borrowing changed"
  | "retirement projection changed"
  | "cash flow changed"
  | "investment allocation changed"
  | "decision created"
  | "decision updated"
  | "decision actioned"
  | "decision dismissed"
  | "decision reopened"
  | "workflow started"
  | "workflow milestone"
  | "workflow blocked"
  | "workflow evidence received"
  | "workflow verified"
  | "workflow reopened"
  | "workflow completed"
  | "scenario created"
  | "scenario updated"
  | "scenario compared"
  | "simulation completed"
  | "goal milestone reached"
  | "goal contribution changed"
  | "goal completion forecast changed"
  | "rule updated"
  | "rule stale"
  | "knowledge confidence changed"
  | "Daily Review generated"
  | "AI CFO advice generated"
  | "validation snapshot"
  | "platform snapshot";

export type TimelineEvidence = {
  id: string;
  sourceType: "transaction" | "document" | "asset" | "liability" | "goal" | "investment" | "subscription" | "tax" | "employment" | "lending" | "property" | "insurance" | "calculation" | "rule" | "workflow" | "decision" | "scenario" | "system";
  sourceId: string;
  title: string;
  location: string;
  factUsed: string;
  confidence: TimelineConfidence;
  lastVerifiedAt: string;
};

export type TimelineMetricChange = {
  metric: string;
  before: number | string | null;
  after: number | string | null;
  delta: number | null;
  unit: "$" | "%" | "score" | "count" | "text";
};

export type FinancialTimelineEvent = {
  id: string;
  timestamp: string;
  category: TimelineCategory;
  type: TimelineEventType;
  title: string;
  summary: string;
  whyItHappened: string;
  deterministicCause: string;
  evidence: TimelineEvidence[];
  calculationSnapshotId: string | null;
  confidence: TimelineConfidence;
  relatedDecisionIds: string[];
  relatedWorkflowIds: string[];
  relatedDocumentIds: string[];
  relatedScenarioIds: string[];
  affectedMetrics: string[];
  beforeValues: Record<string, number | string | null>;
  afterValues: Record<string, number | string | null>;
  impact: number;
  immutable: true;
};

export type TimelineFilter = {
  category?: TimelineCategory | "all";
  confidence?: TimelineConfidence | "all";
  impact?: "all" | "material" | "positive" | "negative";
  workflowId?: string;
  goalId?: string;
  scenarioId?: string;
  documentId?: string;
  year?: number | "all";
};

export type RecommendationExplanation = {
  decisionId: string;
  title: string;
  why: string;
  engines: string[];
  factsUsed: TimelineEvidence[];
  assumptions: string[];
  rulesUsed: TimelineEvidence[];
  changedSinceLastCalculation: TimelineMetricChange[];
  couldChangeRecommendation: string[];
  confidence: TimelineConfidence;
  timelineEventIds: string[];
};

export type TimelineDateComparison = {
  from: string;
  to: string;
  summary: string;
  positionChanges: TimelineMetricChange[];
  causes: Array<{
    title: string;
    contribution: number;
    evidence: TimelineEvidence[];
    confidence: TimelineConfidence;
  }>;
  evidence: TimelineEvidence[];
  impact: number;
  confidence: TimelineConfidence;
  eventIds: string[];
};

export type MetricChangeExplanation = {
  metric: string;
  summary: string;
  causes: Array<{
    cause: string;
    contribution: number;
    evidence: TimelineEvidence[];
    confidence: TimelineConfidence;
  }>;
  confidence: TimelineConfidence;
};

export type CounterfactualResult = {
  eventId: string;
  title: string;
  summary: string;
  affectedMetrics: TimelineMetricChange[];
  confidence: TimelineConfidence;
  assumptions: string[];
};

export type YearlyFinancialSummary = {
  year: number;
  netWorthChange: number;
  debtChange: number;
  borrowingChange: number;
  superChange: number;
  verifiedDocuments: number;
  goalsCompleted: number;
  largestDecision: string | null;
  largestImprovement: string | null;
  aiSummary: string;
  eventIds: string[];
};

export type TimelineMilestone = {
  id: string;
  year: number;
  title: string;
  summary: string;
  category: TimelineCategory;
  confidence: TimelineConfidence;
  evidence: TimelineEvidence[];
};

export type FinancialJourney = {
  yearlySummaries: YearlyFinancialSummary[];
  milestones: TimelineMilestone[];
};

export type FinancialTimelineState = {
  generatedAt: string;
  events: FinancialTimelineEvent[];
  journey: FinancialJourney;
  explanations: RecommendationExplanation[];
};
