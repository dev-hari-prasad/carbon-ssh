"use client";

import { useStore } from "@/lib/store";
import { Toaster as Sonner } from "sonner";
import { getThemeById } from "@/config/themes/index";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const themeId = useStore((s) => s.theme);
  const theme = getThemeById(themeId);
  const isLight = theme.type === "light";

  return (
    <Sonner
      theme={isLight ? "light" : "dark"}
      className="toaster group"
      gap={8}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-[var(--bg-elev)] group-[.toaster]:!text-[var(--fg)] group-[.toaster]:!border-[var(--border-strong)] group-[.toaster]:shadow-2xl group-[.toaster]:rounded-md group-[.toaster]:px-2.5 group-[.toaster]:py-1 group-[.toaster]:text-[12px] group-[.toaster]:font-sans group-[.toaster]:gap-2.5 group-[.toaster]:min-h-0 group-[.toaster]:w-fit group-[.toaster]:max-w-[320px] group-[.toaster]:backdrop-blur-xl",
          description: "group-[.toast]:!text-[var(--fg-muted)] group-[.toast]:!text-[10px] group-[.toast]:leading-tight group-[.toast]:mt-0",
          actionButton: "group-[.toast]:!bg-[var(--accent)] group-[.toast]:!text-[var(--accent-fg)] group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:!bg-[var(--bg-panel)] group-[.toast]:!text-[var(--fg-muted)]",
          icon: "group-[.toast]:!text-inherit group-[.toast]:size-3.5",
          // Style variants manually to avoid richColors overriding with bright backgrounds
          error: "group-[.toaster]:!border-[var(--danger)]/30 group-[.toaster]:!text-[var(--danger)]",
          success: "group-[.toaster]:!border-[var(--success)]/30 group-[.toaster]:!text-[var(--success)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
