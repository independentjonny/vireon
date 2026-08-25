import type { DailyReviewFinding } from "./aiCfoDailyReview.ts";

export type FindingTone = "positive" | "attention" | "neutral";

export type FindingDisplay = {
  tone: FindingTone;
  statusLabel: string;
  title: string;
  changeLabel: string;
  previousLabel: string;
  currentLabel: string;
  previousValue: string;
  currentValue: string;
  timeBasis: string;
};

function dateLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function isPositive(finding: DailyReviewFinding): boolean {
  return finding.type === "positive-change" || finding.type === "goal-improvement";
}

function valueKind(finding: DailyReviewFinding): "annual-money" | "monthly-money" | "money" | "points" | "count" {
  if (finding.category === "cash-flow" || finding.category === "income") return "annual-money";
  if (finding.category === "mortgage" || finding.category === "subscriptions") return "monthly-money";
  if (["net-worth", "borrowing", "debt", "housing", "investments", "superannuation"].includes(finding.category)) return "money";
  if (["goals", "retirement", "knowledge-health"].includes(finding.category)) return "points";
  return "count";
}

function formatValue(finding: DailyReviewFinding, value: number): string {
  const kind = valueKind(finding);
  if (kind === "annual-money") return `${money(value)} per year`;
  if (kind === "monthly-money") return `${money(value)} per month`;
  if (kind === "money") return money(value);
  if (kind === "points") return `${Math.abs(Math.round(value)).toLocaleString("en-AU")} points`;
  return Math.abs(Math.round(value)).toLocaleString("en-AU");
}

function direction(finding: DailyReviewFinding): "higher" | "lower" | "changed" {
  if (finding.absoluteChange > 0) return "higher";
  if (finding.absoluteChange < 0) return "lower";
  return "changed";
}

function movement(finding: DailyReviewFinding): "increased" | "decreased" | "changed" {
  if (finding.absoluteChange > 0) return "increased";
  if (finding.absoluteChange < 0) return "decreased";
  return "changed";
}

function findingTitle(finding: DailyReviewFinding): string {
  const amount = formatValue(finding, finding.absoluteChange);
  const verb = movement(finding);
  if (finding.category === "borrowing") return `Estimated borrowing capacity ${verb} by ${amount}`;
  if (finding.category === "cash-flow") return `Annual cash-flow surplus ${verb} by ${amount}`;
  if (finding.category === "income") return `Verified annual income ${verb} by ${amount}`;
  if (finding.category === "net-worth") return `Net worth ${verb} by ${amount}`;
  return finding.title.replace(/by\s+-\$/gi, "by $");
}

export function findingEvidenceFact(finding: DailyReviewFinding, originalFact: string): string {
  const previous = formatValue(finding, finding.previousValue);
  const current = formatValue(finding, finding.currentValue);
  if (finding.category === "borrowing") return `Estimated borrowing capacity moved from ${previous} to ${current}.`;
  if (finding.category === "cash-flow") return `Annual income less annualised spending moved from ${previous} to ${current}.`;
  if (finding.category === "net-worth") return `Assets less liabilities moved from ${previous} to ${current}.`;
  return originalFact.replace(/by\s+-\$/gi, "by $");
}

export function buildFindingDisplay(
  finding: DailyReviewFinding,
  comparisonStartDate: string,
  comparisonEndDate: string,
): FindingDisplay {
  const start = dateLabel(comparisonStartDate);
  const end = dateLabel(comparisonEndDate);
  const kind = valueKind(finding);
  const positive = isPositive(finding);
  const tone: FindingTone = positive ? "positive" : finding.type === "risk" || finding.type === "negative-change" || finding.type === "missing-data" || finding.type === "stale-data" ? "attention" : "neutral";

  const timeBasis = kind === "annual-money"
    ? `Annualised recurring amount · compared snapshots ${start} and ${end}`
    : kind === "monthly-money"
      ? `Ongoing monthly amount · compared snapshots ${start} and ${end}`
      : kind === "money"
        ? `Point-in-time estimate · compared ${start} and ${end}`
        : `Review score · compared ${start} and ${end}`;

  return {
    tone,
    statusLabel: positive ? "Positive change" : tone === "attention" ? "Needs attention" : "Review change",
    title: findingTitle(finding),
    changeLabel: `${formatValue(finding, finding.absoluteChange)} ${direction(finding)}`,
    previousLabel: `Previous · ${start}`,
    currentLabel: `Current · ${end}`,
    previousValue: formatValue(finding, finding.previousValue),
    currentValue: formatValue(finding, finding.currentValue),
    timeBasis,
  };
}

export function findingIsPositive(finding: DailyReviewFinding): boolean {
  return isPositive(finding);
}
