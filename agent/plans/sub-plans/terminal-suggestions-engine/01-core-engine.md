# Core Suggestion Engine

## Goal

Build the deterministic suggestion engine that loads JSON command packs, builds searchable indexes, scores candidates against terminal context, and returns ranked suggestions. This is the foundation — every other sub-plan depends on this.

## Architectural Analysis

### Why This Exists

The current AI autocomplete is a network-dependent, high-latency suggestion mechanism. It works, but it's not responsive enough for keystroke-level completions and it requires AI configuration. The core engine provides a **zero-config, zero-latency, zero-network** suggestion layer that works out of the box with bundled packs.

### System Implications

- The engine runs **entirely in the renderer process** (browser/Electron renderer). It does not touch the server, the database, or SSH connections.
- All data structures are **session-scoped and memory-only**. No persistence, no IndexedDB, no localStorage.
- The engine must be **stateless per query** — given the same context and packs, it must produce the same results. This makes it testable and debuggable.
- Pack loading happens once at app start (or feature mount). Indexes are built once and cached for the process lifetime. Only user-session context changes per keystroke.

### Hidden Complexity

1. **Tokenization ambiguity**: Terminal commands don't follow a single grammar. `fail2ban-client` has hyphens; `docker compose` is two words; `git log --oneline` has flags. The tokenizer must handle all of these without being a full shell parser.
2. **Index fan-out**: A naive token index maps every word to every command containing it. Common words like `sudo`, `status`, `list` would match hundreds of commands. The index must support scoping to prevent this.
3. **Score normalization**: Each scoring component has a different natural range. Without clamping to `[0, 1]`, one component can dominate. The weights in the plan assume normalized inputs.
4. **Cache invalidation**: The cache key `{buffer, packVersion, hostScope}` looks simple, but `hostScope` changes when capability probing completes (future), and the buffer changes on every keystroke. Over-caching causes stale results; under-caching wastes CPU.
5. **`import.meta.glob` doesn't work here**: The plan specifies this for pack loading, but the project uses Next.js (Webpack/Turbopack), not Vite. Must use direct ES imports instead.

### Implementation Traps

- **Don't create a singleton engine instance.** Multiple terminal tabs can be open simultaneously. Each needs its own context, but they can share indexes. Use a shared index singleton with per-session context.
- **Don't score all commands.** The plan specifies 200 max candidates. But if the prefix `s` matches 300+ commands across all packs, the cap must be enforced *before* scoring, not after.
- **Don't use `Array.prototype.sort` for final ranking.** V8's `sort` is Timsort (O(n log n)). For returning top-8 from 200 candidates, a partial sort or selection algorithm is faster, but the difference is negligible at this scale. Use `sort` for clarity.
- **Don't forget argument template stripping.** Commands contain `<ip>`, `<service>`, `<container>` templates. These must be stripped from tokens so they don't match literal user input, but preserved in `insertText` for the UI.

## Dependencies

- **Zod** (already in `package.json` as `^3.24.2`) — for pack schema validation
- **No new dependencies required** — tokenization, indexing, and scoring use built-in string operations

## Risks

- **Risk: Tokenizer doesn't handle edge cases.** Mitigation: Start with simple whitespace + hyphen splitting. Add trigram fuzzy matching only for alias scoring. Don't attempt shell parsing.
- **Risk: Index builds slowly for large pack sets.** Mitigation: Measure during Phase 2 pack authoring. Target < 50ms for ~200 commands (7 bundled packs). If slow, defer alias index to idle callback.
- **Risk: Score weights produce unintuitive rankings.** Mitigation: Build a test harness with 20+ representative queries and tune weights empirically. The plan's weights (0.32 prefix, 0.20 token overlap, etc.) are starting points, not final.

## Epics

### Epic: Type Definitions

#### Tasks

- [ ] Create `src/features/suggestions/core/types.ts`
  - [ ] Define `SuggestionRisk` type: `"read" | "write" | "destructive" | "network"`
  - [ ] Define `SuggestionRequirement` interface: `os`, `distros`, `commandsAny`, `commandsAll`, `shells`
  - [ ] Define `SuggestionArgument` interface: `name`, `kind` (`"ipv4" | "port" | "path" | "service" | "package" | "container" | "branch" | "freetext"`), `required`
  - [ ] Define `SuggestionCommand` interface: `id`, `command`, `label`, `description`, `tokens`, `aliases`, `tags`, `risk`, `requires`, `arguments`
  - [ ] Define `SuggestionPack` interface: `schemaVersion`, `packId`, `name`, `description`, `domains`, `requires`, `commands`, `triggers` (optional, for scope detection)
  - [ ] Define `SuggestionContext` interface per plan section 4 — `input`, `session`, `host`, `policy` blocks
  - [ ] Define `RankedSuggestion` interface: `id`, `packId`, `command`, `insertText`, `label`, `description`, `risk`, `score`, `matchedBy`
  - [ ] Define `SuggestionEngineConfig` interface: `maxCandidates`, `maxReturned`, `maxRecentCommands`, `maxOutputLines`, `maxOutputLineLength`, `minChars`
  - [ ] Define `SEARCH_LIMITS` constant with defaults from plan (200, 8, 10, 20, 2000, 2)
  - [ ] Export all types from barrel `index.ts`

#### Acceptance Criteria

- All types are importable from `@/features/suggestions`
- Types match the plan's specifications in sections 3 and 4
- No runtime code — types only (zero bundle impact)

---

### Epic: Zod Schema Validation

#### Tasks

- [ ] Create `src/features/suggestions/core/schema.ts`
  - [ ] Define `SuggestionRequirementSchema` with Zod
    - `os`: optional array of `z.enum(["linux", "macos", "windows", "unknown"])`
    - `distros`: optional string array
    - `commandsAny`: optional string array
    - `commandsAll`: optional string array
    - `shells`: optional array of `z.enum(["bash", "zsh", "fish", "sh", "powershell", "unknown"])`
  - [ ] Define `SuggestionArgumentSchema` with Zod
    - `name`: string
    - `kind`: `z.enum(["ipv4", "port", "path", "service", "package", "container", "branch", "freetext"])`
    - `required`: boolean
  - [ ] Define `SuggestionCommandSchema` with Zod
    - `id`: string matching lowercase kebab-case + dots pattern (`/^[a-z0-9][a-z0-9.-]*$/`)
    - `command`: non-empty string
    - `label`: non-empty string
    - `description`: optional string
    - `tokens`: non-empty array of non-empty strings
    - `aliases`: optional string array
    - `tags`: optional string array
    - `risk`: `z.enum(["read", "write", "destructive", "network"])` — no default, must be explicit
    - `requires`: optional `SuggestionRequirementSchema`
    - `arguments`: optional array of `SuggestionArgumentSchema`
  - [ ] Define `SuggestionPackSchema` with Zod
    - `schemaVersion`: `z.literal(1)`
    - `packId`: string matching `/^[a-z0-9][a-z0-9-]*$/` (lowercase kebab-case)
    - `name`: non-empty string
    - `description`: optional string
    - `domains`: non-empty string array
    - `requires`: optional `SuggestionRequirementSchema`
    - `triggers`: optional string array (for scope detection)
    - `commands`: non-empty array of `SuggestionCommandSchema`
  - [ ] Add `validatePack(data: unknown): { success: true; pack: SuggestionPack } | { success: false; errors: z.ZodError }`
  - [ ] Add `validatePacks(data: unknown[]): { valid: SuggestionPack[]; errors: Array<{ index: number; packId?: string; error: z.ZodError }> }`
    - Must detect duplicate `packId` values across packs
    - Must detect duplicate command `id` values across all packs

#### Acceptance Criteria

- Valid pack JSON passes validation and returns typed `SuggestionPack`
- Invalid pack returns structured errors without throwing
- Duplicate `packId` or command `id` across packs is detected
- Missing `risk` field causes validation failure (no defaults)
- `packId` not matching kebab-case is rejected
- Command `id` not matching `[a-z0-9][a-z0-9.-]*` is rejected

#### Testing Requirements

- Unit tests in `src/features/suggestions/__tests__/schema.test.ts`
- Test cases: valid pack, missing required fields, invalid `packId` format, invalid `risk` value, duplicate command IDs, empty commands array, valid nested requirements

---

### Epic: Tokenizer

#### Tasks

- [ ] Create `src/features/suggestions/core/tokenizer.ts`
  - [ ] `normalizeInput(buffer: string): string` — lowercase, trim, collapse whitespace, strip ANSI escape sequences
  - [ ] `tokenize(input: string): string[]` — split on whitespace, then split tokens containing hyphens (e.g., `fail2ban-client` → `["fail2ban", "client", "fail2ban-client"]`). Deduplicate. Lowercase.
  - [ ] `extractActiveToken(buffer: string, cursorIndex: number): string` — return the token at/before cursor position
  - [ ] `stripArgumentTemplates(command: string): string` — remove `<...>` template placeholders for index building
  - [ ] `isLikelySecret(buffer: string): boolean` — return true if buffer matches secret assignment patterns: `TOKEN=`, `PASSWORD=`, `AWS_SECRET_ACCESS_KEY=`, `--password`, `--token`, `-p <secret>` (where `-p` is followed by non-flag text)
  - [ ] `stripAnsi(text: string): string` — remove ANSI/control escape sequences from terminal output
  - [ ] `isBinaryOrControlHeavy(line: string): boolean` — return true if line contains > 30% non-printable characters

#### Acceptance Criteria

- Tokenization handles hyphens, dots, underscores, and multi-word commands
- Active token extraction works at start, middle, and end of buffer
- Secret detection catches common patterns without false positives on normal commands
- ANSI stripping handles common CSI, OSC, and SGR sequences

#### Testing Requirements

- Unit tests in `src/features/suggestions/__tests__/tokenizer.test.ts`
- Test cases: empty input, single word, multi-word, hyphenated commands, secret patterns (positive and negative), ANSI-rich strings, binary-heavy lines

---

### Epic: Index Builder

#### Tasks

- [ ] Create `src/features/suggestions/core/indexer.ts`
  - [ ] Define `SuggestionIndex` interface:
    ```ts
    interface SuggestionIndex {
      commandPrefixIndex: Map<string, Set<string>>;   // prefix → command IDs
      tokenIndex: Map<string, Set<string>>;           // token → command IDs
      aliasTokenIndex: Map<string, Set<string>>;      // alias word → command IDs
      tagIndex: Map<string, Set<string>>;             // tag → command IDs
      commandMap: Map<string, SuggestionCommand>;     // command ID → full command object
      packMap: Map<string, SuggestionPack>;           // pack ID → full pack object
      commandToPackId: Map<string, string>;           // command ID → pack ID
    }
    ```
  - [ ] `buildIndex(packs: SuggestionPack[]): SuggestionIndex`
    - For each command, generate prefixes of the first word (e.g., `systemctl` → `s`, `sy`, `sys`, `syst`, ..., `systemctl`) and index them
    - Also index full multi-word command prefixes (e.g., `docker compose` → `docker c`, `docker co`, `docker com`, ...)
    - Index all command tokens (from `tokens` field) into `tokenIndex`
    - Split alias strings into individual words and index into `aliasTokenIndex`
    - Index tags into `tagIndex`
    - Store command and pack objects in their respective maps
  - [ ] Prefix generation should stop at 12 characters (diminishing returns beyond that)
  - [ ] All index keys must be lowercased
  - [ ] `lookupByPrefix(index: SuggestionIndex, prefix: string): Set<string>` — returns command IDs matching prefix
  - [ ] `lookupByTokens(index: SuggestionIndex, tokens: string[]): Map<string, number>` — returns command IDs with hit counts
  - [ ] `lookupByTags(index: SuggestionIndex, tags: string[]): Set<string>` — returns command IDs matching any tag

#### Acceptance Criteria

- Index build completes in < 50ms for ~200 commands
- Prefix lookup for `sys` returns commands starting with `systemctl`, `sysctl`, etc.
- Token lookup for `["ban", "ssh"]` returns fail2ban-related commands
- Tag lookup for `["security"]` returns all security-tagged commands across packs
- Command map allows O(1) lookup of full command details by ID

#### Testing Requirements

- Unit tests in `src/features/suggestions/__tests__/indexer.test.ts`
- Test cases: index build with 2+ packs, prefix lookup (exact, partial), token lookup (single, multi-token), tag lookup, empty pack, large prefix (> 12 chars)

---

### Epic: Deterministic Ranker

#### Tasks

- [ ] Create `src/features/suggestions/core/ranker.ts`
  - [ ] Define `ScoringWeights` interface with all 10 components:
    ```ts
    interface ScoringWeights {
      prefix: number;           // 0.32
      tokenOverlap: number;     // 0.20
      aliasIntent: number;      // 0.14
      contextOutput: number;    // 0.10
      history: number;          // 0.08
      requirementFit: number;   // 0.07
      argumentFit: number;      // 0.05
      recencyPopularity: number; // 0.04
      riskPenalty: number;      // 0.10
      lengthPenalty: number;    // 0.05
    }
    ```
  - [ ] Export `DEFAULT_WEIGHTS` constant with plan's values
  - [ ] Implement individual scoring functions (each returns `[0, 1]`):
    - [ ] `scorePrefixMatch(command: SuggestionCommand, context: SuggestionContext): number`
      - Exact prefix match on command string or subcommand (e.g., `sys` vs `systemctl`)
      - Score = `matchLength / commandFirstWord.length`, clamped to [0, 1]
    - [ ] `scoreTokenOverlap(command: SuggestionCommand, context: SuggestionContext): number`
      - Jaccard similarity: `|intersection(inputTokens, cmdTokens)| / |union(inputTokens, cmdTokens)|`
    - [ ] `scoreAliasIntent(command: SuggestionCommand, context: SuggestionContext): number`
      - Check each alias for substring match against the normalized input
      - For short inputs (< 5 chars), use prefix matching; for longer inputs, use trigram similarity
      - Return best match score across all aliases
    - [ ] `scoreContextOutput(command: SuggestionCommand, context: SuggestionContext): number`
      - Scan `session.terminalOutputTail` for patterns that the command addresses
      - Example patterns: `Permission denied` → boost `sudo`, `chmod`; `No such file` → boost `ls`, `find`; `Connection refused` → boost `systemctl status`, `ufw status`
      - Use a small static map of output patterns → relevant command tags/tokens
    - [ ] `scoreHistory(command: SuggestionCommand, context: SuggestionContext): number`
      - Check if command tokens overlap with recent command tokens
      - Example: after `docker ps`, boost `docker logs`, `docker stop`
      - Decay by position: most recent command gets weight 1.0, decaying to 0.1 for the 10th
    - [ ] `scoreRequirementFit(command: SuggestionCommand, pack: SuggestionPack, context: SuggestionContext): number`
      - 1.0 if command's required OS matches host OS and required commands are in `availableCommands`
      - 0.5 if host info is unknown (don't penalize when we can't check)
      - 0.0 if host OS is known and doesn't match
    - [ ] `scoreArgumentFit(command: SuggestionCommand, context: SuggestionContext): number`
      - Check if typed tokens match expected argument kinds (regex for IPs, ports, paths)
      - Score = fraction of matchable arguments that have a typed candidate
    - [ ] `scoreRecencyPopularity(command: SuggestionCommand): number`
      - Static per-pack priority for MVP (all 0.5)
      - Future: incorporate accepted suggestion counts
    - [ ] `computeRiskPenalty(command: SuggestionCommand, context: SuggestionContext): number`
      - `destructive` → 1.0 (unless input explicitly matches destructive verbs like `rm`, `delete`, `drop`, `destroy`)
      - `write` → 0.3
      - `network` → 0.2
      - `read` → 0.0
    - [ ] `computeLengthPenalty(command: SuggestionCommand): number`
      - `max(0, (commandLength - 30) / 100)`, clamped to [0, 1]
      - Prevents long template commands from dominating short completions
  - [ ] `rankCandidates(candidates: SuggestionCommand[], context: SuggestionContext, packs: Map<string, SuggestionPack>, weights?: ScoringWeights): RankedSuggestion[]`
    - Compute composite score for each candidate
    - Sort descending by score
    - Return top `context.policy.maxSuggestions` results
    - Populate `matchedBy` field with the component names that contributed > 0 to the score

#### Acceptance Criteria

- `rankCandidates` returns deterministic results for identical inputs
- `systemctl` ranks #1 for input `sys` (prefix score dominates)
- `sudo fail2ban-client status sshd` ranks highly for input `ban ssh` (alias score)
- `rm -rf /` never appears as #1 for input `rm` (risk penalty)
- All scoring components are independently testable
- Weights are tunable without code changes (pass as config)

#### Rollback Plan

- Scoring weights are constants — revert to plan defaults if tuning goes wrong
- Individual scoring functions are isolated — disable any component by setting weight to 0

#### Testing Requirements

- Unit tests in `src/features/suggestions/__tests__/ranker.test.ts`
- Test each scoring function independently with synthetic commands/contexts
- Test composite ranking with 3+ competing commands
- Test risk penalty behavior for destructive commands
- Test with empty context (no history, no output)

---

### Epic: Engine Public API

#### Tasks

- [ ] Create `src/features/suggestions/core/engine.ts`
  - [ ] `createSuggestionEngine(config?: Partial<SuggestionEngineConfig>): SuggestionEngine`
    ```ts
    interface SuggestionEngine {
      loadPacks(packs: SuggestionPack[]): void;        // Validate + index
      addPacks(packs: SuggestionPack[]): void;          // Append without rebuild
      query(context: SuggestionContext): RankedSuggestion[];
      getPackIds(): string[];
      getCommandCount(): number;
      getErrors(): PackLoadError[];
      dispose(): void;
    }
    ```
  - [ ] Internal state: `index`, `config`, `errors[]`, `resultCache`
  - [ ] `loadPacks` must:
    - Validate each pack with Zod (non-fatal errors per pack)
    - Skip invalid packs and record errors
    - Build indexes from valid packs
    - Clear any existing cache
  - [ ] `query` must:
    - Return empty array if buffer is empty, whitespace-only, < `minChars`, or `isLikelySecret`
    - Infer scope from first token and narrow to relevant packs/commands
    - Pull candidates from prefix, token, and alias indexes
    - Cap candidates at `maxCandidates`
    - Score candidates with ranker
    - Filter by host requirements and policy
    - Return top `maxReturned` results
    - Cache result by `{buffer, scope}` — invalidate on next call with different buffer
  - [ ] `dispose` must clear all internal state (index, cache, errors)
  - [ ] Add timing instrumentation (safe dev-only logging per the plan's logging rules):
    ```
    [suggestions] ranked=8 candidates=46 scope=docker durationMs=3.2 cache=miss
    ```
- [ ] Create `src/features/suggestions/core/context.ts`
  - [ ] `buildSuggestionContext(input: ContextInput): SuggestionContext`
    - Normalize buffer, extract tokens and active token
    - Strip ANSI from terminal output lines
    - Filter out binary/control-heavy lines
    - Cap terminal output lines at `maxOutputLines` and `maxOutputLineLength`
    - Cap recent commands at `maxRecentCommands`
    - Map connection metadata to host context
  - [ ] `redactContextForAI(context: SuggestionContext): SuggestionContext`
    - Deep-clone context
    - Remove lines matching secret patterns from `terminalOutputTail`
    - Remove commands matching secret patterns from `recentCommands`
    - Strip any remaining ANSI
    - Truncate all strings to safe AI context limits
- [ ] Create `src/features/suggestions/index.ts`
  - [ ] Import all bundled packs via direct ES imports:
    ```ts
    import linuxPack from "./packs/linux.json";
    import systemdPack from "./packs/systemd.json";
    import aptPack from "./packs/apt.json";
    import fail2banPack from "./packs/fail2ban.json";
    import ufwPack from "./packs/ufw.json";
    import dockerPack from "./packs/docker.json";
    import gitPack from "./packs/git.json";

    export const BUNDLED_PACKS = [
      linuxPack, systemdPack, aptPack, fail2banPack, ufwPack, dockerPack, gitPack,
    ];
    ```
  - [ ] Re-export engine factory, types, and BUNDLED_PACKS

#### Acceptance Criteria

- `createSuggestionEngine()` returns a working engine with no packs loaded
- `loadPacks(BUNDLED_PACKS)` loads all valid packs and reports errors for any invalid ones
- `query()` returns results within the performance budget (< 10ms for 200 candidates)
- `query()` returns empty array for secret-like buffers
- `dispose()` clears all memory
- `getErrors()` returns structured errors for invalid packs without exposing user data
- Safe development logging includes timing and counts but never raw buffer text

#### Rollback Plan

- The engine is a pure function layer with no side effects. Rolling back means removing the import and the `useTerminalSuggestions` hook (Phase 3).
- Invalid packs are skipped — the engine degrades to fewer suggestions, never to errors.

#### Testing Requirements

- Unit tests in `src/features/suggestions/__tests__/engine.test.ts`
- Test: load valid packs, load mix of valid/invalid packs, query with synthetic context, query with empty buffer, query with secret buffer, query with short buffer (< minChars), dispose clears state
- Integration test: load BUNDLED_PACKS (once they exist from Phase 2) and verify ranking for common queries
- Unit tests in `src/features/suggestions/__tests__/context.test.ts`
- Test: context building with full metadata, context building with minimal metadata, redaction strips secrets, ANSI stripping, binary line filtering, output line capping
