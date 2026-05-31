import { askCopilot, getCopilotContext, getCopilotPromptSuggestions } from "@/lib/copilotEngine";
import { storeMemory } from "@/lib/vectorMemory";
import { getDevSession } from "@/lib/auth/middleware";
import { subscriptionSummary } from "@/lib/subscriptionEngine";
import { summariseTransactions } from "@/lib/transactionEngine";
import { supabaseConfigured } from "@/lib/supabase/client";
import { supabaseServerConfigured } from "@/lib/supabase/server";
import {
  getLocalTransactions,
  getLocalSubscriptions,
  getStorageMode,
  hasLocalData,
} from "@/lib/localStore";

function assembleFinancialContext() {
  const storageMode = getStorageMode();
  const localCounts = hasLocalData();

  if (localCounts.transactions > 0) {
    const localTxs = getLocalTransactions();
    const income = localTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const spend = localTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const localSubs = getLocalSubscriptions();
    const monthlySubSpend = localSubs.reduce((s, sub) => s + sub.amount, 0);

    return {
      transactions: {
        income,
        spend,
        net: income - spend,
        count: localTxs.length,
      },
      subscriptions: {
        count: localSubs.length,
        monthlySpend: Math.round(monthlySubSpend * 100) / 100,
        annualisedSpend: Math.round(monthlySubSpend * 12 * 100) / 100,
      },
      financial: getCopilotContext(),
      memorySource: "local-persistent",
      vectorSearchAvailable: false,
      storageMode,
      dataSource: "local-persistent",
    };
  }

  const txSummary = summariseTransactions();
  const subSummary = subscriptionSummary();
  const copilotCtx = getCopilotContext();

  return {
    transactions: {
      income: txSummary.income,
      spend: txSummary.spend,
      net: txSummary.net,
      count: txSummary.transactionCount,
    },
    subscriptions: {
      count: subSummary.subscriptions.length,
      monthlySpend: subSummary.monthlySpend,
      annualisedSpend: subSummary.annualisedSpend,
    },
    financial: copilotCtx,
    memorySource: "in-memory-stub",
    vectorSearchAvailable: false,
    storageMode,
    dataSource: "mock",
  };
}

function buildCopilotAnswer(prompt: string, hasLocalTx: boolean, hasLocalSubs: boolean) {
  const base = askCopilot(prompt);

  if (!hasLocalTx && !hasLocalSubs) return base;

  const localTxs = getLocalTransactions();
  const localSubs = getLocalSubscriptions();

  const txCount = localTxs.length;
  const income = localTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spend = localTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const recurringCount = localTxs.filter((t) => t.recurring).length;
  const subMonthly = localSubs.reduce((s, sub) => s + sub.amount, 0);

  const lc = prompt.toLowerCase();
  let answer = base.answer;

  if (hasLocalTx) {
    if (lc.includes("transaction") || lc.includes("spend") || lc.includes("import")) {
      answer = `Based on your ${txCount} imported transactions: income $${income.toFixed(2)}, spend $${spend.toFixed(2)}, net $${(income - spend).toFixed(2)}. ${recurringCount} recurring payments detected.`;
    } else if (lc.includes("subscription") && hasLocalSubs) {
      answer = `Your ${localSubs.length} imported subscriptions cost $${subMonthly.toFixed(2)}/month ($${(subMonthly * 12).toFixed(2)}/year). Review cadence and renewal dates in /api/subscriptions.`;
    } else {
      answer = `${answer} (Based on ${txCount} imported transactions and ${localSubs.length} subscriptions in local persistent storage.)`;
    }
  }

  return { ...base, answer, dataSource: "local-persistent" };
}

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = String(body.prompt || "Assess Liberva");

  const session = getDevSession();
  const localCounts = hasLocalData();
  const financialContext = assembleFinancialContext();
  const copilotResponse = buildCopilotAnswer(
    prompt,
    localCounts.transactions > 0,
    localCounts.subscriptions > 0
  );
  const memoryResult = storeMemory(prompt);
  const suggestions = getCopilotPromptSuggestions();

  return Response.json({
    ok: true,
    session: {
      userId: session.userId,
      workspaceId: session.workspaceId,
      role: session.role,
    },
    copilot: copilotResponse,
    financialContext,
    memory: memoryResult,
    promptSuggestions: suggestions,
    infrastructure: {
      supabaseBrowserConfigured: supabaseConfigured,
      supabaseServerConfigured: supabaseServerConfigured,
      repositoryMode: getStorageMode(),
      localDataCounts: localCounts,
    },
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    suggestions: getCopilotPromptSuggestions(),
    contextAssembled: true,
    storageMode: getStorageMode(),
    localDataCounts: hasLocalData(),
  });
}
