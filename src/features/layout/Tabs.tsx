import { X, Terminal } from "@phosphor-icons/react";
import { actions, useStore } from "@/lib/store";

export function Tabs() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);

  return (
    <div className="h-9 border-b border-border bg-bg-panel flex items-stretch overflow-x-auto">
      {tabs.length === 0 ? (
        <div className="px-3 flex items-center text-xxs font-mono text-fg-dim">
          no active sessions
        </div>
      ) : (
        tabs.map((t) => {
          const active = t.id === activeTabId;
          return (
            <div
              key={t.id}
              className={`group relative flex items-center gap-2 pl-3 pr-2 border-r border-border cursor-pointer transition-colors ${
                active
                  ? "bg-bg text-fg"
                  : "text-fg-muted hover:text-fg hover:bg-bg-elev"
              }`}
              onClick={() => actions.setActiveTab(t.id)}
            >
              <Terminal size={12} weight={active ? "fill" : "regular"} />
              <span className="text-[12px] font-mono truncate max-w-[200px]">
                {t.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  actions.closeTab(t.id);
                }}
                className="ml-1 p-0.5 rounded text-fg-dim hover:text-fg hover:bg-bg-panel"
                aria-label="Close tab"
              >
                <X size={11} weight="bold" />
              </button>
              {active ? (
                <span className="absolute left-0 right-0 bottom-0 h-px bg-accent" />
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
