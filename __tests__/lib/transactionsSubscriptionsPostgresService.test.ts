import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { NormalizedTransaction } from "../../src/lib/ingestion/csvPipeline.ts";
import type { AuthenticatedSession } from "../../src/lib/productionDataIntegrity.ts";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";
import { createTransactionsSubscriptionsPostgresService } from "../../src/server/services/transactionsSubscriptionsPostgresService.ts";

type StoredTransaction = {
  appId: string;
  workspaceId: string;
  userId: string;
  merchant: string;
  merchantCanonical: string;
  amount: number;
  currency: string;
  category: string;
  subCategory: string;
  date: string;
  recurring: boolean;
  recurringCadence: string | null;
  duplicate: boolean;
  confidence: number;
  rawDescription: string;
  source: "csv";
  createdAt: string;
  archived: boolean;
};

type StoredSubscription = {
  appId: string;
  workspaceId: string;
  userId: string;
  transactionId: string | null;
  merchant: string;
  merchantCanonical: string;
  amount: number;
  cadence: "monthly" | "quarterly" | "annual";
  nextRenewalDate: string;
  cancellationScore: number;
  pricingAnomalyScore: number;
  savingsOpportunity: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

function session(userId: string, workspaceId = "workspace-a"): AuthenticatedSession {
  return {
    userId,
    workspaceId,
    orgId: "org-a",
    role: "owner",
    email: `${userId}@example.test`,
    expiresAt: "2027-01-01T00:00:00.000Z",
  } as AuthenticatedSession;
}

function tx(overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return {
    id: "csv-1",
    rawDescription: "Netflix",
    merchant: "Netflix",
    merchantCanonical: "netflix",
    amount: -23.99,
    currency: "AUD",
    date: "2026-08-01T00:00:00.000Z",
    category: "Subscription",
    subCategory: "Streaming",
    recurring: true,
    recurringCadence: "monthly",
    duplicate: false,
    confidence: 0.9,
    source: "csv",
    ...overrides,
  };
}

class FakeTransactionsClient implements PostgresPilotClient {
  queries: Array<{ scope: "root" | "tx"; sql: string; params: unknown[] }> = [];
  idempotency = new Map<string, string>();
  imports = new Map<string, string>();
  transactions: StoredTransaction[] = [];
  subscriptions: StoredSubscription[] = [];
  private readonly scope: "root" | "tx";
  private readonly shared?: FakeTransactionsClient;

  constructor(scope: "root" | "tx" = "root", shared?: FakeTransactionsClient) {
    this.scope = scope;
    this.shared = shared;
  }

  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    return operation(new FakeTransactionsClient("tx", this));
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const owner = this.shared ?? this;
    owner.queries.push({ scope: this.scope, sql, params });
    const compact = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (this.scope === "root" && compact.includes("set_config('app.current_user_id'")) {
      throw new Error("root scope must not set current user");
    }
    if (compact.startsWith("select set_config")) return { rows: [] };
    if (compact.startsWith("insert into users")) return { rows: [] };
    if (compact.startsWith("select response_hash")) {
      const key = `${params[0]}:${params[1]}:${params[2]}`;
      const responseHash = owner.idempotency.get(key);
      return { rows: responseHash ? [{ responseHash } as T] : [] };
    }
    if (compact.startsWith("insert into idempotency_keys")) {
      owner.idempotency.set(`${params[0]}:${params[2]}:${params[1]}`, String(params[3]));
      return { rows: [] };
    }
    if (compact.startsWith("insert into user_transaction_imports")) {
      const sourceChecksum = String(params[3]);
      const id = owner.imports.get(sourceChecksum) ?? `import-db-${owner.imports.size + 1}`;
      owner.imports.set(sourceChecksum, id);
      return { rows: [{ id } as T] };
    }
    if (compact.startsWith("insert into user_transactions")) {
      const userId = String(params[0]);
      const workspaceId = String(params[1]);
      const appId = String(params[3]);
      if (owner.transactions.some((item) => item.userId === userId && item.appId === appId)) return { rows: [] };
      owner.transactions.push({
        userId,
        workspaceId,
        appId,
        merchant: String(params[4]),
        merchantCanonical: String(params[5]),
        amount: Number(params[6]),
        currency: String(params[7]),
        category: String(params[8]),
        subCategory: String(params[9]),
        date: String(params[10]),
        recurring: Boolean(params[11]),
        recurringCadence: params[12] == null ? null : String(params[12]),
        duplicate: Boolean(params[13]),
        confidence: Number(params[14]),
        rawDescription: String(params[15]),
        source: "csv",
        createdAt: "2026-08-01T00:00:00.000Z",
        archived: false,
      });
      return { rows: [{ appId } as T] };
    }
    if (compact.startsWith("insert into user_subscriptions")) {
      const userId = String(params[0]);
      const workspaceId = String(params[1]);
      const appId = String(params[2]);
      const existing = owner.subscriptions.find((item) => item.userId === userId && item.appId === appId);
      const record: StoredSubscription = {
        userId,
        workspaceId,
        appId,
        transactionId: params[3] == null ? null : String(params[3]),
        merchant: String(params[4]),
        merchantCanonical: String(params[5]),
        amount: Number(params[6]),
        cadence: params[7] as StoredSubscription["cadence"],
        nextRenewalDate: String(params[8]),
        cancellationScore: 0,
        pricingAnomalyScore: 0,
        savingsOpportunity: Number(params[9]),
        active: true,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        archived: false,
      };
      if (existing) Object.assign(existing, record);
      else owner.subscriptions.push(record);
      return compact.includes("returning")
        ? { rows: [{ ...record } as T] }
        : { rows: [] };
    }
    if (compact.startsWith("select app_id") && compact.includes("from user_transactions")) {
      const [userId, workspaceId] = params.map(String);
      return {
        rows: owner.transactions
          .filter((item) => item.userId === userId && item.workspaceId === workspaceId && !item.archived)
          .map((item) => ({ ...item }) as T),
      };
    }
    if (compact.startsWith("select app_id") && compact.includes("from user_subscriptions")) {
      const [userId, workspaceId] = params.map(String);
      return {
        rows: owner.subscriptions
          .filter((item) => item.userId === userId && item.workspaceId === workspaceId && item.active && !item.archived)
          .map((item) => ({ ...item }) as T),
      };
    }
    if (compact.includes("update user_transactions")) {
      const [userId, workspaceId] = params.map(String);
      let count = 0;
      for (const item of owner.transactions) {
        if (item.userId === userId && item.workspaceId === workspaceId && !item.archived) {
          item.archived = true;
          count += 1;
        }
      }
      return { rows: [{ archivedCount: String(count) } as T] };
    }
    if (compact.includes("update user_subscriptions")) {
      const [userId, workspaceId] = params.map(String);
      let count = 0;
      for (const item of owner.subscriptions) {
        if (item.userId === userId && item.workspaceId === workspaceId && !item.archived) {
          item.archived = true;
          item.active = false;
          count += 1;
        }
      }
      return { rows: [{ archivedCount: String(count) } as T] };
    }
    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

test("transactions and subscriptions persist through PostgreSQL with idempotent import and restart-style reload", async () => {
  const client = new FakeTransactionsClient();
  const service = createTransactionsSubscriptionsPostgresService(client);
  const input = [tx(), tx({ id: "csv-2", rawDescription: "Salary", merchant: "Salary", merchantCanonical: "salary", amount: 6420, category: "Income", subCategory: "Salary", recurring: false, recurringCadence: null })];

  const first = await service.persistTransactionsFromIngestion(session("user-a"), {
    transactions: input,
    ingestion: { totalRows: 2, processedRows: 2, duplicateCount: 0, recurringCount: 1, healthScore: 95, errors: [], processedAt: "2026-08-01T00:00:00.000Z" },
    idempotencyKey: "import-key",
  });
  const replay = await service.persistTransactionsFromIngestion(session("user-a"), {
    transactions: input,
    ingestion: { totalRows: 2, processedRows: 2, duplicateCount: 0, recurringCount: 1, healthScore: 95, errors: [], processedAt: "2026-08-01T00:00:00.000Z" },
    idempotencyKey: "import-key",
  });
  const reloaded = await service.listTransactions(session("user-a"));
  const subscriptions = await service.listSubscriptions(session("user-a"));

  assert.equal(first.persistedCount, 2);
  assert.equal(replay.replayed, true);
  assert.equal(replay.persistedCount, 0);
  assert.equal(reloaded.summary.transactionCount, 2);
  assert.equal(reloaded.summary.income, 6420);
  assert.equal(subscriptions.subscriptions.length, 1);
  assert.equal(subscriptions.dataSource, "postgres");
});

test("transactions and subscriptions are scoped by trusted user and transaction-local app.current_user_id", async () => {
  const client = new FakeTransactionsClient();
  const service = createTransactionsSubscriptionsPostgresService(client);

  await service.persistTransactionsFromIngestion(session("user-a"), {
    transactions: [tx()],
    ingestion: { totalRows: 1, processedRows: 1, duplicateCount: 0, recurringCount: 1, healthScore: 90, errors: [], processedAt: "2026-08-01T00:00:00.000Z" },
  });
  const userB = await service.listTransactions(session("user-b"));

  assert.equal(userB.transactions.length, 0);
  assert.equal(client.queries.some((query) => query.scope === "tx" && query.sql.includes("set_config('app.current_user_id'")), true);
  assert.equal(client.queries.some((query) => query.scope === "root" && query.sql.includes("set_config('app.current_user_id'")), false);
});

test("archive operations do not leak across users", async () => {
  const client = new FakeTransactionsClient();
  const service = createTransactionsSubscriptionsPostgresService(client);
  await service.persistTransactionsFromIngestion(session("user-a"), {
    transactions: [tx()],
    ingestion: { totalRows: 1, processedRows: 1, duplicateCount: 0, recurringCount: 1, healthScore: 90, errors: [], processedAt: "2026-08-01T00:00:00.000Z" },
  });
  const archivedB = await service.archiveAllTransactions(session("user-b"));
  const userA = await service.listTransactions(session("user-a"));

  assert.equal(archivedB.archivedCount, 0);
  assert.equal(userA.transactions.length, 1);
});

test("active transaction and subscription routes do not import local JSON stores", () => {
  for (const file of [
    "src/app/api/transactions/route.ts",
    "src/app/api/ingest/route.ts",
    "src/app/api/subscriptions/route.ts",
    "src/app/api/subscriptions/intelligence/route.ts",
    "src/app/api/dashboard-metrics/route.ts",
    "src/app/api/finance-health/route.ts",
    "src/app/api/merchant-intelligence/route.ts",
    "src/app/api/workflow-status/route.ts",
    "src/app/api/copilot/route.ts",
  ]) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /localStore|getLocalTransactions|getLocalSubscriptions|getLocalImports|appendLocalTransactions|appendLocalImport|upsertLocalSubscription|subscriptionSummary|summariseTransactions|getTransactions\(/);
    assert.match(text, /createTransactionsSubscriptionsServiceFromEnv/);
  }
});

test("0006 transaction and subscription migration is additive, RLS-scoped and indexed", () => {
  const sql = readFileSync("migrations/0006_transactions_subscriptions_persistence.sql", "utf8");
  assert.match(sql, /create table if not exists public\.user_transactions/i);
  assert.match(sql, /create table if not exists public\.user_subscriptions/i);
  assert.match(sql, /alter table public\.\%I force row level security/i);
  assert.match(sql, /app\.current_user_id/i);
  assert.match(sql, /idx_user_transactions_user_date/i);
  assert.match(sql, /idx_user_subscriptions_user_active_renewal/i);
  assert.doesNotMatch(sql, /\bdrop\s+(table|column)\b/i);
});
