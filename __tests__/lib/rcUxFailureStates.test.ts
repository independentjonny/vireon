import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("Private Beta onboarding does not present unknown forecast as zero and exposes failed saves", () => {
  const file = source("src/app/components/PrivateBetaFoundationClient.tsx");
  assert.match(file, /topForecast \? money\(topForecast\.cashBalance\) : "Not calculated yet"/);
  assert.match(file, /Onboarding update failed/);
  assert.match(file, /setOnboarding\(data\.onboarding\)/);
  assert.match(file, /Estimated time: 15 minutes/);
  assert.match(file, /Unlocks:/);
  assert.match(file, /No confirmed records are available yet/);
  assert.match(file, /role="progressbar"/);
  assert.match(file, /aria-label="Onboarding progress"/);
  assert.match(file, /aria-live="polite"/);
});

test("Action Workflows mutations show explicit success or error state", () => {
  const file = source("src/app/components/ActionWorkflowsClient.tsx");
  assert.match(file, /applyWorkflowMutation/);
  assert.match(file, /Workflow update could not be saved/);
  assert.match(file, /Workflow update failed offline/);
  assert.match(file, /mutationMessage\.tone === "error"/);
});

test("AI CFO failed answer persistence is visible to the user", () => {
  const file = source("src/app/components/AiCfoClient.tsx");
  assert.match(file, /AI CFO answer could not be saved/);
  assert.match(file, /setError\(err instanceof Error/);
  assert.match(file, /border-red-200 bg-red-50/);
});

test("Financial forecasting scenario controls cannot accept pre-hydration clicks", () => {
  const file = source("src/app/components/ForecastTimelineClient.tsx");
  assert.match(file, /const \[ready, setReady\] = useState\(false\)/);
  assert.match(file, /useEffect\(\(\) => \{\s+void Promise\.resolve\(\)\.then\(\(\) => setReady\(true\)\);/);
  assert.match(file, /disabled=\{busy \|\| !ready\}/);
  assert.match(file, /scenario is calculating/);
});

test("P1 first-run polish avoids misleading zeros and raw status codes", () => {
  const vault = source("src/app/components/FinancialVaultClient.tsx");
  const goals = source("src/app/components/GoalsPlanningClient.tsx");
  const dashboard = source("src/app/components/OverviewV3.tsx");
  const homePage = source("src/app/page.tsx");
  const balanceSheet = source("src/app/components/FinancialBalanceSheet.tsx");
  const adviser = source("src/app/adviser-workspace/page.tsx");
  const dailyReviewCard = source("src/app/components/DailyReviewCard.tsx");
  const decisionCentre = source("src/lib/aiDecisionCentre.ts");
  const copilot = source("src/lib/copilotEngine.ts");
  const copilotRoute = source("src/app/api/copilot/route.ts");

  assert.match(vault, /metricValue\(vault\.borrowing_capacity\.estimatedSafeBorrowing, hasIncomeAndSpending/);
  assert.match(vault, /Borrowing estimates are not calculated yet/);
  assert.match(vault, /No documents have been uploaded yet/);
  assert.match(vault, /No savings opportunities are ready yet/);
  assert.match(vault, /Retry loading Vault/);

  assert.match(goals, /function forecastQualityLabel/);
  assert.match(goals, /Needs confirmed data/);
  assert.match(goals, /No goals have been created yet/);
  assert.match(goals, /No goal actions are ready yet/);

  assert.match(dashboard, /Your financial position/);
  assert.match(dashboard, /What you own, owe, earn and should do next/);
  assert.match(dashboard, /Next best action/i);
  assert.match(dashboard, /What changed/);
  assert.match(dashboard, /pathname: "\/ai-cfo\/daily-review"/);
  assert.match(dashboard, /reviewId/);
  assert.match(dashboard, /findingId: item\.id/);
  assert.match(dashboard, /data-testid="dashboard-recent-change"/);
  assert.match(dashboard, /item\.changeLabel/);
  assert.match(dashboard, /item\.timeBasis/);
  assert.match(dashboard, /item\.previousValue/);
  assert.match(dashboard, /item\.currentValue/);
  assert.match(dashboard, /item\.evidence\[0\]\?\.sourceTitle/);
  assert.match(dashboard, /item\.evidence\[0\]\.factUsed/);
  assert.match(dashboard, /formatVerifiedDate\(item\.evidence\[0\]\.lastVerifiedAt\)/);
  assert.doesNotMatch(dashboard, /overview-review-link/);
  assert.doesNotMatch(dashboard, /Review \{attentionItems\.length\} change/);
  assert.doesNotMatch(dashboard, /ChevronDown/);
  assert.doesNotMatch(dashboard, /#changes-to-review/);
  assert.match(dashboard, /Compared with your previous confirmed position/);
  assert.match(dashboard, /Explore your finances/);
  assert.match(dashboard, /Financial position/);
  assert.match(dashboard, /Cash flow/);
  assert.match(dashboard, /Housing/);
  assert.match(dashboard, /Document Vault/);
  assert.doesNotMatch(dashboard, /Secondary actions/);
  assert.doesNotMatch(dashboard, /Goal planning/);
  assert.doesNotMatch(dashboard, /Deeper analysis/);
  assert.doesNotMatch(dashboard, /Current priority:/);
  assert.doesNotMatch(dashboard, /Â·/);
  assert.doesNotMatch(dashboard, /Home deposit is 78% complete/);

  const dailyReview = source("src/app/components/DailyReviewClient.tsx");
  const dailyReviewPage = source("src/app/ai-cfo/daily-review/page.tsx");
  assert.match(dailyReview, /Back to Dashboard/);
  assert.match(dailyReview, /id=\{`finding-\$\{finding\.id\}`\}/);
  assert.match(dailyReview, /daily-review-selected-finding/);
  assert.match(dailyReview, />Daily Review<\/h1>/);
  assert.doesNotMatch(dailyReview, /Selected change/);
  assert.match(dailyReview, /Other changes in this review/);
  assert.match(dailyReview, /buildFindingDisplay/);
  assert.match(dailyReview, /display\.title/);
  assert.match(dailyReview, /Inputs compared/);
  assert.match(dailyReview, /Estimate only/);
  assert.doesNotMatch(dailyReview, />Professional review</);
  assert.doesNotMatch(dailyReview, /sectionMap/);
  assert.doesNotMatch(dailyReview, /min-h-\[calc\(100vh-56px\)\]/);
  assert.doesNotMatch(dailyReview, /FeaturedFinding/);
  assert.doesNotMatch(dailyReview, /PriorityActionCard/);
  assert.doesNotMatch(dailyReview, /overview-review-changes/);
  assert.doesNotMatch(dailyReview, /The same changes shown on your overview/);
  assert.match(dailyReviewPage, /item\.review\.id === params\.reviewId/);
  assert.match(dailyReviewPage, /selectedFindingId=\{params\.findingId\}/);
  assert.doesNotMatch(dailyReviewPage, /showOverviewChanges/);

  assert.doesNotMatch(homePage, /Offset mortgage by \$800\/month/);
  assert.doesNotMatch(homePage, /AI detected \$138\/month/);
  assert.match(homePage, /netWorthTrend="Confirmed position"/);
  assert.match(homePage, /aiConfidence="Not calculated yet"/);

  assert.match(balanceSheet, /Monthly Change", value: "Not calculated yet"/);
  assert.doesNotMatch(balanceSheet, /Monthly Change", value: "\$0"/);

  assert.doesNotMatch(adviser, /Â·/);
  assert.doesNotMatch(dailyReviewCard, /Â·/);

  assert.doesNotMatch(decisionCentre, /Home deposit is 78% complete/);
  assert.doesNotMatch(decisionCentre, /Increase monthly saving by \$200/);
  assert.match(decisionCentre, /Goal contribution path needs review/);

  assert.doesNotMatch(copilot, /Offset mortgage by \$800\/month/);
  assert.doesNotMatch(copilot, /\$38\.98\/month/);
  assert.doesNotMatch(copilot, /Connect real database/);
  assert.match(copilot, /will not invent a savings rate/);
  assert.match(copilotRoute, /new Intl\.NumberFormat\("en-AU"/);
});
