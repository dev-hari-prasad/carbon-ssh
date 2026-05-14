import { useEffect, useState, useRef } from "react";
import { Command } from "cmdk";
import { BoltIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { useStore } from "@/lib/store";
import type { Bang } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (text: string) => void;
  position?: { top: number; left: number } | null;
  initialQuery?: string;
  conn: any;
  history: string[];
  terminalOutput: string[];
}

export function AIBangPalette({ open, onOpenChange, onSelect, position, initialQuery = "", conn, history, terminalOutput }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const bangs = useStore((s) => s.bangs);
  const ai = useStore((s) => s.ai);
  const aiEnabled = ai.autocompleteEnabled; // or isAIConfigured(ai)

  // Auto-complete suggestion placeholder logic
  // In a real implementation this would fetch from an AI endpoint
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ command: string; label: string; description: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const filteredBangs = bangs.filter(
    (b) =>
      b.trigger.toLowerCase().includes(query.replace(/^!/, "").toLowerCase()) ||
      b.description?.toLowerCase().includes(query.replace(/^!/, "").toLowerCase()) ||
      b.command.toLowerCase().includes(query.replace(/^!/, "").toLowerCase())
  );

  useEffect(() => {
    if (open && position && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - position.top;
      
      if (spaceBelow < rect.height + 40) {
        // Not enough space below, flip it up
        setAdjustedPosition({
          top: position.top - rect.height - 20,
          left: position.left
        });
      } else {
        setAdjustedPosition(position);
      }
    } else {
      setAdjustedPosition(position);
    }
  }, [open, position, aiSuggestions.length, filteredBangs.length]);

  useEffect(() => {
    if (!aiEnabled || query.length < 3) {
      setAiSuggestions([]);
      setIsLoading(false);
      return;
    }

    // Clear previous suggestions immediately if it's a new search
    setIsLoading(true);

    const timer = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const cleanQuery = query.startsWith("!") ? query.slice(1) : query;
        if (cleanQuery.length < 2) {
          setAiSuggestions([]);
          setIsLoading(false);
          return;
        }

        const res = await fetch("/api/ai/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: cleanQuery,
            settings: {
              provider: ai.provider,
              apiKey: ai.apiKey,
              baseUrl: ai.baseUrl,
              autocompleteModel: ai.autocompleteModel,
            },
            context: {
              username: conn.username,
              history: history,
              terminalOutput: terminalOutput,
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("AI failed");
        const data = await res.json();
        setAiSuggestions(data.suggestions || []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("AI error:", e);
          setAiSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => {
      clearTimeout(timer);
    };
  }, [query, aiEnabled, ai.provider, ai.apiKey, ai.baseUrl, ai.autocompleteModel]);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  useEffect(() => {
    const handleFocus = () => inputRef.current?.focus();
    const handleUpdateQuery = (e: Event) => setQuery((e as CustomEvent<string>).detail);
    window.addEventListener("tm:focus-ai-bang", handleFocus);
    window.addEventListener("tm:update-ai-bang-query", handleUpdateQuery);
    return () => {
      window.removeEventListener("tm:focus-ai-bang", handleFocus);
      window.removeEventListener("tm:update-ai-bang-query", handleUpdateQuery);
    };
  }, []);

  if (!open) return null;


  if (!open || (!aiEnabled && filteredBangs.length === 0 && query.length > 0)) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={`absolute z-50 w-[340px] rounded-md bg-[var(--menu-bg)]/60 backdrop-blur-xl border border-[var(--border-strong)] overflow-hidden flex flex-col font-sans ${
        !adjustedPosition ? "bottom-4 left-4" : ""
      }`}
      style={{
        ...(adjustedPosition
          ? {
              top: adjustedPosition.top + 8,
              left: Math.max(8, adjustedPosition.left - 10),
            }
          : {}),
        animation: "aiBangIn 160ms cubic-bezier(0.32, 0.72, 0, 1) both",
      }}
    >
      <Command
        className="flex flex-col w-full h-full"
        shouldFilter={false}
        loop
      >
        <div className="flex items-center px-2.5 py-2 border-b border-border/40">
          {isLoading ? (
            <div className="w-4 h-4 mr-2 shrink-0">
              <div className="w-full h-full border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : aiEnabled ? (
            <SparklesIcon className="w-4 h-4 text-accent shrink-0 mr-2" />
          ) : (
            <BoltIcon className="w-4 h-4 text-accent shrink-0 mr-2" />
          )}
          <Command.Input
            ref={inputRef}
            placeholder={aiEnabled ? "Ask AI or type !bang..." : "Type !bang..."}
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onOpenChange(false);
              }
            }}
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-fg placeholder:text-fg-muted font-medium w-full"
          />
        </div>

        <Command.List className="max-h-[220px] overflow-y-auto p-1 custom-scrollbar">

          {aiEnabled && query.length > 0 && (
            <Command.Group 
              heading={isLoading ? "Searching AI..." : aiSuggestions.length > 0 ? "AI Suggestions" : "Ask AI"} 
              className="px-1.5 py-1 text-[10px] uppercase font-bold text-fg-muted tracking-wider"
            >
              {aiSuggestions.map((suggestion, i) => (
                <Command.Item
                  key={`ai-${i}`}
                  value={suggestion.command}
                  onSelect={(v) => {
                    onSelect(v);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2.5 px-2 py-1.5 mt-0.5 rounded-sm text-fg cursor-pointer hover:bg-[var(--menu-hover-bg)] aria-selected:bg-[var(--command-active-bg)] aria-selected:text-fg transition-all group border border-transparent aria-selected:border-accent/10"
                >
                  <div className="flex items-center justify-between gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <SparklesIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                      <code className="shrink-0 text-[11px] font-mono font-normal bg-bg-panel/60 px-2.5 py-0.5 rounded-full border border-border/40 text-fg-muted group-aria-selected:border-white/20 transition-colors">
                        {suggestion.command}
                      </code>
                    </div>
                    <span className="text-[12px] font-sans font-normal text-fg-muted group-aria-selected:text-white/80 transition-colors truncate lowercase first-letter:capitalize text-right">
                      {suggestion.label}
                    </span>
                  </div>
                </Command.Item>
              ))}
              
              {!isLoading && aiSuggestions.length === 0 && (
                <Command.Item
                  value={query}
                  onSelect={(v) => {
                    // Just passthrough whatever they typed if they select this
                    onSelect(query.startsWith("!") ? query.slice(1) : query);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 mt-0.5 rounded-sm text-[12px] text-fg cursor-pointer hover:bg-[var(--menu-hover-bg)] aria-selected:bg-[var(--command-active-bg)] aria-selected:text-fg transition-colors"
                >
                  <SparklesIcon className="w-3.5 h-3.5 text-fg-dim shrink-0" />
                  <span className="truncate lowercase first-letter:capitalize">Ask AI: {query.startsWith("!") ? query.slice(1) : query}</span>
                </Command.Item>
              )}
            </Command.Group>
          )}

          {filteredBangs.length > 0 && (
            <Command.Group heading="Bangs" className="px-1.5 py-1 mt-1 text-[10px] uppercase font-bold text-fg-muted tracking-wider">
              {filteredBangs.map((bang) => (
                <Command.Item
                  key={bang.id}
                  value={`!${bang.trigger}`}
                  onSelect={() => {
                    onSelect(bang.command);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2.5 px-2 py-1.5 mt-0.5 rounded-sm text-fg cursor-pointer hover:bg-[var(--menu-hover-bg)] aria-selected:bg-[var(--command-active-bg)] aria-selected:text-fg transition-all group border border-transparent aria-selected:border-accent/10"
                >
                  <div className="flex items-center justify-between gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <BoltIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                      <code className="shrink-0 text-[11px] font-mono font-normal bg-bg-panel/60 px-2.5 py-0.5 rounded-full border border-border/40 text-fg-muted group-aria-selected:border-white/20 transition-colors lowercase first-letter:capitalize">
                        !{bang.trigger}
                      </code>
                    </div>
                    <span className="text-[12px] font-sans font-normal text-fg-muted group-aria-selected:text-white/80 transition-colors truncate text-right lowercase first-letter:capitalize">
                      {bang.description || bang.command}
                    </span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}
