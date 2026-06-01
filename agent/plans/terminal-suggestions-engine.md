# Terminal Suggestions Engine - Implementation Plan

> **Document version:** 0.1-draft  
> **Author:** Codex architecture pass  
> **Last updated:** 2026-05-19  
> **Status:** Pre-implementation planning  
> **Product:** Carbon - AI-powered SSH terminal platform

---

## Executive Summary

Carbon already has the right foundation for terminal suggestions: an xterm.js-powered SSH terminal, a command buffer in `TerminalView`, user-defined bang commands, and an AI autocomplete route. The proposed feature should build on that foundation by adding a deterministic, extensible suggestions engine that runs locally and responds quickly while the user types.

The core idea is to separate suggestion knowledge from suggestion logic:

- **Suggestion packs** are JSON files that describe commands, aliases, tags, prerequisites, argument templates, risk levels, and examples.
- **The core algorithm** loads every valid pack, builds searchable indexes, scores candidates against the current terminal context, and returns ranked suggestions.
- **The UI layer** shows suggestions inline or in the existing command palette without blocking terminal input.
- **The AI layer remains optional** and should be used only for fallback, explanation, or reranking after deterministic candidates are available.

The recommended folder is `src/features/suggestions`, not a generic `src/Suggestions`, because the repo already organizes product features under `src/features`. The initial packs should live in `src/features/suggestions/packs`, while user-installed packs should eventually live outside `src` in app data and be loaded through Electron or a local API. This distinction matters: source files can be auto-discovered during development/build, but packaged apps cannot automatically see newly added files inside `src` unless the app is rebuilt.

The minimum viable version should support:

1. Loading all bundled JSON suggestion packs automatically.
2. Validating pack shape with Zod.
3. Ranking suggestions from the live command buffer, recent command history, terminal output, connection metadata, and detected host capabilities.
4. Rendering non-intrusive suggestions in the terminal UI.
5. Letting users accept a suggestion with `Tab` or select one from the existing palette.
6. Adding tests for pack validation, candidate generation, scoring, and terminal integration behavior.

This should be implemented as a local deterministic system first. It should not execute remote commands without explicit user action, and it should not send terminal content to an AI provider unless existing AI settings and per-host consent allow it.

Two constraints are non-negotiable:

- **Performance:** suggestions must be bounded, debounced, and indexed so typing never feels heavier than a normal terminal. The engine should search a narrow candidate set, not scan every command pack on every keystroke.
- **Privacy and security:** the engine should treat command buffers and terminal output as sensitive session data. Context must stay in memory, be redacted before optional AI use, and be cleared when the terminal session ends.

---

## 1. Current Repo Fit

Relevant existing code:

| Area | Current file | Why it matters |
|---|---|---|
| Terminal session UI | `src/features/terminal/TerminalView.tsx` | Owns xterm.js, command buffer tracking, ghost text, history, and WebSocket input. |
| Command palette | `src/features/terminal/AIBangPalette.tsx` | Already displays user-defined bangs and AI suggestions. It can become the visible surface for deterministic suggestions. |
| AI autocomplete API | `src/app/api/ai/autocomplete/route.ts` | Existing AI suggestion endpoint. Keep as optional fallback/rerank, not the primary engine. |
| AI settings and host consent | `src/lib/ai.ts`, `src/lib/types.ts`, `src/lib/store.ts` | Host-level `aiFeaturesEnabled` already exists and should continue to gate AI usage. |
| SSH bridge | `src/lib/ws-handler.ts`, `electron/ws-handler.cjs` | Provides terminal I/O. Suggestions should observe user input; they should not alter SSH transport behavior. |

Recommended location:

```text
src/features/suggestions/
  core/
    context.ts
    engine.ts
    indexer.ts
    ranker.ts
    schema.ts
    tokenizer.ts
    types.ts
  packs/
    linux.json
    systemd.json
    apt.json
    docker.json
    git.json
    fail2ban.json
    ufw.json
  __tests__/
    engine.test.ts
    ranker.test.ts
    schema.test.ts
  index.ts
```

Future user-installed packs:

```text
Electron app data/
  suggestion-packs/
    kubernetes.json
    nginx.json
    postgres.json
```

Use `suggestion-packs` or `packs` instead of `suggestions.jsons`. A directory named `suggestions.jsons` reads like a file extension and will be confusing over time.

---

## 2. Product Behavior

### User Experience

The suggestions engine should feel like a thin layer above the shell:

- It observes the command currently being typed.
- It suggests full commands, subcommands, flags, or argument templates.
- It never steals focus from the terminal.
- It can render a single best ghost completion inline.
- It can show multiple ranked options in the existing palette.
- It inserts text only after a deliberate user action.

Initial interactions:

| User action | Behavior |
|---|---|
| Type a partial command, e.g. `sys` | Suggest `systemctl`, `systemctl status`, `systemctl restart <service>`. |
| Type an intent after `!`, e.g. `!ban ssh` | Use current palette flow and show deterministic suggestions plus optional AI. |
| Press `Tab` with a ghost suggestion visible | Accept the suggestion. |
| Press arrow keys while palette is open | Move through suggestions. |
| Press `Escape` | Dismiss palette and ghost text. |

### Suggestion Sources

The engine should combine four sources in priority order:

1. **Current input buffer:** the partial command and cursor position.
2. **Suggestion packs:** bundled and later user-installed JSON packs.
3. **Session context:** recent commands, terminal output, connection icon/OS metadata, detected tools.
4. **Optional AI:** fallback or reranker when enabled and configured.

### Non-goals For MVP

- Do not execute discovery commands on every keystroke.
- Do not train a model.
- Do not attempt full shell parsing for every shell dialect.
- Do not mutate remote state.
- Do not autocomplete secrets, passwords, tokens, private keys, or host credentials.
- Do not persist raw command buffers, terminal output, or suggestion contexts to disk.

---

## 3. Suggestion Pack Format

Use JSON for authored packs and Zod for runtime validation.

Example:

```json
{
  "schemaVersion": 1,
  "packId": "fail2ban",
  "name": "Fail2ban",
  "description": "Common fail2ban service and jail management commands.",
  "domains": ["security", "linux"],
  "requires": {
    "os": ["linux"],
    "commandsAny": ["fail2ban-client", "systemctl"]
  },
  "commands": [
    {
      "id": "fail2ban.status.sshd",
      "command": "sudo fail2ban-client status sshd",
      "label": "Show SSH jail",
      "description": "Display fail2ban status for the sshd jail.",
      "tokens": ["fail2ban", "ban", "ssh", "sshd", "jail", "status"],
      "aliases": ["check ssh bans", "ssh jail status"],
      "tags": ["security", "ssh", "status"],
      "risk": "read",
      "requires": {
        "commandsAny": ["fail2ban-client"]
      }
    },
    {
      "id": "fail2ban.unban.ip",
      "command": "sudo fail2ban-client set sshd unbanip <ip>",
      "label": "Unban IP",
      "description": "Remove one IP address from the sshd jail ban list.",
      "tokens": ["fail2ban", "unban", "ip", "ssh", "sshd"],
      "tags": ["security", "ssh", "remediation"],
      "risk": "write",
      "arguments": [
        {
          "name": "ip",
          "kind": "ipv4",
          "required": true
        }
      ]
    }
  ]
}
```

Recommended TypeScript shape:

```ts
export type SuggestionRisk = "read" | "write" | "destructive" | "network";

export interface SuggestionPack {
  schemaVersion: 1;
  packId: string;
  name: string;
  description?: string;
  domains: string[];
  requires?: SuggestionRequirement;
  commands: SuggestionCommand[];
}

export interface SuggestionCommand {
  id: string;
  command: string;
  label: string;
  description?: string;
  tokens: string[];
  aliases?: string[];
  tags?: string[];
  risk: SuggestionRisk;
  requires?: SuggestionRequirement;
  arguments?: SuggestionArgument[];
}

export interface SuggestionRequirement {
  os?: Array<"linux" | "macos" | "windows" | "unknown">;
  distros?: string[];
  commandsAny?: string[];
  commandsAll?: string[];
  shells?: Array<"bash" | "zsh" | "fish" | "sh" | "powershell" | "unknown">;
}
```

Validation rules:

- `packId` must be lowercase kebab-case.
- Command `id` must be unique across all loaded packs.
- `command`, `label`, and `tokens` are required.
- Risk defaults are not allowed; authors must choose deliberately.
- Packs with invalid schema should be ignored and logged in development.
- One broken pack must not break the whole engine.

---

## 4. Core Algorithm

### High-Level Flow

```text
live terminal input
  -> normalize context
  -> parse current command line
  -> generate candidates from loaded packs
  -> score candidates with deterministic ranker
  -> apply policy filters
  -> return top N suggestions
  -> optional AI fallback/rerank
  -> render ghost text and palette rows
```

### Context Object

```ts
export interface SuggestionContext {
  input: {
    buffer: string;
    cursorIndex: number;
    normalized: string;
    tokens: string[];
    activeToken: string;
  };
  session: {
    recentCommands: string[];
    terminalOutputTail: string[];
    cwd?: string;
    shell?: "bash" | "zsh" | "fish" | "sh" | "powershell" | "unknown";
    lastExitCode?: number;
  };
  host: {
    connectionId: string;
    username: string;
    host: string;
    port: number;
    os?: "linux" | "macos" | "windows" | "unknown";
    distro?: string;
    iconKind?: string;
    availableCommands?: string[];
  };
  policy: {
    includeDestructive: boolean;
    aiAllowed: boolean;
    maxSuggestions: number;
  };
}
```

MVP context can start with values already available in `TerminalView`: command buffer, history, terminal output tail, and connection metadata. Host OS and available commands can be added later through a low-frequency capability probe.

### Candidate Generation

Build indexes once when packs load:

- `commandPrefixIndex`: maps command prefixes to command IDs.
- `tokenIndex`: maps normalized tokens to command IDs.
- `aliasTokenIndex`: maps words from aliases and descriptions to command IDs.
- `tagIndex`: maps tags like `security`, `docker`, `network` to command IDs.
- `requirementIndex`: maps commands and OS requirements to pack/command IDs.

At query time:

1. Normalize the buffer.
2. Extract the active token and full line tokens.
3. Pull candidates from prefix matches.
4. Pull candidates from token and alias overlaps.
5. Add high-relevance commands from recent history patterns.
6. Filter candidates by host requirements and policy.

### Ranking Formula

Use a transparent weighted score. Keep the implementation deterministic and easy to tune.

```text
score(candidate, context) =
  0.32 * prefixScore
+ 0.20 * tokenOverlapScore
+ 0.14 * aliasIntentScore
+ 0.10 * contextOutputScore
+ 0.08 * historyScore
+ 0.07 * requirementFitScore
+ 0.05 * argumentFitScore
+ 0.04 * recencyAndPopularityScore
- 0.10 * riskPenalty
- 0.05 * lengthPenalty
```

Score details:

- `prefixScore`: exact prefix match on command or subcommand. Example: `sys` strongly matches `systemctl`.
- `tokenOverlapScore`: Jaccard-like overlap between input tokens and command tokens.
- `aliasIntentScore`: fuzzy match against aliases like `show ports`, `restart service`, `ban ip`.
- `contextOutputScore`: boosts commands that address recent terminal output. Example: output contains `Permission denied`, boost `sudo`, `ls -l`, `chmod` suggestions only when relevant.
- `historyScore`: boosts commands related to recent usage. Example: after `docker ps`, boost `docker logs <container>`.
- `requirementFitScore`: boosts commands whose required tool/OS is known present.
- `argumentFitScore`: boosts commands where typed tokens fill expected arguments, such as IPs, ports, service names, filenames.
- `recencyAndPopularityScore`: static per-pack priority plus local acceptance history once available.
- `riskPenalty`: downranks `destructive` commands unless the user explicitly typed destructive intent.
- `lengthPenalty`: prevents long template commands from dominating short prefix completions.

### Mathematical Building Blocks

Use simple primitives first:

- Prefix match: `startsWith`.
- Token overlap: `intersection(queryTokens, commandTokens) / union(...)`.
- Fuzzy matching: bounded Levenshtein or trigram similarity for small candidate sets.
- Argument recognition: regex for IPs, ports, paths, service names, package names.
- Ranking normalization: clamp each component to `[0, 1]`.

Avoid heavyweight ML or embeddings in MVP. The algorithm should be fast enough to run synchronously for small pack sets and comfortably under a debounce for larger sets.

### Performance Budget

Target:

- Pack load and index build: under 50 ms for bundled packs.
- Per-keystroke ranking: under 10 ms for 1,000 commands.
- UI debounce: 80-150 ms for deterministic suggestions.
- AI fallback debounce: 350-500 ms, only when enabled.

Hard limits:

- Rank at most 200 candidate commands per keystroke after index filtering.
- Return at most 8 deterministic suggestions to the UI.
- Inspect at most the current command line, 10 recent commands, and 20 terminal-output lines.
- Ignore terminal-output lines longer than 2,000 characters.
- Disable context-output scoring when output contains binary/control-heavy data.
- Run AI fallback only after deterministic ranking finishes and only when deterministic confidence is low.

### Performance Mitigation Design

The engine must avoid a naive "search all packs every keypress" loop. VS Code can scope suggestions by language and file extension; Carbon must create its own scopes from the live terminal context.

Use a staged narrowing pipeline:

1. **Cheap gate:** do nothing when the buffer is empty, whitespace-only, shorter than two meaningful characters, or currently inside a quoted string/path segment where suggestions are unlikely to help.
2. **Scope detection:** infer likely domains from the first token and recent commands. Example: `dock` scopes to Docker, `fail2` scopes to Fail2ban, `git` scopes to Git.
3. **Index lookup:** pull candidate IDs from prefix, token, and alias indexes instead of scanning all command objects.
4. **Candidate cap:** cap candidate IDs before scoring.
5. **Lazy scoring:** compute expensive fuzzy scores only for candidates that pass cheap prefix/token checks.
6. **Stable memoization:** cache results by `{buffer, packVersion, hostScope}` for the current session.
7. **Debounce and cancel:** debounce renderer calls and cancel stale work when the user continues typing.

Recommended implementation details:

```ts
const SEARCH_LIMITS = {
  minChars: 2,
  maxCandidates: 200,
  maxReturned: 8,
  maxRecentCommands: 10,
  maxOutputLines: 20,
  maxOutputLineLength: 2_000,
};
```

Use `requestIdleCallback` only for pack indexing or cache warming, not for keystroke-critical rendering. Keystroke ranking should remain predictable and bounded.

### Scope Strategy

Pack and command metadata should support scoping:

```json
{
  "packId": "docker",
  "domains": ["containers", "linux"],
  "triggers": ["docker", "container", "image", "compose"],
  "commands": []
}
```

Scope signals:

- First token prefix: `git`, `docker`, `systemctl`, `fail2ban-client`.
- User intent token after `!`: `ban`, `ports`, `logs`, `restart`.
- Recent command families: recent `docker ps` boosts Docker scope.
- Host metadata: Linux packs are boosted only for Linux-like hosts.
- Known installed tools once capability probing exists.

If no scope is clear, search only a small "global common commands" subset plus prefix matches. This keeps random typing from fanning out across every pack.

---

## 5. Integration Plan

### Terminal Input Integration

Refactor the current command buffer logic in `TerminalView.tsx` into a small reusable hook:

```text
src/features/terminal/useTerminalCommandBuffer.ts
```

Responsibilities:

- Track printable input, backspace, enter, Ctrl+C, Ctrl+U, and paste.
- Keep `commandBufferRef` updated.
- Emit normalized suggestion context to the suggestions engine.
- Preserve existing command logging and `commandCount` behavior.

Then wire:

```ts
const suggestions = useTerminalSuggestions({
  buffer: commandBuffer,
  history,
  terminalOutput,
  conn,
});
```

### UI Integration

Recommended incremental path:

1. Keep `AIBangPalette` as the multi-option UI.
2. Add deterministic suggestions as a separate group above AI suggestions.
3. Reuse existing ghost text rendering for the single best completion.
4. Add source badges only if needed: `pack`, `history`, `ai`.
5. Keep `Tab` acceptance behavior, but ensure it accepts the active deterministic ghost suggestion when visible.

Rename later only if the component outgrows the AI/bang framing:

```text
AIBangPalette.tsx -> TerminalSuggestionPalette.tsx
```

Do not rename in the first implementation unless necessary; it increases diff size and risk.

### AI Integration

The existing AI route should become an optional secondary provider:

- Deterministic engine returns immediately.
- If deterministic suggestions are weak and AI is enabled, call `/api/ai/autocomplete`.
- AI suggestions must be clearly separated or marked as AI-generated.
- AI should receive redacted context only.
- Per-host `aiFeaturesEnabled === false` must disable AI autocomplete.

Potential future API:

```text
POST /api/suggestions
  -> deterministic suggestions
  -> optional AI fallback when settings allow
```

MVP can avoid a new route by running deterministic suggestions in the renderer because bundled packs are static and no secrets are needed.

### Pack Loading

For bundled source packs:

```ts
const modules = import.meta.glob("./packs/*.json", { eager: true });
```

Important packaging note:

- This auto-discovers files at build time.
- Adding a new JSON file under `src/features/suggestions/packs` requires rebuilding the app.
- For truly runtime-expandable packs, add an Electron IPC or local API loader that reads from app data, validates JSON, and merges those packs with bundled packs.

Future IPC:

```text
electron/preload.cjs
  listSuggestionPacks()
  installSuggestionPack(json)
  removeSuggestionPack(packId)

electron/main.cjs
  ipcMain.handle("suggestions:list-packs", ...)
  ipcMain.handle("suggestions:install-pack", ...)
```

---

## 6. Safety, Privacy, And Policy

### Safety

- Suggestions must never run automatically.
- Destructive commands must be downranked unless explicitly requested.
- Destructive suggestions should include a visible warning in the palette.
- Commands containing `rm -rf`, disk formatting, firewall lockout risk, user deletion, or service disabling should require explicit selection and should not appear as ghost text in MVP.
- Remote capability probes must be opt-in or low-risk and transparent.

### Privacy

- Deterministic suggestions should run locally.
- Do not send terminal output to AI unless AI autocomplete is enabled and the host allows AI features.
- Redact secrets before AI calls using existing `secret-stripping` or telemetry sanitization utilities where appropriate.
- Do not include full scrollback in suggestion context; use only a short tail.
- Do not write suggestion context, raw command buffers, raw terminal output, or rejected candidates to logs, localStorage, IndexedDB, SQLite, telemetry, crash reports, or pack analytics.
- Keep accepted suggestion personalization out of MVP unless it can be stored as aggregate command IDs only, never raw command text.
- Treat user-authored command text as sensitive even when it looks harmless.

### Data Lifecycle

All suggestion context should be session-scoped and memory-only by default.

| Data | Allowed lifetime | Persistence | Notes |
|---|---:|---|---|
| Current command buffer | Until command submit, cancel, or session close | Never | Clear on Enter, Ctrl+C, Ctrl+U, reconnect, close, and unmount. |
| Recent command history for suggestions | Current terminal session only | Never for MVP | Existing activity logs may still record commands; do not add a second persistence path. |
| Terminal output tail | Current terminal session only | Never | Keep only a small ring buffer; clear on close/unmount. |
| Ranked suggestions | Until next keystroke or dismissal | Never | Cache only in memory and invalidate aggressively. |
| Pack indexes | App process lifetime | Bundled packs only | Indexes contain static pack data, not user session data. |
| Optional accepted suggestion counts | Future feature | Aggregate IDs only | Store `packId:commandId` counts, not raw commands or terminal context. |

Required cleanup points:

- Terminal session closed.
- React component unmounted.
- WebSocket closed or errored.
- User reconnects.
- User disables suggestions or AI.
- App lock engages, if available.

Implementation guidance:

```ts
function disposeSuggestionSession(sessionId: string) {
  suggestionCache.delete(sessionId);
  contextRingBuffers.delete(sessionId);
  activeAbortControllers.get(sessionId)?.abort();
  activeAbortControllers.delete(sessionId);
}
```

### Sensitive Context Filtering

Before any context is used for scoring or sent to optional AI:

- Strip ANSI/control sequences.
- Drop lines that look like private keys, tokens, cookies, `.env` contents, SSH config secrets, passwords, or authorization headers.
- Drop command buffers containing likely secret assignment patterns such as `TOKEN=`, `PASSWORD=`, `AWS_SECRET_ACCESS_KEY=`, `--password`, `--token`, `-p <secret>`.
- Do not suggest from pasted multi-line blobs.
- Do not inspect arbitrary remote files. The engine should observe terminal I/O already visible in the session, not read files from the SSH host.

For local deterministic ranking, redaction is still useful because it prevents sensitive strings from entering caches or debug tooling. For AI, redaction is mandatory and should reuse existing sanitizers where possible.

### Logging Rules

Suggestion code must not log:

- Raw `buffer`.
- Raw terminal output.
- Raw AI prompt context.
- Full candidate lists generated from user context.
- Pack validation errors that include user-authored runtime pack contents.

Allowed logs:

- Pack ID failed validation with schema path.
- Suggestion engine timing metrics without user text.
- Candidate counts and cache hit rates.
- Feature flags and enabled/disabled state.

Example safe development log:

```text
[suggestions] ranked=8 candidates=46 scope=docker durationMs=3.2 cache=miss
```

Example unsafe log:

```text
[suggestions] buffer="export AWS_SECRET_ACCESS_KEY=..."
```

### Security Boundaries

The suggestions engine should be a read-only renderer-side helper for MVP:

- It does not get SSH credentials.
- It does not call `loadConnectionSecret`.
- It does not open files on the remote host.
- It does not execute commands for discovery in MVP.
- It does not have a backend database table.
- It does not add new telemetry payloads containing terminal text.

Runtime pack support must validate JSON as data, not executable code. Packs cannot contain JavaScript expressions, shell hooks, post-install scripts, remote URLs to fetch, or dynamic command-generation functions.

### Host Awareness

Initial host awareness can use existing connection fields:

- `conn.iconKind`
- `conn.username`
- `conn.host`
- `conn.port`

Future host capability probe:

```sh
printf 'carbon-capabilities\n'
uname -s
test -r /etc/os-release && cat /etc/os-release
command -v systemctl apt docker fail2ban-client ufw git
```

Run this only after connection, at low frequency, and ensure its output is not inserted into the user-visible shell in a disruptive way. A cleaner long-term approach is a separate SSH exec channel, not the interactive shell.

---

## 7. Implementation Roadmap

### Phase 1 - Core Engine

Files:

```text
src/features/suggestions/core/schema.ts
src/features/suggestions/core/types.ts
src/features/suggestions/core/tokenizer.ts
src/features/suggestions/core/indexer.ts
src/features/suggestions/core/ranker.ts
src/features/suggestions/core/engine.ts
src/features/suggestions/index.ts
```

Tasks:

1. Define pack, command, context, and result types.
2. Add Zod schemas for pack validation.
3. Load bundled JSON packs with `import.meta.glob`.
4. Validate packs and collect non-fatal pack errors.
5. Build indexes for prefix, tokens, aliases, tags, and requirements.
6. Implement candidate generation.
7. Implement scoring formula with tunable weights.
8. Add hard search limits, debounce/cancel support, and memory-only session caches.
9. Return a stable result shape:

```ts
export interface RankedSuggestion {
  id: string;
  packId: string;
  command: string;
  insertText: string;
  label: string;
  description?: string;
  risk: SuggestionRisk;
  score: number;
  matchedBy: string[];
}
```

### Phase 2 - Initial Packs

Files:

```text
src/features/suggestions/packs/linux.json
src/features/suggestions/packs/systemd.json
src/features/suggestions/packs/apt.json
src/features/suggestions/packs/fail2ban.json
src/features/suggestions/packs/ufw.json
src/features/suggestions/packs/docker.json
src/features/suggestions/packs/git.json
```

Initial pack guidance:

- Keep each pack small but high quality.
- Prefer common, safe commands.
- Include destructive commands only when clearly labeled and downranked.
- Include tokens and aliases that match intent, not just command names.
- Include argument templates where natural, like `<service>`, `<package>`, `<ip>`, `<container>`.

MVP command count:

- Linux core: 40-60 commands.
- systemd: 20-30 commands.
- apt: 20-30 commands.
- fail2ban: 10-20 commands.
- ufw: 10-20 commands.
- docker: 30-50 commands.
- git: 30-50 commands.

### Phase 3 - Terminal Hook

Files:

```text
src/features/terminal/useTerminalCommandBuffer.ts
src/features/terminal/useTerminalSuggestions.ts
src/features/terminal/TerminalView.tsx
```

Tasks:

1. Extract command buffer tracking from `TerminalView`.
2. Add `useTerminalSuggestions` with deterministic debounce.
3. Feed current buffer, history, terminal output, and connection metadata into the engine.
4. Preserve existing command logging and history behavior.
5. Add ghost text for safe, high-confidence suggestions only.
6. Ensure `Tab` accepts ghost text without breaking shell tab completion when no suggestion is visible.
7. Clear all suggestion buffers and caches on close, reconnect, unmount, and error paths.
8. Add a redaction step before context is passed to optional AI fallback.

### Phase 4 - Palette UI

Files:

```text
src/features/terminal/AIBangPalette.tsx
```

Tasks:

1. Add a `deterministicSuggestions` prop.
2. Render a `Suggestions` group above `AI Suggestions` and `Bangs`.
3. Support keyboard selection and insertion.
4. Add visual treatment for risk levels, especially destructive commands.
5. Keep AI loading states separate from local suggestion availability.

Potential prop:

```ts
interface DeterministicSuggestionItem {
  command: string;
  label: string;
  description?: string;
  risk: "read" | "write" | "destructive" | "network";
  source: string;
}
```

### Phase 5 - Optional Runtime Packs

Files:

```text
electron/main.cjs
electron/preload.cjs
src/globals.d.ts
src/features/suggestions/core/runtime-packs.ts
```

Tasks:

1. Define user pack directory under Electron app data.
2. Add safe JSON read/write IPC handlers.
3. Validate pack JSON before saving.
4. Merge bundled and user packs.
5. Show pack validation errors in a future settings panel.

This phase is required for true "drop in a JSON file and the app picks it up" behavior in packaged builds.

---

## 8. Testing Plan

### Unit Tests

Add Vitest tests for:

- Valid pack passes schema.
- Invalid pack fails without crashing registry.
- Duplicate command IDs are rejected or ignored deterministically.
- Prefix scoring ranks `systemctl` for `sys`.
- Alias scoring ranks `sudo fail2ban-client status sshd` for `ban ssh`.
- Risk penalty keeps destructive commands out of ghost text.
- Requirement filtering hides `apt` commands for non-Linux or unknown package manager context when strict mode is enabled.
- Argument recognition boosts IP commands when user typed an IP.
- Search caps prevent more than the configured candidate limit from being scored.
- Session cleanup clears command buffer, output tail, suggestion cache, and pending async work.
- Secret-like command buffers are not cached, logged, or sent to AI.

### Integration Tests

Add component-level tests where feasible:

- Palette renders deterministic suggestions above AI suggestions.
- `Tab` accepts ghost text only when a suggestion exists.
- `Escape` clears palette and ghost text.
- AI disabled host does not call AI autocomplete.

### Manual QA

Scenarios:

1. Type `sys` and verify `systemctl` suggestions.
2. Type `sudo fail2` and verify fail2ban suggestions.
3. Type `docker lo` after running `docker ps` and verify logs suggestions.
4. Type `rm` and verify destructive commands do not appear as ghost text.
5. Disable AI autocomplete and verify deterministic suggestions still work.
6. Disable AI for a host and verify no AI request is made.
7. Add a malformed pack and verify the app still loads valid packs.
8. Paste a token-like command and verify no suggestion context is logged or persisted.
9. Type rapidly for 30 seconds and verify CPU remains low and stale suggestion work is canceled.
10. Close and reopen a session and verify prior suggestion context is unavailable.

---

## 9. Agent Work Breakdown

### Agent A - Core Algorithm

Owns:

```text
src/features/suggestions/core/*
src/features/suggestions/index.ts
src/features/suggestions/__tests__/*
```

Deliverables:

- Type definitions.
- Zod schema.
- Pack loader.
- Index builder.
- Ranker.
- Engine public API.
- Unit tests.

Acceptance criteria:

- `pnpm test` passes.
- Engine returns stable ranked suggestions for synthetic contexts.
- Broken packs are reported but do not crash suggestion generation.
- Ranking respects hard candidate caps and returns within the performance budget.
- Raw terminal context is not persisted or logged.

### Agent B - Pack Authoring

Owns:

```text
src/features/suggestions/packs/*.json
```

Deliverables:

- Initial bundled packs.
- Pack IDs and command IDs unique.
- High-quality tokens and aliases.
- Clear risk labels.

Acceptance criteria:

- All packs pass schema validation.
- Packs include enough commands to demonstrate Linux, systemd, apt, fail2ban, ufw, docker, and git flows.

### Agent C - Terminal Integration

Owns:

```text
src/features/terminal/TerminalView.tsx
src/features/terminal/useTerminalCommandBuffer.ts
src/features/terminal/useTerminalSuggestions.ts
```

Deliverables:

- Hook extraction.
- Engine wiring.
- Ghost text integration.
- `Tab` acceptance behavior.
- Existing terminal behavior preserved.

Acceptance criteria:

- SSH input still passes through normally.
- Existing bang palette still works.
- Suggestions appear without noticeable typing lag.
- Suggestion session memory is cleared on close, reconnect, and component unmount.
- AI fallback receives only redacted, bounded context and only when allowed.

### Agent D - Palette UI

Owns:

```text
src/features/terminal/AIBangPalette.tsx
```

Deliverables:

- Deterministic suggestions group.
- Risk-aware row styling.
- Clean keyboard interaction.
- AI/bang behavior preserved.

Acceptance criteria:

- Deterministic suggestions show before AI suggestions.
- Selecting a suggestion inserts the intended command.
- Empty states do not hide valid bang or AI suggestions.

### Agent E - Runtime Packs

Owns:

```text
electron/main.cjs
electron/preload.cjs
src/globals.d.ts
src/features/suggestions/core/runtime-packs.ts
```

Deliverables:

- App-data pack directory.
- IPC handlers.
- Validation before install.
- Merge strategy for bundled and runtime packs.

Acceptance criteria:

- A valid user pack can be installed and appears without rebuilding.
- Invalid user pack is rejected with a readable error.
- User packs cannot read arbitrary paths.
- Runtime packs cannot execute code or define dynamic hooks.

---

## 10. Suggested MVP Sequence

1. Build core engine with one tiny `linux.json` pack.
2. Add tests for schema, indexing, and ranking.
3. Wire engine into `TerminalView` without changing visible UI; log suggestions in development.
4. Render ghost text for safe high-confidence suggestions.
5. Add deterministic group to `AIBangPalette`.
6. Expand packs.
7. Add runtime user-pack support.
8. Add settings UI for installed packs if needed.

This sequence keeps the risky pieces small. The engine can be validated independently before it touches terminal input behavior.

---

## 11. Open Questions

- Should deterministic suggestions appear for normal typing, only after `!`, or both?
- Should runtime packs be a paid/pro feature or developer-only folder initially?
- Should host capability probing happen automatically after connection, or only after user consent?
- Should destructive command suggestions be hidden entirely in MVP?
- Should accepted suggestions be stored locally to personalize ranking?

Recommended MVP answers:

- Show ghost suggestions during normal typing and full list suggestions in the palette.
- Keep runtime packs developer-only at first.
- Skip automatic host probing until the core UX is proven.
- Hide destructive ghost suggestions; allow destructive palette suggestions only when the user typed explicit destructive intent.
- Store accepted suggestion counts locally after MVP.

---

## 12. Success Criteria

The feature is successful when:

- A new JSON pack can be added to bundled packs and becomes searchable after rebuild.
- The engine returns useful suggestions without AI configured.
- Suggestions appear within 150 ms while typing.
- Ranking stays under the configured candidate cap and does not scan every command on every keypress.
- Users can accept suggestions without breaking normal shell input.
- AI autocomplete continues to work when enabled but is not required.
- Sensitive terminal context is not sent externally unless the existing AI consent path allows it.
- Raw command buffers, terminal output tails, and suggestion contexts are cleared when sessions close and are not persisted by the suggestions engine.
- Tests cover schema validation, ranking, and terminal acceptance behavior.
