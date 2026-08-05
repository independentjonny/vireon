import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createFinancialVaultPostgresService, FinancialVaultPersistenceError } from "../../src/server/services/financialVaultPostgresService.ts";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";

type Session = {
  userId: string;
  expiresAt: string;
};

class FakeVaultClient implements PostgresPilotClient {
  currentUser = "";
  users = new Set<string>();
  profiles = new Set<string>();
  imports = new Map<string, { userId: string; sourceChecksum: string; preview: Record<string, unknown>; status: string }>();
  idempotency = new Map<string, string>();
  facts: Array<{ id: string; userId: string; source: string; value: unknown; version: number }> = [];
  factVersions: Array<{ userId: string; factId: string; value: unknown; reason: string }> = [];
  evidence: Array<{ id: string; userId: string; sourceRef: string }> = [];
  documents: Array<{ id: string; userId: string; title: string; documentType: string; contentHash: string; status: string; extraction: Record<string, unknown> }> = [];
  queries: string[] = [];
  transactionDepth = 0;

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    this.queries.push(sql);
    if (/set_config\('app\.current_user_id'/i.test(sql)) {
      if (this.transactionDepth === 0) throw new Error("root set_config is forbidden in tests");
      this.currentUser = String(params[0]);
      return { rows: [] };
    }
    if (/insert into users/i.test(sql)) {
      this.users.add(String(params[0]));
      return { rows: [] };
    }
    if (/insert into financial_profiles/i.test(sql)) {
      this.profiles.add(String(params[0]));
      return { rows: [] };
    }
    if (/select response_hash/i.test(sql)) {
      const key = `${params[0]}:${params[1]}:${params[2]}`;
      const responseHash = this.idempotency.get(key);
      return { rows: responseHash ? ([{ responseHash }] as T[]) : [] };
    }
    if (/insert into idempotency_keys/i.test(sql)) {
      this.idempotency.set(`${params[0]}:${params[2]}:${params[1]}`, String(params[3]));
      return { rows: [] };
    }
    if (/select id from documents/i.test(sql)) {
      const doc = this.documents.find((item) => item.userId === params[0] && item.contentHash === params[1] && item.documentType === params[2]);
      return { rows: doc ? ([{ id: doc.id }] as T[]) : [] };
    }
    if (/with inserted_document/i.test(sql)) {
      this.documents.push({
        id: String(params[0]),
        userId: String(params[1]),
        title: String(params[2]),
        documentType: String(params[3]),
        contentHash: String(params[5]),
        status: String(params[6]),
        extraction: JSON.parse(String(params[10])),
      });
      return { rows: [{ id: "evidence-document" }] as T[] };
    }
    if (/from documents d/i.test(sql)) {
      return {
        rows: this.documents
          .filter((doc) => doc.userId === params[0])
          .map((doc) => ({ id: doc.id, title: doc.title, documentType: doc.documentType, status: doc.status, uploadedAt: new Date().toISOString(), extraction: doc.extraction })) as T[],
      };
    }
    if (/select preview from migration_runs where user_id = \$1 and source_checksum/i.test(sql)) {
      const row = [...this.imports.values()].find((item) => item.userId === params[0] && item.sourceChecksum === params[1]);
      return { rows: row ? ([{ preview: row.preview }] as T[]) : [] };
    }
    if (/insert into migration_runs/i.test(sql)) {
      this.imports.set(String(params[0]), { userId: String(params[1]), sourceChecksum: String(params[5]), preview: JSON.parse(String(params[4])), status: String(params[3]) });
      return { rows: [] };
    }
    if (/select preview from migration_runs where user_id = \$1 and id = \$2/i.test(sql)) {
      const row = this.imports.get(String(params[1]));
      return { rows: row && row.userId === params[0] ? ([{ preview: row.preview }] as T[]) : [] };
    }
    if (/select preview from migration_runs where user_id = \$1 and target_version/i.test(sql)) {
      return { rows: [...this.imports.values()].filter((row) => row.userId === params[0]).map((row) => ({ preview: row.preview })) as T[] };
    }
    if (/update migration_runs/i.test(sql)) {
      const row = this.imports.get(String(params[6]));
      if (row && row.userId === params[5]) {
        row.status = String(params[0]);
        row.preview = JSON.parse(String(params[1]));
      }
      return { rows: [] };
    }
    if (/select fact_value as record/i.test(sql)) {
      return { rows: this.facts.filter((fact) => fact.userId === params[0]).map((fact) => ({ record: fact.value })) as T[] };
    }
    if (/insert into financial_facts/i.test(sql)) {
      const id = `fact-${this.facts.length + 1}`;
      const source = sql.includes("'financial-vault-import'") ? "financial-vault-import" : sql.includes("'financial-vault-manual'") ? "financial-vault-manual" : "financial-vault-document";
      const valueParam = source === "financial-vault-document" ? params[2] : params[2];
      this.facts.push({ id, userId: String(params[0]), source, value: JSON.parse(String(valueParam)), version: 1 });
      return { rows: [{ id, version: 1 }] as T[] };
    }
    if (/insert into evidence/i.test(sql)) {
      const id = `evidence-${this.evidence.length + 1}`;
      this.evidence.push({ id, userId: String(params[0]), sourceRef: String(params[1]) });
      return { rows: [{ id }] as T[] };
    }
    if (/insert into fact_versions/i.test(sql)) {
      this.factVersions.push({ userId: String(params[0]), factId: String(params[1]), value: JSON.parse(String(params[3])), reason: String(params[7]) });
      return { rows: [] };
    }
    return { rows: [] };
  }

  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    this.transactionDepth += 1;
    try {
      return await operation(this);
    } finally {
      this.transactionDepth -= 1;
      this.currentUser = "";
    }
  }
}

const userA: Session = { userId: "11111111-1111-4111-8111-111111111111", expiresAt: new Date(Date.now() + 60_000).toISOString() };
const userB: Session = { userId: "22222222-2222-4222-8222-222222222222", expiresAt: new Date(Date.now() + 60_000).toISOString() };

describe("Financial Vault PostgreSQL service", () => {
  it("stores imports in PostgreSQL migration_runs and isolates users", async () => {
    const client = new FakeVaultClient();
    const service = createFinancialVaultPostgresService(client);
    const created = await service.createImport(userA, { sourceType: "CSV", fileName: "bank.csv", mimeType: "text/csv", text: "Date,Description,Debit,Credit\n2026-01-01,Salary,,100" }, "corr-a");

    const a = await service.getImports(userA, "corr-a2");
    const b = await service.getImports(userB, "corr-b");

    assert.equal(a.ingestions[0].id, created.id);
    assert.equal(b.ingestions.length, 0);
    assert.ok(client.queries.every((query) => !query.includes(".ai/local-data")));
  });

  it("uses transaction-local user scope for every service operation", async () => {
    const client = new FakeVaultClient();
    const service = createFinancialVaultPostgresService(client);
    await service.getVault(userA, "corr-scope-a");
    await service.getVault(userB, "corr-scope-b");
    assert.equal(client.transactionDepth, 0);
    assert.equal(client.currentUser, "");
    assert.ok(client.queries.filter((query) => query.includes("set_config")).length >= 2);
  });

  it("rejects idempotency key reuse with a different payload", async () => {
    const service = createFinancialVaultPostgresService(new FakeVaultClient());
    await service.createImport(userA, { sourceType: "CSV", fileName: "one.csv", mimeType: "text/csv", text: "a,b\n1,2", idempotencyKey: "same-key" }, "corr-1");
    await assert.rejects(
      () => service.createImport(userA, { sourceType: "CSV", fileName: "two.csv", mimeType: "text/csv", text: "a,b\n3,4", idempotencyKey: "same-key" }, "corr-2"),
      (error) => error instanceof FinancialVaultPersistenceError && error.code === "CONFLICT",
    );
  });

  it("confirms imports into facts with append-only fact version rows", async () => {
    const client = new FakeVaultClient();
    const service = createFinancialVaultPostgresService(client);
    const created = await service.createImport(userA, { sourceType: "CSV", fileName: "bank.csv", mimeType: "text/csv", text: "Date,Description,Debit,Credit\n2026-01-01,Salary,,100" }, "corr-create");
    await service.previewCsv(userA, created.id, "Date,Description,Debit,Credit\n2026-01-01,Salary,,100", { Date: "date", Description: "description", Debit: "debit", Credit: "credit" }, "corr-preview");
    const staged = await service.stageCsv(userA, created.id, { Date: "date", Description: "description", Debit: "debit", Credit: "credit" }, "corr-stage");
    await service.reviewImport(userA, created.id, staged.map((candidate) => ({ candidateId: candidate.id, action: "accept" })), "corr-review");
    const records = await service.confirmImport(userA, created.id, "corr-confirm");

    assert.equal(records.length, 1);
    assert.equal(client.facts.length, 1);
    assert.equal(client.factVersions.length, 1);
    assert.equal(client.factVersions[0].reason, "Manual import confirmed into Financial Vault.");
  });

  it("deduplicates document registration by user, hash and type", async () => {
    const client = new FakeVaultClient();
    const service = createFinancialVaultPostgresService(client);
    await service.addDocument(userA, { fileName: "pay.txt", documentType: "payslip", extractedText: "Payslip. Employer: Northstar. Annual salary: $120,000. Net pay: $7,000." }, "corr-doc-a");
    await service.addDocument(userA, { fileName: "pay.txt", documentType: "payslip", extractedText: "Payslip. Employer: Northstar. Annual salary: $120,000. Net pay: $7,000." }, "corr-doc-b");

    assert.equal(client.documents.length, 1);
    assert.ok(client.factVersions.length > 0);
  });

  it("removes active route imports of local Financial Vault repositories", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/financial-vault/route.ts"), "utf8");
    const importsRoute = readFileSync(join(process.cwd(), "src/app/api/financial-vault/imports/route.ts"), "utf8");

    assert.equal(route.includes("financialVaultStore"), false);
    assert.equal(importsRoute.includes("manualFinancialDataRepository"), false);
  });
});
