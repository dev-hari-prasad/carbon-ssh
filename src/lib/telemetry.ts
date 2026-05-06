"use client";

import posthog from "posthog-js";
import {
  APP_VERSION_PUBLIC,
  POSTHOG_API_KEY,
  POSTHOG_HOST_RAW,
  telemetryIsConfigured,
} from "./telemetry-config";
import { loadTelemetryEnabled } from "./storage";
import { scrubFreeformString, stripForbiddenPayloadFields } from "./telemetry-sanitize";

const TELEMETRY_ANON_ID_KEY = "ssh.telemetry-anon-id.v1";

/** Set after first PostHog init — used to coordinate opt-out without re-reading flags mid-flight */
let initialized = false;

const ONBOARDING_EVENT_KEY = "ssh.telemetry-onboarding-event.v1";

function telemetryPlatform(): string {
  if (typeof window === "undefined") return "unknown";
  const p = window.electron?.platform;
  if (p === "darwin" || p === "win32" || p === "linux") return p;
  /* Coarse fallback — not user-agent fingerprinting */
  return "web";
}

function telemetryBaseProps(): Record<string, unknown> {
  return {
    app_version: APP_VERSION_PUBLIC,
    platform: telemetryPlatform(),
  };
}

/**
 * Privacy boundary: this ID is ONLY the random UUID in localStorage. It must never be joined
 * to email, SSH config, IPs, hardware IDs, etc. Super-properties intentionally stay coarse.
 */
function getOrCreateAnonymousDistinctId(): { id: string; isFreshProfile: boolean } {
  if (typeof window === "undefined") return { id: "ssr-placeholder", isFreshProfile: false };
  const existing = window.localStorage.getItem(TELEMETRY_ANON_ID_KEY);
  if (existing && existing.length >= 16) {
    return { id: existing, isFreshProfile: false };
  }
  const id = crypto.randomUUID();
  window.localStorage.setItem(TELEMETRY_ANON_ID_KEY, id);
  return { id, isFreshProfile: true };
}

function captureInternal(event: string, props?: Record<string, unknown>): void {
  /* Defense in depth: never enqueue when opt-out / missing SDK init */
  if (!isCaptureAllowed()) return;

  try {
    if (typeof posthog.has_opted_out_capturing === "function" && posthog.has_opted_out_capturing()) {
      return;
    }
  } catch {
    /* never throw from telemetry */
  }

  const safeProps = stripForbiddenPayloadFields(props ?? {}) as Record<string, unknown>;
  posthog.capture(event, {
    ...telemetryBaseProps(),
    ...safeProps,
  });
}

/**
 * Enables PostHog when the API key exists and preference is ON. Preference OFF skips init entirely
 * so the SDK stays inert until the user opts in.
 */
export function refreshTelemetryConsentFromStorage(): void {
  if (typeof window === "undefined" || !telemetryIsConfigured()) return;

  let emitNewAnonymousProfileEvent = false;

  const allowed = loadTelemetryEnabled();
  if (!allowed) {
    /* User turned analytics off: SDK must stop capturing. Cookie/local queue are not queried again until opted in.
     * We never call posthog.init when the pref starts false, so there is zero PostHog network until the user opts in. */
    if (initialized && typeof posthog.opt_out_capturing === "function") {
      try {
        posthog.opt_out_capturing();
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (!initialized) {
    initialized = true;
    const distinct = getOrCreateAnonymousDistinctId();

    emitNewAnonymousProfileEvent = distinct.isFreshProfile;

    posthog.init(POSTHOG_API_KEY, {
      ...(POSTHOG_HOST_RAW ? { api_host: POSTHOG_HOST_RAW } : {}),
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      /* No surveys, remote toolbar config, feature-flag `/decide` fan-out — minimal network surface */
      advanced_disable_decide: true,
      persistence: "localStorage",
      loaded(pg) {
        /* If pref flipped off before SDK finished booting, do nothing further */
        if (!loadTelemetryEnabled()) return;
        pg.identify(distinct.id);
      },
    });

    posthog.register({
      app_version: APP_VERSION_PUBLIC,
      platform: telemetryPlatform(),
      telemetry_policy: "anonymous_minimal_v1",
    });
  }

  /* Opt-in after init + register so captures (including microtask below) see the right consent state */
  if (typeof posthog.opt_in_capturing === "function") {
    try {
      posthog.opt_in_capturing();
    } catch {
      /* ignore */
    }
  }

  if (emitNewAnonymousProfileEvent) {
    queueMicrotask(() => {
      if (!loadTelemetryEnabled() || !telemetryIsConfigured()) return;
      captureInternal("analytics_new_profile", {});
    });
  }
}

function isCaptureAllowed(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (!telemetryIsConfigured()) return false;
    if (!loadTelemetryEnabled()) return false;
    if (!initialized) return false;
    if (typeof posthog.has_opted_out_capturing === "function") {
      return !posthog.has_opted_out_capturing();
    }
    return true;
  } catch {
    return false;
  }
}

/** Reload consent from storage after callers persist the toggle */
export function applyTelemetryPreference(): void {
  refreshTelemetryConsentFromStorage();
}

export function trackAppOpen(): void {
  if (!isCaptureAllowed()) return;
  captureInternal("app_open", { surface: window.electron ? "electron_renderer" : "browser" });
}

export function trackSSHConnectSuccess(): void {
  if (!isCaptureAllowed()) return;
  captureInternal("ssh_connect_success", {});
}

export function classifySshFailureForTelemetry(raw?: string): string {
  if (!raw) return "unknown";
  if (raw === "WebSocket error") return "websocket";
  if (raw.includes("All configured authentication methods failed")) return "auth_failed";
  if (raw.includes("Timed out while waiting for handshake")) return "handshake_timeout";
  if (raw.includes("ENOTFOUND") || raw.includes("getaddrinfo")) return "dns";
  if (raw.includes("ECONNREFUSED")) return "connection_refused";
  if (raw.includes("ECONNRESET") || raw.includes("read ECONNRESET")) return "connection_reset";
  if (raw.includes("Host key")) return "host_key";
  return "unknown";
}

export function trackSSHConnectFailure(bucket: string): void {
  if (!isCaptureAllowed()) return;
  captureInternal("ssh_connect_failure", { reason_bucket: bucket });
}

export function trackFeatureUsed(feature: string, props?: Record<string, unknown>): void {
  if (!isCaptureAllowed()) return;
  const safe =
    stripForbiddenPayloadFields({
      feature,
      ...props,
    }) ?? {};
  captureInternal("feature_used", safe as Record<string, unknown>);
}

export function trackOnboardingComplete(vars: {
  path: "passkey_or_biometric" | "password_setup" | "skip_lock";
}): void {
  if (typeof window !== "undefined" && window.localStorage.getItem(ONBOARDING_EVENT_KEY)) {
    return;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ONBOARDING_EVENT_KEY, "1");
  }

  refreshTelemetryConsentFromStorage();
  if (!isCaptureAllowed()) return;
  captureInternal(
    "onboarding_complete",
    stripForbiddenPayloadFields(vars) as Record<string, unknown>,
  );
}

export function trackCrash(context: {
  kind: "uncaught_exception" | "unhandled_rejection";
  message: string;
}): void {
  if (!isCaptureAllowed()) return;
  captureInternal("client_crash_signal", {
    kind: context.kind,
    message: scrubFreeformString(context.message, 320),
  });
}

export { stripForbiddenPayloadFields } from "./telemetry-sanitize";
