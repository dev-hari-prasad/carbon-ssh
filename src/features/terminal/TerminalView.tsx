import { useEffect, useRef } from "react";
import xtermPkg from "@xterm/xterm";
import fitPkg from "@xterm/addon-fit";
const XTerm = xtermPkg.Terminal;
const FitAddon = fitPkg.FitAddon;
type XTerm = InstanceType<typeof XTerm>;
type FitAddon = InstanceType<typeof FitAddon>;
import type { Connection, Tab } from "@/lib/types";
import { actions } from "@/lib/store";

interface Props {
  tab: Tab;
  conn: Connection;
}

export function TerminalView({ tab, conn }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new XTerm({
      fontFamily:
        '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: "bar",
      allowProposedApi: true,
      theme: {
        background: "#1a1a1d",
        foreground: "#f0f0f2",
        cursor: "#7c8cff",
        cursorAccent: "#1a1a1d",
        selectionBackground: "#3a3f6b",
        black: "#1a1a1d",
        red: "#ff6b6b",
        green: "#7ee787",
        yellow: "#f2cc60",
        blue: "#7c8cff",
        magenta: "#c792ea",
        cyan: "#56d4dd",
        white: "#d0d0d4",
        brightBlack: "#52525b",
        brightRed: "#ff8585",
        brightGreen: "#a3f7b5",
        brightYellow: "#ffe28a",
        brightBlue: "#a5b4ff",
        brightMagenta: "#dcb4ff",
        brightCyan: "#82e9f0",
        brightWhite: "#ffffff",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    termRef.current = term;
    fitRef.current = fit;

    requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        /* noop */
      }
    });

    // Banner + simulated local shell (UI shell only — no real SSH transport)
    const C = {
      dim: "\x1b[2m",
      reset: "\x1b[0m",
      bold: "\x1b[1m",
      blue: "\x1b[38;5;111m",
      green: "\x1b[38;5;114m",
      yellow: "\x1b[38;5;221m",
      red: "\x1b[38;5;203m",
    };
    const prompt = `${C.green}${conn.username}${C.reset}${C.dim}@${C.reset}${C.blue}${conn.host}${C.reset} ${C.dim}~${C.reset} ${C.bold}$${C.reset} `;

    term.writeln(`${C.dim}relay/ssh — local session shell${C.reset}`);
    term.writeln(
      `${C.dim}attempting ${conn.username}@${conn.host}:${conn.port}…${C.reset}`,
    );
    term.writeln(
      `${C.yellow}note:${C.reset} this build is a UI shell — no live SSH transport.`,
    );
    term.writeln(`${C.dim}type ${C.reset}help${C.dim} for available commands.${C.reset}`);
    term.write("\r\n" + prompt);
    actions.log("info", "session", `Session ${tab.title} ready (offline shell)`);

    let buffer = "";
    const writePrompt = () => term.write("\r\n" + prompt);

    const handle = (cmd: string) => {
      const c = cmd.trim();
      if (!c) return;
      const [name, ...args] = c.split(/\s+/);
      switch (name) {
        case "help":
          term.writeln("available: help, whoami, hostname, date, echo, clear, exit");
          break;
        case "whoami":
          term.writeln(conn.username);
          break;
        case "hostname":
          term.writeln(conn.host);
          break;
        case "date":
          term.writeln(new Date().toString());
          break;
        case "echo":
          term.writeln(args.join(" "));
          break;
        case "clear":
          term.clear();
          break;
        case "exit":
          term.writeln(`${C.dim}connection closed.${C.reset}`);
          actions.closeTab(tab.id);
          return;
        default:
          term.writeln(`${C.red}command not found:${C.reset} ${name}`);
      }
    };

    const dataSub = term.onData((data) => {
      for (const ch of data) {
        const code = ch.charCodeAt(0);
        if (ch === "\r") {
          term.write("\r\n");
          handle(buffer);
          buffer = "";
          term.write(prompt);
        } else if (code === 127) {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            term.write("\b \b");
          }
        } else if (code === 3) {
          term.write("^C");
          buffer = "";
          writePrompt();
        } else if (code >= 32) {
          buffer += ch;
          term.write(ch);
        }
      }
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        /* noop */
      }
    });
    ro.observe(hostRef.current);

    return () => {
      dataSub.dispose();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [tab.id, conn.id, conn.host, conn.username, conn.port, tab.title]);

  return (
    <div className="h-full w-full bg-[#1a1a1d] p-2">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
