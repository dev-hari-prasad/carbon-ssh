"use client";

import { useEffect } from "react";
import { squircleObserver } from "corner-smoothing";

type Observer = ReturnType<typeof squircleObserver>;

type ObservedElement = {
  observer: Observer;
  originalClipPath: string;
  signature: string;
};

const ROUNDED_SELECTOR = '[data-smooth-corners="true"]';

const DEFAULT_CORNER_SMOOTHING = 0.6;
const MIN_SIZE = 12;

function getClassName(el: Element) {
  return typeof el.className === "string" ? el.className : "";
}

function hasClassToken(className: string, token: string) {
  return new RegExp(`(^|\\s|:)${token}(\\s|$)`).test(className);
}

function hasDirectionalRadius(className: string) {
  return /(^|\s|:)rounded-(l|r|t|b|tl|tr|bl|br)(-|$|\[)/.test(className);
}

function parseRadius(value: string) {
  return Number.parseFloat(value.split(" ")[0] || "0") || 0;
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) <= 0.5;
}

function getCornerOptions(el: HTMLElement) {
  const forced = el.dataset.smoothCorners === "true";
  const className = getClassName(el);

  if (!forced) return null;
  if (el.dataset.smoothCorners === "false") return null;
  if (hasClassToken(className, "rounded-full") || hasClassToken(className, "rounded-none")) {
    return null;
  }
  if (hasDirectionalRadius(className)) return null;

  const rect = el.getBoundingClientRect();
  if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return null;

  const styles = window.getComputedStyle(el);
  if (styles.display === "none" || styles.visibility === "hidden") return null;

  const radii = [
    parseRadius(styles.borderTopLeftRadius),
    parseRadius(styles.borderTopRightRadius),
    parseRadius(styles.borderBottomRightRadius),
    parseRadius(styles.borderBottomLeftRadius),
  ] as const;

  if (radii.every((radius) => radius <= 0)) return null;

  const uniform = radii.every((radius) => nearlyEqual(radius, radii[0]));
  if (!uniform) return null;

  const shortestSide = Math.min(rect.width, rect.height);
  const maxRadius = Math.max(...radii);
  if (maxRadius >= shortestSide / 2 - 1) return null;

  const smoothing = Number.parseFloat(el.dataset.cornerSmoothing || "");

  return {
    cornerRadius: uniform ? radii[0] : maxRadius,
    topLeftCornerRadius: uniform ? undefined : radii[0],
    topRightCornerRadius: uniform ? undefined : radii[1],
    bottomRightCornerRadius: uniform ? undefined : radii[2],
    bottomLeftCornerRadius: uniform ? undefined : radii[3],
    cornerSmoothing: Number.isFinite(smoothing) ? smoothing : DEFAULT_CORNER_SMOOTHING,
    preserveSmoothing: true,
  };
}

function getSignature(options: NonNullable<ReturnType<typeof getCornerOptions>>) {
  return [
    options.cornerRadius,
    options.topLeftCornerRadius,
    options.topRightCornerRadius,
    options.bottomRightCornerRadius,
    options.bottomLeftCornerRadius,
    options.cornerSmoothing,
  ].join(":");
}

export function SmoothCornersRuntime() {
  useEffect(() => {
    const observed = new Map<HTMLElement, ObservedElement>();
    let frame = 0;

    const unobserve = (el: HTMLElement) => {
      const current = observed.get(el);
      if (!current) return;
      current.observer.disconnect();
      el.style.clipPath = current.originalClipPath;
      observed.delete(el);
    };

    const observe = (el: HTMLElement) => {
      const options = getCornerOptions(el);

      if (!options) {
        unobserve(el);
        return;
      }

      const signature = getSignature(options);
      const current = observed.get(el);
      if (current?.signature === signature) return;

      const originalClipPath = current?.originalClipPath ?? el.style.clipPath;
      current?.observer.disconnect();

      observed.set(el, {
        observer: squircleObserver(el, options),
        originalClipPath,
        signature,
      });
    };

    const scan = () => {
      frame = 0;

      for (const el of observed.keys()) {
        if (!el.isConnected) {
          unobserve(el);
        } else {
          observe(el);
        }
      }

      document.querySelectorAll(ROUNDED_SELECTOR).forEach((node) => {
        if (node instanceof HTMLElement) observe(node);
      });
    };

    const scheduleScan = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(scan);
    };

    scan();

    const mutationObserver = new MutationObserver(scheduleScan);
    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-smooth-corners", "data-corner-smoothing"],
      childList: true,
      subtree: true,
    });

    return () => {
      mutationObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      for (const el of observed.keys()) unobserve(el);
    };
  }, []);

  return null;
}
