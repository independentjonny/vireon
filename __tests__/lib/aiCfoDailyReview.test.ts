import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  DailyReviewEngine,
  DEFAULT_DAILY_REVIEW_SETTINGS,
  applySuppression,
  compareDailySnapshots,
  createCurrentDailyReviewSnapshot,
  createPreviousDailyReviewSnapshot,
  resolveFindingsAutomatically,
  type DailyReviewSnapshot,
} from "../../src/lib/aiCfoDailyReview.ts";
import { getDailyReviewState, persistDailyReviewHistory, runAndPersistDailyReview, updateDailyReviewSettings } from "../../src/lib/aiCfoDailyReviewStore.ts";
import { gatherAICfoInputs } from "../../src/lib/aiCfoRuntime.ts";
import type { AICfoInputs } from "../../src/lib/aiCfo.ts";
import { StructureComparisonEngine, TAX_RULE_REFERENCES } from "../../src/lib/structureComparisonEngine.ts";
import { buildBriefingHeadline, buildExecutiveSummary, buildSystemHealthSummary, getReviewDirection, selectFeaturedFinding, selectFinancialWins, selectPriorityActions } from "../../src/lib/dailyReviewPresentation.ts";
import { buildDashboardBriefing, dashboardActionSourceKey, selectDashboardSecondaryActions, selectDashboardTopPriority, selectVerifiedFinancialWins } from "../../src/lib/dashboardPresentation.ts";
import { buildAiDecisions } from "../../src/lib/aiDecisionCentre.ts";
import type { ActionWorkflow } from "../../src/lib/actionWorkflows.ts";

function inputs(): AICfoInputs {
  return gatherAICfoInputs();
}

function snapshots(mode: "live" | "empty-demo" | "mortgage-demo" | "spending-demo" | "missing-document-demo" | "positive-goal-demo" | "stale-rule-demo" = "live") {
  const current = createCurrentDailyReviewSnapshot(inputs(), "2026-07-18T08:00:00.000Z", mode);
  return { current, previous: createPreviousDailyReviewSnapshot(current, mode) };
}

function staleInputs(): AICfoInputs {
  const base = inputs();
  const assumptions = StructureComparisonEngine.buildStructureAssumptionsFromVault(base.vault);
  const staleRules = TAX_RULE_REFERENCES.map((rule) => rule.id === "au-cgt-discount" ? { ...rule, lastVerifiedAt: "2024-01-01" } : rule);
  return {
    ...base,
    structureComparison: StructureComparisonEngine.run(assumptions, { taxRules: staleRules, asOfDate: "2026-07-18", reviewPeriodDays: 365 }),
  };
}

describe("DailyReviewEngine", () => {
  it("does not create findings for insignificant balance noise", () => {
    const { current } = snapshots("empty-demo");
    const previous: DailyReviewSnapshot = { ...current, id: "previous-small-noise", netWorth: current.netWorth - 100 };
    const findings = compareDailySnapshots(previous, current, DEFAULT_DAILY_REVIEW_SETTINGS, current.capturedAt);
    assert.equal(findings.length, 0);
  });

  it("retains exact before-and-after snapshots and attribution for material changes", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "positive-goal-demo" });
    const netWorth = record.review.findings.find((finding) => finding.category === "net-worth");
    assert.ok(netWorth);
    assert.equal(record.previousSnapshot.netWorth, record.currentSnapshot.netWorth - record.review.netWorthChange);
    assert.ok(netWorth.attribution.length > 0);
    assert.ok(netWorth.evidence.length > 0);
  });

  it("uses behavioural baselines and seasonal ranges for anomaly detection", () => {
    const { current, previous } = snapshots("empty-demo");
    const noisyCurrent: DailyReviewSnapshot = {
      ...current,
      transactions: current.transactions.map((tx) => tx.id === "tx-dining" ? { ...tx, amount: -1600 } : tx),
    };
    const baseline = DailyReviewEngine.calculateSpendingBaseline(previous, noisyCurrent, "dining");
    assert.equal(baseline.unusual, true);
    assert.match(baseline.explanation, /Expected dining spending/);
    assert.ok(baseline.seasonalExpectedRange[1] > baseline.trailing30ExpectedRange[1]);
  });

  it("does not treat transfers as spending anomalies", () => {
    const { current, previous } = snapshots("empty-demo");
    const transferOnlyCurrent: DailyReviewSnapshot = {
      ...current,
      transactions: current.transactions.map((tx) => tx.category === "dining" ? { ...tx, category: "transfer", kind: "transfer" } : tx),
    };
    const findings = compareDailySnapshots(previous, transferOnlyCurrent, DEFAULT_DAILY_REVIEW_SETTINGS, current.capturedAt);
    assert.equal(findings.some((finding) => finding.category === "anomalies"), false);
  });

  it("detects duplicate findings and updates instead of recreating daily noise", () => {
    const { current, previous } = snapshots("mortgage-demo");
    const findings = compareDailySnapshots(previous, current, DEFAULT_DAILY_REVIEW_SETTINGS, current.capturedAt);
    const target = findings.find((finding) => finding.category === "mortgage");
    assert.ok(target);
    const suppressed = applySuppression([target], DEFAULT_DAILY_REVIEW_SETTINGS, [target], current.capturedAt);
    assert.equal(suppressed.active.length, 0);
    assert.equal(suppressed.suppressed[0].suppressionReason, "Duplicate unresolved finding updated instead of recreated");
  });

  it("honours snooze, dismissed and expected suppression settings", () => {
    const { current, previous } = snapshots("mortgage-demo");
    const target = compareDailySnapshots(previous, current, DEFAULT_DAILY_REVIEW_SETTINGS, current.capturedAt).find((finding) => finding.category === "mortgage");
    assert.ok(target);
    const snoozed = applySuppression([target], {
      ...DEFAULT_DAILY_REVIEW_SETTINGS,
      quiet: { ...DEFAULT_DAILY_REVIEW_SETTINGS.quiet, snoozedDeduplicationKeys: { [target.deduplicationKey]: "2026-07-30" } },
    }, [], current.capturedAt);
    assert.equal(snoozed.suppressed[0].state, "Snoozed");

    const expected = applySuppression([target], {
      ...DEFAULT_DAILY_REVIEW_SETTINGS,
      quiet: { ...DEFAULT_DAILY_REVIEW_SETTINGS.quiet, expectedDeduplicationKeys: [target.deduplicationKey] },
    }, [], current.capturedAt);
    assert.equal(expected.suppressed[0].state, "Expected");

    const dismissed = applySuppression([target], {
      ...DEFAULT_DAILY_REVIEW_SETTINGS,
      quiet: { ...DEFAULT_DAILY_REVIEW_SETTINGS.quiet, dismissedDeduplicationKeys: [target.deduplicationKey] },
    }, [], current.capturedAt);
    assert.equal(dismissed.suppressed[0].state, "Dismissed");
  });

  it("automatically resolves findings that are no longer present", () => {
    const { current, previous } = snapshots("mortgage-demo");
    const target = compareDailySnapshots(previous, current, DEFAULT_DAILY_REVIEW_SETTINGS, current.capturedAt).find((finding) => finding.category === "mortgage");
    assert.ok(target);
    const resolved = resolveFindingsAutomatically([target], [], "2026-07-19T08:00:00.000Z");
    assert.equal(resolved[0].state, "Automatically Resolved");
  });

  it("prioritises high-value refinance opportunities", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "mortgage-demo" });
    const refinance = record.review.findings.find((finding) => finding.category === "mortgage");
    assert.ok(refinance);
    assert.ok(["High", "Critical"].includes(refinance.priority));
  });

  it("detects stale rule provenance and preserves professional-review flags", () => {
    const record = DailyReviewEngine.run({ inputs: staleInputs(), mode: "stale-rule-demo" });
    const finding = record.review.findings.find((item) => item.category === "rule-freshness");
    assert.ok(finding);
    assert.equal(finding.professionalReviewRequired, true);
    assert.ok(finding.evidence.length > 0);
  });

  it("detects missing documents, missing salary and lower confidence data", () => {
    const { current } = snapshots("missing-document-demo");
    const previous = createPreviousDailyReviewSnapshot(current, "missing-document-demo");
    const missingDoc = compareDailySnapshots(previous, current, DEFAULT_DAILY_REVIEW_SETTINGS, current.capturedAt);
    assert.ok(missingDoc.some((finding) => finding.category === "documents"));

    const missingSalary = compareDailySnapshots(
      { ...current, id: "previous-income-ok", income: 120000 },
      { ...current, id: "current-income-missing", income: 0 },
      DEFAULT_DAILY_REVIEW_SETTINGS,
      current.capturedAt
    );
    assert.ok(missingSalary.some((finding) => finding.deduplicationKey === "income-missing:salary"));
  });

  it("detects refinance, borrowing-capacity change, goal slippage and positive milestones", () => {
    const mortgage = DailyReviewEngine.run({ inputs: inputs(), mode: "mortgage-demo" }).review.findings;
    assert.ok(mortgage.some((finding) => finding.category === "mortgage"));
    assert.ok(mortgage.some((finding) => finding.category === "borrowing"));

    const positive = DailyReviewEngine.run({ inputs: inputs(), mode: "positive-goal-demo" }).review.findings;
    assert.ok(positive.some((finding) => finding.type === "goal-improvement"));

    const { current } = snapshots("empty-demo");
    const slippage = compareDailySnapshots({ ...current, id: "previous-goal", goalProgress: current.goalProgress + 10 }, current, DEFAULT_DAILY_REVIEW_SETTINGS, current.capturedAt);
    assert.ok(slippage.some((finding) => finding.type === "goal-slippage"));
  });

  it("handles partial and complete engine failure safely", () => {
    const partial = DailyReviewEngine.run({
      inputs: inputs(),
      mode: "partial-failure-demo",
      engineFailures: [{ engine: "Investments", reason: "Demo unavailable", recovered: true }],
    });
    assert.equal(partial.review.status, "Ready");
    assert.ok(partial.review.overallSummary.includes("Some categories were unavailable"));
    assert.equal(partial.review.findings.some((finding) => finding.confidence === "High"), false);

    const complete = DailyReviewEngine.run({ inputs: inputs(), mode: "complete-failure-demo" });
    assert.equal(complete.review.status, "Failed Safely");
    assert.doesNotMatch(complete.review.overallSummary, /No material changes/i);
  });

  it("prevents GPT summaries from adding findings or changing deterministic values", () => {
    const record = DailyReviewEngine.run({
      inputs: inputs(),
      mode: "mortgage-demo",
      gptSummaryDraft: "Also detected a guaranteed tax saving and changed the impact.",
    });
    assert.doesNotMatch(record.review.overallSummary, /guaranteed tax saving/i);
    const finding = record.review.findings.find((item) => item.category === "mortgage");
    assert.ok(finding);
    assert.equal(finding.currentValue, record.currentSnapshot.refinanceMonthlySaving);
    assert.ok(finding.evidence.length > 0);
  });

  it("creates decisions, timeline events and selective recalculation logs", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "mortgage-demo" });
    assert.ok(record.review.generatedDecisions.length > 0);
    assert.ok(record.review.generatedTimelineEvents.length > 0);
    assert.ok(record.review.enginesRecalculated.some((item) => item.engine === "Debt and Housing"));
  });

  it("keeps demo findings labelled and separate from live findings", () => {
    const demo = DailyReviewEngine.run({ inputs: inputs(), mode: "spending-demo" });
    const live = DailyReviewEngine.run({ inputs: inputs(), mode: "live" });
    assert.equal(demo.currentSnapshot.sourceMode, "demo");
    assert.equal(live.currentSnapshot.sourceMode, "live");
    assert.notEqual(demo.review.id, live.review.id);
  });

  it("ensures every material finding has evidence and attribution where components are available", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "live" });
    assert.ok(record.review.findings.length > 0);
    assert.ok(record.review.findings.every((finding) => finding.evidence.length > 0));
    assert.ok(record.review.findings.filter((finding) => ["net-worth", "cash-flow", "borrowing"].includes(finding.category)).every((finding) => finding.attribution.length > 0));
  });

  it("returns an empty state only when every engine succeeds and no material findings exist", () => {
    const empty = DailyReviewEngine.run({ inputs: inputs(), mode: "empty-demo" });
    assert.equal(empty.review.status, "No Material Changes");
    assert.equal(empty.review.findings.length, 0);
    assert.match(empty.review.overallSummary, /No material financial changes/);
  });
});

describe("DailyReviewStore", () => {
  const testFile = join(process.cwd(), ".tmp-daily-review-test.json");

  before(() => {
    process.env.VIREON_DAILY_REVIEW_STORE_FILE = testFile;
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  after(() => {
    if (existsSync(testFile)) unlinkSync(testFile);
    delete process.env.VIREON_DAILY_REVIEW_STORE_FILE;
  });

  it("persists settings separately from review facts and reconstructs history", () => {
    updateDailyReviewSettings({ frequency: "weekly", minimumImpact: "high" });
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "mortgage-demo" });
    persistDailyReviewHistory(record);
    const state = getDailyReviewState();
    assert.equal(state.settings.frequency, "weekly");
    assert.equal(state.history[0].previousSnapshot.id, record.previousSnapshot.id);
    assert.equal(state.history[0].currentSnapshot.id, record.currentSnapshot.id);
    assert.equal(state.history[0].review.findings[0].calculationSnapshotId, record.review.findings[0].calculationSnapshotId);
  });

  it("can run and persist a manual seeded review without mixing with live facts", () => {
    const result = runAndPersistDailyReview({ mode: "empty-demo" });
    assert.equal(result.record.currentSnapshot.sourceMode, "demo");
    assert.ok(result.state.history.some((item) => item.review.id === result.record.review.id));
  });
});

describe("DailyReviewPresentation", () => {
  it("selects an actionable risk above a positive movement when briefing the user", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "live" });
    const featured = selectFeaturedFinding(record.review.findings);
    assert.ok(featured);
    assert.notEqual(featured.type, "positive-change");
    assert.notEqual(featured.type, "goal-improvement");
  });

  it("limits priority actions above the fold to three", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "live" });
    const actions = selectPriorityActions(record.review.findings, 3);
    assert.ok(actions.length <= 3);
    assert.ok(actions.every((finding) => finding.type !== "positive-change"));
  });

  it("keeps financial wins lightweight and limited", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "positive-goal-demo" });
    const wins = selectFinancialWins(record.review.findings, 3);
    assert.ok(wins.length <= 3);
    assert.ok(wins.every((finding) => finding.type === "positive-change" || finding.type === "goal-improvement"));
  });

  it("emphasises System Health only for exceptional conditions", () => {
    const healthy = DailyReviewEngine.run({ inputs: inputs(), mode: "empty-demo" });
    assert.equal(buildSystemHealthSummary(healthy).emphasise, false);

    const partial = DailyReviewEngine.run({ inputs: inputs(), mode: "partial-failure-demo" });
    const health = buildSystemHealthSummary(partial);
    assert.equal(health.emphasise, true);
    assert.equal(health.label, "Needs review");
  });

  it("returns stable and partial briefing copy without manufacturing recommendations", () => {
    const empty = DailyReviewEngine.run({ inputs: inputs(), mode: "empty-demo" });
    assert.equal(getReviewDirection(empty), "stable");
    assert.match(buildBriefingHeadline(empty), /stable/i);
    assert.match(buildExecutiveSummary(empty), /No material changes/i);

    const partial = DailyReviewEngine.run({ inputs: inputs(), mode: "complete-failure-demo" });
    assert.equal(getReviewDirection(partial), "partial");
    assert.match(buildBriefingHeadline(partial), /partially complete/i);
    assert.doesNotMatch(buildExecutiveSummary(partial), /No material changes/i);
  });
});

describe("DashboardPresentation", () => {
  function decisions() {
    const base = inputs();
    return buildAiDecisions({ vault: base.vault, balanceSheet: base.balanceSheet, housing: base.housing });
  }

  function activeWorkflow(sourceDecisionId = "refinance-mortgage-rate"): ActionWorkflow {
    return {
      id: "workflow-refinance-mortgage-rate",
      sourceDecisionId,
      title: "Mortgage refinance workflow",
      category: "Mortgage",
      objective: "Complete refinance execution and verify realised repayment savings.",
      priority: "Critical",
      financialImpact: "$186/month expected saving",
      verifiedFinancialImpact: null,
      confidence: "High",
      status: "In Progress",
      outcomeStatus: "Evidence Pending",
      progress: 35,
      nextActionLabel: "Upload latest loan statement",
      nextActionHref: "/action-workflows?workflowId=workflow-refinance-mortgage-rate",
      timeToComplete: "15 min",
      requiredData: [],
      blockers: [],
      evidence: [],
      assumptions: [],
      professionalReviewRequired: true,
      professionalReviewReasons: ["Lender policy"],
      outputs: [],
      steps: [],
      createdAt: "2026-07-18T08:00:00.000Z",
      updatedAt: "2026-07-18T08:00:00.000Z",
      completedAt: null,
      dismissedAt: null,
      auditTrail: [],
    };
  }

  it("builds a deterministic dashboard hero from Daily Review state", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "mortgage-demo" });
    const top = selectDashboardTopPriority({ findings: record.review.findings, decisions: decisions(), workflows: [] });
    const briefing = buildDashboardBriefing(record, top);
    assert.ok(briefing.headline.length > 0);
    assert.notEqual(briefing.headline, buildBriefingHeadline(record));
    assert.ok(briefing.primaryAction);
  });

  it("routes top priority to an active workflow before duplicate decisions", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "mortgage-demo" });
    const top = selectDashboardTopPriority({ findings: record.review.findings, decisions: decisions(), workflows: [activeWorkflow()] });
    assert.ok(top);
    assert.equal(top.source, "workflow");
    assert.equal(top.href, "/action-workflows?workflowId=workflow-refinance-mortgage-rate");
  });

  it("limits secondary dashboard actions to three", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "live" });
    const top = selectDashboardTopPriority({ findings: record.review.findings, decisions: decisions(), workflows: [] });
    const actions = selectDashboardSecondaryActions({ findings: record.review.findings, decisions: decisions(), workflows: [], topAction: top, limit: 3 });
    assert.ok(actions.length <= 3);
    assert.ok(actions.every((action) => action.id !== top?.id));
  });

  it("suppresses duplicate dashboard actions by stable source entity", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "mortgage-demo" });
    const workflow = activeWorkflow();
    const top = selectDashboardTopPriority({ findings: record.review.findings, decisions: decisions(), workflows: [workflow] });
    assert.ok(top);
    assert.equal(top.source, "workflow");

    const actions = selectDashboardSecondaryActions({ findings: record.review.findings, decisions: decisions(), workflows: [workflow], topAction: top, limit: 3 });
    assert.equal(actions.some((action) => dashboardActionSourceKey(action) === dashboardActionSourceKey(top)), false);
    assert.equal(actions.some((action) => action.id === workflow.sourceDecisionId), false);
  });

  it("uses only verified progress findings and completed workflows as wins", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "positive-goal-demo" });
    const wins = selectVerifiedFinancialWins(record.review.findings, [activeWorkflow()], 3);
    assert.ok(wins.length <= 3);
    assert.ok(wins.every((win) => !win.impact.toLowerCase().includes("expected saving")));
  });

  it("does not treat completed checklist impact as realised Dashboard progress", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "empty-demo" });
    const workflow = {
      ...activeWorkflow(),
      status: "Completed" as const,
      completedAt: "2026-07-18T08:00:00.000Z",
      financialImpact: "$186/month expected saving",
      verifiedFinancialImpact: null,
      outcomeStatus: "Evidence Pending" as const,
    };
    const wins = selectVerifiedFinancialWins(record.review.findings, [workflow], 3);
    assert.equal(wins.some((win) => win.id === workflow.id), false);
  });

  it("keeps partial failure dashboards out of the stable empty-state copy", () => {
    const record = DailyReviewEngine.run({ inputs: inputs(), mode: "partial-failure-demo", engineFailures: [{ engine: "Investments", reason: "Demo unavailable", recovered: true }] });
    const briefing = buildDashboardBriefing(record, null);
    assert.match(briefing.headline, /partially updated/i);
    assert.doesNotMatch(briefing.summary, /No material changes/i);
  });
});
