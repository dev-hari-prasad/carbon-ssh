import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getThemeById, terminalThemeForTheme } from "@/config/themes";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import type { Connection, Tab } from "@/lib/types";
import { actions, useStore } from "@/lib/store";

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
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAddonRef = useRef<any>(null);
  const themeId = useStore((s) => s.theme);
  const terminalFontId = useStore((s) => s.terminalFont);

  // Keep theme/font in refs so the main effect doesn't re-run on store hydration
  const themeRef = useRef(themeId);
  themeRef.current = themeId;
  const terminalFontRef = useRef(terminalFontId);
  terminalFontRef.current = terminalFontId;

  // Ref to hold the xterm Terminal instance so the theme/font effect can update it
  const termInstanceRef = useRef<import("@xterm/xterm").Terminal | null>(null);

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
    [conn.id],
  );

  // Separate effect: update terminal theme/font WITHOUT killing the connection
  useEffect(() => {
    const term = termInstanceRef.current;
    if (!term) return;
    term.options.theme = terminalThemeForTheme(getThemeById(themeId));
    term.options.fontFamily = "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
  }, [themeId, terminalFontId]);

  // Main connection effect — only depends on tab.id and connectionSnapshot
  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      const [{ Terminal }, { FitAddon }, { SearchAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-search"),
      ]);
      if (disposed || !hostRef.current) return;

      const term = new Terminal({
        fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        lineHeight: 1.35,
        cursorBlink: true,
        cursorStyle: "bar",
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

      term.writeln("relay/ssh — live session shell");
      term.writeln(
        `connecting to ${connectionSnapshot.username}@${connectionSnapshot.host}:${connectionSnapshot.port}…`,
      );
      actions.log(
        "info",
        connectionSnapshot.name,
        `Connecting to ${connectionSnapshot.username}@${connectionSnapshot.host}`,
      );

      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          /* noop */
        }
      });
      ro.observe(hostRef.current);

      // Connect WebSocket
      if (disposed) return;

      const socket = new WebSocket(buildWebSocketUrl());
      let closed = false;

      const send = (message: ClientMessage) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      };

      const handleClosed = () => {
        if (closed) return;
        closed = true;
        term.writeln("\r\nconnection closed.");
        actions.log("info", connectionSnapshot.name, `Session ${tab.title} closed`);
      };

      socket.addEventListener("open", () => {
        if (disposed) {
          socket.close();
          return;
        }
        send({
          type: "connect",
          data: {
            host: connectionSnapshot.host,
            port: connectionSnapshot.port,
            username: connectionSnapshot.username,
            password:
              connectionSnapshot.authType === "password" ? connectionSnapshot.password : undefined,
            privateKey:
              connectionSnapshot.authType === "key" ? connectionSnapshot.privateKey : undefined,
            passphrase:
              connectionSnapshot.authType === "key" ? connectionSnapshot.passphrase : undefined,
            cols: term.cols,
            rows: term.rows,
          },
        });
      });

      const handleMessagePayload = (payload: string) => {
        const message = parseServerMessage(payload);
        if (!message) return;
        switch (message.type) {
          case "data":
            term.write(message.data);
            break;
          case "connected":
            term.writeln("connected.");
            actions.log("info", connectionSnapshot.name, `Session ${tab.title} connected`);
            break;
          case "closed":
            handleClosed();
            break;
          case "error":
            term.writeln(`\r\n\x1b[31merror: ${message.message}\x1b[0m`);
            actions.log("error", connectionSnapshot.name, message.message);
            break;
        }
      };

      socket.addEventListener("message", (event) => {
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

      socket.addEventListener("close", () => {
        handleClosed();
      });
      socket.addEventListener("error", () => {
        term.writeln("\r\nwebsocket error.");
        actions.log("error", connectionSnapshot.name, "WebSocket error");
      });

      term.attachCustomKeyEventHandler((e) => {
        const isMac =
          typeof window !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform);
        const mod = isMac ? e.metaKey : e.ctrlKey;
        const shift = e.shiftKey;

        // Mod + C: Copy (if selection exists)
        if (mod && e.key.toLowerCase() === "c") {
          const selection = term.getSelection();
          if (selection) {
            if (e.type === "keydown") {
              navigator.clipboard.writeText(selection);
            }
            return false; // Prevent sending SIGINT if we're copying
          }
          return true; // No selection? Let it send SIGINT
        }

        // Mod + V: Paste
        if (mod && e.key.toLowerCase() === "v") {
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
            setSearchOpen((prev) => !prev);
          }
          return false;
        }

        return true;
      });

      const dataSub = term.onData((data: string) => {
        send({ type: "input", data });
      });

      const resizeSub = term.onResize(({ cols, rows }) => {
        send({ type: "resize", data: { cols, rows } });
      });

      cleanups.push(() => {
        dataSub.dispose();
        resizeSub.dispose();
        ro.disconnect();
        socket.close();
        term.dispose();
        termInstanceRef.current = null;
      });
    })();

    return () => {
      disposed = true;
      for (const c of cleanups) c();
    };
    // NOTE: themeId and terminalFontId are intentionally excluded — they are
    // handled by a separate effect that updates the terminal options without
    // tearing down the SSH connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, connectionSnapshot]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [searchOpen]);

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

      {/* Search Bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 right-8 z-50 flex items-center gap-2 px-2 py-1.5 rounded-[10px] bg-[var(--popover-bg)] border border-[var(--border-strong)] shadow-2xl w-[280px]"
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
    </div>
  );
}
