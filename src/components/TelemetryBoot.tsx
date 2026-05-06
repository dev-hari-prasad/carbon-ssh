"use client";

import { useEffect } from "react";
import { coerceReasonToString } from "@/lib/telemetry-sanitize";
import {
  refreshTelemetryConsentFromStorage,
  trackAppOpen,
  trackCrash,
} from "@/lib/telemetry";

/**
 * One place to boot analytics after hydration. Keeps PostHog out of SSR and ensures opt-out
 * is respected before anything is emitted.
 */
export function TelemetryBoot() {
  useEffect(() => {
    refreshTelemetryConsentFromStorage();
    queueMicrotask(() => {
      trackAppOpen();
    });

    const onError = (ev: ErrorEvent) => {
      const text = coerceReasonToString(ev.error ?? ev.message);
      trackCrash({
        kind: "uncaught_exception",
        message: text,
      });
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      trackCrash({
        kind: "unhandled_rejection",
        message: coerceReasonToString(ev.reason),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
