import {
  SplitHorizontal,
  SplitVertical,
  ArrowsOutSimple,
  X,
  SquaresFour,
  Swap,
} from "@phosphor-icons/react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { actions, useStore } from "@/lib/store";

interface TabContextMenuProps {
  tabId: string;
  children: React.ReactNode;
}

export function TabContextMenu({ tabId, children }: TabContextMenuProps) {
  const inSplit = useStore((s) => s.splitTabIds.includes(tabId));
  const splitCount = useStore((s) => s.splitTabIds.length);
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const splitLayout = useStore((s) => s.splitLayout);

  const handleSplitWithActive = () => {
    if (activeTabId && activeTabId !== tabId) {
      if (!inSplit) actions.addToSplit(tabId);
      actions.addToSplit(activeTabId);
    } else {
      const other = tabs.find((t) => t.id !== tabId);
      if (other) {
        if (!inSplit) actions.addToSplit(tabId);
        actions.addToSplit(other.id);
      }
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {inSplit ? (
          <>
            <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-fg-dim">
              Split actions
            </ContextMenuLabel>
            <ContextMenuItem
              onClick={() => {
                actions.clearSplit();
                actions.setActiveTab(tabId);
              }}
              className="flex items-center gap-2.5 text-[12px]"
            >
              <ArrowsOutSimple size={15} weight="bold" className="text-fg-muted shrink-0" />
              Focus (exit split)
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => actions.removeFromSplit(tabId)}
              className="flex items-center gap-2.5 text-[12px]"
            >
              <X size={15} weight="bold" className="text-fg-muted shrink-0" />
              Remove from split
            </ContextMenuItem>
            {splitCount >= 2 && (
              <ContextMenuItem
                onClick={() =>
                  actions.setSplitLayout(
                    splitLayout === "two-columns" ? "two-rows" : "two-columns",
                  )
                }
                className="flex items-center gap-2.5 text-[12px]"
              >
                <Swap size={15} weight="bold" className="text-fg-muted shrink-0" />
                Toggle layout ({splitLayout === "two-columns" ? "Stacked" : "Side by side"})
              </ContextMenuItem>
            )}
          </>
        ) : (
          <>
            <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-fg-dim">
              Split tab
            </ContextMenuLabel>
            <ContextMenuItem
              onClick={() => {
                actions.setSplitLayout("two-columns");
                actions.addToSplit(tabId);
              }}
              className="flex items-center gap-2.5 text-[12px]"
            >
              <SplitHorizontal size={15} weight="bold" className="text-fg-muted shrink-0" />
              Split Right
              <ContextMenuShortcut>Horizontal</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                actions.setSplitLayout("two-rows");
                actions.addToSplit(tabId);
              }}
              className="flex items-center gap-2.5 text-[12px]"
            >
              <SplitVertical size={15} weight="bold" className="text-fg-muted shrink-0" />
              Split Down
              <ContextMenuShortcut>Vertical</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={handleSplitWithActive}
              className="flex items-center gap-2.5 text-[12px]"
            >
              <SquaresFour size={15} weight="bold" className="text-fg-muted shrink-0" />
              Split with active tab
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
