import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CaretDown,
  CaretUp,
  Check,
  Folders,
  MagnifyingGlass,
  PlugsConnected,
  SquaresFour,
  TerminalWindow,
  Trash,
  WarningCircle,
  ClockCounterClockwise,
  X,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import { GitHubDark } from "@ridemountainpig/svgl-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HostIcon } from "@/components/HostIcon";
import { Tooltip } from "@/components/Tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { actions, useStore } from "@/lib/store";
import type { Connection } from "@/lib/types";

const LOGS_HEIGHT_STORAGE_KEY = "terminal-muse.logs-panel-height.v1";
const DEFAULT_LOGS_BODY_PX = 160;
/** Area above logs used as drag resize target (excluding bottom strip). */
const LOGS_RESIZE_HANDLE_PX = 6;
const LOGS_BODY_MIN_PX = 100;
/** Max height of log body (excluding resize handle/bottom strip) vs viewport */
const LOGS_BODY_MAX_SCREEN_FRACTION = 0.45;

/** Toolbar search UI and text filtering; keep false until we ship it visibly. Component stays mounted below. */
const SHOW_LOGS_TOOLBAR_SEARCH = false;

/** SSR / pre-hydration fallback before real innerHeight exists */
function logsBodyFallbackMaxPx(): number {
  return 520;
}

function computeLogsBodyMaxPx(innerHeight: number): number {
  const cap = Math.floor(innerHeight * LOGS_BODY_MAX_SCREEN_FRACTION);
  return Math.max(LOGS_BODY_MIN_PX, cap);
}

function clampLogsBody(px: number, maxPx: number): number {
  if (!Number.isFinite(px)) return DEFAULT_LOGS_BODY_PX;
  const mx = Math.max(LOGS_BODY_MIN_PX, maxPx);
  return Math.round(Math.min(mx, Math.max(LOGS_BODY_MIN_PX, px)));
}

function loadLogsBodyPx(maxPx: number): number {
  if (typeof window === "undefined") return DEFAULT_LOGS_BODY_PX;
  try {
    const raw = window.localStorage.getItem(LOGS_HEIGHT_STORAGE_KEY);
    if (!raw) return DEFAULT_LOGS_BODY_PX;
    return clampLogsBody(Number.parseInt(raw, 10), maxPx);
  } catch {
    return DEFAULT_LOGS_BODY_PX;
  }
}

function saveLogsBodyPx(px: number, maxPx: number) {
  try {
    window.localStorage.setItem(LOGS_HEIGHT_STORAGE_KEY, String(clampLogsBody(px, maxPx)));
  } catch {
    /* ignore */
  }
}

const levelColor = {
  info: "text-fg-muted",
  warn: "text-warning",
  error: "text-danger",
} as const;

/** Columns: time · level · saved host · kind · session / target · command or message */
const LOG_ROW_GRID_TEMPLATE =
  "minmax(4.875rem,5.375rem) minmax(2.625rem,3.25rem) minmax(6.75rem,9.25rem) minmax(4.25rem,5.75rem) minmax(9rem,12.5rem) minmax(0,1fr) minmax(4.5rem,6rem)";
const LOG_ROW_CELL = "min-w-0 pr-4 sm:pr-6 last:pr-0";

function logMatchesSearch(log: { source: string; level: string; message: string }, raw: string) {
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const { kind, target, detail } = parseLogCells(log.message);
  const haystack = [log.source, log.level, log.message, kind, target, detail]
    .join(" ")
    .toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

function parseLogCells(message: string): { kind: string; target: string; detail: string } {
  const t = message.trim();
  if (!t) return { kind: "—", target: "", detail: "" };

  const dollar = /^\$\s*(.+)$/s.exec(t);
  if (dollar) {
    let body = dollar[1].trim();
    if (/^exit\s*[·⋅]\s*/i.test(body)) {
      body = body.replace(/^exit\s*[·⋅]\s*/i, "").trim();
      const colon = body.indexOf(": ");
      if (colon > 0) {
        return {
          kind: "Exit",
          target: body.slice(0, colon).trim(),
          detail: body.slice(colon + 2).trim() || body,
        };
      }
      return { kind: "Exit", target: "", detail: body };
    }
    const colon = body.indexOf(": ");
    if (colon > 0) {
      const target = body.slice(0, colon).trim();
      let detail = body.slice(colon + 2).trim();
      const kind =
        detail && /\bnot found\b|command not found/i.test(detail) ? "Unknown" : "Command";
      return { kind, target, detail: detail || body };
    }
    
    const spaceMatch = body.match(/^(\S+)(?:\s+(.*))?$/s);
    if (spaceMatch) {
      return { kind: "Command", target: spaceMatch[1], detail: spaceMatch[2] || "—" };
    }

    return { kind: "Command", target: "", detail: body };
  }

  const low = t.toLowerCase();
  
  if (low.startsWith("connecting to ")) {
     return { kind: "Connect", target: t.slice("connecting to ".length).trim(), detail: "—" };
  }
  
  if (low.startsWith("opening session ")) {
    return {
      kind: "Open",
      target: t.slice("opening session ".length).trim(),
      detail: "—",
    };
  }

  const sessionMatch = t.match(/^Session (.+) (connected|closed)$/i);
  if (sessionMatch) {
     return { kind: sessionMatch[2].toLowerCase() === "connected" ? "Ready" : "Close", target: sessionMatch[1], detail: "—" };
  }

  if (low.startsWith("updated ") || low.startsWith("saved ") || low.startsWith("deleted ")) {
     const space = t.indexOf(" ");
     return { kind: "Change", target: t.slice(space + 1).trim(), detail: t.slice(0, space) };
  }
  
  if (low.startsWith("created group ") || low.startsWith("removed group ") || low.startsWith("renamed group to ")) {
     const kind = low.startsWith("created") ? "Create" : low.startsWith("removed") ? "Delete" : "Rename";
     const match = t.match(/"([^"]+)"/);
     return { kind, target: match ? match[1] : "Group", detail: t };
  }

  if (/\breplay\/ssh\b|offline shell\b|session .* ready/i.test(t))
    return { kind: "System", target: "", detail: t };

  if (/\bnot found\b|command not found/i.test(low))
    return { kind: "Error", target: "", detail: t };

  if (/deleted|removed|warn:/i.test(t)) return { kind: "Change", target: "", detail: t };
  return { kind: "Info", target: "", detail: t };
}

function connectionForSource(connections: Connection[], source: string) {
  return connections.find((c) => c.name === source) ?? null;
}

function LogSourceGlyph({ source, conn }: { source: string; conn: Connection | null }) {
  if (source === "__all__") {
    return (
      <span className="shrink-0 w-3.5 h-3.5 grid place-items-center text-fg-muted">
        <SquaresFour size={12} weight="bold" />
      </span>
    );
  }
  if (conn) {
    return <HostIcon conn={conn} size={14} />;
  }
  if (source === "connections") {
    return (
      <span className="shrink-0 w-3.5 h-3.5 grid place-items-center text-fg-muted">
        <PlugsConnected size={12} weight="bold" />
      </span>
    );
  }
  if (source === "groups") {
    return (
      <span className="shrink-0 w-3.5 h-3.5 grid place-items-center text-fg-muted">
        <Folders size={12} weight="bold" />
      </span>
    );
  }
  if (source === "session") {
    return (
      <span className="shrink-0 w-3.5 h-3.5 grid place-items-center text-fg-muted">
        <TerminalWindow size={12} weight="bold" />
      </span>
    );
  }
  return (
    <span className="shrink-0 w-3.5 h-3.5 grid place-items-center text-fg-muted">
      <TerminalWindow size={12} weight="regular" />
    </span>
  );
}

function LogsSourcePicker({
  connections,
  sources,
  value,
  onChange,
}: {
  connections: Connection[];
  sources: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const label = value === "__all__" ? "All sources" : value;
  const activeConn = value === "__all__" ? null : connectionForSource(connections, value);

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-labelledby="logs-source-label"
          title={value === "__all__" ? "Show all logs" : `Source: ${value}`}
          className="relative inline-flex items-center gap-1.5 h-6 max-w-[10.5rem] pl-1.5 pr-1 rounded-sm bg-transparent border-none shadow-none text-[10px] text-fg-muted hover:text-fg focus:outline-none focus:ring-1 focus:ring-border transition-colors after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-[3px] after:h-px after:bg-[var(--border-strong)]"
        >
          <LogSourceGlyph source={value} conn={activeConn} />
          <span className="truncate flex-1 min-w-0 text-left">{label}</span>
          <CaretDown size={10} weight="bold" className="shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={6}
        className="p-1 min-w-[11rem] max-w-[16rem] max-h-52 overflow-y-auto rounded-md border border-border bg-[var(--menu-bg)] shadow-2xl scrollbar-thin"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div role="listbox" aria-label="Log source">
          <button
            type="button"
            role="option"
            aria-selected={value === "__all__"}
            onClick={() => {
              onChange("__all__");
              setMenuOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-2 h-7 rounded-sm text-left transition-colors ${
              value === "__all__"
                ? "bg-[var(--command-active-bg)] text-fg"
                : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
            }`}
          >
            <LogSourceGlyph source="__all__" conn={null} />
            <span className="flex-1 min-w-0 truncate text-[11px] font-mono">All sources</span>
            {value === "__all__" ? (
              <Check size={11} weight="bold" className="text-accent shrink-0" />
            ) : null}
          </button>
          {sources.map((s) => {
            const conn = connectionForSource(connections, s);
            const active = value === s;
            return (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(s);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 h-7 rounded-sm text-left transition-colors ${
                  active
                    ? "bg-[var(--command-active-bg)] text-fg"
                    : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
                }`}
              >
                <LogSourceGlyph source={s} conn={conn} />
                <span className="flex-1 min-w-0 truncate text-[11px] font-mono">{s}</span>
                {active ? <Check size={11} weight="bold" className="text-accent shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LogsSearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputId = useId();
  return (
    <div
      role="search"
      className="inline-flex items-center gap-0.5 h-6 w-full pl-1.5 pr-1 rounded-md border border-border bg-bg text-[10px] font-mono text-fg-muted hover:text-fg hover:border-[var(--border-strong)] focus-within:outline-none focus-within:ring-1 focus-within:ring-border transition-colors"
    >
      <label htmlFor={inputId} className="flex flex-1 min-w-0 items-center gap-1.5 cursor-text">
        <MagnifyingGlass
          size={11}
          weight="bold"
          className="shrink-0 opacity-70 pointer-events-none"
          aria-hidden
        />
        <input
          id={inputId}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search logs"
          aria-label="Search logs"
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-fg-muted placeholder:text-fg-muted/45 placeholder:normal-case placeholder:tracking-normal h-full py-0 text-[10px] font-mono"
        />
      </label>
      {value.length > 0 ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="shrink-0 grid place-items-center w-6 h-[22px] rounded hover:bg-[var(--menu-hover-bg)] text-fg-dim hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-border transition-colors"
        >
          <X size={11} weight="bold" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ClearLogsButton() {
  const [warnOpen, setWarnOpen] = useState(false);

  return (
    <Tooltip
      side="top"
      delay={350}
      multiline
      disabled={warnOpen}
      label={
        <span>
          <span className="font-semibold block mb-0.5">Clear logs</span>
          Deletes every saved log entry on this browser. Sessions and tabs are unaffected; this
          cannot be undone.
        </span>
      }
    >
      <Popover open={warnOpen} onOpenChange={setWarnOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Clear logs"
            aria-expanded={warnOpen}
            className="text-fg-dim hover:text-danger p-1 rounded shrink-0 hover:bg-danger/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-border transition-colors data-[state=open]:text-danger data-[state=open]:bg-danger/10"
          >
            <Trash size={12} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={6}
          className="z-[60] w-[min(calc(100vw-2rem),18rem)] p-0 rounded-md border border-border bg-[var(--menu-bg)] shadow-2xl"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-3 pb-2">
            <div className="flex items-start gap-2">
              <WarningCircle size={22} weight="fill" className="text-warning shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold font-sans text-fg leading-tight">
                  Clear all logs?
                </p>
                <p className="mt-1 text-[11.5px] font-sans text-fg-muted leading-snug">
                  This removes activity from the log buffer immediately. This action cannot be
                  undone.
                </p>
              </div>
            </div>
          </div>
          <div className="p-3 pl-10 flex gap-2 items-center w-full min-w-0">
            <button
              type="button"
              className="h-8 px-2.5 rounded-sm bg-danger text-white text-[12px] font-sans font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5 shrink-0"
              onClick={() => {
                actions.clearLogs();
                setWarnOpen(false);
              }}
            >
              <Trash size={12} weight="bold" aria-hidden />
              Clear all
            </button>
            <button
              type="button"
              className="h-8 px-2.5 rounded-sm text-[11.5px] font-sans font-medium text-fg-muted hover:bg-[var(--menu-hover-bg)] bg-[var(--menu-hover-bg)]/50 hover:text-fg inline-flex items-center gap-1 shrink-0"
              onClick={() => setWarnOpen(false)}
            >
              <X size={12} weight="bold" aria-hidden />
              Cancel
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </Tooltip>
  );
}

function GithubLink() {
  return (
    <Tooltip label="Star or contribute on GitHub" side="top" delay={400}>
      <a
        href="https://github.com/dev-hari-prasad/terminal-muse"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-6 h-6 rounded-md text-fg-dim hover:text-fg hover:bg-[var(--menu-hover-bg)]/50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-border"
      >
        <GitHubDark className="w-3.5 h-3.5" fill="currentColor" />
      </a>
    </Tooltip>
  );
}

export function BottomPanel() {
  const reduceMotion = useReducedMotion();
  const open = useStore((s) => s.bottomOpen);
  const logs = useStore((s) => s.logs);
  const connections = useStore((s) => s.connections);
  const [sourceFilter, setSourceFilter] = useState<string>("__all__");
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logsBodyPx, setLogsBodyPx] = useState(DEFAULT_LOGS_BODY_PX);
  const [viewportMaxLogs, setViewportMaxLogs] = useState(() =>
    typeof window !== "undefined"
      ? computeLogsBodyMaxPx(window.innerHeight)
      : logsBodyFallbackMaxPx(),
  );
  const [resizeActive, setResizeActive] = useState(false);
  const [showResizeHint, setShowResizeHint] = useState(false);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHint = useCallback(() => {
    setShowResizeHint(true);
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => {
      setShowResizeHint(false);
    }, 3000);
  }, []);

  const resizeStartRef = useRef({ clientY: 0, height: DEFAULT_LOGS_BODY_PX });
  const captureResizeRef = useRef<{ node: HTMLElement; pointerId: number } | null>(null);
  const skipHeightPersist = useRef(true);

  useEffect(() => {
    if (open) {
      triggerHint();
    }
  }, [open, triggerHint]);

  useEffect(() => {
    if (resizeActive) {
      setShowResizeHint(true);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    } else {
      triggerHint();
    }
  }, [resizeActive, triggerHint]);

  useEffect(() => {
    skipHeightPersist.current = true;
    const m = computeLogsBodyMaxPx(window.innerHeight);
    setViewportMaxLogs(m);
    setLogsBodyPx(loadLogsBodyPx(m));
    queueMicrotask(() => {
      skipHeightPersist.current = false;
    });

    function onViewportResize() {
      const next = computeLogsBodyMaxPx(window.innerHeight);
      setViewportMaxLogs(next);
      setLogsBodyPx((prev) => clampLogsBody(prev, next));
    }
    window.addEventListener("resize", onViewportResize);
    return () => window.removeEventListener("resize", onViewportResize);
  }, []);

  useEffect(() => {
    if (skipHeightPersist.current) return;
    saveLogsBodyPx(logsBodyPx, viewportMaxLogs);
  }, [logsBodyPx, viewportMaxLogs]);

  const toggleMs = reduceMotion ? 0 : 0.22;

  const onResizeMove = useCallback(
    (e: PointerEvent) => {
      const dy = resizeStartRef.current.clientY - e.clientY;
      setLogsBodyPx(clampLogsBody(resizeStartRef.current.height + dy, viewportMaxLogs));
    },
    [viewportMaxLogs],
  );

  const onResizeEnd = useCallback(
    (_e: PointerEvent) => {
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", onResizeEnd);
      window.removeEventListener("pointercancel", onResizeEnd);
      const c = captureResizeRef.current;
      if (c) {
        try {
          c.node.releasePointerCapture(c.pointerId);
        } catch {
          /* noop */
        }
        captureResizeRef.current = null;
      }
      setResizeActive(false);
    },
    [onResizeMove],
  );

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStartRef.current = { clientY: e.clientY, height: logsBodyPx };
      captureResizeRef.current = { node: e.currentTarget, pointerId: e.pointerId };
      setResizeActive(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      window.addEventListener("pointermove", onResizeMove);
      window.addEventListener("pointerup", onResizeEnd);
      window.addEventListener("pointercancel", onResizeEnd);
    },
    [logsBodyPx, onResizeMove, onResizeEnd],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", onResizeEnd);
      window.removeEventListener("pointercancel", onResizeEnd);
    };
  }, [onResizeMove, onResizeEnd]);

  const sources = useMemo(() => {
    const uniq = [...new Set(logs.map((l) => l.source))];
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq;
  }, [logs]);

  const resolvedFilter =
    sourceFilter === "__all__" || sources.includes(sourceFilter) ? sourceFilter : "__all__";

  const sourceFilteredLogs = useMemo(
    () => (resolvedFilter === "__all__" ? logs : logs.filter((l) => l.source === resolvedFilter)),
    [logs, resolvedFilter],
  );

  const filteredLogs = useMemo(
    () =>
      SHOW_LOGS_TOOLBAR_SEARCH
        ? sourceFilteredLogs.filter((l) => logMatchesSearch(l, logSearchQuery))
        : sourceFilteredLogs,
    [sourceFilteredLogs, logSearchQuery],
  );

  const showTotalInHeader =
    resolvedFilter !== "__all__" || (SHOW_LOGS_TOOLBAR_SEARCH && logSearchQuery.trim().length > 0);

  return (
    <div className="border-t border-border bg-bg-panel flex flex-col">
      <div
        className={`min-h-7 h-7 bg-bg-panel ${
          open
            ? `grid grid-rows-1 gap-x-2 pr-1 items-stretch relative isolate ${
                SHOW_LOGS_TOOLBAR_SEARCH
                  ? "grid-cols-[1fr_minmax(14rem,22rem)_auto]"
                  : "grid-cols-[1fr_auto]"
              }`
            : "flex items-stretch"
        }`}
      >
        {!open ? (
          <>
            <button
            type="button"
            aria-expanded={open}
            aria-controls="logs-scroll-region"
            onClick={() => actions.toggleBottom()}
            className="flex-1 min-w-0 pl-3 pr-3 flex items-center gap-1.5 text-xxs uppercase font-sans font-semibold text-fg-muted hover:text-fg hover:bg-[var(--menu-hover-bg)]/50 tracking-wider transition-colors rounded-none text-left"
          >
            <CaretUp size={11} weight="bold" />
            Activity Logs
            <span className="text-fg-dim font-mono normal-case tracking-normal">
              ({filteredLogs.length > 99 ? "99+" : filteredLogs.length}
              {showTotalInHeader ? `/${logs.length > 99 ? "99+" : logs.length}` : null})
            </span>
          </button>
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-2 pr-1 h-full bg-bg-panel shrink-0">
            <GithubLink />
          </div>
        </>
        ) : (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="logs-scroll-region"
              aria-label={`Collapse logs panel. ${filteredLogs.length} entr${
                filteredLogs.length === 1 ? "y" : "ies"
              } visible${showTotalInHeader ? ` of ${logs.length} total.` : "."}`}
              onClick={() => actions.toggleBottom()}
              className="col-span-full row-start-1 z-[1] m-0 min-h-7 h-full rounded-none bg-transparent hover:bg-[var(--menu-hover-bg)]/50 transition-colors border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-inset"
            />

            <div
              className="col-start-1 row-start-1 z-[2] flex items-center gap-1.5 min-w-0 text-xxs uppercase font-sans font-semibold text-fg-muted tracking-wider pointer-events-none justify-self-start h-full max-w-fit pl-3"
              aria-hidden={true}
            >
              <CaretDown size={11} weight="bold" className="shrink-0" aria-hidden />
              <span>Activity Logs</span>
              <span className="text-fg-dim font-mono normal-case tracking-normal">
                ({filteredLogs.length > 99 ? "99+" : filteredLogs.length}
                {showTotalInHeader ? `/${logs.length > 99 ? "99+" : logs.length}` : null})
              </span>
            </div>

            <div
              className={`col-start-2 row-start-1 z-[2] flex justify-center items-center min-w-0 w-full px-0.5 h-full pointer-events-none ${
                SHOW_LOGS_TOOLBAR_SEARCH ? "" : "hidden"
              }`}
              aria-hidden={!SHOW_LOGS_TOOLBAR_SEARCH}
            >
              <div className="pointer-events-auto w-full min-h-0">
                <LogsSearchBar value={logSearchQuery} onChange={setLogSearchQuery} />
              </div>
            </div>

            <div
              className={`${
                SHOW_LOGS_TOOLBAR_SEARCH ? "col-start-3" : "col-start-2"
              } row-start-1 z-[2] flex items-center gap-1.5 shrink-0 justify-end border-l border-border/60 pl-2 bg-bg-panel h-full`}
            >
              <span className="sr-only" id="logs-source-label">
                Log source
              </span>
              <LogsSourcePicker
                connections={connections}
                sources={sources}
                value={resolvedFilter}
                onChange={setSourceFilter}
              />
              <ClearLogsButton />
              <GithubLink />
            </div>
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="logs-body"
            role="presentation"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: logsBodyPx + LOGS_RESIZE_HANDLE_PX,
              opacity: 1,
            }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: resizeActive ? 0 : toggleMs,
              ease: [0.32, 0.72, 0, 1],
            }}
            className="bg-bg border-t border-border/40 flex flex-col overflow-visible"
          >
            <Tooltip
              label={
                <>
                  <span className="font-semibold">Resize log panel</span>
                  <span className="block mt-1 text-[10px] text-fg-muted font-normal opacity-95">
                    Drag up or down to resize.
                  </span>
                </>
              }
              side="top"
              delay={200}
              multiline
              disabled={resizeActive}
              className="block w-full shrink-0"
            >
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-valuemin={LOGS_BODY_MIN_PX}
                aria-valuemax={viewportMaxLogs}
                aria-valuenow={logsBodyPx}
                aria-label="Resize logs height"
                className={`shrink-0 w-full select-none touch-none bg-border/50 hover:bg-accent/35 active:bg-accent/55 transition-colors outline-none cursor-row-resize relative flex items-center justify-center ${
                  resizeActive ? "bg-accent/50" : ""
                }`}
                style={{ height: LOGS_RESIZE_HANDLE_PX }}
                tabIndex={0}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  onResizePointerDown(e);
                }}
                onMouseEnter={triggerHint}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const delta = e.key === "ArrowUp" ? 24 : -24;
                    setLogsBodyPx(clampLogsBody(logsBodyPx + delta, viewportMaxLogs));
                  }
                }}
              >
                <AnimatePresence>
                  {showResizeHint && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 4 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                    >
                      <div className="px-2 py-0.5 rounded-full bg-accent/90 text-[9px] font-bold text-white uppercase tracking-wider shadow-lg border border-white/10 whitespace-nowrap flex items-center gap-1">
                        <ArrowsDownUp size={10} weight="bold" />
                        Resize
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Tooltip>
            <div
              id="logs-scroll-region"
              role="region"
              aria-label="Application logs"
              className="min-h-0 flex-1 flex flex-col overflow-y-auto px-3 pb-2 font-mono text-[12px] leading-relaxed bg-bg box-border"
            >
              {logs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[10rem] w-full px-4 py-8 text-center gap-3">
                  <ClockCounterClockwise
                    size={32}
                    weight="duotone"
                    className="text-fg-dim opacity-60"
                  />
                  <p className="text-fg-dim text-[13px] font-sans leading-normal">
                    No log entries yet. <br /> Actions, connections, and commands <br /> will appear
                    here.
                  </p>
                </div>
              ) : sourceFilteredLogs.length === 0 ? (
                <div className="text-fg-dim py-2">no entries for this source.</div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[10rem] w-full px-4 py-8 text-center">
                  <MagnifyingGlass
                    size={36}
                    weight="duotone"
                    className="text-fg-dim shrink-0 opacity-[0.88]"
                    aria-hidden={true}
                  />
                  <p className="text-fg-dim text-[13px] font-sans leading-normal">
                    no logs match your search.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col min-h-0">
                  <div
                    className="grid items-center gap-x-4 py-1.5 mb-1 border-b border-border/60 text-[10px] font-sans font-bold tracking-wider text-fg-muted uppercase sticky top-0 bg-bg z-10"
                    style={{ gridTemplateColumns: LOG_ROW_GRID_TEMPLATE }}
                  >
                    <div className={LOG_ROW_CELL}>Time</div>
                    <div className={LOG_ROW_CELL}>Level</div>
                    <div className={LOG_ROW_CELL}>Host</div>
                    <div className={LOG_ROW_CELL}>Event</div>
                    <div className={LOG_ROW_CELL}>Target</div>
                    <div className={LOG_ROW_CELL}>Details</div>
                    <div className="min-w-0">User</div>
                  </div>
                  {[...filteredLogs].reverse().map((l) => {
                    const rowConn = connectionForSource(connections, l.source);
                    const timeStr = new Date(l.ts).toLocaleTimeString([], { hour12: false });
                    const {
                      kind: actionKind,
                      target: sessionAddr,
                      detail: cmdDetail,
                    } = parseLogCells(l.message);
                    return (
                      <div
                        key={l.id}
                        className="grid items-start gap-x-4 py-1 border-b border-border/40 text-[11.75px] sm:text-[12px] leading-snug last:border-b-0"
                        style={{ gridTemplateColumns: LOG_ROW_GRID_TEMPLATE }}
                      >
                        <div
                          className={`${LOG_ROW_CELL} text-fg-dim whitespace-nowrap font-mono tabular-nums`}
                        >
                          {timeStr}
                        </div>
                        <div
                          className={`${LOG_ROW_CELL} uppercase text-xxs font-sans tracking-wide ${levelColor[l.level]}`}
                        >
                          {l.level}
                        </div>
                        <div
                          className={`${LOG_ROW_CELL} text-fg-dim inline-flex items-center gap-1.5`}
                        >
                          <span className="shrink-0">
                            <LogSourceGlyph source={l.source} conn={rowConn} />
                          </span>
                          <span className="truncate font-mono">{l.source}</span>
                        </div>
                        <div
                          className={`${LOG_ROW_CELL} text-fg-muted uppercase text-xxs font-sans tracking-wide truncate font-semibold`}
                        >
                          {actionKind}
                        </div>
                        <div
                          className={`${LOG_ROW_CELL} text-fg-dim font-mono truncate`}
                          title={sessionAddr || undefined}
                        >
                          {sessionAddr || (
                            <span className="text-fg-muted/55 select-none" aria-hidden="true">
                              —
                            </span>
                          )}
                        </div>
                        <div className={`${LOG_ROW_CELL} min-w-0 text-fg font-mono text-[11.5px] sm:text-[12px] break-words`}>
                          {cmdDetail}
                        </div>
                        <div className="min-w-0 text-fg-dim font-mono truncate uppercase text-xxs tracking-wider">
                          {rowConn?.username || (
                            <span className="text-fg-muted/55 select-none" aria-hidden="true">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
