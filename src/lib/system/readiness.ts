import { runtimeConfig } from "@/lib/runtime/runtime-config";

export type ReadinessState = {
  database: boolean;
  auth: boolean;
  embeddings: boolean;
  transactions: boolean;
  subscriptions: boolean;
};

/**
 * Single source of truth for live infrastructure readiness.
 * In development, scaffolded layers are treated as ready so the execution queue stays accurate.
 */
export function getSystemReadiness(): ReadinessState {
  const isDev = process.env.NODE_ENV === "development";

  const database = runtimeConfig.dbConfigured || isDev;
  const auth = runtimeConfig.authConfigured || isDev;
  const embeddings = runtimeConfig.embeddingsConfigured || isDev;

  // Ingestion and subscription engines require no env vars — always operational
  const transactions = true;
  const subscriptions = true;

  return { database, auth, embeddings, transactions, subscriptions };
}
