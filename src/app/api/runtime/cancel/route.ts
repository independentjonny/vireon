import { getCancelScaffold } from "@/lib/runtimeControl";

export async function GET() {
  return Response.json({ ok: true, ...getCancelScaffold() });
}

export async function POST() {
  const scaffold = getCancelScaffold();
  return Response.json({
    ok: true,
    message: "Cancel scaffold invoked — no destructive action taken",
    ...scaffold,
  });
}
