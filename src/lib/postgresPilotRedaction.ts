export function normalizePostgresPilotSecrets(secrets: unknown): string[] {
  if (secrets == null) return [];
  if (typeof secrets === "string") return secrets ? [secrets] : [];
  if (Array.isArray(secrets)) return secrets.filter(Boolean).map(String);
  if (typeof secrets === "object" && Symbol.iterator in secrets) {
    return Array.from(secrets as Iterable<unknown>).filter(Boolean).map(String);
  }
  return [];
}

export function redactPostgresPilotText(value: unknown, secrets: unknown = []): string {
  const secretList = normalizePostgresPilotSecrets(secrets);
  let redacted = String(value)
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgres://<redacted>@")
    .replace(/((?:^|[?&])password=)[^&\s]+/gi, "$1<redacted>")
    .replace(/(\b(?:create|alter)\s+role\b[\s\S]*?\bpassword\s+)'(?:''|[^'])*'/gi, "$1'<redacted>'")
    .replace(/("?\bPGPASSWORD"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}]+)/gi, "$1<redacted>");
  for (const secret of secretList) {
    redacted = redacted.split(secret).join("<redacted-secret>");
  }
  return redacted;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (normalized.includes("fingerprint")) return false;
  if (normalized.includes("diagnostic")) return false;
  if (normalized.includes("configured")) return false;
  if (normalized.includes("length")) return false;
  if (normalized.includes("source")) return false;
  if (normalized.includes("envname")) return false;
  if (normalized.includes("contains")) return false;
  if (normalized.includes("has")) return false;
  if (normalized.includes("appears")) return false;
  return normalized === "pgpassword" || normalized.endsWith("password") || normalized.includes("database_url");
}

export function redactPostgresPilotValue<T>(value: T, secrets: unknown = [], parentKey = ""): T {
  if (typeof value === "string") {
    const redacted = isSensitiveKey(parentKey) ? "<redacted>" : redactPostgresPilotText(value, secrets);
    return redacted as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPostgresPilotValue(item, secrets, parentKey)) as T;
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = redactPostgresPilotValue(entry, secrets, key);
    }
    return output as T;
  }
  return value;
}

export function stringifyPostgresPilotReport(value: unknown, secrets: unknown = []): string {
  return JSON.stringify(redactPostgresPilotValue(value, secrets), null, 2);
}
