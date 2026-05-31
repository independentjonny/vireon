import { getStorageMode, hasLocalData } from "@/lib/localStore";

export const dbStatus = {
  provider: "postgresql",
  orm: "prisma",
  persistence: "ready",
  requiresEnv: ["DATABASE_URL"],
};

export function getDbConnectionStatus() {
  const mode = getStorageMode();
  const localData = hasLocalData();
  return {
    mode,
    connected: mode === "live-db",
    localFallbackActive: mode !== "live-db",
    localRecords: localData,
    databaseUrl: Boolean(process.env.DATABASE_URL),
    readyForLiveDb: Boolean(process.env.DATABASE_URL),
  };
}
