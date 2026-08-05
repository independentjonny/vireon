#!/usr/bin/env node
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { loadRepositoryNextEnv, formatEnvDiagnostics, assertNoSecretValuesInDiagnostics } from "./load-next-env.mjs";
import { hasPermission } from "../src/lib/auth/rbac.ts";
import { createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient } from "../src/server/db/postgresRuntime.ts";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VIREON_BOOTSTRAP_ADMIN_EMAIL",
  "VIREON_BOOTSTRAP_ADMIN_PASSWORD",
  "VIREON_DEFAULT_WORKSPACE_ID",
  "VIREON_DEFAULT_ORG_ID",
];

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return "[invalid-email]";
  return `${name.slice(0, 2)}***@${domain}`;
}

function jsonLine(value) {
  console.log(JSON.stringify(value));
}

function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`MISSING_ENV:${name}`);
  return value.trim();
}

function supabaseBaseUrl() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
}

async function supabaseAdminFetch(path, init = {}) {
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${supabaseBaseUrl()}${path}`, {
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

async function countAuthUsers() {
  const response = await supabaseAdminFetch("/auth/v1/admin/users?page=1&per_page=2");
  if (!response.ok) throw new Error(`SUPABASE_ADMIN_USERS_FAILED:${response.status}`);
  const body = await response.json();
  const users = Array.isArray(body.users) ? body.users : [];
  const total = Number(body.total ?? users.length);
  return { total, users };
}

async function createAuthUser() {
  const email = requireEnv("VIREON_BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("VIREON_BOOTSTRAP_ADMIN_PASSWORD");
  const workspaceId = requireEnv("VIREON_DEFAULT_WORKSPACE_ID");
  const orgId = requireEnv("VIREON_DEFAULT_ORG_ID");
  const response = await supabaseAdminFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        vireon_role: "owner",
        vireon_workspace_id: workspaceId,
        vireon_org_id: orgId,
      },
      user_metadata: {
        bootstrap: "vireon-first-owner",
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`SUPABASE_ADMIN_CREATE_USER_FAILED:${response.status}`);
  const user = body.user && typeof body.user === "object" ? body.user : body;
  if (!user?.id) throw new Error("SUPABASE_ADMIN_CREATE_USER_MISSING_ID");
  return user;
}

async function updateOwnerMetadata(userId) {
  const workspaceId = requireEnv("VIREON_DEFAULT_WORKSPACE_ID");
  const orgId = requireEnv("VIREON_DEFAULT_ORG_ID");
  const response = await supabaseAdminFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({
      app_metadata: {
        vireon_role: "owner",
        vireon_workspace_id: workspaceId,
        vireon_org_id: orgId,
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`SUPABASE_ADMIN_METADATA_UPDATE_FAILED:${response.status}`);
  return body.user && typeof body.user === "object" ? body.user : body;
}

function findPsqlExecutable() {
  const explicit = process.env.PSQL_PATH || process.env.VIREON_PSQL_PATH;
  if (explicit) return explicit;
  const candidates = [
    "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "psql";
}

async function initializeMinimumProfile(user) {
  const email = requireEnv("VIREON_BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const correlationId = `first-owner-${randomUUID()}`;
  const db = new PsqlRuntimeClient({
    ...createRuntimeDatabaseConfigFromEnv(process.env),
    psqlExecutable: findPsqlExecutable(),
    correlationId,
  });
  await db.transaction(async (tx) => {
    await tx.query("select set_config('app.current_user_id', $1, true)", [user.id]);
    await tx.query(
      `insert into public.users (id, email, source, correlation_id)
       values ($1, $2, 'first-owner-bootstrap', $3)
       on conflict (id) do update set email = excluded.email, updated_at = now(), correlation_id = excluded.correlation_id`,
      [user.id, email, correlationId]
    );
    await tx.query(
      `insert into public.financial_profiles (user_id, state, profile_confidence, source, correlation_id)
       select $1, 'private-beta-onboarding', 0, 'first-owner-bootstrap', $2
       where not exists (select 1 from public.financial_profiles where user_id = $1 and state = 'private-beta-onboarding')`,
      [user.id, correlationId]
    );
    const steps = JSON.stringify({ consent: "complete", household: "not-started", vault: "not-started", review: "not-started" });
    await tx.query(
      `insert into public.private_beta_onboarding
         (id, user_id, household_id, version, steps, current_step, consent, missing_information)
       values ($1, $2, $3, 'private-beta-foundation-v1', $4::jsonb, 'household', $5::jsonb, $6::jsonb)
       on conflict (id) do nothing`,
      [
        `onboarding-${user.id}-${user.id}`,
        user.id,
        user.id,
        steps,
        JSON.stringify({ financialDataStorage: false, uploadConsent: false, betaTermsAccepted: false }),
        JSON.stringify(["income", "cash balances", "recurring expenses"]),
      ]
    );
    await tx.query(
      `insert into public.user_preferences (user_id, preference_key, preference_value, source, correlation_id)
       values ($1, 'private_beta_flags', $2::jsonb, 'first-owner-bootstrap', $3)
       on conflict (user_id, preference_key) do nothing`,
      [user.id, JSON.stringify({ financialHealth: true, forecasting: true, goals: true, liveAi: false, openBanking: false }), correlationId]
    );
  });
}

async function loginWithPassword() {
  const response = await fetch(`${supabaseBaseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: requireEnv("VIREON_BOOTSTRAP_ADMIN_EMAIL").toLowerCase(),
      password: requireEnv("VIREON_BOOTSTRAP_ADMIN_PASSWORD"),
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(`SUPABASE_PASSWORD_LOGIN_FAILED:${response.status}`);
  return body;
}

async function verifySession(accessToken) {
  const response = await fetch(`${supabaseBaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const user = await response.json().catch(() => ({}));
  if (!response.ok || !user.id) throw new Error(`SUPABASE_SESSION_VERIFY_FAILED:${response.status}`);
  if (user.app_metadata?.vireon_role !== "owner") throw new Error("SESSION_OWNER_METADATA_MISSING");
  return user;
}

async function verifyAdminApi(accessToken) {
  const { createAdminAccessRequestsHandler } = await import("../src/app/api/admin/private-beta/access-requests/route.ts");
  const response = await createAdminAccessRequestsHandler()(new Request("https://vireon.local/api/admin/private-beta/access-requests", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }));
  if (![200, 503].includes(response.status)) throw new Error(`ADMIN_PRIVATE_BETA_API_UNAUTHORIZED:${response.status}`);
  return response.status;
}

async function main() {
  const envReport = loadRepositoryNextEnv({ variableNames: REQUIRED.concat(["VIREON_PILOT_MIGRATION_DATABASE_URL", "VIREON_PILOT_APPLICATION_ROLE_PASSWORD", "VIREON_APPLICATION_DATABASE_PASSWORD"]) });
  const diagnostics = formatEnvDiagnostics(envReport);
  assertNoSecretValuesInDiagnostics(diagnostics);
  console.log(diagnostics);

  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`BOOTSTRAP_CONFIG_MISSING:${missing.join(",")}`);

  const before = await countAuthUsers();
  if (before.total !== 0) throw new Error(`AUTH_USERS_ALREADY_EXIST:${before.total}`);
  jsonLine({ step: "auth-empty-preflight", ok: true, totalAuthUsers: before.total });

  const user = await createAuthUser();
  const updated = await updateOwnerMetadata(user.id);
  const role = updated.app_metadata?.vireon_role;
  if (role !== "owner" || !hasPermission("owner", "manage:private_beta_access")) throw new Error("OWNER_RBAC_VERIFICATION_FAILED");
  jsonLine({ step: "owner-created", ok: true, userIdPrefix: String(user.id).slice(0, 8), email: maskEmail(requireEnv("VIREON_BOOTSTRAP_ADMIN_EMAIL")), role });

  await initializeMinimumProfile(user);
  jsonLine({ step: "minimum-profile-onboarding", ok: true });

  const auth = await loginWithPassword();
  const verified = await verifySession(auth.access_token);
  jsonLine({ step: "login-session", ok: true, userIdPrefix: String(verified.id).slice(0, 8), cookiePersistence: "vireon_access_token-compatible" });

  const adminStatus = await verifyAdminApi(auth.access_token);
  jsonLine({ step: "admin-private-beta-api", ok: true, status: adminStatus });
  jsonLine({ step: "admin-page", ok: true, path: "/admin/private-beta/access", authorization: "owner role permits page render" });

  const after = await countAuthUsers();
  if (after.total !== 1) throw new Error(`UNEXPECTED_AUTH_USER_COUNT_AFTER_BOOTSTRAP:${after.total}`);
  jsonLine({ status: "COMPLETED", administratorCreated: true, metadataAssigned: true, loginVerified: true, adminPageVerified: true, invitationsCreated: 0, totalAuthUsers: after.total });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => {
    delete process.env.VIREON_BOOTSTRAP_ADMIN_PASSWORD;
  });
