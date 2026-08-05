import { createHash, randomBytes, randomUUID } from "crypto";

export const OPEN_BANKING_SCHEMA_VERSION = "open-banking-v1";

export type OpenBankingProvider = "basiq" | "frollo" | "custom-cdr";
export type ConsentStatus = "pending" | "active" | "expired" | "revoked" | "failed";
export type ConnectionHealth = "pending" | "healthy" | "attention-required" | "disconnected";

export type OpenBankingConsent = {
  id: string;
  userId: string;
  provider: OpenBankingProvider;
  status: ConsentStatus;
  scopes: readonly string[];
  institutionId: string | null;
  authorizationStateHash: string;
  tokenVaultRef: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type OpenBankingConnection = {
  id: string;
  userId: string;
  consentId: string;
  provider: OpenBankingProvider;
  institutionId: string;
  institutionName: string;
  health: ConnectionHealth;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  lastErrorCode: string | null;
  cursor: string | null;
};

export type OpenBankingAccount = {
  id: string;
  userId: string;
  connectionId: string;
  externalId: string;
  name: string;
  accountType: string;
  currency: string;
  currentBalance: number | null;
  availableBalance: number | null;
  maskedAccountNumber: string | null;
  updatedAt: string;
};

export type OpenBankingTransaction = {
  id: string;
  userId: string;
  connectionId: string;
  accountId: string;
  externalId: string;
  description: string;
  amount: number;
  currency: string;
  bookedAt: string;
  pending: boolean;
  category: string | null;
  evidenceRef: string;
  source: "open-banking";
  updatedAt: string;
};

export type ProviderAccount = Omit<OpenBankingAccount, "id" | "userId" | "connectionId" | "updatedAt">;
export type ProviderTransaction = {
  externalId: string;
  accountExternalId: string;
  description: string;
  amount: number;
  direction: "credit" | "debit";
  currency: string;
  bookedAt: string;
  pending?: boolean;
  category?: string | null;
};

export interface OpenBankingAdapter {
  readonly provider: OpenBankingProvider;
  createAuthorizationUrl(input: { state: string; codeChallenge: string; scopes: readonly string[] }): Promise<string>;
  exchangeAuthorizationCode(input: { code: string; codeVerifier: string }): Promise<{
    tokenVaultRef: string;
    institutionId: string;
    institutionName: string;
    expiresAt: string;
  }>;
  fetchAccounts(input: { tokenVaultRef: string }): Promise<ProviderAccount[]>;
  fetchTransactions(input: { tokenVaultRef: string; cursor: string | null }): Promise<{
    transactions: ProviderTransaction[];
    nextCursor: string | null;
  }>;
  revoke(input: { tokenVaultRef: string }): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}

export type OpenBankingReadiness = {
  ok: boolean;
  checks: Array<{ name: string; status: "pass" | "fail"; detail: string }>;
};

export function validateOpenBankingProductionConfig(input: {
  provider?: string;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  redirectUri?: string;
  tokenVaultConfigured: boolean;
  webhookSecretConfigured: boolean;
  dataMode: "live" | "demo" | "test";
}): OpenBankingReadiness {
  const checks: OpenBankingReadiness["checks"] = [];
  const check = (name: string, condition: boolean, detail: string) =>
    checks.push({ name, status: condition ? "pass" : "fail", detail });
  check("Provider", ["basiq", "frollo", "custom-cdr"].includes(input.provider ?? ""), "An explicit supported provider is required.");
  check("OAuth client", input.clientIdConfigured && input.clientSecretConfigured, "Provider client credentials must be held server-side.");
  check("Redirect URI", Boolean(input.redirectUri?.startsWith("https://")), "Production authorization callbacks require HTTPS.");
  check("Token vault", input.tokenVaultConfigured, "Refresh and access tokens must use an external encrypted vault.");
  check("Webhook verification", input.webhookSecretConfigured, "Provider webhooks require signature verification.");
  check("Live data boundary", input.dataMode === "live", "Production connections must be explicitly marked live.");
  return { ok: checks.every((item) => item.status === "pass"), checks };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function maskAccountNumber(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length < 4 ? "****" : `****${digits.slice(-4)}`;
}

function requireUser(userId: string): void {
  if (!userId.trim()) throw new Error("Authenticated user is required.");
}

export class InMemoryOpenBankingStore {
  readonly consents = new Map<string, OpenBankingConsent>();
  readonly connections = new Map<string, OpenBankingConnection>();
  readonly accounts = new Map<string, OpenBankingAccount>();
  readonly transactions = new Map<string, OpenBankingTransaction>();
  readonly idempotency = new Map<string, unknown>();

  listConnections(userId: string): OpenBankingConnection[] {
    requireUser(userId);
    return [...this.connections.values()].filter((item) => item.userId === userId);
  }

  listAccounts(userId: string): OpenBankingAccount[] {
    requireUser(userId);
    return [...this.accounts.values()].filter((item) => item.userId === userId);
  }

  listTransactions(userId: string): OpenBankingTransaction[] {
    requireUser(userId);
    return [...this.transactions.values()].filter((item) => item.userId === userId);
  }
}

export class OpenBankingService {
  private readonly adapter: OpenBankingAdapter;
  private readonly store: InMemoryOpenBankingStore;
  private readonly clock: () => Date;

  constructor(
    adapter: OpenBankingAdapter,
    store = new InMemoryOpenBankingStore(),
    clock: () => Date = () => new Date(),
  ) {
    this.adapter = adapter;
    this.store = store;
    this.clock = clock;
  }

  async beginConsent(userId: string, scopes: readonly string[] = ["accounts", "transactions"]): Promise<{
    consent: OpenBankingConsent;
    authorizationUrl: string;
    state: string;
    codeVerifier: string;
  }> {
    requireUser(userId);
    if (scopes.length === 0) throw new Error("At least one consent scope is required.");
    const state = randomBytes(24).toString("base64url");
    const codeVerifier = randomBytes(48).toString("base64url");
    const now = this.clock().toISOString();
    const consent: OpenBankingConsent = {
      id: `consent-${randomUUID()}`,
      userId,
      provider: this.adapter.provider,
      status: "pending",
      scopes: [...new Set(scopes)],
      institutionId: null,
      authorizationStateHash: hash(state),
      tokenVaultRef: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
    };
    const authorizationUrl = await this.adapter.createAuthorizationUrl({
      state,
      codeChallenge: hash(codeVerifier),
      scopes: consent.scopes,
    });
    this.store.consents.set(consent.id, consent);
    return { consent, authorizationUrl, state, codeVerifier };
  }

  async completeConsent(input: { userId: string; consentId: string; state: string; code: string; codeVerifier: string }): Promise<OpenBankingConnection> {
    const consent = this.ownedConsent(input.userId, input.consentId);
    if (consent.status !== "pending" || hash(input.state) !== consent.authorizationStateHash) {
      throw new Error("Authorization state is invalid or has already been used.");
    }
    const result = await this.adapter.exchangeAuthorizationCode({ code: input.code, codeVerifier: input.codeVerifier });
    if (!result.tokenVaultRef || /^(access|refresh)[-_]?token[:=]/i.test(result.tokenVaultRef)) {
      throw new Error("Adapter must return an opaque token-vault reference, never raw credentials.");
    }
    const now = this.clock().toISOString();
    const active: OpenBankingConsent = {
      ...consent,
      status: "active",
      institutionId: result.institutionId,
      tokenVaultRef: result.tokenVaultRef,
      expiresAt: result.expiresAt,
      updatedAt: now,
    };
    const connection: OpenBankingConnection = {
      id: `connection-${randomUUID()}`,
      userId: input.userId,
      consentId: consent.id,
      provider: this.adapter.provider,
      institutionId: result.institutionId,
      institutionName: result.institutionName,
      health: "pending",
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      lastErrorCode: null,
      cursor: null,
    };
    this.store.consents.set(active.id, active);
    this.store.connections.set(connection.id, connection);
    return connection;
  }

  async sync(userId: string, connectionId: string, idempotencyKey: string): Promise<{ accountsUpserted: number; transactionsUpserted: number; cursor: string | null }> {
    requireUser(userId);
    if (!idempotencyKey.trim()) throw new Error("Sync requires an idempotency key.");
    const scopedKey = `${userId}:${connectionId}:${idempotencyKey}`;
    const previous = this.store.idempotency.get(scopedKey);
    if (previous) return previous as { accountsUpserted: number; transactionsUpserted: number; cursor: string | null };
    const connection = this.ownedConnection(userId, connectionId);
    const consent = this.ownedConsent(userId, connection.consentId);
    if (consent.status !== "active" || !consent.tokenVaultRef) throw new Error("An active consent is required before sync.");
    const attemptedAt = this.clock().toISOString();
    try {
      const [providerAccounts, page] = await Promise.all([
        this.adapter.fetchAccounts({ tokenVaultRef: consent.tokenVaultRef }),
        this.adapter.fetchTransactions({ tokenVaultRef: consent.tokenVaultRef, cursor: connection.cursor }),
      ]);
      const accountIdByExternal = new Map<string, string>();
      for (const account of providerAccounts) {
        const id = `${connection.id}:account:${account.externalId}`;
        accountIdByExternal.set(account.externalId, id);
        this.store.accounts.set(id, {
          ...account,
          id,
          userId,
          connectionId,
          currency: account.currency.toUpperCase(),
          maskedAccountNumber: maskAccountNumber(account.maskedAccountNumber),
          updatedAt: attemptedAt,
        });
      }
      for (const transaction of page.transactions) {
        const accountId = accountIdByExternal.get(transaction.accountExternalId);
        if (!accountId) throw new Error("Provider transaction referenced an unknown account.");
        const id = `${connection.id}:transaction:${transaction.externalId}`;
        this.store.transactions.set(id, {
          id,
          userId,
          connectionId,
          accountId,
          externalId: transaction.externalId,
          description: transaction.description.trim() || "Unlabelled transaction",
          amount: Math.abs(transaction.amount) * (transaction.direction === "debit" ? -1 : 1),
          currency: transaction.currency.toUpperCase(),
          bookedAt: transaction.bookedAt,
          pending: Boolean(transaction.pending),
          category: transaction.category ?? null,
          evidenceRef: `open-banking:${connection.provider}:${transaction.externalId}`,
          source: "open-banking",
          updatedAt: attemptedAt,
        });
      }
      const nextConnection = { ...connection, health: "healthy" as const, lastAttemptedSyncAt: attemptedAt, lastSuccessfulSyncAt: attemptedAt, lastErrorCode: null, cursor: page.nextCursor };
      this.store.connections.set(connection.id, nextConnection);
      const result = { accountsUpserted: providerAccounts.length, transactionsUpserted: page.transactions.length, cursor: page.nextCursor };
      this.store.idempotency.set(scopedKey, result);
      return result;
    } catch (error) {
      this.store.connections.set(connection.id, { ...connection, health: "attention-required", lastAttemptedSyncAt: attemptedAt, lastErrorCode: "PROVIDER_SYNC_FAILED" });
      throw error;
    }
  }

  async revoke(userId: string, connectionId: string): Promise<void> {
    const connection = this.ownedConnection(userId, connectionId);
    const consent = this.ownedConsent(userId, connection.consentId);
    if (consent.tokenVaultRef) await this.adapter.revoke({ tokenVaultRef: consent.tokenVaultRef });
    const now = this.clock().toISOString();
    this.store.consents.set(consent.id, { ...consent, status: "revoked", tokenVaultRef: null, revokedAt: now, updatedAt: now });
    this.store.connections.set(connection.id, { ...connection, health: "disconnected", cursor: null });
  }

  private ownedConsent(userId: string, id: string): OpenBankingConsent {
    requireUser(userId);
    const value = this.store.consents.get(id);
    if (!value || value.userId !== userId) throw new Error("Consent is not available.");
    return value;
  }

  private ownedConnection(userId: string, id: string): OpenBankingConnection {
    requireUser(userId);
    const value = this.store.connections.get(id);
    if (!value || value.userId !== userId) throw new Error("Connection is not available.");
    return value;
  }
}
