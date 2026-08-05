import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";
import { hasPermission } from "../../src/lib/auth/rbac.ts";
import {
  createPrivateBetaInvitationService,
  hashInvitationToken,
} from "../../src/server/services/privateBetaInvitationService.ts";
import { createAdminAccessRequestsHandler } from "../../src/app/api/admin/private-beta/access-requests/route.ts";
import { createApproveAccessRequestHandler } from "../../src/app/api/admin/private-beta/access-requests/[id]/approve/route.ts";
import { createReissueAccessRequestInvitationHandler } from "../../src/app/api/admin/private-beta/access-requests/[id]/reissue/route.ts";
import { createRejectAccessRequestHandler } from "../../src/app/api/admin/private-beta/access-requests/[id]/reject/route.ts";
import { createRevokeInvitationHandler } from "../../src/app/api/admin/private-beta/invitations/[id]/revoke/route.ts";
import { clearPrivateBetaAccessRequestRateLimit, createRequestAccessHandler } from "../../src/app/api/private-beta/request-access/route.ts";
import type { Session } from "../../src/lib/auth/middleware.ts";
import { resolvePublicAppBaseUrl } from "../../src/lib/publicAppUrl.ts";
import { permissionForPath } from "../../src/proxy.ts";

const ADMIN_SESSION: Session = {
  userId: "admin-user-001",
  workspaceId: "workspace-001",
  orgId: "org-001",
  role: "admin",
  email: "admin@example.test",
  expiresAt: "2026-09-01T00:00:00.000Z",
};

type RequestRow = {
  id: string;
  emailNormalized: string;
  displayName: string | null;
  reason: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewReason: string | null;
  approvedInvitationId: string | null;
  correlationId: string | null;
};

type InvitationRow = {
  id: string;
  accessRequestId: string | null;
  emailNormalized: string;
  intendedEmail: string;
  tokenHash: string;
  status: string;
  issuedByUserId: string | null;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  consumedByUserId: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
};

class FakePrivateBetaAccessDb implements PostgresPilotClient {
  requests = new Map<string, RequestRow>();
  invitations = new Map<string, InvitationRow>();
  audit: Array<{ eventType: string; affectedResource: string; params: unknown[] }> = [];
  queries: Array<{ sql: string; params: unknown[] }> = [];
  failAfterInvitation = false;
  scopedUsers: string[] = [];

  constructor() {
    this.requests.set("req-1", {
      id: "req-1",
      emailNormalized: "founder@example.test",
      displayName: "Founder",
      reason: "I want to test Vireon during the private beta.",
      status: "pending",
      submittedAt: "2026-08-01T00:00:00.000Z",
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      approvedInvitationId: null,
      correlationId: "corr-1",
    });
  }

  clone() {
    const copy = new FakePrivateBetaAccessDb();
    copy.requests = new Map([...this.requests].map(([key, value]) => [key, { ...value }]));
    copy.invitations = new Map([...this.invitations].map(([key, value]) => [key, { ...value }]));
    copy.audit = this.audit.map((item) => ({ ...item, params: [...item.params] }));
    copy.queries = this.queries.map((item) => ({ ...item, params: [...item.params] }));
    copy.failAfterInvitation = this.failAfterInvitation;
    copy.scopedUsers = [...this.scopedUsers];
    return copy;
  }

  restore(snapshot: FakePrivateBetaAccessDb) {
    this.requests = snapshot.requests;
    this.invitations = snapshot.invitations;
    this.audit = snapshot.audit;
    this.queries = snapshot.queries;
    this.scopedUsers = snapshot.scopedUsers;
  }

  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    const snapshot = this.clone();
    try {
      return await operation(this);
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    this.queries.push({ sql, params });
    if (/set_config\('app\.current_user_id'/i.test(sql)) {
      this.scopedUsers.push(String(params[0]));
      return { rows: [], rowCount: 0 };
    }
    if (/insert into public\.private_beta_access_requests/i.test(sql)) {
      const email = String(params[0]);
      if (![...this.requests.values()].some((request) => request.emailNormalized === email && request.status === "pending")) {
        const id = `req-${this.requests.size + 1}`;
        this.requests.set(id, {
          id,
          emailNormalized: email,
          displayName: params[2] ? String(params[2]) : null,
          reason: String(params[3]),
          status: "pending",
          submittedAt: "2026-08-01T00:00:00.000Z",
          reviewedAt: null,
          reviewedByUserId: null,
          reviewReason: null,
          approvedInvitationId: null,
          correlationId: String(params[6]),
        });
      }
      return { rows: [], rowCount: 1 };
    }
    if (/from public\.private_beta_access_requests/i.test(sql) && /for update/i.test(sql)) {
      const row = this.requests.get(String(params[0]));
      return { rows: row ? [row as T] : [], rowCount: row ? 1 : 0 };
    }
    if (/from public\.private_beta_access_requests/i.test(sql)) {
      const status = String(params[0] ?? "pending");
      const rows = [...this.requests.values()].filter((request) => request.status === status);
      return { rows: rows as T[], rowCount: rows.length };
    }
    if (/select id from public\.private_beta_invitations/i.test(sql)) {
      const email = String(params[0]);
      const row = [...this.invitations.values()].find((invitation) => invitation.emailNormalized === email && invitation.status === "issued");
      return { rows: row ? [{ id: row.id } as T] : [], rowCount: row ? 1 : 0 };
    }
    if (/insert into public\.private_beta_invitations/i.test(sql)) {
      const row: InvitationRow = {
        id: `inv-${this.invitations.size + 1}`,
        accessRequestId: String(params[0]),
        emailNormalized: String(params[1]),
        intendedEmail: String(params[1]),
        tokenHash: String(params[2]),
        status: "issued",
        issuedByUserId: String(params[3]),
        issuedAt: "2026-08-01T00:00:00.000Z",
        expiresAt: String(params[4]),
        consumedAt: null,
        consumedByUserId: null,
        revokedAt: null,
        revokedByUserId: null,
      };
      this.invitations.set(row.id, row);
      if (this.failAfterInvitation) throw new Error("INJECTED_AFTER_INVITATION");
      return { rows: [row as T], rowCount: 1 };
    }
    if (/update public\.private_beta_access_requests/i.test(sql) && /set status = 'approved'/i.test(sql)) {
      const row = this.requests.get(String(params[4]));
      if (!row) return { rows: [], rowCount: 0 };
      const updated = { ...row, status: "approved", reviewedByUserId: String(params[0]), reviewReason: params[1] ? String(params[1]) : null, approvedInvitationId: String(params[2]) };
      this.requests.set(row.id, updated);
      return { rows: [updated as T], rowCount: 1 };
    }
    if (/update public\.private_beta_access_requests/i.test(sql) && /status = 'rejected'/i.test(sql)) {
      const row = this.requests.get(String(params[3]));
      if (!row || row.status !== "pending") return { rows: [], rowCount: 0 };
      const updated = { ...row, status: "rejected", reviewedByUserId: String(params[0]), reviewReason: params[1] ? String(params[1]) : null };
      this.requests.set(row.id, updated);
      return { rows: [updated as T], rowCount: 1 };
    }
    if (/from public\.private_beta_invitations where id/i.test(sql)) {
      const row = this.invitations.get(String(params[0]));
      return { rows: row ? [row as T] : [], rowCount: row ? 1 : 0 };
    }
    if (/update public\.private_beta_invitations/i.test(sql) && /status = 'revoked'/i.test(sql)) {
      const row = this.invitations.get(String(params[3]));
      if (!row || row.status !== "issued" || row.consumedAt) return { rows: [], rowCount: 0 };
      const updated = { ...row, status: "revoked", revokedByUserId: String(params[0]), revokedAt: "2026-08-01T00:00:00.000Z" };
      this.invitations.set(row.id, updated);
      return { rows: [updated as T], rowCount: 1 };
    }
    if (/insert into public\.private_beta_audit_events/i.test(sql)) {
      this.audit.push({ eventType: String(params[3]), affectedResource: String(params[5]), params });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
}

function service(db = new FakePrivateBetaAccessDb()) {
  return createPrivateBetaInvitationService({
    db,
    signUpWithSupabase: async ({ email }) => ({
      userId: "user-001",
      email,
      session: null,
      confirmationRequired: true,
    }),
    now: () => new Date("2026-08-01T00:00:00.000Z"),
  });
}

const allowAdmin = async () => ({ ok: true as const, session: ADMIN_SESSION });
const denyAdmin = async () => ({ ok: false as const, response: Response.json({ ok: false, error: "forbidden" }, { status: 403 }) });

test("public access request is generic, durable and idempotent without creating invitation", async () => {
  const db = new FakePrivateBetaAccessDb();
  const first = await service(db).requestAccess({ email: "Applicant@Example.test", reason: "I want to trial Vireon for household planning." });
  const second = await service(db).requestAccess({ email: "applicant@example.test", reason: "I want to trial Vireon for household planning." });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok) assert.equal(first.message, "Your request has been submitted for review.");
  assert.equal([...db.requests.values()].filter((row) => row.emailNormalized === "applicant@example.test").length, 1);
  assert.equal(db.invitations.size, 0);
  assert(db.audit.some((event) => event.eventType === "private_beta.access_request_submitted"));
});

test("admin approval creates exactly one expiring invitation and returns raw link once", async () => {
  const db = new FakePrivateBetaAccessDb();
  const result = await service(db).approveAccessRequest({ admin: ADMIN_SESSION, id: "req-1", appUrl: "https://vireon.test" });
  assert.equal(result.ok, true);
  assert.equal(db.invitations.size, 1);
  if (result.ok) {
    assert.equal(result.rawTokenReturned, true);
    assert.match(result.invitationUrl ?? "", /^https:\/\/vireon\.test\/login\/redeem-invitation\?token=/);
    assert.equal(result.invitation.status, "issued");
    const rawToken = new URL(result.invitationUrl!).searchParams.get("token")!;
    assert(!db.queries.some((query) => query.params.includes(rawToken)), "raw token must not be persisted");
    assert(db.queries.some((query) => query.params.includes(hashInvitationToken(rawToken))), "only token hash is persisted");
  }

  const replay = await service(db).approveAccessRequest({ admin: ADMIN_SESSION, id: "req-1", appUrl: "https://vireon.test" });
  assert.equal(replay.ok, true);
  if (replay.ok) {
    assert.equal(replay.alreadyApproved, true);
    assert.equal(replay.invitationUrl, null);
    assert.equal(replay.rawTokenReturned, false);
  }
  assert.equal(db.invitations.size, 1);
  assert(db.audit.some((event) => event.eventType === "private_beta.invitation_issued"));
});

test("invitation URL generation uses localhost development fallback instead of bind host", async () => {
  const previousPublic = process.env.VIREON_PUBLIC_APP_URL;
  const previousNext = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VIREON_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  const db = new FakePrivateBetaAccessDb();
  try {
    const approved = await createApproveAccessRequestHandler({ db, signUpWithSupabase: async () => { throw new Error("not used"); } }, allowAdmin)(
      new Request("http://0.0.0.0:3000/api/admin/private-beta/access-requests/req-1/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "local approval" }),
      }),
      { params: { id: "req-1" } }
    );
    assert.equal(approved.status, 200);
    const body = await approved.json() as { invitationUrl?: string };
    assert.match(body.invitationUrl ?? "", /^http:\/\/localhost:3000\/login\/redeem-invitation\?token=/);
    assert.doesNotMatch(body.invitationUrl ?? "", /0\.0\.0\.0/);
  } finally {
    if (previousPublic === undefined) delete process.env.VIREON_PUBLIC_APP_URL;
    else process.env.VIREON_PUBLIC_APP_URL = previousPublic;
    if (previousNext === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousNext;
  }
});

test("invitation URL generation prefers configured public URL", async () => {
  assert.equal(resolvePublicAppBaseUrl({
    env: {
      NODE_ENV: "production",
      VIREON_PUBLIC_APP_URL: "https://beta.vireon.example/",
      NEXT_PUBLIC_APP_URL: "https://ignored.example",
    } as NodeJS.ProcessEnv,
    request: new Request("http://0.0.0.0:3000/api/admin/private-beta/access-requests/req-1/approve"),
  }), "https://beta.vireon.example");
});

test("invitation URL generation derives safely from reverse proxy host header", async () => {
  assert.equal(resolvePublicAppBaseUrl({
    env: { NODE_ENV: "production" } as NodeJS.ProcessEnv,
    request: new Request("http://0.0.0.0:3000/api/admin/private-beta/access-requests/req-1/approve", {
      headers: {
        "x-forwarded-host": "preview.vireon.example",
        "x-forwarded-proto": "https",
      },
    }),
  }), "https://preview.vireon.example");
});

test("approval rolls back if invitation issuance transaction fails", async () => {
  const db = new FakePrivateBetaAccessDb();
  db.failAfterInvitation = true;
  const result = await service(db).approveAccessRequest({ admin: ADMIN_SESSION, id: "req-1" });
  assert.equal(result.ok, false);
  assert.equal(db.invitations.size, 0);
  assert.equal(db.requests.get("req-1")?.status, "pending");
});

test("admin routes enforce private beta access permission and ignore forged caller fields", async () => {
  assert.equal(hasPermission("admin", "manage:private_beta_access"), true);
  assert.equal(hasPermission("member", "manage:private_beta_access"), false);
  assert.equal(permissionForPath("/api/admin/private-beta/access-requests", "GET"), "manage:private_beta_access");
  assert.equal(permissionForPath("/api/admin/private-beta/future-sensitive-route", "POST"), "manage:private_beta_access");

  const denied = await createAdminAccessRequestsHandler(undefined, denyAdmin)(new Request("https://vireon.test/api/admin/private-beta/access-requests", { headers: { "x-vireon-role": "owner" } }));
  assert.equal(denied.status, 403);

  const db = new FakePrivateBetaAccessDb();
  const approved = await createApproveAccessRequestHandler({ db, signUpWithSupabase: async () => { throw new Error("not used"); } }, allowAdmin)(
    new Request("https://vireon.test/api/admin/private-beta/access-requests/req-1/approve", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vireon-user-id": "attacker", "x-vireon-role": "owner" },
      body: JSON.stringify({ reason: "bounded approval" }),
    }),
    { params: { id: "req-1" } }
  );
  assert.equal(approved.status, 200);
  assert(db.scopedUsers.includes(ADMIN_SESSION.userId));
  assert(!db.scopedUsers.includes("attacker"));
});

test("reject and revoke lifecycle actions are audited and bounded", async () => {
  const rejectDb = new FakePrivateBetaAccessDb();
  const rejected = await createRejectAccessRequestHandler({ db: rejectDb, signUpWithSupabase: async () => { throw new Error("not used"); } }, allowAdmin)(
    new Request("https://vireon.test/api/admin/private-beta/access-requests/req-1/reject", { method: "POST", body: JSON.stringify({ reason: "not a fit for this cohort" }) }),
    { params: { id: "req-1" } }
  );
  assert.equal(rejected.status, 200);
  assert.equal(rejectDb.requests.get("req-1")?.status, "rejected");
  assert(rejectDb.audit.some((event) => event.eventType === "private_beta.access_request_rejected"));

  const revokeDb = new FakePrivateBetaAccessDb();
  const approval = await service(revokeDb).approveAccessRequest({ admin: ADMIN_SESSION, id: "req-1" });
  assert.equal(approval.ok, true);
  const invitationId = [...revokeDb.invitations.keys()][0];
  const revoked = await createRevokeInvitationHandler({ db: revokeDb, signUpWithSupabase: async () => { throw new Error("not used"); } }, allowAdmin)(
    new Request(`https://vireon.test/api/admin/private-beta/invitations/${invitationId}/revoke`, { method: "POST", body: JSON.stringify({ reason: "manual revocation" }) }),
    { params: { id: invitationId } }
  );
  assert.equal(revoked.status, 200);
  assert.equal(revokeDb.invitations.get(invitationId)?.status, "revoked");
  assert(revokeDb.audit.some((event) => event.eventType === "private_beta.invitation_revoked"));
});

test("revoked invitation can only be reissued through explicit admin action", async () => {
  const previousPublic = process.env.VIREON_PUBLIC_APP_URL;
  process.env.VIREON_PUBLIC_APP_URL = "https://vireon.test";
  const db = new FakePrivateBetaAccessDb();
  try {
    const approval = await service(db).approveAccessRequest({ admin: ADMIN_SESSION, id: "req-1", appUrl: "https://vireon.test" });
    assert.equal(approval.ok, true);
    const firstInvitationId = [...db.invitations.keys()][0];
    const revoke = await service(db).revokeInvitation({ admin: ADMIN_SESSION, invitationId: firstInvitationId, reason: "manual replacement" });
    assert.equal(revoke.ok, true);

    const repeatedApprove = await service(db).approveAccessRequest({ admin: ADMIN_SESSION, id: "req-1", appUrl: "https://vireon.test" });
    assert.equal(repeatedApprove.ok, true);
    if (repeatedApprove.ok) {
      assert.equal(repeatedApprove.invitationUrl, null);
      assert.equal(repeatedApprove.rawTokenReturned, false);
    }
    assert.equal(db.invitations.size, 1);

    const reissue = await createReissueAccessRequestInvitationHandler({ db, signUpWithSupabase: async () => { throw new Error("not used"); } }, allowAdmin)(
      new Request("https://vireon.test/api/admin/private-beta/access-requests/req-1/reissue", { method: "POST", body: JSON.stringify({ reason: "replacement link" }) }),
      { params: { id: "req-1" } }
    );
    assert.equal(reissue.status, 200);
    const body = await reissue.json() as { invitationUrl?: string; rawTokenReturned?: boolean };
    assert.match(body.invitationUrl ?? "", /^https:\/\/vireon\.test\/login\/redeem-invitation\?token=/);
    assert.equal(body.rawTokenReturned, true);
    assert.equal(db.invitations.size, 2);
    assert(db.audit.some((event) => event.eventType === "private_beta.invitation_reissued"));
  } finally {
    if (previousPublic === undefined) delete process.env.VIREON_PUBLIC_APP_URL;
    else process.env.VIREON_PUBLIC_APP_URL = previousPublic;
  }
});

test("public access request endpoint is bounded by a non-authoritative request limit", async () => {
  clearPrivateBetaAccessRequestRateLimit();
  const db = new FakePrivateBetaAccessDb();
  const handler = createRequestAccessHandler({ db, signUpWithSupabase: async () => { throw new Error("not used"); } });
  let last = new Response();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    last = await handler(new Request("https://vireon.test/api/private-beta/access-requests", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.55" },
      body: JSON.stringify({ email: `candidate-${attempt}@example.test`, reason: "I want to test Vireon privately." }),
    }));
  }
  assert.equal(last.status, 429);
  const body = await last.json() as { error?: string };
  assert.doesNotMatch(body.error ?? "", /candidate-|approved|invited|account/i);
});

test("migration and client code do not persist or expose raw invitation tokens", () => {
  const sql = readFileSync("migrations/0007_private_beta_invitations.sql", "utf-8");
  assert.match(sql, /token_hash text not null unique/i);
  assert.doesNotMatch(sql, /\braw_token\b|\btoken text\b/i);
  assert.match(sql, /private_beta_access_requests_runtime/i);
  assert.match(sql, /private_beta_invitations_runtime/i);

  const adminClient = readFileSync("src/app/admin/private-beta/access/PrivateBetaAccessAdminClient.tsx", "utf-8");
  assert.doesNotMatch(adminClient, /SUPABASE_SERVICE_ROLE_KEY|service_role|service-role/i);
  assert.match(adminClient, /will not be shown again/i);
});

test("private beta access RLS requires narrow admin or redemption scopes", () => {
  const sql = readFileSync("migrations/0008_private_beta_access_rls_hardening.sql", "utf-8");
  assert.match(sql, /drop policy if exists private_beta_access_requests_runtime/i);
  assert.match(sql, /app\.private_beta_access_admin/i);
  assert.match(sql, /private-beta-public-access/i);
  assert.match(sql, /private-beta-invitation-redemption/i);
  assert.match(sql, /private_beta_migration_status \(version, status, checksum\)/i);
  assert.match(sql, /on conflict \(version\) do update/i);
  assert.doesNotMatch(sql, /private_beta_migration_status \(id,/i);
  assert.doesNotMatch(sql, /for all\s+to vireon_app/i);

  const serviceSource = readFileSync("src/server/services/privateBetaInvitationService.ts", "utf-8");
  assert.match(serviceSource, /set_config\('app\.private_beta_access_admin', 'true', true\)/);
  assert.match(serviceSource, /private-beta-invitation-redemption/);
});
