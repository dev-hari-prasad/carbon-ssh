import { useState } from "react";
import { Plus, MagnifyingGlass, Terminal } from "@phosphor-icons/react";
import { actions, useStore } from "@/lib/store";
import type { Connection } from "@/lib/types";
import { Button } from "@/components/Button";
import { ConnectionItem } from "@/features/connections/ConnectionItem";
import { ConnectionForm } from "@/features/connections/ConnectionForm";

export function Sidebar() {
  const connections = useStore((s) => s.connections);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);

  const filtered = connections.filter((c) => {
    const q = query.toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.host.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="h-full w-[260px] flex-shrink-0 border-r border-border bg-bg-panel flex flex-col">
      <div className="h-10 px-3 flex items-center gap-2 border-b border-border">
        <div className="w-6 h-6 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center">
          <Terminal size={14} weight="bold" className="text-accent" />
        </div>
        <div className="font-sans font-bold text-[13px] tracking-tight text-fg">
          relay
          <span className="text-fg-dim font-normal">/ssh</span>
        </div>
      </div>

      <div className="px-2.5 pt-3 pb-2 flex items-center gap-1.5">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full h-7 pl-7 pr-2 bg-bg border border-border rounded-md text-[12px] font-mono text-fg placeholder:text-fg-dim focus:outline-none focus:border-accent"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          aria-label="New connection"
        >
          <Plus size={13} weight="bold" />
        </Button>
      </div>

      <div className="px-3.5 pb-1.5 pt-2 flex items-center justify-between">
        <div className="text-xxs uppercase font-sans font-semibold text-fg-dim tracking-wider">
          Connections
        </div>
        <div className="text-xxs font-mono text-fg-dim">{connections.length}</div>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-[12px] text-fg-muted font-sans">
              {connections.length === 0
                ? "No saved connections yet."
                : "No matches."}
            </div>
            {connections.length === 0 ? (
              <button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="mt-3 text-[12px] font-mono text-accent hover:underline"
              >
                + Add your first
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((c) => (
              <ConnectionItem
                key={c.id}
                conn={c}
                onEdit={(conn) => {
                  setEditing(conn);
                  setFormOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border px-3 py-2 flex items-center justify-between">
        <span className="text-xxs font-mono text-fg-dim">local · v0.1</span>
        <span className="flex items-center gap-1.5 text-xxs font-mono text-fg-dim">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          ready
        </span>
      </div>

      <ConnectionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
      />
    </aside>
  );
}
