import { listAllowedCommands, evaluateCommandPolicy, isKeyAllowed } from "@/lib/commandPolicy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key) {
    const policy = evaluateCommandPolicy(key);
    return Response.json({ ok: true, policy });
  }
  const commands = listAllowedCommands();
  return Response.json({ ok: true, commands, totalAllowed: commands.length });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { key?: string };
    const key = body.key?.trim();
    if (!key) {
      return Response.json({ ok: false, error: "key is required" }, { status: 400 });
    }
    const allowed = isKeyAllowed(key);
    const policy = evaluateCommandPolicy(key);
    return Response.json({ ok: true, allowed, policy });
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
