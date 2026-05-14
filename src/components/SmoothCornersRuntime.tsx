"use client";

import { useEffect } from "react";
import { getSvgPath } from "figma-squircle";

type SquircleHandle = {
  resizeObserver: ResizeObserver;
  originalClipPath: string;
  signature: string;
};

const SQUIRCLE_SELECTOR = '[class*="rounded"],[data-smooth-corners="true"]';

const DEFAULT_CORNER_SMOOTHING = 1;
const MIN_ELEMENT_SIZE = 12;
const MIN_RADIUS_FOR_SMOOTHING = 8;

function getClassName(el: Element) {
  return typeof el.className === "string" ? el.className : "";
}

function hasClassToken(className: string, token: string) {
  return new RegExp(`(^|\\s|:)${token}(\\s|$)`).test(className);
}

function hasDirectionalRadius(className: string) {
  return /(^|\s|:)rounded-(l|r|t|b|tl|tr|bl|br)(-|$|\[)/.test(className);
}

function shouldSkipByClass(className: string): boolean {
  if (hasClassToken(className, "rounded-full")) return true;
  if (hasClassToken(className, "rounded-none")) return true;
  if (hasClassToken(className, "no-squircle")) return true;
  if (hasDirectionalRadius(className)) return true;
  return false;
}

function parseRadius(value: string) {
  return Number.parseFloat(value.split(" ")[0] || "0") || 0;
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) <= 0.5;
}

function getCornerOptions(el: HTMLElement) {
  if (el.dataset.smoothCorners === "false") return null;

  const className = getClassName(el);
  if (shouldSkipByClass(className)) return null;

  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w < MIN_ELEMENT_SIZE || h < MIN_ELEMENT_SIZE) return null;

  const styles = window.getComputedStyle(el);
  if (styles.display === "none" || styles.visibility === "hidden") return null;

  const radii = [
    parseRadius(styles.borderTopLeftRadius),
    parseRadius(styles.borderTopRightRadius),
    parseRadius(styles.borderBottomRightRadius),
    parseRadius(styles.borderBottomLeftRadius),
  ] as const;

  if (radii.every((r) => r < MIN_RADIUS_FOR_SMOOTHING)) return null;

  const uniform = radii.every((r) => nearlyEqual(r, radii[0]));
  if (!uniform) return null;

  const shortestSide = Math.min(w, h);
  const maxRadius = Math.max(...radii);
  if (maxRadius >= shortestSide / 2 - 1) return null;

  const smoothing = Number.parseFloat(el.dataset.cornerSmoothing || "");

  return {
    cornerRadius: radii[0],
    cornerSmoothing: Number.isFinite(smoothing) ? smoothing : DEFAULT_CORNER_SMOOTHING,
  };
}

function getSignature(
  opts: NonNullable<ReturnType<typeof getCornerOptions>>,
  w: number,
  h: number,
) {
  return `${opts.cornerRadius}:${opts.cornerSmoothing}:${w}:${h}`;
}

function applySquircle(el: HTMLElement, opts: NonNullable<ReturnType<typeof getCornerOptions>>) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w < MIN_ELEMENT_SIZE || h < MIN_ELEMENT_SIZE) return;

  const path = getSvgPath({
    width: w,
    height: h,
    cornerRadius: opts.cornerRadius,
    cornerSmoothing: opts.cornerSmoothing,
    preserveSmoothing: true,
  });
  el.style.clipPath = `path('${path}')`;
}

export function SmoothCornersRuntime() {
  useEffect(() => {
    const observed = new Map<HTMLElement, SquircleHandle>();
    let frame = 0;

    const unobserve = (el: HTMLElement) => {
      const handle = observed.get(el);
      if (!handle) return;
      handle.resizeObserver.disconnect();
      el.style.clipPath = handle.originalClipPath;
      observed.delete(el);
    };

    const observe = (el: HTMLElement) => {
      const opts = getCornerOptions(el);

      if (!opts) {
        unobserve(el);
        return;
      }

      const sig = getSignature(opts, el.offsetWidth, el.offsetHeight);
      const current = observed.get(el);
      if (current?.signature === sig) return;

      const originalClipPath = current?.originalClipPath ?? el.style.clipPath;
      current?.resizeObserver.disconnect();

      applySquircle(el, opts);

      const ro = new ResizeObserver(() => {
        const newSig = getSignature(opts, el.offsetWidth, el.offsetHeight);
        const handle = observed.get(el);
        if (handle && handle.signature !== newSig) {
          handle.signature = newSig;
          applySquircle(el, opts);
        }
      });
      ro.observe(el);

      observed.set(el, {
        resizeObserver: ro,
        originalClipPath,
        signature: sig,
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

      document.querySelectorAll(SQUIRCLE_SELECTOR).forEach((node) => {
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

    window.addEventListener("resize", scheduleScan);

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleScan);
      if (frame) window.cancelAnimationFrame(frame);
      for (const el of observed.keys()) unobserve(el);
    };
  }, []);

  return null;
}
