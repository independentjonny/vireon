import assert from "node:assert/strict";
import test from "node:test";
import {
  AustralianAddressConfigurationError,
  AustralianAddressProviderError,
  normalizeAustralianAddressSuggestions,
  searchAustralianAddresses,
} from "../../src/server/services/australianAddressService.ts";

test("normalizes and deduplicates Geoscape G-NAF suggestions", () => {
  const suggestions = normalizeAustralianAddressSuggestions({
    suggest: [
      { id: "GAVIC421193859", address: "12 SMITH ST, ALPHINGTON VIC 3078" },
      { id: "GAVIC421193859", address: "12 SMITH ST, ALPHINGTON VIC 3078" },
      { id: "GANSW000000001", address: "12 SMITH ST, PARRAMATTA NSW 2150" },
      { id: "", address: "invalid" },
    ],
  });

  assert.deepEqual(suggestions, [
    {
      id: "GAVIC421193859",
      address: "12 SMITH ST, ALPHINGTON VIC 3078",
      locality: "ALPHINGTON",
      state: "VIC",
      postcode: "3078",
      provider: "geoscape-gnaf",
    },
    {
      id: "GANSW000000001",
      address: "12 SMITH ST, PARRAMATTA NSW 2150",
      locality: "PARRAMATTA",
      state: "NSW",
      postcode: "2150",
      provider: "geoscape-gnaf",
    },
  ]);
});

test("search uses the Australian provider without exposing its key in the URL", async () => {
  let requestedUrl = "";
  let requestedHeaders: HeadersInit | undefined;
  const results = await searchAustralianAddresses("  12   Smith Street ", {
    env: { GEOSCAPE_API_KEY: "server-secret" },
    fetchImpl: (async (input, init) => {
      requestedUrl = String(input);
      requestedHeaders = init?.headers;
      return Response.json({ suggest: [{ id: "GAVIC421193859", address: "12 SMITH ST, ALPHINGTON VIC 3078" }] });
    }) as typeof fetch,
  });

  assert.equal(new URL(requestedUrl).searchParams.get("query"), "12 Smith Street");
  assert.doesNotMatch(requestedUrl, /server-secret/);
  assert.equal(new Headers(requestedHeaders).get("x-api-key"), "server-secret");
  assert.equal(results[0]?.state, "VIC");
});

test("production fails closed without a configured Geoscape key", async () => {
  await assert.rejects(
    () => searchAustralianAddresses("12 Smith Street", { env: { VERCEL_ENV: "production" } }),
    AustralianAddressConfigurationError,
  );
});

test("provider failures return a safe error without the searched address", async () => {
  await assert.rejects(
    () => searchAustralianAddresses("12 Private Street", {
      env: {},
      fetchImpl: (async () => new Response("failure", { status: 429 })) as typeof fetch,
    }),
    (error: unknown) => error instanceof AustralianAddressProviderError && !error.message.includes("Private"),
  );
});
