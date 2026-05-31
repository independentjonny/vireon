import { embed } from "./embeddingProvider";

export type RetrievalResult<T> = {
  item: T;
  score: number;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function semanticSearch<T extends { content: string; vector?: number[] }>(
  query: string,
  corpus: T[],
  topK: number = 5
): Promise<RetrievalResult<T>[]> {
  const queryEmbedding = await embed({ text: query });

  const scored = await Promise.all(
    corpus.map(async (item) => {
      let vector = item.vector;
      if (!vector) {
        const response = await embed({ text: item.content });
        vector = response.vector;
      }
      const score = cosineSimilarity(queryEmbedding.vector, vector);
      return { item, score };
    })
  );

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
