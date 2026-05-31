import { ingestCSV } from "@/lib/ingestion/csvPipeline";
import { getIngestionHealthReport } from "@/lib/ingestion/healthScorer";
import { subscriptionSummary } from "@/lib/subscriptionEngine";
import { askCopilot, getCopilotContext } from "@/lib/copilotEngine";
import {
  getStorageMode,
  hasLocalData,
  appendLocalTransactions,
  upsertLocalSubscription,
} from "@/lib/localStore";
import type { TransactionRecord } from "@/lib/persistence/schema";

type SmokeResult = {
  name: string;
  passed: boolean;
  duration: number;
  detail: string;
  error?: string;
};

async function testIngestPipeline(): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const rows = [
      { date: "2026-05-01", description: "Netflix", amount: "-23.99" },
      { date: "2026-05-02", description: "Woolworths", amount: "-85.00" },
      { date: "2026-05-01", description: "Salary", amount: "6420.00" },
    ];
    const result = ingestCSV(rows);
    const health = getIngestionHealthReport(result.transactions, result.errors);
    const passed = result.ok && result.processedRows === 3 && health.grade !== undefined;
    return {
      name: "ingest-pipeline",
      passed,
      duration: Date.now() - start,
      detail: `Processed ${result.processedRows} rows, grade=${health.grade}, recurring=${result.recurringCount}, duplicates=${result.duplicateCount}`,
    };
  } catch (err) {
    return {
      name: "ingest-pipeline",
      passed: false,
      duration: Date.now() - start,
      detail: "Exception during ingest",
      error: String(err),
    };
  }
}

async function testSubscriptionDetection(): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const summary = subscriptionSummary();
    const passed =
      Array.isArray(summary.subscriptions) &&
      typeof summary.monthlySpend === "number" &&
      typeof summary.annualisedSpend === "number";
    return {
      name: "subscription-detection",
      passed,
      duration: Date.now() - start,
      detail: `Detected ${summary.subscriptions.length} subscriptions, monthly=$${summary.monthlySpend.toFixed(2)}, annual=$${summary.annualisedSpend.toFixed(2)}`,
    };
  } catch (err) {
    return {
      name: "subscription-detection",
      passed: false,
      duration: Date.now() - start,
      detail: "Exception during subscription detection",
      error: String(err),
    };
  }
}

async function testCopilotContext(): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const ctx = getCopilotContext();
    const response = askCopilot("What is my savings rate?");
    const passed =
      typeof ctx.healthScore === "number" &&
      response.ok === true &&
      typeof response.answer === "string" &&
      response.answer.length > 10;
    return {
      name: "copilot-context",
      passed,
      duration: Date.now() - start,
      detail: `Health score=${ctx.healthScore}, answer length=${response.answer.length} chars`,
    };
  } catch (err) {
    return {
      name: "copilot-context",
      passed: false,
      duration: Date.now() - start,
      detail: "Exception during copilot context assembly",
      error: String(err),
    };
  }
}

async function testStorageLayer(): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const mode = getStorageMode();
    const counts = hasLocalData();
    const passed = typeof mode === "string" && typeof counts.transactions === "number";
    return {
      name: "storage-layer",
      passed,
      duration: Date.now() - start,
      detail: `mode=${mode}, transactions=${counts.transactions}, subscriptions=${counts.subscriptions}, imports=${counts.imports}`,
    };
  } catch (err) {
    return {
      name: "storage-layer",
      passed: false,
      duration: Date.now() - start,
      detail: "Exception reading storage layer",
      error: String(err),
    };
  }
}

export async function GET() {
  const results = await Promise.all([
    testIngestPipeline(),
    testSubscriptionDetection(),
    testCopilotContext(),
    testStorageLayer(),
  ]);

  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;

  return Response.json({
    ok: allPassed,
    passed: passedCount,
    total: results.length,
    score: `${passedCount}/${results.length}`,
    results,
    generatedAt: new Date().toISOString(),
  });
}

export async function POST() {
  const workflowStart = Date.now();
  const steps: { step: string; passed: boolean; detail: string; error?: string }[] = [];

  const sampleRows = [
    { date: "2026-05-01", description: "Smoke Salary", amount: "5000.00" },
    { date: "2026-05-02", description: "Smoke Netflix", amount: "-23.99" },
    { date: "2026-05-03", description: "Smoke Woolworths", amount: "-75.00" },
  ];

  // Step 1: Ingest preview (dryRun)
  let ingestResult;
  try {
    ingestResult = ingestCSV(sampleRows);
    const health = getIngestionHealthReport(ingestResult.transactions, ingestResult.errors);
    steps.push({
      step: "ingest-preview",
      passed: ingestResult.ok,
      detail: `Processed ${ingestResult.processedRows} rows, grade=${health.grade}`,
    });
  } catch (e) {
    steps.push({ step: "ingest-preview", passed: false, detail: "Exception", error: String(e) });
  }

  // Step 2: Persist
  let persistedCount = 0;
  try {
    if (ingestResult) {
      const records: TransactionRecord[] = ingestResult.transactions.map((t, i) => ({
        id: `smoke-${Date.now()}-${i}`,
        workspaceId: "smoke-workspace",
        userId: "smoke-user",
        merchant: t.merchant,
        merchantCanonical: t.merchantCanonical,
        amount: t.amount,
        currency: t.currency,
        category: t.category,
        subCategory: t.subCategory,
        date: t.date,
        recurring: t.recurring,
        recurringCadence: (t.recurringCadence as TransactionRecord["recurringCadence"]) ?? null,
        duplicate: t.duplicate,
        confidence: t.confidence,
        rawDescription: t.rawDescription,
        source: "csv",
        createdAt: new Date().toISOString(),
      }));
      persistedCount = appendLocalTransactions(records);
    }
    steps.push({ step: "persist", passed: true, detail: `${persistedCount} new records written to local-persistent storage` });
  } catch (e) {
    steps.push({ step: "persist", passed: false, detail: "Exception during persist", error: String(e) });
  }

  // Step 3: Subscription detection
  try {
    const subSummary = subscriptionSummary();
    upsertLocalSubscription({
      id: `smoke-sub-${Date.now()}`,
      workspaceId: "smoke-workspace",
      transactionId: "",
      merchant: "Smoke Netflix",
      merchantCanonical: "smoke-netflix",
      amount: 23.99,
      cadence: "monthly",
      nextRenewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancellationScore: 0,
      pricingAnomalyScore: 0,
      savingsOpportunity: 43.18,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    steps.push({
      step: "subscription-detection",
      passed: Array.isArray(subSummary.subscriptions),
      detail: `Mock subscriptions: ${subSummary.subscriptions.length} · smoke subscription upserted`,
    });
  } catch (e) {
    steps.push({ step: "subscription-detection", passed: false, detail: "Exception", error: String(e) });
  }

  // Step 4: Copilot context
  try {
    const ctx = getCopilotContext();
    const response = askCopilot("Smoke test: summarise my finances");
    const localCounts = hasLocalData();
    steps.push({
      step: "copilot-context",
      passed: response.ok === true,
      detail: `Answer length=${response.answer.length} chars · local transactions=${localCounts.transactions} · subscriptions=${localCounts.subscriptions}`,
    });
  } catch (e) {
    steps.push({ step: "copilot-context", passed: false, detail: "Exception", error: String(e) });
  }

  const allPassed = steps.every((s) => s.passed);
  const passedCount = steps.filter((s) => s.passed).length;
  const localCounts = hasLocalData();

  return Response.json({
    ok: allPassed,
    mode: "workflow",
    passed: passedCount,
    total: steps.length,
    score: `${passedCount}/${steps.length}`,
    steps,
    storageMode: getStorageMode(),
    localData: localCounts,
    durationMs: Date.now() - workflowStart,
    generatedAt: new Date().toISOString(),
  });
}
