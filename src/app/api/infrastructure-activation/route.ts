import { getActivationManifest } from "@/lib/infrastructureActivation";

export async function GET() {
  const manifest = getActivationManifest();
  return Response.json({ ok: true, ...manifest });
}
