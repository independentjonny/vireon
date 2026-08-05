import { createHash } from "crypto";
import type { CalibrationReport, EvaluationBaseline, EvaluationFixture, EvaluationRun, EvaluationSuite, HumanReview, PromotionDecision } from "./types.ts";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class InMemoryEvaluationRepository {
  private suites = new Map<string, EvaluationSuite>();
  private fixtures = new Map<string, EvaluationFixture>();
  private runs = new Map<string, EvaluationRun>();
  private baselines = new Map<string, EvaluationBaseline>();
  private promotions = new Map<string, PromotionDecision>();
  private humanReviews = new Map<string, HumanReview>();
  private calibrationReports = new Map<string, CalibrationReport>();

  upsertSuite(suite: EvaluationSuite) {
    this.suites.set(suite.suiteId, suite);
    return suite;
  }

  upsertFixture(fixture: EvaluationFixture) {
    this.fixtures.set(fixture.fixtureId, fixture);
    return fixture;
  }

  saveRun(run: EvaluationRun) {
    if (this.runs.has(run.runId)) throw new Error("Evaluation runs are immutable once stored.");
    this.runs.set(run.runId, Object.freeze({ ...run, results: Object.freeze([...run.results]) }) as EvaluationRun);
    return run;
  }

  listRuns() {
    return [...this.runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  getRun(runId: string) {
    return this.runs.get(runId) ?? null;
  }

  saveBaseline(run: EvaluationRun, candidate: string) {
    const baseline: EvaluationBaseline = {
      baselineId: `baseline-${run.suiteId}-${candidate}-${run.runId}`,
      suiteId: run.suiteId,
      fixtureVersion: run.fixtureVersion,
      candidate,
      scoreSummary: run.scoreSummary,
      resultHashes: Object.fromEntries(run.results.map((result) => [result.fixtureId, hash(result)])),
      createdAt: run.completedAt ?? run.startedAt,
      immutable: true,
    };
    if (this.baselines.has(baseline.baselineId)) throw new Error("Regression baselines are immutable.");
    this.baselines.set(baseline.baselineId, Object.freeze(baseline));
    return baseline;
  }

  latestBaseline(suiteId: string, candidate: string) {
    return [...this.baselines.values()]
      .filter((baseline) => baseline.suiteId === suiteId && baseline.candidate === candidate)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }

  savePromotionDecision(decision: PromotionDecision) {
    this.promotions.set(decision.decisionId, Object.freeze(decision));
    return decision;
  }

  listPromotionDecisions() {
    return [...this.promotions.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  saveHumanReview(review: HumanReview) {
    if (this.humanReviews.has(review.reviewId)) throw new Error("Human reviews are immutable.");
    this.humanReviews.set(review.reviewId, Object.freeze(review));
    return review;
  }

  saveCalibrationReport(report: CalibrationReport) {
    this.calibrationReports.set(report.reportId, Object.freeze(report));
    return report;
  }

  latestCalibrationReport() {
    return [...this.calibrationReports.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }
}

export const evaluationRepository = new InMemoryEvaluationRepository();
