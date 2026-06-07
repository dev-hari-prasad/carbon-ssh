import { useCallback, useRef, useState } from "react";
import type { Tab } from "@/lib/types";
import { actions } from "@/lib/store";

export const TAB_STRIP_DRAG_MIME = "application/x-carbon-ssh-tab";

export function tabStripRawInsertIndex(
  container: HTMLElement,
  tabs: Tab[],
  clientX: number,
  clientY: number,
  orientation: "horizontal" | "vertical",
): number {
  const coord = orientation === "horizontal" ? clientX : clientY;
  for (let i = 0; i < tabs.length; i++) {
    const el = container.querySelector(`[data-tab-strip-item="${CSS.escape(tabs[i].id)}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const mid = orientation === "horizontal" ? r.left + r.width / 2 : r.top + r.height / 2;
    if (coord < mid) return i;
  }
  return tabs.length;
}

function dragHasTab(types: DOMStringList | readonly string[]): boolean {
  const list = Array.from(types as string[]);
  return list.includes(TAB_STRIP_DRAG_MIME) || list.includes("text/plain");
}

export function useTabStripDnD({
  tabs,
  orientation,
}: {
  tabs: Tab[];
  orientation: "horizontal" | "vertical";
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData(TAB_STRIP_DRAG_MIME, tabId);
    e.dataTransfer.setData("text/plain", tabId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(tabId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!stripRef.current || !dragHasTab(e.dataTransfer.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const tabId =
        e.dataTransfer.getData(TAB_STRIP_DRAG_MIME) || e.dataTransfer.getData("text/plain");
      if (!tabId || !stripRef.current) {
        setDraggingId(null);
        return;
      }
      const rawInsert = tabStripRawInsertIndex(
        stripRef.current,
        tabs,
        e.clientX,
        e.clientY,
        orientation,
      );
      actions.moveTab(tabId, rawInsert);
      setDraggingId(null);
    },
    [tabs, orientation],
  );

  return {
    stripRef,
    draggingId,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}
