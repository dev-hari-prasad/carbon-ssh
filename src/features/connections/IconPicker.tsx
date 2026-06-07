"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  CommandLineIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  ServerStackIcon,
  WindowIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import type { Connection } from "@/lib/types";
import { BRAND_ICONS } from "./brandIcons";
import { ICONOIR_ICONS } from "./iconoirIcons";
import { Tooltip } from "@/components/Tooltip";

type SystemKind = NonNullable<Connection["iconKind"]>;
const ICON_INITIAL_LIMIT = 45;
const ICON_LOAD_BATCH = 45;

function wrapSystemIcon(
  Icon: typeof ServerStackIcon,
): ComponentType<{ size?: number; weight?: "fill" | "regular" }> {
  return function SystemIcon({ size = 24 }: { size?: number; weight?: "fill" | "regular" }) {
    return <Icon width={size} height={size} />;
  };
}

export const SYSTEM_ICONS: Array<{
  id: SystemKind;
  label: string;
  Icon: ComponentType<{ size?: number; weight?: "fill" | "regular" }>;
}> = [
  { id: "generic", label: "Generic", Icon: wrapSystemIcon(ServerStackIcon) },
  { id: "linux", label: "Linux", Icon: wrapSystemIcon(CommandLineIcon) },
  { id: "debian", label: "Debian", Icon: wrapSystemIcon(CpuChipIcon) },
  { id: "centos", label: "CentOS", Icon: wrapSystemIcon(CubeIcon) },
  { id: "alpine", label: "Alpine", Icon: wrapSystemIcon(PlayIcon) },
  { id: "macos", label: "macOS", Icon: wrapSystemIcon(ComputerDesktopIcon) },
  { id: "windows", label: "Windows", Icon: wrapSystemIcon(WindowIcon) },
];

export type IconValue =
  | { kind: "system"; id: SystemKind; color?: string }
  | { kind: "brand"; id: string }
  | { kind: "iconoir"; id: string };

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
  const [tab, setTab] = useState<"brand" | "iconoir">(value.kind === "brand" ? "brand" : "iconoir");
  const [query, setQuery] = useState("");
  const [iconTargetCount, setIconTargetCount] = useState(ICON_INITIAL_LIMIT);
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const filteredBrands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BRAND_ICONS;
    return BRAND_ICONS.filter((b) => b.id.includes(q) || b.label.toLowerCase().includes(q));
  }, [query]);

  const filteredIconoirIcons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICONOIR_ICONS;
    return ICONOIR_ICONS.filter(
      (item) =>
        item.id.includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.exportName.toLowerCase().includes(q),
    );
  }, [query]);

  const visibleIconoirIcons = useMemo(
    () => filteredIconoirIcons.slice(0, iconTargetCount),
    [filteredIconoirIcons, iconTargetCount],
  );

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
  }, [open, tab, filteredBrands.length, visibleIconoirIcons.length]);

  useEffect(() => {
    if (!open) setReady(false);
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "iconoir") return;
    setIconTargetCount(ICON_INITIAL_LIMIT);
  }, [open, tab, query]);

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

  const loadMoreIcons = () => {
    setIconTargetCount((count) => Math.min(count + ICON_LOAD_BATCH, filteredIconoirIcons.length));
  };

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
                transform: ready ? "scale(1) translateY(0)" : "scale(0.98) translateY(2px)",
                transformOrigin: "top",
                transition: ready
                  ? "opacity 140ms cubic-bezier(0.32, 0.72, 0, 1), transform 140ms cubic-bezier(0.32, 0.72, 0, 1)"
                  : "none",
              }}
              className="w-[280px] max-h-[360px] flex flex-col rounded-md border shadow-2xl overflow-hidden"
            >
              <div className="px-2 pt-2 pb-1.5 flex items-center gap-1 border-b border-border">
                <TabBtn active={tab === "brand"} onClick={() => setTab("brand")}>
                  Brands
                </TabBtn>
                <TabBtn active={tab === "iconoir"} onClick={() => setTab("iconoir")}>
                  Icons
                </TabBtn>
                <div className="flex-1" />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-6 h-6 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--neutral-hover-bg)]"
                >
                  <XMarkIcon className="w-[11px] h-[11px]" strokeWidth={2.5} />
                </button>
              </div>

              <div className="px-2 pt-2 pb-1">
                <div className="flex items-center gap-1.5 px-2 h-7 rounded-sm bg-[var(--input-bg)] border border-border transition-all focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20 group/search">
                  <MagnifyingGlassIcon className="w-[11px] h-[11px] text-fg-muted shrink-0 transition-colors group-focus-within/search:text-accent" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tab === "brand" ? "Search brands…" : "Search icons…"}
                    className="flex-1 min-w-0 bg-transparent text-[11.5px] font-sans text-fg placeholder:text-fg-muted focus:outline-none"
                  />
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto px-2 py-2"
                onScroll={(e) => {
                  if (tab !== "iconoir") return;
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32) {
                    loadMoreIcons();
                  }
                }}
              >
                {tab === "iconoir" ? (
                  <>
                    {filteredIconoirIcons.length === 0 ? (
                      <div className="py-6 text-center text-[11.5px] text-fg-muted">
                        No matches.
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1">
                        {visibleIconoirIcons.map((item) => {
                          const active = value.kind === "iconoir" && value.id === item.id;
                          const Icon = item.Icon;
                          return (
                            <Tooltip
                              key={item.id}
                              label={item.label}
                              side="top"
                              className="aspect-square"
                            >
                              <button
                                type="button"
                                onClick={() => onChange({ kind: "iconoir", id: item.id })}
                                className={`w-full h-full grid place-items-center rounded-sm transition-colors ${
                                  active
                                    ? "bg-[var(--neutral-hover-bg)] ring-1 ring-fg/40"
                                    : "hover:bg-[var(--neutral-hover-bg)]"
                                }`}
                              >
                                <Icon width={20} height={20} />
                              </button>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
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
                            <Tooltip
                              key={b.id}
                              label={b.label}
                              side="top"
                              className="aspect-square"
                            >
                              <button
                                type="button"
                                onClick={() => onChange({ kind: "brand", id: b.id })}
                                className={`w-full h-full grid place-items-center rounded-sm transition-colors ${
                                  active
                                    ? "bg-[var(--neutral-hover-bg)] ring-1 ring-fg/40"
                                    : "hover:bg-[var(--neutral-hover-bg)]"
                                }`}
                              >
                                <Icon width={20} height={20} />
                              </button>
                            </Tooltip>
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
      className={`h-7 px-2.5 rounded-sm text-[11.5px] font-sans transition-colors ${
        active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
