import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import {
  AustralianAddressConfigurationError,
  AustralianAddressProviderError,
  searchAustralianAddresses,
} from "@/server/services/australianAddressService";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);

  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 4 || query.length > 120) {
    return Response.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const suggestions = await searchAustralianAddresses(query);
    return Response.json(
      { suggestions },
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    const unavailable = error instanceof AustralianAddressConfigurationError || error instanceof AustralianAddressProviderError;
    return Response.json(
      { suggestions: [], error: unavailable ? error.message : "Australian address search is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
