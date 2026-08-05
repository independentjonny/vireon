import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";

type AssetData = {
  propertyValue: number;
  mortgageBalance: number;
  cashBalance: number;
  superInvestments: number;
  vehicleOtherAssets: number;
};

const dataDir = join(process.cwd(), ".ai", "local-data");
const filePath = join(dataDir, "assets.json");

function cleanNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(request: Request) {
  const auth = await requirePermission(request, "read:transactions");
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const raw = await readFile(filePath, "utf-8");
    return NextResponse.json({ ok: true, assetData: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ ok: true, assetData: null });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "write:transactions");
  if (!auth.ok) return authErrorResponse(auth);
  const body = (await request.json()) as Partial<AssetData>;

  const assetData: AssetData = {
    propertyValue: cleanNumber(body.propertyValue),
    mortgageBalance: cleanNumber(body.mortgageBalance),
    cashBalance: cleanNumber(body.cashBalance),
    superInvestments: cleanNumber(body.superInvestments),
    vehicleOtherAssets: cleanNumber(body.vehicleOtherAssets),
  };

  await mkdir(dataDir, { recursive: true });
  await writeFile(filePath, JSON.stringify(assetData, null, 2), "utf-8");

  return NextResponse.json({ ok: true, assetData });
}
