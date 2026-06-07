/**
 * Telemetry sanitizers — NEVER forward raw SSH errors, stack traces full of filesystem paths,
 * or arbitrary payloads that might contain hostname/username/key material scraped from errors.
 */

export const BLOCKED_KEYS = new Set(
  [
    "password",
    "passphrase",
    "privatekey",
    "private_key",
    "publickey",
    "public_key",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "apikey",
    "api_key",
    "authorization",
    "cookie",
    "hostname",
    "host",
    "username",
    "ip",
    "ip_address",
    "filepath",
    "path",
    "cwd",
    "home",
    "command",
    "cmd",
    "stdout",
    "stderr",
    "terminal_output",
    "output",
    "clipboard",
    "env",
    "headers",
    "email",
    "url",
    "connection_string",
    "connection",
    // common leak vectors in JSON/debug dumps
    "stack",
    "stacktrace",
  ].map((k) => k.toLowerCase()),
);

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\b/g;
const IPV6 =
  /(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,7}:|(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{0,4}:){2,7}[a-fA-F0-9]{1,4}/g;

/** Rough Windows path segment removal */
const WIN_PATH_CHUNK = /\b[A-Za-z]:\\(?:[\w.-]+\\)+[\w.-]+\b/g;
/** posix-ish absolute paths inside strings */
const NIX_PATH_CHUNK = /\B\/(?:[\w.-]+\/)+[\w.-]+\b/g;

export function scrubFreeformString(input: string, maxLen = 280): string {
  let s = input
    .replace(IPV4, "[ip]")
    .replace(IPV6, "[ip]")
    .replace(WIN_PATH_CHUNK, "[path]")
    .replace(NIX_PATH_CHUNK, "[path]");
  s = s.replace(/\S+@\S+/g, "[user@]");
  if (s.length > maxLen) {
    return s.slice(0, maxLen) + "…";
  }
  return s;
}

function isBlockedKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (BLOCKED_KEYS.has(lower)) return true;
  if (lower.includes("password")) return true;
  if (lower.includes("pwd")) return true;
  if (lower.includes("secret")) return true;
  if (lower.includes("token")) return true;
  if (lower.includes("private")) return true;
  return false;
}

/**
 * Recursively clones JSON-like payloads and strips keys likely to carry credentials or identifiers.
 */
export function stripForbiddenPayloadFields(input: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (input === null || typeof input !== "object") {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripForbiddenPayloadFields(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(input as Record<string, unknown>)) {
    if (isBlockedKey(rawKey)) {
      continue;
    }
    if (typeof value === "string") {
      out[rawKey] = scrubFreeformString(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[rawKey] = value;
    } else if (typeof value === "object" && value !== null) {
      out[rawKey] = stripForbiddenPayloadFields(value, depth + 1);
    } else if (typeof value === "bigint") {
      out[rawKey] = value.toString();
    } else {
      out[rawKey] = "[omitted]";
    }
  }
  return out;
}

export function coerceReasonToString(reason: unknown): string {
  if (typeof reason === "string") return scrubFreeformString(reason, 320);
  if (reason instanceof Error) return scrubFreeformString(reason.name + ": " + reason.message);
  if (reason !== null && typeof reason === "object") {
    try {
      const cleaned = stripForbiddenPayloadFields(reason);
      return scrubFreeformString(JSON.stringify(cleaned), 320);
    } catch {
      return "unknown_reason";
    }
  }
  try {
    return scrubFreeformString(JSON.stringify(reason), 320);
  } catch {
    return "unknown_reason";
  }
}
