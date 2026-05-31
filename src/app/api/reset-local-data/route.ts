import {
  saveLocalTransactions,
  saveLocalSubscriptions,
  hasLocalData,
  getStorageMode,
} from "@/lib/localStore";
import { writeFileSync } from "fs";
import { join } from "path";

function clearImports(): void {
  try {
    writeFileSync(
      join(process.cwd(), ".ai", "local-data", "imports.json"),
      JSON.stringify([], null, 2),
      "utf-8"
    );
  } catch {
    // file may not exist yet, no-op
  }
}

export async function POST() {
  const before = hasLocalData();

  saveLocalTransactions([]);
  saveLocalSubscriptions([]);
  clearImports();

  const after = hasLocalData();

  return Response.json({
    ok: true,
    message: "Local data cleared — transactions, subscriptions, and imports reset to empty",
    storageMode: getStorageMode(),
    before,
    after,
    clearedAt: new Date().toISOString(),
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "Send POST to /api/reset-local-data to clear all local persistent data",
    currentCounts: hasLocalData(),
    storageMode: getStorageMode(),
  });
}
