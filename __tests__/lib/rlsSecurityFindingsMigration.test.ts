import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(process.cwd(), "migrations", "0010_rls_security_findings.sql");
const sql = readFileSync(migrationPath, "utf8");

test("0010 enables RLS for every Supabase-reported table", () => {
  for (const table of ["users", "schema_migrations", "private_beta_migration_status"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /alter table public\.users force row level security/i);
});

test("0010 scopes users by transaction-local trusted user id", () => {
  assert.match(sql, /create policy users_select_own_runtime on public\.users\s+for select\s+to vireon_app\s+using \(id = nullif\(current_setting\('app\.current_user_id', true\), ''\)::uuid\)/i);
  assert.match(sql, /create policy users_insert_own_runtime on public\.users\s+for insert\s+to vireon_app\s+with check \(id = nullif\(current_setting\('app\.current_user_id', true\), ''\)::uuid\)/i);
  assert.match(sql, /create policy users_update_own_runtime on public\.users\s+for update\s+to vireon_app[\s\S]*with check \(id = nullif\(current_setting\('app\.current_user_id', true\), ''\)::uuid\)/i);
  assert.doesNotMatch(sql, /users_delete_/i);
  assert.doesNotMatch(sql, /auth\.uid\(\).*users/i);
});

test("0010 metadata policies are restricted read-only runtime policies", () => {
  for (const table of ["schema_migrations", "private_beta_migration_status"]) {
    assert.match(sql, new RegExp(`create policy ${table}_runtime_read on public\\.${table}\\s+for select\\s+to vireon_app\\s+using \\(true\\)`, "i"));
    assert.doesNotMatch(sql, new RegExp(`create policy .* on public\\.${table}\\s+for (insert|update|delete|all)`, "i"));
  }
});

test("0010 does not create public or browser-direct policies", () => {
  assert.doesNotMatch(sql, /\bto\s+anon\b/i);
  assert.doesNotMatch(sql, /\bto\s+authenticated\b/i);
  assert.doesNotMatch(sql, /for all\s+to\s+vireon_app/i);
  assert.doesNotMatch(sql, /with check\s*\(\s*true\s*\)/i);
});

test("0010 is additive and records private-beta migration status", () => {
  assert.match(sql, /0010_rls_security_findings/);
  assert.match(sql, /rls-security-findings-v1/);
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema)\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
  assert.doesNotMatch(sql, /insert into public\.users/i);
  assert.doesNotMatch(sql, /insert into public\.financial_facts/i);
});
