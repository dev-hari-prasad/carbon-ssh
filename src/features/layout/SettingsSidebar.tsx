import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Gear,
  Keyboard,
  Notepad,
  Palette,
  CaretDown,
  CaretRight,
  Check,
  X,
  Lightning,
  Minus,
  PencilSimple,
  Trash,
  Plus,
  Sparkle,
  Eye,
  EyeSlash,
  Info,
  CircleNotch,
  Key,
  Globe,
  ChatCircleText,
  MagicWand,
  RocketLaunch,
  SlidersHorizontal,
  ShieldCheck,
  MagnifyingGlass,
  TerminalWindow,
  SquaresFour,
} from "@phosphor-icons/react";
import { Tooltip } from "@/components/Tooltip";
import {
  cssVariablesForTheme,
  RECOMMENDED_THEME_IDS,
  THEMES,
  type AppTheme,
} from "@/config/themes";
import { FONTS, TERMINAL_FONTS, type AppFont } from "@/config/fonts";
import { actions, useStore } from "@/lib/store";
import {
  DEFAULT_LOG_RETENTION,
  LOG_RETENTION_OPTIONS,
  type LogRetention,
} from "@/lib/log-retention";
import { AI_PROVIDERS, getProviderMeta, isAIConfigured, type AIProviderId } from "@/lib/ai";
import type { Bang } from "@/lib/types";
import { ProviderIcon } from "@/features/ai/providerIcons";
import { BangForm } from "@/features/bangs/BangForm";
import { Slider } from "@/components/ui/slider";

type Tab = "general" | "shortcuts" | "bangs" | "display" | "ai";

export function SettingsSidebar() {
  const open = useStore((s) => s.settingsOpen);
  const tab = useStore((s) => s.settingsTab);
  const setTab = (t: any) => actions.openSettingsTab(t);
  const [bangFormOpen, setBangFormOpen] = useState(false);
  const [editingBang, setEditingBang] = useState<Bang | null>(null);

  useEffect(() => {
    const onNewBang = () => {
      setEditingBang(null);
      setBangFormOpen(true);
    };
    window.addEventListener("tm:new-bang", onNewBang);
    return () => window.removeEventListener("tm:new-bang", onNewBang);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.aside
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute z-30 top-4 right-4 bottom-4 w-[340px] max-w-[min(340px,calc(100%-2rem))] flex flex-col rounded-[14px] border border-[var(--border-strong)] shadow-2xl overflow-hidden"
            style={{ background: "var(--sidebar-bg)" }}
          >
            <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-[10px] bg-[var(--command-bg)] border border-border flex-wrap">
                <SidebarTabBtn
                  active={tab === "general"}
                  onClick={() => setTab("general")}
                  label="General"
                >
                  <Gear size={14} weight={tab === "general" ? "fill" : "regular"} />
                </SidebarTabBtn>
                <SidebarTabBtn active={tab === "ai"} onClick={() => setTab("ai")} label="AI">
                  <Sparkle size={14} weight={tab === "ai" ? "fill" : "regular"} />
                </SidebarTabBtn>
                <SidebarTabBtn
                  active={tab === "shortcuts"}
                  onClick={() => setTab("shortcuts")}
                  label="Shortcuts"
                >
                  <Keyboard size={14} weight={tab === "shortcuts" ? "fill" : "regular"} />
                </SidebarTabBtn>
                <SidebarTabBtn
                  active={tab === "bangs"}
                  onClick={() => setTab("bangs")}
                  label="Bangs"
                >
                  <span className="font-mono font-bold text-[13px] leading-none">!</span>
                </SidebarTabBtn>
                <SidebarTabBtn
                  active={tab === "display"}
                  onClick={() => setTab("display")}
                  label="Customize"
                >
                  <Palette size={14} weight={tab === "display" ? "fill" : "regular"} />
                </SidebarTabBtn>
              </div>
              <Tooltip label="Close" side="bottom">
                <button
                  onClick={() => actions.setSettingsOpen(false)}
                  aria-label="Close settings"
                  className="w-7 h-7 shrink-0 grid place-items-center rounded-[8px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
                >
                  <X size={13} weight="bold" />
                </button>
              </Tooltip>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {tab === "display" ? (
                <DisplayPanel />
              ) : tab === "general" ? (
                <GeneralPanel />
              ) : tab === "ai" ? (
                <AIPanel />
              ) : tab === "shortcuts" ? (
                <ShortcutsPanel />
              ) : tab === "bangs" ? (
                <BangsPanel
                  onEdit={(b) => {
                    setEditingBang(b);
                    setBangFormOpen(true);
                  }}
                  onNew={() => {
                    setEditingBang(null);
                    setBangFormOpen(true);
                  }}
                />
              ) : (
                <AIPanel />
              )}
            </div>
          </motion.aside>

          <BangForm
            open={bangFormOpen}
            onClose={() => setBangFormOpen(false)}
            initial={editingBang}
          />
        </>
      )}
    </AnimatePresence>
  );
}

function SidebarTabBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        onClick={onClick}
        aria-label={label}
        className={`w-7 h-7 grid place-items-center rounded-[7px] transition-colors ${
          active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:text-fg"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function BangsPanel({ onEdit, onNew }: { onEdit: (b: Bang) => void; onNew: () => void }) {
  const bangs = useStore((s) => s.bangs);

  return (
    <div className="px-2 py-2 flex flex-col">
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-[10.5px] uppercase tracking-wider font-sans font-semibold text-fg-dim">
          Bangs
        </span>
        <button
          onClick={onNew}
          className="text-[11.5px] font-mono text-accent hover:underline flex items-center gap-1"
        >
          <Plus size={11} weight="bold" /> new bang
        </button>
      </div>
      <div className="px-2 py-2 text-[11.5px] font-sans text-fg-muted rounded-[8px] bg-[var(--command-bg)]/80 border border-border mb-2">
        Type <span className="font-mono text-accent font-semibold">!trigger</span> in a terminal to
        run the mapped command.
      </div>
      {bangs.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="text-[12.5px] text-fg-muted font-sans">No bangs yet.</div>
          <button
            onClick={onNew}
            className="mt-2 text-[12px] font-mono text-accent hover:underline"
          >
            + Create your first
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {bangs.map((b) => (
            <div
              key={b.id}
              className="group flex items-start gap-3 px-2 py-2 rounded-[8px] hover:bg-[var(--menu-hover-bg)]"
            >
              <div className="w-7 h-7 shrink-0 rounded-md bg-bg border border-border grid place-items-center text-accent">
                <Lightning size={13} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[13px] font-semibold text-fg">!{b.trigger}</span>
                  {b.description ? (
                    <span className="text-[11.5px] font-sans text-fg-muted truncate">
                      {b.description}
                    </span>
                  ) : null}
                </div>
                <div className="text-[11.5px] font-mono text-fg-dim truncate mt-0.5">
                  {b.command}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                <Tooltip label="Edit" side="top">
                  <button
                    type="button"
                    onClick={() => onEdit(b)}
                    aria-label="Edit"
                    className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:bg-bg-elev hover:text-fg"
                  >
                    <PencilSimple size={12} />
                  </button>
                </Tooltip>
                <Tooltip label="Delete" side="top">
                  <button
                    type="button"
                    onClick={() => actions.deleteBang(b.id)}
                    aria-label="Delete"
                    className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:bg-bg-elev hover:text-danger"
                  >
                    <Trash size={12} />
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneralPanel() {
  const zoomLevel = useStore((s) => s.zoomLevel);
  const autoOpenTabs = useStore((s) => s.autoOpenTabs);
  const [confirmClose, setConfirmClose] = useState(true);
  const [bell, setBell] = useState(true);
  const [telemetry, setTelemetry] = useState(false);
  const ai = useStore((s) => s.ai);
  const aiReady = isAIConfigured(ai);

  return (
    <div className="px-3 py-2 flex flex-col">
      <SettingsGroup
        label="Interface"
        icon={<SlidersHorizontal size={13} weight="duotone" className="text-fg-dim" aria-hidden />}
      >
        <div className="px-2 pb-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-sans font-medium text-fg">Interface Scale</span>
              <span className="text-[11px] font-sans text-fg-muted leading-tight">
                Adjust the zoom level of the UI.
              </span>
            </div>

            <div className="flex items-center gap-0.5 p-0.5 rounded-[9px] bg-[var(--command-bg)] border border-border shrink-0">
              <button
                onClick={() => actions.setZoomLevel(Math.max(75, zoomLevel - 5))}
                aria-label="Zoom out"
                className="w-6 h-6 grid place-items-center rounded-[6px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
              >
                <Minus size={11} weight="bold" />
              </button>
              <Tooltip label="Reset to 110%" side="top">
                <button
                  onClick={() => actions.setZoomLevel(110)}
                  className="min-w-[42px] h-6 px-1 rounded-[6px] text-[10.5px] font-mono font-bold text-accent hover:bg-[var(--command-active-bg)] transition-colors"
                >
                  {zoomLevel}%
                </button>
              </Tooltip>
              <button
                onClick={() => actions.setZoomLevel(Math.min(135, zoomLevel + 5))}
                aria-label="Zoom in"
                className="w-6 h-6 grid place-items-center rounded-[6px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
              >
                <Plus size={11} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup
        label="Startup"
        icon={<RocketLaunch size={13} weight="duotone" className="text-fg-dim" aria-hidden />}
      >
        <ToggleRow
          label="Auto open last tabs"
          description="Reopen sessions that were active when you last closed the app."
          value={autoOpenTabs}
          onChange={actions.setAutoOpenTabs}
        />
      </SettingsGroup>

      <SettingsGroup
        label="AI"
        icon={<Sparkle size={13} weight="duotone" className="text-fg-dim" aria-hidden />}
      >
        <ToggleRow
          label="AI autocomplete in terminal"
          description={
            aiReady
              ? "Suggest commands inline as you type, powered by your AI provider."
              : "Fill in the AI tab, run Test connection, then enable here."
          }
          value={ai.autocompleteEnabled && aiReady}
          disabled={!aiReady}
          onChange={(v) => actions.updateAI({ autocompleteEnabled: v })}
        />
        <ToggleRow
          label="AI chat"
          description={
            aiReady
              ? "Open an assistant alongside your sessions for help and explanations."
              : "Fill in the AI tab, run Test connection, then enable here."
          }
          value={ai.chatEnabled && aiReady}
          disabled={!aiReady}
          onChange={(v) => actions.updateAI({ chatEnabled: v })}
        />
      </SettingsGroup>

      <LogSettingsGroup />

      <SettingsGroup
        label="Behavior"
        icon={<SlidersHorizontal size={13} weight="duotone" className="text-fg-dim" aria-hidden />}
      >
        <ToggleRow
          label="Confirm before closing tabs"
          description="Ask for confirmation when closing an active session."
          value={confirmClose}
          onChange={setConfirmClose}
        />
      </SettingsGroup>

      <SettingsGroup
        label="Privacy"
        icon={<ShieldCheck size={13} weight="duotone" className="text-fg-dim" aria-hidden />}
      >
        <ToggleRow
          labelBadge="Off by default"
          label="Anonymous telemetry"
          description="Help us improve relay/ssh by sending crash reports."
          value={telemetry}
          onChange={setTelemetry}
        />
      </SettingsGroup>
    </div>
  );
}

function LogRetentionSelect({
  value,
  onChange,
}: {
  value: LogRetention;
  onChange: (v: LogRetention) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current =
    LOG_RETENTION_OPTIONS.find((o) => o.id === value) ??
    LOG_RETENTION_OPTIONS.find((o) => o.id === DEFAULT_LOG_RETENTION)!;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full h-9 flex items-center gap-2 pl-2.5 pr-2 bg-[var(--input-bg)] border border-border rounded-[8px] text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors"
      >
        <span className="flex-1 min-w-0 text-[13px] font-sans text-fg truncate">
          {current.label}
        </span>
        <CaretDown size={11} weight="bold" className="text-fg-muted shrink-0" />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 p-1 z-30 bg-[var(--menu-bg)] border border-border rounded-[10px] shadow-2xl"
        >
          {LOG_RETENTION_OPTIONS.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2 min-h-9 rounded-[7px] text-left transition-colors ${
                  active
                    ? "bg-[var(--command-active-bg)] text-fg"
                    : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
                }`}
              >
                <span className="flex-1 min-w-0 truncate text-[13px] font-sans">{opt.label}</span>
                {active ? <Check size={11} weight="bold" className="text-accent shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function LogSettingsGroup() {
  const logRetention = useStore((s) => s.logRetention);
  return (
    <SettingsGroup
      label="Activity Logs"
      icon={<Notepad size={13} weight="duotone" className="text-fg-dim" aria-hidden />}
    >
      <div className="px-2 py-1.5 flex flex-col gap-2">
        <div className="pr-1">
          <div className="text-[12.5px] font-sans font-medium text-fg leading-snug">
            Log retention
          </div>
          <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">
            Drop <strong> local activity log entries older than this window </strong> in the
            activity panel. Choosing{" "}
            <strong className="text-fg font-medium">Turn off logging</strong> stops new entries;
            clearing the log is manual.
          </p>
        </div>
        <LogRetentionSelect value={logRetention} onChange={(id) => actions.setLogRetention(id)} />
      </div>
    </SettingsGroup>
  );
}

function SettingsGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col mb-3">
      <div className="px-1 pt-2 pb-1.5 flex items-center gap-1 text-[10.5px] uppercase tracking-wider font-sans font-semibold text-fg-dim">
        {icon ? <span className="shrink-0 inline-flex text-fg-dim opacity-90">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  labelBadge,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  /** Small pill shown inline immediately after the title label. */
  labelBadge?: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`flex items-start justify-between gap-3 px-2 py-2.5 rounded-[8px] text-left ${
        disabled ? "opacity-55 cursor-not-allowed" : "hover:bg-[var(--menu-hover-bg)]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-[12.5px] font-sans font-medium text-fg shrink-0">{label}</span>
          {labelBadge ? (
            <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded-md text-[9.5px] font-sans font-semibold tracking-wide normal-case bg-success/14 text-success border border-success/30">
              {labelBadge}
            </span>
          ) : null}
        </div>
        {description ? (
          <div className="text-[11px] font-sans text-fg-muted leading-snug mt-0.5">
            {description}
          </div>
        ) : null}
      </div>
      <span
        aria-hidden
        className={`shrink-0 mt-0.5 w-[28px] h-[16px] rounded-full transition-colors relative ${
          value ? "bg-accent" : "bg-[var(--border-strong)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-[12px]" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

const SHORTCUTS: Array<{
  group: string;
  icon: ReactNode;
  items: Array<{ keys: string[]; label: string }>;
}> = [
  {
    group: "Sessions",
    icon: <SquaresFour size={13} weight="duotone" className="text-fg-dim shrink-0" aria-hidden />,
    items: [
      { keys: ["Mod", "Shift", "H"], label: "View Hosts" },
      { keys: ["Mod", "T"], label: "New Session" },
      { keys: ["Mod", "W"], label: "Close active session" },
      { keys: ["Mod", "Shift", "T"], label: "Restore closed session" },
      { keys: ["Mod", "Tab"], label: "Next session" },
      { keys: ["Mod", "Shift", "Tab"], label: "Previous session" },
    ],
  },
  {
    group: "Search & navigation",
    icon: (
      <MagnifyingGlass size={13} weight="duotone" className="text-fg-dim shrink-0" aria-hidden />
    ),
    items: [
      { keys: ["Mod", "K"], label: "Open machines picker" },
      { keys: ["Mod", "P"], label: "Quick-switch machines" },
      { keys: ["Mod", "H"], label: "Toggle logs" },
      { keys: ["Mod", "S"], label: "Toggle settings" },
    ],
  },
  {
    group: "Terminal",
    icon: (
      <TerminalWindow size={13} weight="duotone" className="text-fg-dim shrink-0" aria-hidden />
    ),
    items: [
      { keys: ["Mod", "C"], label: "Copy selection" },
      { keys: ["Mod", "V"], label: "Paste" },
      { keys: ["Mod", "Shift", "F"], label: "Find in terminal" },
      { keys: ["Mod", "L"], label: "Clear terminal" },
      { keys: ["Mod", "Plus"], label: "Zoom in" },
      { keys: ["Mod", "Minus"], label: "Zoom out" },
      { keys: ["Mod", "0"], label: "Reset zoom" },
    ],
  },
  {
    group: "Bangs",
    icon: <Lightning size={13} weight="duotone" className="text-fg-dim shrink-0" aria-hidden />,
    items: [
      { keys: ["!", "name"], label: "Run a saved bang" },
      { keys: ["Mod", "Shift", "B"], label: "New bang" },
    ],
  },
];

function ShortcutsPanel() {
  return (
    <div className="px-3 py-2 flex flex-col">
      {SHORTCUTS.map((g) => (
        <div key={g.group} className="flex flex-col mb-3">
          <div className="px-1 pt-2 pb-1.5 flex items-center gap-1 text-[10.5px] uppercase tracking-wider font-sans font-semibold text-fg-dim">
            <span className="shrink-0 inline-flex text-fg-dim opacity-90">{g.icon}</span>
            <span>{g.group}</span>
          </div>
          <div className="flex flex-col">
            {g.items.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-[8px] hover:bg-[var(--menu-hover-bg)]"
              >
                <span className="text-[12.5px] font-sans text-fg">{s.label}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {s.keys.map((k, i) => {
                    const isMac =
                      typeof window !== "undefined" &&
                      /Mac|iPod|iPhone|iPad/.test(navigator.platform);
                    let label = k;
                    if (k === "Mod") label = isMac ? "⌘" : "Ctrl";
                    if (k === "Shift") label = isMac ? "⇧" : "Shift";

                    return (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 ? <span className="text-[10px] text-fg-dim">+</span> : null}
                        <kbd className="px-1.5 h-[20px] min-w-[20px] inline-flex items-center justify-center rounded-[5px] border border-border bg-[var(--command-bg)] text-[10.5px] font-mono text-fg-muted">
                          {label}
                        </kbd>
                      </span>
                    );
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DisplayPanel() {
  const [fontOpen, setFontOpen] = useState(true);
  const [themeOpen, setThemeOpen] = useState(true);

  return (
    <div className="px-2 py-2 flex flex-col gap-1">
      <Section label="Font" open={fontOpen} onToggle={() => setFontOpen((v) => !v)}>
        <FontSection />
      </Section>

      <Section label="Theme" open={themeOpen} onToggle={() => setThemeOpen((v) => !v)}>
        <ThemeList />
      </Section>
    </div>
  );
}

function Section({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] hover:bg-[var(--menu-hover-bg)]"
      >
        <span className="text-[13.5px] font-sans font-medium text-fg">{label}</span>
        {open ? (
          <CaretDown size={13} className="text-fg-muted" weight="bold" />
        ) : (
          <CaretRight size={13} className="text-fg-muted" weight="bold" />
        )}
      </button>
      {open ? <div className="flex flex-col gap-1 pt-1 pb-2">{children}</div> : null}
    </div>
  );
}

function FontSection() {
  const [tab, setTab] = useState<"app" | "terminal">("app");
  return (
    <div className="flex flex-col gap-2">
      <div className="mx-2 p-1 flex items-center gap-1 rounded-[10px] bg-[var(--command-bg)] border border-border">
        <SubTabBtn active={tab === "app"} onClick={() => setTab("app")} className="flex-1">
          App font
        </SubTabBtn>
        <SubTabBtn
          active={tab === "terminal"}
          onClick={() => setTab("terminal")}
          className="flex-1"
        >
          Terminal font
        </SubTabBtn>
      </div>
      <div className="flex flex-col gap-1">
        {tab === "app" ? <FontList /> : <TerminalFontList />}
      </div>
    </div>
  );
}

function SubTabBtn({
  active,
  onClick,
  className = "",
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-2.5 rounded-[7px] text-[11.5px] font-sans transition-colors flex items-center justify-center ${
        active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:text-fg"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function FontList() {
  const activeFontId = useStore((s) => s.font);
  return (
    <>
      {FONTS.map((font) => (
        <FontRow
          key={font.id}
          font={font}
          active={font.id === activeFontId}
          onSelect={() => actions.setFont(font.id)}
        />
      ))}
    </>
  );
}

function TerminalFontList() {
  const activeFontId = useStore((s) => s.terminalFont);
  return (
    <>
      {TERMINAL_FONTS.map((font) => (
        <FontRow
          key={font.id}
          font={font}
          active={font.id === activeFontId}
          onSelect={() => actions.setTerminalFont(font.id)}
        />
      ))}
    </>
  );
}

function FontRow({
  font,
  active,
  onSelect,
}: {
  font: AppFont;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-[10px] text-left transition-colors ${
        active
          ? "bg-[var(--command-active-bg)] ring-1 ring-accent/40"
          : "hover:bg-[var(--menu-hover-bg)]"
      }`}
    >
      <FontPreview font={font} />
      <span
        className={`min-w-0 flex-1 text-[13px] truncate ${
          active ? "text-fg font-semibold" : "text-fg"
        }`}
        style={{ fontFamily: font.stack }}
      >
        {font.name}
      </span>
      {active ? (
        <span className="w-5 h-5 grid place-items-center rounded-full bg-accent text-accent-fg shrink-0">
          <Check size={11} weight="bold" />
        </span>
      ) : null}
    </button>
  );
}

function FontPreview({ font }: { font: AppFont }) {
  return (
    <div
      className="w-[68px] h-[44px] rounded-[6px] overflow-hidden shrink-0 border border-[var(--border-strong)] bg-[var(--bg)] grid place-items-center"
      aria-hidden
    >
      <span
        className="text-fg leading-none"
        style={{
          fontFamily: font.stack,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        Aa
      </span>
    </div>
  );
}

function ThemeList() {
  const activeThemeId = useStore((s) => s.theme);
  const [tab, setTab] = useState<"dark" | "light">("dark");

  const themes = THEMES.filter((t) => t.type === tab);
  const recommendedIdsForTab = RECOMMENDED_THEME_IDS.filter((id) => {
    const t = THEMES.find((x) => x.id === id);
    return t && t.type === tab;
  });

  const recommended = recommendedIdsForTab
    .map((id) => themes.find((t) => t.id === id))
    .filter((t): t is AppTheme => Boolean(t));
  const rest = themes.filter((t) => !recommendedIdsForTab.includes(t.id));
  const ordered = [...recommended, ...rest];

  return (
    <div className="flex flex-col gap-2">
      <div className="mx-2 p-1 flex items-center gap-1 rounded-[10px] bg-[var(--command-bg)] border border-border">
        <SubTabBtn active={tab === "dark"} onClick={() => setTab("dark")} className="flex-1">
          Dark
        </SubTabBtn>
        <SubTabBtn active={tab === "light"} onClick={() => setTab("light")} className="flex-1">
          Light
        </SubTabBtn>
      </div>
      <div className="flex flex-col gap-1">
        {ordered.map((theme) => (
          <ThemeRow
            key={theme.id}
            theme={theme}
            active={theme.id === activeThemeId}
            onSelect={() => actions.setTheme(theme.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeRow({
  theme,
  active,
  onSelect,
}: {
  theme: AppTheme;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-[10px] text-left transition-colors ${
        active
          ? "bg-[var(--command-active-bg)] ring-1 ring-accent/40"
          : "hover:bg-[var(--menu-hover-bg)]"
      }`}
    >
      <ThemePreview theme={theme} />
      <span
        className={`min-w-0 flex-1 text-[13px] font-sans truncate ${
          active ? "text-fg font-semibold" : "text-fg"
        }`}
      >
        {theme.name}
      </span>
      {active ? (
        <span className="w-5 h-5 grid place-items-center rounded-full bg-accent text-accent-fg shrink-0">
          <Check size={11} weight="bold" />
        </span>
      ) : null}
    </button>
  );
}

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
    <div
      className="w-[68px] h-[44px] rounded-[6px] overflow-hidden shrink-0 border"
      style={{ borderColor: border, background: bg }}
    >
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

/** Public source; used in AI & privacy FAQ (keep in sync if the repo moves). */
const SOURCE_CODE_URL = "https://github.com/dev-hari-prasad/terminal-muse";

const AI_PANEL_FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Is sensitive information shared with AI?",
    a: "Hosts, IPs, usernames, keys, logs, and similar sensitive details are stripped out (redacted) before anything leaves your machine, so that stuff isn’t sitting in the prompt handed to the model.",
  },
  {
    q: "Is my data stored?",
    a: "This app doesn’t stash your chat/autocomplete traffic on a server: requests go out, responses come back, end of story from our side. Your settings (including API keys) live in localStorage only. Your AI provider is its own company: they may keep logs of your chat history under their own retention rules.",
  },
  {
    q: "Are autocomplete and chat safe?",
    a: "Same playbook for both: everything goes through the redaction step first, and we only send a small slice of context - not any connection, machine, variable or sensitive details.",
  },
  {
    q: "Why should I trust you?",
    a: (
      <>
        Don’t trust blindly, open dev tools (F12, or Ctrl+Shift+I / Cmd+Option+I), hit the Network
        tab, and read what’s actually sent and Have a look at the source code on{" "}
        <a
          href={SOURCE_CODE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:opacity-90"
        >
          GitHub
        </a>
        .
      </>
    ),
  },
  {
    q: "Where does my API key live?",
    a: "On this device, in localStorage. It only gets stored for making the request at the moment a request is made; we don’t bounce it back or store it anywhere.",
  },
  {
    q: "Is my terminal log uploaded?",
    a: "Comeon, you know the answer to this one! No, it's not uploaded. It's local and stays local.",
  },
];

function AIPanelFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  const faqTransitions = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.32, 0.72, 0.18, 1] as const };

  return (
    <div className="flex flex-col shrink-0 mt-1">
      <div className="px-1 pb-1.5 text-[10.5px] uppercase tracking-wider font-sans font-semibold text-fg-dim">
        AI & privacy
      </div>
      <div className="flex flex-col rounded-[10px] border border-border bg-[var(--command-bg)]/40 overflow-hidden">
        {AI_PANEL_FAQ.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="border-b border-border/60 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenIndex((cur) => (cur === i ? null : i))}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--menu-hover-bg)] transition-colors"
              >
                <span
                  className={`text-[12px] font-sans leading-snug ${
                    isOpen ? "text-fg font-medium" : "text-fg-muted"
                  }`}
                >
                  {item.q}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.32, 0.72, 0.18, 1] }}
                  className="text-fg-dim shrink-0 grid place-items-center"
                  aria-hidden
                >
                  <CaretDown size={11} weight="bold" className={isOpen ? "text-fg-muted" : ""} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    key={`faq-${i}-a`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={faqTransitions}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-2.5 pt-1">
                      <div
                        aria-hidden
                        className="mb-2 ml-px h-px w-11 max-w-[32%] rounded-full bg-fg-dim/30"
                      />
                      <p className="text-[11.5px] font-sans text-fg-muted leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AIPanel() {
  const ai = useStore((s) => s.ai);
  const meta = getProviderMeta(ai.provider);
  const [showKey, setShowKey] = useState(false);
  const ready = isAIConfigured(ai);
  const [testPhase, setTestPhase] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    setTestPhase("idle");
    setTestError(null);
  }, [ai.provider, ai.apiKey, ai.baseUrl, ai.chatModel, ai.autocompleteModel]);

  async function runConnectionTest() {
    if (!ready) return;
    setTestPhase("loading");
    setTestError(null);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: ai.provider,
          apiKey: ai.apiKey,
          baseUrl: ai.baseUrl,
          chatModel: ai.chatModel,
          autocompleteModel: ai.autocompleteModel,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setTestPhase("err");
        setTestError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setTestPhase("ok");
    } catch (e) {
      setTestPhase("err");
      setTestError(e instanceof Error ? e.message : "Network error");
    }
  }

  return (
    <div className="px-3 py-3 flex flex-col gap-4">
      <FieldBlock label="Provider">
        <ProviderSelect
          value={ai.provider}
          onChange={(id) =>
            actions.updateAI({ provider: id, chatModel: "", autocompleteModel: "" })
          }
        />
      </FieldBlock>

      <FieldBlock label="API key" hint={meta.apiKeyRequired ? "required" : "optional"}>
        <IconFieldRow icon={<Key size={13} weight="bold" />}>
          <input
            type={showKey ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={ai.apiKey}
            onChange={(e) => actions.updateAI({ apiKey: e.target.value })}
            placeholder={meta.apiKeyHint}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] font-mono text-fg placeholder:text-fg-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? "Hide API key" : "Show API key"}
            className="-mr-1 w-6 h-6 grid place-items-center rounded text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] shrink-0"
          >
            {showKey ? <EyeSlash size={12} /> : <Eye size={12} />}
          </button>
        </IconFieldRow>
      </FieldBlock>

      {meta.needsBaseUrl ? (
        <FieldBlock
          label={meta.baseUrlField?.label ?? "Base URL"}
          hint={meta.baseUrlField?.fieldHint ?? "required"}
        >
          <IconFieldRow icon={<Globe size={13} weight="bold" />}>
            <input
              autoComplete="off"
              spellCheck={false}
              value={ai.baseUrl}
              onChange={(e) => actions.updateAI({ baseUrl: e.target.value })}
              placeholder={meta.baseUrlField?.placeholder ?? "http://localhost:11434/v1"}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] font-mono text-fg placeholder:text-fg-muted focus:outline-none"
            />
          </IconFieldRow>
        </FieldBlock>
      ) : null}

      <FieldBlock
        labelSuffix={
          <Tooltip
            multiline
            side="left"
            label={
              <>
                Used for the AI chat panel. Pick a strong general model for best answers. Like GPT-5
                family or Claude 4 family.
              </>
            }
          >
            <span
              className="inline-flex text-fg-muted hover:text-fg cursor-default rounded outline-none focus-visible:ring-2 focus-visible:ring-accent"
              tabIndex={0}
              role="button"
              aria-label="What is the chat model?"
            >
              <Info size={13} weight="bold" className="shrink-0" aria-hidden />
            </span>
          </Tooltip>
        }
        label="Chat model"
      >
        <IconFieldRow icon={<ChatCircleText size={13} weight="bold" />}>
          <input
            autoComplete="off"
            spellCheck={false}
            value={ai.chatModel}
            onChange={(e) => actions.updateAI({ chatModel: e.target.value })}
            placeholder={meta.defaultModel || "model id"}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] font-mono text-fg placeholder:text-fg-muted focus:outline-none"
          />
        </IconFieldRow>
      </FieldBlock>

      <FieldBlock
        labelSuffix={
          <Tooltip
            multiline
            side="left"
            label={
              <>
                Used for terminal autocomplete. Prefer a very small and fast model for low latency.
                Like GPT mini, Gemini Flash or Qwen 2.5.
              </>
            }
          >
            <span
              className="inline-flex text-fg-muted hover:text-fg cursor-default rounded outline-none focus-visible:ring-2 focus-visible:ring-accent"
              tabIndex={0}
              role="button"
              aria-label="What is the autocomplete model?"
            >
              <Info size={13} weight="bold" className="shrink-0" aria-hidden />
            </span>
          </Tooltip>
        }
        label="Autocomplete model"
      >
        <IconFieldRow icon={<MagicWand size={13} weight="bold" />}>
          <input
            autoComplete="off"
            spellCheck={false}
            value={ai.autocompleteModel}
            onChange={(e) => actions.updateAI({ autocompleteModel: e.target.value })}
            placeholder={meta.defaultAutocompleteModel || meta.defaultModel || "model id"}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] font-mono text-fg placeholder:text-fg-muted focus:outline-none"
          />
        </IconFieldRow>
      </FieldBlock>

      <div className="mt-0.5 flex flex-col gap-3 px-0.5">
        <button
          type="button"
          disabled={!ready || testPhase === "loading"}
          onClick={() => void runConnectionTest()}
          className="h-10 w-full rounded-[10px] bg-accent text-accent-fg text-[13px] font-sans font-semibold hover:opacity-90 disabled:opacity-45 disabled:pointer-events-none transition-opacity inline-flex items-center justify-center gap-2"
        >
          {testPhase === "loading" ? (
            <>
              <CircleNotch size={14} className="animate-spin shrink-0" />
              Testing…
            </>
          ) : (
            <>
              <Lightning size={13} weight="fill" />
              Test connection
            </>
          )}
        </button>
        {testPhase === "ok" ? (
          <p className="text-[11.5px] font-sans text-success leading-snug px-0.5">
            Both models responded. You can turn on AI chat and autocomplete under General → Startup.
          </p>
        ) : null}
        {testPhase === "err" && testError ? (
          <p className="text-[11.5px] font-sans text-danger leading-snug px-0.5 break-words">
            {testError}
          </p>
        ) : null}
      </div>

      <div className="h-px bg-border/70 my-1" aria-hidden />

      <AIPanelFaq />
    </div>
  );
}

function ProviderSelect({
  value,
  onChange,
}: {
  value: AIProviderId;
  onChange: (id: AIProviderId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = getProviderMeta(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full h-9 flex items-center gap-2 pl-2.5 pr-2 bg-[var(--input-bg)] border border-border rounded-[8px] text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors"
      >
        <span className="w-4 h-4 grid place-items-center text-fg shrink-0">
          <ProviderIcon id={value} size={14} />
        </span>
        <span className="flex-1 min-w-0 text-[13px] font-sans text-fg truncate">{meta.name}</span>
        <CaretDown size={11} weight="bold" className="text-fg-muted shrink-0" />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 p-1 z-20 bg-[var(--menu-bg)] border border-border rounded-[10px] shadow-2xl"
        >
          {AI_PROVIDERS.map((p) => {
            const active = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2 h-9 rounded-[7px] text-left transition-colors ${
                  active
                    ? "bg-[var(--command-active-bg)] text-fg"
                    : "text-fg hover:bg-[var(--menu-hover-bg)]"
                }`}
              >
                <span className="w-4 h-4 grid place-items-center shrink-0">
                  <ProviderIcon id={p.id} size={14} />
                </span>
                <span className="flex-1 min-w-0 truncate text-[13px] font-sans">{p.name}</span>
                {active ? <Check size={11} weight="bold" className="text-accent shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function IconFieldRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2.5 h-9 rounded-[8px] bg-[var(--input-bg)] border border-border focus-within:border-[var(--border-strong)] transition-colors">
      <span className="text-fg-muted shrink-0">{icon}</span>
      {children}
    </div>
  );
}

function FieldBlock({
  label,
  labelPrefix,
  labelSuffix,
  hint,
  children,
}: {
  label: string;
  /** Shown to the left of the label text. */
  labelPrefix?: ReactNode;
  /** Shown to the right of the label text (e.g. info tooltip). */
  labelSuffix?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className={`flex items-baseline mb-2 px-0.5 gap-2 ${hint ? "justify-between" : ""}`}>
        <span className="flex items-center gap-1.5 min-w-0">
          {labelPrefix ? <span className="shrink-0 flex items-center">{labelPrefix}</span> : null}
          <span className="text-[10.5px] uppercase tracking-wider font-sans font-semibold text-fg-muted truncate">
            {label}
          </span>
          {labelSuffix ? <span className="shrink-0 flex items-center">{labelSuffix}</span> : null}
        </span>
        {hint ? (
          <span className="text-[10.5px] font-mono text-fg-dim truncate shrink-0">{hint}</span>
        ) : null}
      </div>
      {children}
    </label>
  );
}
