import { type ReactNode } from "react";

export function Kbd({
  children,
  variant = "muted",
}: {
  children: ReactNode;
  variant?: "muted" | "onAccent" | "onInverse";
}) {
  return (
    <kbd
      className={`px-1.5 h-[18px] inline-flex items-center justify-center rounded-[5px] text-[10px] font-mono leading-none ${
        variant === "onAccent"
          ? "border border-white/30 bg-white/15 text-accent-fg"
          : variant === "onInverse"
            ? "border border-bg/35 bg-bg/12 text-bg"
            : "border border-border bg-[var(--command-bg)] text-fg-muted"
      }`}
    >
      {children}
    </kbd>
  );
}
