import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Plus,
  X,
  HardDrives,
  Tag,
  Lightning,
  LinuxLogo,
  Triangle,
  Atom,
  Database,
  Cube,
  UserCircle,
  Lock,
  Key,
  PencilSimple,
  CaretDown,
  CaretRight,
  Trash,
  FloppyDisk,
  SquaresFour,
  FolderDashed,
} from "@phosphor-icons/react";
import { actions, useStore } from "@/lib/store";
import { TerminalView } from "@/features/terminal/TerminalView";
import type { AuthType, Connection, ConnectionRuntimeStatus, HostGroup } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IconPicker, type IconValue } from "@/features/connections/IconPicker";
import { BRAND_ICON_MAP } from "@/features/connections/brandIcons";
import { AuthMethodToggle } from "@/features/connections/AuthMethodToggle";
import { Tooltip } from "@/components/Tooltip";
import { HostIcon } from "@/components/HostIcon";
import { hostAllowsAiFeatures } from "@/lib/ai";
import { AnimatePresence, motion } from "framer-motion";

function PopoverButtonKbd({
  children,
  variant = "muted",
}: {
  children: ReactNode;
  variant?: "muted" | "onAccent" | "onInverse";
}) {
  return (
    <kbd
      className={`px-1.5 h-[18px] inline-flex items-center justify-center rounded-[5px] text-[10px] font-mono leading-none ${
        variant === "onAccent"
          ? "border border-white/30 bg-white/15 text-accent-fg"
          : variant === "onInverse"
            ? "border border-bg/35 bg-bg/12 text-bg"
            : "border border-border bg-[var(--command-bg)] text-fg-muted"
      }`}
    >
      {children}
    </kbd>
  );
}

export function MainArea() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const connections = useStore((s) => s.connections);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="flex-1 bg-bg" />;
  }

  const activeTab = activeTabId ? tabs.find((t) => t.id === activeTabId) ?? null : null;
  const activeConn = activeTab ? connections.find((c) => c.id === activeTab.connectionId) ?? null : null;
  const showTerminalSurface = Boolean(activeTabId && activeTab && activeConn);

  return (
    <div className="flex-1 min-h-0 relative bg-bg overflow-hidden">
      {tabs.length > 0 ? (
        <div
          className="absolute inset-0"
          aria-hidden={!showTerminalSurface}
          style={{
            visibility: showTerminalSurface ? "visible" : "hidden",
            pointerEvents: showTerminalSurface ? "auto" : "none",
          }}
        >
          {tabs.map((t) => {
            const c = connections.find((x) => x.id === t.connectionId);
            if (!c) return null;
            const visible = showTerminalSurface && t.id === activeTabId;
            return (
              <div
                key={t.id}
                className="absolute inset-0"
                style={{ visibility: visible ? "visible" : "hidden" }}
              >
                <TerminalView tab={t} conn={c} />
              </div>
            );
          })}
        </div>
      ) : null}

      {!showTerminalSurface ? (
        <div className="absolute inset-0 z-10 min-h-0 flex flex-col">
          <HostsView connections={connections} />
        </div>
      ) : null}
    </div>
  );
}

function AddGroupPopover({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const reset = () => {
    setName("");
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    actions.addGroup({ name: n });
    setOpen(false);
    reset();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        const n = name.trim();
        if (!n) return;
        e.preventDefault();
        actions.addGroup({ name: n });
        setOpen(false);
        reset();
      } else if (k === "c") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, name]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) onBeforeOpen();
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2.5 h-7 rounded-[8px] text-[11.5px] font-sans font-medium text-accent border border-accent/40 bg-accent/10 hover:bg-accent/15 hover:border-accent/60 transition-colors shrink-0"
        >
          <Plus size={11} weight="bold" aria-hidden />
          Add groups
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[min(18rem,calc(100vw-1.5rem))] rounded-[10px] border border-[var(--border-strong)] p-3 shadow-xl bg-[var(--popover-bg)] text-fg"
      >
        <div className="text-[13px] font-sans font-semibold text-fg mb-3">New group</div>
        <div>
          <div className="text-[12px] font-sans font-medium text-fg mb-1.5">Name</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. Staging"
            className="w-full h-9 px-3 rounded-[8px] bg-[var(--input-bg)] border border-border text-[12.5px] font-sans text-fg placeholder:text-fg-muted box-border focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <div className="flex justify-start gap-2 mt-5">
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="h-8 px-3 rounded-[8px] text-[12px] font-sans font-semibold text-accent-fg bg-accent hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none transition-opacity inline-flex items-center gap-1.5"
          >
            Create
            <PopoverButtonKbd variant="onAccent">S</PopoverButtonKbd>
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 px-3 rounded-[8px] text-[12px] font-sans font-medium text-fg-muted border border-border hover:bg-[var(--neutral-hover-bg)] hover:text-fg transition-colors inline-flex items-center gap-1.5"
          >
            Cancel
            <PopoverButtonKbd>C</PopoverButtonKbd>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditGroupPopover({
  group,
  hostCount,
  onBeforeOpen,
  onRemoved,
}: {
  group: HostGroup;
  hostCount: number;
  onBeforeOpen: () => void;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [deleteSectionOpen, setDeleteSectionOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<null | "ungroup" | "delete-all">(null);

  const resetLocal = () => {
    setName(group.name);
    setDeleteSectionOpen(false);
    setPendingDelete(null);
  };

  const dirty = name.trim() !== group.name;
  const canSave = dirty && name.trim().length > 0;

  const save = () => {
    const n = name.trim();
    if (!n) return;
    actions.updateGroup(group.id, n);
  };

  const handleDeleteDone = () => {
    setOpen(false);
    resetLocal();
    onRemoved();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        if (!canSave) return;
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        actions.updateGroup(group.id, n);
      } else if (k === "c") {
        e.preventDefault();
        if (pendingDelete) {
          setPendingDelete(null);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canSave, name, group.id, pendingDelete]);

  const popoverSurfaceClassName =
    "w-[min(18rem,calc(100vw-1.5rem))] rounded-[10px] border border-[var(--border-strong)] p-3 shadow-xl bg-[var(--popover-bg)] text-fg max-h-[min(32rem,calc(100vh-4rem))] overflow-y-auto";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onBeforeOpen();
          setName(group.name);
          setDeleteSectionOpen(false);
          setPendingDelete(null);
        }
        setOpen(next);
        if (!next) resetLocal();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/edit mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-success/20 bg-success/10 text-fg-muted transition-[width,background-color,border-color,padding,gap,justify-content,color] duration-200 ease-out hover:w-[3.125rem] hover:justify-start hover:gap-0.5 hover:border-success/40 hover:bg-success/20 hover:px-1.5 hover:text-success"
          aria-label="Edit group"
        >
          <PencilSimple size={11} weight="regular" className="shrink-0" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-sans font-medium opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover/edit:max-w-[2rem] group-hover/edit:opacity-100">
            Edit
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className={popoverSurfaceClassName}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[13px] font-sans font-semibold text-fg mb-3">Edit group</div>
        <div>
          <div className="text-[12px] font-sans font-medium text-fg mb-1.5">Name</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            placeholder="Group name"
            className="w-full h-9 px-3 rounded-[8px] bg-[var(--input-bg)] border border-border text-[12.5px] font-sans text-fg placeholder:text-fg-muted box-border focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>

        <Collapsible
          open={deleteSectionOpen}
          onOpenChange={(o) => {
            setDeleteSectionOpen(o);
            if (!o) setPendingDelete(null);
          }}
          className="mt-2"
        >
          <CollapsibleTrigger
            className="flex w-full items-center justify-between gap-2 rounded-[8px] border py-2 px-2.5 text-left transition-colors hover:opacity-95 [&[data-state=open]_svg]:rotate-90"
            style={{
              borderColor: "color-mix(in oklab, var(--danger) 45%, transparent)",
              background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            }}
          >
            <span className="text-[10.5px] uppercase tracking-wider font-sans font-semibold text-danger">
              Delete options
            </span>
            <CaretRight
              size={12}
              weight="bold"
              className="text-danger/80 shrink-0 transition-transform duration-200"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div
              className="mt-2 rounded-[10px] border p-3"
              style={{
                borderColor: "color-mix(in oklab, var(--danger) 45%, transparent)",
                background: "color-mix(in oklab, var(--danger) 8%, transparent)",
              }}
            >
              <div className="text-[10.5px] uppercase tracking-wider font-sans font-semibold text-danger mb-1.5">
                Danger zone
              </div>

              {pendingDelete === "ungroup" ? (
                <div className="flex flex-col gap-2 mb-2">
                  <p className="text-[11.5px] font-sans text-fg-muted leading-snug">
                    {hostCount === 0
                      ? "This group is empty. It will be removed."
                      : `${hostCount} ${hostCount === 1 ? "host" : "hosts"} will stay in your library with no group assigned.`}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="h-8 px-3 rounded-[8px] border border-border text-[12px] font-sans text-fg-muted hover:text-fg hover:bg-[var(--neutral-hover-bg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        actions.removeGroupOnly(group.id);
                        handleDeleteDone();
                      }}
                      className="flex-1 h-8 rounded-[8px] border border-danger/60 text-danger text-[12px] font-sans font-semibold hover:bg-danger/10 transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      <Trash size={12} weight="bold" /> Remove group
                    </button>
                  </div>
                </div>
              ) : pendingDelete === "delete-all" ? (
                <div className="flex flex-col gap-2 mb-2">
                  <p className="text-[11.5px] font-sans text-fg-muted leading-snug">
                    This permanently deletes{" "}
                    <span className="font-medium text-fg">
                      {hostCount} {hostCount === 1 ? "host" : "hosts"}
                    </span>{" "}
                    and removes the group. This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="h-8 px-3 rounded-[8px] border border-border text-[12px] font-sans text-fg-muted hover:text-fg hover:bg-[var(--neutral-hover-bg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        actions.removeGroupAndDeleteHosts(group.id);
                        handleDeleteDone();
                      }}
                      className="flex-1 h-8 rounded-[8px] bg-danger text-white text-[12px] font-sans font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5"
                    >
                      <Trash size={12} weight="fill" /> Confirm delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDelete("ungroup")}
                    className="w-full h-8 rounded-[8px] border border-danger/50 text-danger text-[12px] font-sans font-medium hover:bg-danger/10 transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Trash size={12} weight="bold" /> Remove group
                  </button>
                  {hostCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPendingDelete("delete-all")}
                      className="w-full h-8 rounded-[8px] bg-danger text-white text-[12px] font-sans font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5"
                    >
                      <Trash size={12} weight="fill" /> Remove group &amp; delete hosts
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex justify-start gap-2 mt-5">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="h-8 px-3 rounded-[8px] text-[12px] font-sans font-semibold text-accent-fg bg-accent hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none transition-opacity inline-flex items-center gap-1.5"
          >
            Save
            <PopoverButtonKbd variant="onAccent">S</PopoverButtonKbd>
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 px-3 rounded-[8px] text-[12px] font-sans font-medium text-fg-muted border border-border hover:bg-[var(--neutral-hover-bg)] hover:text-fg transition-colors inline-flex items-center gap-1.5"
          >
            Cancel
            <PopoverButtonKbd>C</PopoverButtonKbd>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HostsView({ connections }: { connections: Connection[] }) {
  const groups = useStore((s) => s.groups);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const groupCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of connections) {
      if (c.groupId) m[c.groupId] = (m[c.groupId] ?? 0) + 1;
    }
    return m;
  }, [connections]);

  const selectedId = useStore((s) => s.selectedHostId);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  const uncategorizedCount = useMemo(
    () => connections.filter((c) => !c.groupId).length,
    [connections],
  );

  const filteredHosts =
    groupFilter === null
      ? connections
      : groupFilter === "__uncategorized__"
        ? connections.filter((c) => !c.groupId)
        : connections.filter((c) => c.groupId === groupFilter);

  const selected = connections.find((c) => c.id === selectedId) ?? null;
  const sidePanelOpen = settingsOpen || selected !== null;

  const dismissSidebars = () => {
    actions.setSettingsOpen(false);
    actions.setSelectedHostId(null);
  };

  return (
    <div className="flex-1 min-w-0 relative bg-bg overflow-hidden">
      <div
        className={`h-full overflow-y-auto px-6 py-6 ${
          settingsOpen ? "pr-[calc(340px+2.5rem)]" : selected ? "pr-[calc(320px+2.5rem)]" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <h2 className="text-[15px] font-sans font-semibold text-fg flex items-center gap-1">
            <SquaresFour size={16} weight="duotone" className="text-accent/80" />
            Groups
          </h2>
          <AddGroupPopover onBeforeOpen={dismissSidebars} />
        </div>
        <div className={`grid gap-2.5 mb-4 ${sidePanelOpen ? "grid-cols-3" : "grid-cols-4"}`}>
          <div className="relative flex items-stretch gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setGroupFilter(null);
                dismissSidebars();
              }}
              className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2.5 rounded-[10px] border transition-colors text-left ${
                groupFilter === null
                  ? "bg-[var(--command-active-bg)] border-accent/50 ring-1 ring-accent/30"
                  : "bg-[var(--bg-panel)] border-border hover:border-[var(--border-strong)]"
              }`}
            >
              <AllGroupIcon />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-sans font-semibold text-fg truncate">All</div>
                <div className="text-[11.5px] font-sans text-fg-muted truncate">
                  {connections.length} {connections.length === 1 ? "Host" : "Hosts"}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setGroupFilter((current) =>
                  current === "__uncategorized__" ? null : "__uncategorized__",
                );
                dismissSidebars();
              }}
              className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2.5 rounded-[10px] border transition-colors text-left ${
                groupFilter === "__uncategorized__"
                  ? "bg-[var(--command-active-bg)] border-accent/50 ring-1 ring-accent/30"
                  : "bg-[var(--bg-panel)] border-border hover:border-[var(--border-strong)]"
              }`}
            >
              <UncategorizedGroupIcon />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-sans font-semibold text-fg truncate">
                  Uncategorized
                </div>
                <div className="text-[11.5px] font-sans text-fg-muted truncate">
                  {uncategorizedCount} {uncategorizedCount === 1 ? "Host" : "Hosts"}
                </div>
              </div>
            </button>

            {groups.length > 0 ? (
              <span
                className="pointer-events-none absolute top-2 bottom-2 -right-[6px] w-px rounded-full bg-[var(--border-strong)] opacity-40"
                aria-hidden
              />
            ) : null}
          </div>

          {groups.map((g) => {
            const count = groupCounts[g.id] ?? 0;
            const active = groupFilter === g.id;
            return (
              <div
                key={g.id}
                className={`flex items-center gap-1.5 min-w-0 rounded-[10px] border transition-colors ${
                  active
                    ? "bg-[var(--command-active-bg)] border-accent/50 ring-1 ring-accent/30"
                    : "bg-[var(--bg-panel)] border-border hover:border-[var(--border-strong)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setGroupFilter((current) => (current === g.id ? null : g.id));
                    dismissSidebars();
                  }}
                  className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left"
                >
                  <GroupIcon />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-sans font-semibold text-fg truncate">
                      {g.name}
                    </div>
                    <div className="text-[11.5px] font-sans text-fg-muted">
                      {count} {count === 1 ? "Host" : "Hosts"}
                    </div>
                  </div>
                </button>
                <EditGroupPopover
                  group={g}
                  hostCount={count}
                  onBeforeOpen={dismissSidebars}
                  onRemoved={() => {
                    if (groupFilter === g.id) setGroupFilter(null);
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border-strong/30 to-transparent my-0" />

        <div className="flex items-center justify-between mb-2 gap-2 mt-3">
          <h2 className="text-[15px] font-sans font-semibold text-fg truncate min-w-0 flex items-center gap-1">
            <HardDrives size={16} weight="duotone" className="text-accent/80" />
            Hosts
          </h2>
          <div className="flex items-center gap-3 shrink-0">
            {groupFilter ? (
              <button
                onClick={() => {
                  setGroupFilter(null);
                  dismissSidebars();
                }}
                className="text-[11px] font-sans text-fg-muted hover:text-fg flex items-center gap-1"
              >
                <X size={11} weight="bold" /> Clear filter
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                dismissSidebars();
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("tm:new-connection"));
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded-[8px] text-[11.5px] font-sans font-medium text-accent border border-accent/40 bg-accent/10 hover:bg-accent/15 hover:border-accent/60 transition-colors"
            >
              <Plus size={11} weight="bold" aria-hidden />
              Add hosts
            </button>
          </div>
        </div>

        {filteredHosts.length === 0 ? (
          <EmptyHosts />
        ) : (
          <div className={`grid gap-2.5 ${sidePanelOpen ? "grid-cols-3" : "grid-cols-4"}`}>
            {filteredHosts.map((c) => (
              <HostCard
                key={c.id}
                conn={c}
                active={selectedId === c.id}
                status={connectionStatus[c.id]}
                onShowDetails={() => {
                  actions.setSelectedHostId(c.id);
                }}
                onConnect={() => {
                  dismissSidebars();
                  actions.openTab(c.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {!settingsOpen && selected ? (
          <motion.aside
            key="host-details"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute z-20 top-4 right-4 bottom-4 w-[320px] max-w-[min(320px,calc(100%-2rem))] flex flex-col rounded-[14px] border border-[var(--border-strong)] shadow-2xl overflow-hidden"
            style={{ background: "var(--sidebar-bg)" }}
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
              <HostDetails conn={selected} onClose={() => actions.setSelectedHostId(null)} />
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function GroupIcon() {
  return (
    <div className="w-9 h-9 shrink-0 rounded-[10px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] grid place-items-center text-white shadow-inner">
      <HardDrives size={16} weight="fill" />
    </div>
  );
}

function UncategorizedGroupIcon() {
  return (
    <div className="w-9 h-9 shrink-0 rounded-[10px] bg-[var(--input-bg)] border border-dashed border-[var(--border-strong)] grid place-items-center text-fg-muted">
      <FolderDashed size={16} weight="regular" className="text-fg-muted" />
    </div>
  );
}

function AllGroupIcon() {
  return (
    <div className="w-9 h-9 shrink-0 rounded-[10px] bg-[var(--input-bg)] border border-[var(--border-strong)] grid place-items-center text-fg-muted shadow-inner">
      <SquaresFour size={16} weight="fill" className="text-fg" />
    </div>
  );
}

function HostCard({
  conn,
  active,
  status,
  onShowDetails,
  onConnect,
}: {
  conn: Connection;
  active: boolean;
  status?: ConnectionRuntimeStatus;
  onShowDetails: () => void;
  onConnect: () => void;
}) {
  const isConnecting = status?.state === "connecting";

  return (
    <div
      className={`flex items-center gap-3 px-3 py-3 rounded-[10px] border transition-colors ${
        active
          ? "border-[var(--border-strong)] bg-[var(--neutral-hover-bg)]"
          : "bg-[var(--bg-panel)] border-border hover:border-[var(--border-strong)]"
      }`}
    >
      <HostIcon conn={conn} size={36} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-sans font-semibold text-fg truncate">{conn.name}</div>
        <div className="text-[11px] font-sans text-fg-muted truncate">
          {conn.tags?.join(", ") ?? `${conn.username}@${conn.host}`}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onShowDetails}
          aria-label="Edit host"
          className="group/edit inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-success/20 bg-success/10 text-fg-muted transition-[width,background-color,border-color,padding,gap,justify-content,color] duration-200 ease-out hover:w-[3.125rem] hover:justify-start hover:gap-0.5 hover:border-success/40 hover:bg-success/20 hover:px-1.5 hover:text-success"
        >
          <PencilSimple size={11} weight="regular" className="shrink-0" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-sans font-medium opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover/edit:max-w-[2rem] group-hover/edit:opacity-100">
            Edit
          </span>
        </button>
        <button
          type="button"
          onClick={onConnect}
          disabled={isConnecting}
          aria-label="Connect"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[6px] border border-border bg-[var(--command-bg)] text-fg hover:bg-[var(--command-active-bg)] hover:border-[var(--border-strong)] disabled:opacity-55 disabled:pointer-events-none transition-colors text-[11px] font-sans font-medium"
        >
          <Lightning size={11} weight="fill" />
          {isConnecting ? "Connecting" : "Connect"}
        </button>
      </div>
    </div>
  );
}

function EmptyHosts() {
  return (
    <div className="flex justify-center py-8 px-1">
      <button
        onClick={() => {
          actions.setSettingsOpen(false);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("tm:new-connection"));
          }
        }}
        className="group relative flex items-center gap-4 px-5 py-4 rounded-[12px] border border-dashed border-[var(--border-strong)] max-w-[480px] w-full overflow-hidden transition-all duration-300 hover:border-accent hover:border-solid hover:bg-[var(--bg-panel)]/40 active:scale-[0.995]"
        style={{
          background: `linear-gradient(155deg, 
            color-mix(in oklab, var(--bg-panel) 94%, var(--accent)), 
            var(--bg-panel) 80%, 
            color-mix(in oklab, var(--bg-panel) 96%, var(--accent)) 100%)`,
        }}
      >
        <div className="w-10 h-10 shrink-0 rounded-[9px] flex items-center justify-center bg-accent/8 text-accent border border-accent/20 transition-transform duration-300 group-hover:scale-105 shadow-sm">
          <HardDrives size={20} weight="duotone" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-start text-left">
          <h3 className="text-[14px] font-sans font-bold text-fg tracking-tight">
            Connect your first SSH host
          </h3>
          <p className="text-[11.5px] font-sans text-fg-muted/80 leading-tight mt-0.5">
            Save your remote servers for one-click access.
          </p>
        </div>

        <div className="shrink-0 ml-2">
          <span className="inline-flex items-center gap-1 px-4 h-8 ml-3 rounded-[8px] text-[11.5px] font-sans font-medium text-accent border border-accent/40 bg-accent/10 transition-colors group-hover:bg-accent/15 group-hover:border-accent/60">
            <Plus size={11} weight="bold" aria-hidden />
            Add host
          </span>
        </div>
      </button>
    </div>
  );
}

function HostDetails({ conn, onClose }: { conn: Connection; onClose: () => void }) {
  const [host, setHost] = useState(conn.host);
  const [port, setPort] = useState(String(conn.port));
  const [name, setName] = useState(conn.name);
  const [username, setUsername] = useState(conn.username);
  const [authType, setAuthType] = useState<AuthType>(conn.authType);
  const [password, setPassword] = useState(conn.password ?? "");
  const [privateKey, setPrivateKey] = useState(conn.privateKey ?? "");
  const [passphrase, setPassphrase] = useState(conn.passphrase ?? "");
  const [tagDraft, setTagDraft] = useState("");
  const status = useStore((s) => s.connectionStatus[conn.id]);

  useEffect(() => {
    setHost(conn.host);
    setPort(String(conn.port));
    setName(conn.name);
    setUsername(conn.username);
    setAuthType(conn.authType);
    setPassword(conn.password ?? "");
    setPrivateKey(conn.privateKey ?? "");
    setPassphrase(conn.passphrase ?? "");
    setTagDraft("");
  }, [
    conn.id,
    conn.host,
    conn.port,
    conn.name,
    conn.username,
    conn.authType,
    conn.password,
    conn.privateKey,
    conn.passphrase,
  ]);

  const persist = (patch: Partial<Connection>) => {
    actions.upsertConnection({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.authType,
      password: conn.password,
      privateKey: conn.privateKey,
      passphrase: conn.passphrase,
      tags: conn.tags,
      groupId: conn.groupId,
      iconColor: conn.iconColor,
      iconKind: conn.iconKind,
      iconBrand: conn.iconBrand,
      aiFeaturesEnabled: conn.aiFeaturesEnabled,
      ...patch,
    });
  };

  const iconValue: IconValue = conn.iconBrand
    ? { kind: "brand", id: conn.iconBrand }
    : { kind: "system", id: conn.iconKind ?? "generic", color: conn.iconColor };

  const handleIconChange = (v: IconValue) => {
    if (v.kind === "brand") {
      persist({ iconBrand: v.id });
    } else {
      persist({
        iconBrand: undefined,
        iconKind: v.id,
        iconColor: v.color ?? conn.iconColor,
      });
    }
  };

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[15px] font-sans font-semibold text-fg">Host Details</div>
        <Tooltip label="Close" side="left">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close host details"
            className="w-7 h-7 -mt-1 -mr-1 grid place-items-center rounded-[7px] text-fg-muted hover:text-fg hover:bg-[var(--neutral-hover-bg)] transition-colors"
          >
            <X size={13} weight="bold" />
          </button>
        </Tooltip>
      </div>

      <div>
        <FieldLabel>Address</FieldLabel>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 pl-1.5 pr-2 h-10 rounded-[10px] bg-[var(--input-bg)] border border-border focus-within:border-[var(--border-strong)]">
            <IconPicker value={iconValue} onChange={handleIconChange}>
              {(open) => (
                <button
                  type="button"
                  onClick={open}
                  aria-label="Change icon"
                  className="relative group shrink-0 rounded-full"
                >
                  <HostIcon conn={conn} size={28} />
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <PencilSimple size={11} weight="bold" />
                  </span>
                </button>
              )}
            </IconPicker>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] font-mono text-fg placeholder:text-fg-muted focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 px-2 h-9 rounded-[8px] bg-[var(--input-bg)] border border-border focus-within:border-[var(--border-strong)]">
            <span className="text-[10.5px] uppercase tracking-wider font-sans font-semibold text-fg-dim shrink-0 pl-1">
              Port
            </span>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
              placeholder="22"
              inputMode="numeric"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] font-mono text-fg placeholder:text-fg-muted focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <FieldLabel>General</FieldLabel>

        <div>
          <SubLabel>Name</SubLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My machine"
            className="w-full h-9 px-3 rounded-[8px] bg-[var(--input-bg)] border border-border focus:border-[var(--border-strong)] text-[12.5px] font-sans text-fg placeholder:text-fg-muted focus:outline-none"
          />
        </div>

        <div>
          <SubLabel>Group</SubLabel>
          <GroupSelect
            value={conn.groupId ?? ""}
            onChange={(g) => persist({ groupId: g || undefined })}
          />
        </div>

        <div>
          <SubLabel>Tags</SubLabel>
          <div className="flex items-start gap-2 px-2 py-1.5 rounded-[8px] bg-[var(--input-bg)] border border-border focus-within:border-[var(--border-strong)] min-h-9">
            <Tag size={12} weight="bold" className="text-fg-muted shrink-0 mt-1" />
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
              {(conn.tags ?? []).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 h-[22px] rounded-full bg-[var(--command-bg)] border border-border text-[11px] font-sans text-fg"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => {
                      const next = (conn.tags ?? []).filter((x) => x !== t);
                      persist({ tags: next.length ? next : undefined });
                    }}
                    aria-label={`Remove tag ${t}`}
                    className="text-fg-muted hover:text-fg"
                  >
                    <X size={9} weight="bold" />
                  </button>
                </span>
              ))}
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const v = tagDraft.trim().replace(/,$/, "");
                    if (!v) return;
                    const existing = conn.tags ?? [];
                    if (existing.includes(v)) {
                      setTagDraft("");
                      return;
                    }
                    persist({ tags: [...existing, v] });
                    setTagDraft("");
                  } else if (
                    e.key === "Backspace" &&
                    tagDraft === "" &&
                    (conn.tags?.length ?? 0) > 0
                  ) {
                    const next = (conn.tags ?? []).slice(0, -1);
                    persist({ tags: next.length ? next : undefined });
                  }
                }}
                placeholder={(conn.tags?.length ?? 0) === 0 ? "Add tag…" : ""}
                className="flex-1 min-w-[60px] h-[22px] bg-transparent text-[11.5px] font-sans text-fg placeholder:text-fg-muted focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <SubLabel>AI</SubLabel>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              const on = hostAllowsAiFeatures(conn);
              persist({ aiFeaturesEnabled: !on });
            }}
            className="w-full flex items-start justify-between gap-3 px-2 py-2.5 rounded-[8px] text-left hover:bg-[var(--menu-hover-bg)] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-sans font-medium text-fg">
                AI features for this host
              </div>
              <p className="text-[11px] font-sans text-fg-muted leading-snug mt-0.5">
                When off, autocomplete and the assistant won’t run for sessions on this machine.
              </p>
            </div>
            <span
              aria-hidden
              className={`shrink-0 mt-0.5 w-[28px] h-[16px] rounded-full transition-colors relative ${
                hostAllowsAiFeatures(conn) ? "bg-accent" : "bg-[var(--border-strong)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-transform ${
                  hostAllowsAiFeatures(conn) ? "translate-x-[12px]" : "translate-x-0"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-border/70">
        <FieldLabel>Credentials</FieldLabel>

        <div>
          <SubLabel>Username</SubLabel>
          <EditableInputRow
            icon={<UserCircle size={13} />}
            value={username}
            onChange={setUsername}
            placeholder="root"
          />
        </div>

        <div>
          <SubLabel>Auth method</SubLabel>
          <AuthMethodToggle value={authType} onChange={setAuthType} />
        </div>

        <div className="space-y-3 transition-all duration-200">
          {authType === "password" ? (
          <div>
            <SubLabel>Password</SubLabel>
            <EditableInputRow
              icon={<Lock size={13} />}
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
            />
          </div>
        ) : (
          <>
            <div>
              <SubLabel hint="PEM / OpenSSH">Private key</SubLabel>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n"}
                spellCheck={false}
                wrap="off"
                className="w-full min-h-[80px] max-h-[100px] resize-y overflow-auto px-3 py-2.5 rounded-[8px] bg-[var(--input-bg)] border border-border focus:border-[var(--border-strong)] text-[12px] leading-relaxed font-mono text-fg placeholder:text-fg-muted focus:outline-none whitespace-pre"
              />
            </div>
            <div>
              <SubLabel hint="optional">Passphrase</SubLabel>
              <EditableInputRow
                icon={<Key size={13} />}
                value={passphrase}
                onChange={setPassphrase}
                placeholder="Passphrase"
                type="password"
              />
            </div>
          </>
          )}
        </div>
      </div>

      <ActionsAndDanger
        conn={conn}
        host={host}
        port={port}
        name={name}
        username={username}
        authType={authType}
        password={password}
        privateKey={privateKey}
        passphrase={passphrase}
        isConnecting={status?.state === "connecting"}
        statusMessage={status?.message}
        statusState={status?.state}
        onSave={() => {
          const portN = Number(port);
          persist({
            host: host.trim() || conn.host,
            port: portN > 0 ? portN : conn.port,
            name: name.trim() || conn.name,
            username: username.trim() || conn.username,
            authType,
            password: authType === "password" ? password : undefined,
            privateKey: authType === "privateKey" ? privateKey : undefined,
            passphrase: authType === "privateKey" ? passphrase : undefined,
          });
        }}
        onCancel={() => {
          setHost(conn.host);
          setPort(String(conn.port));
          setName(conn.name);
          setUsername(conn.username);
          setAuthType(conn.authType);
          setPassword(conn.password ?? "");
          setPrivateKey(conn.privateKey ?? "");
          setPassphrase(conn.passphrase ?? "");
        }}
      />
    </div>
  );
}

function ActionsAndDanger({
  conn,
  host,
  port,
  name,
  username,
  authType,
  password,
  privateKey,
  passphrase,
  isConnecting,
  statusMessage,
  statusState,
  onSave,
  onCancel,
}: {
  conn: Connection;
  host: string;
  port: string;
  name: string;
  username: string;
  authType: AuthType;
  password: string;
  privateKey: string;
  passphrase: string;
  isConnecting: boolean;
  statusMessage?: string;
  statusState?: ConnectionRuntimeStatus["state"];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const onSaveRef = useRef(onSave);
  const onCancelRef = useRef(onCancel);
  onSaveRef.current = onSave;
  onCancelRef.current = onCancel;

  const dirty =
    host.trim() !== conn.host ||
    Number(port) !== conn.port ||
    name.trim() !== conn.name ||
    username.trim() !== conn.username ||
    authType !== conn.authType ||
    (authType === "password" && password !== (conn.password ?? "")) ||
    (authType === "privateKey" &&
      (privateKey !== (conn.privateKey ?? "") || passphrase !== (conn.passphrase ?? "")));

  const canSave =
    dirty &&
    host.trim().length > 0 &&
    Number(port) > 0 &&
    name.trim().length > 0 &&
    username.trim().length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        if (!canSave) return;
        e.preventDefault();
        onSaveRef.current();
      } else if (k === "c") {
        if (confirmDelete) {
          e.preventDefault();
          setConfirmDelete(false);
        } else if (dirty) {
          e.preventDefault();
          onCancelRef.current();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSave, dirty, confirmDelete]);

  return (
    <div className="flex flex-col gap-3">
      {dirty ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="flex-1 h-9 rounded-[10px] bg-fg text-bg text-[12.5px] font-sans font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity inline-flex items-center justify-center gap-2"
          >
            <FloppyDisk size={13} weight="fill" /> Save
            <PopoverButtonKbd variant="onInverse">S</PopoverButtonKbd>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3 rounded-[10px] border border-border text-[12.5px] font-sans text-fg-muted hover:text-fg hover:bg-[var(--neutral-hover-bg)] transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            Cancel
            <PopoverButtonKbd>C</PopoverButtonKbd>
          </button>
        </div>
      ) : null}

      <button
        onClick={() => {
          actions.setSettingsOpen(false);
          actions.openTab(conn.id);
        }}
        disabled={isConnecting}
        className="h-10 rounded-[10px] bg-accent text-accent-fg text-[13px] font-sans font-semibold hover:opacity-90 disabled:opacity-55 disabled:pointer-events-none transition-opacity inline-flex items-center justify-center gap-2"
      >
        <Lightning size={13} weight="fill" /> {isConnecting ? "Connecting" : "Connect"}
      </button>

      {statusMessage ? (
        <div
          className={`text-[11px] font-sans leading-snug ${
            statusState === "error" ? "text-danger" : "text-fg-muted"
          }`}
        >
          {statusMessage}
        </div>
      ) : null}

      <div
        className="mt-2 rounded-[10px] border p-3"
        style={{
          borderColor: "color-mix(in oklab, var(--danger) 45%, transparent)",
          background: "color-mix(in oklab, var(--danger) 8%, transparent)",
        }}
      >
        <div className="text-[10.5px] uppercase tracking-wider font-sans font-semibold text-danger mb-1.5">
          Danger zone
        </div>
        <div className="text-[11.5px] font-sans text-fg-muted mb-2.5 leading-snug">
          Removing this host will close any open sessions and delete its credentials.
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="h-8 px-3 rounded-[8px] border border-border text-[12px] font-sans text-fg-muted hover:text-fg hover:bg-[var(--neutral-hover-bg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(false);
                actions.deleteConnection(conn.id);
              }}
              className="flex-1 h-8 rounded-[8px] bg-danger text-white text-[12px] font-sans font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5"
            >
              <Trash size={12} weight="fill" /> Confirm remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full h-8 rounded-[8px] border border-danger/50 text-danger text-[12px] font-sans font-medium hover:bg-danger/10 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Trash size={12} weight="bold" /> Remove host
          </button>
        )}
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-[12px] font-sans font-medium text-fg mb-0 ${className}`}>{children}</div>
  );
}

function SubLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1">
      <span className="text-[10.5px] uppercase tracking-wider font-sans font-semibold text-fg-dim">
        {children}
      </span>
      {hint ? <span className="text-[10.5px] font-mono text-fg-dim">{hint}</span> : null}
    </div>
  );
}

function EditableInputRow({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  icon: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "password";
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 h-9 rounded-[8px] bg-[var(--input-bg)] border border-border focus-within:border-[var(--border-strong)]">
      <span className="text-fg-muted shrink-0">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] font-sans text-fg placeholder:text-fg-muted focus:outline-none"
      />
    </div>
  );
}

function GroupSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groups = useStore((s) => s.groups);
  const current = groups.find((g) => g.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 flex items-center justify-between gap-2 rounded-[8px] bg-[var(--input-bg)] border border-border hover:border-[var(--border-strong)] text-[12.5px] font-sans text-fg"
      >
        <span className={current ? "text-fg" : "text-fg-muted"}>
          {current ? current.name : "No group"}
        </span>
        <CaretDown size={11} weight="bold" className="text-fg-muted" />
      </button>
      {open ? (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-30 rounded-[10px] border shadow-xl overflow-hidden p-1"
          style={{
            background: "var(--popover-bg)",
            borderColor: "var(--border-strong)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full text-left px-2.5 h-8 rounded-[7px] text-[12.5px] font-sans hover:bg-[var(--neutral-hover-bg)] ${
              !current ? "text-fg" : "text-fg-muted"
            }`}
          >
            No group
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onChange(g.id);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 h-8 rounded-[7px] text-[12.5px] font-sans hover:bg-[var(--neutral-hover-bg)] ${
                g.id === value
                  ? "text-fg bg-[var(--neutral-hover-bg)] font-medium"
                  : "text-fg-muted"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
