# Terminal Suggestions Engine — Sub-Plan Overview

> **Parent plan:** `agent/plans/terminal-suggestions-engine.md`  
> **Generated:** 2025-05-25  
> **Status:** Execution-ready sub-plans

---

## System Overview

The terminal suggestions engine is a **deterministic, local-first command suggestion system** for Carbon's xterm.js-powered SSH terminal. It observes user input in real time, matches against curated JSON command packs, and presents ranked suggestions via ghost text and the existing command palette — without executing remote commands, leaking sensitive data, or degrading typing performance.

---

## Sub-Plan Index

| # | File | Initiative | Depends On | Risk Level |
|---|------|-----------|------------|------------|
| 00 | `00-overview.md` | This document | — | — |
| 01 | `01-core-engine.md` | Types, schema, indexer, ranker, engine | None | Medium |
| 02 | `02-suggestion-packs.md` | JSON pack authoring (7 packs, ~200 commands) | 01 (schema) |  Low |
| 03 | `03-terminal-integration.md` | Hook extraction, engine wiring, ghost text | 01 | High |
| 04 | `04-palette-ui.md` | Deterministic suggestions in AIBangPalette | 01, 03 | Medium |
| 05 | `05-runtime-packs.md` | Electron IPC for user-installed packs | 01 | Medium |
| 06 | `06-testing-and-validation.md` | Unit tests, integration tests, manual QA | 01-04 | Low |
| 07 | `07-safety-and-privacy.md` | Security hardening, data lifecycle, redaction | 01, 03 | High |

---

## Execution Order

```
Phase 1 (Parallel-safe):
  ├── 01-core-engine.md        ← Foundation — must start first
  └── 02-suggestion-packs.md   ← Can start once schema types from 01 exist

Phase 2 (Depends on 01):
  ├── 03-terminal-integration.md  ← Requires engine API
  └── 07-safety-and-privacy.md    ← Requires context types + engine internals

Phase 3 (Depends on 01 + 03):
  └── 04-palette-ui.md            ← Requires hook output shape + engine results

Phase 4 (Independent, can defer):
  └── 05-runtime-packs.md         ← Electron IPC, post-MVP

Phase 5 (After all functional work):
  └── 06-testing-and-validation.md ← Full test coverage + manual QA
```

---

## Critical Architecture Decisions

### 1. No `import.meta.glob` — Use Direct ES Imports

The plan recommends `import.meta.glob("./packs/*.json", { eager: true })` for auto-discovery of pack files. **This will not work.** The project uses **Next.js with Webpack/Turbopack**, not Vite. `import.meta.glob` is Vite-specific.

**Resolution:** Use explicit named imports with a registry pattern:

```ts
import linuxPack from "../packs/linux.json";
import systemdPack from "../packs/systemd.json";
// ...
const BUNDLED_PACKS = [linuxPack, systemdPack, ...];
```

This is the same pattern used in `src/config/themes/index.ts` where 11 JSON theme files are imported directly. Adding a new pack requires adding one import line + one array entry — acceptable for bundled packs.

### 2. Custom Store, Not Zustand/Redux

The app uses a **hand-rolled pub/sub store** with `useSyncExternalStore`. New suggestion state (if any) must follow this pattern. However, the suggestions engine should keep most state **local to the terminal component** via hooks, not in the global store. The engine is session-scoped and ephemeral — global state is inappropriate.

### 3. Ghost Text Is Currently Palette-Gated

Ghost text rendering is gated on `ghostText && paletteOpen` (TerminalView line 916). For suggestions to show ghost text during normal typing (not just when palette is open), this condition **must be generalized**. This is a non-trivial change because terminal output capture is also gated on `paletteOpen`.

### 4. Terminal Output Capture Must Become Always-On (Bounded)

Currently, `terminalOutput` state is only populated when the palette is open (line 722 check). The suggestions engine needs terminal output context during normal typing. This requires making terminal output capture always-on but bounded (ring buffer of ~20 lines, throttled to 250ms, lines capped at 2000 chars).

### 5. Command Buffer Is a Closure Variable

`commandBuffer` is a local `let` inside the `useEffect` closure. External access is only via `commandBufferRef.current`. The hook extraction (`useTerminalCommandBuffer`) must internalize this and expose a stable ref or reactive state.

### 6. Tab Key Conflict

`Tab` is used for ghost text acceptance when the palette is open. The shell also uses `Tab` for completion. The suggestions engine must add a third mode: accept inline ghost suggestion when visible (palette closed). This requires extending `attachCustomKeyEventHandler` carefully to avoid breaking shell tab completion when no suggestion is visible.

### 7. IPC Channel Lockdown for Runtime Packs

Electron's `main.cjs` enforces an **IPC channel allowlist** (line 798-818). Any new channels for runtime pack management (`suggestions:list-packs`, `suggestions:install-pack`, `suggestions:remove-pack`) **must be added to `ALLOWED_IPC_CHANNELS`** or they will be silently blocked. This is a frequently missed step.

---

## Cross-Cutting Concerns

### Performance Budget (Non-Negotiable)

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Pack load + index build | < 50ms | 100ms |
| Per-keystroke ranking | < 10ms | 20ms |
| Debounce interval | 80-150ms | 200ms |
| AI fallback debounce | 350-500ms | 1000ms |
| Max candidates scored | 200 | 200 |
| Max suggestions returned | 8 | 8 |
| Max recent commands inspected | 10 | 10 |
| Max output lines inspected | 20 | 20 |

### Privacy Invariants (Non-Negotiable)

1. Raw command buffers are never persisted to disk, localStorage, IndexedDB, or telemetry.
2. Terminal output tails are never persisted.
3. Suggestion contexts are session-scoped and memory-only.
4. AI receives only redacted, bounded context — and only when `aiFeaturesEnabled !== false` AND `autocompleteEnabled === true`.
5. Secret-pattern buffers (`TOKEN=`, `PASSWORD=`, `AWS_SECRET_ACCESS_KEY=`, etc.) are excluded from all scoring and caching.
6. Suggestion code never logs raw buffer content, terminal output, or AI prompt context.

### Security Boundaries (Non-Negotiable)

1. The engine does not access SSH credentials.
2. The engine does not call `loadConnectionSecret`.
3. The engine does not execute remote commands in MVP.
4. The engine does not open files on remote hosts.
5. Runtime packs are data-only JSON — no JavaScript, no shell hooks, no remote URLs.
6. Runtime pack JSON is validated via Zod before loading.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Ghost text during normal typing causes visual jitter | High — degrades terminal UX | Medium | Only show ghost text for high-confidence, short suggestions; debounce rendering |
| Tab key conflicts with shell completion | High — breaks existing workflow | High | Only intercept Tab when ghost text is visible; pass through otherwise |
| Terminal output capture perf regression | Medium — affects typing latency | Low | Throttle to 250ms, cap at 20 lines, skip binary/control-heavy data |
| Pack validation crash takes down engine | High — no suggestions at all | Low | Isolate pack loading; one bad pack must not break others |
| Stale suggestion cache shows wrong completions | Medium — confusing UX | Medium | Invalidate on every keystroke; use `{buffer, packVersion, hostScope}` cache key |
| IPC channel forgotten in allowlist | High — runtime packs silently fail in prod | High | Document in sub-plan; add to checklist |
| Context leaks into AI when host disables AI | Critical — privacy violation | Low | Gate AI path on `hostAllowsAiFeatures(conn)` + `autocompleteEnabled` |

---

## File Manifest

All new files created by this initiative:

```
src/features/suggestions/
  core/
    types.ts              ← Types, interfaces, constants
    schema.ts             ← Zod validation schemas
    tokenizer.ts          ← Input normalization and tokenization
    indexer.ts            ← Prefix/token/alias/tag index builder
    context.ts            ← Context object construction + redaction
    ranker.ts             ← Deterministic scoring formula
    engine.ts             ← Public API: load, query, dispose
    runtime-packs.ts      ← Electron IPC pack loader (Phase 4)
  packs/
    linux.json            ← 40-60 common Linux commands
    systemd.json          ← 20-30 systemd commands
    apt.json              ← 20-30 apt/dpkg commands
    fail2ban.json         ← 10-20 fail2ban commands
    ufw.json              ← 10-20 ufw firewall commands
    docker.json           ← 30-50 Docker commands
    git.json              ← 30-50 Git commands
  __tests__/
    schema.test.ts        ← Pack validation tests
    tokenizer.test.ts     ← Tokenization tests
    indexer.test.ts       ← Index building tests
    ranker.test.ts        ← Scoring formula tests
    engine.test.ts        ← End-to-end engine tests
    context.test.ts       ← Context construction + redaction tests
  index.ts                ← Public barrel export

src/features/terminal/
  useTerminalCommandBuffer.ts   ← Extracted command buffer hook
  useTerminalSuggestions.ts     ← Suggestion engine wiring hook

Modified files:
  src/features/terminal/TerminalView.tsx    ← Hook integration, ghost text generalization
  src/features/terminal/AIBangPalette.tsx   ← Deterministic suggestions group
  src/globals.d.ts                          ← Runtime pack IPC types
  electron/preload.cjs                      ← Runtime pack IPC bridges
  electron/main.cjs                         ← Runtime pack IPC handlers + allowlist
```
