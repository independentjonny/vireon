import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../../src/lib/auth/middleware.ts";
import { FINANCIAL_DATA_RESET_CONFIRMATION, totalFinancialDataDeleted, type FinancialDataResetResult } from "../../src/lib/financialDataReset.ts";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";
import { createFinancialDataResetPostgresService } from "../../src/server/services/financialDataResetPostgresService.ts";

const session: Session = {
  userId: "user-a",
  workspaceId: "workspace-a",
  orgId: "org-a",
  role: "owner",
  email: "owner@example.test",
  expiresAt: "2027-01-01T00:00:00.000Z",
};

const resetResult: FinancialDataResetResult = {
  completedAt: "2026-08-18T10:00:00.000Z",
  deleted: {
    financialRecords: 12,
    documentsAndEvidence: 7,
    transactionsAndSubscriptions: 30,
    calculationsAndReviews: 9,
    decisionsGoalsAndWorkflows: 5,
    financialOperations: 2,
  },
  cancelledAccountDeletionRequests: 1,
  retained: ["account", "email and display name", "authentication and access", "onboarding", "preferences", "feedback", "security audit history"],
};

function resetClient(calls: Array<{ sql: string; params: unknown[] }>): PostgresPilotClient {
  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      calls.push({ sql, params });
      if (sql.includes("reset_current_user_financial_data")) return { rows: [{ reset: resetResult }] as T[] };
      return { rows: [] };
    },
    async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
      return operation(this);
    },
  };
}

test("financial-data reset is blocked outside Preview before any SQL runs", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const service = createFinancialDataResetPostgresService(resetClient(calls), { NODE_ENV: "test", VERCEL_ENV: "production" });
  await assert.rejects(() => service.reset(session, FINANCIAL_DATA_RESET_CONFIRMATION), /only in Preview/i);
  assert.equal(calls.length, 0);
});

test("financial-data reset requires exact typed confirmation", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const service = createFinancialDataResetPostgresService(resetClient(calls), { NODE_ENV: "test", VERCEL_ENV: "preview" });
  await assert.rejects(() => service.reset(session, "DELETE"), /Type DELETE MY FINANCIAL DATA exactly/i);
  assert.equal(calls.length, 0);
});

test("financial-data reset requires the account owner before any SQL runs", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const service = createFinancialDataResetPostgresService(resetClient(calls), { NODE_ENV: "test", VERCEL_ENV: "preview" });
  await assert.rejects(
    () => service.reset({ ...session, role: "member" }, FINANCIAL_DATA_RESET_CONFIRMATION),
    /Only the Vireon account owner/i,
  );
  assert.equal(calls.length, 0);
});

test("financial-data reset scopes the transaction to the authenticated user and returns deletion counts", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const service = createFinancialDataResetPostgresService(resetClient(calls), { NODE_ENV: "test", VERCEL_ENV: "preview" });
  const result = await service.reset(session, FINANCIAL_DATA_RESET_CONFIRMATION);
  assert.ok(calls.some((call) => call.sql.includes("set_config('app.current_user_id'")));
  assert.ok(calls.some((call) => call.sql.includes("reset_current_user_financial_data") && call.params[0] === FINANCIAL_DATA_RESET_CONFIRMATION));
  assert.equal(totalFinancialDataDeleted(result), 65);
  assert.equal(result.cancelledAccountDeletionRequests, 1);
});

test("0011 reset migration deletes the financial domain but preserves identity and account tables", () => {
  const sql = readFileSync("migrations/0011_preview_financial_data_reset.sql", "utf8");
  assert.match(sql, /security definer/i);
  assert.match(sql, /reset_current_user_financial_data/);
  assert.match(sql, /p_confirmation <> 'DELETE MY FINANCIAL DATA'/);
  assert.match(sql, /current_setting\('app\.current_user_id'/);
  for (const table of [
    "financial_facts", "fact_versions", "documents", "document_extractions", "evidence",
    "calculation_snapshots", "digital_twin_scenarios", "simulation_runs", "decisions",
    "decision_history", "workflows", "workflow_steps", "workflow_evidence", "workflow_outcomes",
    "timeline_events", "ai_cfo_questions", "ai_cfo_answers", "daily_reviews", "goals",
    "user_transaction_imports", "user_transactions", "user_subscriptions",
  ]) assert.match(sql, new RegExp(`delete from public\\.${table} where user_id = v_user_id`, "i"));
  assert.doesNotMatch(sql, /delete from public\.users/i);
  assert.doesNotMatch(sql, /delete from public\.financial_profiles/i);
  assert.doesNotMatch(sql, /delete from public\.user_preferences/i);
  assert.doesNotMatch(sql, /delete from public\.audit_events/i);
  assert.doesNotMatch(sql, /delete from public\.private_beta_/i);
  assert.match(sql, /account_deletion_requests[\s\S]*status = 'cancelled'/i);
  assert.match(sql, /grant execute[\s\S]*to vireon_app/i);
});

test("customer-facing reset copy distinguishes deleted financial data from retained personal/account data", () => {
  const client = readFileSync("src/app/components/PrivateBetaFoundationClient.tsx", "utf8");
  const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
  const dashboard = readFileSync("src/app/components/EmptyFinancialDashboard.tsx", "utf8");
  const home = readFileSync("src/app/page.tsx", "utf8");
  const route = readFileSync("src/app/api/private-beta/financial-data-reset/route.ts", "utf8");
  assert.match(client, /Will be permanently deleted/);
  assert.match(client, /Will be retained/);
  assert.match(client, /Delete financial data now/);
  assert.match(client, /View empty Dashboard/);
  assert.match(client, /vireon-add-financial-data-draft-v1/);
  assert.match(privacy, /Delete financial data/);
  assert.doesNotMatch(privacy, /request account deletion/i);
  assert.match(home, /financialPositionIsEmpty/);
  assert.match(dashboard, /Financial data cleared/);
  assert.match(dashboard, /account and personal details are retained/i);
  assert.match(dashboard, /No confirmed financial data/);
  assert.match(route, /requireSession/);
  assert.match(route, /service\.reset/);
});
