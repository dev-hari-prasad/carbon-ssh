"use client";

import { useEffect } from "react";
import { RECONNECT_TAB_EVENT } from "@/lib/tab-events";
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

      // Reconnect active session tab only: Mod+Shift+R
      if (mod && shift && key === "r") {
        if (!activeTabId) return;
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent(RECONNECT_TAB_EVENT, { detail: { tabId: activeTabId } }),
        );
        return;
      }

      // Toggle Activity (Bottom Panel/Logs): Mod+Shift+A
      if (mod && shift && key === "a") {
        e.preventDefault();
        actions.toggleBottom();
        return;
      }

      // Settings Panel: Mod+Shift+S
      if (mod && shift && key === "s") {
        e.preventDefault();
        actions.toggleLargeSettings();
        return;
      }

      // View Hosts: Mod+Shift+H
      if (mod && shift && key === "h") {
        e.preventDefault();
        actions.goHome();
        return;
      }

      // New Session: Mod+Shift+T or Quick Switch: Mod+Shift+K, Mod+Shift+P
      if (mod && shift && (key === "t" || key === "k" || key === "p")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("tm:focus-search"));
        return;
      }

      // Toggle Sidebar: Mod+Shift+B
      if (mod && shift && key === "b") {
        e.preventDefault();
        actions.toggleSidebarCollapsed();
        return;
      }

      // AI/Bang Palette: Mod+Shift+I
      if (mod && shift && key === "i") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("tm:open-ai-bang"));
        return;
      }

      // Close Active Session: Mod+Shift+W
      if (mod && shift && key === "w") {
        if (activeTabId) {
          e.preventDefault();
          actions.closeTab(activeTabId);
        }
        return;
      }

      // Restore Closed Tab: Mod+Shift+U
      if (mod && shift && key === "u") {
        e.preventDefault();
        actions.restoreTab();
        return;
      }

      // Zoom Controls: Mod+Shift+Plus, Mod+Shift+Minus, Mod+Shift+0
      if (mod && shift && (key === "=" || key === "+" || key === "-" || key === "0")) {
        e.preventDefault();
        if (key === "=" || key === "+") actions.setZoomLevel(Math.min(135, zoomLevel + 5));
        if (key === "-") actions.setZoomLevel(Math.max(75, zoomLevel - 5));
        if (key === "0") actions.resetZoomLevel();
        return;
      }

      // New Bang: Mod+Shift+E
      if (mod && shift && key === "e") {
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
  }, [activeTabId, zoomLevel]);

  return null;
}
