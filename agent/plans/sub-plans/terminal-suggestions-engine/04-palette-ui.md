# Palette UI — Deterministic Suggestions

## Goal

Add a deterministic suggestions group to the existing `AIBangPalette.tsx` component so users see locally-ranked command suggestions alongside AI suggestions and bang shortcuts. The suggestions must render with risk-aware styling, support keyboard navigation, and not interfere with existing palette behavior.

## Architectural Analysis

### Why Extend Rather Than Replace

The plan wisely recommends against renaming `AIBangPalette.tsx` in the first implementation. The component already solves:

- Floating palette positioning with viewport-flip logic (lines 49-67)
- Keyboard navigation via `cmdk` library with loop mode
- Query syncing from terminal buffer via `tm:update-ai-bang-query` event
- Command injection back to terminal via `onSelect` callback
- AI request lifecycle (loading, abort, debounce)

Adding a third `Command.Group` for deterministic suggestions is the lowest-risk approach. The `cmdk` library handles all keyboard navigation, item focus, and selection automatically.

### System Implications

1. **Deterministic suggestions show immediately; AI suggestions load asynchronously.** The palette must not wait for AI to show deterministic results. This means the deterministic group renders first, and the AI group appears below it when results arrive.
2. **The palette's current rendering gate must change.** Currently (line ~285), the component returns `null` if `!aiEnabled && filteredBangs.length === 0 && query.length > 0`. With deterministic suggestions, the palette should stay visible whenever there are deterministic suggestions, even if AI is disabled and no bangs match.
3. **Risk-aware styling is a new visual concept.** The existing palette items are uniform (SparklesIcon for AI, BoltIcon for bangs). Deterministic suggestions need risk-level indicators without being visually noisy.

### Hidden Complexity

1. **Group ordering matters for keyboard navigation.** If deterministic suggestions are the first group, pressing ArrowDown immediately moves to the first suggestion. If they're the last group, the user navigates past AI and bangs first. **Deterministic should be first** — they're the fastest and most reliable.
2. **The `shouldFilter={false}` flag is critical.** The `cmdk` component has built-in filtering, but it's disabled. All filtering is manual. Deterministic suggestions come pre-filtered from the engine — they must NOT be filtered again by `cmdk`.
3. **Empty state handling.** When the engine returns 0 suggestions, the deterministic group should not render at all. When the engine returns suggestions but the user keeps typing and they become irrelevant, the group should disappear cleanly.

### Implementation Traps

- **Don't add a separate fetch/async layer for deterministic suggestions.** They come synchronously from the engine via props — no loading state needed.
- **Don't duplicate the command injection mechanism.** Use the same `onSelect` callback that bangs and AI suggestions use.
- **Don't add new state for selected suggestion index.** `cmdk` handles this internally.
- **Don't render risk badges that are bigger than the command text.** Keep risk indicators subtle — a small colored dot or icon, not a banner.

## Dependencies

- `01-core-engine.md` — `RankedSuggestion` type definition
- `03-terminal-integration.md` — `useTerminalSuggestions` hook that provides the `suggestions` array

## Risks

- **Risk: Too many groups makes the palette feel cluttered.** Mitigation: Show at most 5 deterministic suggestions in the palette. Use a "Show more" affordance only if needed later.
- **Risk: Deterministic suggestions look identical to AI suggestions.** Mitigation: Use distinct icons — a terminal/command-line icon for deterministic, SparklesIcon for AI (existing).
- **Risk: Risk colors clash with the existing palette theme.** Mitigation: Use subtle left-border coloring or small dot indicators, not full-row backgrounds.

## Epics

### Epic: Props and Types

#### Tasks

- [ ] Add deterministic suggestion props to `AIBangPalette.tsx`
  ```ts
  interface Props {
    // ... existing props ...
    deterministicSuggestions?: RankedSuggestion[];  // from engine
  }
  ```
- [ ] Import `RankedSuggestion` type from `@/features/suggestions`
- [ ] Update the component signature to accept the new prop
- [ ] Update `TerminalView.tsx` to pass `suggestions` from `useTerminalSuggestions` to `AIBangPalette`

#### Acceptance Criteria

- Prop is optional with a sensible default (empty array or undefined)
- Type is correctly imported from the suggestions feature
- No runtime errors when prop is undefined (backward compatible)

---

### Epic: Deterministic Suggestions Group

#### Tasks

- [ ] Add a new `Command.Group` before the existing AI Suggestions group
  - [ ] Heading: "Suggestions" (when results exist)
  - [ ] Render only when `deterministicSuggestions` has items
  - [ ] Map each `RankedSuggestion` to a `Command.Item`:
    ```tsx
    <Command.Item
      key={suggestion.id}
      value={suggestion.id}
      onSelect={() => {
        props.onSelect(suggestion.insertText || suggestion.command);
        props.onOpenChange(false);
      }}
    >
      <TerminalSquareIcon className="..." />  {/* or CommandLineIcon */}
      <span className="...">
        <code>{suggestion.command}</code>
      </span>
      <span className="...">
        {suggestion.label}
      </span>
      {suggestion.risk !== "read" && (
        <RiskIndicator risk={suggestion.risk} />
      )}
    </Command.Item>
    ```
  - [ ] Limit displayed suggestions to 5 items (even if engine returns up to 8 — palette space is limited)
  - [ ] Ensure `value` prop uses `suggestion.id` for unique keying

- [ ] Add risk indicator component (inline or small helper):
  ```tsx
  function RiskIndicator({ risk }: { risk: SuggestionRisk }) {
    const styles = {
      write: { color: "var(--yellow-500)", label: "write" },
      destructive: { color: "var(--red-500)", label: "destructive" },
      network: { color: "var(--blue-500)", label: "network" },
    };
    const style = styles[risk];
    if (!style) return null;
    return (
      <span className="..." style={{ color: style.color }} title={style.label}>
        ●
      </span>
    );
  }
  ```

- [ ] For `destructive` risk suggestions, add a visual warning:
  - Subtle red-tinted left border or dimmed text
  - Description should be visible (not truncated) to warn about impact
  - Do NOT hide destructive suggestions from the palette — just make the risk visually clear

#### Acceptance Criteria

- Deterministic suggestions appear above AI suggestions in the palette
- Each suggestion shows: icon, command (monospace), label (right-aligned), risk indicator
- Risk indicators use color-coding: yellow for write, red for destructive, blue for network
- At most 5 suggestions display in the palette
- Selecting a suggestion inserts the command into the terminal
- Keyboard navigation (ArrowUp/Down) works across all groups seamlessly
- Empty suggestions group doesn't render (no empty "Suggestions" heading)

#### Rollback Plan

- Remove the new `Command.Group` block
- Remove the prop from the interface
- Palette reverts to AI + Bangs only

---

### Epic: Rendering Gate Update

#### Tasks

- [ ] Update the component's early return condition
  - Old (line ~285): `if (!open) return null;` and later `if (!aiEnabled && filteredBangs.length === 0 && query.length > 0) return null;`
  - New: The palette should render whenever ANY of these are true:
    - `deterministicSuggestions?.length > 0`
    - `aiEnabled && query.length > 0`
    - `filteredBangs.length > 0`
  - If NONE are true and `query.length > 0`, return `null` (nothing to show)
  - If `!open`, still return `null` (palette is explicitly closed)

#### Acceptance Criteria

- Palette shows when deterministic suggestions exist, even if AI is disabled and no bangs match
- Palette hides when there's nothing to show (no suggestions, no AI, no bangs)
- Existing behavior preserved: palette still shows for AI-only and bang-only scenarios

---

### Epic: Position Adjustment Update

#### Tasks

- [ ] Update the viewport-flip calculation (lines 49-67) to account for the new suggestion group
  - The current height estimation uses `aiSuggestions.length` and `filteredBangs.length`
  - Add `deterministicSuggestions?.length ?? 0` to the height calculation
  - Each suggestion item is approximately the same height as existing items

#### Acceptance Criteria

- Palette correctly flips above cursor when near the bottom of the viewport
- Height calculation accounts for all three groups (suggestions + AI + bangs)
- No visual clipping when all three groups are populated

---

### Epic: Loading State Separation

#### Tasks

- [ ] Ensure deterministic suggestions and AI suggestions have independent loading states
  - Deterministic suggestions are synchronous — they never show a loading indicator
  - AI suggestions continue to show "Searching AI..." while loading
  - When deterministic suggestions are present but AI is still loading, the palette should show deterministic results immediately with the AI group showing its own loading state below

#### Acceptance Criteria

- Deterministic suggestions appear instantly (no loading delay)
- AI loading state only appears in the AI group heading
- User can select a deterministic suggestion while AI is still loading
- Dismissing the palette cancels AI requests (existing behavior preserved)

---

### Epic: Source Badges (Optional MVP)

#### Tasks

- [ ] Add subtle source indicators to distinguish suggestion origins
  - Deterministic suggestions: terminal icon (e.g., `TerminalSquareIcon` from lucide-react or similar)
  - AI suggestions: keep existing `SparklesIcon`
  - Bangs: keep existing `BoltIcon`
- [ ] If the existing icon set doesn't include a good terminal/command icon, use a simple `>_` text badge instead

#### Acceptance Criteria

- Each suggestion source has a visually distinct icon
- Icons are consistent in size and alignment
- Users can quickly distinguish local suggestions from AI suggestions

#### Testing Requirements

- Visual inspection: all three groups visible simultaneously with distinct icons
- Keyboard navigation: Arrow keys cycle through all groups
- Selection: clicking or pressing Enter on any item inserts the command
- Empty state: only populated groups render
