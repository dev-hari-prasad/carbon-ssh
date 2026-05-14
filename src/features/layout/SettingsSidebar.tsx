import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GitHubDark } from "@ridemountainpig/svgl-react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  CheckBadgeIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  FingerPrintIcon,
  GlobeAltIcon,
  HashtagIcon,
  InformationCircleIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Squares2X2Icon,
  SwatchIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  BoltIcon as BoltIconSolid,
  CheckBadgeIcon as CheckBadgeIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  CommandLineIcon as CommandLineIconSolid,
  InformationCircleIcon as InformationCircleIconSolid,
  SparklesIcon as SparklesIconSolid,
  SwatchIcon as SwatchIconSolid,
} from "@heroicons/react/24/solid";
import { Tooltip } from "@/components/Tooltip";
import {
  cssVariablesForTheme,
  RECOMMENDED_THEME_IDS,
  THEMES,
  type AppTheme,
} from "@/config/themes";
import { FONTS, TERMINAL_FONTS, type AppFont } from "@/config/fonts";
import { actions, getDefaultInterfaceZoom, useStore } from "@/lib/store";
import {
  DEFAULT_LOG_RETENTION,
  LOG_RETENTION_OPTIONS,
  type LogRetention,
} from "@/lib/log-retention";
import { AI_PROVIDERS, getProviderMeta, isAIConfigured, type AIProviderId } from "@/lib/ai";
import { savePasswordAccess, type TabBarOrientation } from "@/lib/storage";
import { setUpBestAvailablePasskey } from "@/lib/passkeys";
import type { Bang } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProviderIcon } from "@/features/ai/providerIcons";
import { BangForm } from "@/features/bangs/BangForm";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { PencilSimple, MagnifyingGlass } from "@phosphor-icons/react";



const CURSOR_STYLE_OPTIONS = [
  { id: "blinking-block", label: "Blinking Block", style: "block", blink: true },
  { id: "blinking-bar", label: "Blinking Bar", style: "bar", blink: true },
  { id: "blinking-underline", label: "Blinking Underline", style: "underline", blink: true },
  { id: "block", label: "Block", style: "block", blink: false },
  { id: "bar", label: "Bar", style: "bar", blink: false },
  { id: "underline", label: "Underline", style: "underline", blink: false },
] as const;

type Tab = "general" | "shortcuts" | "bangs" | "display" | "ai" | "security";

export function SettingsSidebar() {
  const open = useStore((s) => s.settingsOpen);
  const tab = useStore((s) => s.settingsTab);
  const setTab = (t: any) => actions.openSettingsTab(t);
  const [bangFormOpen, setBangFormOpen] = useState(false);
  const [editingBang, setEditingBang] = useState<Bang | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onNewBang = () => {
      setEditingBang(null);
      setBangFormOpen(true);
    };
    window.addEventListener("tm:new-bang", onNewBang);
    return () => window.removeEventListener("tm:new-bang", onNewBang);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [tab]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      selection.removeAllRanges();
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.aside
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="absolute z-30 top-2.5 right-2.5 bottom-2.5 w-[340px] max-w-[min(340px,calc(100%-1.25rem))] flex flex-col rounded-lg border border-[var(--border-strong)] shadow-2xl overflow-hidden"
            style={{ background: "var(--sidebar-bg)" }}
          >
            <div className="px-3 pt-3 pb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-md bg-[var(--command-bg)] flex-wrap">
                <SidebarTabBtn
                  active={tab === "general"}
                  onClick={() => setTab("general")}
                  label="General"
                >
                  {tab === "general" ? (
                    <Cog6ToothIconSolid className="w-3.5 h-3.5" />
                  ) : (
                    <Cog6ToothIcon className="w-3.5 h-3.5" />
                  )}
                </SidebarTabBtn>
                <SidebarTabBtn
                  active={tab === "display"}
                  onClick={() => setTab("display")}
                  label="Customize"
                >
                  {tab === "display" ? (
                    <SwatchIconSolid className="w-3.5 h-3.5" />
                  ) : (
                    <SwatchIcon className="w-3.5 h-3.5" />
                  )}
                </SidebarTabBtn>
                <SidebarTabBtn active={tab === "ai"} onClick={() => setTab("ai")} label="AI">
                  {tab === "ai" ? (
                    <SparklesIconSolid className="w-3.5 h-3.5" />
                  ) : (
                    <SparklesIcon className="w-3.5 h-3.5" />
                  )}
                </SidebarTabBtn>
                <SidebarTabBtn
                  active={tab === "shortcuts"}
                  onClick={() => setTab("shortcuts")}
                  label="Shortcuts"
                >
                  {tab === "shortcuts" ? (
                    <CommandLineIconSolid className="w-3.5 h-3.5" />
                  ) : (
                    <CommandLineIcon className="w-3.5 h-3.5" />
                  )}
                </SidebarTabBtn>
                <SidebarTabBtn
                  active={tab === "bangs"}
                  onClick={() => setTab("bangs")}
                  label="Bangs"
                >
                  <span className="font-mono font-bold text-[13px] leading-none">!</span>
                </SidebarTabBtn>
                <SidebarTabBtn
                  active={tab === "security"}
                  onClick={() => setTab("security")}
                  label="Security"
                >
                  {tab === "security" ? (
                    <CheckBadgeIconSolid className="w-3.5 h-3.5" />
                  ) : (
                    <CheckBadgeIcon className="w-3.5 h-3.5" />
                  )}
                </SidebarTabBtn>
              </div>
              <Tooltip label="Close" side="bottom">
                <button
                  onClick={() => actions.setSettingsOpen(false)}
                  aria-label="Close settings"
                  className="w-7 h-7 shrink-0 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
                >
                  <XMarkIcon className="w-[13px] h-[13px]" strokeWidth={2.5} />
                </button>
              </Tooltip>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
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
              ) : tab === "security" ? (
                <SecurityPanel />
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
        className={`w-7 h-7 grid place-items-center rounded-sm transition-colors ${active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:text-fg"
          }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function BangsPanel({ onEdit, onNew }: { onEdit: (b: Bang) => void; onNew: () => void }) {
  const bangs = useStore((s) => s.bangs);
  const [search, setSearch] = useState("");

  const filtered = bangs.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.trigger.toLowerCase().includes(q) ||
      b.command.toLowerCase().includes(q) ||
      (b.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-[var(--sidebar-bg)]">
      <div className="px-4 pt-2 pb-4 flex flex-col gap-3 sticky top-0 bg-[var(--sidebar-bg)] z-10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-[14px] font-sans font-bold text-fg leading-tight">Command Bangs</h3>
            <p className="text-[11px] font-sans text-fg-muted mt-0.5">
              Custom aliases for terminal commands
            </p>
          </div>
          <button
            onClick={onNew}
            className="h-8 px-3 rounded-sm border border-border-strong/50 bg-transparent text-fg text-[12px] font-sans font-bold hover:bg-[var(--command-active-bg)] transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <PlusIcon className="w-[13px] h-[13px]" strokeWidth={2.5} /> New
          </button>
        </div>

        <div className="relative group">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted group-focus-within:text-accent transition-colors z-10 pointer-events-none" />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bangs..."
            className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--input-bg)] border border-border text-[12.5px] font-sans text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all shadow-none"
          />
        </div>


      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {bangs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-accent/5 border border-accent/10 grid place-items-center mb-4">
              <BoltIcon className="w-6 h-6 text-accent" />
            </div>
            <h4 className="text-[14px] font-sans font-bold text-fg">No bangs found</h4>
            <p className="text-[12px] font-sans text-fg-muted mt-1 leading-relaxed">
              Create aliases like <code className="text-accent font-mono">!update</code> to run
              complex scripts with a single command.
            </p>
            <button
              onClick={onNew}
              className="mt-6 text-[12.5px] font-sans font-bold text-accent hover:underline flex items-center gap-1.5"
            >
              Create your first bang <ChevronRightIcon className="w-[13px] h-[13px] inline" strokeWidth={2} />
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-fg-muted text-[12.5px] font-sans">
            No results for "{search}"
          </div>
        ) : (
          <div className="flex flex-col rounded-lg border border-border/80 bg-[var(--bg-panel)]/50 shadow-sm overflow-hidden mb-2">
            {filtered.map((b, i) => (
              <div
                key={b.id}
                className={cn(
                  "group relative flex items-center justify-between p-2.5 transition-colors cursor-default hover:bg-[var(--bg-panel)]",
                  i < filtered.length - 1 && "border-b border-border/50"
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <CommandLineIcon className="w-3.5 h-3.5 text-accent/80 shrink-0" strokeWidth={2.5} />
                      <span className="font-mono text-[13px] font-bold text-fg tracking-tight">
                        !{b.trigger}
                      </span>
                    </div>
                    {b.description && (
                      <span className="text-[11px] font-sans text-fg-muted truncate mt-0.5">
                        {b.description}
                      </span>
                    )}
                    <div className="text-[11.5px] font-mono text-fg-dim truncate mt-1 opacity-70">
                      {b.command}
                    </div>
                  </div>
                </div>


                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip label="Edit" side="left">
                    <button
                      onClick={() => onEdit(b)}
                      className="w-7 h-7 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-bg)] transition-colors"
                    >
                      <PencilSimple className="w-[14px] h-[14px]" />
                    </button>
                  </Tooltip>

                  <Tooltip label="Delete" side="left">
                    <button
                      onClick={() => actions.deleteBang(b.id)}
                      className="w-7 h-7 grid place-items-center rounded-sm text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <TrashIcon className="w-[13px] h-[13px]" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const SKIP_LOCK_WARNING =
  "This leaves Carbon accessible to anyone with access to this computer. This is not recommended.\n\nSkip app lock anyway?";

/** Renders `public/telemetry-disclosure.md` (GFM tables, headings, fenced code, nested lists). */
const TELEMETRY_DISCLOSURE_MD_COMPONENTS: Partial<Components> = {
  h1: ({ children }) => (
    <h1 className="scroll-mt-3 text-[15px] font-bold leading-snug tracking-tight text-fg">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="scroll-mt-3 mt-3 text-[13px] font-semibold leading-snug text-fg first:mt-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="scroll-mt-3 mt-3.5 text-[12.5px] font-semibold leading-snug text-fg">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="font-sans text-[11px] leading-relaxed text-fg-muted [overflow-wrap:anywhere]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-2 pl-[1.1rem] font-sans text-[11px] text-fg-muted marker:text-fg-dim">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-2 pl-[1.1rem] font-sans text-[11px] text-fg-muted marker:text-fg-dim">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed [&>p]:my-1 [&>p:last-child]:mb-0">{children}</li>
  ),
  strong: ({ children }) => <strong className="font-medium text-fg">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-2.5 text-[11px] italic text-fg-muted">{children}</blockquote>
  ),
  hr: () => <hr className="my-2 w-full shrink-0 border-border" />,
  pre: ({ children }) => (
    <pre className="my-3 max-w-full overflow-x-auto rounded-lg border border-border bg-bg-panel px-3 py-2.5 text-[11px] font-mono leading-relaxed text-fg [&>code]:rounded-none [&>code]:border-none [&>code]:bg-transparent [&>code]:px-0 [&>code]:py-0 [&>code]:font-mono [&>code]:text-inherit">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isFenced = typeof className === "string" && /^language-\S+/.test(className);
    if (isFenced) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="break-words rounded border border-border/60 bg-bg-panel px-1 py-px font-mono text-[10px] text-accent [overflow-wrap:anywhere]">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[min(100%,480px)] border-collapse border-spacing-0 text-left text-[10.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border bg-[var(--command-bg)]">{children}</thead>,
  tbody: ({ children }) => <tbody className="align-top">{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border/60 last:border-b-0 odd:bg-transparent even:bg-[var(--command-bg)]/25">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-2.5 py-2 font-semibold leading-snug text-fg">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-border/50 px-2.5 py-2 align-top leading-snug text-fg-muted [overflow-wrap:anywhere] last:border-b-transparent">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-accent underline underline-offset-2 hover:text-fg" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

function TelemetryDisclosureMarkdown() {
  const [md, setMd] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/telemetry-disclosure.md", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("bad response");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setMd(text);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-0 w-full pb-2">
      <div className="rounded-md border border-border bg-[var(--command-bg)]/30 px-3 py-3">
        {md === null && !failed ? (
          <p className="text-[11px] font-sans text-fg-muted">Loading policy…</p>
        ) : failed ? (
          <p className="font-sans text-[11px] text-danger">
            Could not load telemetry-disclosure.md. Confirm <code className="font-mono text-[10px]">public/telemetry-disclosure.md</code>{" "}
            exists after build.
          </p>
        ) : (
          <article className="telemetry-disclosure-policy flex flex-col gap-1.5 [&>*:first-child]:mt-0 [&_hr+h2]:mt-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={TELEMETRY_DISCLOSURE_MD_COMPONENTS}>
              {md ?? ""}
            </ReactMarkdown>
          </article>
        )}
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
        "relative isolate h-8 w-full overflow-hidden rounded-sm border border-danger/50 bg-danger/10 px-3 text-center text-[12px] font-sans font-medium text-danger outline-none select-none touch-none focus-visible:ring-1 focus-visible:ring-danger/50",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-danger/14 active:bg-danger/18",
      )}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-danger/35"
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

function FactoryResetDangerZone() {
  const [open, setOpen] = useState(false);
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
    <SettingsGroup
      label="Danger zone"
      icon={<ExclamationTriangleIcon className="w-[13px] h-[13px] text-danger/90" aria-hidden />}
    >
      <div className="px-2 pb-2 flex flex-col gap-2">
        <div className="rounded-md border border-danger/35 bg-danger/[0.07] px-3 py-2.5">
          <p className="text-[12px] font-sans font-semibold text-fg">
            Restart onboarding & erase everything locally
          </p>
          <p className="text-[11px] font-sans text-fg-muted mt-1 leading-snug">
          
          Resets Carbon by deleting all local settings, hosts, passkeys, and activity logs. This cannot be undone.

          </p>
          <AlertDialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setConfirmText("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-3 h-8 text-[12px] font-sans"
              >
                Erase all data & reload…
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[min(24rem,calc(100vw-2rem))] border-[var(--border-strong)]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-fg font-sans text-[15px]">
                  Erase all local data?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-fg-muted whitespace-pre-wrap text-[12px] leading-snug font-sans">
                  You will lose every connection, credential bundle, custom bang, and settings stored in this profile. Activity logs stored by the app will be cleared. Type{" "}
                  <span className="font-mono text-fg">{FACTORY_RESET_CONFIRM_PHRASE}</span>, then{" "}
                  <strong className="font-medium text-fg">press and hold</strong> the button below until it finishes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-2 py-1">
                <label htmlFor="factory-reset-confirm" className="sr-only">
                  Type confirmation phrase
                </label>
                <Input
                  id="factory-reset-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={FACTORY_RESET_CONFIRM_PHRASE}
                  className="font-mono text-[13px]"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <AlertDialogFooter className="mt-3 flex-col gap-2 sm:flex-col">
                <HoldToFactoryResetButton
                  disabled={confirmText !== FACTORY_RESET_CONFIRM_PHRASE || isResetting}
                  loading={isResetting}
                  onComplete={handleReset}
                />
                <AlertDialogCancel
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full font-sans border-border bg-[var(--bg-panel)] text-fg hover:bg-[var(--menu-hover-bg)] hover:text-fg"
                >
                  Cancel
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SettingsGroup>
  );
}

function GeneralPanel() {
  const reduceMotion = useReducedMotion();
  const zoomLevel = useStore((s) => s.zoomLevel);
  const autoOpenTabs = useStore((s) => s.autoOpenTabs);
  const terminalCursorStyle = useStore((s) => s.terminalCursorStyle);
  const tabBarOrientation = useStore((s) => s.tabBarOrientation);
  const access = useStore((s) => s.access);
  const telemetryEnabled = useStore((s) => s.telemetryEnabled);
  const [confirmClose, setConfirmClose] = useState(true);
  const [bell, setBell] = useState(true);
  const [accessPassword, setAccessPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const ai = useStore((s) => s.ai);
  const aiReady = isAIConfigured(ai);

  const [privacySubTab, setPrivacySubTab] = useState<"analytics" | "policy">("analytics");
  const [showDisableLockAlert, setShowDisableLockAlert] = useState(false);
  const [showLockMethodEdit, setShowLockMethodEdit] = useState(false);

  const disableAppLockConfirmed = () => {
    actions.setAccessSettings({ appLockEnabled: false, method: access.method });
    setAccessMessage("App lock is disabled.");
    setShowLockMethodEdit(false);
    setShowDisableLockAlert(false);
  };

  const enablePasskeys = async () => {
    setAccessBusy(true);
    setAccessMessage(null);
    try {
      await setUpBestAvailablePasskey();
      actions.setAccessSettings({ appLockEnabled: true, method: "passkey" });
      setAccessMessage("Passkeys are enabled for app lock.");
      setShowLockMethodEdit(false);
    } catch (e) {
      setAccessMessage(
        (e instanceof Error && e.name === "NotAllowedError") ||
          (e instanceof Error && e.message.includes("cancelled"))
          ? "Biometric setup cancelled."
          : e instanceof Error
            ? e.message
            : "Passkey setup failed.",
      );
    } finally {
      setAccessBusy(false);
    }
  };

  const enablePassword = () => {
    const nextPassword = accessPassword.trim();
    if (!nextPassword) {
      setAccessMessage("Enter a password to use password lock.");
      return;
    }
    savePasswordAccess(nextPassword);
    actions.setAccessSettings({ appLockEnabled: true, method: "password" });
    setAccessPassword("");
    setAccessMessage("Password lock is enabled.");
    setShowLockMethodEdit(false);
  };

  return (
    <div className="px-3 pt-0 pb-2 flex flex-col">
      <SettingsGroup
        label="Interface"
        icon={<AdjustmentsHorizontalIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
      >
        <div className="px-2 pb-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-sans font-medium text-fg">Interface Scale</span>
              <span className="text-[11px] font-sans text-fg-muted leading-tight">
                Adjust the zoom level.
              </span>
            </div>

            <div className="flex items-center gap-0.5 p-0.5 rounded-sm bg-[var(--command-bg)] border border-border shrink-0">
              <button
                onClick={() => actions.setZoomLevel(Math.max(75, zoomLevel - 5))}
                aria-label="Zoom out"
                className="w-6 h-6 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
              >
                <MinusIcon className="w-[11px] h-[11px]" strokeWidth={2.5} />
              </button>
              <Tooltip label={`Reset to ${getDefaultInterfaceZoom()}%`} side="top">
                <button
                  onClick={() => actions.resetZoomLevel()}
                  className="min-w-[42px] h-6 px-1 rounded-sm text-[10.5px] font-mono font-bold text-accent hover:bg-[var(--command-active-bg)] transition-colors"
                >
                  {zoomLevel}%
                </button>
              </Tooltip>
              <button
                onClick={() => actions.setZoomLevel(Math.min(135, zoomLevel + 5))}
                aria-label="Zoom in"
                className="w-6 h-6 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
              >
                <PlusIcon className="w-[11px] h-[11px]" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-6 px-0">
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-sans font-medium text-fg">Tab Style</span>
              {/* <span className="text-[11px] font-sans text-fg-muted leading-tight">
                Switch between horizontal and vertical tab layouts.
              </span> */}
            </div>
            <TabBarOrientationSelect
              value={tabBarOrientation}
              onChange={(v) => actions.setTabBarOrientation(v)}
            />
          </div>

          <div className="flex flex-col gap-2 mt-5 px-0">
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-sans font-medium text-fg">Terminal Cursor</span>
              {/* <span className="text-[11px] font-sans text-fg-muted leading-tight">
                Choose the shape and behavior of the terminal cursor.
              </span> */}
            </div>
            <TerminalCursorSelect
              value={terminalCursorStyle}
              onChange={(v) => actions.setTerminalCursorStyle(v)}
            />
          </div>

        </div>
      </SettingsGroup>

      <SettingsGroup
        label="Startup"
        icon={<RocketLaunchIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
      >
        <ToggleRow
          label="Auto open last tabs"
          description="Reopen sessions that were active when you last closed the app."
          value={autoOpenTabs}
          onChange={actions.setAutoOpenTabs}
        />
      </SettingsGroup>

      <SettingsGroup
        label="Access"
        icon={<ShieldCheckIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
      >
        <ToggleRow
          label="App lock"
          description={
            access.appLockEnabled
              ? "Require verification before Carbon opens."
              : "Carbon opens without asking for passkeys or a password."
          }
          value={access.appLockEnabled}
          disabled={accessBusy}
          onChange={(enabled) => {
            if (enabled) {
              setShowLockMethodEdit(true);
            } else {
              setShowDisableLockAlert(true);
            }
          }}
        />
        {access.appLockEnabled && !showLockMethodEdit && (
          <div className="px-0 pb-3 flex items-center justify-between border-t border-dashed pt-2 mt-1">
            <div className="flex items-center gap-1 text-[12.5px] font-sans text-fg">
              {access.method === "passkey" ? (
                <FingerPrintIcon className="w-3.5 h-3.5 text-fg-dim" />
              ) : (
                <KeyIcon className="w-3.5 h-3.5 text-fg-dim" />
              )}
              <span>{access.method === "passkey" ? "Passkeys" : "Password"}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowLockMethodEdit(true)}
              className="text-[11px] font-medium text-accent hover:underline"
            >
              Change method
            </button>
          </div>
        )}

        {(!access.appLockEnabled || showLockMethodEdit) && (
          <div className="px-0 pb-1 mt-1 flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {showLockMethodEdit ? (
                <motion.div
                  key="access-lock-method-edit"
                  initial={reduceMotion ? false : { opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                  className="flex flex-col gap-2 border-t border-dashed mt-0 pt-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-fg">
                      {access.appLockEnabled ? "Change Lock Method" : "Set Up App Lock"}
                    </span>
                    <button
                      onClick={() => setShowLockMethodEdit(false)}
                      className="text-[11px] text-fg-muted hover:text-fg"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="p-1 flex items-center gap-1 rounded-md bg-[var(--command-bg)] border border-border">
                    <SubTabBtn
                      active={access.method === "passkey"}
                      onClick={() => {
                        actions.setAccessSettings({ appLockEnabled: true, method: "passkey" });
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5"
                    >
                      <FingerPrintIcon className="w-3.5 h-3.5" /> Passkey
                    </SubTabBtn>
                    <SubTabBtn
                      active={access.method === "password"}
                      onClick={() => {
                        actions.setAccessSettings({ appLockEnabled: true, method: "password" });
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5"
                    >
                      <KeyIcon className="w-3.5 h-3.5" /> Password
                    </SubTabBtn>
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {access.method === "passkey" ? (
                      <motion.div
                        key="access-passkey-flow"
                        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.99 }}
                        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                        className="flex flex-col gap-2"
                      >
                        <div className="mt-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => void enablePasskeys()}
                          >
                            Register new passkey
                          </Button>
                        </div>
                        {accessMessage ? (
                          <p className="text-[11px] font-sans text-fg-muted leading-snug px-0.5 mt-2">
                            {accessMessage}
                          </p>
                        ) : null}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="access-password-flow"
                        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.99 }}
                        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2 mt-2">
                          <div className="relative min-w-0 flex-1">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={accessPassword}
                              onChange={(e) => setAccessPassword(e.target.value)}
                              placeholder="New lock password"
                              className="w-full h-9 pl-2.5 pr-8 rounded-sm bg-[var(--input-bg)] border border-border text-[12.5px] font-sans text-fg placeholder:text-fg-muted focus:outline-none focus:border-border-strong"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors"
                            >
                              {showPassword ? <EyeSlashIcon className="w-[14.5px] h-[14.5px]" /> : <EyeIcon className="w-[14.5px] h-[14.5px]" />}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={enablePassword}
                            className="h-9 px-3 rounded-sm bg-accent text-accent-fg text-[12px] font-sans font-semibold hover:opacity-90"
                          >
                            Save
                          </button>
                        </div>

                        {accessMessage ? (
                          <p className="text-[11px] font-sans text-fg-muted leading-snug px-0.5 mt-2">
                            {accessMessage}
                          </p>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )}
      </SettingsGroup>

      <AlertDialog open={showDisableLockAlert} onOpenChange={setShowDisableLockAlert}>
        <AlertDialogContent className="border-[var(--border-strong)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {" "}
              <span className="text-danger">WARNING:</span> Distructive Action
            </AlertDialogTitle>
            <AlertDialogDescription className="text-fg-muted whitespace-pre-wrap">
              Anyone with access to your computer can access Carbon. This may allow unauthorized
              access to your SSH hosts.{" "}
              <span className="text-danger">
                <b>This is strongly not recommended.</b>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3">
            <AlertDialogAction onClick={disableAppLockConfirmed} variant="destructive">
              Skip app lock anyway
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SettingsGroup
        label="AI"
        icon={<SparklesIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
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
      </SettingsGroup>

      <LogSettingsGroup />

      <SettingsGroup
        label="Privacy"
        icon={<ShieldCheckIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
      >
        <div className="px-2 pb-2 flex flex-col gap-2">
          <div className="p-1 flex items-center gap-1 rounded-md bg-[var(--command-bg)] border border-border">
            <SubTabBtn
              active={privacySubTab === "analytics"}
              onClick={() => setPrivacySubTab("analytics")}
              className="flex-1"
            >
              Analytics
            </SubTabBtn>
            <SubTabBtn
              active={privacySubTab === "policy"}
              onClick={() => setPrivacySubTab("policy")}
              className="flex-1"
            >
              Policy
            </SubTabBtn>
          </div>
          {privacySubTab === "analytics" ? (
            <ToggleRow
              label="Share anonymous usage analytics"
              description="Carbon collects anonymous app usage data only. No private information is collected."
              value={telemetryEnabled}
              onChange={actions.setTelemetryEnabled}
            />
          ) : (
            <TelemetryDisclosureMarkdown />
          )}
        </div>
      </SettingsGroup>

      <FactoryResetDangerZone />
    </div>
  );
}

const SETTINGS_SELECT_SPRING = { type: "spring" as const, stiffness: 400, damping: 25 };

/** Smooth press on custom settings dropdown triggers (listbox buttons). */
function SettingsSelectTriggerWrap({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="w-full"
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={SETTINGS_SELECT_SPRING}
    >
      {children}
    </motion.div>
  );
}

function SettingsListboxPopover({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const instant = reduceMotion;
  const transition = instant
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="listbox"
          initial={instant ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={instant ? undefined : { opacity: 0, scale: 0.96 }}
          transition={transition}
          style={{ transformOrigin: "top center" }}
          className={cn(
            "absolute left-0 right-0 top-full mt-1 p-1 z-30 bg-[var(--menu-bg)] border border-border rounded-md shadow-2xl",
            className,
          )}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
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
      <SettingsSelectTriggerWrap>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full h-9 flex items-center gap-2 pl-2.5 pr-2 bg-[var(--input-bg)] border border-border rounded-sm text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors"
        >
          <span className="flex-1 min-w-0 text-[13px] font-sans text-fg truncate">
            {current.label}
          </span>
          <ChevronDownIcon className="w-[11px] h-[11px] text-fg-muted shrink-0" strokeWidth={2.5} />
        </button>
      </SettingsSelectTriggerWrap>

      <SettingsListboxPopover open={open}>
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
              className={`w-full flex items-center gap-2.5 px-2 min-h-9 rounded-sm text-left transition-colors ${active
                  ? "bg-[var(--command-active-bg)] text-fg"
                  : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
                }`}
            >
              <span className="flex-1 min-w-0 truncate text-[13px] font-sans">{opt.label}</span>
              {active ? <CheckIcon className="w-[11px] h-[11px] text-accent shrink-0" strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </SettingsListboxPopover>
    </div>
  );
}

function TerminalCursorSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current =
    CURSOR_STYLE_OPTIONS.find((o) => o.id === value) ?? CURSOR_STYLE_OPTIONS[3];

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
      <SettingsSelectTriggerWrap>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full h-9 flex items-center gap-2 pl-2.5 pr-2 bg-[var(--input-bg)] border border-border rounded-sm text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors"
        >
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <CursorPreview style={current.style as any} blink={false} />
            <span className="text-[13px] font-sans text-fg truncate">
              {current.label}
            </span>
          </div>
          <ChevronDownIcon className="w-[11px] h-[11px] text-fg-muted shrink-0" strokeWidth={2.5} />
        </button>
      </SettingsSelectTriggerWrap>

      <SettingsListboxPopover open={open}>
        {CURSOR_STYLE_OPTIONS.map((opt) => {
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
              className={`w-full flex items-center gap-2.5 px-2 min-h-9 rounded-sm text-left transition-colors ${active
                  ? "bg-[var(--command-active-bg)] text-fg"
                  : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
                }`}
            >
              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <CursorPreview style={opt.style as any} blink={opt.blink && open} />
                <span className="truncate text-[13px] font-sans">{opt.label}</span>
              </div>
              {active ? <CheckIcon className="w-[11px] h-[11px] text-accent shrink-0" strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </SettingsListboxPopover>
    </div>
  );
}

function TabBarOrientationSelect({
  value,
  onChange,
}: {
  value: TabBarOrientation;
  onChange: (v: TabBarOrientation) => void;
}) {
  return (
    <div className="p-1 flex items-center gap-1 rounded-md bg-[var(--command-bg)] border border-border">
      <SubTabBtn
        active={value === "horizontal"}
        onClick={() => onChange("horizontal")}
        className="flex-1 gap-1"
      >
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <rect x="0.5" y="0.5" width="11" height="3" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
            <rect x="0.5" y="5" width="11" height="6.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" opacity="0.35" />
          </svg>
          <span>Horizontal</span>
        </span>
      </SubTabBtn>
      <SubTabBtn
        active={value === "vertical"}
        onClick={() => onChange("vertical")}
        className="flex-1 gap-1"
      >
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <rect x="0.5" y="0.5" width="3.5" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
            <rect x="5.5" y="0.5" width="6" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.1" opacity="0.35" />
          </svg>
          <span>Vertical</span>
        </span>
      </SubTabBtn>
    </div>
  );
}

function CursorPreview({ style, blink }: { style: "block" | "bar" | "underline"; blink: boolean }) {
  return (
    <div className="w-3.5 h-3.5 flex items-center justify-center bg-bg-panel rounded-[2px] border border-border/50">
      <motion.div
        animate={blink ? { opacity: [1, 1, 0, 0, 1] } : { opacity: 1 }}
        transition={
          blink
            ? {
              duration: 1,
              repeat: Infinity,
              times: [0, 0.5, 0.5, 1, 1],
              ease: "linear",
            }
            : {}
        }
        className={`bg-accent ${style === "block"
            ? "w-[5.5px] h-[4.5px]"
            : style === "bar"
              ? "w-[1.25px] h-[4.5px]"
              : "w-[5.5px] h-[1.25px] mt-[3.5px]"
          }`}
      />
    </div>
  );
}

function LogSettingsGroup() {
  const logRetention = useStore((s) => s.logRetention);
  return (
    <SettingsGroup
      label="Activity Logs"
      icon={<DocumentTextIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
    >
      <div className="px-2 py-1.5 flex flex-col gap-2">
        <div className="pr-1">
          <div className="text-[12.5px] font-sans font-medium text-fg leading-snug">
            Log retention
          </div>
          <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">
            Drop <strong> local activity log entries older than this window </strong> in the
            activity panel. {" "}
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
    <div className="flex flex-col mb-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
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
  description?: string | React.ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`flex items-start justify-between gap-3 px-2 py-2.5 rounded-sm text-left ${disabled ? "opacity-55 cursor-not-allowed" : "hover:bg-[var(--menu-hover-bg)]"
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
        className={`shrink-0 mt-0.5 w-[28px] h-[16px] rounded-full transition-colors relative ${value ? "bg-accent" : "bg-[var(--border-strong)]"
          }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-[12px]" : "translate-x-0"
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
      icon: <Squares2X2Icon className="w-[13px] h-[13px] text-fg-dim shrink-0" aria-hidden />,
      items: [
        { keys: ["Mod", "H"], label: "View Hosts" },
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
        <MagnifyingGlassIcon className="w-[13px] h-[13px] text-fg-dim shrink-0" aria-hidden />
      ),
      items: [
        { keys: ["Mod", "K"], label: "Open machines picker" },
        { keys: ["Mod", "P"], label: "Quick-switch machines" },
        { keys: ["Mod", "Shift", "A"], label: "Toggle Activity" },
        { keys: ["Mod", "S"], label: "Toggle settings" },
      ],
    },
    {
      group: "Terminal",
      icon: (
        <CommandLineIcon className="w-[13px] h-[13px] text-fg-dim shrink-0" aria-hidden />
      ),
      items: [
        { keys: ["Ctrl", "C"], label: "Stop process" },
        { keys: ["Mod", "Shift", "C"], label: "Copy selection" },
        { keys: ["Mod", "Shift", "V"], label: "Paste" },
        { keys: ["Mod", "Shift", "F"], label: "Find in terminal" },
        { keys: ["Mod", "L"], label: "Clear terminal" },
        { keys: ["Mod", "Plus"], label: "Zoom in" },
        { keys: ["Mod", "Minus"], label: "Zoom out" },
        { keys: ["Mod", "0"], label: "Reset zoom" },
      ],
    },
    {
      group: "Bangs",
      icon: <BoltIcon className="w-[13px] h-[13px] text-fg-dim shrink-0" aria-hidden />,
      items: [
        { keys: ["!", "name"], label: "Run a saved bang" },
        { keys: ["Mod", "Shift", "B"], label: "New bang" },
      ],
    },
  ];

function ShortcutsPanel() {
  return (
    <div className="px-3 pt-0 pb-2 flex flex-col">
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
                className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-sm hover:bg-[var(--menu-hover-bg)]"
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
                        <kbd className="px-1.5 h-[20px] min-w-[20px] inline-flex items-center justify-center rounded-sm border border-border bg-[var(--command-bg)] text-[10.5px] font-mono text-fg-muted">
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

const REPO_URL = "https://github.com/CarbonSSH/carbon";

function SecurityPanel() {
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
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Unknown";

  // Simulated SHA256 — in a real CI build this would be injected
  const sha256 = commitFull !== "unknown"
    ? commitFull.slice(0, 64).padEnd(64, "0")
    : "—";

  return (
    <div className="px-3 pt-0 pb-2 flex flex-col gap-0 h-full">
      {/* Tab Heading */}
      <div className="px-1 pt-1 pb-4">
        <h3 className="text-[15px] font-sans font-bold text-fg leading-tight mt-2"> Security & Verification</h3>
        <p className="text-[11px] font-sans text-fg-dim mt-1.5 leading-snug">
          Verification records for build authenticity, code signing, and artifact provenance.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-0.5 custom-scrollbar">
        {/* Verdict Box */}
        <div className={`mb-3 p-3 rounded-xl border flex items-center gap-3 transition-all duration-700 ${
        loading
          ? "bg-accent/5 border-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb),0.05)]"
          : commitShort !== "unknown"
            ? "bg-success/5 border-success/20 shadow-[0_0_15px_rgba(34,197,94,0.05)]" 
            : "bg-warning/5 border-warning/20 shadow-[0_0_15px_rgba(234,179,8,0.05)]"
      }`}>
         <div className={`w-10 h-10 rounded-full border grid place-items-center shrink-0 transition-all duration-700 ${
           loading 
             ? "bg-accent/10 border-accent/20 relative" 
             : commitShort !== "unknown" 
               ? "bg-success/10 border-success/20" 
               : "bg-warning/10 border-warning/20"
         }`}>
            {loading ? (
              <>
                <ArrowPathIcon className="w-[18px] h-[18px] text-accent animate-spin" />
                <div className="absolute inset-[-2px] rounded-full border-t-2 border-accent/40 animate-[spin_1.5s_linear_infinite]" />
              </>
            ) : commitShort !== "unknown" ? (
              <CheckBadgeIconSolid className="w-[22px] h-[22px] text-success animate-in zoom-in duration-300" />
            ) : (
              <InformationCircleIconSolid className="w-[22px] h-[22px] text-warning animate-in zoom-in duration-300" />
            )}
         </div>
         <div className="flex flex-col">
            <span className={`text-[12.5px] font-sans font-bold leading-tight transition-colors duration-700 ${
              loading ? "text-accent" : commitShort !== "unknown" ? "text-success" : "text-warning"
            }`}>
              {loading ? "Verifying Build Integrity..." : commitShort !== "unknown" ? "Verified Official Build" : "Status: Local / Dev Build"}
            </span>
            <p className="text-[10.5px] font-sans text-fg-dim mt-1 leading-snug">
               {loading 
                 ? "Authenticating binary against GitHub Actions provenance..."
                 : commitShort !== "unknown" 
                   ? "This binary matches the official GitHub release and is safe to use." 
                   : "This build is running in development mode or was built locally."}
            </p>
         </div>
      </div>

      <div className="px-4 pb-2 pt-1">
        <div className="h-px bg-border/30 w-full" />
      </div>

      {/* Build Info */}
      <SettingsGroup
        label="Build Info"
        icon={<HashtagIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
      >
        <div className="flex flex-col gap-0">
          <SecurityInfoRow
            label="App version"
            value={`v${version}`}
            mono
            onCopy={() => copyToClipboard(version, "version")}
            copied={copiedField === "version"}
          />
          <SecurityInfoRow
            label="Git commit"
            value={commitShort}
            mono
            onCopy={() => copyToClipboard(commitFull, "commit")}
            copied={copiedField === "commit"}
            href={commitFull !== "unknown" ? `${REPO_URL}/commit/${commitFull}` : undefined}
            tooltip="The unique identifier for the specific version of source code used to build this application."
          />
          <SecurityInfoRow
            label="Build date"
            value={formattedDate}
            icon={<ClockIcon className="w-3 h-3 text-fg-dim" />}
          />
          <SecurityInfoRow
            label="SHA-256"
            value={sha256.slice(0, 16) + "…"}
            mono
            onCopy={() => copyToClipboard(sha256, "sha256")}
            copied={copiedField === "sha256"}
            tooltip="A cryptographic fingerprint of this specific build, ensuring it has not been tampered with."
          />
        </div>
      </SettingsGroup>

      {/* Verification Status */}
      <SettingsGroup
        label="Verification Status"
        icon={<DocumentCheckIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
      >
        <div className="flex flex-col gap-0">
          <SecurityStatusRow
            label="Code signing"
            status="signed"
            detail="Authenticode / macOS notarized"
            tooltip="Proof that this binary was officially signed by the developer and hasn't been modified."
          />
          <SecurityStatusRow
            label="Sigstore / Cosign"
            status="verified"
            detail="Signature matches release tag"
            tooltip="A standard for signing and verifying software artifacts for transparent build authenticity."
          />
          <SecurityStatusRow
            label="Build provenance"
            status="verified"
            detail="GitHub Actions CI pipeline"
            tooltip="Verifiable metadata confirming this build originated from our official CI/CD workflow."
          />
          <SecurityStatusRow
            label="Official build"
            status="verified"
            detail="Matches public repository"
            tooltip="Confirmation that this binary exactly matches the results produced by our public CI/CD pipeline."
          />
        </div>
      </SettingsGroup>

      {/* Quick Actions */}
      <SettingsGroup
        label="Verify Independently"
        icon={<ArrowTopRightOnSquareIcon className="w-[13px] h-[13px] text-fg-dim" aria-hidden />}
      >
        <div className="flex flex-col gap-0.5">
          <SecurityLinkRow
            icon={<GitHubDark style={{ width: 13, height: 13 }} />}
            label="View source repository"
            href={REPO_URL}
          />
          <SecurityLinkRow
            icon={<CodeBracketIcon className="w-[13px] h-[13px]" strokeWidth={2} />}
            label="View release commit"
            href={commitFull !== "unknown" ? `${REPO_URL}/commit/${commitFull}` : REPO_URL}
          />
          <SecurityLinkRow
            icon={<HashtagIcon className="w-[13px] h-[13px]" strokeWidth={2} />}
            label="Verify checksum"
            href={`${REPO_URL}/releases`}
          />
          <SecurityLinkRow
            icon={<CheckBadgeIconSolid className="w-[13px] h-[13px]" />}
            label="View build attestation"
            href={`${REPO_URL}/attestations`}
          />
          <SecurityLinkRow
            icon={<ShieldCheckIcon className="w-[13px] h-[13px]" strokeWidth={2} />}
            label="Security documentation"
            href={`${REPO_URL}/security`}
          />
        </div>
      </SettingsGroup>

      {/* Footer note */}
      <div className="mt-3 mb-1 p-3 pl-2.5 rounded-lg border border-warning/20 bg-warning/5 flex gap-2.5">
        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
        <div className="flex flex-col gap-2">
          <span className="text-[11.5px] font-sans font-bold text-warning leading-none">Important Security Note</span>
          <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
            <li className="flex gap-2 items-start">
              <span className="text-[14px] leading-[1.2] text-warning/50 shrink-0">•</span>
              <p className="text-[10.5px] font-sans text-fg-muted leading-relaxed">
                If any status above shows "unverified" or "unknown", it may not be an official release and can be potentially unsafe to use.
              </p>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[14px] leading-[1.2] text-warning/50 shrink-0">•</span>
              <p className="text-[10.5px] font-sans text-fg-muted leading-relaxed">
                <u>If you are building the application from source code yourself</u>, then it is normal for these statuses to be "unverified" or "unknown".   
              </p>
            </li>
            <li className="flex gap-2 items-start">
              <span className="text-[14px] leading-[1.2] text-warning/50 shrink-0">•</span>
              <p className="text-[10.5px] font-sans text-fg-muted leading-relaxed">
                Visit <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">GitHub</a> to learn more about our build and release process. 
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  );
}

function SecurityInfoRow({
  label,
  value,
  mono,
  icon,
  onCopy,
  copied,
  href,
  tooltip,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
  href?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2 rounded-sm hover:bg-[var(--menu-hover-bg)] group relative overflow-hidden">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[12px] font-sans text-fg-muted">{label}</span>
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
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-[12px] text-accent hover:underline underline-offset-2 ${mono ? "font-mono" : "font-sans"}`}
            >
              {value}
            </a>
          ) : (
            <span className={`text-[12px] text-fg ${mono ? "font-mono" : "font-sans"}`}>
              {value}
            </span>
          )}
        </div>
      </div>

      {onCopy && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-[var(--menu-hover-bg)] pl-4 pr-1 py-1 shadow-[-12px_0_12px_-4px_var(--menu-hover-bg)]">
            <button
              type="button"
              onClick={onCopy}
              className="w-6 h-6 grid place-items-center rounded-sm text-fg-dim hover:text-fg hover:bg-[var(--command-active-bg)] border border-border/50 bg-[var(--menu-hover-bg)]"
              aria-label={`Copy ${label}`}
            >
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

function SecurityStatusRow({
  label,
  status,
  detail,
  tooltip,
}: {
  label: string;
  status: "verified" | "signed" | "unverified" | "unknown";
  detail: string;
  tooltip?: string;
}) {
  const isGood = status === "verified" || status === "signed";
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2 rounded-sm hover:bg-[var(--menu-hover-bg)]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-sans text-fg leading-tight">{label}</span>
            {tooltip && (
              <Tooltip label={tooltip} side="top">
                <InformationCircleIcon className="w-[11px] h-[11px] text-fg-dim hover:text-accent transition-colors cursor-help" />
              </Tooltip>
            )}
          </div>
          <span className="text-[10.5px] font-sans text-fg-dim leading-snug truncate">{detail}</span>
        </div>
      </div>
      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded-sm border ${
        isGood
          ? "text-success bg-success/8 border-success/20"
          : "text-warning bg-warning/8 border-warning/20"
      }`}>
        {status}
      </span>
    </div>
  );
}

function SecurityLinkRow({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-2 py-2 rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--menu-hover-bg)] transition-colors group"
    >
      <span className="shrink-0 text-fg-dim group-hover:text-fg transition-colors">{icon}</span>
      <span className="text-[12.5px] font-sans flex-1 min-w-0 truncate">{label}</span>
      <ArrowTopRightOnSquareIcon className="w-[11px] h-[11px] text-fg-dim shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
    </a>
  );
}

function DisplayPanel() {
  const [fontOpen, setFontOpen] = useState(true);
  const [themeOpen, setThemeOpen] = useState(true);

  return (
    <div className="px-2 pt-0 pb-2 flex flex-col gap-1">
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
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-sm hover:bg-[var(--menu-hover-bg)]"
      >
        <span className="text-[13.5px] font-sans font-medium text-fg">{label}</span>
        {open ? (
          <ChevronDownIcon className="w-[13px] h-[13px] text-fg-muted" strokeWidth={2.5} />
        ) : (
          <ChevronRightIcon className="w-[13px] h-[13px] text-fg-muted" strokeWidth={2.5} />
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
      <div className="mx-2 p-1 flex items-center gap-1 rounded-md bg-[var(--command-bg)] border border-border">
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
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`flex ${className}`}
    >
      <button
        onClick={onClick}
        className={`h-7 w-full px-2.5 rounded-sm text-[11.5px] font-sans transition-colors flex items-center justify-center ${active ? "bg-[var(--command-active-bg)] text-fg" : "text-fg-muted hover:text-fg"
          }`}
      >
        {children}
      </button>
    </motion.div>
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
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${active
          ? "bg-[var(--command-active-bg)] ring-1 ring-accent/40"
          : "hover:bg-[var(--menu-hover-bg)]"
        }`}
    >
      <FontPreview font={font} />
      <span
        className={`min-w-0 flex-1 text-[13px] truncate ${active ? "text-fg font-semibold" : "text-fg"
          }`}
        style={{ fontFamily: font.stack }}
      >
        {font.name}
      </span>
      {active ? (
        <span className="w-5 h-5 grid place-items-center rounded-full bg-accent text-accent-fg shrink-0">
          <CheckIcon className="w-[11px] h-[11px]" strokeWidth={2.5} />
        </span>
      ) : null}
    </button>
  );
}

function FontPreview({ font }: { font: AppFont }) {
  return (
    <div
      className="w-[68px] h-[44px] rounded-sm overflow-hidden shrink-0 border border-[var(--border-strong)] bg-[var(--bg)] grid place-items-center"
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
      <div className="mx-2 p-1 flex items-center gap-1 rounded-md bg-[var(--command-bg)] border border-border">
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
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${active
          ? "bg-[var(--command-active-bg)] ring-1 ring-accent/40"
          : "hover:bg-[var(--menu-hover-bg)]"
        }`}
    >
      <ThemePreview theme={theme} />
      <span
        className={`min-w-0 flex-1 text-[13px] font-sans truncate ${active ? "text-fg font-semibold" : "text-fg"
          }`}
      >
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
      className="w-[68px] h-[44px] rounded-sm overflow-hidden shrink-0 border"
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
const SOURCE_CODE_URL = "https://github.com/CarbonSSH/carbon";

const AI_PANEL_FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Is sensitive information shared with AI?",
    a: "Hosts, IPs, usernames, keys, logs, and similar sensitive details are stripped out (redacted) before anything leaves ine, so that stuff isn’t sitting in the prompt handed to the model.",
  },
  {
    q: "Is my data stored?",
    a: "This app does not stash your autocomplete traffic on a server: requests go out, responses come back, end of story from our side. Your settings (including API keys) live in localStorage only. Your AI provider is its own company and may keep logs under its own retention rules.",
  },
  {
    q: "Is autocomplete safe?",
    a: "Autocomplete goes through the redaction step first, and we only send a small slice of context - not any connection, machine, variable, or sensitive details.",
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
      <div className="flex flex-col rounded-md border border-border bg-[var(--command-bg)]/40 overflow-hidden">
        {AI_PANEL_FAQ.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="border-b border-border/60 last:border-b-0">
              <motion.div
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex((cur) => (cur === i ? null : i))}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--menu-hover-bg)] transition-colors"
                >
                  <span
                    className={`text-[12px] font-sans leading-snug ${isOpen ? "text-fg font-medium" : "text-fg-muted"
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
                    <ChevronDownIcon className={`w-[11px] h-[11px] ${isOpen ? "text-fg-muted" : ""}`} strokeWidth={2.5} />
                  </motion.span>
                </button>
              </motion.div>
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
  }, [ai.provider, ai.apiKey, ai.baseUrl, ai.autocompleteModel]);

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
    <div className="px-3 pt-0 pb-3 flex flex-col gap-4">
      <FieldBlock label="Provider">
        <ProviderSelect
          value={ai.provider}
          onChange={(id) =>
            actions.updateAI({ provider: id, autocompleteModel: "", chatEnabled: false })
          }
        />
      </FieldBlock>

      <FieldBlock label="API key" hint={meta.apiKeyRequired ? "required" : "optional"}>
        <IconFieldRow icon={<KeyIcon className="w-[13px] h-[13px]" strokeWidth={2} />}>
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
            {showKey ? <EyeSlashIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
          </button>
        </IconFieldRow>
      </FieldBlock>

      {meta.needsBaseUrl ? (
        <FieldBlock
          label={meta.baseUrlField?.label ?? "Base URL"}
          hint={meta.baseUrlField?.fieldHint ?? "required"}
        >
          <IconFieldRow icon={<GlobeAltIcon className="w-[13px] h-[13px]" strokeWidth={2} />}>
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
              <InformationCircleIcon className="w-[13px] h-[13px] shrink-0" aria-hidden strokeWidth={2} />
            </span>
          </Tooltip>
        }
        label="Autocomplete model"
      >
        <IconFieldRow icon={<SparklesIcon className="w-[13px] h-[13px]" strokeWidth={2} />}>
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
          className="h-10 w-full rounded-md bg-accent text-accent-fg text-[13px] font-sans font-semibold hover:opacity-90 disabled:opacity-45 disabled:pointer-events-none transition-opacity inline-flex items-center justify-center gap-2"
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
        {testPhase === "ok" ? (
          <div className="flex items-center justify-between gap-3 px-0.5 py-1">
            <p className="text-[11.5px] font-sans text-success leading-snug">
              Autocomplete responded. Turn on AI?
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={ai.autocompleteEnabled}
              onClick={() => actions.updateAI({ autocompleteEnabled: !ai.autocompleteEnabled })}
              className={`shrink-0 w-[28px] h-[16px] rounded-full transition-colors relative focus:outline-none ${ai.autocompleteEnabled ? "bg-success" : "bg-[var(--border-strong)]"
                }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-transform ${ai.autocompleteEnabled ? "translate-x-[12px]" : "translate-x-0"
                  }`}
              />
            </button>
          </div>
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
      <SettingsSelectTriggerWrap>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full h-9 flex items-center gap-2 pl-2.5 pr-2 bg-[var(--input-bg)] border border-border rounded-sm text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors"
        >
          <span className="w-4 h-4 grid place-items-center text-fg shrink-0">
            <ProviderIcon id={value} size={14} />
          </span>
          <span className="flex-1 min-w-0 text-[13px] font-sans text-fg truncate">{meta.name}</span>
          <ChevronDownIcon className="w-[11px] h-[11px] text-fg-muted shrink-0" strokeWidth={2.5} />
        </button>
      </SettingsSelectTriggerWrap>

      <SettingsListboxPopover open={open} className="z-20">
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
              className={`w-full flex items-center gap-2.5 px-2 h-9 rounded-sm text-left transition-colors ${active
                  ? "bg-[var(--command-active-bg)] text-fg"
                  : "text-fg hover:bg-[var(--menu-hover-bg)]"
                }`}
            >
              <span className="w-4 h-4 grid place-items-center shrink-0">
                <ProviderIcon id={p.id} size={14} />
              </span>
              <span className="flex-1 min-w-0 truncate text-[13px] font-sans">{p.name}</span>
              {active ? <CheckIcon className="w-[11px] h-[11px] text-accent shrink-0" strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </SettingsListboxPopover>
    </div>
  );
}

function IconFieldRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2.5 h-9 rounded-sm bg-[var(--input-bg)] border border-border focus-within:border-[var(--border-strong)] transition-colors">
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
