# Safety and Privacy Hardening

## Goal

Ensure the suggestion engine treats terminal data as sensitive, never persists raw session context, redacts secrets before optional AI calls, respects per-host AI consent gates, and operates as a read-only renderer-side helper with no access to SSH credentials or remote file systems.

## Architectural Analysis

### Why This Is A Separate Cross-Cutting Concern

Safety and privacy are not features — they're constraints that every other sub-plan must satisfy. This sub-plan exists to:

1. **Consolidate all security requirements** in one place so they can be audited holistically
2. **Define the invariants** that must hold across all engine code paths
3. **Specify the implementation details** for redaction, data lifecycle, and logging rules
4. **Identify the gaps** between the plan's security vision and the existing codebase's security posture

### System Implications

1. **The engine is a renderer-side helper with no backend.** It runs in the browser/Electron renderer. It does not have a database table, a server-side API, or a telemetry pipeline. This is a strong security posture — the attack surface is limited to the renderer process.

2. **The existing AI consent path is well-designed.** `hostAllowsAiFeatures(conn)` checks `conn.aiFeaturesEnabled !== false` (default true/undefined = allowed). `state.ai.autocompleteEnabled` gates the global AI feature. Both must be checked before any AI call. The suggestion engine must use these existing gates — not create new ones.

3. **The existing secret storage is in Electron's secure store.** API keys are stored via `safeStorage` encryption in `electron/secure-store.cjs`. The suggestion engine must NOT access this module. It should not know about API keys at all — the AI fallback path goes through the existing `aiAutocomplete` IPC/API route which handles key injection internally.

4. **The existing telemetry system exists.** `state.telemetryEnabled` controls telemetry. The suggestion engine must not add new telemetry payloads containing terminal text, even if telemetry is enabled. Pack load metrics (counts, timing) are acceptable.

### Hidden Complexity

1. **"Secrets" are a fuzzy category.** `TOKEN=abc` is obviously a secret. But `HOSTNAME=web01`? `PORT=8080`? The redaction must be aggressive on known patterns (AWS keys, passwords, tokens, private keys) but not so aggressive that normal commands are suppressed. False negatives (missing a secret) are worse than false positives (blocking a normal command).

2. **Terminal output contains everything.** `cat /etc/shadow` output, `printenv` output, SSH key contents, configuration file contents — all of these flow through terminal output. The suggestion engine only uses the last ~20 lines, but those lines can contain anything. The redaction must operate on output lines, not just command buffers.

3. **ANSI escape sequences can hide content.** A malicious terminal output could contain ANSI sequences that make text invisible to the user but visible to the engine. ANSI stripping must happen before any context processing.

4. **Race conditions in AI consent.** The user could disable AI for a host while an AI request is in-flight. The abort mechanism must handle this — and the response must be discarded if consent was revoked during the request.

## Dependencies

- `01-core-engine.md` — Context construction, redaction functions, tokenizer
- `03-terminal-integration.md` — Hook lifecycle, cleanup points

## Risks

- **Risk: Secret pattern list is incomplete.** Impact: Sensitive data enters caches or AI context. Mitigation: Start with a conservative list (AWS, GCP, Azure, GitHub, generic TOKEN/PASSWORD/SECRET/KEY patterns). Expand over time. Document the pattern list for review.
- **Risk: Redaction is too aggressive and suppresses normal commands.** Impact: Engine never provides suggestions for certain inputs. Mitigation: Redaction should only suppress _caching_ and _AI sending_, not scoring. A command like `TOKEN` without `=` should still get suggestions.
- **Risk: Data leaks via console.log during development.** Impact: Sensitive terminal text in dev tools. Mitigation: Enforce logging rules in code review. Add a lint rule or runtime assertion that `[suggestions]` logs don't contain buffer text.

## Epics

### Epic: Secret Pattern Detection

#### Tasks

- [ ] Define secret patterns in `src/features/suggestions/core/tokenizer.ts` (or a dedicated `redaction.ts`):

  ```ts
  const SECRET_PATTERNS: RegExp[] = [
    // Key-value assignments
    /(?:^|[\s;])(?:export\s+)?(?:TOKEN|PASSWORD|SECRET|API_KEY|ACCESS_KEY|PRIVATE_KEY|AUTH|CREDENTIALS?)=/i,
    /(?:^|[\s;])(?:export\s+)?(?:AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|AWS_SESSION_TOKEN)=/i,
    /(?:^|[\s;])(?:export\s+)?(?:GITHUB_TOKEN|GH_TOKEN|GITLAB_TOKEN|DOCKER_PASSWORD)=/i,
    /(?:^|[\s;])(?:export\s+)?(?:DATABASE_URL|REDIS_URL|MONGO_URI)=/i,

    // CLI flags with secrets
    /--(?:password|token|secret|api-key|auth-token|access-token)\b/i,
    /-p\s+\S+/, // -p flag followed by value (common for passwords)

    // SSH/TLS key blocks
    /-----BEGIN\s+(?:RSA\s+)?(?:PRIVATE|ENCRYPTED)\s+KEY-----/i,

    // Authorization headers
    /(?:Authorization|Bearer|Basic)\s*[:=]\s*\S+/i,

    // .env file patterns
    /^[A-Z_]+=\S+$/, // Be careful — this is broad. Use only for multi-line pastes.
  ];

  const SECRET_OUTPUT_PATTERNS: RegExp[] = [
    // Private key content in terminal output
    /-----BEGIN\s+(?:RSA\s+)?(?:PRIVATE|ENCRYPTED)\s+KEY-----/i,
    /-----END\s+(?:RSA\s+)?(?:PRIVATE|ENCRYPTED)\s+KEY-----/i,

    // Token-like long strings (hex, base64 > 40 chars)
    /[A-Za-z0-9+/=]{40,}/,

    // Cookie values
    /(?:Set-Cookie|Cookie)\s*[:=]\s*\S+/i,

    // AWS-style keys
    /AKIA[0-9A-Z]{16}/,
  ];
  ```

- [ ] `isLikelySecret(buffer: string): boolean` — check command buffer against `SECRET_PATTERNS`
- [ ] `containsSecretContent(line: string): boolean` — check output line against `SECRET_OUTPUT_PATTERNS`
- [ ] `redactOutputLines(lines: string[]): string[]` — filter out lines matching secret output patterns

#### Acceptance Criteria

- Common secret assignment patterns are detected (TOKEN=, PASSWORD=, AWS keys)
- CLI flags with secrets are detected (--password, --token, -p)
- Private key blocks are detected in output
- Normal commands like `ls -la`, `docker ps`, `git status` are NOT flagged
- `TOKEN` without `=` is NOT flagged (it's a valid command/argument)
- Pattern list is documented and reviewable

#### Testing Requirements

- Unit tests with 20+ positive cases (secrets) and 20+ negative cases (normal commands)
- Test with real-world patterns: `export AWS_SECRET_ACCESS_KEY=AKIA1234567890ABCDEF`
- Test with edge cases: `TOKEN` alone, `password` in a commit message, `key` as a variable name

---

### Epic: Data Lifecycle Enforcement

#### Tasks

- [ ] Verify all context data follows the lifecycle table from the plan:

  | Data                              | Lifetime                  | Persistence                    |
  | --------------------------------- | ------------------------- | ------------------------------ |
  | Command buffer                    | Until submit/cancel/close | Never                          |
  | Recent commands (for suggestions) | Current session only      | Never (for suggestion context) |
  | Terminal output tail              | Current session only      | Never                          |
  | Ranked suggestions                | Until next keystroke      | Never                          |
  | Pack indexes                      | App process lifetime      | Bundled packs only             |

- [ ] Implement `disposeSuggestionSession()` function:

  ```ts
  function disposeSuggestionSession(): void {
    // Clear suggestion cache
    suggestionResultCache.clear();
    // Clear pending debounce timers
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    // Abort pending AI requests
    activeAbortController?.abort();
    activeAbortController = null;
    // Clear context refs
    // (bufferRef, outputRef cleared by hook cleanup)
  }
  ```

- [ ] Verify cleanup fires at these points:
  - [ ] `TerminalView` component unmounts (useEffect cleanup)
  - [ ] WebSocket closes (`ws.onclose`)
  - [ ] WebSocket errors (`ws.onerror`)
  - [ ] User reconnects (reconnectKey changes)
  - [ ] Terminal session closed (isClosed becomes true)
  - [ ] User disables suggestions (future setting)

- [ ] Verify NO suggestion data is written to:
  - [ ] localStorage
  - [ ] IndexedDB
  - [ ] SQLite database (`database.sqlite`)
  - [ ] Electron app data (except runtime pack JSON files)
  - [ ] Telemetry payloads
  - [ ] Crash reports
  - [ ] Console logs (raw buffer/output text)

#### Acceptance Criteria

- Session cleanup is verified at all lifecycle points
- No persistence path exists for raw context data
- Memory profiling shows cleanup is effective (no leaks after 10 open/close cycles)

---

### Epic: AI Consent Gate Integration

#### Tasks

- [ ] In `useTerminalSuggestions.ts`, gate AI fallback on two conditions:
  ```ts
  const aiAllowed = useMemo(() => {
    const aiSettings = useStore((s) => s.ai);
    return (
      aiSettings.autocompleteEnabled && isAIConfigured(aiSettings) && hostAllowsAiFeatures(conn)
    );
  }, [conn]);
  ```
- [ ] Pass `aiAllowed` into `SuggestionContext.policy.aiAllowed`
- [ ] In the AI fallback path (if implemented):
  - Check `context.policy.aiAllowed` before making any AI request
  - Use `redactContextForAI(context)` before constructing the AI payload
  - Abort AI request if consent changes during the request lifecycle
- [ ] **Never bypass these checks.** Even in development, the consent path must be active.

#### Acceptance Criteria

- AI fallback does NOT fire when `autocompleteEnabled === false`
- AI fallback does NOT fire when `hostAllowsAiFeatures(conn)` returns false
- AI receives only redacted context
- Disabling AI mid-session aborts in-flight requests

---

### Epic: Logging Rules Enforcement

#### Tasks

- [ ] Define safe logging function for suggestion engine:

  ```ts
  function logSuggestion(metrics: {
    ranked: number;
    candidates: number;
    scope: string;
    durationMs: number;
    cache: "hit" | "miss";
  }): void {
    if (process.env.NODE_ENV !== "development") return;
    console.log(
      `[suggestions] ranked=${metrics.ranked} candidates=${metrics.candidates} scope=${metrics.scope} durationMs=${metrics.durationMs.toFixed(1)} cache=${metrics.cache}`,
    );
  }
  ```

- [ ] Audit all `console.log` / `console.debug` / `console.warn` calls in suggestion code:
  - [ ] No raw `buffer` text
  - [ ] No raw terminal output lines
  - [ ] No raw AI prompt context
  - [ ] No full candidate lists with user context
  - [ ] No pack validation errors that include user-authored pack contents (use packId + schema path only)

- [ ] Allowed log content:
  - Pack ID + validation error path (e.g., `commands[2].risk: required`)
  - Timing metrics (candidate count, scored count, duration)
  - Cache hit/miss rates
  - Feature flag states
  - Scope detection results (e.g., `scope=docker`)

#### Acceptance Criteria

- Code review confirms no raw context in logs
- Safe logging function used consistently
- Production builds have logging disabled (dev-only)

---

### Epic: Pack Security Validation

#### Tasks

- [ ] Verify Zod schema prevents dangerous pack content:
  - [ ] No JavaScript expressions in any field
  - [ ] No shell hooks or post-install scripts
  - [ ] No remote URLs to fetch
  - [ ] No dynamic command-generation functions
  - [ ] `command` field is treated as display text, NOT executed by the engine
  - [ ] `command` field is sent to the terminal only after explicit user selection

- [ ] For runtime packs (Phase 4):
  - [ ] JSON is parsed with `JSON.parse()`, not `eval()` or `require()`
  - [ ] Pack file size is limited (1MB max)
  - [ ] Pack ID is sanitized before use as filename
  - [ ] Pack directory is restricted to app data path
  - [ ] No symlink following in pack directory (use `fs.realpathSync` to verify)

- [ ] Verify the engine never:
  - [ ] Calls `loadConnectionSecret` or accesses SSH credentials
  - [ ] Opens files on the remote host
  - [ ] Executes commands on the remote host
  - [ ] Creates database tables or records
  - [ ] Adds telemetry payloads with terminal text
  - [ ] Accesses `window.electron.encryptString/decryptString`
  - [ ] Accesses `window.electron.saveConnectionSecret/loadConnectionSecret`

#### Acceptance Criteria

- Security boundaries are verified via code review
- No execution paths exist from pack content to SSH/file system operations
- Runtime pack loading uses safe parsing only

---

### Epic: Sensitive Context Filtering Pipeline

#### Tasks

- [ ] Implement the full filtering pipeline in `context.ts`:

  ```
  Raw terminal output
    → Strip ANSI/control sequences
    → Drop lines > 2000 chars
    → Drop binary/control-heavy lines (> 30% non-printable)
    → Drop lines matching SECRET_OUTPUT_PATTERNS
    → Keep only last 20 lines
    → Result: sanitized output tail for scoring

  Raw command buffer
    → Check isLikelySecret() → if true, return empty suggestions
    → Strip ANSI
    → Normalize (lowercase, trim, collapse whitespace)
    → Result: safe buffer for scoring

  For AI fallback:
    → Deep clone context
    → Remove all secret-matching commands from history
    → Remove all secret-matching lines from output
    → Truncate to AI-safe limits
    → Result: redacted context for AI
  ```

- [ ] Special handling for multi-line pastes:
  - If buffer contains newlines, treat as multi-line paste
  - Do NOT provide suggestions for multi-line pastes
  - Do NOT cache multi-line paste buffers

#### Acceptance Criteria

- Full pipeline is implemented and unit tested
- Multi-line pastes are excluded from suggestions
- AI receives only the redacted context
- Original context is not mutated by redaction
- Pipeline handles empty inputs gracefully

#### Testing Requirements

- Unit tests covering each filtering stage
- End-to-end test: raw context with mixed safe/secret content → only safe content survives
- Test: multi-line paste buffer → empty suggestions
- Test: redacted context is a deep copy (verify original unchanged)
