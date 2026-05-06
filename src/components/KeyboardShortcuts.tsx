"use client";

import { useEffect } from "react";
import { actions, useStore } from "@/lib/store";

export function KeyboardShortcuts() {
  const activeTabId = useStore((s) => s.activeTabId);
  const zoomLevel = useStore((s) => s.zoomLevel);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac =
        typeof window !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Toggle Activity (Bottom Panel/Logs): Mod+A
      if (mod && !shift && key === "a") {
        e.preventDefault();
        actions.toggleBottom();
        return;
      }

      // Settings Panel: Mod+S
      if (mod && !shift && key === "s") {
        e.preventDefault();
        actions.toggleSettings();
        return;
      }

      // View Hosts: Mod+H
      if (mod && !shift && key === "h") {
        e.preventDefault();
        actions.goHome();
        return;
      }

      // New Session: Mod+T or Quick Switch: Mod+K, Mod+P
      if (mod && (key === "t" || key === "k" || key === "p")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("tm:focus-search"));
        return;
      }

      // AI/Bang Palette: Mod+I
      if (mod && !shift && key === "i") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("tm:open-ai-bang"));
        return;
      }

      // Close Active Session: Mod+W
      if (mod && key === "w") {
        if (activeTabId) {
          e.preventDefault();
          actions.closeTab(activeTabId);
        }
        return;
      }

      // Restore Closed Tab: Mod+Shift+T
      if (mod && shift && key === "t") {
        e.preventDefault();
        actions.restoreTab();
        return;
      }

      // Zoom Controls: Mod+Plus, Mod+Minus, Mod+0
      if (mod && (key === "=" || key === "+" || key === "-" || key === "0")) {
        e.preventDefault();
        if (key === "=" || key === "+") actions.setZoomLevel(Math.min(135, zoomLevel + 5));
        if (key === "-") actions.setZoomLevel(Math.max(75, zoomLevel - 5));
        if (key === "0") actions.resetZoomLevel();
        return;
      }

      // New Bang: Mod+Shift+B
      if (mod && shift && key === "b") {
        e.preventDefault();
        actions.openSettingsTab("bangs");
        // Trigger specific event to open the form
        window.dispatchEvent(new CustomEvent("tm:new-bang"));
        return;
      }

      // Tab Navigation: Mod+Tab / Mod+Shift+Tab
      // Note: Mod+Tab is often handled by OS, but in Electron we can sometimes capture it.
      // However, xterm might also be capturing keys.
      if (mod && key === "tab") {
        e.preventDefault();
        if (shift) {
          actions.prevTab();
        } else {
          actions.nextTab();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [activeTabId]);

  return null;
}
