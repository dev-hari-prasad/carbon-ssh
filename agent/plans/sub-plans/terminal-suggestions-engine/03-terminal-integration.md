# Terminal Integration

## Goal

Extract the command buffer logic from `TerminalView.tsx` into a reusable hook, wire the suggestion engine into the terminal, and generalize ghost text rendering so suggestions appear during normal typing — not just when the palette is open.

## Architectural Analysis

### Why This Is The Highest-Risk Sub-Plan

This sub-plan modifies the most sensitive file in the product: `TerminalView.tsx`. This is a 960-line component that owns:

- The xterm.js terminal instance
- All keyboard input handling (including custom key event handler with 200+ lines of key combos)
- WebSocket SSH I/O
- Command buffer tracking
- Ghost text rendering
- Palette lifecycle

Any regression here breaks the terminal — which is the entire product. Every change must preserve existing behavior exactly while adding new capabilities.

### System Implications

1. **Command buffer extraction creates a seam.** The current command buffer is a local `let` variable inside a `useEffect` closure. Extracting it to a hook means the buffer state must either be:
   - A ref (non-reactive, requires manual notification) — better for performance
   - A state variable (reactive, causes re-renders) — simpler but potentially expensive
   
   **Recommendation:** Use a ref internally but expose a notification callback that the suggestion engine can subscribe to. This avoids re-rendering the entire terminal component on every keystroke.

2. **Ghost text must work without the palette.** Currently, ghost text visibility is gated on `ghostText && paletteOpen` (line 916). Suggestion ghost text should appear during normal typing (palette closed). This requires splitting ghost text into two concepts:
   - **Bang ghost text:** shown when palette is open and buffer starts with `!`
   - **Suggestion ghost text:** shown during normal typing when engine returns a high-confidence result
   
   Both share the same rendering mechanism but have different lifecycles.

3. **Terminal output capture must become always-on.** Currently, output capture only happens when the palette is open (line 722: `if (!paletteOpenRef.current) return;` inside the output capture logic). The suggestion engine needs output context during normal typing. Change: make output capture always active but keep it throttled (250ms) and bounded (20 lines, 2000 chars/line).

4. **Tab key handling gains a third mode.** Current Tab behavior:
   - Palette open + ghost text visible → accept ghost text (line 623-636)
   - Palette open + no ghost text → standard Tab (pass through)
   - Palette closed → standard Tab (shell completion)
   
   New mode needed:
   - Palette closed + suggestion ghost text visible → accept suggestion ghost text
   - Palette closed + no suggestion ghost text → standard Tab (shell completion)

### Hidden Complexity

1. **The `onData` callback is recreated per-effect.** The `useEffect` at line ~280 creates the entire terminal lifecycle. The `onData` handler is registered once. If the suggestion hook needs to react to keystrokes, it must either:
   - Subscribe to `commandBufferRef` changes via a callback
   - Be called from within the existing `onData` handler
   - Listen to a custom event
   
   The cleanest approach is to have the hook return a `notify(buffer: string)` function that the existing `onData` handler calls after updating the buffer.

2. **Ghost text positioning uses internal xterm APIs.** Lines 733-736 access `term._core._renderService.dimensions` for pixel-accurate cell sizing. This is a private API that can break between xterm versions. The extraction should centralize this into a helper function.

3. **The component uses a mix of state and refs for performance.** `commandBufferRef`, `ghostTextRef`, `paletteOpenRef`, and `bangsRef` are all stable refs that avoid re-renders. Suggestion state must follow the same pattern where possible.

4. **`tm:terminal-input` custom event is the injection mechanism.** When a user accepts a suggestion, the accepted command text must be sent to the terminal via this event. The existing handler (line ~445) writes the text to the WebSocket. The suggestion acceptance must follow the same path.

### Implementation Traps

- **Don't add a new `useEffect` that duplicates terminal output tracking.** Extend the existing output capture, don't create a parallel one.
- **Don't call `setSuggestions()` on every keystroke.** This would re-render the component 10+ times per second. Use a ref + debounced callback.
- **Don't break the `!` trigger.** The existing `!` key handler (line 642) dispatches `tm:open-ai-bang-at-cursor`. Suggestion ghost text must not appear when the user is typing a bang command.
- **Don't show suggestion ghost text for buffers < 2 characters.** This would clutter the UI with noise on every keystroke.
- **Don't forget the cleanup.** The plan requires clearing all suggestion context on: session close, React unmount, WebSocket close/error, user reconnect, and user disabling suggestions.

## Dependencies

- `01-core-engine.md` — Engine API (`createSuggestionEngine`, `query`, `buildSuggestionContext`)
- `02-suggestion-packs.md` — At least one pack (e.g., `linux.json`) must exist for testing

## Risks

- **Risk: Ghost text during normal typing feels intrusive.** Mitigation: Only show for high-confidence suggestions (score > 0.7). Add a 150ms debounce before rendering ghost text. Only show ghost text for `read` risk commands in MVP.
- **Risk: Tab key conflict with shell completion.** Mitigation: Only intercept Tab when `suggestionGhostText !== null`. When no suggestion ghost text is visible, pass Tab through to the shell completely.
- **Risk: Output capture perf regression.** Mitigation: Keep the existing 250ms throttle. Only read lines from the visible buffer area. Skip capture when buffer hasn't changed.
- **Risk: Regression in existing terminal behavior.** Mitigation: Run all existing manual QA scenarios after integration. The hook extraction should be a pure refactor — no behavior changes.

## Epics

### Epic: Command Buffer Hook Extraction

#### Tasks

- [ ] Create `src/features/terminal/useTerminalCommandBuffer.ts`
  - [ ] Define the hook interface:
    ```ts
    interface UseTerminalCommandBufferOptions {
      onCommandExecuted?: (command: string) => void;
      onBufferChanged?: (buffer: string) => void;
    }

    interface UseTerminalCommandBufferReturn {
      bufferRef: React.MutableRefObject<string>;
      history: string[];
      handleData: (data: string, send: (msg: any) => void) => void;
      resetBuffer: () => void;
    }
    ```
  - [ ] Move command buffer tracking logic from `TerminalView.tsx` `onData` handler (lines 692-720):
    - Enter (`\r`): trim buffer, call `onCommandExecuted`, add to history (max 10), reset buffer
    - Backspace (`\x7f`, `\b`): remove last char
    - Ctrl+C (`\x03`), Ctrl+U (`\x15`): clear buffer
    - Control chars (< 0x20 except Tab): ignore for buffer (don't append)
    - Printable chars: append to buffer
    - After every change: call `onBufferChanged` if provided
  - [ ] Keep `history` as React state (it drives re-renders for the palette)
  - [ ] Keep `bufferRef` as a ref (non-reactive, performance-critical)
  - [ ] **Must preserve exact existing behavior** — this is a pure extraction, no new logic yet

- [ ] Update `TerminalView.tsx` to use the new hook
  - [ ] Replace inline command buffer logic with `useTerminalCommandBuffer`
  - [ ] Wire `handleData` into the existing `term.onData` callback
  - [ ] Wire `onCommandExecuted` to existing `incrementCommandCount` and activity logging
  - [ ] Verify: `commandBufferRef.current` still reflects real-time buffer state
  - [ ] Verify: `history` still passed to `AIBangPalette` as before
  - [ ] Verify: `commandCount` still increments on Enter

#### Acceptance Criteria

- Terminal input works exactly as before (type, backspace, Enter, Ctrl+C, Ctrl+U)
- Command history populates correctly (last 10 commands)
- Command count increments on Enter
- Activity logging still fires on command execution
- No visual or behavioral regression
- The extracted hook is independently testable

#### Rollback Plan

- Inline the hook logic back into `TerminalView.tsx` — it's a pure refactor reversal

---

### Epic: Terminal Output Capture (Always-On)

#### Tasks

- [ ] Modify the terminal output capture logic in `TerminalView.tsx`
  - [ ] Remove the `if (!paletteOpenRef.current) return;` guard from terminal output capture (line ~722 area)
  - [ ] Keep the existing throttle (250ms via `terminalOutputUpdateAtRef`)
  - [ ] Keep the existing line limit (~20 lines from cursor backward)
  - [ ] Add line length cap: skip lines > 2000 characters
  - [ ] Add binary/control detection: skip lines where > 30% characters are non-printable
  - [ ] Store output in state (already done as `terminalOutput` state variable)
  - [ ] **Important:** Only capture when the buffer has content (> 0 chars) to avoid wasting CPU during idle terminal

#### Acceptance Criteria

- Terminal output is captured during normal typing, not just when palette is open
- Capture remains throttled at 250ms
- Lines > 2000 chars are excluded
- Binary/control-heavy lines are excluded
- No measurable typing latency increase (< 1ms per capture)
- Output is cleared on session close/unmount

#### Rollback Plan

- Re-add the `paletteOpenRef.current` guard to restore original behavior

---

### Epic: Suggestion Engine Wiring Hook

#### Tasks

- [ ] Create `src/features/terminal/useTerminalSuggestions.ts`
  - [ ] Define the hook interface:
    ```ts
    interface UseTerminalSuggestionsOptions {
      buffer: string;           // from bufferRef.current (via onBufferChanged)
      history: string[];
      terminalOutput: string[];
      conn: Connection;
      enabled?: boolean;        // default true
    }

    interface UseTerminalSuggestionsReturn {
      suggestions: RankedSuggestion[];
      topSuggestion: RankedSuggestion | null;   // for ghost text
      isActive: boolean;                         // engine loaded and has results
      dispose: () => void;
    }
    ```
  - [ ] Initialize `SuggestionEngine` with `BUNDLED_PACKS` on first mount (lazy, once)
    - Use a module-level singleton for the engine instance (shared across tabs)
    - Load packs only once — the index is pack-dependent, not session-dependent
  - [ ] On buffer change (via `onBufferChanged` callback):
    - Skip if buffer is empty, whitespace-only, < 2 chars, or starts with `!` (bang mode)
    - Skip if buffer matches secret patterns
    - Build `SuggestionContext` from current state
    - Call `engine.query(context)` — this is synchronous and fast (< 10ms target)
    - Debounce the result update at 100ms to avoid flickering
    - Cancel stale debounced updates when buffer changes again
  - [ ] Set `topSuggestion` to the first result only if:
    - Score > 0.6 (configurable threshold)
    - Risk is `read` or `network` (don't ghost-text `write` or `destructive` commands)
    - The suggestion extends the current buffer (prefix match — it would be confusing to ghost-text something unrelated)
  - [ ] `dispose()` clears all local state (suggestions, debounce timers, abort controllers)
  - [ ] Wire cleanup to: component unmount, WebSocket close/error, session close, reconnect

- [ ] Wire the hook into `TerminalView.tsx`
  - [ ] Add `onBufferChanged` callback that feeds buffer to the suggestion hook
  - [ ] Store `suggestions` and `topSuggestion` for use in rendering and key handling

#### Acceptance Criteria

- Suggestions appear within 150ms of typing (debounce + engine time)
- Suggestions update on every keystroke (debounced)
- Suggestions clear when buffer is empty
- Suggestions don't appear for bang commands (buffer starts with `!`)
- Suggestions don't appear for secret-like buffers
- Engine loads packs only once (shared singleton)
- All suggestion state is cleared on session lifecycle events

#### Rollback Plan

- Remove the `useTerminalSuggestions` hook call from `TerminalView.tsx`
- Suggestion ghost text and palette integration stop appearing
- No other behavior is affected

---

### Epic: Ghost Text Generalization

#### Tasks

- [ ] Modify ghost text rendering in `TerminalView.tsx`
  - [ ] Rename `ghostText` state to support both sources:
    ```ts
    // Option A: Single ghost text with source tracking
    const [ghostText, setGhostText] = useState<{
      text: string;
      top: number;
      left: number;
      command: string;
      source: "bang" | "suggestion";
    } | null>(null);
    ```
  - [ ] Update ghost text visibility condition (line 916):
    - Old: `ghostText && paletteOpen`
    - New: `ghostText && (paletteOpen || ghostText.source === "suggestion")`
  - [ ] When `topSuggestion` changes (from the suggestion hook):
    - If `topSuggestion` is not null AND palette is NOT open AND buffer length >= 2:
      - Calculate ghost text position using existing cell dimension math
      - The ghost text should show only the **completion suffix** — the part of the command after the current buffer. E.g., if buffer is `sys` and suggestion is `systemctl status`, ghost text shows `temctl status`.
      - Set ghost text with `source: "suggestion"`
    - If `topSuggestion` is null or buffer is empty: clear suggestion ghost text (but don't clear bang ghost text if palette is open)
  - [ ] When palette opens: clear suggestion ghost text (bang ghost text takes priority)
  - [ ] When palette closes: suggestion ghost text can reappear if `topSuggestion` is still valid

- [ ] Update ghost text rendering (line 916-931)
  - [ ] For `source: "suggestion"`: show the ghost text with the same semi-transparent style
  - [ ] Keep the "Tab" badge for both sources (Tab accepts in both modes)
  - [ ] Consider adding a subtle source indicator (e.g., different opacity for suggestion vs bang ghost text) — optional for MVP

#### Acceptance Criteria

- Bang ghost text still works exactly as before when palette is open
- Suggestion ghost text appears during normal typing for high-confidence results
- Suggestion ghost text shows only the completion suffix (not the full command)
- Suggestion ghost text disappears when palette opens
- Suggestion ghost text disappears when buffer is cleared
- Ghost text position is pixel-accurate using xterm cell dimensions
- No visual jitter — debounced rendering prevents flickering

#### Rollback Plan

- Revert ghost text condition to `ghostText && paletteOpen`
- Suggestion ghost text stops appearing but everything else works

---

### Epic: Tab Key Acceptance for Suggestions

#### Tasks

- [ ] Extend `attachCustomKeyEventHandler` in `TerminalView.tsx`
  - [ ] Add a new Tab handler **before** the existing palette Tab handler:
    ```
    if Tab pressed AND palette is NOT open AND suggestionGhostText is visible:
      1. Compute backspace count to erase current buffer
      2. Send backspaces to clear buffer from terminal
      3. Send the full suggestion command text via WebSocket
      4. Clear suggestion ghost text
      5. Reset command buffer
      6. return false (prevent xterm from processing Tab)
    ```
  - [ ] **Critical: When no suggestion ghost text is visible and palette is NOT open, Tab MUST pass through to the shell.** This preserves shell tab completion.
  - [ ] The existing palette Tab handler (line 623-636) must remain unchanged and take priority when palette is open

#### Acceptance Criteria

- Tab accepts suggestion ghost text when visible (palette closed)
- Tab passes through to shell when no ghost text is visible (palette closed)
- Tab accepts bang ghost text when palette is open (existing behavior unchanged)
- Shell tab completion (file paths, command names) works normally when no suggestions are showing
- No double-insertion or buffer corruption

#### Testing Requirements

- Manual test: type `sys`, see ghost text, press Tab → `systemctl status` is inserted
- Manual test: type `ls /et`, press Tab → shell completes to `/etc/` (no suggestion interference)
- Manual test: type `!ban`, see palette + bang ghost, press Tab → bang command accepted (existing behavior)

#### Rollback Plan

- Remove the new Tab handler block
- Tab reverts to palette-only + shell-passthrough behavior

---

### Epic: Cleanup and Lifecycle Management

#### Tasks

- [ ] Ensure all suggestion state is cleared at these points in `TerminalView.tsx`:
  - [ ] Terminal session closed (`isClosed` state becomes true)
  - [ ] React component unmounts (cleanup in `useEffect` return)
  - [ ] WebSocket closes or errors (`ws.onclose`, `ws.onerror`)
  - [ ] User reconnects (`reconnectKey` changes)
  - [ ] User disables suggestions (future setting toggle)

- [ ] Verify no memory leaks:
  - [ ] Debounce timers are cancelled on cleanup
  - [ ] AbortControllers (for future AI fallback) are aborted on cleanup
  - [ ] Engine singleton is NOT disposed on tab close (shared across tabs) — only cleared of session-specific caches

- [ ] Verify no data leaks:
  - [ ] `commandBufferRef` is reset to empty string on cleanup
  - [ ] `terminalOutput` is cleared on cleanup
  - [ ] Suggestion cache is invalidated on cleanup
  - [ ] No raw buffer text appears in console logs

#### Acceptance Criteria

- Opening and closing 10 terminal tabs in sequence does not increase memory usage
- Reconnecting a session clears all prior suggestion context
- Component unmount disposes all timers and callbacks
- `console.log` audit shows no raw buffer or terminal output text

#### Testing Requirements

- Manual test: open tab, type commands, close tab, check memory (browser DevTools)
- Manual test: reconnect session, verify old suggestions don't reappear
