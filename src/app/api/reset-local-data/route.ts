import {
  saveLocalTransactions,
  saveLocalSubscriptions,
  hasLocalData,
  getStorageMode,
} from "@/lib/localStore";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
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

function productionBlocked(): Response | null {
  if (process.env.NODE_ENV !== "production") return null;
  return Response.json({ ok: false, error: "Local data reset is disabled in production." }, { status: 403 });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);
  const blocked = productionBlocked();
  if (blocked) return blocked;

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

export async function GET(request: Request) {
  const auth = await requirePermission(request, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);
  const blocked = productionBlocked();
  if (blocked) return blocked;

  return Response.json({
    ok: true,
    message: "Send POST to /api/reset-local-data to clear all local persistent data",
    currentCounts: hasLocalData(),
    storageMode: getStorageMode(),
  });
}
