"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Side = "top" | "bottom" | "left" | "right";

export function Tooltip({
  label,
  side = "bottom",
  delay = 250,
  children,
  className,
  multiline = false,
  /** When true, no hover/focus tooltip and any visible tip or pending timer is cleared. */
  disabled = false,
  /** Size and left-align tooltip to trigger width (e.g. tab chip hover details). Requires multiline for layout. */
  matchAnchorWidth = false,
  minWidth,
}: {
  label: ReactNode;
  side?: Side;
  delay?: number;
  children: ReactNode;
  className?: string;
  /** Wider, wrapping tooltip (e.g. help paragraphs). */
  multiline?: boolean;
  disabled?: boolean;
  matchAnchorWidth?: boolean;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = useCallback(() => {
    if (disabled) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => setOpen(true), delay);
  }, [delay, disabled]);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
    setReady(false);
  }, []);

  const handleFocusIntent = useCallback(() => {
    if (disabled) return;
    requestAnimationFrame(() => {
      const root = wrapRef.current;
      const active = document.activeElement;
      if (!root?.contains(active ?? null)) return;
      try {
        if ((active as Element).matches(":focus-visible")) show();
      } catch {
        // Unsupported selector — skip focus-based tooltip so restore-focus flashes stay hidden.
      }
    });
  }, [disabled, show]);

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (disabled) hide();
  }, [disabled, hide]);

  useEffect(() => {
    if (!open && tipRef.current) {
      tipRef.current.style.width = "";
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !tipRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();

    const el = tipRef.current;
    if (matchAnchorWidth) {
      el.style.width = `${Math.max(minWidth || 0, Math.round(r.width))}px`;
    } else {
      el.style.width = "";
    }

    const t = el.getBoundingClientRect();
    const gap = 6;
    let top = 0;
    let left = 0;
    switch (side) {
      case "top":
        top = r.top - t.height - gap;
        left = matchAnchorWidth ? r.left : r.left + r.width / 2 - t.width / 2;
        break;
      case "bottom":
        top = r.bottom + gap;
        left = matchAnchorWidth ? r.left : r.left + r.width / 2 - t.width / 2;
        break;
      case "left":
        top = r.top + r.height / 2 - t.height / 2;
        left = r.left - t.width - gap;
        break;
      case "right":
        top = r.top + r.height / 2 - t.height / 2;
        left = r.right + gap;
        break;
    }
    const pad = 4;
    left = Math.max(pad, Math.min(left, window.innerWidth - t.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - t.height - pad));
    setPos({ top, left });
    setReady(true);
  }, [open, side, label, multiline, matchAnchorWidth, minWidth]);

  return (
    <>
      <span
        ref={wrapRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={handleFocusIntent}
        onBlur={hide}
        className={className ?? "inline-flex"}
      >
        {children}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tipRef}
              role="tooltip"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: 100,
                background: "var(--titlebar-bg)",
                color: "var(--fg)",
                borderColor: "var(--border-strong)",
                opacity: ready ? 1 : 0,
                transition: ready ? "opacity 90ms ease-out, transform 90ms ease-out" : "none",
                transform: ready ? "scale(1)" : "scale(0.96)",
              }}
              className={`pointer-events-none px-2 py-[6px] rounded-[6px] text-[11px] font-sans border shadow-lg ${
                multiline
                  ? `${matchAnchorWidth ? "max-w-none" : "max-w-[min(288px,calc(100vw-1.5rem))]"} whitespace-normal text-left leading-snug`
                  : "py-[3px] whitespace-nowrap"
              }`}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
