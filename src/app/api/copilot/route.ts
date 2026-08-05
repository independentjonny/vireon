import { askCopilot, getCopilotContext, getCopilotPromptSuggestions } from "@/lib/copilotEngine";
import { storeMemory } from "@/lib/vectorMemory";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import { supabaseConfigured } from "@/lib/supabase/client";
import { supabaseServerConfigured } from "@/lib/supabase/server";
import { createTransactionsSubscriptionsServiceFromEnv, toSafeTransactionsError } from "@/server/services/transactionsSubscriptionsPostgresService";
import type { Session } from "@/lib/auth/middleware";
import type { SubscriptionRecord, TransactionRecord } from "@/lib/persistence/schema";

function money(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(value);
}

async function loadPersistedFinancialContext(session: Session) {
  const service = createTransactionsSubscriptionsServiceFromEnv();
  const [transactionResult, subscriptionResult] = await Promise.all([
    service.listTransactions(session),
    service.listSubscriptions(session),
  ]);
  return {
    transactions: transactionResult.transactions,
    subscriptions: subscriptionResult.subscriptions,
  };
}

function assembleFinancialContext(txs: TransactionRecord[], subs: SubscriptionRecord[]) {
  const income = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spend = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthlySubSpend = subs.reduce((s, sub) => s + sub.amount, 0);

  return {
    transactions: {
      income,
      spend,
      net: income - spend,
      count: txs.length,
    },
    subscriptions: {
      count: subs.length,
      monthlySpend: Math.round(monthlySubSpend * 100) / 100,
      annualisedSpend: Math.round(monthlySubSpend * 12 * 100) / 100,
    },
    financial: getCopilotContext(),
    memorySource: "postgres-context",
    vectorSearchAvailable: false,
    storageMode: "postgres",
    dataSource: "postgres",
  };
}

function buildCopilotAnswer(prompt: string, txs: TransactionRecord[], subs: SubscriptionRecord[]) {
  const base = askCopilot(prompt);

  if (txs.length === 0 && subs.length === 0) return { ...base, dataSource: "postgres" };

  const txCount = txs.length;
  const income = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spend = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const recurringCount = txs.filter((t) => t.recurring).length;
  const subMonthly = subs.reduce((s, sub) => s + sub.amount, 0);

  const lc = prompt.toLowerCase();
  let answer = base.answer;

  if (txCount > 0) {
    if (lc.includes("transaction") || lc.includes("spend") || lc.includes("import")) {
      answer = `Based on your ${txCount} imported transactions: income ${money(income)}, spend ${money(spend)}, net ${money(income - spend)}. ${recurringCount} recurring payments detected.`;
    } else if (lc.includes("subscription") && subs.length > 0) {
      answer = `Your ${subs.length} imported subscriptions cost ${money(subMonthly)} per month (${money(subMonthly * 12)} per year). Review cadence and renewal dates in Subscriptions.`;
    } else {
      answer = `${answer} (Based on ${txCount} persisted transactions and ${subs.length} subscriptions in PostgreSQL.)`;
    }
  }

  return { ...base, answer, dataSource: "postgres" };
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, "invoke:agents");
  if (!auth.ok) return authErrorResponse(auth);
  const body = await req.json();
  const prompt = String(body.prompt || "Assess Vireon");

  const session = auth.session;
  let persisted;
  try {
    persisted = await loadPersistedFinancialContext(session);
  } catch (error) {
    const safe = toSafeTransactionsError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
  const financialContext = assembleFinancialContext(persisted.transactions, persisted.subscriptions);
  const copilotResponse = buildCopilotAnswer(prompt, persisted.transactions, persisted.subscriptions);
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
      repositoryMode: "postgres",
      persistedDataCounts: {
        transactions: persisted.transactions.length,
        subscriptions: persisted.subscriptions.length,
      },
    },
  });
}

export async function GET(req: Request) {
  const auth = await requirePermission(req, "invoke:agents");
  if (!auth.ok) return authErrorResponse(auth);
  let counts = { transactions: 0, subscriptions: 0 };
  try {
    const persisted = await loadPersistedFinancialContext(auth.session);
    counts = { transactions: persisted.transactions.length, subscriptions: persisted.subscriptions.length };
  } catch (error) {
    const safe = toSafeTransactionsError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
  return Response.json({
    ok: true,
    suggestions: getCopilotPromptSuggestions(),
    contextAssembled: true,
    storageMode: "postgres",
    persistedDataCounts: counts,
  });
}
