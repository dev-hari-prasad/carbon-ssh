import { useEffect, useMemo, useRef } from "react";
import { getThemeById, terminalThemeForTheme } from "@/config/themes";
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
  const themeId = useStore((s) => s.theme);
  const terminalFontId = useStore((s) => s.terminalFont);
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

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !hostRef.current) return;

      const term = new Terminal({
        fontFamily:
          'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.35,
        cursorBlink: true,
        cursorStyle: "bar",
        allowProposedApi: true,
        theme: terminalThemeForTheme(getThemeById(themeId)),
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
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
        send({
          type: "connect",
          data: {
            host: connectionSnapshot.host,
            port: connectionSnapshot.port,
            username: connectionSnapshot.username,
            password:
              connectionSnapshot.authType === "password"
                ? connectionSnapshot.password
                : undefined,
            privateKey:
              connectionSnapshot.authType === "key"
                ? connectionSnapshot.privateKey
                : undefined,
            passphrase:
              connectionSnapshot.authType === "key"
                ? connectionSnapshot.passphrase
                : undefined,
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
            term.writeln(`\r\nerror: ${message.message}`);
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
          event.data.text().then(handleMessagePayload).catch(() => undefined);
        }
      });

      socket.addEventListener("close", handleClosed);
      socket.addEventListener("error", () => {
        term.writeln("\r\nwebsocket error.");
        actions.log("error", connectionSnapshot.name, "WebSocket error");
      });

      const dataSub = term.onData((data: string) => {
        send({ type: "input", data });
      });

      const resizeSub = term.onResize(({ cols, rows }) => {
        send({ type: "resize", data: { cols, rows } });
      });

      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          /* noop */
        }
      });
      ro.observe(hostRef.current);

      cleanups.push(() => {
        dataSub.dispose();
        resizeSub.dispose();
        ro.disconnect();
        socket.close();
        term.dispose();
      });
    })();

    return () => {
      disposed = true;
      for (const c of cleanups) c();
    };
  }, [
    tab.id,
    tab.title,
    connectionSnapshot,
    themeId,
    terminalFontId,
  ]);

  return (
    <div className="h-full w-full bg-bg p-2">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
