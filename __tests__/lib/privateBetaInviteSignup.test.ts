import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";
import {
  createPrivateBetaInvitationService,
  hashInvitationToken,
  type InvitationSignupResult,
} from "../../src/server/services/privateBetaInvitationService.ts";
import { createRedeemInvitationHandler } from "../../src/app/api/private-beta/invitations/redeem/route.ts";
import { createRequestAccessHandler } from "../../src/app/api/private-beta/request-access/route.ts";
import { POST as logout } from "../../src/app/api/auth/logout/route.ts";
import { permissionForPath, proxy } from "../../src/proxy.ts";

type InvitationRow = {
  id: string;
  intendedEmail: string;
  status: string;
  expiresAt: string;
  redeemedUserId: string | null;
};

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "invite_token_abcdefghijklmnopqrstuvwxyz";
const TOKEN_HASH = hashInvitationToken(TOKEN);

class FakeInviteDb implements PostgresPilotClient {
  invitation: InvitationRow | null = {
    id: "22222222-2222-4222-8222-222222222222",
    intendedEmail: "founder@example.test",
    status: "pending",
    expiresAt: "2026-09-01T00:00:00.000Z",
    redeemedUserId: null,
  };
  committed = false;
  rolledBack = false;
  queries: Array<{ sql: string; params: unknown[] }> = [];
  failOnProfileInitialization = false;

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    this.queries.push({ sql, params });
    if (this.failOnProfileInitialization && /insert into public\.financial_profiles/i.test(sql)) {
      throw new Error("INJECTED_PROFILE_FAILURE");
    }
    if (/from public\.private_beta_invitations/i.test(sql)) {
      if (params[0] !== TOKEN_HASH || !this.invitation) return { rows: [], rowCount: 0 };
      return { rows: [this.invitation as T], rowCount: 1 };
    }
    if (/update public\.private_beta_invitations/i.test(sql)) {
      if (this.invitation?.status !== "pending" || this.invitation.redeemedUserId) return { rows: [], rowCount: 0 };
      this.invitation = { ...this.invitation, status: "consumed", redeemedUserId: String(params[0]) };
      return { rows: [{ id: this.invitation.id } as T], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    const snapshot = this.invitation ? { ...this.invitation } : null;
    const queriesSnapshot = [...this.queries];
    try {
      const result = await operation(this);
      this.committed = true;
      return result;
    } catch (error) {
      this.invitation = snapshot;
      this.queries = queriesSnapshot;
      this.rolledBack = true;
      throw error;
    }
  }
}

function signup(overrides: Partial<InvitationSignupResult> = {}) {
  return async ({ email }: { email: string; password: string }): Promise<InvitationSignupResult> => ({
    userId: USER_ID,
    email,
    session: { accessToken: "signup-access-token", expiresIn: 3600 },
    confirmationRequired: false,
    ...overrides,
  });
}

function invitedUser(overrides: { confirmed?: boolean; userId?: string } = {}) {
  return {
    userId: overrides.userId || USER_ID,
    email: "founder@example.test",
    emailConfirmed: overrides.confirmed ?? false,
    userMetadata: { vireon_invitation_id: "22222222-2222-4222-8222-222222222222" },
    appMetadata: {},
  };
}

function invitationDeps(db: FakeInviteDb, overrides: {
  signUp?: ReturnType<typeof signup>;
  findUser?: () => ReturnType<typeof invitedUser> | null | Promise<ReturnType<typeof invitedUser> | null>;
  metadataUpdates?: Array<{ userId: string; email: string; invitationId: string }>;
  resendEmails?: string[];
} = {}) {
  const metadataUpdates = overrides.metadataUpdates || [];
  const resendEmails = overrides.resendEmails || [];
  return {
    db,
    signUpWithSupabase: overrides.signUp || signup(),
    findSupabaseUserByEmail: overrides.findUser ? async () => overrides.findUser!() : undefined,
    updateSupabaseUserAppMetadata: async (input: { userId: string; email: string; invitationId: string }) => {
      metadataUpdates.push(input);
    },
    resendSupabaseConfirmation: async (email: string) => {
      resendEmails.push(email);
    },
    now: () => new Date("2026-08-01T00:00:00.000Z"),
  };
}

function redeemBody(overrides: Record<string, unknown> = {}) {
  return {
    token: TOKEN,
    email: "founder@example.test",
    password: "Password1234",
    confirmPassword: "Password1234",
    ...overrides,
  };
}

test("valid invitation registration redeems atomically and initializes onboarding state", async () => {
  const db = new FakeInviteDb();
  const metadataUpdates: Array<{ userId: string; email: string; invitationId: string }> = [];
  const service = createPrivateBetaInvitationService(invitationDeps(db, { metadataUpdates }));
  const result = await service.redeem(redeemBody());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.confirmationRequired, false);
  assert.equal(db.committed, true);
  assert.equal(db.invitation?.status, "consumed");
  assert.equal(metadataUpdates.length, 1);
  assert(db.queries.some((query) => /set_config\('app\.current_user_id'/i.test(query.sql)));
  assert(db.queries.some((query) => /insert into public\.private_beta_onboarding/i.test(query.sql)));
  assert(db.queries.some((query) => /insert into public\.financial_profiles/i.test(query.sql)));
});

test("confirmation-required signup is a successful pending-confirmation outcome", async () => {
  const db = new FakeInviteDb();
  const resendEmails: string[] = [];
  const service = createPrivateBetaInvitationService(invitationDeps(db, {
    signUp: signup({ session: null, confirmationRequired: true, emailConfirmed: false }),
    resendEmails,
  }));
  const result = await service.redeem(redeemBody());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.confirmationRequired, true);
    assert.equal(result.session, null);
  }
  assert.equal(db.invitation?.status, "consumed");
  assert.deepEqual(resendEmails, ["founder@example.test"]);
});

test("existing unconfirmed invited user is rebound without duplicate signup and confirmation can be resent", async () => {
  const db = new FakeInviteDb();
  const resendEmails: string[] = [];
  let signupCalls = 0;
  const service = createPrivateBetaInvitationService(invitationDeps(db, {
    signUp: async () => {
      signupCalls += 1;
      throw new Error("duplicate");
    },
    findUser: () => invitedUser({ confirmed: false }),
    resendEmails,
  }));
  const result = await service.redeem(redeemBody());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.confirmationRequired, true);
  assert.equal(signupCalls, 1);
  assert.equal(db.invitation?.status, "consumed");
  assert.deepEqual(resendEmails, ["founder@example.test"]);
});

test("existing confirmed invited user is bound and can proceed to onboarding", async () => {
  const db = new FakeInviteDb();
  const service = createPrivateBetaInvitationService(invitationDeps(db, {
    signUp: async () => {
      throw new Error("duplicate");
    },
    findUser: () => invitedUser({ confirmed: true }),
  }));
  const result = await service.redeem(redeemBody());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.confirmationRequired, false);
    assert.equal(result.redirectTo, "/beta-onboarding");
  }
  assert.equal(db.invitation?.status, "consumed");
  assert(db.queries.some((query) => /insert into public\.private_beta_onboarding/i.test(query.sql)));
});


test("duplicate submission for same unconfirmed invited user returns pending confirmation", async () => {
  const db = new FakeInviteDb();
  db.invitation = { ...db.invitation!, status: "consumed", redeemedUserId: USER_ID };
  const service = createPrivateBetaInvitationService(invitationDeps(db, {
    findUser: () => invitedUser({ confirmed: false }),
  }));
  const result = await service.redeem(redeemBody());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.confirmationRequired, true);
    assert.equal(result.userId, USER_ID);
  }
});

test("invitation reuse is rejected after the invited user is confirmed", async () => {
  const db = new FakeInviteDb();
  db.invitation = { ...db.invitation!, status: "consumed", redeemedUserId: USER_ID };
  const result = await createPrivateBetaInvitationService(invitationDeps(db, {
    findUser: () => invitedUser({ confirmed: true }),
  })).redeem(redeemBody());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "INVITATION_ALREADY_REDEEMED");
});

test("duplicate Supabase signup does not redeem invitation", async () => {
  const db = new FakeInviteDb();
  const service = createPrivateBetaInvitationService({
    db,
    signUpWithSupabase: async () => {
      throw new Error("duplicate");
    },
    now: () => new Date("2026-08-01T00:00:00.000Z"),
  });
  const result = await service.redeem(redeemBody());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "SUPABASE_SIGNUP_FAILED");
  assert.equal(db.invitation?.status, "pending");
});

test("Supabase failure before user creation leaves invitation issued", async () => {
  const db = new FakeInviteDb();
  const service = createPrivateBetaInvitationService(invitationDeps(db, {
    signUp: async () => {
      throw new Error("supabase unavailable");
    },
    findUser: () => null,
  }));
  const result = await service.redeem(redeemBody());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "SUPABASE_SIGNUP_FAILED");
  assert.equal(db.invitation?.status, "pending");
});

test("failure after Supabase user creation rolls back invitation for safe retry", async () => {
  const db = new FakeInviteDb();
  db.failOnProfileInitialization = true;
  const first = await createPrivateBetaInvitationService(invitationDeps(db, {
    signUp: signup({ session: null, confirmationRequired: true, emailConfirmed: false }),
  })).redeem(redeemBody());
  assert.equal(first.ok, false);
  assert.equal(db.invitation?.status, "pending");
  assert.equal(db.rolledBack, true);
  db.failOnProfileInitialization = false;
  const retry = await createPrivateBetaInvitationService(invitationDeps(db, {
    signUp: async () => {
      throw new Error("duplicate");
    },
    findUser: () => invitedUser({ confirmed: false }),
  })).redeem(redeemBody());
  assert.equal(retry.ok, true);
  assert.equal(db.invitation?.status, "consumed");
});

test("weak and mismatched passwords are rejected before persistence", async () => {
  const weakDb = new FakeInviteDb();
  const weak = await createPrivateBetaInvitationService({ db: weakDb, signUpWithSupabase: signup() }).redeem(redeemBody({ password: "short1", confirmPassword: "short1" }));
  assert.equal(weak.ok, false);
  if (!weak.ok) assert.equal(weak.code, "WEAK_PASSWORD");
  assert.equal(weakDb.queries.length, 0);

  const mismatchDb = new FakeInviteDb();
  const mismatch = await createPrivateBetaInvitationService({ db: mismatchDb, signUpWithSupabase: signup() }).redeem(redeemBody({ confirmPassword: "Different1234" }));
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, "PASSWORD_CONFIRMATION_MISMATCH");
  assert.equal(mismatchDb.queries.length, 0);
});

test("invalid, expired, mismatched and reused invitations are rejected", async () => {
  const invalid = await createPrivateBetaInvitationService({ db: new FakeInviteDb(), signUpWithSupabase: signup() }).redeem(redeemBody({ token: "bad" }));
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.code, "INVALID_INVITATION_TOKEN");

  const expiredDb = new FakeInviteDb();
  expiredDb.invitation = { ...expiredDb.invitation!, expiresAt: "2026-01-01T00:00:00.000Z" };
  const expired = await createPrivateBetaInvitationService({ db: expiredDb, signUpWithSupabase: signup(), now: () => new Date("2026-08-01T00:00:00.000Z") }).redeem(redeemBody());
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.code, "INVITATION_EXPIRED");

  const mismatched = await createPrivateBetaInvitationService({ db: new FakeInviteDb(), signUpWithSupabase: signup() }).redeem(redeemBody({ email: "other@example.test" }));
  assert.equal(mismatched.ok, false);
  if (!mismatched.ok) assert.equal(mismatched.code, "INVITATION_EMAIL_MISMATCH");

  const reusedDb = new FakeInviteDb();
  reusedDb.invitation = { ...reusedDb.invitation!, status: "redeemed", redeemedUserId: USER_ID };
  const reused = await createPrivateBetaInvitationService({ db: reusedDb, signUpWithSupabase: signup() }).redeem(redeemBody());
  assert.equal(reused.ok, false);
  if (!reused.ok) assert.equal(reused.code, "INVITATION_ALREADY_REDEEMED");
});

test("redeem route persists session cookie only when Supabase returns a session", async () => {
  const withCookie = await createRedeemInvitationHandler({ db: new FakeInviteDb(), signUpWithSupabase: signup(), now: () => new Date("2026-08-01T00:00:00.000Z") })(
    new Request("https://vireon.test/api/private-beta/invitations/redeem", { method: "POST", body: JSON.stringify(redeemBody()) })
  );
  assert.equal(withCookie.status, 200);
  assert.match(withCookie.headers.get("set-cookie") ?? "", /vireon_access_token=signup-access-token/);
  assert.equal((await withCookie.json()).redirectTo, "/beta-onboarding");

  const withoutCookie = await createRedeemInvitationHandler({ db: new FakeInviteDb(), signUpWithSupabase: signup({ session: null, confirmationRequired: true }), now: () => new Date("2026-08-01T00:00:00.000Z") })(
    new Request("https://vireon.test/api/private-beta/invitations/redeem", { method: "POST", body: JSON.stringify(redeemBody()) })
  );
  assert.equal(withoutCookie.status, 200);
  assert.equal(withoutCookie.headers.get("set-cookie"), null);
  const withoutCookieBody = await withoutCookie.json();
  assert.equal(withoutCookieBody.confirmationRequired, true);
  assert.equal(withoutCookieBody.message, "Account created. Check your email to confirm your address, then sign in.");
});

test("signout clears invite-created session cookie", async () => {
  const response = await logout();
  assert.match(response.headers.get("set-cookie") ?? "", /vireon_access_token=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("request access records manual review intent without sending invitations", async () => {
  const db = new FakeInviteDb();
  const response = await createRequestAccessHandler({ db, signUpWithSupabase: signup() })(
    new Request("https://vireon.test/api/private-beta/request-access", {
      method: "POST",
      body: JSON.stringify({ email: "waitlist@example.test", message: "Interested in private beta" }),
    })
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.invitationSent, false);
  assert(db.queries.some((query) => /private_beta_access_requests/i.test(query.sql)));
});

test("public invite endpoints pass proxy while product onboarding remains protected", async () => {
  assert.equal(permissionForPath("/api/private-beta/onboarding", "POST"), "manage:workspace");
  const redeem = await proxy(Object.assign(new Request("https://vireon.test/api/private-beta/invitations/redeem", { method: "POST" }), { nextUrl: new URL("https://vireon.test/api/private-beta/invitations/redeem") }) as never);
  assert.equal(redeem.status, 200);
});

test("returnTo sanitization prevents API and open-redirect destinations", async () => {
  const loginPage = readFileSync("src/app/login/page.tsx", "utf-8");
  assert.match(loginPage, /returnTo\.startsWith\(\"\/\"\)/);
  assert.match(loginPage, /!params\.returnTo\.startsWith\(\"\/api\/\"\)/);
  assert.doesNotMatch(loginPage, /https?:\/\//);
});

test("client invitation UI never references service-role credentials", () => {
  const redeemClient = readFileSync("src/app/login/redeem-invitation/RedeemInvitationForm.tsx", "utf-8");
  const requestClient = readFileSync("src/app/login/request-access/RequestAccessForm.tsx", "utf-8");
  assert.doesNotMatch(redeemClient + requestClient, /SUPABASE_SERVICE_ROLE_KEY|service_role|service-role/i);
});

test("private beta invitation migration is additive and durable", () => {
  const sql = readFileSync("migrations/0007_private_beta_invitations.sql", "utf-8");
  assert.match(sql, /create table if not exists private_beta_invitations/i);
  assert.match(sql, /token_hash text not null unique/i);
  assert.match(sql, /private_beta_access_requests/i);
  assert.match(sql, /private_beta_migration_status/i);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
});
