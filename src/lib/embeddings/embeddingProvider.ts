export type EmbeddingProvider = "openai" | "cohere" | "local" | "stub";

export type EmbeddingRequest = {
  text: string;
  model?: string;
};

export type EmbeddingResponse = {
  vector: number[];
  dimensions: number;
  model: string;
  provider: EmbeddingProvider;
  tokens: number;
};

export function getActiveProvider(): EmbeddingProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.COHERE_API_KEY) return "cohere";
  return "stub";
}

export function getStubEmbedding(text: string): EmbeddingResponse {
  const seed = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const vector = Array.from({ length: 1536 }, (_, i) =>
    Math.sin(seed * (i + 1) * 0.0001) * 0.5
  );
  return {
    vector,
    dimensions: 1536,
    model: "stub-1536",
    provider: "stub",
    tokens: text.split(" ").length,
  };
}

export async function embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
  const provider = getActiveProvider();

  if (provider === "stub") {
    return getStubEmbedding(request.text);
  }

  throw new Error(`Embedding provider '${provider}' is configured but connector not wired. Add the relevant API key and provider client.`);
}

export const EMBEDDING_DIMENSIONS: Record<EmbeddingProvider, number> = {
  openai: 1536,
  cohere: 1024,
  local: 384,
  stub: 1536,
};
