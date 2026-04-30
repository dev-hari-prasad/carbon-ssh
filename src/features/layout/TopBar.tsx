import { useEffect, useRef, useState } from "react";
import {
  MagnifyingGlass,
  BookmarkSimple,
  Clock,
  HardDrives,
  Plus,
  DotsThreeVertical,
  Circle,
  PencilSimple,
  Trash,
  Plug,
  Sun,
  Moon,
  Lightning,
} from "@phosphor-icons/react";
import { actions, useStore } from "@/lib/store";
import type { Bang, Connection } from "@/lib/types";
import { ConnectionForm } from "@/features/connections/ConnectionForm";
import { BangForm } from "@/features/bangs/BangForm";

type Popover = "machines" | "bookmarks" | "history" | "bangs" | null;

export function TopBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const connections = useStore((s) => s.connections);
  const bangs = useStore((s) => s.bangs);
  const theme = useStore((s) => s.theme);
  const logs = useStore((s) => s.logs);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Popover>(null);
  const [openAnchor, setOpenAnchor] = useState<"search" | "tools">("search");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [bangFormOpen, setBangFormOpen] = useState(false);
  const [editingBang, setEditingBang] = useState<Bang | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeConn = activeTab
    ? connections.find((c) => c.id === activeTab.connectionId)
    : null;
  const url = activeConn
    ? `ssh://${activeConn.username}@${activeConn.host}:${activeConn.port}`
    : "ssh://— no active session";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(null);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filteredConns = connections.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.host.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q),
  );
  const recent = [...connections]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  function openEditConn(c: Connection) {
    setEditing(c);
    setFormOpen(true);
    setOpen(null);
  }
  function openNewConn() {
    setEditing(null);
    setFormOpen(true);
    setOpen(null);
  }
  function openEditBang(b: Bang) {
    setEditingBang(b);
    setBangFormOpen(true);
    setOpen(null);
  }
  function openNewBang() {
    setEditingBang(null);
    setBangFormOpen(true);
    setOpen(null);
  }

  function toggleTool(kind: NonNullable<Popover>) {
    setOpenAnchor("tools");
    setOpen((o) => (o === kind ? null : kind));
  }

  return (
    <div className="border-b border-border bg-bg-panel select-none" ref={wrapRef}>
      <div className="h-12 px-3 flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 pr-3 border-r border-border h-full">
          <div className="w-6 h-6 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center">
            <Circle size={8} weight="fill" className="text-accent" />
          </div>
          <div className="font-sans font-bold text-[13px] tracking-tight text-fg">
            relay<span className="text-fg-dim font-normal">/ssh</span>
          </div>
        </div>

        {/* URL / search bar */}
        <div className="flex-1 max-w-2xl mx-auto relative">
          <div className="h-8 flex items-center bg-bg border border-border rounded-md focus-within:border-accent transition-colors">
            <div className="pl-2.5 pr-2 text-fg-dim flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <MagnifyingGlass size={12} weight="bold" />
            </div>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpenAnchor("search");
                setOpen(e.target.value.startsWith("!") ? "bangs" : "machines");
              }}
              onFocus={() => {
                setOpenAnchor("search");
                setOpen(query.startsWith("!") ? "bangs" : "machines");
              }}
              placeholder={url}
              className="flex-1 h-full bg-transparent text-[12.5px] font-mono text-fg placeholder:text-fg-dim focus:outline-none pr-2"
            />
          </div>

          {open && openAnchor === "search" ? (
            <SearchPopover
              kind={open}
              query={query}
              connections={filteredConns}
              recent={recent}
              bangs={bangs}
              onConnect={(c) => {
                actions.openTab(c.id);
                setOpen(null);
                setQuery("");
              }}
              onEditConn={openEditConn}
              onNewConn={openNewConn}
              onEditBang={openEditBang}
              onNewBang={openNewBang}
            />
          ) : null}
        </div>

        {/* Tools group: bookmark, history, machines, bangs, theme */}
        <div className="flex items-center gap-0.5 px-1 h-8 bg-bg border border-border rounded-md relative">
          <ToolBtn
            label="Bookmarks"
            active={open === "bookmarks" && openAnchor === "tools"}
            onClick={() => toggleTool("bookmarks")}
          >
            <BookmarkSimple
              size={14}
              weight={open === "bookmarks" && openAnchor === "tools" ? "fill" : "regular"}
            />
          </ToolBtn>
          <ToolBtn
            label="History"
            active={open === "history" && openAnchor === "tools"}
            onClick={() => toggleTool("history")}
          >
            <Clock
              size={14}
              weight={open === "history" && openAnchor === "tools" ? "fill" : "regular"}
            />
          </ToolBtn>
          <ToolBtn
            label="Machines"
            active={open === "machines" && openAnchor === "tools"}
            onClick={() => toggleTool("machines")}
          >
            <HardDrives
              size={14}
              weight={open === "machines" && openAnchor === "tools" ? "fill" : "regular"}
            />
          </ToolBtn>
          <ToolBtn
            label="Bangs"
            active={open === "bangs" && openAnchor === "tools"}
            onClick={() => toggleTool("bangs")}
          >
            <span className="font-mono font-bold text-[14px] leading-none">!</span>
          </ToolBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolBtn
            label={theme === "dark" ? "Light theme" : "Dark theme"}
            onClick={() => actions.toggleTheme()}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </ToolBtn>

          {open && openAnchor === "tools" ? (
            <div className="absolute z-30 right-0 mt-1.5 top-full w-[420px]">
              <SearchPopover
                kind={open}
                query=""
                connections={connections}
                recent={recent}
                bangs={bangs}
                onConnect={(c) => {
                  actions.openTab(c.id);
                  setOpen(null);
                }}
                onEditConn={openEditConn}
                onNewConn={openNewConn}
                onEditBang={openEditBang}
                onNewBang={openNewBang}
              />
            </div>
          ) : null}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={openNewConn}
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

      <TabsRow />

      <ConnectionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
      />
      <BangForm
        open={bangFormOpen}
        onClose={() => setBangFormOpen(false)}
        initial={editingBang}
      />
    </div>
  );
}

function ToolBtn({
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

function SearchPopover({
  kind,
  query,
  connections,
  recent,
  bangs,
  onConnect,
  onEditConn,
  onNewConn,
  onEditBang,
  onNewBang,
}: {
  kind: NonNullable<Popover>;
  query: string;
  connections: Connection[];
  recent: Connection[];
  bangs: Bang[];
  onConnect: (c: Connection) => void;
  onEditConn: (c: Connection) => void;
  onNewConn: () => void;
  onEditBang: (b: Bang) => void;
  onNewBang: () => void;
}) {
  if (kind === "bangs") {
    const filter = query.replace(/^!/, "").toLowerCase();
    const list = filter
      ? bangs.filter(
          (b) =>
            b.trigger.toLowerCase().includes(filter) ||
            b.command.toLowerCase().includes(filter) ||
            (b.description ?? "").toLowerCase().includes(filter),
        )
      : bangs;
    return (
      <PopoverShell heading="Bangs" actionLabel="new bang" onAction={onNewBang}>
        {list.length === 0 ? (
          <Empty
            text="No bangs yet."
            actionText="+ Create your first"
            onAction={onNewBang}
          />
        ) : (
          list.map((b) => (
            <div
              key={b.id}
              className="group flex items-start gap-3 px-3 py-2 hover:bg-bg-panel"
            >
              <div className="w-7 h-7 shrink-0 rounded-md bg-bg border border-border grid place-items-center text-accent">
                <Lightning size={13} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[13px] font-semibold text-fg">
                    !{b.trigger}
                  </span>
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
                <IconBtn label="Edit" onClick={() => onEditBang(b)}>
                  <PencilSimple size={12} />
                </IconBtn>
                <IconBtn label="Delete" danger onClick={() => actions.deleteBang(b.id)}>
                  <Trash size={12} />
                </IconBtn>
              </div>
            </div>
          ))
        )}
      </PopoverShell>
    );
  }

  const list = kind === "history" ? recent : connections;
  const heading =
    kind === "machines" ? "Machines" : kind === "bookmarks" ? "Bookmarked" : "Recent";

  return (
    <PopoverShell heading={heading} actionLabel="new machine" onAction={onNewConn}>
      {list.length === 0 ? (
        <Empty
          text={kind === "history" ? "No recent sessions." : "No machines saved yet."}
          actionText="+ Add your first"
          onAction={onNewConn}
        />
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
              <IconBtn
                label="Connect"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnect(c);
                }}
              >
                <Plug size={12} />
              </IconBtn>
              <IconBtn
                label="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditConn(c);
                }}
              >
                <PencilSimple size={12} />
              </IconBtn>
              <IconBtn
                label="Delete"
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  actions.deleteConnection(c.id);
                }}
              >
                <Trash size={12} />
              </IconBtn>
            </div>
          </div>
        ))
      )}
    </PopoverShell>
  );
}

function PopoverShell({
  heading,
  actionLabel,
  onAction,
  children,
}: {
  heading: string;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute z-30 left-0 right-0 mt-1.5 bg-bg-elev border border-border rounded-lg shadow-2xl overflow-hidden">
      <div className="h-9 px-3 flex items-center justify-between border-b border-border">
        <span className="text-xxs uppercase font-sans font-semibold text-fg-muted tracking-wider">
          {heading}
        </span>
        <button
          onClick={onAction}
          className="text-[11.5px] font-mono text-accent hover:underline flex items-center gap-1"
        >
          <Plus size={11} weight="bold" /> {actionLabel}
        </button>
      </div>
      <div className="max-h-[360px] overflow-y-auto py-1">{children}</div>
    </div>
  );
}

function Empty({
  text,
  actionText,
  onAction,
}: {
  text: string;
  actionText: string;
  onAction: () => void;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="text-[12.5px] text-fg-muted font-sans">{text}</div>
      <button
        onClick={onAction}
        className="mt-2 text-[12px] font-mono text-accent hover:underline"
      >
        {actionText}
      </button>
    </div>
  );
}

function IconBtn({
  children,
  label,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-7 h-7 grid place-items-center rounded text-fg-muted hover:bg-bg-elev ${
        danger ? "hover:text-danger" : "hover:text-fg"
      }`}
    >
      {children}
    </button>
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
