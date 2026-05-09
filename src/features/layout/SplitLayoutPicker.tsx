"use client";

import { Columns, Rows, GridFour, CaretDown, SquaresFour } from "@phosphor-icons/react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { actions, useStore } from "@/lib/store";
import type { SplitLayout } from "@/lib/types";
import { SPLIT_LAYOUT_SLOTS } from "@/lib/types";

function LayoutThumb({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`grid h-14 w-full gap-[2px] rounded-md border border-border/70 bg-border/40 p-[3px] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

const tileCell = "rounded-sm bg-[var(--command-active-bg)]";

export function SplitLayoutPicker({
  variant,
  tabsLength,
  splitActive,
}: {
  variant: "top-bar" | "sidebar-collapsed" | "sidebar-expanded";
  tabsLength: number;
  splitActive: boolean;
}) {
  const splitLayout = useStore((s) => s.splitLayout);

  const pick = (layout: SplitLayout) => {
    actions.applySplitLayout(layout);
  };

  const triggerClassTop =
    "inline-flex h-7 min-w-[28px] flex-col items-center justify-center gap-0 rounded-sm px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45";

  const triggerClassSidebarIcon =
    "inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45";

  const triggerClassSidebarFull =
    "inline-flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-[12px] font-sans transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45";

  const inactive = "text-fg-muted hover:bg-[var(--command-active-bg)] hover:text-fg";
  const activeSplit = "bg-accent/10 text-accent";

  let trigger: React.ReactElement;
  if (variant === "top-bar") {
    trigger = (
      <button
        type="button"
        aria-label="Split layout options"
        aria-haspopup="dialog"
        className={`${triggerClassTop} ${splitActive ? activeSplit : inactive}`}
      >
        <GridFour size={15} weight={splitActive ? "fill" : "regular"} />
        <CaretDown size={9} weight="bold" className="opacity-70" aria-hidden />
      </button>
    );
  } else if (variant === "sidebar-collapsed") {
    trigger = (
      <button
        type="button"
        aria-label="Split layout options"
        aria-haspopup="dialog"
        className={`${triggerClassSidebarIcon} ${splitActive ? activeSplit : inactive}`}
      >
        <GridFour size={14} weight={splitActive ? "fill" : "regular"} />
      </button>
    );
  } else {
    trigger = (
      <button
        type="button"
        aria-label="Split layout options"
        aria-haspopup="dialog"
        className={`${triggerClassSidebarFull} justify-start ${splitActive ? activeSplit : `${inactive} bg-[var(--command-bg)]`}`}
      >
        <GridFour size={16} weight={splitActive ? "fill" : "regular"} className="shrink-0" />
        <span className="truncate">Split tabs</span>
        <CaretDown size={11} weight="bold" className="ml-auto shrink-0 opacity-60" aria-hidden />
      </button>
    );
  }

  const tileBtn = (
    layout: SplitLayout,
    label: string,
    thumb: React.ReactNode,
  ) => {
    const slots = SPLIT_LAYOUT_SLOTS[layout];
    const disabled = tabsLength < slots;
    const isActive = splitActive && splitLayout === layout;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => pick(layout)}
        title={disabled ? `Needs at least ${slots} tabs` : label}
        className={`group flex flex-col items-center gap-1 rounded-md p-1.5 text-center outline-none transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-35"
            : isActive
              ? "bg-accent/12 ring-1 ring-accent/40"
              : "hover:bg-[var(--menu-hover-bg)] focus-visible:ring-2 focus-visible:ring-accent/45"
        }`}
      >
        {thumb}
        <span className={`text-[10px] font-sans leading-tight truncate ${isActive ? "text-accent font-medium" : "text-fg-muted group-hover:text-fg"}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <HoverCard openDelay={120} closeDelay={150}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent
        side={variant === "top-bar" ? "bottom" : "right"}
        align={variant === "top-bar" ? "center" : "start"}
        sideOffset={8}
        collisionPadding={12}
        className={`w-[min(280px,calc(100vw-2rem))] border-[var(--border-strong)] bg-[var(--popover-bg)] p-3 shadow-xl ${
          variant !== "top-bar" ? "w-[260px]" : ""
        }`}
      >
        <div className="mb-2 space-y-0.5">
          <div className="text-[12px] font-sans font-semibold text-fg">Split layout</div>
          <p className="text-[10.5px] font-sans leading-snug text-fg-muted">
            Drag the border between panes to resize.
            Double-click a border to reset to 50/50.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {tileBtn(
            "two-columns",
            "Side by side",
            <LayoutThumb className="grid-cols-2">
              <div className={tileCell} />
              <div className={tileCell} />
            </LayoutThumb>,
          )}

          {tileBtn(
            "two-rows",
            "Stacked",
            <LayoutThumb className="grid-rows-2 grid-cols-1">
              <div className={tileCell} />
              <div className={tileCell} />
            </LayoutThumb>,
          )}

          {tileBtn(
            "left-main",
            "Main + stack",
            <LayoutThumb className="grid-cols-[3fr_2fr] grid-rows-2">
              <div className={`row-span-2 ${tileCell}`} />
              <div className={tileCell} />
              <div className={tileCell} />
            </LayoutThumb>,
          )}

          {tileBtn(
            "grid-4",
            "Quad",
            <LayoutThumb className="grid-cols-2 grid-rows-2">
              <div className={tileCell} />
              <div className={tileCell} />
              <div className={tileCell} />
              <div className={tileCell} />
            </LayoutThumb>,
          )}
        </div>

        <div className="mt-3 border-t border-border/40 pt-3">
          <button
            type="button"
            disabled={!splitActive}
            onClick={() => splitActive && actions.clearSplit()}
            className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border/60 px-2 py-2 text-center text-[11px] font-sans text-fg-muted transition-colors ${
              splitActive
                ? "hover:border-accent/50 hover:bg-[var(--menu-hover-bg)] hover:text-fg"
                : "cursor-not-allowed opacity-40"
            }`}
          >
            <span className="font-medium text-fg">Exit split</span>
            <span className="text-[10px] leading-snug">Return to single-pane focus</span>
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
