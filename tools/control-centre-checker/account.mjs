import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PsqlRuntimeClient, createRuntimeDatabaseConfigFromEnv } from "../../src/server/db/postgresRuntime.ts";
import { createFinancialVaultServiceFromEnv } from "../../src/server/services/financialVaultPostgresService.ts";
const userId = "3c57a67e-01cf-4fdf-9c34-7236f9be1598", email = "boardn@hotmail.com";
await new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv()).transaction(async tx => {
  await tx.query("select set_config('app.current_user_id',$1,true)", [userId]);
  const result = await tx.query("select email from users where id=$1", [userId]);
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].email.toLowerCase(), email);
});
const saved = await createFinancialVaultServiceFromEnv().getRetirementGoals({ userId, expiresAt: null, actor: "admin", requestId: "control-centre-read-only-check" });
assert.equal(saved?.retirementDate, "2040-11-03"); assert.equal(saved?.monthlyIncome, 2000); assert.equal(saved?.monthlyExpenses, 1500);
await fs.writeFile(".verification/control-centre/account.json", JSON.stringify({ passed: true, email, saved, readOnly: true, authenticatedBrowser: false }, null, 2));
