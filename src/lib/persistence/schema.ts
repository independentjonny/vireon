export type UUID = string;
export type ISODateString = string;

export interface UserRecord {
  id: UUID;
  email: string;
  name: string;
  orgId: UUID;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface OrgRecord {
  id: UUID;
  name: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: ISODateString;
}

export interface WorkspaceRecord {
  id: UUID;
  orgId: UUID;
  name: string;
  currency: string;
  timezone: string;
  createdAt: ISODateString;
}

export interface TransactionRecord {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
  merchant: string;
  merchantCanonical: string;
  amount: number;
  currency: string;
  category: string;
  subCategory: string;
  date: ISODateString;
  recurring: boolean;
  recurringCadence: "daily" | "weekly" | "fortnightly" | "monthly" | "quarterly" | "annual" | null;
  duplicate: boolean;
  confidence: number;
  rawDescription: string;
  source: "csv" | "api" | "manual" | "bank_feed";
  createdAt: ISODateString;
}

export interface SubscriptionRecord {
  id: UUID;
  workspaceId: UUID;
  transactionId: UUID;
  merchant: string;
  merchantCanonical: string;
  amount: number;
  cadence: "monthly" | "quarterly" | "annual";
  nextRenewalDate: ISODateString;
  cancellationScore: number;
  pricingAnomalyScore: number;
  savingsOpportunity: number;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface InsightRecord {
  id: UUID;
  workspaceId: UUID;
  type: "savings" | "risk" | "opportunity" | "forecast" | "anomaly";
  title: string;
  description: string;
  impact: number;
  confidence: number;
  dismissed: boolean;
  createdAt: ISODateString;
}

export interface EmbeddingRecord {
  id: UUID;
  workspaceId: UUID;
  sourceType: "transaction" | "insight" | "subscription" | "memory" | "copilot";
  sourceId: UUID;
  content: string;
  vector: number[];
  model: string;
  createdAt: ISODateString;
}

export interface MemoryNodeRecord {
  id: UUID;
  workspaceId: UUID;
  type: "financial_event" | "preference" | "goal" | "context";
  content: string;
  linkedIds: UUID[];
  embeddingId: UUID | null;
  importance: number;
  createdAt: ISODateString;
  lastAccessedAt: ISODateString;
}

export interface RoadmapTaskRecord {
  id: UUID;
  workspaceId: UUID;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "backlog" | "sprint" | "in_progress" | "blocked" | "done";
  effort: "small" | "medium" | "large";
  category: string;
  dependencyIds: UUID[];
  sprintId: string | null;
  assignedAgent: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface TelemetryRecord {
  id: UUID;
  workspaceId: UUID | null;
  event: string;
  level: "info" | "warn" | "error" | "critical";
  agent: string;
  payload: Record<string, unknown>;
  errorClass: string | null;
  resolved: boolean;
  createdAt: ISODateString;
}

export const SCHEMA_VERSION = "2.0.0";

export const TABLE_NAMES = {
  users: "users",
  orgs: "orgs",
  workspaces: "workspaces",
  transactions: "transactions",
  subscriptions: "subscriptions",
  insights: "insights",
  embeddings: "embeddings",
  memory_nodes: "memory_nodes",
  roadmap_tasks: "roadmap_tasks",
  telemetry: "telemetry",
} as const;
