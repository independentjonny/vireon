export type AustralianAddressSuggestion = {
  id: string;
  address: string;
  locality: string | null;
  state: string | null;
  postcode: string | null;
  provider: "geoscape-gnaf";
};

type SearchOptions = {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
};

export class AustralianAddressConfigurationError extends Error {}
export class AustralianAddressProviderError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function addressParts(address: string) {
  const match = address.match(/,\s*([^,]+?)\s+(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\s+(\d{4})$/i);
  return {
    locality: match?.[1]?.trim() ?? null,
    state: match?.[2]?.toUpperCase() ?? null,
    postcode: match?.[3] ?? null,
  };
}

export function normalizeAustralianAddressSuggestions(payload: unknown): AustralianAddressSuggestion[] {
  if (!isObject(payload) || !Array.isArray(payload.suggest)) return [];

  const seen = new Set<string>();
  const suggestions: AustralianAddressSuggestion[] = [];
  for (const raw of payload.suggest) {
    if (!isObject(raw)) continue;
    const id = stringValue(raw.id);
    const address = stringValue(raw.address);
    if (!id || !address || seen.has(id)) continue;
    seen.add(id);
    suggestions.push({ id, address, ...addressParts(address), provider: "geoscape-gnaf" });
    if (suggestions.length === 5) break;
  }
  return suggestions;
}

function providerEndpoint(env: Record<string, string | undefined>) {
  const apiKey = env.GEOSCAPE_API_KEY?.trim();
  if (apiKey) {
    return {
      url: "https://api.psma.com.au/v1/predictive/address",
      headers: { [env.GEOSCAPE_API_KEY_HEADER?.trim() || "x-api-key"]: apiKey },
    };
  }

  // Geoscape's public demo returns real G-NAF records and is suitable only for
  // local development and branch previews. A production deployment fails closed.
  if (env.VERCEL_ENV === "production" || env.VIREON_ENVIRONMENT === "production") {
    throw new AustralianAddressConfigurationError("Australian address lookup is not configured.");
  }
  return { url: "https://api.psma.com.au/v1/predictive-demo/address", headers: {} };
}

export async function searchAustralianAddresses(query: string, options: SearchOptions = {}) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 4 || normalizedQuery.length > 120) return [];

  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const endpoint = providerEndpoint(env);
  const url = new URL(endpoint.url);
  url.searchParams.set("query", normalizedQuery);
  url.searchParams.set("maxNumberOfResults", "5");

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json", ...endpoint.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    throw new AustralianAddressProviderError("Australian address search is temporarily unavailable.");
  }
  if (!response.ok) {
    throw new AustralianAddressProviderError("Australian address search is temporarily unavailable.");
  }
  return normalizeAustralianAddressSuggestions(await response.json());
}
