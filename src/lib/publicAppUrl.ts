export type PublicAppUrlInput = {
  request?: Request;
  env?: NodeJS.ProcessEnv;
};

function cleanBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.trim().replace(/\/+$/, "");
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.hostname === "0.0.0.0" || url.hostname === "[::]" || url.hostname === "::") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalDevelopment(env: NodeJS.ProcessEnv): boolean {
  if (env.NEXT_PHASE === "phase-development-server") return true;
  return env.NODE_ENV !== "production";
}

function safeHost(value: string | null): string | null {
  if (!value) return null;
  const host = value.split(",")[0]?.trim();
  if (!host) return null;
  const hostname = host.split(":")[0]?.toLowerCase();
  if (!hostname || hostname === "0.0.0.0" || hostname === "::" || hostname === "[::]") return null;
  return host;
}

export function resolvePublicAppBaseUrl(input: PublicAppUrlInput = {}): string {
  const env = input.env ?? process.env;
  const configured = cleanBaseUrl(env.VIREON_PUBLIC_APP_URL) || cleanBaseUrl(env.NEXT_PUBLIC_APP_URL);
  if (configured) return configured;

  if (isLocalDevelopment(env)) return "http://localhost:3000";

  const headers = input.request?.headers;
  const host = safeHost(headers?.get("x-forwarded-host") || headers?.get("host") || null);
  if (host) {
    const rawProto = headers?.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    const proto = rawProto === "http" || rawProto === "https" ? rawProto : "https";
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  throw new Error("PUBLIC_APP_URL_UNAVAILABLE");
}
