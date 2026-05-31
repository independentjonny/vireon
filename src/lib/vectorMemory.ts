export function storeMemory(content: string) {
  return {
    ok: true,
    content,
    embeddingStatus: "placeholder",
    note: "Ready for OpenAI/Supabase vector embeddings",
  };
}
