import type {
  UserRecord,
  TransactionRecord,
  SubscriptionRecord,
  InsightRecord,
  EmbeddingRecord,
  MemoryNodeRecord,
  RoadmapTaskRecord,
  TelemetryRecord,
  UUID,
} from "./schema";
import {
  getLocalTransactions,
  appendLocalTransactions,
  getLocalSubscriptions,
  upsertLocalSubscription,
  getLocalTelemetry,
  appendLocalTelemetry,
  getLocalMemory,
  appendLocalMemory,
} from "../localStore";

export type PaginationOptions = {
  limit?: number;
  offset?: number;
};

export type QueryResult<T> = {
  data: T[];
  total: number;
  page: number;
};

function isLocalMode(): boolean {
  return !process.env.DATABASE_URL;
}

function notImplemented(name: string): never {
  throw new Error(`Repository method ${name} requires DATABASE_URL — set it to activate live-db mode.`);
}

export const userRepository = {
  async findById(_id: UUID): Promise<UserRecord | null> {
    notImplemented("userRepository.findById");
  },
  async findByEmail(_email: string): Promise<UserRecord | null> {
    notImplemented("userRepository.findByEmail");
  },
  async create(_data: Omit<UserRecord, "id" | "createdAt" | "updatedAt">): Promise<UserRecord> {
    notImplemented("userRepository.create");
  },
  async update(_id: UUID, _data: Partial<UserRecord>): Promise<UserRecord> {
    notImplemented("userRepository.update");
  },
};

export const transactionRepository = {
  async findByWorkspace(workspaceId: UUID, opts?: PaginationOptions): Promise<QueryResult<TransactionRecord>> {
    if (isLocalMode()) {
      const all = getLocalTransactions().filter((t) => t.workspaceId === workspaceId);
      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;
      return { data: all.slice(offset, offset + limit), total: all.length, page: Math.floor(offset / limit) };
    }
    notImplemented("transactionRepository.findByWorkspace");
  },
  async findRecurring(workspaceId: UUID): Promise<TransactionRecord[]> {
    if (isLocalMode()) {
      return getLocalTransactions().filter((t) => t.workspaceId === workspaceId && t.recurring);
    }
    notImplemented("transactionRepository.findRecurring");
  },
  async bulkCreate(transactions: Omit<TransactionRecord, "id" | "createdAt">[]): Promise<number> {
    if (isLocalMode()) {
      const withMeta: TransactionRecord[] = transactions.map((t) => ({
        ...t,
        id: `repo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
      }));
      return appendLocalTransactions(withMeta);
    }
    notImplemented("transactionRepository.bulkCreate");
  },
  async findDuplicates(workspaceId: UUID): Promise<TransactionRecord[]> {
    if (isLocalMode()) {
      return getLocalTransactions().filter((t) => t.workspaceId === workspaceId && t.duplicate);
    }
    notImplemented("transactionRepository.findDuplicates");
  },
};

export const subscriptionRepository = {
  async findByWorkspace(workspaceId: UUID): Promise<SubscriptionRecord[]> {
    if (isLocalMode()) {
      return getLocalSubscriptions().filter((s) => s.workspaceId === workspaceId);
    }
    notImplemented("subscriptionRepository.findByWorkspace");
  },
  async upsert(data: Omit<SubscriptionRecord, "id" | "createdAt" | "updatedAt">): Promise<SubscriptionRecord> {
    if (isLocalMode()) {
      const record: SubscriptionRecord = {
        ...data,
        id: `sub-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return upsertLocalSubscription(record);
    }
    notImplemented("subscriptionRepository.upsert");
  },
  async findUpcomingRenewals(workspaceId: UUID, days: number): Promise<SubscriptionRecord[]> {
    if (isLocalMode()) {
      const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      return getLocalSubscriptions().filter(
        (s) => s.workspaceId === workspaceId && new Date(s.nextRenewalDate) <= cutoff
      );
    }
    notImplemented("subscriptionRepository.findUpcomingRenewals");
  },
};

export const insightRepository = {
  async findByWorkspace(_workspaceId: UUID, _opts?: PaginationOptions): Promise<QueryResult<InsightRecord>> {
    notImplemented("insightRepository.findByWorkspace");
  },
  async create(_data: Omit<InsightRecord, "id" | "createdAt">): Promise<InsightRecord> {
    notImplemented("insightRepository.create");
  },
  async dismiss(_id: UUID): Promise<void> {
    notImplemented("insightRepository.dismiss");
  },
};

export const embeddingRepository = {
  async similaritySearch(_workspaceId: UUID, _vector: number[], _limit: number): Promise<EmbeddingRecord[]> {
    notImplemented("embeddingRepository.similaritySearch");
  },
  async create(_data: Omit<EmbeddingRecord, "id" | "createdAt">): Promise<EmbeddingRecord> {
    notImplemented("embeddingRepository.create");
  },
};

export const memoryRepository = {
  async findByWorkspace(workspaceId: UUID): Promise<MemoryNodeRecord[]> {
    if (isLocalMode()) {
      return getLocalMemory().filter((n) => n.workspaceId === workspaceId);
    }
    notImplemented("memoryRepository.findByWorkspace");
  },
  async findRelated(_nodeId: UUID): Promise<MemoryNodeRecord[]> {
    notImplemented("memoryRepository.findRelated");
  },
  async create(data: Omit<MemoryNodeRecord, "id" | "createdAt" | "lastAccessedAt">): Promise<MemoryNodeRecord> {
    if (isLocalMode()) {
      const now = new Date().toISOString();
      const node: MemoryNodeRecord = {
        ...data,
        id: `mem-${Date.now()}`,
        createdAt: now,
        lastAccessedAt: now,
      };
      appendLocalMemory(node);
      return node;
    }
    notImplemented("memoryRepository.create");
  },
};

export const roadmapRepository = {
  async findByWorkspace(_workspaceId: UUID): Promise<RoadmapTaskRecord[]> {
    notImplemented("roadmapRepository.findByWorkspace");
  },
  async findBySprint(_sprintId: string): Promise<RoadmapTaskRecord[]> {
    notImplemented("roadmapRepository.findBySprint");
  },
  async updateStatus(_id: UUID, _status: RoadmapTaskRecord["status"]): Promise<void> {
    notImplemented("roadmapRepository.updateStatus");
  },
};

export const telemetryRepository = {
  async ingest(record: Omit<TelemetryRecord, "id" | "createdAt">): Promise<void> {
    if (isLocalMode()) {
      appendLocalTelemetry({
        ...record,
        id: `tel-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      return;
    }
    notImplemented("telemetryRepository.ingest");
  },
  async findByLevel(level: TelemetryRecord["level"], limit: number): Promise<TelemetryRecord[]> {
    if (isLocalMode()) {
      return getLocalTelemetry()
        .filter((t) => t.level === level)
        .slice(-limit);
    }
    notImplemented("telemetryRepository.findByLevel");
  },
  async findUnresolved(): Promise<TelemetryRecord[]> {
    if (isLocalMode()) {
      return getLocalTelemetry().filter((t) => !t.resolved);
    }
    notImplemented("telemetryRepository.findUnresolved");
  },
};
