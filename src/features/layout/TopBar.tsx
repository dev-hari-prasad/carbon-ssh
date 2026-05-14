import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  FolderIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ServerStackIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import {
  Cog6ToothIcon as Cog6ToothIconSolid,
  ExclamationTriangleIcon,
  ServerStackIcon as ServerStackIconSolid,
  Squares2X2Icon as Squares2X2IconSolid,
} from "@heroicons/react/24/solid";
import { getThemeById } from "@/config/themes";
import { actions, useStore } from "@/lib/store";
import type { Connection, SplitLayout } from "@/lib/types";
import { SPLIT_LAYOUT_SLOTS } from "@/lib/types";
import { ConnectionForm } from "@/features/connections/ConnectionForm";
import { Tooltip } from "@/components/Tooltip";
import { HostIcon } from "@/components/HostIcon";
import { TabIcon } from "@/components/TabIcon";
import { AnimatePresence, motion } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ConnectionRuntimeState } from "@/lib/types";
import { TabContextMenu } from "./TabContextMenu";
import { SplitLayoutPicker } from "./SplitLayoutPicker";
import { useTabStripDnD } from "./tabStripDnD";
import { Kbd } from "@/components/Kbd";

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
      <CommandLineIcon
        className={`shrink-0 w-3.5 h-3.5 ${active ? "text-fg" : "text-fg-muted"}`}
      />
    );
  }

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-4 h-4 shrink-0 flex items-center justify-center text-danger"
      >
        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
      </motion.div>
    );
  }

  return (
    <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
      <AnimatePresence>
        {isConnecting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
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
        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <TabIcon conn={conn} size={16} />
      </motion.div>
    </div>
  );
}

export function TopBar({ isTitleBar }: { isTitleBar?: boolean }) {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const connections = useStore((s) => s.connections);
  const groups = useStore((s) => s.groups);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const rawSplitTabIds = useStore((s) => s.splitTabIds);
  const splitLayout = useStore((s) => s.splitLayout);
  const splitTabIds = useMemo(() => rawSplitTabIds.slice(0, SPLIT_LAYOUT_SLOTS[splitLayout]), [rawSplitTabIds, splitLayout]);
  const themeId = useStore((s) => s.theme);
  const tabDnD = useTabStripDnD({ tabs, orientation: "horizontal" });
  const logoSrc = useMemo(() => {
    const kind = getThemeById(themeId).type;
    const file =
      kind === "light" ? "Carbon logo dark.png" : "Carbon logo light.png";
    return `/logo/${encodeURIComponent(file)}`;
  }, [themeId]);
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
      <div className="bg-[var(--titlebar-bg)] h-[40px] z-40" />
    );
  }

  return (
    <div
      className={`${isTitleBar ? "" : "bg-[var(--titlebar-bg)]"} select-none relative z-40`}
      ref={wrapRef}
    >
      <div className="h-[40px] pl-3 pr-2 flex items-stretch gap-2">
        <div className="flex items-center pl-0 shrink-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <Tooltip label="This is just a logo, click on it for a surprise" side="bottom">
            <a
              href="https://github.com/CarbonSSH/carbon"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={logoSrc}
                alt="Logo"
                className="w-6 h-6 rounded-sm object-contain"
              />
            </a>
          </Tooltip>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
          <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <FeaturePill
              icon={<ServerStackIcon className="w-[13px] h-[13px]" />}
              label="Hosts"
              active={activeTabId === null}
              onClick={() => actions.goHome()}
            />
          </div>

          <AnimatePresence initial={false}>
            {tabs.length > 0 && (
              <motion.div
                key="separator"
                initial={{ opacity: 0, width: 0, marginLeft: 0, marginRight: 0 }}
                animate={{ opacity: 0.6, width: 1, marginLeft: 4, marginRight: 4 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0, marginRight: 0 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className="h-4 bg-border shrink-0"
              />
            )}
          </AnimatePresence>

          <div
            ref={tabDnD.stripRef}
            className="flex items-center shrink min-w-0"
            onDragOver={tabDnD.handleDragOver}
            onDrop={tabDnD.handleDrop}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <AnimatePresence initial={false}>
            {(() => {
              type Seg = { kind: "tab"; tab: typeof tabs[number] } | { kind: "group"; tabs: typeof tabs };
              const segs: Seg[] = [];
              let i = 0;
              while (i < tabs.length) {
                if (splitTabIds.includes(tabs[i].id)) {
                  const g: typeof tabs = [];
                  while (i < tabs.length && splitTabIds.includes(tabs[i].id)) {
                    g.push(tabs[i]);
                    i++;
                  }
                  segs.push({ kind: "group", tabs: g });
                } else {
                  segs.push({ kind: "tab", tab: tabs[i] });
                  i++;
                }
              }

              const renderTab = (t: typeof tabs[number], inGroup: boolean) => {
                const active = t.id === activeTabId;
                const c = connections.find((conn) => conn.id === t.connectionId);
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.85, width: 0, minWidth: 0, marginRight: 0 }}
                    animate={{ opacity: 1, scale: 1, width: inGroup ? 160 : 200, minWidth: inGroup ? 40 : 48, marginRight: inGroup ? 0 : 4 }}
                    exit={{ opacity: 0, scale: 0.85, width: 0, minWidth: 0, paddingLeft: 0, paddingRight: 0, marginLeft: 0, marginRight: 0 }}
                    transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    style={{ overflow: "hidden" }}
                    key={t.id}
                    className={`shrink flex ${tabDnD.draggingId === t.id ? "opacity-45" : ""}`}
                  >
                    <TabContextMenu tabId={t.id}>
                      <Tooltip
                        delay={500}
                        side="bottom"
                        multiline
                        matchAnchorWidth
                        minWidth={180}
                        className={`flex min-w-0 flex-1 h-full overflow-hidden ${inGroup ? "min-h-7" : "min-h-8"}`}
                        label={(() => {
                          if (!c) return t.title;
                          const group = c.groupId ? groups.find((g) => g.id === c.groupId) : null;
                          const groupName = group ? group.name : "Uncategorized";
                          const started = t.startedAt
                            ? new Date(t.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "Unknown";
                          return (
                            <div className="flex flex-col gap-0.5 w-full min-w-0 text-left">
                              <span className="font-semibold">{c.name}</span>
                              <span className="text-fg-dim text-[10.5px]">ssh://{c.username}@{c.host}:{c.port}</span>
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
                                <span className="text-fg-dim tabular-nums">{t.commandCount || 0}</span>
                              </div>
                            </div>
                          );
                        })()}
                      >
                        <div
                          data-tab-strip-item={t.id}
                          draggable
                          onDragStart={(e) => tabDnD.handleDragStart(e, t.id)}
                          onDragEnd={tabDnD.handleDragEnd}
                          onClick={() => actions.setActiveTab(t.id)}
                          className={`group relative w-full ${inGroup ? "h-7" : "h-8"} flex items-center gap-1.5 pl-2.5 pr-2 rounded-sm cursor-default text-[12px] font-sans transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                            active
                              ? "bg-success/10 text-success"
                              : "bg-[var(--command-bg)] text-fg-muted hover:bg-[var(--command-active-bg)] hover:text-fg"
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
                              maskImage: "linear-gradient(to right, black calc(100% - 16px), transparent 100%)",
                              WebkitMaskImage: "linear-gradient(to right, black calc(100% - 16px), transparent 100%)",
                            }}
                          >
                            {t.title}
                          </span>
                          <button
                            type="button"
                            draggable={false}
                            onClick={(e) => { e.stopPropagation(); actions.closeTab(t.id); }}
                            className={`absolute right-1 w-5 h-5 flex items-center justify-center rounded-sm transition-all duration-150 opacity-0 group-hover:opacity-100 bg-[var(--bg-elev)] ${
                              active
                                ? "text-success/70 hover:text-success hover:bg-[var(--bg-elev)]"
                                : "text-fg-dim hover:text-fg hover:bg-[var(--bg-elev)]"
                            }`}
                            aria-label="Close tab"
                          >
                            <span className="text-[14px] leading-none">×</span>
                          </button>
                        </div>
                      </Tooltip>
                    </TabContextMenu>
                  </motion.div>
                );
              };

              return segs.map((seg) => {
                if (seg.kind === "group") {
                  return (
                    <motion.div
                      key={`split-group-${seg.tabs[0].id}`}
                      layout
                      initial={{ opacity: 0, scale: 0.97, marginRight: 0 }}
                      animate={{ opacity: 1, scale: 1, marginRight: 4 }}
                      exit={{ opacity: 0, scale: 0.97, marginRight: 0, paddingLeft: 0, paddingRight: 0 }}
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      className="shrink flex items-center rounded-md bg-[var(--command-active-bg)] px-1 py-1 gap-1"
                    >
                      <AnimatePresence initial={false}>
                        {seg.tabs.map((t) => renderTab(t, true))}
                      </AnimatePresence>
                    </motion.div>
                  );
                }
                return renderTab(seg.tab, false);
              });
            })()}
            </AnimatePresence>
          </div>

          <div className="h-4 w-px shrink-0 self-center mx-1 bg-border" aria-hidden />

          <Popover open={open === "machines"} onOpenChange={(o) => setOpen(o ? "machines" : null)}>
            <div className="relative flex items-center shrink-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <Tooltip label="New session" side="bottom">
                <PopoverTrigger asChild>
                  <button
                    aria-label="New tab"
                    className={`w-7 h-7 grid place-items-center rounded-sm transition-colors ${
                      open === "machines"
                        ? "text-fg bg-[var(--command-active-bg)]"
                        : "text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
                    }`}
                  >
              <PlusIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </PopoverTrigger>
              </Tooltip>

              <PopoverContent
                align="start"
                sideOffset={6}
                collisionPadding={16}
                onCloseAutoFocus={(e) => e.preventDefault()}
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

        <div className="flex items-center shrink-0 relative h-8 self-center" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <div className="w-px h-4 bg-border ml-1 mr-0.5 opacity-60" />
          <SplitLayoutPicker
            variant="top-bar"
            tabsLength={tabs.length}
            splitActive={splitTabIds.length >= 2}
          />
          <Tooltip label="Bangs" side="bottom">
            <button
              onClick={() => actions.openSettingsTab("bangs")}
              aria-label="Bangs"
              className="w-7 h-7 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
            >
              <BoltIcon className="w-[17px] h-[17px]" />
            </button>
          </Tooltip>
          <Tooltip label="Lock" side="bottom">
            <button
              onClick={() => actions.lockApp()}
              aria-label="Lock App"
              className="w-7 h-7 grid place-items-center rounded-sm text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors"
            >
              <LockClosedIcon className="w-[17px] h-[17px]" />
            </button>
          </Tooltip>
          <Tooltip label="Settings" side="bottom">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => actions.toggleSettings()}
              aria-label="Toggle settings"
              className={`w-7 h-7 grid place-items-center rounded-sm transition-colors ${
                settingsOpen
                  ? "text-fg bg-[var(--command-active-bg)]"
                  : "text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
              }`}
            >
              {settingsOpen ? (
                <Cog6ToothIconSolid className="w-[17px] h-[17px]" />
              ) : (
                <Cog6ToothIcon className="w-[17px] h-[17px]" />
              )}
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
      className={`h-8 px-3 inline-flex items-center gap-1 rounded-sm  text-[12px] font-sans transition-colors shrink-0 ${
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
    <div className="bg-[var(--menu-bg)] border border-border rounded-lg shadow-2xl overflow-hidden flex w-[550px] h-[360px]">
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
                  <Squares2X2IconSolid className="w-3.5 h-3.5 text-fg" />
                ) : g.id === "__uncategorized__" ? (
                  <FolderIcon className="w-3.5 h-3.5 text-fg-muted" />
                ) : (
                  <ServerStackIconSolid className="w-[13px] h-[13px] text-white" />
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
              className="min-w-0 h-8 px-2 inline-flex items-center justify-center gap-1 rounded-sm bg-accent text-accent-fg text-[11px] font-sans font-semibold hover:opacity-90 transition-colors"
            >
              <PlusIcon className="w-3 h-3 shrink-0" strokeWidth={2.5} />
              <span className="truncate">New host</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="min-w-0 h-8 px-2 rounded-sm border border-border text-[11px] font-sans font-medium text-fg-muted hover:text-fg hover:bg-[var(--bg-panel)] transition-colors truncate"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Right side: Hosts */}
      <div className="flex-1 flex flex-col min-h-0 bg-bg">
        <div className="h-9 px-2 flex items-center border-b border-border bg-[var(--bg-panel)]/50 shrink-0">
          <div className="flex items-center flex-1 gap-2 h-7 px-2.5 rounded-md bg-bg/40 border border-transparent transition-all focus-within:border-accent/50 focus-within:bg-bg focus-within:ring-2 focus-within:ring-accent/20 group/search">
            <MagnifyingGlassIcon className="w-[13px] h-[13px] text-fg-muted group-focus-within/search:text-accent transition-colors" strokeWidth={2.25} />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              placeholder="Search hosts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 text-[12px] font-sans text-fg placeholder:text-fg-muted h-full"
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
                    className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
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
                      <HostIcon conn={c} size={16} />
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
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-left transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
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

export function VerticalTabBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const connections = useStore((s) => s.connections);
  const groups = useStore((s) => s.groups);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const rawSplitTabIds = useStore((s) => s.splitTabIds);
  const splitLayout = useStore((s) => s.splitLayout);
  const splitTabIds = useMemo(() => rawSplitTabIds.slice(0, SPLIT_LAYOUT_SLOTS[splitLayout]), [rawSplitTabIds, splitLayout]);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useStore((s) => s.sidebarWidth);
  const themeId = useStore((s) => s.theme);
  const logoSrc = useMemo(() => {
    const kind = getThemeById(themeId).type;
    const file =
      kind === "light" ? "Carbon logo dark.png" : "Carbon logo light.png";
    return `/logo/${encodeURIComponent(file)}`;
  }, [themeId]);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState<Popover>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const sidebarTabDnD = useTabStripDnD({ tabs, orientation: "vertical" });

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    if (sidebarCollapsed) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      actions.setSidebarWidth(resizeRef.current.startW + delta);
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [sidebarCollapsed]);

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

  const tooltipSide = "right";
  const showTooltips = sidebarCollapsed;
  const animatedWidth = sidebarCollapsed ? 44 : sidebarWidth;

  if (!mounted) {
    return (
      <div className="bg-[var(--titlebar-bg)] z-40 shrink-0"
        style={{ width: animatedWidth }}
      />
    );
  }

  const TabButton = ({
    icon,
    label,
    active,
    onClick,
    tooltip,
  }: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    tooltip?: string;
  }) => (
    <Tooltip label={tooltip ?? label} side={tooltipSide} disabled={!showTooltips}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-sm transition-all duration-200 ease-out shrink-0 ${
          sidebarCollapsed
            ? "w-8 h-8 justify-center"
            : "w-full h-8 px-2.5 justify-start"
        } ${
          active
            ? "bg-[var(--command-active-bg)] text-fg"
            : "text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
        }`}
      >
        <span className="shrink-0">{icon}</span>
        {!sidebarCollapsed && (
          <span className="text-[12px] font-sans truncate">{label}</span>
        )}
      </button>
    </Tooltip>
  );

  return (
    <>
      <motion.div
        className="bg-[var(--titlebar-bg)] select-none relative z-40 flex flex-col shrink-0 h-full overflow-hidden"
        animate={{ width: animatedWidth }}
        initial={false}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Logo + Hosts + Collapse toggle */}
        <div className={`flex items-center shrink-0 pt-0 pb-1 ${sidebarCollapsed ? "flex-col gap-1.5 px-1" : "flex-row gap-2 px-1.5"}`}>
          <div className={sidebarCollapsed ? "" : "flex-1 min-w-0"}>
            <Tooltip label="Hosts" side={tooltipSide} disabled={!showTooltips}>
              <button
                onClick={() => actions.goHome()}
                className={`inline-flex items-center gap-2 rounded-sm transition-all duration-200 ease-out shrink-0 ${
                  sidebarCollapsed
                    ? "w-8 h-8 justify-center"
                    : "w-full h-8 px-2.5 justify-start"
                } ${
                  activeTabId === null && !settingsOpen
                    ? "bg-[var(--command-active-bg)] text-fg"
                    : "bg-[var(--command-bg)] text-fg hover:bg-[var(--command-active-bg)]"
                }`}
              >
                {activeTabId === null ? (
                  <ServerStackIconSolid className="w-4 h-4 shrink-0" />
                ) : (
                  <ServerStackIcon className="w-4 h-4 shrink-0" />
                )}
                {!sidebarCollapsed && (
                  <span className="text-[12px] font-sans truncate">Hosts</span>
                )}
              </button>
            </Tooltip>
          </div>
          <Tooltip 
            label={
              <div className="flex items-center gap-2">
                <span>{sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
                <Kbd>
                  {typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"}
                  +B
                </Kbd>
              </div>
            } 
            side={tooltipSide}
          >
            <button
              onClick={() => actions.toggleSidebarCollapsed()}
              className={`grid place-items-center rounded-sm bg-[var(--bg-panel)]/40 text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)] transition-colors shrink-0 ${
                sidebarCollapsed ? "w-8 h-8" : "w-7 h-7"
              }`}
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
              ) : (
                <ChevronLeftIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
              )}
            </button>
          </Tooltip>
        </div>

        <div className={`h-px bg-border shrink-0 ${sidebarCollapsed ? "mx-auto w-5" : "mx-2"}`} />

        {/* Session tabs */}
        <div
          ref={sidebarTabDnD.stripRef}
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col ${sidebarCollapsed ? "items-center py-1 px-1" : "py-1 px-1.5 mt-1 mx-0.5"}`}
          onDragOver={sidebarTabDnD.handleDragOver}
          onDrop={sidebarTabDnD.handleDrop}
        >
          <AnimatePresence initial={false}>
          {(() => {
            type Seg = { kind: "tab"; tab: typeof tabs[number] } | { kind: "group"; tabs: typeof tabs };
            const segs: Seg[] = [];
            let si = 0;
            while (si < tabs.length) {
              if (splitTabIds.includes(tabs[si].id)) {
                const g: typeof tabs = [];
                while (si < tabs.length && splitTabIds.includes(tabs[si].id)) {
                  g.push(tabs[si]);
                  si++;
                }
                segs.push({ kind: "group", tabs: g });
              } else {
                segs.push({ kind: "tab", tab: tabs[si] });
                si++;
              }
            }

            const renderSidebarTab = (t: typeof tabs[number]) => {
              const active = t.id === activeTabId;
              const c = connections.find((conn) => conn.id === t.connectionId);
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, x: -4, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto", marginBottom: sidebarCollapsed ? 2 : 4 }}
                  exit={{ opacity: 0, x: -4, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  key={t.id}
                  className={`min-w-0 w-full overflow-hidden ${sidebarCollapsed ? "flex justify-center" : ""} ${sidebarTabDnD.draggingId === t.id ? "opacity-45" : ""}`}
                >
                  <TabContextMenu tabId={t.id}>
                    <Tooltip
                      delay={300}
                      side={tooltipSide}
                      disabled={!showTooltips}
                      className={sidebarCollapsed ? undefined : "w-full"}
                      label={(() => {
                        if (!c) return t.title;
                        const group = c.groupId ? groups.find((g) => g.id === c.groupId) : null;
                        const groupName = group ? group.name : "Uncategorized";
                        const started = t.startedAt
                          ? new Date(t.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "Unknown";
                        return (
                          <div className="flex flex-col gap-0.5 w-full min-w-0 text-left">
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-fg-dim text-[10.5px]">ssh://{c.username}@{c.host}:{c.port}</span>
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
                              <span className="text-fg-dim tabular-nums">{t.commandCount || 0}</span>
                            </div>
                          </div>
                        );
                      })()}
                      multiline
                      minWidth={160}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        draggable
                        data-tab-strip-item={t.id}
                        onDragStart={(e) => sidebarTabDnD.handleDragStart(e, t.id)}
                        onDragEnd={sidebarTabDnD.handleDragEnd}
                        onClick={() => actions.setActiveTab(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            actions.setActiveTab(t.id);
                          }
                        }}
                        className={`group relative rounded-sm cursor-default transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                          sidebarCollapsed
                            ? "w-8 h-8 grid place-items-center"
                            : "w-full h-8 flex items-center gap-1.5 px-2.5 overflow-hidden"
                        } ${
                          active
                            ? "bg-success/10 text-success"
                            : "bg-[var(--command-bg)] text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
                        }`}
                      >
                        <TabFavicon
                          conn={c}
                          state={c ? connectionStatus[c.id]?.state : undefined}
                          active={active}
                        />
                        {!sidebarCollapsed && (
                          <span
                            className="flex-1 text-left text-[12px] font-sans truncate min-w-0 pr-4"
                            style={{
                              maskImage: "linear-gradient(to right, black calc(100% - 12px), transparent 100%)",
                              WebkitMaskImage: "linear-gradient(to right, black calc(100% - 12px), transparent 100%)",
                            }}
                          >
                            {t.title}
                          </span>
                        )}
                        {!sidebarCollapsed ? (
                          <button
                            type="button"
                            draggable={false}
                            onClick={(e) => { e.stopPropagation(); actions.closeTab(t.id); }}
                            className={`absolute right-1.5 w-5 h-5 flex items-center justify-center rounded-sm transition-all duration-150 opacity-0 group-hover:opacity-100 bg-[var(--bg-elev)] ${
                              active
                                ? "text-success/70 hover:text-success hover:bg-[var(--bg-elev)]"
                                : "text-fg-dim hover:text-fg hover:bg-[var(--bg-elev)]"
                            }`}
                            aria-label="Close tab"
                          >
                            <span className="text-[14px] leading-none">×</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            draggable={false}
                            onClick={(e) => { e.stopPropagation(); actions.closeTab(t.id); }}
                            className={`absolute inset-0 w-full h-full flex items-center justify-center rounded-sm transition-all duration-150 opacity-0 group-hover:opacity-100 z-10 ${
                              active
                                ? "bg-[var(--bg-elev)] text-success"
                                : "bg-[var(--bg-elev)] text-fg hover:bg-[var(--bg-elev)]"
                            }`}
                            aria-label="Close tab"
                          >
                            <span className="text-[14px] leading-none font-bold">×</span>
                          </button>
                        )}
                      </div>
                    </Tooltip>
                  </TabContextMenu>
                </motion.div>
              );
            };

            return segs.map((seg) => {
              if (seg.kind === "group") {
                return (
                  <motion.div
                    key={`split-group-${seg.tabs[0].id}`}
                    layout
                    initial={{ opacity: 0, x: -4, marginBottom: 0 }}
                    animate={{ opacity: 1, x: 0, marginBottom: sidebarCollapsed ? 2 : 4 }}
                    exit={{ opacity: 0, x: -4, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                    className={`rounded-md bg-[var(--command-active-bg)] w-full overflow-hidden ${
                      sidebarCollapsed ? "p-0.5 flex flex-col items-center" : "p-1 flex flex-col"
                    }`}
                  >
                    <AnimatePresence initial={false}>
                      {seg.tabs.map((t) => renderSidebarTab(t))}
                    </AnimatePresence>
                  </motion.div>
                );
              }
              return renderSidebarTab(seg.tab);
            });
          })()}
          </AnimatePresence>

          {/* New session button */}
          <div className={sidebarCollapsed ? "mt-auto pt-1" : "mt-auto pt-1 w-full"}>
            <Popover open={open === "machines"} onOpenChange={(o) => setOpen(o ? "machines" : null)}>
              {showTooltips ? (
                <Tooltip label="New session" side={tooltipSide}>
                  <PopoverTrigger asChild>
                    <button
                      aria-label="New tab"
                      className={`rounded-sm transition-colors duration-150 shrink-0 h-8 ${sidebarCollapsed ? "w-8" : "w-full"} grid place-items-center ${
                        open === "machines"
                          ? "text-fg bg-[var(--command-active-bg)]"
                          : "text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
                      }`}
                    >
                      <PlusIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                    </button>
                  </PopoverTrigger>
                </Tooltip>
              ) : (
                <PopoverTrigger asChild>
                  <button
                    aria-label="New tab"
                    className={`rounded-sm transition-colors duration-150 shrink-0 w-full h-8 flex items-center justify-center gap-2 px-2.5 border border-dashed border-border/50 hover:border-accent/50 ${
                      open === "machines"
                        ? "text-fg bg-[var(--command-active-bg)]"
                        : "text-fg-muted hover:text-fg hover:bg-[var(--command-active-bg)]"
                    }`}
                  >
                    <PlusIcon className="w-[15px] h-[15px] shrink-0" strokeWidth={2.5} />
                    {!sidebarCollapsed && (
                      <span className="text-[12px] font-sans">New session</span>
                    )}
                  </button>
                </PopoverTrigger>
              )}

              <PopoverContent
                side="right"
                align="start"
                sideOffset={0}
                collisionPadding={8}
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="p-0 border-none shadow-none w-auto bg-transparent z-50"
                style={{ marginLeft: 0 }}
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
            </Popover>
          </div>
        </div>

        {/* Bottom actions */}
        <div className={`flex ${sidebarCollapsed ? "flex-col items-center" : "flex-col"} gap-0.5 pb-2 pt-1 ${sidebarCollapsed ? "px-1" : "px-1.5"} shrink-0`}>
          <div className={`h-px bg-border mb-0.5 ${sidebarCollapsed ? "w-5 mx-auto" : "mx-1.5"}`} />
          
          <SplitLayoutPicker
            variant={sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}
            tabsLength={tabs.length}
            splitActive={splitTabIds.length >= 2}
          />
          <TabButton
            icon={<BoltIcon className="w-4 h-4" />}
            label="Bangs"
            tooltip="Bangs"
            onClick={() => actions.openSettingsTab("bangs")}
          />
          <TabButton
            icon={<LockClosedIcon className="w-4 h-4" />}
            label="Lock"
            tooltip="Lock"
            onClick={() => actions.lockApp()}
          />
          <TabButton
            icon={
              settingsOpen ? (
                <Cog6ToothIconSolid className="w-4 h-4" />
              ) : (
                <Cog6ToothIcon className="w-4 h-4" />
              )
            }
            label="Settings"
            tooltip="Settings"
            active={settingsOpen}
            onClick={() => actions.toggleSettings()}
          />
        </div>

        {/* Resize handle */}
        {!sidebarCollapsed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors z-50"
            onMouseDown={(e) => {
              e.preventDefault();
              resizeRef.current = { startX: e.clientX, startW: sidebarWidth };
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
          />
        )}
      </motion.div>

      <ConnectionForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />
    </>
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
