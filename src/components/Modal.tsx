import { useEffect } from "react";
import { X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  icon,
  footerAlign = "end",
  showFooterSeparator = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  footerAlign?: "start" | "end";
  showFooterSeparator?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/55"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-md bg-bg-elev border border-border rounded-[10px] shadow-2xl overflow-hidden !mb-10"
          >
            <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-bg-panel">
              <div className="flex items-center gap-2">
                {icon}
                <h2 className="font-sans font-semibold text-[13px] text-fg">{title}</h2>
              </div>
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
              <div
                className={`px-4  !py-4 h-14 bg-bg-panel flex items-center gap-2 ${
                  footerAlign === "start" ? "justify-start" : "justify-end"
                } ${showFooterSeparator ? "border-t border-border" : ""}`}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
