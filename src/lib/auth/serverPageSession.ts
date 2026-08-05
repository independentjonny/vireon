import { cookies, headers } from "next/headers.js";
import { redirect } from "next/navigation.js";
import { requireSession, type Session } from "@/lib/auth/middleware";

function cookieBearerToken(allCookies: Awaited<ReturnType<typeof cookies>>): string | null {
  const direct =
    allCookies.get("sb-access-token")?.value ||
    allCookies.get("vireon_access_token")?.value ||
    allCookies.get("supabase_access_token")?.value;
  if (direct) return direct;

  const supabaseCookie = allCookies.getAll().find((cookie) => /^sb-.+-auth-token$/.test(cookie.name));
  if (!supabaseCookie?.value) return null;

  const decoded = decodeURIComponent(supabaseCookie.value);
  const candidates = [
    decoded,
    decoded.startsWith("base64-") ? Buffer.from(decoded.slice("base64-".length), "base64").toString("utf-8") : null,
  ].filter((item): item is string => Boolean(item));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
      if (parsed && typeof parsed === "object" && typeof (parsed as { access_token?: unknown }).access_token === "string") {
        return (parsed as { access_token: string }).access_token;
      }
    } catch {
      // Not a JSON Supabase cookie.
    }
  }
  return null;
}

export async function resolveServerPageSession(): Promise<Session | null> {
  const incomingHeaders = await headers();
  const incomingCookies = await cookies();
  const host = incomingHeaders.get("x-forwarded-host") || incomingHeaders.get("host") || "localhost";
  const protocol = incomingHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const requestHeaders = new Headers();
  const authorization = incomingHeaders.get("authorization");
  const cookieToken = cookieBearerToken(incomingCookies);
  if (authorization) requestHeaders.set("authorization", authorization);
  else if (cookieToken) requestHeaders.set("authorization", `Bearer ${cookieToken}`);

  const result = await requireSession(new Request(`${protocol}://${host}/__server_page_auth`, {
    headers: requestHeaders,
  }));
  return result.ok ? result.session : null;
}

export async function requireServerPageSession(returnTo = "/"): Promise<Session> {
  const session = await resolveServerPageSession();
  if (session) return session;
  redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}
