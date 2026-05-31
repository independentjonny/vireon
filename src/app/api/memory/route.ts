import {
  getMemoryGraph,
  recallRelevantMemories,
  storeMemoryNode,
  linkMemoryNodes,
} from "@/lib/embeddings/memoryGraph";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const nodeId = searchParams.get("nodeId");

  if (query) {
    const memories = await recallRelevantMemories(query, 5);
    return Response.json({ ok: true, query, memories, recall: "semantic" });
  }

  if (nodeId) {
    const graph = getMemoryGraph();
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return Response.json({ ok: false, error: "Node not found" }, { status: 404 });
    }
    const linked = graph.nodes.filter((n) => node.linkedIds.includes(n.id));
    return Response.json({ ok: true, node, linked });
  }

  return Response.json({ ok: true, graph: getMemoryGraph() });
}

export async function POST(request: Request) {
  let body: {
    content?: string;
    type?: "financial_event" | "preference" | "goal" | "context" | "insight";
    importance?: number;
    metadata?: Record<string, unknown>;
    workspaceId?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.content) {
    return Response.json({ ok: false, error: "content is required" }, { status: 400 });
  }

  const node = await storeMemoryNode(
    body.content,
    body.type ?? "context",
    { ...body.metadata, workspaceId: body.workspaceId ?? "dev-workspace-001" },
    body.importance ?? 0.5
  );

  const hasDb = Boolean(process.env.DATABASE_URL);

  return Response.json(
    {
      ok: true,
      node,
      persisted: false,
      persistMessage: hasDb
        ? "DATABASE_URL present — install @prisma/client and call memoryRepository.create() to persist"
        : "DATABASE_URL not configured — node stored in session-scoped memory graph",
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  let body: { fromId?: string; toId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.fromId || !body.toId) {
    return Response.json(
      { ok: false, error: "fromId and toId are required" },
      { status: 400 }
    );
  }

  const linked = await linkMemoryNodes(body.fromId, body.toId);
  if (!linked) {
    return Response.json(
      { ok: false, error: `Node ${body.fromId} not found` },
      { status: 404 }
    );
  }

  return Response.json({ ok: true, fromId: body.fromId, toId: body.toId, linked: true });
}
