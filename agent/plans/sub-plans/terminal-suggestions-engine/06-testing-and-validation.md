# Testing and Validation

## Goal

Build a comprehensive test suite that validates pack schemas, tokenization, indexing, ranking, context construction, redaction, and terminal integration behavior. The test suite must catch regressions before they reach the terminal — where bugs are hardest to debug.

## Architectural Analysis

### Why Testing Is Its Own Sub-Plan

The suggestion engine has a large surface area with many interacting components. Each component is individually testable because the architecture separates data (packs), logic (ranker), and presentation (palette). This separation is deliberate — it makes the system testable without a full terminal environment.

However, the test infrastructure has constraints:

1. **Vitest runs in Node environment, not jsdom.** The existing `vitest.config.ts` specifies `environment: "node"`. This means React component tests won't work without changing the environment. Core engine tests run fine in Node.
2. **Test file pattern is `src/**/*.test.ts` only.** No `.test.tsx` support — which means React component integration tests need a different approach or a config update.
3. **Only 1 existing test file in the entire project.** The test suite is essentially greenfield. There are no test utilities, fixtures, or mocking patterns established.

### Testing Strategy

Given these constraints, the testing strategy is:

| Layer | Approach | Environment |
|-------|----------|-------------|
| Schema validation | Vitest unit tests | Node |
| Tokenizer | Vitest unit tests | Node |
| Indexer | Vitest unit tests | Node |
| Ranker | Vitest unit tests | Node |
| Context builder | Vitest unit tests | Node |
| Redaction | Vitest unit tests | Node |
| Engine (end-to-end) | Vitest unit tests with synthetic contexts | Node |
| Pack validation (all bundled) | Vitest unit tests loading real JSON | Node |
| Terminal hooks | Manual QA | Browser |
| Palette UI | Manual QA | Browser |
| Ghost text | Manual QA | Browser |
| Performance | Manual profiling + automated timing assertions | Both |

### Hidden Complexity

1. **Ranking tests are inherently assertion-heavy.** You can't assert exact scores because weights change. Instead, assert **relative ordering**: "for input `sys`, `systemctl` ranks higher than `sysctl`" rather than "for input `sys`, `systemctl` scores 0.87."
2. **Context building requires mocking connection metadata.** Create a test fixture factory for `Connection` objects with sensible defaults.
3. **Redaction tests must cover secret patterns without using real secrets.** Use synthetic patterns like `export TOKEN=abc123` and verify they're stripped.
4. **Pack validation tests must load actual JSON files.** Use `fs.readFileSync` in tests (which runs in Node) to load packs from `src/features/suggestions/packs/`.

## Dependencies

- `01-core-engine.md` — All core modules must be implemented
- `02-suggestion-packs.md` — All bundled packs must be authored
- `03-terminal-integration.md` — For manual QA scenarios
- `04-palette-ui.md` — For manual QA scenarios

## Risks

- **Risk: Test suite is too slow.** Mitigation: Each test file should run in < 2 seconds. Index-building tests with all packs should run in < 500ms.
- **Risk: Flaky ranking assertions.** Mitigation: Use ordering assertions, not exact score assertions. Pin test fixtures to specific pack versions.
- **Risk: Manual QA scenarios are skipped.** Mitigation: Document each scenario as a checklist with expected behavior. Don't rely on memory.

## Epics

### Epic: Test Fixtures and Utilities

#### Tasks

- [ ] Create `src/features/suggestions/__tests__/fixtures.ts`
  - [ ] `createTestPack(overrides?: Partial<SuggestionPack>): SuggestionPack` — factory for valid packs with sensible defaults
  - [ ] `createTestCommand(overrides?: Partial<SuggestionCommand>): SuggestionCommand` — factory for valid commands
  - [ ] `createTestContext(overrides?: DeepPartial<SuggestionContext>): SuggestionContext` — factory for valid contexts
  - [ ] `createTestConnection(overrides?: Partial<Connection>): Connection` — factory for connection objects
  - [ ] `INVALID_PACKS` — collection of intentionally invalid pack data for negative testing
  - [ ] `COMMON_QUERIES` — array of `{ input, expectedTopResult, description }` for ranking validation

#### Acceptance Criteria

- Fixtures produce valid objects that pass schema validation
- Overrides allow customizing any field
- Fixtures are reusable across all test files

---

### Epic: Schema Tests

#### Tasks

- [ ] Create `src/features/suggestions/__tests__/schema.test.ts`
  - [ ] Test: valid minimal pack passes validation
  - [ ] Test: valid full-featured pack passes validation
  - [ ] Test: missing `packId` fails
  - [ ] Test: invalid `packId` format (uppercase, spaces, path traversal) fails
  - [ ] Test: missing `commands` array fails
  - [ ] Test: empty `commands` array fails
  - [ ] Test: command with missing `risk` field fails (no defaults)
  - [ ] Test: command with invalid `risk` value fails
  - [ ] Test: command with missing `tokens` fails
  - [ ] Test: command with empty `tokens` array fails
  - [ ] Test: command with missing `label` fails
  - [ ] Test: command with missing `command` fails
  - [ ] Test: duplicate command IDs across packs detected by `validatePacks`
  - [ ] Test: duplicate `packId` values detected by `validatePacks`
  - [ ] Test: invalid `schemaVersion` (not 1) fails
  - [ ] Test: valid `requires` with OS constraints passes
  - [ ] Test: valid `arguments` with supported kinds passes
  - [ ] Test: all 7 bundled JSON packs pass schema validation (load from filesystem)

#### Acceptance Criteria

- `pnpm test` passes all schema tests
- All bundled packs pass validation
- Each negative test case produces a specific, readable error

---

### Epic: Tokenizer Tests

#### Tasks

- [ ] Create `src/features/suggestions/__tests__/tokenizer.test.ts`
  - [ ] `normalizeInput` tests:
    - Empty string → empty string
    - Whitespace-only → empty string
    - Leading/trailing whitespace → trimmed
    - Mixed case → lowercase
    - Multiple spaces → single space
    - ANSI escape sequences → stripped
  - [ ] `tokenize` tests:
    - Single word → `["word"]`
    - Multiple words → `["word1", "word2"]`
    - Hyphenated word → `["fail2ban", "client", "fail2ban-client"]` (splits + keeps original)
    - Command with flags → `["git", "log", "--oneline"]`
    - Duplicate tokens after splitting → deduplicated
  - [ ] `extractActiveToken` tests:
    - Cursor at end → last token
    - Cursor in middle of word → that word
    - Cursor at space → empty string
    - Empty buffer → empty string
  - [ ] `isLikelySecret` tests:
    - `"export TOKEN=abc123"` → true
    - `"PASSWORD=secret"` → true
    - `"AWS_SECRET_ACCESS_KEY=AKIA..."` → true
    - `"ssh-keygen --password mypass"` → true
    - `"ls -la"` → false
    - `"docker ps"` → false
    - `"git commit -m 'message'"` → false
    - `"TOKEN"` → false (no `=` sign)
  - [ ] `stripAnsi` tests:
    - Text with SGR codes → stripped
    - Text with CSI sequences → stripped
    - Plain text → unchanged
  - [ ] `isBinaryOrControlHeavy` tests:
    - Normal text → false
    - Binary gibberish (> 30% non-printable) → true
    - ANSI-colored text (after stripping) → false

#### Acceptance Criteria

- All tokenizer functions are tested with edge cases
- Secret detection has zero false negatives for common patterns
- ANSI stripping handles real-world terminal output

---

### Epic: Indexer Tests

#### Tasks

- [ ] Create `src/features/suggestions/__tests__/indexer.test.ts`
  - [ ] `buildIndex` tests:
    - Single pack with 3 commands → all indexes populated
    - Two packs → commands from both packs in indexes
    - Prefix index contains expected entries (e.g., `sys` → `systemctl.*` commands)
    - Token index maps `ban` to fail2ban commands
    - Alias index maps `show ports` words to relevant commands
    - Tag index maps `security` to security-tagged commands
    - Command map has all commands accessible by ID
    - Pack map has all packs accessible by packId
  - [ ] `lookupByPrefix` tests:
    - `sys` → returns systemd/sysctl command IDs
    - `docker c` → returns docker compose command IDs
    - Empty string → returns empty set
    - Very long string (> 12 chars) → still works (uses truncated prefix)
  - [ ] `lookupByTokens` tests:
    - `["ban", "ssh"]` → returns fail2ban commands with hit counts
    - `["status"]` → returns commands from multiple packs
    - Empty array → returns empty map
  - [ ] Performance test:
    - Load all 7 bundled packs
    - Assert `buildIndex` completes in < 50ms
    - Assert `lookupByPrefix` completes in < 1ms for any prefix

#### Acceptance Criteria

- Index builder handles multi-pack scenarios
- Lookup functions return correct command IDs
- Performance is within budget

---

### Epic: Ranker Tests

#### Tasks

- [ ] Create `src/features/suggestions/__tests__/ranker.test.ts`
  - [ ] Individual scoring function tests:
    - `scorePrefixMatch`: `sys` vs `systemctl` returns high score; `abc` vs `systemctl` returns 0
    - `scoreTokenOverlap`: overlapping tokens return higher score than non-overlapping
    - `scoreAliasIntent`: `ban ssh` matches fail2ban alias
    - `scoreContextOutput`: `Permission denied` in output boosts `sudo` commands
    - `scoreHistory`: recent `docker ps` boosts `docker logs`
    - `scoreRequirementFit`: Linux command on Linux host returns 1.0; on Windows host returns 0.0
    - `scoreArgumentFit`: typed IP-like string boosts commands expecting `<ip>` argument
    - `computeRiskPenalty`: destructive returns 1.0; read returns 0.0
    - `computeLengthPenalty`: short commands return 0.0; very long commands return positive penalty
  - [ ] Composite ranking tests:
    - For input `sys`, `systemctl` ranks above `sysctl` (prefix dominance)
    - For input `ban ssh`, `fail2ban-client status sshd` ranks highly (alias match)
    - For input `rm`, destructive commands are not #1 (risk penalty)
    - For input `docker logs` after recent `docker ps`, `docker logs <container>` ranks highly
    - With empty history and no output, prefix + token scores still produce reasonable results
  - [ ] Determinism test:
    - Same context + same packs → same results (run 10 times, assert equality)
  - [ ] Weight override test:
    - Custom weights produce different ranking order (validates weights are respected)

#### Acceptance Criteria

- Each scoring function is independently validated
- Composite ranking produces intuitive results for common queries
- Ranking is deterministic
- Custom weights affect results as expected

---

### Epic: Context Tests

#### Tasks

- [ ] Create `src/features/suggestions/__tests__/context.test.ts`
  - [ ] `buildSuggestionContext` tests:
    - Full input → context has normalized buffer, tokens, active token
    - Connection metadata → host context has os, host, port, username
    - Terminal output with ANSI → stripped in context
    - Terminal output with long lines → truncated to 2000 chars
    - Binary lines in output → excluded
    - More than 20 output lines → trimmed to 20
    - More than 10 recent commands → trimmed to 10
  - [ ] `redactContextForAI` tests:
    - Context with secret command in history → command removed
    - Context with `TOKEN=abc` in output → line removed
    - Context with private key block in output → lines removed
    - Context with normal commands/output → preserved unchanged
    - Redaction returns a deep copy (original not mutated)

#### Acceptance Criteria

- Context builder handles all edge cases
- Redaction removes sensitive data without removing safe data
- Redaction doesn't mutate the input context

---

### Epic: Engine Integration Tests

#### Tasks

- [ ] Create `src/features/suggestions/__tests__/engine.test.ts`
  - [ ] Engine lifecycle tests:
    - `createSuggestionEngine()` returns a working engine
    - `loadPacks([validPack])` succeeds
    - `loadPacks([invalidPack])` records error, doesn't crash
    - `loadPacks([validPack, invalidPack])` loads valid, skips invalid
    - `getPackIds()` returns loaded pack IDs
    - `getCommandCount()` returns total command count
    - `getErrors()` returns pack load errors
    - `dispose()` clears all state
  - [ ] Query tests:
    - Empty buffer → empty results
    - Whitespace buffer → empty results
    - Buffer < 2 chars → empty results
    - Secret buffer → empty results
    - Valid buffer `sys` → returns systemctl-related suggestions
    - Valid buffer with connection metadata → respects OS filtering
    - Results are capped at `maxReturned` (8)
    - Results include `matchedBy` field
    - Each result has a score > 0
  - [ ] Performance tests:
    - Load all 7 bundled packs
    - Query 20 common inputs
    - Assert each query completes in < 10ms
    - Assert index build completes in < 50ms

#### Acceptance Criteria

- Engine handles all lifecycle operations
- Query returns correct results for common inputs
- Performance is within budget
- Broken packs don't break the engine

---

### Epic: Manual QA Checklist

#### Tasks

This is a checklist for human verification after all code is integrated.

- [ ] **Scenario 1: Basic prefix completion**
  - Type `sys` in a connected terminal
  - Verify ghost text shows `temctl` or `temctl status` completion
  - Press Tab → verify `systemctl` or `systemctl status` is inserted
  - Verify command executes normally on the SSH host

- [ ] **Scenario 2: Alias/intent matching**
  - Type `!ban ssh` (with `!` to open palette)
  - Verify deterministic suggestions include fail2ban commands
  - Verify AI suggestions also appear (if AI is configured)
  - Select a fail2ban command → verify insertion

- [ ] **Scenario 3: Docker context awareness**
  - Run `docker ps` on the SSH host
  - Type `docker lo` on the next line
  - Verify `docker logs <container>` appears as a suggestion
  - Verify history boost is working (docker context)

- [ ] **Scenario 4: Destructive command safety**
  - Type `rm` in a terminal
  - Verify `rm -rf /` does NOT appear as ghost text
  - Open palette → verify destructive commands have risk indicators
  - Verify destructive commands are ranked lower than safe alternatives

- [ ] **Scenario 5: AI disabled**
  - Disable AI autocomplete in settings
  - Type `sys` → verify deterministic suggestions still work
  - Type `!ban ssh` → verify no AI suggestions appear, only deterministic + bangs

- [ ] **Scenario 6: Host AI disabled**
  - Set `aiFeaturesEnabled: false` for a specific host
  - Connect to that host
  - Verify no AI requests are made during typing
  - Verify deterministic suggestions still work

- [ ] **Scenario 7: Malformed pack resilience**
  - Add a malformed JSON file to the packs directory (if runtime packs exist)
  - OR temporarily corrupt a bundled pack import
  - Verify the app loads and valid packs still provide suggestions

- [ ] **Scenario 8: Secret handling**
  - Type `export AWS_SECRET_ACCESS_KEY=AKIA12345`
  - Verify no suggestion context is logged
  - Verify no ghost text appears for this buffer
  - Check browser console → no raw buffer text logged

- [ ] **Scenario 9: Rapid typing performance**
  - Type rapidly for 30 seconds in a connected terminal
  - Monitor CPU in browser DevTools
  - Verify no visible lag or dropped keystrokes
  - Verify stale suggestions are canceled (no outdated ghost text)

- [ ] **Scenario 10: Session cleanup**
  - Open a terminal, type some commands, see suggestions
  - Close the terminal tab
  - Open a new terminal to the same host
  - Verify no prior suggestion context bleeds into the new session
  - Check memory in DevTools → no significant growth from old session
