import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryOpenBankingStore,
  OpenBankingService,
  validateOpenBankingProductionConfig,
  type OpenBankingAdapter,
} from "../../src/lib/openBanking.ts";

function adapter(): OpenBankingAdapter & { revoked: string[]; cursors: Array<string | null> } {
  return {
    provider: "basiq",
    revoked: [],
    cursors: [],
    async createAuthorizationUrl({ state, codeChallenge }) { return `https://provider.example/authorize?state=${state}&challenge=${codeChallenge}`; },
    async exchangeAuthorizationCode() { return { tokenVaultRef: "vault://open-banking/token-1", institutionId: "bank-1", institutionName: "Example Bank", expiresAt: "2027-01-01T00:00:00.000Z" }; },
    async fetchAccounts() { return [{ externalId: "account-1", name: "Everyday", accountType: "transaction", currency: "aud", currentBalance: 1200, availableBalance: 1100, maskedAccountNumber: "123456789" }]; },
    async fetchTransactions({ cursor }) { this.cursors.push(cursor); return { nextCursor: "cursor-2", transactions: [{ externalId: "tx-1", accountExternalId: "account-1", description: " Groceries ", amount: 42.5, direction: "debit", currency: "aud", bookedAt: "2026-07-24T00:00:00.000Z" }] }; },
    async revoke({ tokenVaultRef }) { this.revoked.push(tokenVaultRef); },
    async healthCheck() { return { ok: true, detail: "healthy" }; },
  };
}

test("production readiness fails closed until every Open Banking control is configured", () => {
  const blocked = validateOpenBankingProductionConfig({ provider: "basiq", clientIdConfigured: true, clientSecretConfigured: false, redirectUri: "http://localhost/callback", tokenVaultConfigured: false, webhookSecretConfigured: false, dataMode: "demo" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.checks.filter((item) => item.status === "fail").length, 5);
  const ready = validateOpenBankingProductionConfig({ provider: "basiq", clientIdConfigured: true, clientSecretConfigured: true, redirectUri: "https://app.vireon.example/api/open-banking/callback", tokenVaultConfigured: true, webhookSecretConfigured: true, dataMode: "live" });
  assert.equal(ready.ok, true);
});

test("consent uses hashed state and persists only an opaque token-vault reference", async () => {
  const store = new InMemoryOpenBankingStore();
  const service = new OpenBankingService(adapter(), store, () => new Date("2026-07-24T00:00:00.000Z"));
  const started = await service.beginConsent("user-a");
  assert.notEqual(started.consent.authorizationStateHash, started.state);
  const connection = await service.completeConsent({ userId: "user-a", consentId: started.consent.id, state: started.state, code: "one-use-code", codeVerifier: started.codeVerifier });
  const consent = store.consents.get(connection.consentId);
  assert.equal(consent?.status, "active");
  assert.equal(consent?.tokenVaultRef, "vault://open-banking/token-1");
  assert.equal(JSON.stringify(consent).includes("one-use-code"), false);
});

test("invalid authorization state and raw adapter tokens are rejected", async () => {
  const normal = adapter();
  const service = new OpenBankingService(normal);
  const started = await service.beginConsent("user-a");
  await assert.rejects(() => service.completeConsent({ userId: "user-a", consentId: started.consent.id, state: "forged", code: "code", codeVerifier: started.codeVerifier }), /state is invalid/);
  normal.exchangeAuthorizationCode = async () => ({ tokenVaultRef: "access_token=secret", institutionId: "bank-1", institutionName: "Bank", expiresAt: "2027-01-01T00:00:00.000Z" });
  await assert.rejects(() => service.completeConsent({ userId: "user-a", consentId: started.consent.id, state: started.state, code: "code", codeVerifier: started.codeVerifier }), /token-vault reference/);
});

test("sync normalizes, masks and idempotently upserts provider data", async () => {
  const mock = adapter();
  const store = new InMemoryOpenBankingStore();
  const service = new OpenBankingService(mock, store, () => new Date("2026-07-24T00:00:00.000Z"));
  const started = await service.beginConsent("user-a");
  const connection = await service.completeConsent({ userId: "user-a", consentId: started.consent.id, state: started.state, code: "code", codeVerifier: started.codeVerifier });
  const first = await service.sync("user-a", connection.id, "sync-1");
  const repeated = await service.sync("user-a", connection.id, "sync-1");
  assert.deepEqual(repeated, first);
  assert.equal(mock.cursors.length, 1);
  assert.equal(store.listAccounts("user-a")[0].maskedAccountNumber, "****6789");
  assert.equal(store.listTransactions("user-a")[0].amount, -42.5);
  assert.equal(store.listTransactions("user-a")[0].evidenceRef, "open-banking:basiq:tx-1");
});

test("records are user isolated and revocation removes the credential reference", async () => {
  const mock = adapter();
  const store = new InMemoryOpenBankingStore();
  const service = new OpenBankingService(mock, store);
  const started = await service.beginConsent("user-a");
  const connection = await service.completeConsent({ userId: "user-a", consentId: started.consent.id, state: started.state, code: "code", codeVerifier: started.codeVerifier });
  await service.sync("user-a", connection.id, "sync-1");
  assert.equal(store.listTransactions("user-b").length, 0);
  await assert.rejects(() => service.sync("user-b", connection.id, "sync-2"), /not available/);
  await service.revoke("user-a", connection.id);
  assert.equal(store.consents.get(connection.consentId)?.tokenVaultRef, null);
  assert.equal(store.connections.get(connection.id)?.health, "disconnected");
  assert.deepEqual(mock.revoked, ["vault://open-banking/token-1"]);
});

test("failed sync is visible and never reported as an empty success", async () => {
  const mock = adapter();
  mock.fetchTransactions = async () => { throw new Error("provider unavailable"); };
  const store = new InMemoryOpenBankingStore();
  const service = new OpenBankingService(mock, store);
  const started = await service.beginConsent("user-a");
  const connection = await service.completeConsent({ userId: "user-a", consentId: started.consent.id, state: started.state, code: "code", codeVerifier: started.codeVerifier });
  await assert.rejects(() => service.sync("user-a", connection.id, "sync-1"), /provider unavailable/);
  assert.equal(store.connections.get(connection.id)?.health, "attention-required");
  assert.equal(store.connections.get(connection.id)?.lastErrorCode, "PROVIDER_SYNC_FAILED");
});
