import { useState } from "react";
import { DotsThree, PencilSimple, Trash, Plug } from "@phosphor-icons/react";
import type { Connection } from "@/lib/types";
import { actions } from "@/lib/store";

export function ConnectionItem({
  conn,
  onEdit,
}: {
  conn: Connection;
  onEdit: (c: Connection) => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="group relative px-2">
      <button
        onClick={() => actions.openTab(conn.id)}
        className="w-full text-left px-2 py-2 rounded-md hover:bg-bg-elev transition-colors flex items-center gap-2"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-fg-dim group-hover:bg-accent transition-colors" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-sans font-medium text-fg truncate">{conn.name}</div>
          <div className="text-[11px] font-mono text-fg-dim truncate">
            {conn.username}@{conn.host}:{conn.port}
          </div>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenu((m) => !m);
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-fg-muted hover:text-fg p-1 rounded"
        aria-label="More"
      >
        <DotsThree size={16} weight="bold" />
      </button>
      {menu ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
          <div className="absolute right-3 top-10 z-20 w-40 bg-bg-elev border border-border rounded-md shadow-lg py-1 text-[12px] font-sans">
            <button
              className="w-full px-2.5 py-1.5 text-left text-fg hover:bg-bg-panel flex items-center gap-2"
              onClick={() => {
                setMenu(false);
                actions.openTab(conn.id);
              }}
            >
              <Plug size={13} /> Connect
            </button>
            <button
              className="w-full px-2.5 py-1.5 text-left text-fg hover:bg-bg-panel flex items-center gap-2"
              onClick={() => {
                setMenu(false);
                onEdit(conn);
              }}
            >
              <PencilSimple size={13} /> Edit
            </button>
            <button
              className="w-full px-2.5 py-1.5 text-left text-danger hover:bg-bg-panel flex items-center gap-2"
              onClick={() => {
                setMenu(false);
                actions.deleteConnection(conn.id);
              }}
            >
              <Trash size={13} /> Delete
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
