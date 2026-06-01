/**
 * PostHog is configured ONLY via Next.js public env (baked into the renderer bundle).
 * Use your PostHog project API key (`phc_…` from Project settings → Project API key).
 * Never use a Personal API Key or server-side secret in the Electron renderer.
 */

export const POSTHOG_API_KEY =
  typeof process !== "undefined" ? (process.env.POSTHOG_API_KEY_PUBLIC ?? "").trim() : "";

/** PostHog ingest host (EU: https://eu.i.posthog.com). Empty uses SDK default for your region/project. */
export const POSTHOG_HOST_RAW = (process.env.POSTHOG_HOST_PUBLIC ?? "").trim();

export const APP_VERSION_PUBLIC =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_APP_VERSION || "unknown" : "unknown";

export function telemetryIsConfigured(): boolean {
  return POSTHOG_API_KEY.length > 0;
}
