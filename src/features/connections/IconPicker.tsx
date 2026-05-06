"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HardDrives,
  LinuxLogo,
  Triangle,
  Atom,
  Cube,
  Database,
  AppleLogo,
  WindowsLogo,
  Cloud,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import type { Connection } from "@/lib/types";
import { BRAND_ICONS } from "./brandIcons";

type SystemKind = NonNullable<Connection["iconKind"]>;

export const SYSTEM_ICONS: Array<{
  id: SystemKind;
  label: string;
  Icon: React.ComponentType<{ size?: number; weight?: "fill" | "regular" }>;
}> = [
  { id: "generic", label: "Generic", Icon: HardDrives },
  { id: "linux", label: "Linux", Icon: LinuxLogo },
  { id: "debian", label: "Debian", Icon: Atom },
  { id: "centos", label: "CentOS", Icon: Cube },
  { id: "alpine", label: "Alpine", Icon: Triangle },
  { id: "macos", label: "macOS", Icon: AppleLogo },
  { id: "windows", label: "Windows", Icon: WindowsLogo },
];

const COLOR_SWATCHES = [
  "#3b82f6",
  "#0ea5b7",
  "#22c55e",
  "#eab308",
  "#ef6a1d",
  "#ef4444",
  "#d6336c",
  "#9b1c1c",
  "#7c3aed",
  "#64748b",
];

export type IconValue =
  | { kind: "system"; id: SystemKind; color?: string }
  | { kind: "brand"; id: string };

export function IconPicker({
  value,
  onChange,
  children,
}: {
  value: IconValue;
  onChange: (v: IconValue) => void;
  children: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"system" | "brand">(value.kind === "system" ? "system" : "brand");
  const [query, setQuery] = useState("");
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const filteredBrands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BRAND_ICONS;
    return BRAND_ICONS.filter((b) => b.id.includes(q) || b.label.toLowerCase().includes(q));
  }, [query]);

  useLayoutEffect(() => {
    if (!open || !triggerWrapRef.current || !popRef.current) return;
    const r = triggerWrapRef.current.getBoundingClientRect();
    const p = popRef.current.getBoundingClientRect();
    const gap = 8;
    const padding = 12;

    const triggerCenterX = r.left + r.width / 2;
    const inRightHalf = triggerCenterX > window.innerWidth / 2;

    let left = inRightHalf ? r.right - p.width : r.left;
    if (left + p.width + padding > window.innerWidth) {
      left = window.innerWidth - p.width - padding;
    }
    left = Math.max(padding, left);

    let top = r.bottom + gap;
    if (top + p.height + padding > window.innerHeight) {
      top = Math.max(padding, r.top - p.height - gap);
    }
    top = Math.max(padding, top);

    setPos({ top, left });
    setReady(true);
  }, [open, tab, filteredBrands.length]);

  useEffect(() => {
    if (!open) setReady(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (triggerWrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentColor = value.kind === "system" ? (value.color ?? "var(--accent)") : "var(--accent)";

  return (
    <>
      <span ref={triggerWrapRef} className="inline-flex">
        {children(() => setOpen((v) => !v))}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: 80,
                background: "var(--popover-bg)",
                borderColor: "var(--border-strong)",
                opacity: ready ? 1 : 0,
                transform: ready ? "scale(1)" : "scale(0.96)",
                transformOrigin: "top",
                transition: ready ? "opacity 110ms ease-out, transform 110ms ease-out" : "none",
              }}
              className="w-[280px] max-h-[360px] flex flex-col rounded-[10px] border shadow-2xl overflow-hidden"
            >
              <div className="px-2 pt-2 pb-1.5 flex items-center gap-1 border-b border-border">
                <TabBtn active={tab === "brand"} onClick={() => setTab("brand")}>
                  Brands
                </TabBtn>
                <TabBtn active={tab === "system"} onClick={() => setTab("system")}>
                  Shapes
                </TabBtn>
                <div className="flex-1" />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-6 h-6 grid place-items-center rounded-[6px] text-fg-muted hover:text-fg hover:bg-[var(--neutral-hover-bg)]"
                >
                  <X size={11} weight="bold" />
                </button>
              </div>

              {tab === "brand" ? (
                <div className="px-2 pt-2 pb-1">
                  <div className="flex items-center gap-1.5 px-2 h-7 rounded-[7px] bg-[var(--input-bg)] border border-border focus-within:border-[var(--border-strong)]">
                    <MagnifyingGlass size={11} className="text-fg-muted shrink-0" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search brands…"
                      className="flex-1 min-w-0 bg-transparent text-[11.5px] font-sans text-fg placeholder:text-fg-muted focus:outline-none"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto px-2 py-2">
                {tab === "system" ? (
                  <>
                    <div className="grid grid-cols-5 gap-1">
                      {SYSTEM_ICONS.map((s) => {
                        const active = value.kind === "system" && value.id === s.id;
                        const Icon = s.Icon;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            title={s.label}
                            onClick={() =>
                              onChange({
                                kind: "system",
                                id: s.id,
                                color: value.kind === "system" ? value.color : undefined,
                              })
                            }
                            className={`aspect-square grid place-items-center rounded-[8px] transition-colors ${
                              active
                                ? "bg-[var(--neutral-hover-bg)] ring-1 ring-fg/40"
                                : "hover:bg-[var(--neutral-hover-bg)]"
                            }`}
                          >
                            <span style={{ color: currentColor }}>
                              <Icon size={18} weight="fill" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-[10px] uppercase tracking-wider font-sans font-semibold text-fg-dim pb-1.5">
                        Color
                      </div>
                      <div className="grid grid-cols-10 gap-1">
                        {COLOR_SWATCHES.map((c) => {
                          const active = value.kind === "system" && value.color === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                onChange({
                                  kind: "system",
                                  id: value.kind === "system" ? value.id : "generic",
                                  color: c,
                                })
                              }
                              className={`aspect-square rounded-full transition-transform ${
                                active
                                  ? "ring-2 ring-offset-1 ring-offset-[var(--popover-bg)] ring-fg/70 scale-110"
                                  : "hover:scale-110"
                              }`}
                              style={{ background: c }}
                              aria-label={c}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {filteredBrands.length === 0 ? (
                      <div className="py-6 text-center text-[11.5px] text-fg-muted">
                        No matches.
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1">
                        {filteredBrands.map((b) => {
                          const active = value.kind === "brand" && value.id === b.id;
                          const Icon = b.Icon;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              title={b.label}
                              onClick={() => onChange({ kind: "brand", id: b.id })}
                              className={`aspect-square grid place-items-center rounded-[8px] transition-colors ${
                                active
                                  ? "bg-[var(--neutral-hover-bg)] ring-1 ring-fg/40"
                                  : "hover:bg-[var(--neutral-hover-bg)]"
                              }`}
                            >
                              <Icon width={20} height={20} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 px-2.5 rounded-[7px] text-[11.5px] font-sans transition-colors ${
        active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
