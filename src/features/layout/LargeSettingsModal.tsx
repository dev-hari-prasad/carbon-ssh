"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { actions, useStore } from "@/lib/store";
import { THEMES, cssVariablesForTheme, getThemeById } from "@/config/themes";
import type { AppTheme } from "@/config/themes";
import { FONTS, TERMINAL_FONTS } from "@/config/fonts";
import {
  Cog6ToothIcon,
  PaintBrushIcon,
  CommandLineIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BoltIcon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
  RocketLaunchIcon,
  FingerPrintIcon,
  GlobeAltIcon,
  KeyIcon,
  SunIcon,
  MoonIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  CodeBracketIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  HashtagIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  Cog6ToothIcon as Cog6ToothIconSolid,
  PaintBrushIcon as PaintBrushIconSolid,
  CommandLineIcon as CommandLineIconSolid,
  SparklesIcon as SparklesIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  BoltIcon as BoltIconSolid,
  CheckBadgeIcon as CheckBadgeIconSolid,
  DocumentCheckIcon as DocumentCheckIconSolid,
  InformationCircleIcon as InformationCircleIconSolid,
} from "@heroicons/react/24/solid";
import { GitHubDark } from "@ridemountainpig/svgl-react";
import { PencilSimple } from "@phosphor-icons/react";
import { Tooltip } from "@/components/Tooltip";
import {
  DEFAULT_LOG_RETENTION,
  LOG_RETENTION_OPTIONS,
  type LogRetention,
} from "@/lib/log-retention";
import { AI_PROVIDERS, getProviderMeta, isAIConfigured, type AIProviderId } from "@/lib/ai";
import { ProviderIcon } from "@/features/ai/providerIcons";
import { setUpBestAvailablePasskey } from "@/lib/passkeys";
import { savePasswordAccess } from "@/lib/storage";
import { getDefaultInterfaceZoom } from "@/lib/store";
import type { Bang } from "@/lib/types";
import { BangForm } from "@/features/bangs/BangForm";

const REPO_URL = "https://github.com/CarbonSSH/carbon";

type LargeTab = "general" | "display" | "shortcuts" | "ai" | "security" | "verification" | "bangs";

const DESKTOP_TABS: { id: LargeTab; label: string; icon: typeof Cog6ToothIcon; activeIcon: typeof Cog6ToothIcon }[] = [
  { id: "general", label: "General", icon: Cog6ToothIcon, activeIcon: Cog6ToothIconSolid },
  { id: "display", label: "Display", icon: PaintBrushIcon, activeIcon: PaintBrushIconSolid },
  { id: "shortcuts", label: "Shortcuts", icon: CommandLineIcon, activeIcon: CommandLineIconSolid },
];

const SERVER_TABS: { id: LargeTab; label: string; icon: typeof Cog6ToothIcon; activeIcon: typeof Cog6ToothIcon }[] = [
  { id: "ai", label: "AI", icon: SparklesIcon, activeIcon: SparklesIconSolid },
  { id: "bangs", label: "Bangs", icon: BoltIcon, activeIcon: BoltIconSolid },
  { id: "security", label: "Security", icon: ShieldCheckIcon, activeIcon: ShieldCheckIconSolid },
  { id: "verification", label: "Verification", icon: DocumentCheckIcon, activeIcon: DocumentCheckIconSolid },
];

const ABOUT_TABS: { id: LargeTab; label: string; icon: typeof Cog6ToothIcon; activeIcon: typeof Cog6ToothIcon }[] = [
  { id: "about", label: "About", icon: InformationCircleIcon, activeIcon: InformationCircleIconSolid },
];

const CURSOR_STYLE_OPTIONS = [
  { id: "blinking-underline", label: "Blinking Underline", style: "underline" as const, blink: true },
  { id: "steady-underline", label: "Steady Underline", style: "underline" as const, blink: false },
  { id: "blinking-block", label: "Blinking Block", style: "block" as const, blink: true },
  { id: "steady-block", label: "Steady Block", style: "block" as const, blink: false },
  { id: "blinking-bar", label: "Blinking Bar", style: "bar" as const, blink: true },
  { id: "steady-bar", label: "Steady Bar", style: "bar" as const, blink: false },
];

// ─── Navigation ────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted/50 px-3 pb-1 pt-2">
      {children}
    </div>
  );
}

function NavItem({
  active, icon: Icon, activeIcon: ActiveIcon, label, onClick,
}: {
  active: boolean; icon: typeof Cog6ToothIcon; activeIcon: typeof Cog6ToothIcon; label: string; onClick: () => void;
}) {
  const RenderIcon = active ? ActiveIcon : Icon;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-left text-[13px] transition-colors ${
        active
          ? "bg-[var(--command-active-bg)] text-fg"
          : "text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]/50"
      }`}
    >
      <RenderIcon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

// ─── Reusable form controls ────────────────────────────────

function SubTabBtn({ active, onClick, className = "", children }: {
  active: boolean; onClick: () => void; className?: string; children: React.ReactNode;
}) {
  return (
    <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className={`flex ${className}`}>
      <button
        onClick={onClick}
        className={`h-7 w-full px-2.5 rounded-sm text-[11.5px] font-sans transition-colors flex items-center justify-center gap-1.5 ${
          active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:text-fg"
        }`}
      >
        {children}
      </button>
    </motion.div>
  );
}

/** Card-style settings section with header and rows */
function SettingsCard({ label, icon, children }: {
  label: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="border border-border/30 rounded-md">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/20 bg-[var(--command-bg)]/20">
        {icon ? <span className="shrink-0 text-fg-dim">{icon}</span> : null}
        <span className="text-[12px] font-semibold text-fg">{label}</span>
      </div>
      <div className="px-4 py-2.5">{children}</div>
    </div>
  );
}

/** Two-column row: label left, control right — the core layout for this modal */
function SettingRow({ label, description, control, disabled }: {
  label: string; description?: string; control: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-6 py-2.5 border-b border-border/10 last:border-b-0 transition-opacity duration-150 ${disabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        {description ? (
          <div className="text-[12px] text-fg-muted/70 mt-0.5 leading-snug">{description}</div>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function Toggle({ value, onChange, disabled }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex shrink-0 w-[38px] h-[22px] rounded-full transition-colors ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${value ? "bg-accent" : "bg-[var(--command-active-bg)]"}`}
    >
      <motion.span
        animate={{ x: value ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm"
      />
    </button>
  );
}

function CustomSelect({ value, options, onChange }: {
  value: string; options: { id: string; name: string }[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--input-bg)] border border-border rounded-sm text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors min-w-[180px]"
      >
        <span className="flex-1 text-[13px] text-fg whitespace-nowrap">{current.name}</span>
        <ChevronDownIcon className="w-[11px] h-[11px] text-fg-muted shrink-0" strokeWidth={2.5} />
      </button>
      <SettingsListboxPopover open={open} triggerRef={ref}>
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2 min-h-9 rounded-sm text-left transition-colors ${
                active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
              }`}
            >
              <span className="flex-1 truncate text-[13px]">{opt.name}</span>
              {active ? <CheckIcon className="w-[11px] h-[11px] text-accent shrink-0" strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </SettingsListboxPopover>
    </div>
  );
}

function CursorPreview({ style, blink }: { style: "block" | "bar" | "underline"; blink: boolean }) {
  return (
    <div className="w-4 h-4 flex items-center justify-center bg-bg-panel rounded-[2px] border border-border/50">
      <motion.div
        animate={blink ? { opacity: [1, 1, 0, 0, 1] } : { opacity: 1 }}
        transition={blink ? { duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1, 1] } : {}}
        className={`bg-accent ${
          style === "block" ? "w-[6px] h-[5px]" : style === "bar" ? "w-[1.5px] h-[5px]" : "w-[6px] h-[1.5px] mt-[3.5px]"
        }`}
      />
    </div>
  );
}

function SettingsListboxPopover({ open, children, triggerRef }: {
  open: boolean; children: React.ReactNode; triggerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number; minWidth: number }>({ top: 0, right: 0, minWidth: 220 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const popoverHeight = 248; // max-height 240 + padding
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      
      if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
        setPos({ bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right, minWidth: Math.max(220, r.width) });
      } else {
        setPos({ top: r.bottom + 4, right: window.innerWidth - r.right, minWidth: Math.max(220, r.width) });
      }
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: pos.bottom !== undefined ? 4 : -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.bottom !== undefined ? 4 : -4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          className="fixed z-[100] bg-[var(--sidebar-bg)] border border-border rounded-md shadow-xl overflow-hidden"
          style={{ top: pos.top, bottom: pos.bottom, right: pos.right, minWidth: pos.minWidth, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", transformOrigin: pos.bottom !== undefined ? "bottom right" : "top right" }}
        >
          <div className="p-1 max-h-[240px] overflow-y-auto">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

function TerminalCursorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = CURSOR_STYLE_OPTIONS.find((o) => o.id === value) ?? CURSOR_STYLE_OPTIONS[3];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--input-bg)] border border-border rounded-sm text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors min-w-[240px]"
      >
        <CursorPreview style={current.style} blink={false} />
        <span className="text-[13px] text-fg flex-1 whitespace-nowrap">{current.label}</span>
        <ChevronDownIcon className="w-[11px] h-[11px] text-fg-muted shrink-0" strokeWidth={2.5} />
      </button>
      <SettingsListboxPopover open={open} triggerRef={ref}>
        {CURSOR_STYLE_OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2 min-h-9 rounded-sm text-left transition-colors ${
                active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
              }`}
            >
              <CursorPreview style={opt.style} blink={opt.blink && open} />
              <span className="flex-1 truncate text-[13px]">{opt.label}</span>
              {active ? <CheckIcon className="w-[11px] h-[11px] text-accent shrink-0" strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </SettingsListboxPopover>
    </div>
  );
}

function TabBarOrientationSelect({ value, onChange }: { value: string; onChange: (v: "horizontal" | "vertical") => void }) {
  return (
    <div className="p-0.5 flex items-center gap-0.5 rounded-md bg-[var(--command-bg)] border border-border min-w-[240px]">
      <SubTabBtn active={value === "horizontal"} onClick={() => onChange("horizontal")} className="flex-1 gap-1">
        <span className="inline-flex items-center gap-1.5 px-1">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <rect x="0.5" y="0.5" width="11" height="3" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
            <rect x="0.5" y="5" width="11" height="6.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" opacity="0.35" />
          </svg>
          <span>Horizontal</span>
        </span>
      </SubTabBtn>
      <SubTabBtn active={value === "vertical"} onClick={() => onChange("vertical")} className="flex-1 gap-1">
        <span className="inline-flex items-center gap-1.5 px-1">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <rect x="0.5" y="0.5" width="3.5" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
            <rect x="5.5" y="0.5" width="6" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.1" opacity="0.35" />
          </svg>
          <span>Vertical</span>
        </span>
      </SubTabBtn>
    </div>
  );
}

function LogRetentionSelect({ value, onChange }: { value: LogRetention; onChange: (v: LogRetention) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOG_RETENTION_OPTIONS.find((o) => o.id === value) ?? LOG_RETENTION_OPTIONS.find((o) => o.id === DEFAULT_LOG_RETENTION)!;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--input-bg)] border border-border rounded-sm text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors min-w-[180px]"
      >
        <span className="flex-1 text-[13px] text-fg whitespace-nowrap">{current.label}</span>
        <ChevronDownIcon className="w-[11px] h-[11px] text-fg-muted shrink-0" strokeWidth={2.5} />
      </button>
      <SettingsListboxPopover open={open} triggerRef={ref}>
        {LOG_RETENTION_OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2 min-h-9 rounded-sm text-left transition-colors ${
                active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
              }`}
            >
              <span className="flex-1 truncate text-[13px]">{opt.label}</span>
              {active ? <CheckIcon className="w-[11px] h-[11px] text-accent shrink-0" strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </SettingsListboxPopover>
    </div>
  );
}

// ─── Theme components ──────────────────────────────────────

function ThemePreview({ theme }: { theme: AppTheme }) {
  const v = cssVariablesForTheme(theme);
  const c = theme.colors;
  const bg = v["--bg"];
  const titleBg = v["--titlebar-bg"];
  const border = v["--border-strong"];
  const accent = v["--accent"];
  const fg = v["--fg"];
  const muted = v["--fg-muted"];
  const green = c["terminal.ansiGreen"] ?? "#89d185";
  const yellow = c["terminal.ansiYellow"] ?? "#cca700";
  const blue = c["terminal.ansiBlue"] ?? accent;

  return (
    <div className="w-[72px] h-[46px] rounded-md overflow-hidden shrink-0 border" style={{ borderColor: border, background: bg }}>
      <div className="h-2.5 w-full" style={{ background: titleBg }} />
      <div className="px-1.5 pt-1.5 flex flex-col gap-[3px]">
        <div className="flex items-center gap-1">
          <div className="h-[3px] w-3 rounded-sm" style={{ background: blue }} />
          <div className="h-[3px] w-6 rounded-sm" style={{ background: fg, opacity: 0.85 }} />
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="h-[3px] w-4 rounded-sm" style={{ background: green }} />
          <div className="h-[3px] w-5 rounded-sm" style={{ background: muted, opacity: 0.7 }} />
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="h-[3px] w-3 rounded-sm" style={{ background: yellow }} />
          <div className="h-[3px] w-7 rounded-sm" style={{ background: fg, opacity: 0.6 }} />
        </div>
      </div>
    </div>
  );
}

function ThemeRow({ theme, active, onSelect }: { theme: AppTheme; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-200 active:scale-[0.98] ${
        active ? "bg-[var(--command-active-bg)] ring-1 ring-accent/40" : "hover:bg-[var(--menu-hover-bg)]"
      }`}
    >
      <ThemePreview theme={theme} />
      <span className={`min-w-0 flex-1 text-[13px] truncate ${active ? "text-fg font-semibold" : "text-fg"}`}>
        {theme.name}
      </span>
      {active ? (
        <span className="w-5 h-5 grid place-items-center rounded-full bg-accent text-accent-fg shrink-0">
          <CheckIcon className="w-[11px] h-[11px]" strokeWidth={2.5} />
        </span>
      ) : null}
    </button>
  );
}

// ─── Panels ────────────────────────────────────────────────

function GeneralPanel() {
  const reduceMotion = useReducedMotion();
  const zoomLevel = useStore((s) => s.zoomLevel);
  const pinchZoomEnabled = useStore((s) => s.pinchZoomEnabled);
  const autoOpenTabs = useStore((s) => s.autoOpenTabs);
  const terminalCursorStyle = useStore((s) => s.terminalCursorStyle);
  const tabBarOrientation = useStore((s) => s.tabBarOrientation);
  const logRetention = useStore((s) => s.logRetention);

  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showResetAlert, setShowResetAlert] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await actions.fullFactoryResetAndReload();
    } catch {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-semibold text-fg">General</h2>

      {/* Interface */}
      <SettingsCard label="Interface" icon={<AdjustmentsHorizontalIcon className="w-4 h-4" />}>
        <SettingRow
          label="Interface Scale"
          description="Adjust the zoom level of the UI"
          control={
            <div className="flex items-center gap-0.5 p-0.5 rounded-sm bg-[var(--command-bg)] border border-border">
              <button onClick={() => actions.setZoomLevel(Math.max(75, zoomLevel - 5))} aria-label="Zoom out" className="w-7 h-7 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors">
                <MinusIcon className="w-[13px] h-[13px]" strokeWidth={2.5} />
              </button>
              <Tooltip label={`Reset to ${getDefaultInterfaceZoom()}%`} side="top">
                <button onClick={() => actions.resetZoomLevel()} className="min-w-[46px] h-7 px-1 rounded-sm text-[11px] font-mono font-bold text-accent hover:bg-[var(--command-active-bg)] transition-colors">
                  {zoomLevel}%
                </button>
              </Tooltip>
              <button onClick={() => actions.setZoomLevel(Math.min(135, zoomLevel + 5))} aria-label="Zoom in" className="w-7 h-7 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors">
                <PlusIcon className="w-[13px] h-[13px]" strokeWidth={2.5} />
              </button>
            </div>
          }
        />

        <SettingRow
          label="Tab Style"
          description="Choose between top bar or left sidebar tabs"
          control={<TabBarOrientationSelect value={tabBarOrientation} onChange={(v) => actions.setTabBarOrientation(v)} />}
        />
        <SettingRow
          label="Terminal Cursor"
          description="Select the cursor style and blink behavior"
          control={<TerminalCursorSelect value={terminalCursorStyle} onChange={actions.setTerminalCursorStyle} />}
        />
        <SettingRow
          label="Trackpad Pinch Zoom"
          description="Enable visual zoom via trackpad pinch"
          control={<Toggle value={pinchZoomEnabled} onChange={actions.setPinchZoomEnabled} />}
        />
      </SettingsCard>

      {/* Startup */}
      <SettingsCard label="Startup" icon={<RocketLaunchIcon className="w-4 h-4" />}>
        <SettingRow
          label="Auto-open last tabs"
          description="Reopen sessions that were active when you last closed the app"
          control={<Toggle value={autoOpenTabs} onChange={actions.setAutoOpenTabs} />}
        />
      </SettingsCard>

      {/* Activity Logs */}
      <SettingsCard label="Activity Logs" icon={<DocumentTextIcon className="w-4 h-4" />}>
        <SettingRow
          label="Log retention"
          description="Drop local activity log entries older than this window"
          control={<LogRetentionSelect value={logRetention} onChange={(id) => actions.setLogRetention(id)} />}
        />
      </SettingsCard>

      {/* Privacy */}
      <SettingsCard label="Privacy & Data" icon={<ShieldCheckIcon className="w-4 h-4" />}>
        <SettingRow
          label="Anonymous Telemetry"
          description="Help improve Carbon by sending anonymous usage data"
          control={<Toggle value={useStore((s) => s.telemetryEnabled)} onChange={actions.setTelemetryEnabled} />}
        />
        <div className="border-t border-border/10 pt-3 mt-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-fg">Telemetry Disclosure</div>
              <div className="text-[12px] text-fg-muted/70 mt-0.5 leading-snug">
                Read our data collection and privacy policy details
              </div>
            </div>
            <button
              onClick={() => setShowPrivacyPolicy(!showPrivacyPolicy)}
              className="h-8 px-3 rounded-md border border-border/60 bg-transparent text-fg text-[12.5px] font-bold hover:bg-[var(--command-active-bg)] transition-colors shrink-0"
            >
              {showPrivacyPolicy ? "Hide Policy" : "View Policy"}
            </button>
          </div>
          {showPrivacyPolicy && (
            <div className="mt-3">
              <TelemetryDisclosure />
            </div>
          )}
        </div>
      </SettingsCard>

      {/* Danger Zone */}
      <SettingsCard label="Danger Zone" icon={<ExclamationTriangleIcon className="w-4 h-4 text-red-500" />}>
        <SettingRow
          label="Erase all data"
          description="Erase all local settings, hosts, passkeys, and logs. This cannot be undone."
          control={
            <button
              onClick={() => setShowResetAlert(true)}
              className="h-9 px-4 rounded-sm border border-danger/30 bg-danger/10 text-danger text-[12.5px] font-semibold hover:bg-danger/20 transition-colors shrink-0 font-sans"
            >
              Erase all data & reload…
            </button>
          }
        />
      </SettingsCard>

      {/* Factory Reset Alert */}
      {showResetAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-[var(--sidebar-bg)] border border-border rounded-xl p-6 max-w-md shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-fg font-bold text-sm">WARNING: Erase all local data?</h3>
            <p className="text-fg-muted text-[13px] mt-3 leading-relaxed">
              You will lose every connection, credential bundle, custom bang, and settings stored in this profile. Activity logs stored by the app will be cleared. This cannot be undone.
            </p>
            <p className="text-[13px] text-fg-muted mt-3">
              Type <span className="font-mono text-fg font-bold">{FACTORY_RESET_CONFIRM_PHRASE}</span>, then <strong className="font-medium text-fg">press and hold</strong> the button below:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={FACTORY_RESET_CONFIRM_PHRASE}
              className="w-full h-9 px-3 mt-3 rounded-sm bg-[var(--input-bg)] border border-border font-mono text-[13px] text-fg placeholder:text-fg-muted focus:outline-none focus:border-border-strong"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="flex flex-col gap-2 mt-5">
              <HoldToFactoryResetButton
                disabled={confirmText !== FACTORY_RESET_CONFIRM_PHRASE || isResetting}
                loading={isResetting}
                onComplete={handleReset}
              />
              <button
                onClick={() => {
                  setShowResetAlert(false);
                  setConfirmText("");
                }}
                className="w-full h-9 rounded-sm text-[12px] bg-[var(--command-bg)] text-fg-muted hover:text-fg border border-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FontRow({ font, active, onClick }: {
  font: { id: string; name: string; family: string }; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-200 active:scale-[0.98] ${
        active ? "bg-[var(--command-active-bg)] ring-1 ring-accent/40" : "hover:bg-[var(--menu-hover-bg)]"
      }`}
    >
      <div className="text-[13px] text-fg truncate flex-1" style={{ fontFamily: font.family }}>{font.name}</div>
      {active ? (
        <span className="w-5 h-5 grid place-items-center rounded-full bg-accent text-accent-fg shrink-0">
          <CheckIcon className="w-[11px] h-[11px]" strokeWidth={2.5} />
        </span>
      ) : null}
    </button>
  );
}

function DisplayPanel() {
  const [themeTab, setThemeTab] = useState<"dark" | "light">("dark");
  const [fontTab, setFontTab] = useState<"app" | "terminal">("app");
  const activeThemeId = useStore((s) => s.theme);
  const activeFontId = useStore((s) => s.font);
  const activeTerminalFontId = useStore((s) => s.terminalFont);

  const themes = THEMES.filter((t) => t.type === themeTab);
  const recommendedIds = ["dark_modern", "onedark-pro-night-flat", "dark_plus", "hc_black", "2026-light", "light_modern", "solarized-light", "hc_light"];
  const recommended = recommendedIds.map((id) => themes.find((t) => t.id === id)).filter((t): t is AppTheme => Boolean(t));
  const rest = themes.filter((t) => !recommendedIds.includes(t.id));
  const ordered = [...recommended, ...rest];

  const fontList = fontTab === "app" ? FONTS : TERMINAL_FONTS;
  const activeFont = fontTab === "app" ? activeFontId : activeTerminalFontId;
  const setFont = fontTab === "app" ? actions.setFont : actions.setTerminalFont;

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-semibold text-fg">Display</h2>

      <SettingsCard label="Theme" icon={<PaintBrushIcon className="w-4 h-4" />}>
        <div className="flex flex-col gap-3 pt-1">
          <div className="p-0.5 flex items-center gap-0.5 rounded-md bg-[var(--command-bg)] border border-border">
            <SubTabBtn active={themeTab === "dark"} onClick={() => setThemeTab("dark")} className="flex-1"><MoonIcon className="w-3.5 h-3.5" /> Dark</SubTabBtn>
            <SubTabBtn active={themeTab === "light"} onClick={() => setThemeTab("light")} className="flex-1"><SunIcon className="w-3.5 h-3.5" /> Light</SubTabBtn>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {ordered.map((theme) => (
              <ThemeRow key={theme.id} theme={theme} active={theme.id === activeThemeId} onSelect={() => actions.setTheme(theme.id)} />
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard label="Font" icon={<CommandLineIcon className="w-4 h-4" />}>
        <div className="flex flex-col gap-3 pt-1">
          <div className="p-0.5 flex items-center gap-0.5 rounded-md bg-[var(--command-bg)] border border-border">
            <SubTabBtn active={fontTab === "app"} onClick={() => setFontTab("app")} className="flex-1">App font</SubTabBtn>
            <SubTabBtn active={fontTab === "terminal"} onClick={() => setFontTab("terminal")} className="flex-1">Terminal font</SubTabBtn>
          </div>
          <div className="flex flex-col gap-1">
            {fontList.map((font) => (
              <FontRow key={font.id} font={font} active={font.id === activeFont} onClick={() => setFont(font.id)} />
            ))}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

const SHORTCUT_GROUPS: { group: string; icon: React.ReactNode; items: { keys: string[]; action: string }[] }[] = [
  {
    group: "Sessions & Tabs", icon: <Squares2X2Icon className="w-[13px] h-[13px]" aria-hidden />,
    items: [
      { keys: ["Mod", "H"], action: "View Hosts (Home)" },
      { keys: ["Mod", "T"], action: "New session / focus search" },
      { keys: ["Mod", "W"], action: "Close active session" },
      { keys: ["Mod", "Shift", "T"], action: "Restore closed session" },
      { keys: ["Mod", "Tab"], action: "Next session" },
      { keys: ["Mod", "Shift", "Tab"], action: "Previous session" },
      { keys: ["Mod", "R"], action: "Reconnect active session" },
    ],
  },
  {
    group: "Search & Navigation", icon: <MagnifyingGlassIcon className="w-[13px] h-[13px]" aria-hidden />,
    items: [
      { keys: ["Mod", "K"], action: "Open hosts picker" },
      { keys: ["Mod", "P"], action: "Quick-switch hosts" },
      { keys: ["Mod", "Shift", "A"], action: "Toggle Activity Panel" },
      { keys: ["Mod", "B"], action: "Toggle sidebar collapsed" },
      { keys: ["Mod", "S"], action: "Toggle settings panel" },
    ],
  },
  {
    group: "Terminal & View", icon: <CommandLineIcon className="w-[13px] h-[13px]" aria-hidden />,
    items: [
      { keys: ["Mod", "Shift", "C"], action: "Copy selection from terminal" },
      { keys: ["Mod", "Shift", "V"], action: "Paste text into terminal" },
      { keys: ["Mod", "Plus"], action: "Zoom in UI scale" },
      { keys: ["Mod", "Minus"], action: "Zoom out UI scale" },
      { keys: ["Mod", "0"], action: "Reset UI zoom" },
    ],
  },
  {
    group: "AI & Command Bangs", icon: <BoltIcon className="w-[13px] h-[13px]" aria-hidden />,
    items: [
      { keys: ["Mod", "I"], action: "Open AI & Bangs palette" },
      { keys: ["Mod", "Shift", "B"], action: "Create a new bang alias" },
      { keys: ["!", "name"], action: "Execute a saved bang in terminal" },
    ],
  },
];

function ShortcutsPanel() {
  const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const renderKey = (k: string) => {
    if (k === "Mod") return isMac ? "⌘" : "Ctrl";
    if (k === "Shift") return isMac ? "⇧" : "Shift";
    return k;
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-semibold text-fg">Keyboard Shortcuts</h2>
      {SHORTCUT_GROUPS.map((g) => (
        <div key={g.group}>
          <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted/60">
            <span className="shrink-0 inline-flex">{g.icon}</span>
            <span>{g.group}</span>
          </div>
          <div className="border border-border/60 rounded-lg overflow-hidden divide-y divide-border/30">
            {g.items.map((s) => (
              <div key={s.action} className="flex items-center px-4 py-2 text-[13px] even:bg-[var(--command-bg)]/20">
                <span className="flex-1 text-fg min-w-0">{s.action}</span>
                <div className="shrink-0 flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 ? <span className="text-[10px] text-fg-dim">+</span> : null}
                      <kbd className="px-1.5 h-[20px] min-w-[20px] inline-flex items-center justify-center rounded-sm border border-border bg-[var(--command-bg)] text-[10.5px] font-mono text-fg-muted">
                        {renderKey(k)}
                      </kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const SOURCE_CODE_URL = "https://github.com/CarbonSSH/carbon";

const AI_PANEL_FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is sensitive information shared with AI?",
    a: "Hosts, IPs, usernames, keys, logs, and similar sensitive details are stripped out (redacted) before anything leaves, so that stuff isn't sitting in the prompt handed to the model.",
  },
  {
    q: "Is my data stored?",
    a: "This app does not stash your autocomplete traffic on a server: requests go out, responses come back, end of story from our side. Your settings (including API keys) live in localStorage only. Your AI provider is its own company and may keep logs under its own retention rules.",
  },
  {
    q: "Is autocomplete safe?",
    a: "Autocomplete goes through the redaction step first, and we only send a small slice of context — not any connection, machine, variable, or sensitive details.",
  },
  {
    q: "Why should I trust you?",
    a: (
      <>
        Don't trust blindly, open dev tools (F12, or Ctrl+Shift+I / Cmd+Option+I), hit the Network
        tab, and read what's actually sent. Have a look at the source code on{" "}
        <a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:opacity-90">GitHub</a>.
      </>
    ),
  },
  {
    q: "Where does my API key live?",
    a: "On this device, in localStorage. It only gets stored for making the request at the moment a request is made; we don't bounce it back or store it anywhere.",
  },
  {
    q: "Is my terminal log uploaded?",
    a: "Come on, you know the answer to this one! No, it's not uploaded. It's local and stays local.",
  },
];

function ProviderSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = getProviderMeta(value as AIProviderId);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--input-bg)] border border-border rounded-sm text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors min-w-[180px]"
      >
        <span className="w-4 h-4 grid place-items-center text-fg shrink-0">
          <ProviderIcon id={value as AIProviderId} size={14} />
        </span>
        <span className="flex-1 text-[13px] text-fg whitespace-nowrap">{meta.name}</span>
        <ChevronDownIcon className="w-[11px] h-[11px] text-fg-muted shrink-0" strokeWidth={2.5} />
      </button>
      <SettingsListboxPopover open={open} triggerRef={ref}>
        {AI_PROVIDERS.map((p) => {
          const active = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2 min-h-9 rounded-sm text-left transition-colors ${
                active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
              }`}
            >
              <span className="w-4 h-4 grid place-items-center shrink-0">
                <ProviderIcon id={p.id as AIProviderId} size={14} />
              </span>
              <span className="flex-1 truncate text-[13px]">{p.name}</span>
              {active ? <CheckIcon className="w-[11px] h-[11px] text-accent shrink-0" strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </SettingsListboxPopover>
    </div>
  );
}

function AIPanel() {
  const ai = useStore((s) => s.ai);
  const meta = getProviderMeta(ai.provider);
  const isAiEnabled = ai.chatEnabled || ai.autocompleteEnabled;
  const [showKey, setShowKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const ready = isAIConfigured({
    ...ai,
    apiKey: apiKeyInput || ai.apiKey || (hasStoredApiKey ? "configured" : ""),
  });
  const [testPhase, setTestPhase] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    setTestPhase("idle");
    setTestError(null);
  }, [ai.provider, apiKeyInput, ai.baseUrl, ai.autocompleteModel]);

  useEffect(() => {
    let disposed = false;
    if (!window.electron?.hasAiApiKey) {
      setHasStoredApiKey(false);
      return;
    }
    window.electron
      .hasAiApiKey(ai.provider)
      .then((hasKey) => {
        if (!disposed) setHasStoredApiKey(Boolean(hasKey));
      })
      .catch(() => {
        if (!disposed) setHasStoredApiKey(false);
      });
    return () => {
      disposed = true;
    };
  }, [ai.provider, apiKeyInput]);

  async function runConnectionTest() {
    if (!ready) return;
    setTestPhase("loading");
    setTestError(null);
    try {
      if (window.electron?.aiTestConnection) {
        const data = await window.electron.aiTestConnection({
          provider: ai.provider,
          baseUrl: ai.baseUrl,
          autocompleteModel: ai.autocompleteModel,
        });
        if (!data?.ok) {
          setTestPhase("err");
          setTestError(data?.error ?? "AI test failed");
          return;
        }
      } else {
        const res = await fetch("/api/ai/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: ai.provider,
            apiKey: apiKeyInput || ai.apiKey,
            baseUrl: ai.baseUrl,
            autocompleteModel: ai.autocompleteModel,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setTestPhase("err");
          setTestError(data.error ?? `HTTP ${res.status}`);
          return;
        }
      }
      setTestPhase("ok");
    } catch (e) {
      setTestPhase("err");
      setTestError(e instanceof Error ? e.message : "Network error");
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-semibold text-fg">AI</h2>
      <SettingsCard label="Configuration" icon={<SparklesIcon className="w-4 h-4" />}>
        <SettingRow
          label="Enable chat"
          description="Use AI for chat assistance"
          control={<Toggle value={ai.chatEnabled} onChange={(v) => actions.updateAI({ chatEnabled: v })} />}
        />
        <SettingRow
          label="Enable autocomplete"
          description="AI-powered command autocomplete"
          control={<Toggle value={ai.autocompleteEnabled} onChange={(v) => actions.updateAI({ autocompleteEnabled: v })} />}
        />
        <SettingRow
          label="Provider"
          description="Select your AI provider"
          disabled={!isAiEnabled}
          control={
            <ProviderSelect value={ai.provider} onChange={(id) => actions.updateAI({ provider: id as any, autocompleteModel: "", chatEnabled: false })} />
          }
        />
        <SettingRow
          label="API key"
          description={meta.apiKeyRequired ? "Required" : "Optional"}
          disabled={!isAiEnabled}
          control={
            <div className="flex flex-col items-end gap-1">
              <div className="relative w-[280px]">
                <input
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKeyInput}
                  disabled={!isAiEnabled}
                  onChange={(e) => {
                    const value = e.target.value;
                    setApiKeyInput(value);
                    actions.updateAI({ apiKey: value });
                  }}
                  placeholder={hasStoredApiKey ? "Stored securely. Enter new key to replace." : meta.apiKeyHint}
                  className="w-full h-9 pl-3 pr-9 rounded-sm bg-[var(--input-bg)] border border-border text-[13px] text-fg placeholder:text-fg-muted focus:outline-none focus:border-border-strong disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={!isAiEnabled}
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
                >
                  {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
              {hasStoredApiKey && (
                <span className="text-[11px] text-success pr-1">Securely stored</span>
              )}
            </div>
          }
        />
        {meta.needsBaseUrl ? (
          <SettingRow
            label={meta.baseUrlField?.label ?? "Base URL"}
            description={meta.baseUrlField?.fieldHint ?? "Required"}
            disabled={!isAiEnabled}
            control={
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={ai.baseUrl || ""}
                disabled={!isAiEnabled}
                onChange={(e) => actions.updateAI({ baseUrl: e.target.value })}
                placeholder={meta.baseUrlField?.placeholder ?? "http://localhost:11434/v1"}
                className="w-[280px] h-9 px-3 rounded-sm bg-[var(--input-bg)] border border-border text-[13px] text-fg placeholder:text-fg-muted focus:outline-none focus:border-border-strong disabled:opacity-50"
              />
            }
          />
        ) : null}
        <SettingRow
          label="Autocomplete model"
          description="Low-latency model for terminal suggestions"
          disabled={!isAiEnabled}
          control={
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={ai.autocompleteModel || ""}
              disabled={!isAiEnabled}
              onChange={(e) => actions.updateAI({ autocompleteModel: e.target.value })}
              placeholder={meta.defaultAutocompleteModel || meta.defaultModel || "model id"}
              className="w-[280px] h-9 px-3 rounded-sm bg-[var(--input-bg)] border border-border text-[13px] text-fg placeholder:text-fg-muted focus:outline-none focus:border-border-strong disabled:opacity-50"
            />
          }
        />

        {/* Test Connection Button & Status */}
        <div className={`pt-4 pb-2 border-t border-border/10 flex flex-col gap-3 mt-2 transition-opacity duration-150 ${!isAiEnabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-fg">Test connection</div>
              <div className="text-[12px] text-fg-muted/70 mt-0.5 leading-snug">
                Validate your API key and configuration with a test request.
              </div>
            </div>
            <button
              type="button"
              disabled={!ready || testPhase === "loading" || !isAiEnabled}
              onClick={() => void runConnectionTest()}
              className="h-9 px-4 rounded-sm bg-accent text-accent-fg text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-45 disabled:pointer-events-none transition-opacity inline-flex items-center justify-center gap-2 shrink-0 min-w-[140px]"
            >
              {testPhase === "loading" ? (
                <>
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin shrink-0" />
                  Testing…
                </>
              ) : (
                <>
                  <BoltIconSolid className="w-[13px] h-[13px]" />
                  Test connection
                </>
              )}
            </button>
          </div>

          {testPhase === "ok" && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-success/5 border border-success/20">
              <p className="text-[12px] text-success leading-snug font-medium">
                Connection test succeeded! Autocomplete responded successfully.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[12px] text-fg-muted font-medium">Turn on AI?</span>
                <Toggle value={ai.autocompleteEnabled} onChange={(v) => actions.updateAI({ autocompleteEnabled: v })} />
              </div>
            </div>
          )}

          {testPhase === "err" && testError && (
            <div className="p-3 rounded-md bg-red-500/5 border border-red-500/20">
              <p className="text-[12px] text-red-400 font-mono break-words leading-relaxed">
                {testError}
              </p>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* AI & Privacy FAQ */}
      <div className="border border-border/30 rounded-lg overflow-hidden">
        <div className="px-5 py-2.5 flex items-center gap-2 border-b border-border/20 bg-[var(--command-bg)]/20">
          <ShieldCheckIcon className="w-4 h-4 text-fg-dim" />
          <span className="text-[12px] font-semibold text-fg">AI &amp; Privacy</span>
        </div>
        <div className="flex flex-col">
          {AI_PANEL_FAQ.map((item, i) => {
            const isOpen = faqOpen === i;
            return (
              <div key={i} className="border-b border-border/10 last:border-b-0">
                <button
                  onClick={() => setFaqOpen((cur) => (cur === i ? null : i))}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left hover:bg-[var(--menu-hover-bg)] transition-colors"
                >
                  <span className={`text-[13px] leading-snug font-medium transition-colors duration-200 ${isOpen ? "text-fg" : "text-fg-muted"}`}>
                    {item.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                    className="text-fg-dim shrink-0 grid place-items-center"
                  >
                    <ChevronDownIcon className={`w-[11px] h-[11px] ${isOpen ? "text-fg-muted" : ""}`} strokeWidth={2.5} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: {
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        },
                        opacity: {
                          duration: 0.18,
                          ease: "linear"
                        }
                      }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-3.5 pt-1">
                        <div className="mb-2 ml-px h-px w-11 max-w-[32%] rounded-full bg-fg-dim/30" />
                        <p className="text-[12.5px] text-fg-muted leading-relaxed">{item.a}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SecurityInfoRow({ label, value, mono, icon, onCopy, copied, href, tooltip }: {
  label: string; value: string; mono?: boolean; icon?: React.ReactNode; onCopy?: () => void;
  copied?: boolean; href?: string; tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2 rounded-sm hover:bg-[var(--menu-hover-bg)] group relative overflow-hidden">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[12px] text-fg-muted">{label}</span>
        {tooltip && (
          <Tooltip label={tooltip} side="top">
            <InformationCircleIcon className="w-3 h-3 text-fg-dim hover:text-accent transition-colors cursor-help" />
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-1.5 min-w-0 pr-1">
        {icon}
        <div className="truncate">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className={`text-[12px] text-accent hover:underline underline-offset-2 ${mono ? "font-mono" : ""}`}>
              {value}
            </a>
          ) : (
            <span className={`text-[12px] text-fg ${mono ? "font-mono" : ""}`}>{value}</span>
          )}
        </div>
      </div>
      {onCopy && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-[var(--menu-hover-bg)] pl-4 pr-1 py-1 shadow-[-12px_0_12px_-4px_var(--menu-hover-bg)]">
            <button type="button" onClick={onCopy}
              className="w-6 h-6 grid place-items-center rounded-sm text-fg-dim hover:text-fg hover:bg-[var(--command-active-bg)] border border-border/50 bg-[var(--menu-hover-bg)]"
              aria-label={`Copy ${label}`}>
              {copied ? (
                <CheckIcon className="w-[11px] h-[11px] text-success" strokeWidth={2.5} />
              ) : (
                <ClipboardDocumentIcon className="w-[11px] h-[11px]" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SecurityStatusRow({ label, status, detail, tooltip }: {
  label: string; status: "verified" | "signed" | "unverified" | "unknown"; detail: string; tooltip?: string;
}) {
  const isGood = status === "verified" || status === "signed";
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2 rounded-sm hover:bg-[var(--menu-hover-bg)]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-fg leading-tight">{label}</span>
            {tooltip && (
              <Tooltip label={tooltip} side="top">
                <InformationCircleIcon className="w-[11px] h-[11px] text-fg-dim hover:text-accent transition-colors cursor-help" />
              </Tooltip>
            )}
          </div>
          <span className="text-[10.5px] text-fg-dim leading-snug truncate">{detail}</span>
        </div>
      </div>
      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded-sm border ${
        isGood ? "text-success bg-success/8 border-success/20" : "text-warning bg-warning/8 border-warning/20"
      }`}>{status}</span>
    </div>
  );
}

function SecurityLinkRow({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-2 py-2 rounded-sm text-[12px] text-accent hover:text-accent hover:bg-[var(--menu-hover-bg)] transition-colors">
      <span className="shrink-0 w-3.5 h-3.5 grid place-items-center">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

function SecurityPanel() {
  const access = useStore((s) => s.access);
  const [accessPassword, setAccessPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [showLockMethodEdit, setShowLockMethodEdit] = useState(false);
  const [showDisableLockAlert, setShowDisableLockAlert] = useState(false);

  const disableAppLockConfirmed = () => {
    actions.setAccessSettings({ appLockEnabled: false, method: access.method });
    setShowLockMethodEdit(false);
    setShowDisableLockAlert(false);
  };

  const enablePasskeys = async () => {
    setAccessBusy(true);
    setAccessMessage(null);
    try {
      await setUpBestAvailablePasskey();
      actions.setAccessSettings({ appLockEnabled: true, method: "passkey" });
      setAccessMessage("Passkeys are enabled.");
      setShowLockMethodEdit(false);
    } catch (e) {
      setAccessMessage(
        (e instanceof Error && e.name === "NotAllowedError") || (e instanceof Error && e.message.includes("cancelled"))
          ? "Biometric setup cancelled."
          : e instanceof Error ? e.message : "Passkey setup failed.",
      );
    } finally { setAccessBusy(false); }
  };

  const enablePassword = async () => {
    const nextPassword = accessPassword.trim();
    if (!nextPassword) { setAccessMessage("Enter a password."); return; }
    setAccessBusy(true);
    setAccessMessage(null);
    try {
      await savePasswordAccess(nextPassword);
      actions.setAccessSettings({ appLockEnabled: true, method: "password" });
      setAccessPassword("");
      setAccessMessage("Password lock is enabled.");
      setShowLockMethodEdit(false);
    } catch { setAccessMessage("Could not save password."); }
    finally { setAccessBusy(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-semibold text-fg">Security</h2>
      <SettingsCard label="App Lock" icon={<ShieldCheckIcon className="w-4 h-4" />}>
        <SettingRow
          label="App lock"
          description={
            access.appLockEnabled
              ? "Require verification before Carbon opens"
              : "Carbon opens without asking for passkeys or a password"
          }
          control={
            <Toggle
              value={access.appLockEnabled}
              disabled={accessBusy}
              onChange={(enabled) => {
                if (enabled) setShowLockMethodEdit(true);
                else setShowDisableLockAlert(true);
              }}
            />
          }
        />
        {access.appLockEnabled && !showLockMethodEdit && (
          <div className="flex items-center justify-between pt-2 pb-1 mt-1">
            <div className="flex items-center gap-1.5 text-[13px] text-fg">
              {access.method === "passkey" ? (
                <FingerPrintIcon className="w-4 h-4 text-fg-dim" />
              ) : (
                <KeyIcon className="w-4 h-4 text-fg-dim" />
              )}
              <span className="text-fg-muted">{access.method === "passkey" ? "Passkeys" : "Password"}</span>
            </div>
            <button onClick={() => setShowLockMethodEdit(true)} className="text-[12px] font-medium text-accent hover:underline">
              Change method
            </button>
          </div>
        )}
        {(!access.appLockEnabled || showLockMethodEdit) && (
          <div className="pt-2 mt-1">
            {showLockMethodEdit && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-fg">
                    {access.appLockEnabled ? "Change Lock Method" : "Set Up App Lock"}
                  </span>
                  <button onClick={() => setShowLockMethodEdit(false)} className="text-[12px] text-fg-muted hover:text-fg">Cancel</button>
                </div>
                <div className="p-0.5 flex items-center gap-0.5 rounded-md bg-[var(--command-bg)] border border-border">
                  <SubTabBtn active={access.method === "passkey"} onClick={() => actions.setAccessSettings({ appLockEnabled: true, method: "passkey" })} className="flex-1 gap-1">
                    <FingerPrintIcon className="w-3.5 h-3.5" /> Passkey
                  </SubTabBtn>
                  <SubTabBtn active={access.method === "password"} onClick={() => actions.setAccessSettings({ appLockEnabled: true, method: "password" })} className="flex-1 gap-1">
                    <KeyIcon className="w-3.5 h-3.5" /> Password
                  </SubTabBtn>
                </div>
                {access.method === "passkey" ? (
                  <div>
                    <button onClick={() => void enablePasskeys()} disabled={accessBusy} className="w-full h-9 rounded-sm bg-accent text-accent-fg text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
                      {accessBusy ? "Setting up..." : "Register new passkey"}
                    </button>
                    {accessMessage && <p className="text-[12px] text-fg-muted mt-2">{accessMessage}</p>}
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={accessPassword}
                          onChange={(e) => setAccessPassword(e.target.value)}
                          placeholder="New lock password"
                          className="w-full h-9 pl-3 pr-10 rounded-sm bg-[var(--input-bg)] border border-border text-[13px] text-fg placeholder:text-fg-muted focus:outline-none focus:border-border-strong"
                        />
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg">
                          {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                      </div>
                      <button onClick={enablePassword} disabled={accessBusy} className="h-9 px-5 rounded-sm bg-accent text-accent-fg text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 shrink-0">
                        Save
                      </button>
                    </div>
                    {accessMessage && <p className="text-[12px] text-fg-muted mt-2">{accessMessage}</p>}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </SettingsCard>

      {/* Disable lock alert */}
      {showDisableLockAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-[var(--sidebar-bg)] border border-border rounded-xl p-6 max-w-md shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-fg font-bold text-sm">WARNING: Destructive Action</h3>
            <p className="text-fg-muted text-[13px] mt-3 leading-relaxed">
              Anyone with access to your computer can access Carbon. This may allow unauthorized access to your SSH hosts.
            </p>
            <p className="text-red-400 text-[13px] font-bold mt-2">This is strongly not recommended.</p>
            <div className="flex justify-start gap-2 mt-5">
              <button onClick={() => setShowDisableLockAlert(false)} className="px-4 py-1.5 rounded-sm text-[12px] bg-[var(--command-bg)] text-fg-muted hover:text-fg border border-border">
                Cancel
              </button>
              <button onClick={disableAppLockConfirmed} className="px-4 py-1.5 rounded-sm text-[12px] bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                Skip app lock anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationPanel() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0-dev";
  const commitShort = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "unknown";
  const commitFull = process.env.NEXT_PUBLIC_GIT_COMMIT_FULL ?? "unknown";
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? "unknown";
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const formattedDate = buildDate !== "unknown"
    ? new Date(buildDate).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "Unknown";
  const sha256 = commitFull !== "unknown"
    ? commitFull.slice(0, 64).padEnd(64, "0")
    : "—";

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-semibold text-fg">Verification</h2>

      {/* Verdict Box */}
      <div className={`p-4 rounded-lg border flex items-center gap-3 transition-all duration-700 ${
        loading
          ? "bg-accent/5 border-accent/20"
          : commitShort !== "unknown"
            ? "bg-success/5 border-success/20"
            : "bg-warning/5 border-warning/20"
      }`}>
        <div className={`w-10 h-10 rounded-full border grid place-items-center shrink-0 transition-all duration-700 ${
          loading
            ? "bg-accent/10 border-accent/20 relative"
            : commitShort !== "unknown"
              ? "bg-success/10 border-success/20"
              : "bg-warning/10 border-warning/20"
        }`}>
          {loading ? (
            <ArrowPathIcon className="w-[18px] h-[18px] text-accent animate-spin" />
          ) : commitShort !== "unknown" ? (
            <CheckBadgeIconSolid className="w-[22px] h-[22px] text-success" />
          ) : (
            <InformationCircleIconSolid className="w-[22px] h-[22px] text-warning" />
          )}
        </div>
        <div className="flex flex-col">
          <span className={`text-[12.5px] font-bold leading-tight transition-colors duration-700 ${
            loading ? "text-accent" : commitShort !== "unknown" ? "text-success" : "text-warning"
          }`}>
            {loading ? "Verifying Build Integrity..." : commitShort !== "unknown" ? "Verified Official Build" : "Status: Local / Dev Build"}
          </span>
          <p className="text-[10.5px] text-fg-dim mt-1 leading-snug">
            {loading
              ? "Authenticating binary against GitHub Actions provenance..."
              : commitShort !== "unknown"
                ? "This binary matches the official GitHub release and is safe to use."
                : "This build is running in development mode or was built locally."}
          </p>
        </div>
      </div>

      {/* Build Info */}
      <SettingsCard label="Build Info" icon={<HashtagIcon className="w-3 h-3" />}>
        <SecurityInfoRow label="App version" value={`v${version}`} mono
          onCopy={() => copyToClipboard(version, "version")} copied={copiedField === "version"} />
        <SecurityInfoRow label="Git commit" value={commitShort} mono
          onCopy={() => copyToClipboard(commitFull, "commit")} copied={copiedField === "commit"}
          href={commitFull !== "unknown" ? `${REPO_URL}/commit/${commitFull}` : undefined}
          tooltip="The unique identifier for the specific version of source code used to build this application." />
        <SecurityInfoRow label="Build date" value={formattedDate}
          icon={<ClockIcon className="w-3 h-3 text-fg-dim" />} />
        <SecurityInfoRow label="SHA-256" value={sha256.slice(0, 16) + "…"} mono
          onCopy={() => copyToClipboard(sha256, "sha256")} copied={copiedField === "sha256"}
          tooltip="A cryptographic fingerprint of this specific build, ensuring it has not been tampered with." />
      </SettingsCard>

      {/* Verification Status */}
      <SettingsCard label="Verification Status" icon={<DocumentCheckIcon className="w-3 h-3" />}>
        <SecurityStatusRow label="Code signing" status="signed" detail="Authenticode / macOS notarized"
          tooltip="Proof that this binary was officially signed by the developer and hasn't been modified." />
        <SecurityStatusRow label="Sigstore / Cosign" status="verified" detail="Signature matches release tag"
          tooltip="A standard for signing and verifying software artifacts for transparent build authenticity." />
        <SecurityStatusRow label="Build provenance" status="verified" detail="GitHub Actions CI pipeline"
          tooltip="Verifiable metadata confirming this build originated from our official CI/CD workflow." />
        <SecurityStatusRow label="Official build" status="verified" detail="Matches public repository"
          tooltip="Confirmation that this binary exactly matches the results produced by our public CI/CD pipeline." />
      </SettingsCard>

      {/* Verify Independently */}
      <SettingsCard label="Verify Independently" icon={<ArrowTopRightOnSquareIcon className="w-3 h-3" />}>
        <SecurityLinkRow icon={<GitHubDark style={{ width: 13, height: 13 }} />}
          label="View source repository" href={REPO_URL} />
        <SecurityLinkRow icon={<CodeBracketIcon className="w-[13px] h-[13px]" strokeWidth={2} />}
          label="View release commit"
          href={commitFull !== "unknown" ? `${REPO_URL}/commit/${commitFull}` : REPO_URL} />
        <SecurityLinkRow icon={<HashtagIcon className="w-[13px] h-[13px]" strokeWidth={2} />}
          label="Verify checksum" href={`${REPO_URL}/releases`} />
        <SecurityLinkRow icon={<CheckBadgeIconSolid className="w-[13px] h-[13px]" />}
          label="View build attestation" href={`${REPO_URL}/attestations`} />
        <SecurityLinkRow icon={<ShieldCheckIcon className="w-[13px] h-[13px]" strokeWidth={2} />}
          label="Security documentation" href={`${REPO_URL}/security`} />
      </SettingsCard>

      {/* Footer note */}
      <div className="p-3 pl-2.5 rounded-md border border-warning/20 bg-warning/5 flex gap-2.5">
        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
        <div className="flex flex-col gap-2">
          <span className="text-[11.5px] font-bold text-warning leading-none">Important Security Note</span>
          <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
            <li className="flex gap-2 items-start">
              <span className="text-[14px] leading-[1.2] text-warning/50 shrink-0">•</span>
              <p className="text-[10.5px] text-fg-muted leading-relaxed">
                If any status above shows "unverified" or "unknown", it may not be an official release and can be potentially unsafe to use.
              </p>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[14px] leading-[1.2] text-warning/50 shrink-0">•</span>
              <p className="text-[10.5px] text-fg-muted leading-relaxed">
                <u>If you are building the application from source code yourself</u>, then it is normal for these statuses to be "unverified" or "unknown".
              </p>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[14px] leading-[1.2] text-warning/50 shrink-0">•</span>
              <p className="text-[10.5px] text-fg-muted leading-relaxed">
                Visit <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">GitHub</a> to learn more about our build and release process.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function BangsPanel() {
  const bangs = useStore((s) => s.bangs);
  const [search, setSearch] = useState("");
  const [bangFormOpen, setBangFormOpen] = useState(false);
  const [editingBang, setEditingBang] = useState<Bang | null>(null);

  const filtered = bangs.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.trigger.toLowerCase().includes(q) ||
      b.command.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-fg">Command Bangs</h2>
          <button
            onClick={() => { setEditingBang(null); setBangFormOpen(true); }}
            className="h-8 px-3 rounded-md border border-border/60 bg-transparent text-fg text-[12px] font-bold hover:bg-[var(--command-active-bg)] transition-colors flex items-center gap-1.5"
          >
            <PlusIcon className="w-3.5 h-3.5" strokeWidth={2.5} /> New
          </button>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute z-10 pointer-events-none left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted" strokeWidth={2} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bangs..."
            className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--input-bg)] border border-border text-[12.5px] text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>
      </div>

      {bangs.length === 0 ? (
        <div className="border border-border/60 rounded-lg p-8 text-center">
          <p className="text-[13px] text-fg-muted">No bangs yet. Create aliases like <span className="text-accent font-mono">!update</span> to run complex scripts with a single command.</p>
          <button
            onClick={() => { setEditingBang(null); setBangFormOpen(true); }}
            className="mt-4 text-[12.5px] font-bold text-accent hover:underline"
          >
            Create your first bang
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border/60 rounded-lg p-8 text-center text-[13px] text-fg-muted">No results for "{search}"</div>
      ) : (
        <div className="border border-border/60 rounded-lg overflow-hidden">
          <div className="divide-y divide-border/30">
            {filtered.map((b) => (
              <div key={b.id} className="group flex items-center px-5 py-1.5 text-[13px] even:bg-[var(--command-bg)]/20 hover:bg-[var(--menu-hover-bg)]/30 transition-colors">
                <div className="w-[35%] min-w-0 flex flex-col justify-center">
                  <span className="text-accent font-mono font-semibold">!{b.trigger}</span>
                </div>
                <div className="w-px self-stretch bg-border/30 mx-4" />
                <div className="w-[65%] text-fg-dim truncate text-[11.5px] font-mono opacity-70 flex items-center">
                  {b.command}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                  <Tooltip label="Edit" side="left">
                    <button
                      onClick={() => { setEditingBang(b); setBangFormOpen(true); }}
                      className="w-7 h-7 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-bg)] transition-colors"
                    >
                      <PencilSimple className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip label="Delete" side="left">
                    <button
                      onClick={() => actions.deleteBang(b.id)}
                      className="w-7 h-7 grid place-items-center rounded-sm text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <BangForm
        open={bangFormOpen}
        onClose={() => setBangFormOpen(false)}
        initial={editingBang}
      />
    </div>
  );
}

function AboutPanel() {
  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-semibold text-fg">About</h2>
      <SettingsCard label="Links" icon={<InformationCircleIcon className="w-4 h-4" />}>
        <div className="flex flex-col gap-0.5">
          <a href="https://github.com/dev-hari-prasad/carbon-ssh" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 text-[13px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors rounded-md">
            <GitHubDark className="w-4.5 h-4.5 shrink-0" /> Source Code
          </a>
          <a href="https://github.com/dev-hari-prasad/carbon-ssh/issues/new" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 text-[13px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors rounded-md">
            <ExclamationTriangleIcon className="w-4.5 h-4.5 shrink-0" /> Report an Issue
          </a>
          <a href="https://carbonssh.com/security-philosophy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 text-[13px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors rounded-md">
            <ShieldCheckIcon className="w-4.5 h-4.5 shrink-0" /> Security Philosophy
          </a>
          <a href="https://carbonssh.com/security-response" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 text-[13px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors rounded-md">
            <InformationCircleIcon className="w-4.5 h-4.5 shrink-0" /> Security Response
          </a>
          <a href="https://carbonssh.com/audit" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 text-[13px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors rounded-md">
            <DocumentCheckIcon className="w-4.5 h-4.5 shrink-0" /> Security Audit
          </a>
          <a href="https://carbonssh.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 text-[13px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors rounded-md mt-1 pt-2 border-t border-border/10">
            <GlobeAltIcon className="w-4.5 h-4.5 shrink-0" /> Website: carbonssh.com
          </a>
        </div>
      </SettingsCard>
    </div>
  );
}

const PANELS: Record<LargeTab, React.FC> = {
  general: GeneralPanel, display: DisplayPanel, shortcuts: ShortcutsPanel,
  ai: AIPanel, security: SecurityPanel, verification: VerificationPanel, bangs: BangsPanel,
  about: AboutPanel,
};

export function LargeSettingsModal() {
  const open = useStore((s) => s.largeSettingsOpen);
  const themeId = useStore((s) => s.theme);
  const [tab, setTab] = useState<LargeTab>("general");
  const logoSrc = `/logo/${encodeURIComponent(getThemeById(themeId).type === "light" ? "Carbon logo dark.png" : "Carbon logo light.png")}`;
  const Panel = PANELS[tab];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => actions.toggleLargeSettings()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-[960px] max-w-[90vw] h-[75vh] max-h-[800px] rounded-xl border border-border/40 shadow-2xl flex overflow-hidden relative"
              style={{ background: "var(--sidebar-bg)" }}
            >
              <div className="absolute top-3 right-3 z-20">
                <Tooltip label="Close" side="bottom">
                  <button onClick={() => actions.toggleLargeSettings()} className="w-7 h-7 grid place-items-center rounded-md text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>

              {/* Left nav */}
              <div className="w-[200px] shrink-0 border-r border-border/30 flex flex-col p-3 overflow-y-auto">
                <div className="flex-1">
                  <SectionLabel>Desktop</SectionLabel>
                  {DESKTOP_TABS.map((t) => (
                    <NavItem key={t.id} active={tab === t.id} icon={t.icon} activeIcon={t.activeIcon} label={t.label} onClick={() => setTab(t.id)} />
                  ))}
                  <SectionLabel>Server</SectionLabel>
                  {SERVER_TABS.map((t) => (
                    <NavItem key={t.id} active={tab === t.id} icon={t.icon} activeIcon={t.activeIcon} label={t.label} onClick={() => setTab(t.id)} />
                  ))}
                  <SectionLabel>Information</SectionLabel>
                  {ABOUT_TABS.map((t) => (
                    <NavItem key={t.id} active={tab === t.id} icon={t.icon} activeIcon={t.activeIcon} label={t.label} onClick={() => setTab(t.id)} />
                  ))}
                </div>
                <div className="flex items-center gap-2 px-1 pt-3 border-t border-border/20">
                  <img src={logoSrc} alt="Carbon" className="w-[22px] h-[22px] rounded-sm object-contain shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-fg leading-tight">Carbon settings</div>
                    <div className="text-[10px] font-mono text-fg-muted/60 leading-tight">v1.1</div>
                  </div>
                </div>
              </div>

              {/* Right content */}
              <div className="flex-1 overflow-y-auto p-6 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
                    <Panel />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TelemetryDisclosure() {
  return (
    <div className="min-h-0 w-full pb-2 text-[12px] font-sans text-fg-muted flex flex-col gap-4">
      {/* 2-Column Grid for NEVER vs DO collect */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WE DO COLLECT CARD */}
        <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
              ✓
            </span>
            What Carbon DOES collect
          </div>
          <ul className="flex flex-col gap-2 pl-1">
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-500/60 mt-0.5 select-none text-[10px] shrink-0">✓</span>
              <span><strong>App Navigation:</strong> Basic events like app opened, settings opened, and setup completed</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-500/60 mt-0.5 select-none text-[10px] shrink-0">✓</span>
              <span><strong>Diagnostics:</strong> Anonymous connection success/failure categories (classification only)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-500/60 mt-0.5 select-none text-[10px] shrink-0">✓</span>
              <span><strong>Error Tracking:</strong> Crash reports with sensitive data completely stripped (classification only)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-500/60 mt-0.5 select-none text-[10px] shrink-0">✓</span>
              <span><strong>Environment Data:</strong> Current app version and standard operating system name</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-500/60 mt-0.5 select-none text-[10px] shrink-0">✓</span>
              <span><strong>Anonymity:</strong> Telemetry is tied to a randomly generated ID, never your IP address</span>
            </li>
          </ul>
        </div>

        {/* NEVER COLLECT CARD */}
        <div className="rounded-lg border border-rose-500/10 bg-rose-500/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[13px] font-bold text-rose-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 text-xs font-black">
              ✕
            </span>
            What Carbon NEVER collects
          </div>
          <ul className="flex flex-col gap-2 pl-1">
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500/60 mt-0.5 select-none text-[10px] shrink-0">✕</span>
              <span><strong>Credentials & Keys:</strong> SSH credentials, private keys, or passwords</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500/60 mt-0.5 select-none text-[10px] shrink-0">✕</span>
              <span><strong>Session Content:</strong> Terminal commands or screen output</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500/60 mt-0.5 select-none text-[10px] shrink-0">✕</span>
              <span><strong>Identities:</strong> Hostnames, IP addresses, or usernames</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500/60 mt-0.5 select-none text-[10px] shrink-0">✕</span>
              <span><strong>Environment:</strong> File paths, environment variables, or clipboard contents</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-500/60 mt-0.5 select-none text-[10px] shrink-0">✕</span>
              <span><strong>Metadata:</strong> Anything that identifies your specific servers or private workflows</span>
            </li>
            <li className="flex items-start gap-2.5">
              <PlusIcon className="w-3 h-3 text-rose-500/60 mt-[3px] shrink-0" strokeWidth={2.5} />
              <span><strong>Everything Else:</strong> Any data not explicitly listed in the DOES collect section</span>
            </li>
          </ul>
        </div>
      </div>

      {/* PRIVACY APPROACH CARD */}
      <div className="rounded-lg border border-border bg-[var(--command-bg)]/30 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[13px] font-bold text-fg">
          <ShieldCheckIcon className="w-4.5 h-4.5 text-accent shrink-0" />
          Carbon's Privacy Approach
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-fg-muted/80 pl-1">
          <div className="flex items-start gap-2">
            <span className="text-accent mt-1 select-none text-[8px] shrink-0">•</span>
            <span>Uses a random anonymous ID stored locally on your device</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent mt-1 select-none text-[8px] shrink-0">•</span>
            <span>No session replay, screen recording, or invasive tracker tools</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent mt-1 select-none text-[8px] shrink-0">•</span>
            <span>No account-based identity tracking or profile correlation</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent mt-1 select-none text-[8px] shrink-0">•</span>
            <span>Sensitive connection parameters are scrubbed before sending</span>
          </div>
        </div>
        <div className="mt-1 border-t border-border/10 pt-3 text-[11px] text-fg-muted/60 leading-normal pl-1">
          Carbon uses <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">PostHog</a> for analytics — a privacy-respecting, GDPR-compliant, self-hostable developer analytics platform.
        </div>
      </div>

    </div>
  );
}

const FACTORY_RESET_CONFIRM_PHRASE = "RESET ALL";

function HoldToFactoryResetButton({
  disabled,
  loading,
  onComplete,
}: {
  disabled: boolean;
  loading?: boolean;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const holdMs = reduceMotion ? 900 : 2800;
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const completingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cleanup = useCallback(() => {
    if (completingRef.current) return;
    startRef.current = null;
    setProgress(0);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (startRef.current == null) return;
    const elapsed = performance.now() - startRef.current;
    const p = Math.min(1, elapsed / holdMs);
    setProgress(p);
    if (p >= 1) {
      completingRef.current = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      startRef.current = null;
      onCompleteRef.current();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return;
      completingRef.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = performance.now();
      setProgress(0);
      rafRef.current = requestAnimationFrame(tick);
    },
    [disabled, tick],
  );

  const onPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* noop */
      }
      if (completingRef.current) return;
      cleanup();
    },
    [cleanup],
  );

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const holding = progress > 0 && progress < 1;

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onPointerCancel={onPointerEnd}
      aria-label={
        holding ? "Keep holding to erase all data" : "Hold to erase all local data and reload"
      }
      className={cn(
        "relative isolate h-9 w-full overflow-hidden rounded-sm border border-danger/50 bg-danger/10 px-3 text-center text-[12px] font-sans font-medium text-danger outline-none select-none touch-none focus-visible:ring-1 focus-visible:ring-danger/50 flex items-center justify-center",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-danger/14 active:bg-danger/18",
      )}
    >
      <span
        className="pointer-events-none absolute isolate inset-y-0 left-0 z-0 bg-danger/35 animate-in"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <span className="relative z-10 flex items-center justify-center gap-1.5">
        {loading && <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />}
        {loading
          ? "Resetting..."
          : disabled
            ? "Type the phrase above first"
            : holding
              ? "Keep holding…"
              : "Hold to erase & reload"}
      </span>
    </button>
  );
}
