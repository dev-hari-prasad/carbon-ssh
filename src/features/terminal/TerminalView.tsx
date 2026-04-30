import { useEffect, useRef } from "react";
import { getThemeById, terminalThemeForTheme } from "@/config/themes";
import type { Connection, Tab } from "@/lib/types";
import { actions, useStore } from "@/lib/store";

interface Props {
  tab: Tab;
  conn: Connection;
}

function clipLogLine(text: string, max = 160) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

type HandleOutcome = "ok" | "closed";

export function TerminalView({ tab, conn }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const themeId = useStore((s) => s.theme);

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
          '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
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

      const C = {
        dim: "\x1b[2m",
        reset: "\x1b[0m",
        bold: "\x1b[1m",
        blue: "\x1b[38;5;111m",
        green: "\x1b[38;5;114m",
        yellow: "\x1b[38;5;221m",
        red: "\x1b[38;5;203m",
      };
      const prompt = `${C.green}${conn.username}${C.reset}${C.dim}@${C.reset}${C.blue}${conn.host}${C.reset} ${C.dim}~${C.reset} ${C.bold}>${C.reset} `;

      term.writeln(`${C.dim}relay/ssh — local session shell${C.reset}`);
      term.writeln(
        `${C.dim}attempting ${conn.username}@${conn.host}:${conn.port}…${C.reset}`,
      );
      term.writeln(
        `${C.yellow}note:${C.reset} this build is a UI shell — no live SSH transport.`,
      );
      term.writeln(`${C.dim}type ${C.reset}help${C.dim} for available commands.${C.reset}`);
      term.write("\r\n" + prompt);
      actions.log("info", conn.name, `Session ${tab.title} ready (offline shell)`);

      let buffer = "";
      const writePrompt = () => term.write("\r\n" + prompt);

      /** Counts submissions (non-empty trimmed line). CRLF‑safe; logs commands to activity panel. */
      const handle = (cmd: string): HandleOutcome => {
        const c = cmd.trim();
        if (!c) return "ok";
        actions.incrementCommandCount(tab.id);
        const recap = `${tab.title}: ${clipLogLine(cmd)}`;

        const [name, ...args] = c.split(/\s+/);
        switch (name) {
          case "help":
            term.writeln(
              "available: help, whoami, hostname, date, echo, clear, exit",
            );
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
            actions.log("info", conn.name, `$ exit · ${recap}`);
            term.writeln(`${C.dim}connection closed.${C.reset}`);
            actions.closeTab(tab.id);
            return "closed";
          default:
            term.writeln(`${C.red}command not found:${C.reset} ${name}`);
            actions.log("warn", conn.name, `$ ${recap}`);
            return "ok";
        }

        actions.log("info", conn.name, `$ ${recap}`);
        return "ok";
      };

      const submitLine = () => {
        const line = buffer;
        buffer = "";
        term.write("\r\n");
        const outcome = handle(line);
        if (outcome === "closed" || disposed) return;
        term.write(prompt);
      };

      const dataSub = term.onData((data: string) => {
        for (let i = 0; i < data.length; i++) {
          const ch = data[i];
          const code = ch.charCodeAt(0);
          // Enter is often `\r`; some environments send `\n` or `\r\n` together.
          if (ch === "\r" || ch === "\n") {
            submitLine();
            if (ch === "\r" && data[i + 1] === "\n") i += 1;
            continue;
          }
          if (code === 127) {
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

      cleanups.push(() => {
        dataSub.dispose();
        ro.disconnect();
        term.dispose();
      });
    })();

    return () => {
      disposed = true;
      for (const c of cleanups) c();
    };
  }, [
    tab.id,
    conn.id,
    conn.name,
    conn.host,
    conn.username,
    conn.port,
    tab.title,
    themeId,
  ]);

  return (
    <div className="h-full w-full bg-bg p-2">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
