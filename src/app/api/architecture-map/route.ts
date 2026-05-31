import { generateArchitectureMap, persistArchitectureMap } from "@/lib/architectureMapper";

export const dynamic = "force-dynamic";

export async function GET() {
  const map = generateArchitectureMap();
  persistArchitectureMap(map);
  return Response.json({ ok: true, ...map });
}
