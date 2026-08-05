import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient, classifyDatabaseError } from "@/server/db/postgresRuntime";
import type { PostgresPilotClient } from "@/lib/postgresPilotPersistence";
import { DEFAULT_PRIVATE_BETA_FLAGS, ONBOARDING_STEPS, PRIVATE_BETA_FOUNDATION_VERSION } from "@/lib/privateBetaFoundation";
import { resolvePublicAppBaseUrl } from "@/lib/publicAppUrl";

if (typeof window !== "undefined") {
  throw new Error("Private beta invitation services are server-only.");
}

export type InvitationSignupSession = {
  accessToken: string;
  expiresIn?: number;
};

export type InvitationAuthUser = {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
};

export type InvitationSignupResult = {
  userId: string;
  email: string;
  session: InvitationSignupSession | null;
  confirmationRequired: boolean;
  emailConfirmed?: boolean;
  existingUser?: boolean;
};

export type InvitationRedemptionInput = {
  token: unknown;
  email: unknown;
  password: unknown;
  confirmPassword: unknown;
  correlationId?: string;
};

export type InvitationRedemptionSuccess = {
  ok: true;
  userId: string;
  email: string;
  redirectTo: "/beta-onboarding";
  confirmationRequired: boolean;
  session: InvitationSignupSession | null;
};

export type InvitationRedemptionFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409 | 422 | 503;
  code:
    | "INVALID_INVITATION_TOKEN"
    | "INVALID_EMAIL"
    | "WEAK_PASSWORD"
    | "PASSWORD_CONFIRMATION_MISMATCH"
    | "INVITATION_NOT_FOUND"
    | "INVITATION_EMAIL_MISMATCH"
    | "INVITATION_EXPIRED"
    | "INVITATION_REVOKED"
    | "INVITATION_ALREADY_REDEEMED"
    | "SUPABASE_SIGNUP_FAILED"
    | "PRIVATE_BETA_INVITATION_STORE_UNAVAILABLE";
  message: string;
};

export type InvitationRedemptionResult = InvitationRedemptionSuccess | InvitationRedemptionFailure;

export type PrivateBetaAdminSession = {
  userId: string;
  email?: string;
};

export type AccessRequestStatus = "pending" | "approved" | "rejected" | "withdrawn" | "expired";
export type InvitationStatus = "issued" | "consumed" | "revoked" | "expired";

export type AccessRequestView = {
  id: string;
  email: string;
  displayName: string | null;
  reason: string;
  status: AccessRequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewReason: string | null;
  approvedInvitationId: string | null;
  correlationId: string | null;
};

export type InvitationView = {
  id: string;
  accessRequestId: string | null;
  email: string;
  status: InvitationStatus;
  issuedByUserId: string | null;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  consumedByUserId: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
};

export type ApprovalResult =
  | { ok: true; request: AccessRequestView; invitation: InvitationView; invitationUrl: string | null; rawTokenReturned: boolean; alreadyApproved: boolean }
  | { ok: false; status: 404 | 409 | 422 | 503; code: string; message: string };

type InvitationRow = {
  id: string;
  accessRequestId?: string | null;
  intendedEmail?: string;
  emailNormalized?: string;
  status: string;
  expiresAt: string;
  issuedByUserId?: string | null;
  issuedAt?: string;
  consumedAt?: string | null;
  consumedByUserId?: string | null;
  redeemedUserId?: string | null;
  revokedAt?: string | null;
  revokedByUserId?: string | null;
};

type AccessRequestRow = {
  id: string;
  email?: string | null;
  emailNormalized?: string | null;
  displayName?: string | null;
  reason?: string | null;
  message?: string | null;
  status: string;
  submittedAt?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  reviewReason?: string | null;
  approvedInvitationId?: string | null;
  correlationId?: string | null;
};

export type PrivateBetaInvitationServiceDeps = {
  db: PostgresPilotClient;
  signUpWithSupabase: (input: { email: string; password: string; invitationId?: string; tokenHash?: string }) => Promise<InvitationSignupResult>;
  findSupabaseUserByEmail?: (email: string, invitationId?: string) => Promise<InvitationAuthUser | null>;
  updateSupabaseUserAppMetadata?: (input: { userId: string; email: string; invitationId: string }) => Promise<void>;
  resendSupabaseConfirmation?: (email: string) => Promise<void>;
  now?: () => Date;
};

function failure(
  status: InvitationRedemptionFailure["status"],
  code: InvitationRedemptionFailure["code"],
  message: string
): InvitationRedemptionFailure {
  return { ok: false, status, code, message };
}

export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function validateInvitationToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (token.length < 24 || token.length > 256) return null;
  if (!/^[A-Za-z0-9._~-]+$/.test(token)) return null;
  return token;
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createInvitationToken(): string {
  return `${randomUUID()}.${randomBytes(32).toString("base64url")}`;
}

export function fingerprintAccessRequest(email: string, reason: string): string {
  return createHash("sha256").update(`${email}\n${reason.trim()}`, "utf8").digest("hex");
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.slice(0, max);
}

function validateReason(value: unknown): string | InvitationRedemptionFailure {
  const reason = boundedText(value, 1200);
  if (!reason || reason.length < 8) return failure(422, "INVALID_EMAIL", "Tell us briefly why you would like access.");
  return reason;
}

function mapRequest(row: AccessRequestRow): AccessRequestView {
  return {
    id: row.id,
    email: row.emailNormalized || row.email || "",
    displayName: row.displayName ?? null,
    reason: row.reason || row.message || "",
    status: normalizeRequestStatus(row.status),
    submittedAt: row.submittedAt || row.createdAt || "",
    reviewedAt: row.reviewedAt ?? null,
    reviewedByUserId: row.reviewedByUserId ?? null,
    reviewReason: row.reviewReason ?? null,
    approvedInvitationId: row.approvedInvitationId ?? null,
    correlationId: row.correlationId ?? null,
  };
}

function mapInvitation(row: InvitationRow): InvitationView {
  return {
    id: row.id,
    accessRequestId: row.accessRequestId ?? null,
    email: row.emailNormalized || row.intendedEmail || "",
    status: normalizeInvitationStatus(row.status),
    issuedByUserId: row.issuedByUserId ?? null,
    issuedAt: row.issuedAt || "",
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt ?? null,
    consumedByUserId: row.consumedByUserId ?? row.redeemedUserId ?? null,
    revokedAt: row.revokedAt ?? null,
    revokedByUserId: row.revokedByUserId ?? null,
  };
}

function normalizeRequestStatus(status: string): AccessRequestStatus {
  if (status === "requested") return "pending";
  if (status === "invited" || status === "reviewed") return "approved";
  if (["pending", "approved", "rejected", "withdrawn", "expired"].includes(status)) return status as AccessRequestStatus;
  return "pending";
}

function normalizeInvitationStatus(status: string): InvitationStatus {
  if (status === "pending") return "issued";
  if (status === "redeemed") return "consumed";
  if (["issued", "consumed", "revoked", "expired"].includes(status)) return status as InvitationStatus;
  return "issued";
}

async function setScope(tx: PostgresPilotClient, userId: string) {
  await tx.query("select set_config('app.current_user_id', $1, true)", [userId]);
}

async function setAdminScope(tx: PostgresPilotClient, userId: string) {
  await setScope(tx, userId);
  await tx.query("select set_config('app.private_beta_access_admin', 'true', true)");
}

async function appendAudit(tx: PostgresPilotClient, input: {
  actorUserId: string;
  householdId?: string;
  eventType: string;
  affectedResource: string;
  outcome: string;
  correlationId: string;
  reason?: string | null;
}) {
  await tx.query(
    `insert into public.private_beta_audit_events
       (id, user_id, household_id, event_type, actor, timestamp, affected_resource, outcome, reference_id, safe_metadata)
     values ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9::jsonb)`,
    [
      `audit-${randomUUID()}`,
      input.actorUserId,
      input.householdId || input.actorUserId,
      input.eventType,
      input.actorUserId,
      input.affectedResource,
      input.outcome,
      input.correlationId,
      JSON.stringify({ reason: input.reason ? input.reason.slice(0, 300) : null }),
    ]
  );
}

function validatePassword(password: unknown, confirmPassword: unknown): string | InvitationRedemptionFailure {
  if (typeof password !== "string" || password.length < 10) {
    return failure(422, "WEAK_PASSWORD", "Use a password of at least 10 characters.");
  }
  if (password.length > 128) {
    return failure(422, "WEAK_PASSWORD", "Use a shorter password.");
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return failure(422, "WEAK_PASSWORD", "Use a password with letters and numbers.");
  }
  if (password !== confirmPassword) {
    return failure(422, "PASSWORD_CONFIRMATION_MISMATCH", "Passwords do not match.");
  }
  return password;
}

function defaultOnboardingPayload() {
  const steps = Object.fromEntries(ONBOARDING_STEPS.map((step, index) => [step.id, index === 0 ? "complete" : "not-started"]));
  return {
    version: PRIVATE_BETA_FOUNDATION_VERSION,
    steps,
    currentStep: "household",
    consent: { financialDataStorage: false, uploadConsent: false, betaTermsAccepted: false },
    missingInformation: ["income", "cash balances", "recurring expenses"],
  };
}

async function initializeMinimumProfile(tx: PostgresPilotClient, input: { userId: string; email: string; correlationId: string }) {
  await setScope(tx, input.userId);
  await tx.query(
    `insert into public.users (id, email, source, correlation_id)
     values ($1, $2, 'private-beta-invitation', $3)
     on conflict (id) do update set email = excluded.email, updated_at = now(), correlation_id = excluded.correlation_id`,
    [input.userId, input.email, input.correlationId]
  );
  await tx.query(
    `insert into public.financial_profiles (user_id, state, profile_confidence, source, correlation_id)
     select $1, 'private-beta-onboarding', 0, 'private-beta-invitation', $2
     where not exists (
       select 1 from public.financial_profiles where user_id = $1 and state = 'private-beta-onboarding'
     )`,
    [input.userId, input.correlationId]
  );
  const onboarding = defaultOnboardingPayload();
  await tx.query(
    `insert into public.private_beta_onboarding
       (id, user_id, household_id, version, steps, current_step, consent, missing_information)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb)
     on conflict (id) do nothing`,
    [
      `onboarding-${input.userId}-${input.userId}`,
      input.userId,
      input.userId,
      onboarding.version,
      JSON.stringify(onboarding.steps),
      onboarding.currentStep,
      JSON.stringify(onboarding.consent),
      JSON.stringify(onboarding.missingInformation),
    ]
  );
  await tx.query(
    `insert into public.user_preferences (user_id, preference_key, preference_value, source, correlation_id)
     values ($1, 'private_beta_flags', $2::jsonb, 'private-beta-invitation', $3)
     on conflict (user_id, preference_key) do nothing`,
    [input.userId, JSON.stringify(DEFAULT_PRIVATE_BETA_FLAGS), input.correlationId]
  );
  await appendAudit(tx, {
    actorUserId: input.userId,
    eventType: "private_beta.registration_completed",
    affectedResource: input.userId,
    outcome: "success",
    correlationId: input.correlationId,
  });
  await appendAudit(tx, {
    actorUserId: input.userId,
    eventType: "private_beta.onboarding_initialized",
    affectedResource: `onboarding-${input.userId}-${input.userId}`,
    outcome: "success",
    correlationId: input.correlationId,
  });
}

function signupFromExistingUser(user: InvitationAuthUser): InvitationSignupResult {
  return {
    userId: user.userId,
    email: user.email,
    session: null,
    confirmationRequired: !user.emailConfirmed,
    emailConfirmed: user.emailConfirmed,
    existingUser: true,
  };
}

async function ensureInvitationAuthMetadata(
  deps: PrivateBetaInvitationServiceDeps,
  input: { userId: string; email: string; invitationId: string }
) {
  if (!deps.updateSupabaseUserAppMetadata) return;
  await deps.updateSupabaseUserAppMetadata(input);
}

async function resendConfirmationIfPending(deps: PrivateBetaInvitationServiceDeps, signup: InvitationSignupResult) {
  if (!signup.confirmationRequired || !deps.resendSupabaseConfirmation) return;
  await deps.resendSupabaseConfirmation(signup.email);
}

export function createPrivateBetaInvitationService(deps: PrivateBetaInvitationServiceDeps) {
  async function redeem(input: InvitationRedemptionInput): Promise<InvitationRedemptionResult> {
    const token = validateInvitationToken(input.token);
    if (!token) return failure(400, "INVALID_INVITATION_TOKEN", "Invitation link is invalid.");
    const email = normalizeInvitationEmail(input.email);
    if (!email) return failure(422, "INVALID_EMAIL", "Enter the email address used for your invitation.");
    const password = validatePassword(input.password, input.confirmPassword);
    if (typeof password !== "string") return password;
    const tokenHash = hashInvitationToken(token);
    const correlationId = input.correlationId || `invite-${randomUUID()}`;
    const now = deps.now?.() ?? new Date();

    try {
      return await deps.db.transaction(async (tx) => {
        await setScope(tx, "private-beta-invitation-redemption");
        const invitationRows = await tx.query<InvitationRow>(
          `select id, intended_email as "intendedEmail", status, expires_at as "expiresAt", redeemed_user_id as "redeemedUserId"
             , email_normalized as "emailNormalized", consumed_by_user_id as "consumedByUserId"
           from public.private_beta_invitations
           where token_hash = $1
           for update`,
          [tokenHash]
        );
        const invitation = invitationRows.rows[0];
        if (!invitation) return failure(404, "INVITATION_NOT_FOUND", "Invitation was not found.");
        if (normalizeInvitationEmail(invitation.emailNormalized || invitation.intendedEmail) !== email) {
          return failure(403, "INVITATION_EMAIL_MISMATCH", "This invitation is for a different email address.");
        }
        if (invitation.status === "revoked") return failure(409, "INVITATION_REVOKED", "Invitation has been revoked.");
        if (["redeemed", "consumed"].includes(invitation.status) || invitation.redeemedUserId || invitation.consumedByUserId) {
          const consumedUserId = invitation.consumedByUserId || invitation.redeemedUserId;
          const existing = deps.findSupabaseUserByEmail ? await deps.findSupabaseUserByEmail(email, invitation.id) : null;
          if (existing?.userId && existing.userId === consumedUserId && !existing.emailConfirmed) {
            const signup = signupFromExistingUser(existing);
            await resendConfirmationIfPending(deps, signup);
            return {
              ok: true,
              userId: signup.userId,
              email: signup.email || email,
              redirectTo: "/beta-onboarding",
              confirmationRequired: true,
              session: null,
            };
          }
          return failure(409, "INVITATION_ALREADY_REDEEMED", "Invitation has already been redeemed.");
        }
        if (new Date(invitation.expiresAt).getTime() <= now.getTime()) {
          return failure(409, "INVITATION_EXPIRED", "Invitation has expired.");
        }

        let signup: InvitationSignupResult;
        try {
          signup = await deps.signUpWithSupabase({ email, password, invitationId: invitation.id, tokenHash });
        } catch {
          const existing = deps.findSupabaseUserByEmail ? await deps.findSupabaseUserByEmail(email, invitation.id) : null;
          if (!existing?.userId) {
            return failure(409, "SUPABASE_SIGNUP_FAILED", "Account could not be created for this invitation.");
          }
          signup = signupFromExistingUser(existing);
        }
        if (!signup.userId) {
          return failure(409, "SUPABASE_SIGNUP_FAILED", "Account could not be created for this invitation.");
        }

        await ensureInvitationAuthMetadata(deps, { userId: signup.userId, email: signup.email || email, invitationId: invitation.id });
        await initializeMinimumProfile(tx, { userId: signup.userId, email: signup.email || email, correlationId });
        await setScope(tx, "private-beta-invitation-redemption");
        const update = await tx.query<{ id: string }>(
          `update public.private_beta_invitations
           set status = 'consumed', consumed_at = now(), consumed_by_user_id = $1, redeemed_at = now(), redeemed_user_id = $1, updated_at = now(), correlation_id = $2
           where id = $3 and status in ('pending', 'issued') and coalesce(consumed_by_user_id::text, redeemed_user_id::text) is null
           returning id`,
          [signup.userId, correlationId, invitation.id]
        );
        if (update.rowCount !== 1) return failure(409, "INVITATION_ALREADY_REDEEMED", "Invitation has already been redeemed.");
        await setScope(tx, signup.userId);
        await resendConfirmationIfPending(deps, signup);
        await appendAudit(tx, {
          actorUserId: signup.userId,
          eventType: "private_beta.invitation_consumed",
          affectedResource: invitation.id,
          outcome: "success",
          correlationId,
        });

        return {
          ok: true,
          userId: signup.userId,
          email: signup.email || email,
          redirectTo: "/beta-onboarding",
          confirmationRequired: signup.confirmationRequired,
          session: signup.session,
        };
      });
    } catch (error) {
      const errorClass = classifyDatabaseError(error);
      if (errorClass === "UNIQUE_CONSTRAINT") return failure(409, "SUPABASE_SIGNUP_FAILED", "An account already exists for this email.");
      return failure(503, "PRIVATE_BETA_INVITATION_STORE_UNAVAILABLE", "Private beta invitations are temporarily unavailable.");
    }
  }

  async function requestAccess(input: { email: unknown; message?: unknown; reason?: unknown; displayName?: unknown; correlationId?: string; source?: string }) {
    const email = normalizeInvitationEmail(input.email);
    const generic = { ok: true as const, invitationSent: false, message: "Your request has been submitted for review." };
    if (!email) return failure(422, "INVALID_EMAIL", "Enter a valid email address.");
    const reason = validateReason(input.reason ?? input.message);
    if (typeof reason !== "string") return reason;
    const displayName = boundedText(input.displayName, 120);
    const correlationId = input.correlationId || `access-${randomUUID()}`;
    try {
      await deps.db.transaction(async (tx) => {
        await setScope(tx, "private-beta-public-access");
        await tx.query(
          `insert into public.private_beta_access_requests
             (email, email_normalized, email_original, display_name, message, reason, request_fingerprint, source, correlation_id)
           values ($1, $1, $2, $3, $4, $4, $5, $6, $7)
           on conflict do nothing`,
          [email, typeof input.email === "string" ? input.email.trim().slice(0, 254) : email, displayName, reason, fingerprintAccessRequest(email, reason), input.source || "public-request-access", correlationId]
        );
        await appendAudit(tx, {
          actorUserId: "private-beta-public-access",
          eventType: "private_beta.access_request_submitted",
          affectedResource: email,
          outcome: "accepted_for_review",
          correlationId,
        });
      });
    } catch {
      return failure(503, "PRIVATE_BETA_INVITATION_STORE_UNAVAILABLE", "Private beta access requests are temporarily unavailable.");
    }
    return generic;
  }

  async function listAccessRequests(input: { admin: PrivateBetaAdminSession; status?: unknown; limit?: unknown }) {
    const limit = Math.max(1, Math.min(Number(input.limit) || 50, 100));
    const statuses = new Set(["pending", "approved", "rejected", "withdrawn", "expired", "requested", "invited"]);
    const status = typeof input.status === "string" && statuses.has(input.status) ? input.status : "pending";
    return deps.db.transaction(async (tx) => {
      await setAdminScope(tx, input.admin.userId);
      const rows = await tx.query<AccessRequestRow>(
        `select id, coalesce(email_normalized, lower(email)) as "emailNormalized", display_name as "displayName",
           coalesce(reason, message, '') as reason, status, coalesce(submitted_at, created_at) as "submittedAt",
           reviewed_at as "reviewedAt", reviewed_by_user_id as "reviewedByUserId",
           review_reason as "reviewReason", approved_invitation_id as "approvedInvitationId", correlation_id as "correlationId"
         from public.private_beta_access_requests
         where status = $1
         order by coalesce(submitted_at, created_at) desc
         limit $2`,
        [status, limit]
      );
      return { ok: true as const, requests: rows.rows.map(mapRequest) };
    }).catch(() => ({ ok: false as const, status: 503, code: "PRIVATE_BETA_ACCESS_STORE_UNAVAILABLE", message: "Private beta access administration is unavailable." }));
  }

  async function getAccessRequest(input: { admin: PrivateBetaAdminSession; id: string }) {
    return deps.db.transaction(async (tx) => {
      await setAdminScope(tx, input.admin.userId);
      const rows = await tx.query<AccessRequestRow>(
        `select id, coalesce(email_normalized, lower(email)) as "emailNormalized", display_name as "displayName",
           coalesce(reason, message, '') as reason, status, coalesce(submitted_at, created_at) as "submittedAt",
           reviewed_at as "reviewedAt", reviewed_by_user_id as "reviewedByUserId",
           review_reason as "reviewReason", approved_invitation_id as "approvedInvitationId", correlation_id as "correlationId"
         from public.private_beta_access_requests
         where id = $1`,
        [input.id]
      );
      if (!rows.rows[0]) return { ok: false as const, status: 404, code: "ACCESS_REQUEST_NOT_FOUND", message: "Access request was not found." };
      return { ok: true as const, request: mapRequest(rows.rows[0]) };
    }).catch(() => ({ ok: false as const, status: 503, code: "PRIVATE_BETA_ACCESS_STORE_UNAVAILABLE", message: "Private beta access administration is unavailable." }));
  }

  async function approveAccessRequest(input: {
    admin: PrivateBetaAdminSession;
    id: string;
    reviewReason?: unknown;
    appUrl?: string;
    correlationId?: string;
    reissue?: boolean;
  }): Promise<ApprovalResult> {
    const correlationId = input.correlationId || `approve-${randomUUID()}`;
    const reviewReason = boundedText(input.reviewReason, 500);
    const expiresAt = new Date((deps.now?.() ?? new Date()).getTime() + 1000 * 60 * 60 * 24 * 14);
    const appUrl = (input.appUrl || resolvePublicAppBaseUrl()).replace(/\/+$/, "");
    try {
      return await deps.db.transaction(async (tx) => {
        await setAdminScope(tx, input.admin.userId);
        const requestRows = await tx.query<AccessRequestRow>(
          `select id, coalesce(email_normalized, lower(email)) as "emailNormalized", display_name as "displayName",
             coalesce(reason, message, '') as reason, status, coalesce(submitted_at, created_at) as "submittedAt",
             reviewed_at as "reviewedAt", reviewed_by_user_id as "reviewedByUserId",
             review_reason as "reviewReason", approved_invitation_id as "approvedInvitationId", correlation_id as "correlationId"
           from public.private_beta_access_requests
           where id = $1
           for update`,
          [input.id]
        );
        const request = requestRows.rows[0];
        if (!request) return { ok: false, status: 404, code: "ACCESS_REQUEST_NOT_FOUND", message: "Access request was not found." };
        const currentStatus = normalizeRequestStatus(request.status);
        if (currentStatus === "rejected") return { ok: false, status: 409, code: "ACCESS_REQUEST_REJECTED", message: "Rejected requests cannot be approved without a new request." };
        if (currentStatus === "approved" && request.approvedInvitationId) {
          const existing = await tx.query<InvitationRow>(
            `select id, access_request_id as "accessRequestId", email_normalized as "emailNormalized", intended_email as "intendedEmail",
               status, issued_by_user_id as "issuedByUserId", issued_at as "issuedAt", expires_at as "expiresAt",
               consumed_at as "consumedAt", consumed_by_user_id as "consumedByUserId", revoked_at as "revokedAt", revoked_by_user_id as "revokedByUserId"
             from public.private_beta_invitations where id = $1`,
            [request.approvedInvitationId]
          );
          if (existing.rows[0]) {
            const existingStatus = normalizeInvitationStatus(existing.rows[0].status);
            if (!input.reissue || !["revoked", "expired"].includes(existingStatus)) {
              return { ok: true, request: mapRequest(request), invitation: mapInvitation(existing.rows[0]), invitationUrl: null, rawTokenReturned: false, alreadyApproved: true };
            }
          }
        }
        const email = normalizeInvitationEmail(request.emailNormalized || request.email);
        if (!email) return { ok: false, status: 422, code: "INVALID_REQUEST_EMAIL", message: "Access request email is invalid." };
        const active = await tx.query<{ id: string }>(
          `select id from public.private_beta_invitations
           where coalesce(email_normalized, lower(intended_email)) = $1 and status = 'issued' and expires_at > now()
           limit 1`,
          [email]
        );
        if (active.rows[0]) return { ok: false, status: 409, code: "ACTIVE_INVITATION_EXISTS", message: "An active invitation already exists for this request." };
        const rawToken = createInvitationToken();
        const tokenHash = hashInvitationToken(rawToken);
        const invitationRows = await tx.query<InvitationRow>(
          `insert into public.private_beta_invitations
             (access_request_id, email_normalized, intended_email, token_hash, status, issued_by_user_id, expires_at, correlation_id)
           values ($1, $2, $2, $3, 'issued', $4, $5, $6)
           returning id, access_request_id as "accessRequestId", email_normalized as "emailNormalized", intended_email as "intendedEmail",
             status, issued_by_user_id as "issuedByUserId", issued_at as "issuedAt", expires_at as "expiresAt",
             consumed_at as "consumedAt", consumed_by_user_id as "consumedByUserId", revoked_at as "revokedAt", revoked_by_user_id as "revokedByUserId"`,
          [request.id, email, tokenHash, input.admin.userId, expiresAt.toISOString(), correlationId]
        );
        const invitation = invitationRows.rows[0];
        const updatedRows = await tx.query<AccessRequestRow>(
          `update public.private_beta_access_requests
           set status = 'approved', reviewed_at = now(), reviewed_by_user_id = $1, review_reason = $2,
             approved_invitation_id = $3, updated_at = now(), correlation_id = $4
           where id = $5
           returning id, coalesce(email_normalized, lower(email)) as "emailNormalized", display_name as "displayName",
             coalesce(reason, message, '') as reason, status, coalesce(submitted_at, created_at) as "submittedAt",
             reviewed_at as "reviewedAt", reviewed_by_user_id as "reviewedByUserId",
             review_reason as "reviewReason", approved_invitation_id as "approvedInvitationId", correlation_id as "correlationId"`,
          [input.admin.userId, reviewReason, invitation.id, correlationId, request.id]
        );
        await appendAudit(tx, { actorUserId: input.admin.userId, eventType: "private_beta.access_request_approved", affectedResource: request.id, outcome: "success", correlationId, reason: reviewReason });
        await appendAudit(tx, {
          actorUserId: input.admin.userId,
          eventType: input.reissue ? "private_beta.invitation_reissued" : "private_beta.invitation_issued",
          affectedResource: invitation.id,
          outcome: "success",
          correlationId,
        });
        return {
          ok: true,
          request: mapRequest(updatedRows.rows[0]),
          invitation: mapInvitation(invitation),
          invitationUrl: `${appUrl}/login/redeem-invitation?token=${encodeURIComponent(rawToken)}`,
          rawTokenReturned: true,
          alreadyApproved: false,
        };
      });
    } catch (error) {
      const errorClass = classifyDatabaseError(error);
      if (errorClass === "UNIQUE_CONSTRAINT") return { ok: false, status: 409, code: "ACTIVE_INVITATION_EXISTS", message: "An active invitation already exists." };
      return { ok: false, status: 503, code: "PRIVATE_BETA_ACCESS_STORE_UNAVAILABLE", message: "Private beta access administration is unavailable." };
    }
  }

  async function rejectAccessRequest(input: { admin: PrivateBetaAdminSession; id: string; reviewReason?: unknown; correlationId?: string }) {
    const correlationId = input.correlationId || `reject-${randomUUID()}`;
    const reviewReason = boundedText(input.reviewReason, 500);
    return deps.db.transaction(async (tx) => {
      await setAdminScope(tx, input.admin.userId);
      const rows = await tx.query<AccessRequestRow>(
        `update public.private_beta_access_requests
         set status = 'rejected', reviewed_at = now(), reviewed_by_user_id = $1, review_reason = $2, updated_at = now(), correlation_id = $3
         where id = $4 and status in ('pending', 'requested')
         returning id, coalesce(email_normalized, lower(email)) as "emailNormalized", display_name as "displayName",
           coalesce(reason, message, '') as reason, status, coalesce(submitted_at, created_at) as "submittedAt",
           reviewed_at as "reviewedAt", reviewed_by_user_id as "reviewedByUserId",
           review_reason as "reviewReason", approved_invitation_id as "approvedInvitationId", correlation_id as "correlationId"`,
        [input.admin.userId, reviewReason, correlationId, input.id]
      );
      if (!rows.rows[0]) return { ok: false as const, status: 409, code: "ACCESS_REQUEST_NOT_PENDING", message: "Only pending access requests can be rejected." };
      await appendAudit(tx, { actorUserId: input.admin.userId, eventType: "private_beta.access_request_rejected", affectedResource: input.id, outcome: "success", correlationId, reason: reviewReason });
      return { ok: true as const, request: mapRequest(rows.rows[0]) };
    }).catch(() => ({ ok: false as const, status: 503, code: "PRIVATE_BETA_ACCESS_STORE_UNAVAILABLE", message: "Private beta access administration is unavailable." }));
  }

  async function revokeInvitation(input: { admin: PrivateBetaAdminSession; invitationId: string; reason?: unknown; correlationId?: string }) {
    const correlationId = input.correlationId || `revoke-${randomUUID()}`;
    const reason = boundedText(input.reason, 500);
    return deps.db.transaction(async (tx) => {
      await setAdminScope(tx, input.admin.userId);
      const rows = await tx.query<InvitationRow>(
        `update public.private_beta_invitations
         set status = 'revoked', revoked_at = now(), revoked_by_user_id = $1, revocation_reason = $2, updated_at = now(), correlation_id = $3
         where id = $4 and status = 'issued' and consumed_at is null and consumed_by_user_id is null
         returning id, access_request_id as "accessRequestId", email_normalized as "emailNormalized", intended_email as "intendedEmail",
           status, issued_by_user_id as "issuedByUserId", issued_at as "issuedAt", expires_at as "expiresAt",
           consumed_at as "consumedAt", consumed_by_user_id as "consumedByUserId", revoked_at as "revokedAt", revoked_by_user_id as "revokedByUserId"`,
        [input.admin.userId, reason, correlationId, input.invitationId]
      );
      if (!rows.rows[0]) return { ok: false as const, status: 409, code: "INVITATION_NOT_REVOKABLE", message: "Only unused issued invitations can be revoked." };
      await appendAudit(tx, { actorUserId: input.admin.userId, eventType: "private_beta.invitation_revoked", affectedResource: input.invitationId, outcome: "success", correlationId, reason });
      return { ok: true as const, invitation: mapInvitation(rows.rows[0]) };
    }).catch(() => ({ ok: false as const, status: 503, code: "PRIVATE_BETA_ACCESS_STORE_UNAVAILABLE", message: "Private beta access administration is unavailable." }));
  }

  async function reissueInvitationForAccessRequest(input: { admin: PrivateBetaAdminSession; id: string; reviewReason?: unknown; appUrl?: string; correlationId?: string }): Promise<ApprovalResult> {
    return approveAccessRequest({ ...input, reissue: true, correlationId: input.correlationId || `reissue-${randomUUID()}` });
  }

  return { redeem, requestAccess, listAccessRequests, getAccessRequest, approveAccessRequest, rejectAccessRequest, revokeInvitation, reissueInvitationForAccessRequest };
}

function supabaseUrlAndKeys(env: NodeJS.ProcessEnv) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, anonKey, serviceRoleKey };
}

export async function supabaseAnonSignUp(input: { email: string; password: string; invitationId?: string; tokenHash?: string }, env: NodeJS.ProcessEnv = process.env): Promise<InvitationSignupResult> {
  const { supabaseUrl, anonKey } = supabaseUrlAndKeys(env);
  if (!supabaseUrl || !anonKey) throw new Error("SUPABASE_SIGNUP_NOT_CONFIGURED");
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: {
        vireon_invitation_id: input.invitationId,
        vireon_invitation_token_hash: input.tokenHash,
        vireon_invitation_email: input.email,
      },
    }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as {
    user?: { id?: string; email?: string; email_confirmed_at?: string | null; confirmed_at?: string | null };
    session?: { access_token?: string; expires_in?: number } | null;
  };
  if (!response.ok || !body.user?.id) throw new Error("SUPABASE_SIGNUP_FAILED");
  const emailConfirmed = Boolean(body.user.email_confirmed_at || body.user.confirmed_at);
  return {
    userId: body.user.id,
    email: body.user.email || input.email,
    session: body.session?.access_token ? { accessToken: body.session.access_token, expiresIn: body.session.expires_in } : null,
    confirmationRequired: !body.session?.access_token || !emailConfirmed,
    emailConfirmed,
  };
}

async function supabaseAdminFetch(env: NodeJS.ProcessEnv, path: string, init: RequestInit = {}) {
  const { supabaseUrl, serviceRoleKey } = supabaseUrlAndKeys(env);
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

function authUserFromSupabase(row: Record<string, unknown>): InvitationAuthUser | null {
  const userId = typeof row.id === "string" ? row.id : "";
  const email = typeof row.email === "string" ? row.email : "";
  if (!userId || !email) return null;
  const appMetadata = row.app_metadata && typeof row.app_metadata === "object" && !Array.isArray(row.app_metadata)
    ? row.app_metadata as Record<string, unknown>
    : {};
  const userMetadata = row.user_metadata && typeof row.user_metadata === "object" && !Array.isArray(row.user_metadata)
    ? row.user_metadata as Record<string, unknown>
    : {};
  return {
    userId,
    email,
    emailConfirmed: Boolean(row.email_confirmed_at || row.confirmed_at),
    appMetadata,
    userMetadata,
  };
}

export async function supabaseFindUserByInvitationEmail(email: string, invitationId?: string, env: NodeJS.ProcessEnv = process.env): Promise<InvitationAuthUser | null> {
  const normalized = normalizeInvitationEmail(email);
  if (!normalized) return null;
  const response = await supabaseAdminFetch(env, "/auth/v1/admin/users?page=1&per_page=100");
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({})) as { users?: Array<Record<string, unknown>> };
  const matches = (body.users || [])
    .map(authUserFromSupabase)
    .filter((user): user is InvitationAuthUser => user !== null && normalizeInvitationEmail(user.email) === normalized);
  if (!matches.length) return null;
  const invitationMatch = matches.find((user) => user.userMetadata?.vireon_invitation_id === invitationId);
  if (invitationMatch) return invitationMatch;
  const unconfirmed = matches.find((user) => !user.emailConfirmed);
  if (unconfirmed) return unconfirmed;
  const unprivileged = matches.find((user) => !user.appMetadata?.vireon_role);
  return unprivileged || null;
}

export async function supabaseUpdateInvitationUserMetadata(input: { userId: string; email: string; invitationId: string }, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const workspaceId = env.VIREON_DEFAULT_WORKSPACE_ID || "default-workspace";
  const orgId = env.VIREON_DEFAULT_ORG_ID || "default-org";
  const existingResponse = await supabaseAdminFetch(env, `/auth/v1/admin/users/${encodeURIComponent(input.userId)}`);
  const existing = existingResponse.ok ? authUserFromSupabase(await existingResponse.json().catch(() => ({}))) : null;
  const currentRole = existing?.appMetadata?.vireon_role;
  const appMetadata = {
    ...(existing?.appMetadata || {}),
    vireon_role: typeof currentRole === "string" && currentRole ? currentRole : "member",
    vireon_workspace_id: existing?.appMetadata?.vireon_workspace_id || workspaceId,
    vireon_org_id: existing?.appMetadata?.vireon_org_id || orgId,
    vireon_beta_eligible: true,
    vireon_invitation_id: input.invitationId,
  };
  const userMetadata = {
    ...(existing?.userMetadata || {}),
    vireon_invitation_id: input.invitationId,
    vireon_invitation_email: input.email,
  };
  const response = await supabaseAdminFetch(env, `/auth/v1/admin/users/${encodeURIComponent(input.userId)}`, {
    method: "PUT",
    body: JSON.stringify({ app_metadata: appMetadata, user_metadata: userMetadata }),
  });
  if (!response.ok) throw new Error("SUPABASE_METADATA_UPDATE_FAILED");
}

export async function supabaseResendSignupConfirmation(email: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const { supabaseUrl, anonKey } = supabaseUrlAndKeys(env);
  if (!supabaseUrl || !anonKey) return;
  await fetch(`${supabaseUrl}/auth/v1/resend`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ type: "signup", email }),
    cache: "no-store",
  }).catch(() => undefined);
}

export function createPrivateBetaInvitationServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return createPrivateBetaInvitationService({
    db: new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv(env)),
    signUpWithSupabase: (input) => supabaseAnonSignUp(input, env),
    findSupabaseUserByEmail: (email, invitationId) => supabaseFindUserByInvitationEmail(email, invitationId, env),
    updateSupabaseUserAppMetadata: (input) => supabaseUpdateInvitationUserMetadata(input, env),
    resendSupabaseConfirmation: (email) => supabaseResendSignupConfirmation(email, env),
  });
}
