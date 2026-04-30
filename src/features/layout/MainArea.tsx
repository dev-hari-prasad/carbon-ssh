import { Plug, Plus } from "@phosphor-icons/react";
import { useStore } from "@/lib/store";
import { TerminalView } from "@/features/terminal/TerminalView";

export function MainArea() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const connections = useStore((s) => s.connections);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const conn = activeTab
    ? connections.find((c) => c.id === activeTab.connectionId)
    : null;

  if (!activeTab || !conn) {
    return (
      <div className="flex-1 grid-bg flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <div className="mx-auto w-12 h-12 rounded-lg border border-border bg-bg-elev flex items-center justify-center mb-4">
            <Plug size={20} className="text-accent" />
          </div>
          <h1 className="font-sans font-bold text-[18px] tracking-tight text-fg">
            No session open
          </h1>
          <p className="mt-1.5 text-[13px] text-fg-muted font-sans leading-relaxed">
            Pick a saved connection from the sidebar to spin up a terminal, or
            create a new one with{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-bg-elev border border-border font-mono text-[11px]">
              <Plus size={10} className="inline -mt-0.5" />
            </kbd>
            .
          </p>
        </div>
      </div>
    );
  }

  // Render every tab so xterm state survives switching, hide inactive ones
  return (
    <div className="flex-1 relative bg-[#1a1a1d] overflow-hidden">
      {tabs.map((t) => {
        const c = connections.find((x) => x.id === t.connectionId);
        if (!c) return null;
        const visible = t.id === activeTabId;
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
  );
}
