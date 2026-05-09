import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getThemeById, terminalThemeForTheme } from "@/config/themes";
import { getTerminalFontById } from "@/config/fonts";
import { MagnifyingGlass, X, ArrowsClockwise } from "@phosphor-icons/react";
import type { Connection, Tab } from "@/lib/types";
import { actions, useStore } from "@/lib/store";
import { buildSshAuthPayload } from "@/lib/credentials";
import {
  classifySshFailureForTelemetry,
  trackFeatureUsed,
  trackSSHConnectFailure,
  trackSSHConnectSuccess,
} from "@/lib/telemetry";
import { AIBangPalette } from "./AIBangPalette";

interface Props {
  tab: Tab;
  conn: Connection;
}

type ClientMessage =
  | {
      type: "connect";
      data: {
        host: string;
        port: number;
        username: string;
        authMethod: "password" | "privateKey";
        password?: string;
        privateKey?: string;
        passphrase?: string;
        cols: number;
        rows: number;
      };
    }
  | { type: "input"; data: string }
  | { type: "resize"; data: { cols: number; rows: number } }
  | { type: "close" };

type ServerMessage =
  | { type: "data"; data: string }
  | { type: "error"; message: string }
  | { type: "connected" }
  | { type: "closed" };

function buildWebSocketUrl() {
  const url = new URL("/api/ws", window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function parseServerMessage(data: string): ServerMessage | null {
  try {
    return JSON.parse(data) as ServerMessage;
  } catch {
    return null;
  }
}

export function TerminalView({ tab, conn }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAddonRef = useRef<any>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePos, setPalettePos] = useState<{ top: number; left: number } | null>(null);
  const [paletteInitial, setPaletteInitial] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [ghostText, setGhostText] = useState<{ text: string; top: number; left: number; command: string } | null>(null);
  const themeId = useStore((s) => s.theme);
  const terminalFontId = useStore((s) => s.terminalFont);
  const terminalCursorStyle = useStore((s) => s.terminalCursorStyle);
  const bangs = useStore((s) => s.bangs);

  // Refs for callbacks
  const commandBufferRef = useRef("");
  const ghostTextRef = useRef(ghostText);
  ghostTextRef.current = ghostText;
  const paletteOpenRef = useRef(paletteOpen);
  paletteOpenRef.current = paletteOpen;
  const bangsRef = useRef(bangs);
  bangsRef.current = bangs;

  // Keep theme/font in refs so the main effect doesn't re-run on store hydration
  const themeRef = useRef(themeId);
  themeRef.current = themeId;
  const terminalFontRef = useRef(terminalFontId);
  terminalFontRef.current = terminalFontId;
  const terminalCursorStyleRef = useRef(terminalCursorStyle);
  terminalCursorStyleRef.current = terminalCursorStyle;

  // Ref to hold the xterm Terminal instance so the theme/font effect can update it
  const termInstanceRef = useRef<import("@xterm/xterm").Terminal | null>(null);

  const connectionSnapshotId = useMemo(() => {
    return JSON.stringify({
      id: conn.id,
      host: conn.host,
      port: conn.port,
      username: conn.username,
    });
  }, [conn.id, conn.host, conn.port, conn.username]);

  const connectionSnapshot = useMemo(
    () => ({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.authType,
      password: conn.password,
      privateKey: conn.privateKey,
      passphrase: conn.passphrase,
    }),
    [
      conn.id,
      conn.name,
      conn.host,
      conn.port,
      conn.username,
      conn.authType,
      conn.password,
      conn.privateKey,
      conn.passphrase,
    ],
  );
  const authPayload = useMemo(() => buildSshAuthPayload(connectionSnapshot), [connectionSnapshot]);

  // Separate effect: update terminal theme/font WITHOUT killing the connection
  useEffect(() => {
    const term = termInstanceRef.current;
    if (!term) return;
    term.options.theme = terminalThemeForTheme(getThemeById(themeId));
    term.options.fontFamily = getTerminalFontById(terminalFontId).stack;
    
    const style = terminalCursorStyle.includes("block") ? "block" : terminalCursorStyle.includes("bar") ? "bar" : "underline";
    const blink = terminalCursorStyle.includes("blinking");
    term.options.cursorStyle = style;
    term.options.cursorBlink = blink;
  }, [themeId, terminalFontId, terminalCursorStyle]);

  // Main connection effect — only depends on tab.id and connectionSnapshot.id
  useEffect(() => {
    setIsClosed(false);
    actions.setConnectionStatus(connectionSnapshot.id, { state: "connecting" });
    if (!hostRef.current) return;
    let disposed = false;
    let terminalErrorMessage: string | null = null;
    let socket: WebSocket | null = null;
    const cleanups: Array<() => void> = [];

    (async () => {
      // Connect WebSocket
      if (disposed) return;
      const [{ Terminal }, { FitAddon }, { SearchAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-search"),
      ]);
      if (disposed || !hostRef.current) return;

      const term = new Terminal({
        fontFamily: getTerminalFontById(terminalFontRef.current).stack,
        fontSize: 13,
        lineHeight: 1.0,
        cursorBlink: terminalCursorStyleRef.current.includes("blinking"),
        cursorStyle: terminalCursorStyleRef.current.includes("block") 
          ? "block" 
          : terminalCursorStyleRef.current.includes("bar") 
            ? "bar" 
            : "underline",
        cursorWidth: 1,
        allowProposedApi: true,
        theme: terminalThemeForTheme(getThemeById(themeRef.current)),
      });
      termInstanceRef.current = term;

      const fit = new FitAddon();
      term.loadAddon(fit);

      const search = new SearchAddon();
      term.loadAddon(search);
      searchAddonRef.current = search;

      term.open(hostRef.current);

      requestAnimationFrame(() => {
        try {
          fit.fit();
        } catch {
          /* noop */
        }
      });

      term.writeln("Carbon SSH — live session shell");
      const baseMsg = `connecting to ${connectionSnapshot.username}@${connectionSnapshot.host}:${connectionSnapshot.port}…`;
      let spinnerIdx = 0;
      let spinnerActive = true;
      const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      
      term.write(`\x1b[38;5;244m${spinnerFrames[0]}\x1b[0m ${baseMsg}`);
      
      const spinnerInterval = setInterval(() => {
        if (!spinnerActive) return;
        spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
        term.write(`\r\x1b[38;5;244m${spinnerFrames[spinnerIdx]}\x1b[0m ${baseMsg}`);
      }, 80);

      actions.log(
        "info",
        connectionSnapshot.name,
        `Connecting to ${connectionSnapshot.username}@${connectionSnapshot.host}`,
      );

      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      let wsResizeTimer: ReturnType<typeof setTimeout> | null = null;
      const ro = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          try {
            fit.fit();
          } catch {
            /* noop */
          }
        }, 80);
      });
      ro.observe(hostRef.current);

      // Connect WebSocket
      if (disposed) return;

      socket = new WebSocket(buildWebSocketUrl());
      let closed = false;

      const currentSocket = socket;
      const originalClose = currentSocket.close;
      currentSocket.close = (...args: any[]) => {
        console.trace("Socket closed manually called in TerminalView:", args);
        return originalClose.apply(currentSocket, args as any);
      };

      const send = (message: ClientMessage) => {
        if (currentSocket.readyState === WebSocket.OPEN) {
          currentSocket.send(JSON.stringify(message));
        }
      };

      const handleClosed = () => {
        if (disposed) return;
        if (closed) return;
        closed = true;
        setIsClosed(true);
        actions.setConnectionStatus(
          connectionSnapshot.id,
          terminalErrorMessage
            ? { state: "error", message: terminalErrorMessage }
            : { state: "closed", message: "SSH connection closed" },
        );
        spinnerActive = false;
        clearInterval(spinnerInterval);
        term.writeln("\r\nconnection closed.");
        actions.log("info", connectionSnapshot.name, `Session ${tab.title} closed`);
      };

      currentSocket.addEventListener("open", () => {
        if (disposed) {
          currentSocket.close();
          return;
        }
        send({
          type: "connect",
          data: {
            host: connectionSnapshot.host,
            port: connectionSnapshot.port,
            ...authPayload,
            cols: term.cols,
            rows: term.rows,
          },
        });
      });

      const handleMessagePayload = (payload: string) => {
        if (disposed) return;
        const message = parseServerMessage(payload);
        if (!message) return;
        switch (message.type) {
          case "data":
            term.write(message.data);
            break;
          case "connected":
            spinnerActive = false;
            clearInterval(spinnerInterval);
            term.write(`\r\x1b[32m■\x1b[0m ${baseMsg}\r\n`);
            term.writeln("connected.");
            trackSSHConnectSuccess();
            actions.setConnectionStatus(connectionSnapshot.id, { state: "connected" });
            actions.log("info", connectionSnapshot.name, `Session ${tab.title} connected`);
            break;
          case "closed":
            handleClosed();
            break;
          case "error": {
            spinnerActive = false;
            clearInterval(spinnerInterval);
            let errorMsg = message.message;
            if (errorMsg.includes("All configured authentication methods failed")) {
              errorMsg +=
                "\r\n\r\n\x1b[33mTroubleshooting:\x1b[31m\r\n" +
                "• Check that you provided the correct password, passphrase, or private key.\r\n" +
                "• Verify the server's sshd_config allows your authentication method (e.g., PasswordAuthentication).\r\n" +
                "• Verify the user is allowed to log in (e.g., PermitRootLogin yes).\r\n" +
                "• Once resolved, use the 'Try reconnecting' option below.";
            } else if (errorMsg.includes("Timed out while waiting for handshake")) {
              errorMsg +=
                "\r\n\r\n\x1b[33mTroubleshooting:\x1b[31m\r\n" +
                "• Ensure the host is reachable and the SSH service is running.\r\n" +
                "• Check for firewalls or security groups blocking port " +
                connectionSnapshot.port +
                ".\r\n" +
                "• Verify your internet connection or check for high network latency.\r\n" +
                "• The server may be under heavy load or restricting new connections.\r\n" +
                "• Once resolved, use the 'Try reconnecting' option below.";
            }
            // Ensure any newlines in the base error are \r\n for xterm.js
            errorMsg = errorMsg.replace(/\r?\n/g, "\r\n");
            term.writeln(`\r\n\x1b[31merror: ${errorMsg}\x1b[0m`);
            terminalErrorMessage = message.message;
            trackSSHConnectFailure(classifySshFailureForTelemetry(message.message));
            actions.log("error", connectionSnapshot.name, message.message);
            actions.setConnectionStatus(connectionSnapshot.id, {
              state: "error",
              message: message.message,
            });
            setIsClosed(true);
            break;
          }
        }
      };

      currentSocket.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          handleMessagePayload(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          handleMessagePayload(new TextDecoder().decode(event.data));
        } else if (event.data instanceof Blob) {
          event.data
            .text()
            .then(handleMessagePayload)
            .catch(() => undefined);
        }
      });

      currentSocket.addEventListener("close", () => {
        if (disposed) return;
        handleClosed();
      });
      currentSocket.addEventListener("error", () => {
        if (disposed) return;
        term.writeln("\r\nwebsocket error.");
        terminalErrorMessage = "WebSocket error";
        trackSSHConnectFailure(classifySshFailureForTelemetry("WebSocket error"));
        actions.log("error", connectionSnapshot.name, "WebSocket error");
        actions.setConnectionStatus(connectionSnapshot.id, {
          state: "error",
          message: "WebSocket error",
        });
        setIsClosed(true);
      });

      let kbdSelection: { startX: number; startY: number; endX: number; endY: number } | null = null;

      term.attachCustomKeyEventHandler((e) => {
        const isMac =
          typeof window !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform);
        const mod = isMac ? e.metaKey : e.ctrlKey;
        const shift = e.shiftKey;

        // Mod + C or Ctrl + Shift + C: Copy (if selection exists)
        if ((mod && e.key.toLowerCase() === "c") || (e.ctrlKey && shift && e.key.toLowerCase() === "c")) {
          const selection = term.getSelection();
          if (selection) {
            if (e.type === "keydown") {
              navigator.clipboard.writeText(selection);
            }
            return false; // Prevent sending SIGINT if we're copying
          }
          return true; // No selection? Let it send SIGINT
        }

        // Mod + V or Ctrl + Shift + V: Paste
        if ((mod && e.key.toLowerCase() === "v") || (e.ctrlKey && shift && e.key.toLowerCase() === "v")) {
          if (e.type === "keydown") {
            navigator.clipboard.readText().then((text) => {
              send({ type: "input", data: text });
            });
          }
          return false;
        }

        // Mod + L: Clear
        if (mod && e.key.toLowerCase() === "l") {
          if (e.type === "keydown") {
            term.clear();
          }
          return false;
        }

        // Mod + Shift + F: Find
        if (mod && shift && e.key.toLowerCase() === "f") {
          if (e.type === "keydown") {
            setSearchOpen((prev) => {
              if (!prev) trackFeatureUsed("terminal_find_opened");
              return !prev;
            });
          }
          return false;
        }

        // Shift + Arrow: Text Selection
        if (shift && !mod && e.key.startsWith("Arrow")) {
          if (e.type === "keydown") {
            const buffer = term.buffer.active;
            
            if (!kbdSelection) {
               const hasSelection = term.hasSelection();
               let pos = term.getSelectionPosition();
               if (hasSelection && pos) {
                  kbdSelection = {
                    startX: pos.start.x,
                    startY: pos.start.y,
                    endX: pos.end.x,
                    endY: pos.end.y,
                  };
               } else {
                  kbdSelection = { startX: buffer.cursorX, startY: buffer.cursorY, endX: buffer.cursorX, endY: buffer.cursorY };
               }
            }

            if (e.key === "ArrowLeft") {
              kbdSelection.endX -= 1;
              if (kbdSelection.endX < 0) {
                 if (kbdSelection.endY > 0) {
                    kbdSelection.endY -= 1;
                    kbdSelection.endX = term.cols - 1;
                 } else {
                    kbdSelection.endX = 0;
                 }
              }
            } else if (e.key === "ArrowRight") {
              kbdSelection.endX += 1;
              if (kbdSelection.endX >= term.cols) {
                 if (kbdSelection.endY < term.rows - 1) {
                    kbdSelection.endY += 1;
                    kbdSelection.endX = 0;
                 } else {
                    kbdSelection.endX = term.cols - 1;
                 }
              }
            } else if (e.key === "ArrowUp") {
              kbdSelection.endY = Math.max(0, kbdSelection.endY - 1);
            } else if (e.key === "ArrowDown") {
              kbdSelection.endY = Math.min(term.rows - 1, kbdSelection.endY + 1);
            }

            let startRow = kbdSelection.startY;
            let startCol = kbdSelection.startX;
            let endRow = kbdSelection.endY;
            let endCol = kbdSelection.endX;

            if (endRow < startRow || (endRow === startRow && endCol < startCol)) {
               startRow = kbdSelection.endY;
               startCol = kbdSelection.endX;
               endRow = kbdSelection.startY;
               endCol = kbdSelection.startX;
            }

            const length = (endRow - startRow) * term.cols + (endCol - startCol);
            if (length > 0) {
              term.select(startCol, startRow, length);
            } else {
              term.clearSelection();
            }
          }
          return false;
        } else if (e.key === "!" && !mod && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (e.type === "keydown") {
            const cursorX = term.buffer.active.cursorX;
            const cursorY = term.buffer.active.cursorY;
            const termEl = term.element;
            if (termEl) {
              const core = (term as any)._core;
              const dimensions = core._renderService?.dimensions || core._renderCoordinator?.dimensions;
              const cellWidth = dimensions?.css?.cell?.width ?? (termEl.clientWidth / term.cols);
              const cellHeight = dimensions?.css?.cell?.height ?? (termEl.clientHeight / term.rows);
              window.dispatchEvent(new CustomEvent("tm:open-ai-bang-at-cursor", {
                detail: {
                  top: (cursorY + 1) * cellHeight + 8,
                  left: cursorX * cellWidth + 8,
                  query: "!"
                }
              }));
            }
          }
          return true; // let ! pass through to terminal
        } else if (paletteOpenRef.current && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          if (e.type === "keydown") {
            window.dispatchEvent(new CustomEvent("tm:focus-ai-bang"));
          }
          return false;
        } else if (paletteOpenRef.current && e.key === "Tab" && !mod && !e.shiftKey) {
          if (e.type === "keydown") {
            const gt = ghostTextRef.current;
            if (gt) {
              const backspaces = "\x7f".repeat(commandBufferRef.current.length);
              send({ type: "input", data: backspaces + gt.command });
              setGhostText(null);
              setPaletteOpen(false);
            }
          }
          return false;
        } else if (e.key === "Escape") {
          if (paletteOpenRef.current && e.type === "keydown") {
            setPaletteOpen(false);
            setGhostText(null);
          }
        } else {
          if (e.type === "keydown" && e.key !== "Shift") {
            kbdSelection = null;
          }
        }

        return true;
      });

      let commandBuffer = "";

      const dataSub = term.onData((data: string) => {
        send({ type: "input", data });

        // Simple heuristic to track user commands for the activity logger
        const cleanData = data.replace(/\x1b(?:\[[0-9;]*[a-zA-Z]|[O][a-zA-Z])/g, "");
        for (let i = 0; i < cleanData.length; i++) {
          const char = cleanData[i];
          if (char === "\r") {
            const cmd = commandBuffer.trim();
            if (cmd) {
              actions.log("info", connectionSnapshot.name, `$ ${cmd}`);
              actions.incrementCommandCount(tab.id);
              setHistory(prev => [cmd, ...prev].slice(0, 10));
            }
            commandBuffer = "";
          } else if (char === "\x7f" || char === "\b") {
            commandBuffer = commandBuffer.slice(0, -1);
          } else if (char === "\x03" || char === "\x15") {
            // Ctrl+C or Ctrl+U
            commandBuffer = "";
          } else if (char < "\x20" && char !== "\t") {
            // ignore other control characters
          } else {
            commandBuffer += char;
          }
        }
        commandBufferRef.current = commandBuffer;

        if (paletteOpenRef.current) {
          if (commandBuffer.startsWith("!")) {
            window.dispatchEvent(new CustomEvent("tm:update-ai-bang-query", { detail: commandBuffer }));
            
            const query = commandBuffer.replace(/^!/, "").toLowerCase();
            const match = bangsRef.current.find(b => b.trigger.toLowerCase().startsWith(query));
            if (match && query.length > 0) {
              const suffix = match.trigger.substring(query.length);
              if (suffix.length > 0) {
                const termEl = term.element;
                if (termEl) {
                  const core = (term as any)._core;
                  const dimensions = core._renderService?.dimensions || core._renderCoordinator?.dimensions;
                  const cellWidth = dimensions?.css?.cell?.width ?? (termEl.clientWidth / term.cols);
                  const cellHeight = dimensions?.css?.cell?.height ?? (termEl.clientHeight / term.rows);
                  setGhostText({
                    text: suffix,
                    top: term.buffer.active.cursorY * cellHeight + 8,
                    left: term.buffer.active.cursorX * cellWidth + 8,
                    command: match.command
                  });
                }
              } else {
                setGhostText(null);
              }
            } else {
              setGhostText(null);
            }
          } else if (commandBuffer === "") {
            setPaletteOpen(false);
            setGhostText(null);
          }

          // Update terminal output context whenever palette is about to open or query changes
          const buffer = term.buffer.active;
          const lines: string[] = [];
          for (let i = Math.max(0, buffer.baseY + buffer.cursorY - 20); i <= buffer.baseY + buffer.cursorY; i++) {
            const line = buffer.getLine(i);
            if (line) lines.push(line.translateToString());
          }
          setTerminalOutput(lines);
        }
      });

      const resizeSub = term.onResize(({ cols, rows }) => {
        if (wsResizeTimer) clearTimeout(wsResizeTimer);
        wsResizeTimer = setTimeout(() => {
          send({ type: "resize", data: { cols, rows } });
        }, 100);
      });

      const handleTerminalInput = (e: Event) => {
        const customEvent = e as CustomEvent<string>;
        const cmd = customEvent.detail;
        commandBuffer += cmd;
        send({ type: "input", data: cmd });
      };
      window.addEventListener("tm:terminal-input", handleTerminalInput);

      cleanups.push(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        if (wsResizeTimer) clearTimeout(wsResizeTimer);
        window.removeEventListener("tm:terminal-input", handleTerminalInput);
        dataSub.dispose();
        resizeSub.dispose();
        ro.disconnect();
        console.trace("[TerminalView] cleanups executing! socket state:", socket?.readyState);
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
          console.log("[TerminalView] cleanups calling socket.close()!");
          socket.close();
        }
        term.dispose();
        termInstanceRef.current = null;
      });
    })();

    return () => {
      console.log("[TerminalView] useEffect unmount cleanup running!");
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Date.now().toString(),
          ts: Date.now(),
          level: "warn",
          source: connectionSnapshot.name,
          message: "Session unmounted",
        }),
      }).catch(() => {});
      disposed = true;
      for (const c of cleanups) c();
    };
    // NOTE: themeId and terminalFontId are intentionally excluded — they are
    // handled by a separate effect that updates the terminal options without
    // tearing down the SSH connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, connectionSnapshot, reconnectKey]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleOpenPalette = () => {
      setPalettePos(null);
      setPaletteInitial("");
      trackFeatureUsed("bang_palette_opened", { placement: "default" });
      setPaletteOpen(true);
    };
    const handleOpenPaletteAtCursor = (e: Event) => {
      const customEvent = e as CustomEvent<{ top: number; left: number; query: string }>;
      setPalettePos({ top: customEvent.detail.top, left: customEvent.detail.left });
      setPaletteInitial(customEvent.detail.query);
      trackFeatureUsed("bang_palette_opened", { placement: "at_cursor" });
      setPaletteOpen(true);
    };
    window.addEventListener("tm:open-ai-bang", handleOpenPalette);
    window.addEventListener("tm:open-ai-bang-at-cursor", handleOpenPaletteAtCursor);
    return () => {
      window.removeEventListener("tm:open-ai-bang", handleOpenPalette);
      window.removeEventListener("tm:open-ai-bang-at-cursor", handleOpenPaletteAtCursor);
    };
  }, []);

  const handleSearch = (query: string, next = true) => {
    setSearchQuery(query);
    if (searchAddonRef.current) {
      if (next) {
        searchAddonRef.current.findNext(query);
      } else {
        searchAddonRef.current.findPrevious(query);
      }
    }
  };

  return (
    <div className="h-full w-full bg-bg p-2 relative group">
      <div ref={hostRef} className="h-full w-full" />

      {isClosed && (
        <button
          onClick={() => {
            setIsClosed(false);
            setReconnectKey((k) => k + 1);
          }}
          className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 text-fg-muted hover:text-fg underline transition-all font-mono text-xs underline-offset-2 cursor-pointer"
        >
          <ArrowsClockwise size={12} />
          Try reconnecting
        </button>
      )}

      {/* Search Bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 right-8 z-50 flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--popover-bg)] border border-[var(--border-strong)] shadow-2xl w-[280px]"
          >
            <MagnifyingGlass size={14} className="text-fg-muted" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Find in terminal..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.shiftKey) {
                    handleSearch(searchQuery, false);
                  } else {
                    handleSearch(searchQuery, true);
                  }
                } else if (e.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
              className="flex-1 bg-transparent border-none outline-none text-[12.5px] font-sans text-fg placeholder:text-fg-muted"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="w-6 h-6 grid place-items-center rounded-md hover:bg-[var(--menu-hover-bg)] text-fg-muted hover:text-fg transition-colors"
            >
              <X size={12} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {ghostText && paletteOpen && (
        <span
          className="absolute z-40 pointer-events-none text-fg-muted/60 font-mono flex items-center gap-2 whitespace-pre"
          style={{
            top: ghostText.top,
            left: ghostText.left,
            fontSize: "13px",
            lineHeight: 1.35,
          }}
        >
          {ghostText.text}
          <span className="inline-flex items-center justify-center rounded-[4px] border border-border/60 bg-bg-panel/80 px-1 py-[2px] text-[9px] font-sans font-bold uppercase tracking-widest text-fg-dim shadow-sm backdrop-blur-sm">
            Tab
          </span>
        </span>
      )}

      <AIBangPalette
        open={paletteOpen}
        conn={conn}
        history={history}
        terminalOutput={terminalOutput}
        onOpenChange={(v) => {
          setPaletteOpen(v);
          if (!v) setGhostText(null);
        }}
        position={palettePos}
        initialQuery={paletteInitial}
        onSelect={(text) => {
          if (commandBufferRef.current.startsWith("!")) {
            const backspaces = "\x7f".repeat(commandBufferRef.current.length);
            window.dispatchEvent(new CustomEvent("tm:terminal-input", { detail: backspaces + text }));
          } else {
            window.dispatchEvent(new CustomEvent("tm:terminal-input", { detail: text }));
          }
          setPaletteOpen(false);
          setGhostText(null);
        }}
      />
    </div>
  );
}
