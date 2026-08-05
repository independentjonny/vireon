import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("migrations/0004_core_decisioning_persistence.sql", "utf8");
const dailyReviewAppendOnlySql = readFileSync("migrations/0005_daily_review_append_only_history.sql", "utf8");

test("0004 core decisioning migration is additive and public-schema only", () => {
  assert.match(sql, /alter table public\.digital_twin_scenarios/i);
  assert.match(sql, /alter table public\.decisions/i);
  assert.match(sql, /alter table public\.workflows/i);
  assert.match(sql, /alter table public\.ai_cfo_questions/i);
  assert.match(sql, /alter table public\.daily_reviews/i);
  assert.match(sql, /alter table public\.goals/i);
  assert.doesNotMatch(sql, /\bdrop\s+(table|schema|policy|function|trigger|index)\b/i);
  assert.doesNotMatch(sql, /\b(storage|auth|realtime|extensions)\./i);
});

test("0004 adds user-scoped application IDs and indexes for converted domains", () => {
  for (const table of ["digital_twin_scenarios", "decisions", "workflows", "ai_cfo_questions", "daily_reviews", "goals"]) {
    assert.match(sql, new RegExp(`public\\.${table}[^;]+app_id`, "i"));
  }
  assert.match(sql, /create unique index if not exists idx_digital_twin_scenarios_user_app_id/i);
  assert.match(sql, /create unique index if not exists idx_decisions_user_app_id/i);
  assert.match(sql, /create unique index if not exists idx_workflows_user_app_id/i);
  assert.match(sql, /create unique index if not exists idx_goals_user_app_id/i);
  assert.match(sql, /public\.daily_reviews add column if not exists calculation_snapshot_id uuid references public\.calculation_snapshots\(id\)/i);
});

test("0004 records private beta migration tracking without seed data", () => {
  assert.match(sql, /insert into public\.private_beta_migration_status/i);
  assert.match(sql, /0004_core_decisioning_persistence/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.(goals|decisions|workflows|ai_cfo_questions|daily_reviews)\b/i);
});

test("0005 allows append-only Daily Review history for multiple same-day reviews", () => {
  assert.match(dailyReviewAppendOnlySql, /alter table public\.daily_reviews\s+drop constraint if exists daily_reviews_user_id_review_date_key/i);
  assert.match(dailyReviewAppendOnlySql, /idx_daily_reviews_user_date_created/i);
  assert.match(dailyReviewAppendOnlySql, /0005_daily_review_append_only_history/i);
  assert.doesNotMatch(dailyReviewAppendOnlySql, /delete\s+from\s+public\.daily_reviews|truncate\s+table\s+public\.daily_reviews/i);
});
