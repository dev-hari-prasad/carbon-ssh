import { CaretDown, CaretUp, Trash } from "@phosphor-icons/react";
import { actions, useStore } from "@/lib/store";

const levelColor = {
  info: "text-fg-muted",
  warn: "text-warning",
  error: "text-danger",
} as const;

export function BottomPanel() {
  const open = useStore((s) => s.bottomOpen);
  const logs = useStore((s) => s.logs);

  return (
    <div className="border-t border-border bg-bg-panel flex flex-col">
      <div className="h-8 px-3 flex items-center justify-between">
        <button
          onClick={() => actions.toggleBottom()}
          className="flex items-center gap-1.5 text-xxs uppercase font-sans font-semibold text-fg-muted hover:text-fg tracking-wider"
        >
          {open ? <CaretDown size={11} weight="bold" /> : <CaretUp size={11} weight="bold" />}
          Logs
          <span className="text-fg-dim font-mono normal-case tracking-normal">
            ({logs.length})
          </span>
        </button>
        {open ? (
          <button
            onClick={() => actions.clearLogs()}
            className="text-fg-dim hover:text-fg p-1 rounded"
            aria-label="Clear logs"
          >
            <Trash size={12} />
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="h-40 overflow-y-auto px-3 pb-2 font-mono text-[12px] leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-fg-dim py-2">no log entries yet.</div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex gap-3 py-0.5">
                <span className="text-fg-dim shrink-0">
                  {new Date(l.ts).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className={`shrink-0 uppercase text-xxs ${levelColor[l.level]}`}>
                  {l.level}
                </span>
                <span className="text-fg-dim shrink-0">{l.source}</span>
                <span className="text-fg break-all">{l.message}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
