import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md bg-bg-elev border border-border rounded-[14px] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-bg-panel">
          <h2 className="font-sans font-semibold text-[13px] text-fg">{title}</h2>
          <button
            onClick={onClose}
            className="text-fg-muted hover:text-fg transition-colors"
            aria-label="Close"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        <div className="px-4 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer ? (
          <div className="px-4 h-12 border-t border-border bg-bg-panel flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
