import { useEffect, useRef, useState } from "react";
import {
  MagnifyingGlass,
  BookmarkSimple,
  Clock,
  HardDrives,
  CaretLeft,
  CaretRight,
  Plus,
  DotsThreeVertical,
  Circle,
  PencilSimple,
  Trash,
  Plug,
} from "@phosphor-icons/react";
import { actions, useStore } from "@/lib/store";
import type { Connection } from "@/lib/types";
import { ConnectionForm } from "@/features/connections/ConnectionForm";

const menu = ["File", "Edit", "View", "Session", "Terminal", "Help"];

type Popover = "machines" | "bookmarks" | "history" | null;

export function TopBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const connections = useStore((s) => s.connections);
  const logs = useStore((s) => s.logs);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Popover>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeConn = activeTab
    ? connections.find((c) => c.id === activeTab.connectionId)
    : null;
  const url = activeConn
    ? `ssh://${activeConn.username}@${activeConn.host}:${activeConn.port}`
    : "ssh://— no active session";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setOpen(null);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = connections.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.host.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q)
    );
  });

  const recent = [...connections]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  function openEdit(c: Connection) {
    setEditing(c);
    setFormOpen(true);
    setOpen(null);
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
    setOpen(null);
  }

  return (
    <div className="border-b border-border bg-bg-panel select-none">
      {/* Row 1: app brand + menu + search bar + actions */}
      <div className="h-11 px-3 flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-border h-full">
          <div className="w-6 h-6 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center">
            <Circle size={8} weight="fill" className="text-accent" />
          </div>
          <div className="font-sans font-bold text-[13px] tracking-tight text-fg">
            relay<span className="text-fg-dim font-normal">/ssh</span>
          </div>
        </div>

        <nav className="flex items-center gap-0.5">
          {menu.map((m) => (
            <button
              key={m}
              className="h-7 px-2 rounded text-[12.5px] font-sans text-fg-muted hover:text-fg hover:bg-bg-elev transition-colors"
            >
              {m}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1 ml-2">
          <button
            className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:text-fg hover:bg-bg-elev"
            aria-label="Back"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
          <button
            className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:text-fg hover:bg-bg-elev"
            aria-label="Forward"
          >
            <CaretRight size={14} weight="bold" />
          </button>
        </div>

        {/* URL / search bar */}
        <div className="flex-1 max-w-2xl mx-auto relative" ref={popRef}>
          <div className="h-8 flex items-center bg-bg border border-border rounded-md focus-within:border-accent transition-colors">
            <div className="pl-2.5 pr-1.5 text-fg-dim flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <MagnifyingGlass size={12} weight="bold" />
            </div>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value && open !== "machines") setOpen("machines");
              }}
              onFocus={() => setOpen("machines")}
              placeholder={url}
              className="flex-1 h-full bg-transparent text-[12.5px] font-mono text-fg placeholder:text-fg-dim focus:outline-none"
            />
            <div className="flex items-center pr-1 gap-0.5 border-l border-border ml-1.5 pl-1">
              <BarBtn
                label="Bookmarks"
                active={open === "bookmarks"}
                onClick={() =>
                  setOpen((o) => (o === "bookmarks" ? null : "bookmarks"))
                }
              >
                <BookmarkSimple
                  size={13}
                  weight={open === "bookmarks" ? "fill" : "regular"}
                />
              </BarBtn>
              <BarBtn
                label="History"
                active={open === "history"}
                onClick={() =>
                  setOpen((o) => (o === "history" ? null : "history"))
                }
              >
                <Clock size={13} weight={open === "history" ? "fill" : "regular"} />
              </BarBtn>
              <BarBtn
                label="Machines"
                active={open === "machines"}
                onClick={() =>
                  setOpen((o) => (o === "machines" ? null : "machines"))
                }
              >
                <HardDrives
                  size={13}
                  weight={open === "machines" ? "fill" : "regular"}
                />
              </BarBtn>
            </div>
          </div>

          {open ? (
            <Popover
              kind={open}
              connections={filtered}
              recent={recent}
              onConnect={(c) => {
                actions.openTab(c.id);
                setOpen(null);
                setQuery("");
              }}
              onEdit={openEdit}
              onNew={openNew}
            />
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={openNew}
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-fg text-[12px] font-sans font-medium hover:bg-accent/90"
          >
            <Plus size={12} weight="bold" /> Machine
          </button>
          <span className="ml-2 inline-flex items-center gap-1.5 px-2 h-6 rounded border border-border text-xxs font-mono text-fg-muted">
            <Circle size={6} weight="fill" className="text-warning" />
            {logs.length}
          </span>
          <button className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:text-fg hover:bg-bg-elev">
            <DotsThreeVertical size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Row 2: browser-style tabs */}
      <TabsRow />

      <ConnectionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
      />
    </div>
  );
}

function BarBtn({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-7 h-6 grid place-items-center rounded transition-colors ${
        active
          ? "text-accent bg-accent/10"
          : "text-fg-muted hover:text-fg hover:bg-bg-elev"
      }`}
    >
      {children}
    </button>
  );
}

function Popover({
  kind,
  connections,
  recent,
  onConnect,
  onEdit,
  onNew,
}: {
  kind: NonNullable<Popover>;
  connections: Connection[];
  recent: Connection[];
  onConnect: (c: Connection) => void;
  onEdit: (c: Connection) => void;
  onNew: () => void;
}) {
  const list =
    kind === "history" ? recent : kind === "bookmarks" ? connections : connections;
  const heading =
    kind === "machines" ? "Machines" : kind === "bookmarks" ? "Bookmarked" : "Recent";

  return (
    <div className="absolute z-30 left-0 right-0 mt-1.5 bg-bg-elev border border-border rounded-lg shadow-2xl overflow-hidden">
      <div className="h-9 px-3 flex items-center justify-between border-b border-border">
        <span className="text-xxs uppercase font-sans font-semibold text-fg-muted tracking-wider">
          {heading}
        </span>
        <button
          onClick={onNew}
          className="text-[11.5px] font-mono text-accent hover:underline flex items-center gap-1"
        >
          <Plus size={11} weight="bold" /> new machine
        </button>
      </div>
      <div className="max-h-[340px] overflow-y-auto py-1">
        {list.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-[12.5px] text-fg-muted font-sans">
              {kind === "history"
                ? "No recent sessions."
                : "No machines saved yet."}
            </div>
            <button
              onClick={onNew}
              className="mt-2 text-[12px] font-mono text-accent hover:underline"
            >
              + Add your first
            </button>
          </div>
        ) : (
          list.map((c) => (
            <div
              key={c.id}
              className="group flex items-center gap-3 px-3 py-2 hover:bg-bg-panel cursor-pointer"
              onClick={() => onConnect(c)}
            >
              <div className="w-7 h-7 rounded-md bg-bg border border-border grid place-items-center text-fg-muted">
                <HardDrives size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-sans font-medium text-fg truncate">
                  {c.name}
                </div>
                <div className="text-[11px] font-mono text-fg-dim truncate">
                  ssh://{c.username}@{c.host}:{c.port}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConnect(c);
                  }}
                  className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:text-fg hover:bg-bg-elev"
                  aria-label="Connect"
                >
                  <Plug size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(c);
                  }}
                  className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:text-fg hover:bg-bg-elev"
                  aria-label="Edit"
                >
                  <PencilSimple size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.deleteConnection(c.id);
                  }}
                  className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:text-danger hover:bg-bg-elev"
                  aria-label="Delete"
                >
                  <Trash size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TabsRow() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);

  return (
    <div className="h-9 pl-2 pr-2 flex items-end gap-0.5 border-t border-border bg-bg overflow-x-auto">
      {tabs.length === 0 ? (
        <div className="h-full flex items-center px-2 text-xxs font-mono text-fg-dim">
          no active sessions — open one from the search bar above
        </div>
      ) : (
        tabs.map((t) => {
          const active = t.id === activeTabId;
          return (
            <div
              key={t.id}
              onClick={() => actions.setActiveTab(t.id)}
              className={`group h-8 flex items-center gap-2 pl-3 pr-2 rounded-t-md cursor-pointer border-x border-t transition-colors min-w-[140px] max-w-[240px] ${
                active
                  ? "bg-bg-panel border-border text-fg"
                  : "bg-transparent border-transparent text-fg-muted hover:bg-bg-elev hover:text-fg"
              }`}
            >
              <Circle
                size={8}
                weight="fill"
                className={active ? "text-success" : "text-fg-dim"}
              />
              <span className="text-[12px] font-mono truncate flex-1">{t.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  actions.closeTab(t.id);
                }}
                className="w-4 h-4 grid place-items-center rounded text-fg-dim hover:text-fg hover:bg-bg"
                aria-label="Close tab"
              >
                <span className="text-[14px] leading-none">×</span>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
