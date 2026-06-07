# Runtime Packs — Electron IPC

## Goal

Enable users to install custom suggestion packs at runtime by dropping JSON files into an app data directory. The app picks them up without requiring a rebuild. This is a post-MVP phase that extends the bundled pack system with Electron IPC for file-system access.

## Architectural Analysis

### Why This Is A Separate Phase

Bundled packs cover common workflows and require no user setup. Runtime packs serve power users and enterprise deployments that need organization-specific command packs (e.g., internal deployment tools, custom monitoring scripts, infrastructure-specific workflows).

This must be a separate phase because:

1. **It requires Electron IPC** — the renderer process cannot read the file system directly (sandbox is enabled, `nodeIntegration: false`, `contextIsolation: true`).
2. **It modifies security-critical files** — `electron/main.cjs` enforces IPC channel allowlists and network egress controls. Any new IPC channel must be carefully added.
3. **It introduces a user-supplied code/data attack surface** — even though packs are "just JSON," they're user-supplied data parsed and used by the application. Validation must be rigorous.
4. **It's not needed for MVP value** — the 7 bundled packs already cover the most common SSH workflows.

### System Implications

1. **IPC channel allowlist in `main.cjs`.** Lines 798-818 define `ALLOWED_IPC_CHANNELS`. The monkey-patched `ipcMain.handle` and `ipcMain.on` reject any channel not in this set. New channels (`suggestions:list-packs`, `suggestions:install-pack`, `suggestions:remove-pack`) **must be added to this set** or they will be silently blocked in production. This is the #1 implementation trap.

2. **App data path.** `electron/main.cjs` uses `app.getPath("userData")` for data storage. The pack directory should be `{userData}/suggestion-packs/`. This path is:
   - Windows: `%APPDATA%/Carbon/suggestion-packs/`
   - macOS: `~/Library/Application Support/Carbon/suggestion-packs/`
   - Linux: `~/.config/Carbon/suggestion-packs/`

3. **File permissions.** `electron/file-permissions.cjs` restricts file access in production. The pack directory must be within allowed paths.

4. **Merge strategy.** Runtime packs merge with bundled packs. If a runtime pack has the same `packId` as a bundled pack, the runtime pack should **override** (not merge commands) — this allows users to replace a bundled pack with their own version. If command IDs conflict across packs after merge, log a warning and keep the first-loaded version.

5. **No hot reload in MVP.** Adding a pack requires restarting the app or manually triggering a reload. File system watchers (like `chokidar`) add complexity and dependency — defer to a future phase.

### Hidden Complexity

1. **Path traversal attacks.** A malicious pack name could include `../../` to read or write outside the pack directory. Pack IDs must be validated and used as safe filenames.
2. **JSON bomb / resource exhaustion.** A 100MB JSON file would consume excessive memory during validation. Add file size limits before parsing.
3. **Encoding issues.** JSON files might be saved with BOM, non-UTF-8 encodings, or include invalid Unicode. Use `fs.readFileSync(path, "utf8")` and handle parse errors gracefully.
4. **Pack directory doesn't exist on first run.** The IPC handler must create the directory if it doesn't exist (`fs.mkdirSync(dir, { recursive: true })`).

### Implementation Traps

- **Don't use `require()` or `import()` for user packs.** JSON.parse is sufficient and doesn't execute code. Using `require()` for JSON would work but could be exploited if someone names a file with a `.js` extension.
- **Don't trust the pack contents after validation.** Even after Zod validates the schema, sanitize `packId` before using it as a filename (strip special chars, enforce kebab-case).
- **Don't expose the full file path to the renderer.** The IPC response should include `packId` and `name`, not the full filesystem path. Path information leakage is unnecessary.
- **Don't add file system watching in this phase.** It adds complexity (platform-specific watchers, debouncing, permission issues) without proportional user value. A "Refresh packs" button or app restart is sufficient.

## Dependencies

- `01-core-engine.md` — `SuggestionPackSchema` for validation, `SuggestionPack` type, engine's `addPacks` API
- Electron main process modifications require careful security review

## Risks

- **Risk: Forgotten IPC channel allowlist entry.** Impact: Runtime packs silently fail in production. Mitigation: Add a test that verifies all suggestion IPC channels are in the allowlist.
- **Risk: Path traversal via pack ID.** Impact: File system access outside pack directory. Mitigation: Sanitize pack ID to `[a-z0-9-]` only before constructing file paths.
- **Risk: Large JSON files cause OOM.** Impact: App crashes. Mitigation: Check file size before reading (reject > 1MB).
- **Risk: Invalid JSON causes unhandled exception.** Impact: IPC handler crashes. Mitigation: Wrap `JSON.parse` in try/catch, return structured error.
- **Risk: Preload bridge mismatch with main process.** Impact: IPC calls fail. Mitigation: Add integration test that exercises the full IPC round-trip.

## Epics

### Epic: Pack Directory Management

#### Tasks

- [ ] Define pack directory constants in `electron/main.cjs`:
  ```js
  const SUGGESTION_PACKS_DIR = path.join(app.getPath("userData"), "suggestion-packs");
  ```
- [ ] Create directory on app start if it doesn't exist:
  ```js
  fs.mkdirSync(SUGGESTION_PACKS_DIR, { recursive: true });
  ```
- [ ] Add file size constant:
  ```js
  const MAX_PACK_FILE_SIZE = 1 * 1024 * 1024; // 1MB
  ```

#### Acceptance Criteria

- Pack directory exists after app launch on all platforms
- Directory path uses `app.getPath("userData")` (not hardcoded)
- Directory is created with secure permissions (inherited from userData)

---

### Epic: IPC Channel Registration

#### Tasks

- [ ] Add new IPC channels to `ALLOWED_IPC_CHANNELS` set in `electron/main.cjs` (line ~798-818):
  ```js
  "suggestions:list-packs",
  "suggestions:install-pack",
  "suggestions:remove-pack",
  ```
- [ ] Implement IPC handlers in `electron/main.cjs`:

  **`suggestions:list-packs`:**

  ```js
  ipcMain.handle("suggestions:list-packs", async (event) => {
    ensureMainSender(event);
    try {
      if (!fs.existsSync(SUGGESTION_PACKS_DIR)) return { packs: [] };
      const files = fs.readdirSync(SUGGESTION_PACKS_DIR).filter((f) => f.endsWith(".json"));
      const packs = [];
      for (const file of files) {
        const filePath = path.join(SUGGESTION_PACKS_DIR, file);
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_PACK_FILE_SIZE) continue; // skip oversized
        try {
          const raw = fs.readFileSync(filePath, "utf8");
          const data = JSON.parse(raw);
          packs.push({
            packId: data.packId || file.replace(".json", ""),
            name: data.name || file,
            commandCount: Array.isArray(data.commands) ? data.commands.length : 0,
            fileName: file,
            sizeBytes: stat.size,
          });
        } catch {
          /* skip malformed */
        }
      }
      return { packs };
    } catch (err) {
      return { packs: [], error: err.message };
    }
  });
  ```

  **`suggestions:install-pack`:**

  ```js
  ipcMain.handle("suggestions:install-pack", async (event, jsonString) => {
    ensureMainSender(event);
    try {
      if (typeof jsonString !== "string" || jsonString.length > MAX_PACK_FILE_SIZE) {
        return { success: false, error: "Pack too large or invalid input" };
      }
      const data = JSON.parse(jsonString);
      // Validate packId format (kebab-case, no path traversal)
      const packId = data.packId;
      if (!packId || !/^[a-z0-9][a-z0-9-]*$/.test(packId)) {
        return { success: false, error: "Invalid packId format" };
      }
      // NOTE: Full Zod validation happens renderer-side with the schema module
      // Main process does basic shape check only
      if (!Array.isArray(data.commands) || data.commands.length === 0) {
        return { success: false, error: "Pack must have at least one command" };
      }
      const fileName = `${packId}.json`;
      const filePath = path.join(SUGGESTION_PACKS_DIR, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      return { success: true, packId, fileName };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ```

  **`suggestions:remove-pack`:**

  ```js
  ipcMain.handle("suggestions:remove-pack", async (event, packId) => {
    ensureMainSender(event);
    try {
      if (!packId || !/^[a-z0-9][a-z0-9-]*$/.test(packId)) {
        return { success: false, error: "Invalid packId format" };
      }
      const filePath = path.join(SUGGESTION_PACKS_DIR, `${packId}.json`);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: "Pack not found" };
      }
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ```

#### Acceptance Criteria

- All three IPC channels are in `ALLOWED_IPC_CHANNELS`
- `ensureMainSender(event)` is called in every handler (security gate)
- `suggestions:list-packs` returns metadata without exposing full file paths
- `suggestions:install-pack` validates packId format before writing
- `suggestions:remove-pack` validates packId format before constructing path
- Malformed JSON returns structured error, not unhandled exception
- Oversized files are rejected (> 1MB)
- Path traversal attempts (e.g., `../../etc/passwd`) are blocked by packId regex

#### Rollback Plan

- Remove the three `ipcMain.handle` registrations
- Remove the channels from `ALLOWED_IPC_CHANNELS`
- Runtime packs stop working; bundled packs continue unaffected

---

### Epic: Preload Bridge

#### Tasks

- [ ] Add IPC bridges in `electron/preload.cjs`:
  ```js
  listSuggestionPacks: () => ipcRenderer.invoke("suggestions:list-packs"),
  installSuggestionPack: (jsonString) => ipcRenderer.invoke("suggestions:install-pack", jsonString),
  removeSuggestionPack: (packId) => ipcRenderer.invoke("suggestions:remove-pack", packId),
  ```
- [ ] Update `src/globals.d.ts` with type declarations:
  ```ts
  interface Window {
    electron?: {
      // ... existing declarations ...
      listSuggestionPacks?: () => Promise<{
        packs: Array<{
          packId: string;
          name: string;
          commandCount: number;
          fileName: string;
          sizeBytes: number;
        }>;
        error?: string;
      }>;
      installSuggestionPack?: (jsonString: string) => Promise<{
        success: boolean;
        packId?: string;
        fileName?: string;
        error?: string;
      }>;
      removeSuggestionPack?: (packId: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
    };
  }
  ```

#### Acceptance Criteria

- All three methods are exposed via `window.electron`
- Type declarations match the actual IPC response shapes
- Methods are optional (`?.`) — they don't exist in browser-only dev mode

---

### Epic: Runtime Pack Loader (Renderer-Side)

#### Tasks

- [ ] Create `src/features/suggestions/core/runtime-packs.ts`
  ```ts
  export async function loadRuntimePacks(): Promise<{
    packs: SuggestionPack[];
    errors: Array<{ packId?: string; error: string }>;
  }> {
    if (!window.electron?.listSuggestionPacks) {
      return { packs: [], errors: [] };
    }
    const { packs: metadata, error } = await window.electron.listSuggestionPacks();
    if (error) return { packs: [], errors: [{ error }] };
    // For each pack, we need to load and validate the full JSON
    // But list-packs only returns metadata, not full contents
    // Option: extend list-packs to return full data, or add a read-pack channel
    // For MVP: install-pack already stores validated JSON; list-packs could return full data
    // ... implementation depends on chosen strategy
  }
  ```
- [ ] **Design decision needed:** Should `suggestions:list-packs` return full pack data or just metadata?
  - **Option A: Return full data in list-packs.** Simpler — one IPC call loads everything. But sends potentially large data over IPC.
  - **Option B: Add a `suggestions:read-pack` channel.** More IPC calls but each is bounded. Better for large pack counts.
  - **Recommendation: Option A for MVP.** With a 1MB per-pack limit and realistic pack counts (< 20), total data is well within IPC capacity.

- [ ] Validate runtime packs using `validatePacks()` from schema module
- [ ] Merge runtime packs with bundled packs via `engine.addPacks()`
- [ ] Handle conflicts: runtime pack with same `packId` as bundled pack overrides bundled
- [ ] Log warnings for invalid runtime packs (pack ID and error type only — never log user pack contents)

#### Acceptance Criteria

- Runtime packs load and validate on app start
- Invalid runtime packs are skipped with logged errors
- Runtime packs merge with bundled packs
- Duplicate `packId` between runtime and bundled → runtime wins
- No user pack content appears in logs

#### Testing Requirements

- Manual test: place a valid JSON pack in the pack directory, restart app, verify suggestions from new pack
- Manual test: place an invalid JSON file, restart app, verify app loads without errors
- Manual test: place a pack with same `packId` as a bundled pack, verify runtime version is used

---

### Epic: Pack Validation Feedback (Future Settings UI)

#### Tasks

- [ ] **Defer to future phase:** Add a "Suggestion Packs" tab in settings to:
  - List installed runtime packs with validation status
  - Show pack errors in a readable format
  - Allow removing installed packs
  - Allow importing packs from file picker
- [ ] For MVP: runtime packs are managed by manually placing files in the pack directory
- [ ] Document the pack directory location in a README or help text

#### Acceptance Criteria (Future)

- Settings UI shows all installed packs (bundled + runtime)
- Bundled packs are marked as "Built-in" and cannot be removed
- Runtime packs show remove button
- Validation errors are shown inline per-pack

#### Rollback Plan

- Remove the settings UI panel
- Runtime packs still work via filesystem, just without a management UI
