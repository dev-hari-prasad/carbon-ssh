import type { Connection } from "@/lib/types";
import { HostIcon } from "./HostIcon";

export function TabIcon({
  conn,
  size = 18,
}: {
  conn: Connection | undefined;
  size?: number;
}) {
  if (!conn) {
    return (
      <div
        className="shrink-0 grid place-items-center rounded-sm bg-bg-panel/50"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] font-mono text-fg-muted">—</span>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <HostIcon conn={conn} size={size} />
    </div>
  );
}
