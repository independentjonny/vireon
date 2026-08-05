import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(process.cwd(), "migrations", "0003_supabase_private_beta_security.sql");
const sql = readFileSync(migrationPath, "utf8");

const privateBetaTables = [
  "private_beta_onboarding",
  "private_beta_feedback",
  "private_beta_deletion_requests",
  "private_beta_audit_events",
  "private_beta_feature_flags",
];

function hasPolicy(table: string, operation: "select" | "insert" | "update" | "delete"): boolean {
  return new RegExp(`create policy ${table}_${operation}_[a-z_]+ on ${table}\\s+for ${operation}`, "i").test(sql);
}

test("0003 enables and forces RLS on all private_beta tables", () => {
  for (const table of privateBetaTables) {
    assert.match(sql, new RegExp(`alter table ${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`alter table ${table} force row level security`, "i"));
  }
});

test("0003 uses app.current_user_id ownership instead of auth.uid for application tables", () => {
  assert.match(sql, /current_setting\('app\.current_user_id', true\)/);
  assert.doesNotMatch(sql, /auth\.uid\(\).*private_beta/i);
});

test("0003 creates owner-scoped policies for mutable user-owned private beta tables", () => {
  for (const table of ["private_beta_onboarding", "private_beta_feedback"]) {
    assert.equal(hasPolicy(table, "select"), true);
    assert.equal(hasPolicy(table, "insert"), true);
    assert.equal(hasPolicy(table, "update"), true);
    assert.equal(hasPolicy(table, "delete"), true);
  }

  assert.equal(hasPolicy("private_beta_deletion_requests", "select"), true);
  assert.equal(hasPolicy("private_beta_deletion_requests", "insert"), true);
  assert.equal(hasPolicy("private_beta_deletion_requests", "update"), true);
  assert.equal(hasPolicy("private_beta_deletion_requests", "delete"), false);
});

test("0003 unauthenticated application-table access cannot satisfy ownership checks", () => {
  assert.match(sql, /user_id = nullif\(current_setting\('app\.current_user_id', true\), ''\)/);
  assert.doesNotMatch(sql, /coalesce\([^)]*current_setting\('app\.current_user_id'[^)]*true/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(sql, /with check\s*\(\s*true\s*\)/i);
});

test("0003 keeps ordinary users from mutating administrative feature flags", () => {
  assert.equal(hasPolicy("private_beta_feature_flags", "select"), true);
  assert.equal(hasPolicy("private_beta_feature_flags", "insert"), false);
  assert.equal(hasPolicy("private_beta_feature_flags", "update"), false);
  assert.equal(hasPolicy("private_beta_feature_flags", "delete"), false);
});

test("0003 protects audit events as append-only records", () => {
  assert.equal(hasPolicy("private_beta_audit_events", "select"), true);
  assert.equal(hasPolicy("private_beta_audit_events", "insert"), true);
  assert.equal(hasPolicy("private_beta_audit_events", "update"), false);
  assert.equal(hasPolicy("private_beta_audit_events", "delete"), false);
  assert.match(sql, /create trigger private_beta_audit_events_immutable/i);
  assert.match(sql, /execute function reject_immutable_change\(\)/i);
});

test("0003 records migration status without real-user seed data", () => {
  assert.match(sql, /0003_supabase_private_beta_security/);
  assert.match(sql, /supabase-private-beta-security-v1/);
  assert.doesNotMatch(sql, /insert into users/i);
  assert.doesNotMatch(sql, /insert into financial_facts/i);
  assert.doesNotMatch(sql, /drop\s+/i);
});

test("0003 hardens financial document storage as server-only and private", () => {
  assert.match(sql, /storage\.buckets/);
  assert.match(sql, /financial-documents/);
  assert.match(sql, /public\s*=\s*false/i);
  assert.match(sql, /server-only/i);
  assert.match(sql, /users\/\{userId\}\/financial-documents\/\{unpredictableObjectId\}\/\{safeFileName\}/);
  assert.doesNotMatch(sql, /create policy .* on storage\.objects/i);
});

test("0003 storage boundary rejects anonymous and cross-user client access by policy absence", () => {
  assert.doesNotMatch(sql, /anon/i);
  assert.doesNotMatch(sql, /bucket_id\s*=\s*'financial-documents'[\s\S]*(using|with check)\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(sql, /storage\.objects[\s\S]*auth\.uid\(\)/i);
});
