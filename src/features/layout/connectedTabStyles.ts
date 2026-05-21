import { cn } from "@/lib/utils";

/** Browser-style tab that merges into the content panel below. */
export function connectedTabSurfaceClass(active: boolean) {
  if (active) {
    return cn(
      "h-[34px] bg-bg text-fg font-medium",
      "border border-border/45 border-b-bg",
      "rounded-t-[10px] rounded-b-none",
      "relative z-10 -mb-px pb-px",
      "shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--fg)_6%,transparent)]",
    );
  }

  return cn(
    "h-[30px] mb-[3px] rounded-t-[7px]",
    "text-fg-muted hover:text-fg",
    "border border-transparent",
  );
}
