import type { AiDecision } from "@/lib/aiDecisionCentre";
import type {
  CounterfactualResult,
  FinancialTimelineEvent,
  MetricChangeExplanation,
  RecommendationExplanation,
  TimelineCategory,
  TimelineConfidence,
  TimelineDateComparison,
  TimelineEvidence,
  TimelineFilter,
  TimelineMetricChange,
  TimelineMilestone,
  YearlyFinancialSummary,
} from "@/lib/financialTimeline";

function confidenceValue(confidence: TimelineConfidence): number {
  if (confidence === "High") return 3;
  if (confidence === "Medium") return 2;
  return 1;
}

function minConfidence(values: TimelineConfidence[]): TimelineConfidence {
  const min = Math.min(...values.map(confidenceValue));
  if (min >= 3) return "High";
  if (min >= 2) return "Medium";
  return "Low";
}

function metricChange(event: FinancialTimelineEvent, metric: string): TimelineMetricChange | null {
  if (!(metric in event.beforeValues) && !(metric in event.afterValues)) return null;
  const before = event.beforeValues[metric] ?? null;
  const after = event.afterValues[metric] ?? null;
  const delta = typeof before === "number" && typeof after === "number" ? after - before : null;
  return { metric, before, after, delta, unit: metric.includes("score") || metric.includes("readiness") ? "score" : metric.includes("confidence") ? "%" : "$" };
}

function uniqueEvidence(events: FinancialTimelineEvent[]): TimelineEvidence[] {
  const byId = new Map<string, TimelineEvidence>();
  for (const event of events) for (const evidence of event.evidence) byId.set(evidence.id, evidence);
  return [...byId.values()];
}

export function filterTimelineEvents(events: FinancialTimelineEvent[], filter: TimelineFilter = {}): FinancialTimelineEvent[] {
  return events.filter((event) => {
    if (filter.category && filter.category !== "all" && event.category !== filter.category) return false;
    if (filter.confidence && filter.confidence !== "all" && event.confidence !== filter.confidence) return false;
    if (filter.year && filter.year !== "all" && new Date(event.timestamp).getUTCFullYear() !== filter.year) return false;
    if (filter.workflowId && !event.relatedWorkflowIds.includes(filter.workflowId)) return false;
    if (filter.scenarioId && !event.relatedScenarioIds.includes(filter.scenarioId)) return false;
    if (filter.documentId && !event.relatedDocumentIds.includes(filter.documentId)) return false;
    if (filter.impact === "material" && Math.abs(event.impact) < 500) return false;
    if (filter.impact === "positive" && event.impact <= 0) return false;
    if (filter.impact === "negative" && event.impact >= 0) return false;
    return true;
  });
}

export function compareTimelineDates(events: FinancialTimelineEvent[], from: string, to: string): TimelineDateComparison {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  const inRange = events.filter((event) => {
    const at = new Date(event.timestamp).getTime();
    return at >= Math.min(fromTime, toTime) && at <= Math.max(fromTime, toTime);
  });
  const metrics = new Map<string, TimelineMetricChange>();
  for (const event of inRange) {
    for (const metric of event.affectedMetrics) {
      const change = metricChange(event, metric);
      if (!change) continue;
      const existing = metrics.get(metric);
      if (!existing) {
        metrics.set(metric, change);
      } else {
        metrics.set(metric, {
          ...change,
          before: existing.before,
          delta: typeof existing.delta === "number" && typeof change.delta === "number" ? existing.delta + change.delta : change.delta,
        });
      }
    }
  }
  const causes = inRange
    .filter((event) => event.deterministicCause.length > 0)
    .map((event) => ({ title: event.title, contribution: event.impact, evidence: event.evidence, confidence: event.confidence }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const confidence = inRange.length ? minConfidence(inRange.map((event) => event.confidence)) : "Low";
  const impact = inRange.reduce((sum, event) => sum + event.impact, 0);
  return {
    from,
    to,
    summary: inRange.length ? `${inRange.length} timeline events changed the model between the selected dates.` : "No timeline events changed the model between the selected dates.",
    positionChanges: [...metrics.values()].sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)),
    causes,
    evidence: uniqueEvidence(inRange),
    impact,
    confidence,
    eventIds: inRange.map((event) => event.id),
  };
}

export function explainMetricChange(events: FinancialTimelineEvent[], metric: string): MetricChangeExplanation {
  const related = events.filter((event) => event.affectedMetrics.includes(metric));
  const causes = related
    .map((event) => ({
      cause: event.deterministicCause || event.whyItHappened,
      contribution: typeof event.afterValues[metric] === "number" && typeof event.beforeValues[metric] === "number"
        ? Number(event.afterValues[metric]) - Number(event.beforeValues[metric])
        : event.impact,
      evidence: event.evidence,
      confidence: event.confidence,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return {
    metric,
    summary: causes.length ? `${metric} changed because ${causes[0].cause.toLowerCase()}.` : `${metric} has no deterministic change event in the current timeline.`,
    causes,
    confidence: causes.length ? minConfidence(causes.map((cause) => cause.confidence)) : "Low",
  };
}

export function buildRecommendationExplanation(decision: AiDecision, events: FinancialTimelineEvent[]): RecommendationExplanation {
  const related = events.filter((event) => event.relatedDecisionIds.includes(decision.id) || event.evidence.some((evidence) => decision.evidence.includes(evidence.factUsed) || decision.sourceData.includes(evidence.title)));
  const factsUsed = uniqueEvidence(related).filter((evidence) => evidence.sourceType !== "rule");
  const rulesUsed = uniqueEvidence(related).filter((evidence) => evidence.sourceType === "rule");
  const changed = related.flatMap((event) => event.affectedMetrics.map((metric) => metricChange(event, metric)).filter((item): item is TimelineMetricChange => Boolean(item)));
  return {
    decisionId: decision.id,
    title: decision.title,
    why: decision.whyThisMatters,
    engines: [...new Set([decision.source, ...related.map((event) => event.category)])],
    factsUsed,
    assumptions: [...decision.requiredData, "Recommendation ranking is deterministic and educational only."],
    rulesUsed,
    changedSinceLastCalculation: changed,
    couldChangeRecommendation: [
      ...decision.requiredData.map((item) => `${item} changes materially`),
      "new evidence lowers confidence",
      "a related workflow verifies or fails the expected outcome",
    ],
    confidence: decision.confidence,
    timelineEventIds: related.map((event) => event.id),
  };
}

export function counterfactualWithoutEvent(event: FinancialTimelineEvent): CounterfactualResult {
  return {
    eventId: event.id,
    title: `Without ${event.title.toLowerCase()}`,
    summary: event.affectedMetrics.length
      ? `Removing this event would reverse the recorded changes for ${event.affectedMetrics.slice(0, 3).join(", ")} in the explanatory model.`
      : "This event has no quantified counterfactual in v1.",
    affectedMetrics: event.affectedMetrics.map((metric) => {
      const change = metricChange(event, metric);
      return change ? { ...change, before: change.after, after: change.before, delta: typeof change.delta === "number" ? -change.delta : null } : { metric, before: null, after: null, delta: null, unit: "text" };
    }),
    confidence: event.confidence,
    assumptions: ["Counterfactual uses recorded before/after values only.", "Digital Twin projections are not recalculated by GPT."],
  };
}

export function detectTimelineMilestones(events: FinancialTimelineEvent[]): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    const year = new Date(event.timestamp).getUTCFullYear();
    const add = (id: string, title: string, summary: string, category: TimelineCategory = event.category) => {
      if (seen.has(id)) return;
      seen.add(id);
      milestones.push({ id, year, title, summary, category, confidence: event.confidence, evidence: event.evidence });
    };
    const investmentAfter = Number(event.afterValues.investments ?? event.afterValues.investmentBalance ?? 0);
    const debtBefore = Number(event.beforeValues.debt ?? event.beforeValues.mortgageBalance ?? 0);
    const debtAfter = Number(event.afterValues.debt ?? event.afterValues.mortgageBalance ?? 0);
    const emergencyAfter = Number(event.afterValues.emergencyRunwayMonths ?? 0);
    if (investmentAfter >= 100_000) add("first-100k-invested", "First $100k invested", "Investment balances reached the first six-figure milestone.", "Goals");
    if (debtBefore > 0 && debtAfter <= debtBefore * 0.8) add("mortgage-below-80", "Mortgage below 80%", "Debt fell below 80% of the recorded baseline.", "Financial Position");
    if (debtBefore > 0 && debtAfter <= debtBefore * 0.5) add("mortgage-below-50", "Mortgage below 50%", "Debt fell below 50% of the recorded baseline.", "Financial Position");
    if (emergencyAfter >= 5) add("emergency-fund-reached", "Emergency fund reached", "Emergency runway reached the configured safety band.", "Goals");
    if (event.title.toLowerCase().includes("financial independence")) add("financial-independence", "Financial independence", event.summary, "Goals");
    if (event.title.toLowerCase().includes("retirement")) add(`retirement-${event.id}`, "Retirement readiness", event.summary, "Goals");
    if (event.title.toLowerCase().includes("diversification")) add(`diversification-${event.id}`, "Investment diversification", event.summary, "Financial Position");
    if (event.title.toLowerCase().includes("passive income")) add(`passive-income-${event.id}`, "Passive income milestone", event.summary, "Goals");
    if (event.title.toLowerCase().includes("goal") && event.title.toLowerCase().includes("complete")) add(`goal-${event.id}`, "Goal completion", event.summary, "Goals");
    if (debtBefore - debtAfter >= 25_000) add(`debt-reduction-${event.id}`, "Major debt reduction", event.summary, "Financial Position");
  }
  return milestones.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
}

export function buildYearlyFinancialSummaries(events: FinancialTimelineEvent[]): YearlyFinancialSummary[] {
  const years = new Map<number, FinancialTimelineEvent[]>();
  for (const event of events) {
    const year = new Date(event.timestamp).getUTCFullYear();
    years.set(year, [...(years.get(year) ?? []), event]);
  }
  return [...years.entries()].map(([year, yearEvents]) => {
    const metricDelta = (metric: string) => yearEvents.reduce((sum, event) => {
      const change = metricChange(event, metric);
      return sum + (change?.delta ?? 0);
    }, 0);
    const decisions = yearEvents.filter((event) => event.category === "Decision").sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    const improvements = yearEvents.filter((event) => event.impact > 0).sort((a, b) => b.impact - a.impact);
    const verifiedDocuments = yearEvents.filter((event) => event.type === "fact verified" || event.type === "document uploaded").length;
    const goalsCompleted = yearEvents.filter((event) => event.type === "goal milestone reached").length;
    const netWorthChange = metricDelta("netWorth");
    const borrowingChange = metricDelta("borrowingCapacity");
    const aiSummary = [
      `In ${year}, Vireon recorded ${yearEvents.length} material financial history events.`,
      netWorthChange ? `Net worth changed by ${formatSigned(netWorthChange)}.` : "",
      borrowingChange ? `Borrowing changed by ${formatSigned(borrowingChange)}.` : "",
      decisions[0] ? `Largest decision: ${decisions[0].title}.` : "",
    ].filter(Boolean).join(" ");
    return {
      year,
      netWorthChange,
      debtChange: metricDelta("debt") || metricDelta("mortgageBalance"),
      borrowingChange,
      superChange: metricDelta("super"),
      verifiedDocuments,
      goalsCompleted,
      largestDecision: decisions[0]?.title ?? null,
      largestImprovement: improvements[0]?.title ?? null,
      aiSummary,
      eventIds: yearEvents.map((event) => event.id),
    };
  }).sort((a, b) => b.year - a.year);
}

export function validateHistoricalSummary(draft: string | null, events: FinancialTimelineEvent[]): string {
  if (!draft) return "";
  const evidenceTerms = new Set<string>();
  for (const event of events) {
    for (const text of [event.title, event.summary, event.deterministicCause, ...event.affectedMetrics]) {
      for (const term of text.toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length >= 5)) evidenceTerms.add(term);
    }
  }
  const supportedSentences = draft
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .filter((sentence) => sentence.toLowerCase().split(/[^a-z0-9]+/).some((term) => evidenceTerms.has(term)));
  return supportedSentences.length > 0
    ? supportedSentences.join(" ")
    : "No additional historical events are supported by the current timeline evidence.";
}

function formatSigned(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString()}`;
}

export const ExplainabilityEngine = {
  filter: filterTimelineEvents,
  compareDates: compareTimelineDates,
  explainMetricChange,
  explainRecommendation: buildRecommendationExplanation,
  counterfactualWithoutEvent,
  detectMilestones: detectTimelineMilestones,
  yearlySummaries: buildYearlyFinancialSummaries,
  validateHistoricalSummary,
};
