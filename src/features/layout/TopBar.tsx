import { useEffect, useRef, useState } from "react";
import {
  HardDrives,
  Plus,
  Circle,
  PencilSimple,
  Trash,
  Plug,
  Gear,
  ClockCounterClockwise,
  Lightning,
  TerminalWindow,
  SquaresFour,
  FolderDashed,
  MagnifyingGlass,
  LockKey,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { actions, useStore } from "@/lib/store";
import type { Connection } from "@/lib/types";
import { ConnectionForm } from "@/features/connections/ConnectionForm";
import { Tooltip } from "@/components/Tooltip";
import { HostIcon } from "@/components/HostIcon";
import { AnimatePresence, motion } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ConnectionRuntimeState } from "@/lib/types";

type Popover = "machines" | null;

function TabFavicon({
  conn,
  state,
  active,
}: {
  conn: Connection | undefined;
  state: ConnectionRuntimeState | undefined;
  active: boolean;
}) {
  const isConnecting = state === "connecting";
  const isError = state === "error";

  if (!conn) {
    return (
      <TerminalWindow
        size={14}
        weight={active ? "duotone" : "regular"}
        className="shrink-0 text-fg-muted"
      />
    );
  }

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-4 h-4 shrink-0 flex items-center justify-center text-danger"
      >
        <WarningCircle size={14} weight="fill" />
      </motion.div>
    );
  }

  return (
    <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
      <AnimatePresence>
        {isConnecting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-10"
          >
            <svg
              className="w-full h-full animate-spin text-accent"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              shapeRendering="geometricPrecision"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="24 60"
                className="opacity-90"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        animate={{
          scale: isConnecting ? 0.6 : 1,
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <HostIcon conn={conn} size={16} />
      </motion.div>
    </div>
  );
}

export function TopBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const connections = useStore((s) => s.connections);
  const groups = useStore((s) => s.groups);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [open, setOpen] = useState<Popover>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  // Removed mousedown effect for wrapRef since Radix Popover handles outside clicks

  useEffect(() => {
    const onNew = () => {
      setEditing(null);
      setFormOpen(true);
      setOpen(null);
    };
    const onOpenMachines = () => setOpen("machines");
    window.addEventListener("tm:new-connection", onNew);
    window.addEventListener("tm:focus-search", onOpenMachines);
    window.addEventListener("tm:open-history", onOpenMachines);
    window.addEventListener("tm:check-history", onOpenMachines);

    return () => {
      window.removeEventListener("tm:new-connection", onNew);
      window.removeEventListener("tm:focus-search", onOpenMachines);
      window.removeEventListener("tm:open-history", onOpenMachines);
      window.removeEventListener("tm:check-history", onOpenMachines);
    };
  }, []);

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

  const recent = [...connections].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  if (!mounted) {
    return (
      <div className="border-b border-[var(--titlebar-border)] bg-[var(--titlebar-bg)] h-[45px] z-40" />
    );
  }

  return (
    <div
      className="border-b border-[var(--titlebar-border)] bg-[var(--titlebar-bg)] select-none relative z-40"
      ref={wrapRef}
    >
      <div className="h-[44px] pl-3 pr-2 flex items-stretch gap-2">
        <div className="flex items-center pl-0.5 pr-1 shrink-0">
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTi-TGmA1kwrrCDuC7QtX3cojJb27aSXjE0Qw&s"
            alt="Logo"
            className="w-6 h-6 rounded-[6px] object-cover"
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
          <FeaturePill
            icon={<HardDrives size={13} weight="duotone" />}
            label="Hosts"
            active={activeTabId === null}
            onClick={() => actions.goHome()}
          />

          <AnimatePresence initial={false}>
            {tabs.length > 0 && (
              <motion.div
                key="separator"
                initial={{ opacity: 0, width: 0, marginLeft: 0, marginRight: 0 }}
                animate={{ opacity: 1, width: 1, marginLeft: 4, marginRight: 4 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0, marginRight: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="h-4 bg-border shrink-0"
              />
            )}
          </AnimatePresence>

          <div className="flex items-center gap-1 shrink min-w-0">
            <AnimatePresence initial={false}>
              {tabs.map((t) => {
                const active = t.id === activeTabId;
                const c = connections.find((conn) => conn.id === t.connectionId);

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.8, maxWidth: 0 }}
                    animate={{ opacity: 1, scale: 1, maxWidth: 200 }}
                    exit={{ opacity: 0, scale: 0.8, maxWidth: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                    key={t.id}
                    className="shrink flex min-w-[48px] w-[200px]"
                  >
                    <Tooltip
                      delay={500}
                      side="bottom"
                      multiline
                      matchAnchorWidth
                      minWidth={180}
                      className="flex min-w-0 flex-1 h-full overflow-hidden min-h-8"
                      label={(() => {
                        if (!c) return t.title;

                        const group = c.groupId ? groups.find((g) => g.id === c.groupId) : null;
                        const groupName = group ? group.name : "Uncategorized";

                        const started = t.startedAt
                          ? new Date(t.startedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Unknown";

                        return (
                          <div className="flex flex-col gap-0.5 w-full min-w-0 text-left">
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-fg-dim text-[10.5px]">
                              ssh://{c.username}@{c.host}:{c.port}
                            </span>
                            <div className="h-px bg-border my-1" />
                            <div className="flex justify-between items-center gap-2 text-[10px] min-w-0">
                              <span className="text-fg-muted shrink-0">Group</span>
                              <span className="text-fg-dim text-right truncate">{groupName}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2 text-[10px] min-w-0">
                              <span className="text-fg-muted shrink-0">Started</span>
                              <span className="text-fg-dim tabular-nums">{started}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2 text-[10px] min-w-0">
                              <span className="text-fg-muted shrink-0">Commands</span>
                              <span className="text-fg-dim tabular-nums">
                                {t.commandCount || 0}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    >
                      <div
                        onClick={() => actions.setActiveTab(t.id)}
                        className={`group relative w-full h-8 flex items-center gap-1.5 pl-2.5 pr-2 rounded-[8px] cursor-pointer text-[12px] font-sans transition-colors border ${
                          active
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-[var(--command-bg)] text-fg-muted hover:bg-[var(--command-active-bg)] hover:text-fg border-border"
                        }`}
                      >
                        <TabFavicon
                          conn={c}
                          state={c ? connectionStatus[c.id]?.state : undefined}
                          active={active}
                        />
                        <span
                          className="flex-1 whitespace-nowrap overflow-hidden block min-w-0 pr-4"
                          style={{
                            maskImage:
                              "linear-gradient(to right, black calc(100% - 16px), transparent 100%)",
                            WebkitMaskImage:
                              "linear-gradient(to right, black calc(100% - 16px), transparent 100%)",
                          }}
                        >
                          {t.title}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.closeTab(t.id);
                          }}
                          className={`absolute right-1 w-5 h-5 flex items-center justify-center rounded transition-all opacity-0 group-hover:opacity-100 ${
                            active
                              ? "text-success/70 hover:text-success hover:bg-success/20"
                              : "text-fg-dim hover:text-fg hover:bg-[var(--bg-elev)]"
                          }`}
                          aria-label="Close tab"
                        >
                          <span className="text-[16px] leading-none mb-[1.5px]">×</span>
                        </button>
                      </div>
                    </Tooltip>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="h-4 w-px shrink-0 self-center mx-1 bg-border" aria-hidden />

          <Popover open={open === "machines"} onOpenChange={(o) => setOpen(o ? "machines" : null)}>
            <div className="relative flex items-center shrink-0">
              <Tooltip label="New session" side="bottom">
                <PopoverTrigger asChild>
                  <button
                    aria-label="New tab"
                    className={`w-7 h-7 grid place-items-center rounded-[8px] transition-colors ${
                      open === "machines"
                        ? "text-fg bg-[var(--command-active-bg)]"
                        : "text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
                    }`}
                  >
                    <Plus size={14} weight="bold" />
                  </button>
                </PopoverTrigger>
              </Tooltip>

              <PopoverContent
                align="start"
                sideOffset={6}
                collisionPadding={16}
                className="p-0 border-none shadow-none w-auto bg-transparent z-50"
              >
                <MachinesPopover
                  connections={connections}
                  groups={groups}
                  onConnect={(c) => {
                    actions.openTab(c.id);
                    setOpen(null);
                  }}
                  onEditConn={openEditConn}
                  onNewConn={openNewConn}
                  onCancel={() => setOpen(null)}
                />
              </PopoverContent>
            </div>
          </Popover>
        </div>

        <div className="flex items-center shrink-0 relative h-8 self-center">
          <div className="w-px h-4 bg-border ml-1 mr-0.5 opacity-60" />
          <Tooltip label="Bangs" side="bottom">
            <button
              onClick={() => actions.openSettingsTab("bangs")}
              aria-label="Bangs"
              className="w-7 h-7 grid place-items-center rounded-[7px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
            >
              <Lightning size={17} weight="regular" />
            </button>
          </Tooltip>
          <Tooltip label="Activity Logs" side="bottom">
            <button
              onClick={() => actions.toggleBottom()}
              aria-label="Activity logs"
              className="w-7 h-7 grid place-items-center rounded-[7px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
            >
              <ClockCounterClockwise size={17} weight="regular" />
            </button>
          </Tooltip>
          <Tooltip label="Lock" side="bottom">
            <button
              onClick={() => actions.lockApp()}
              aria-label="Lock App"
              className="w-7 h-7 grid place-items-center rounded-[7px] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
            >
              <LockKey size={17} weight="regular" />
            </button>
          </Tooltip>
          <Tooltip label="Settings" side="bottom">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => actions.toggleSettings()}
              aria-label="Toggle settings"
              className={`w-7 h-7 grid place-items-center rounded-[7px] transition-colors ${
                settingsOpen
                  ? "text-fg bg-[var(--command-active-bg)]"
                  : "text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
              }`}
            >
              <Gear size={17} weight={settingsOpen ? "fill" : "regular"} />
            </button>
          </Tooltip>
        </div>
      </div>

      <ConnectionForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />
    </div>
  );
}

function FeaturePill({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-[8px] border text-[12px] font-sans transition-colors shrink-0 ${
        active
          ? "bg-[var(--command-active-bg)] border-accent/40 text-fg"
          : "bg-[var(--command-bg)] border-border text-fg hover:bg-[var(--command-active-bg)]"
      }`}
    >
      <span className={active ? "text-fg" : "text-fg-muted"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function MachinesPopover({
  connections,
  groups,
  onConnect,
  onEditConn,
  onNewConn,
  onCancel,
}: {
  connections: Connection[];
  groups: any[];
  onConnect: (c: Connection) => void;
  onEditConn: (c: Connection) => void;
  onNewConn: () => void;
  onCancel: () => void;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeArea, setActiveArea] = useState<"groups" | "hosts">("hosts");
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const connectionStatus = useStore((s) => s.connectionStatus);

  const filteredHosts = search.trim()
    ? connections.filter(
        (c) =>
          c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          c.username.toLowerCase().includes(search.trim().toLowerCase()) ||
          c.host.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : selectedGroupId === null
      ? connections
      : selectedGroupId === "__uncategorized__"
        ? connections.filter((c) => !c.groupId)
        : connections.filter((c) => c.groupId === selectedGroupId);

  const uncategorizedCount = connections.filter((c) => !c.groupId).length;

  const groupCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of connections) {
      if (c.groupId) m[c.groupId] = (m[c.groupId] ?? 0) + 1;
    }
    return m;
  }, [connections]);

  const allGroups = useMemo(
    () => [
      { id: null, name: "All", count: connections.length },
      { id: "__uncategorized__", name: "Uncategorized", count: uncategorizedCount },
      ...groups.map((g) => ({ id: g.id, name: g.name, count: groupCounts[g.id] ?? 0 })),
    ],
    [connections.length, uncategorizedCount, groups, groupCounts],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, selectedGroupId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If we're typing and not in the input, focus it
      if (
        inputRef.current &&
        document.activeElement !== inputRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        inputRef.current.focus();
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (activeArea === "hosts") {
          setSelectedIndex((i) => Math.min(i + 1, filteredHosts.length - 1));
        } else {
          setSelectedGroupIndex((i) => Math.min(i + 1, allGroups.length - 1));
          setSelectedGroupId(allGroups[Math.min(selectedGroupIndex + 1, allGroups.length - 1)].id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (activeArea === "hosts") {
          setSelectedIndex((i) => Math.max(i - 1, 0));
        } else {
          setSelectedGroupIndex((i) => Math.max(i - 1, 0));
          setSelectedGroupId(allGroups[Math.max(selectedGroupIndex - 1, 0)].id);
        }
      } else if (e.key === "ArrowRight") {
        if (activeArea === "groups") {
          e.preventDefault();
          setActiveArea("hosts");
          inputRef.current?.focus();
        }
      } else if (e.key === "ArrowLeft") {
        if (activeArea === "hosts") {
          e.preventDefault();
          setActiveArea("groups");
        }
      } else if (e.key === "Enter") {
        if (activeArea === "hosts") {
          const selected = filteredHosts[selectedIndex];
          if (selected && connectionStatus[selected.id]?.state !== "connecting") {
            e.preventDefault();
            onConnect(selected);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    filteredHosts,
    selectedIndex,
    onConnect,
    activeArea,
    selectedGroupIndex,
    allGroups,
    connectionStatus,
  ]);

  return (
    <div className="bg-[var(--menu-bg)] border border-border rounded-[12px] shadow-2xl overflow-hidden flex w-[550px] h-[360px]">
      {/* Left side: Groups */}
      <div className="w-[200px] border-r border-border flex flex-col min-h-0 bg-[var(--bg-panel)]/50">
        <div className="h-9 px-3 flex items-center justify-between border-b border-border shrink-0">
          <span className="text-[10px] uppercase font-sans font-semibold text-fg-muted tracking-wider">
            Groups
          </span>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 p-1.5 flex flex-col gap-0.5">
          {allGroups.map((g, i) => (
            <GroupItem
              key={String(g.id)}
              active={selectedGroupId === g.id}
              focused={activeArea === "groups" && selectedGroupIndex === i}
              onClick={() => {
                setSelectedGroupId(g.id);
                setSelectedGroupIndex(i);
                setActiveArea("groups");
              }}
              icon={
                g.id === null ? (
                  <SquaresFour size={14} weight="fill" className="text-fg" />
                ) : g.id === "__uncategorized__" ? (
                  <FolderDashed size={14} weight="regular" className="text-fg-muted" />
                ) : (
                  <HardDrives size={13} weight="fill" className="text-white" />
                )
              }
              iconContainerClass={
                g.id !== null && g.id !== "__uncategorized__"
                  ? "bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] shadow-inner"
                  : undefined
              }
              label={g.name}
              count={g.count}
            />
          ))}
        </div>
        <div className="shrink-0 border-t border-border p-1.5">
          <div className="grid grid-cols-2 gap-1.5 w-full">
            <button
              type="button"
              onClick={onNewConn}
              className="min-w-0 h-8 px-2 inline-flex items-center justify-center gap-1 rounded-[8px] bg-accent text-accent-fg text-[11px] font-sans font-semibold hover:opacity-90 transition-colors"
            >
              <Plus size={12} weight="bold" className="shrink-0" />
              <span className="truncate">New host</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="min-w-0 h-8 px-2 rounded-[8px] border border-border text-[11px] font-sans font-medium text-fg-muted hover:text-fg hover:bg-[var(--bg-panel)] transition-colors truncate"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Right side: Hosts */}
      <div className="flex-1 flex flex-col min-h-0 bg-bg">
        <div className="h-9 px-2 flex items-center border-b border-border bg-[var(--bg-panel)]/50 shrink-0 gap-2">
          <div className="flex items-center flex-1 gap-1.5 px-1">
            <MagnifyingGlass size={13} className="text-fg-muted shrink-0" weight="bold" />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              placeholder="Search hosts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent outline-none text-[11.5px] font-sans text-fg placeholder:text-fg-muted"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0 p-1.5">
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5">
            {filteredHosts.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center px-4 py-8">
                <div className="text-[12.5px] text-fg-muted font-sans text-center">
                  No hosts found.
                </div>
              </div>
            ) : (
              filteredHosts.map((c, i) => {
                const isConnecting = connectionStatus[c.id]?.state === "connecting";

                return (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] transition-colors ${
                      isConnecting ? "cursor-wait opacity-70" : "cursor-pointer"
                    } ${
                      i === selectedIndex
                        ? "bg-[var(--bg-panel)] shadow-sm"
                        : "hover:bg-[var(--bg-panel)]"
                    }`}
                    onClick={() => {
                      if (!isConnecting) onConnect(c);
                    }}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <div className="shrink-0">
                      <HostIcon conn={c} size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-sans font-medium text-fg truncate">
                        {c.name}
                      </div>
                      <div className="text-[10.5px] font-mono text-fg-dim truncate leading-none mt-0.5">
                        {isConnecting ? "connecting..." : `ssh://${c.username}@${c.host}:${c.port}`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupItem({
  active,
  focused,
  onClick,
  icon,
  iconContainerClass,
  label,
  count,
}: {
  active: boolean;
  focused?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  iconContainerClass?: string;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-left transition-colors ${
        focused
          ? "bg-[var(--command-active-bg)] ring-1 ring-accent/30 text-fg"
          : active
            ? "bg-[var(--bg-panel)]/80 text-fg"
            : "hover:bg-[var(--bg-panel)] text-fg-muted"
      }`}
    >
      <div
        className={`w-5 h-5 rounded-[4px] grid place-items-center shrink-0 ${iconContainerClass || (active ? "bg-[var(--bg-panel)]/50" : "bg-bg/50")}`}
      >
        {icon}
      </div>
      <span className="flex-1 truncate text-[12px] font-sans font-medium">{label}</span>
      <span className={`text-[10.5px] font-mono ${active ? "text-fg-muted" : "text-fg-dim"}`}>
        {count}
      </span>
    </button>
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
    <Tooltip label={label} side="top">
      <button
        onClick={onClick}
        aria-label={label}
        className={`w-7 h-7 grid place-items-center rounded text-fg-muted hover:bg-bg-elev ${
          danger ? "hover:text-danger" : "hover:text-fg"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
