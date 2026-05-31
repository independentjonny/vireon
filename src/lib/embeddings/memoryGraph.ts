import { embed } from "./embeddingProvider";
import { semanticSearch } from "./semanticRetrieval";

export type MemoryNode = {
  id: string;
  type: "financial_event" | "preference" | "goal" | "context" | "insight";
  content: string;
  vector?: number[];
  linkedIds: string[];
  importance: number;
  createdAt: string;
  lastAccessedAt: string;
  metadata: Record<string, unknown>;
};

export type MemoryGraph = {
  nodes: MemoryNode[];
  generatedAt: string;
};

const IN_MEMORY_GRAPH: MemoryNode[] = [
  {
    id: "mem-001",
    type: "goal",
    content: "User wants to reduce subscription spend by 20% this quarter.",
    linkedIds: ["mem-002"],
    importance: 0.9,
    createdAt: "2026-01-01T00:00:00Z",
    lastAccessedAt: new Date().toISOString(),
    metadata: { source: "copilot" },
  },
  {
    id: "mem-002",
    type: "financial_event",
    content: "Salary income of $6,420 received on 2026-05-01.",
    linkedIds: [],
    importance: 0.7,
    createdAt: "2026-05-01T00:00:00Z",
    lastAccessedAt: new Date().toISOString(),
    metadata: { source: "transaction", amount: 6420 },
  },
  {
    id: "mem-003",
    type: "preference",
    content: "User prefers conservative investment strategies with focus on property.",
    linkedIds: [],
    importance: 0.8,
    createdAt: "2026-02-15T00:00:00Z",
    lastAccessedAt: new Date().toISOString(),
    metadata: { source: "profile" },
  },
];

export function getMemoryGraph(): MemoryGraph {
  return {
    nodes: IN_MEMORY_GRAPH,
    generatedAt: new Date().toISOString(),
  };
}

export async function recallRelevantMemories(query: string, topK: number = 3): Promise<MemoryNode[]> {
  const results = await semanticSearch(query, IN_MEMORY_GRAPH, topK);
  return results.map((r) => {
    r.item.lastAccessedAt = new Date().toISOString();
    return r.item;
  });
}

export async function storeMemoryNode(
  content: string,
  type: MemoryNode["type"],
  metadata: Record<string, unknown> = {},
  importance: number = 0.5
): Promise<MemoryNode> {
  const embedding = await embed({ text: content });
  const node: MemoryNode = {
    id: `mem-${Date.now()}`,
    type,
    content,
    vector: embedding.vector,
    linkedIds: [],
    importance,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    metadata,
  };
  IN_MEMORY_GRAPH.push(node);
  return node;
}

export async function linkMemoryNodes(fromId: string, toId: string): Promise<boolean> {
  const from = IN_MEMORY_GRAPH.find((n) => n.id === fromId);
  if (!from) return false;
  if (!from.linkedIds.includes(toId)) {
    from.linkedIds.push(toId);
  }
  return true;
}
