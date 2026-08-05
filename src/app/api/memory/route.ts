export const dynamic = "force-dynamic";

const obsoleteMemoryResponse = () =>
  Response.json(
    {
      ok: false,
      code: "MEMORY_ROUTE_DISABLED",
      error: "The legacy memory endpoint is disabled for private beta. User-owned AI CFO history is available through the persisted AI CFO APIs.",
    },
    { status: 410 },
  );

export async function GET() {
  return obsoleteMemoryResponse();
}

export async function POST() {
  return obsoleteMemoryResponse();
}

export async function PATCH() {
  return obsoleteMemoryResponse();
}
