import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../../src/lib/auth/middleware.ts";
import type { BetaOnboardingState } from "../../src/lib/privateBetaFoundation.ts";
import { PrivateBetaFoundation } from "../../src/lib/privateBetaFoundation.ts";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";
import { createPrivateBetaOnboardingPostgresService } from "../../src/server/services/privateBetaOnboardingPostgresService.ts";

type Call = { sql: string; params: unknown[]; scopedUser: string | null };

function session(userId: string): Session {
  return {
    userId,
    workspaceId: `workspace-${userId}`,
    orgId: "org-test",
    role: "owner",
    email: `${userId}@example.test`,
    expiresAt: "2027-01-01T00:00:00.000Z",
  };
}

function row(state: BetaOnboardingState) {
  return {
    id: state.id,
    userId: state.userId,
    householdId: state.householdId,
    version: state.version,
    steps: state.steps,
    currentStep: state.currentStep,
    consent: state.consent,
    missingInformation: state.missingInformation,
    updatedAt: state.updatedAt,
  };
}

function statefulClient(store: Map<string, BetaOnboardingState>, calls: Call[]): PostgresPilotClient {
  let scopedUser: string | null = null;
  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      calls.push({ sql, params, scopedUser });
      if (sql.includes("set_config('app.current_user_id'")) {
        scopedUser = String(params[0]);
        return { rows: [] };
      }
      if (!scopedUser) throw new Error("query executed without transaction-local user scope");
      if (sql.includes("from private_beta_onboarding")) {
        const requestedUser = String(params[0]);
        return { rows: requestedUser === scopedUser && store.has(requestedUser) ? [row(store.get(requestedUser)!)] as T[] : [] };
      }
      if (sql.includes("insert into private_beta_onboarding")) {
        const created = PrivateBetaFoundation.defaultOnboardingState(String(params[1]), String(params[2]));
        store.set(created.userId, created);
        return { rows: [row(created)] as T[] };
      }
      if (sql.includes("update private_beta_onboarding")) {
        const userId = String(params[1]);
        const current = store.get(userId);
        if (!current || userId !== scopedUser) return { rows: [] };
        const updated: BetaOnboardingState = {
          ...current,
          steps: JSON.parse(String(params[2])),
          currentStep: String(params[3]) as BetaOnboardingState["currentStep"],
          consent: JSON.parse(String(params[4])),
          missingInformation: JSON.parse(String(params[5])),
          updatedAt: "2026-08-05T08:00:00.000Z",
        };
        store.set(userId, updated);
        return { rows: [row(updated)] as T[] };
      }
      return { rows: [] };
    },
    async transaction<T>(operation: (tx: PostgresPilotClient) => Promise<T>): Promise<T> {
      scopedUser = null;
      try {
        return await operation(this);
      } finally {
        scopedUser = null;
      }
    },
  };
}

test("onboarding save resumes from PostgreSQL across service instances", async () => {
  const store = new Map<string, BetaOnboardingState>();
  const calls: Call[] = [];
  const client = statefulClient(store, calls);
  const first = createPrivateBetaOnboardingPostgresService(client);
  const created = await first.readOrCreate(session("user-a"));
  assert.equal(created.userId, "user-a");

  const saved = await first.update(session("user-a"), { step: "income", status: "complete" });
  assert.equal(saved.steps.income, "complete");

  const restarted = createPrivateBetaOnboardingPostgresService(client);
  const resumed = await restarted.readOrCreate(session("user-a"));
  assert.equal(resumed.steps.income, "complete");
  assert.ok(calls.some((call) => call.sql.includes("set_config('app.current_user_id'")));
  assert.ok(calls.some((call) => call.sql.includes("update private_beta_onboarding")));
});

test("onboarding reads and writes remain isolated by transaction-local user scope", async () => {
  const store = new Map<string, BetaOnboardingState>([
    ["user-a", PrivateBetaFoundation.defaultOnboardingState("user-a", "user-a")],
    ["user-b", PrivateBetaFoundation.updateOnboardingState(PrivateBetaFoundation.defaultOnboardingState("user-b", "user-b"), { step: "income", status: "complete" })],
  ]);
  const calls: Call[] = [];
  const service = createPrivateBetaOnboardingPostgresService(statefulClient(store, calls));

  const userA = await service.readOrCreate(session("user-a"));
  assert.equal(userA.userId, "user-a");
  assert.equal(userA.steps.income, "not-started");
  await service.update(session("user-a"), { step: "household", status: "complete" });
  assert.equal(store.get("user-b")?.steps.income, "complete");
  assert.ok(calls.filter((call) => call.sql.includes("private_beta_onboarding")).every((call) => call.params.includes("user-a")));
});

test("hosted onboarding consumers do not use filesystem state authority", () => {
  const route = readFileSync("src/app/api/private-beta/onboarding/route.ts", "utf8");
  const page = readFileSync("src/app/beta-onboarding/page.tsx", "utf8");
  const service = readFileSync("src/server/services/privateBetaOnboardingPostgresService.ts", "utf8");
  assert.doesNotMatch(route, /mutateState|readState|writeState|\.vireon/);
  assert.doesNotMatch(page, /mutateState|readState|writeState|\.vireon/);
  assert.match(service, /private_beta_onboarding/);
  assert.match(service, /set_config\('app\.current_user_id'/);
  assert.doesNotMatch(service, /node:fs|from "fs"|\.vireon/);
});
