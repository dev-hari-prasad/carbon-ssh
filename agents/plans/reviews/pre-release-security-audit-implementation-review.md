# Implementation Review

**Scope:** Pre-release security audit (`agents/plans/pre-release-security-audit.md` and `agents/plans/sub-plans/pre-release-security-audit/*`)  
**Review date:** 2026-05-17  
**Repository truth source:** current `main` workspace (Carbon SSH / `carbon-ssh`)

> **Path note:** This review is stored under `agents/plans/reviews/` to align with existing plan layout. The skill’s example path `plans/reviews/` is satisfied by this location.

---

## Repository Architecture Summary

Carbon is a **local-first SSH client** composed of:

| Layer | Role | Key entry / artifacts |
|--------|------|------------------------|
| **Next.js (App Router)** | Renderer UI, API routes | `src/app/`, `src/features/`, `server.ts` (dev) |
| **Electron main** | IPC, `safeStorage`, window lifecycle, packaged server bridge | `electron/main.cjs`, `electron/preload.cjs`, `electron/defense.cjs` |
| **Dev WebSocket SSH** | Plain Node `tsx server.ts` → `src/lib/ws-handler.ts` | No Electron `app` / no `secureStore` file for known-hosts |
| **Prod WebSocket SSH** | Electron path → `electron/ws-handler.cjs` | Uses `electron/secure-store.cjs` known-hosts + renderer trust flow |
| **Persistence** | Connections metadata + secrets split by adapter | `src/lib/storage.ts`, `src/lib/credentials.ts`, `electron/secure-store.cjs` |
| **Logs DB** | SQLite when native addon loads | `src/lib/db.ts` → `better-sqlite3` (cwd `database.sqlite` in dev, tmp in some runs) |
| **CI** | Lint, `tsc`, tests, audit, build, SBOM, custom guards (explicit SQLite suffixes, `rg` trivial `hostVerifier`) | `.github/workflows/ci.yml` |

Testing: **Vitest** (`pnpm test`), present in CI after the typecheck step.

---

## Runtime Boundaries

1. **Browser / Next dev client** — Same origin as app; WebSocket to local server; optional `window.electron` absent during pure browser dev.
2. **Electron renderer** — `preload` exposes a narrow API; secrets cross via **invoke/handle** IPC, not arbitrary `remote`.
3. **Electron main** — Owns `safeStorage`, secure store file under `userData`, SSH handler in production builds.
4. **Dev Node server** — `server.ts` + `ws-handler.ts`: full Node but **not** Electron; cannot import `secure-store.cjs` without breaking (per sub-plan 01 analysis).
5. **Remote SSH hosts** — Trust decisions: prod uses TOFU + mismatch block + `host-key-untrusted` UI; dev uses **session-scoped** TOFU (`Map`) + console warnings.

---

## Security Boundaries

| Boundary | Mechanism | Residual risk |
|----------|-----------|----------------|
| Renderer ↔ main | `contextBridge` + `ipcMain.handle` with sender checks on sensitive handlers | IPC surface must stay minimal; new channels need review |
| Renderer ↔ dev WS | Localhost WebSocket; SSH still terminates in Node | Network position on dev machine can still MITM **if** something proxies WS — dev-only concern |
| Stored app lock | Electron: scrypt + `safeStorage` blob in `secure-store` JSON; Browser: PBKDF2 envelope in `localStorage` (`apw1:`) | Browser mode weaker than OS keychain; documented tradeoff in sub-plan 03 |
| Connection secrets | OS secure storage path vs dev plaintext in localStorage | Already existed; app-lock work does not change that split |
| Logs | SQLite / JSON — no connection table in audited dev DB | Log text may still echo user activity |

---

## Existing Implementation State

### Sub-plan 01 — Host key verification hardening

| Item | State |
|------|--------|
| Dead `src/lib/ssh.ts` | **Removed** (no renderer bypass path) |
| Dev `hostVerifier` unconditional accept | **Replaced** with session TOFU + mismatch **false** in `src/lib/ws-handler.ts` (`devKnownHosts`) |
| Prod `electron/ws-handler.cjs` | **Already** strict TOFU / mismatch handling (unchanged in this pass) |
| UI `host-key-untrusted` | **Already** handled in renderer (`TerminalView.tsx` per prior plan) |
| CI grep for bypass patterns | **Present** + banned file check for `ssh.ts` |

### Sub-plan 02 — SQLite hygiene

| Item | State |
|------|--------|
| `.gitignore` WAL/SHM | **Added** `*.sqlite-wal`, `*.sqlite-shm` |
| CI anti-commit | **Fails** if `git ls-files --cached` matches `.sqlite` |
| Tracked DB files | Confirmed pattern: **none** in index (verify with `git ls-files --cached '*.sqlite'`) |
| One-time DB audit | Documented in sub-plan 02 file: dev DB shows **`logs`** table only |

### Sub-plan 03 — App lock password encryption

| Item | State |
|------|--------|
| Electron storage | **Implemented** in `electron/secure-store.cjs` (`saveAppLockHash`, `verifyAppLockPassword`, `clearAppLockHash`) |
| IPC + preload | **`set-app-lock-password`**, **`verify-app-lock-password`**, **`clear-app-lock-password`** |
| Renderer | **`savePasswordAccess`**, **`verifyAppLockPassword`**, **`migrateAppLockPasswordIfNeeded`**, **`clearStoredAppPassword`** in `storage.ts` |
| Migration | **`AppLockMigrationGate`** in `src/app/page.tsx` runs migration before UI |
| Disable lock / factory reset / passkey switch | **Clears** app-lock material via `clearStoredAppPassword` / `saveAccessSettings` / `fullFactoryResetAndReload` hooks |

### Sub-plans 04–06 (reference)

| Sub-plan | State (high level) |
|----------|---------------------|
| **04** Test framework & security tests | **Partially** aligned: Vitest + `pnpm test` in CI; dedicated security tests from 04 may still be incomplete vs doc |
| **05** Code signing / notarization | **Not** done in code (release pipeline / certs external) |
| **06** Dev server hardening | **Not** evaluated in this review pass |

---

## Plan Mismatches

1. **Skill timing vs practice:** This review was produced **after** substantial implementation of sub-plans 01–03; the skill ideally runs **before** sub-plan execution. The “Plan Mismatches” section below still records where **original** umbrella plan text diverged (as captured in `00-overview.md`): e.g. claims that production lacked host-key verification or `ssh.ts` was reachable were already **false** at planning time.
2. **CI grep limitations:** The workflow uses line-based patterns **plus** `rg -U` detection for a **trivial** `hostVerifier` callback body that is only `{ return true; }`. Multiline bypasses that embed other statements before `return true` remain a code-review concern; AST-based lint would still be optional extra hardening.
3. **electron-builder WAL/SHM:** **`electron-builder.yml`** now excludes `!**/*.sqlite-wal` and `!**/*.sqlite-shm` alongside existing `*.sqlite` / journal rules, mirroring `.gitignore`.

---

## Dependency Graph Analysis

- **App lock** depends on: `safeStorage` availability, `secure-store` schema (`appLockHash` field), preload API surface, **`storage.ts`** access settings + migration ordering, **`page.tsx`** bootstrap order.
- **Dev SSH host keys** depend on: **`ws-handler.ts`** module singleton `devKnownHosts` (clears on **server process** restart only).
- **SQLite CI** depends on: git index cleanliness; does not validate “no binary DB in working tree untracked” (intentionally).
- **Upstream:** `ssh2` `hostVerifier` contract remains **synchronous** — prod/dev both avoid “async trust” inside the callback.

---

## Migration Risk Analysis

| Migration | Backward compatibility | Failure mode | Mitigation in tree |
|-----------|------------------------|--------------|---------------------|
| Plaintext `ssh.temp-pwd` → Electron hash | Old users keep password | IPC / `safeStorage` throws | Migration **try/catch** logs; plaintext only removed after successful Electron `setAppLockPassword` |
| Plaintext → browser `apw1:` envelope | Unlock still works | Crypto unavailable | Assumes modern `SubtleCrypto`; dev browser is best-effort |
| Disable app lock | Clears secure hash + local remnants | Async clear races | `void clear` on disable; factory reset **awaits** clear first |
| Dev host key change | Next connect **blocked** until server restart clears `Map` OR key restored | Dev confusion | Documented: restart dev server resets TOFU map |

---

## Blast Radius Analysis

| Area | Blast radius | Notes |
|------|----------------|-------|
| **`electron/secure-store.cjs`** | **High** — all secrets file | App lock adds one more field; malformed JSON still falls back via existing read patterns |
| **`electron/main.cjs` IPC** | **High** — new surface | Handlers use `ensureMainSender` like other secret paths |
| **`src/lib/storage.ts`** | **Medium** — all local settings | App lock logic colocated with vault / connection load |
| **`src/lib/ws-handler.ts`** | **Medium** — dev-only SSH | Wrong change breaks `pnpm dev` SSH only |
| **CI workflow** | **Low** — false positives | Grep-based checks can bite refactors; tune patterns if noisy |

---

## Rollout Complexity

- **01 / 02:** Low — no user-facing flags; devs may need once to understand dev host-key warnings and restarts.
- **03:** Medium — one-time migration per profile; risk window is first launch after upgrade; **no** feature flag in current implementation (acceptable for pre-release audit scope).

---

## Operational Concerns

1. **Lost `safeStorage` / OS keychain reset:** Electron app-lock verification fails until user resets lock (same class of problem as other secrets in store).
2. **Dev SSH:** Session TOFU is **weaker** than prod (no cross-session persistence); aligns with “local dev” threat model from sub-plan 01.
3. **Log DB path:** `database.sqlite` in cwd for dev (per `db.ts`) — ensure support docs mention it is **not** for credentials (confirmed by audit).

---

## Missing Infrastructure

- **Dedicated security test suite** exactly as specified in sub-plan 04 (may still be partial).
- **Structured telemetry** for migration success/failure counts (optional; not required by 01–03).
- **Multiline / AST-based** host-verifier lint: partially addressed via **`rg -U`** trivial-body check in CI; full AST rule still optional.

---

## Missing Security Controls

- **Browser app lock** remains **memory-derived** secrets in `localStorage` (hashed, not plaintext); not equivalent to `safeStorage`.
- **IPC password** still transits renderer → main in the clear **in process** (standard Electron; consider reducing lifetime of strings if threat model requires).
- **Dev server** websocket auth / lockdown is explicitly **sub-plan 06**, not done here.

---

## Architectural Weaknesses

1. **Dual password verification implementations** (Electron scrypt vs browser PBKDF2) — necessary given environments; must stay parameter-documented and drift-free.
2. **In-memory dev known hosts** — by design; inconsistent with prod UX (no modal) — reduces dev friction at cost of weaker dev TOFU.
3. **Secure store monolith** — single JSON file holds multiple secret types; corruption risk is centralized (pre-existing pattern).

---

## Recommended Implementation Ordering

For any **remaining** audit work, preserve this order (from `00-overview.md`):

1. **04** — Tests for sanitizer, credential paths, host-key logic (foundation before more security refactors).
2. **03-adjacent** — Any follow-up: IPC hardening, erase password from memory (if required).
3. **05** — Release pipeline (external deps).
4. **06** — Dev server WS token / strict mode (post-release acceptable per overview).

---

## Blockers

- **None identified** for merging 01–03 from a “security design intent” standpoint, assuming **CI green** (`tsc`, `vitest`, lint, build).
- If **TypeScript** or **tests** fail on a branch, treat that as a **merge blocker** (process, not architecture).

---

## Safe Refactor Recommendations

- Extract **shared host-key fingerprint** helper for dev + prod if drift appears (keep Electron vs dev storage split explicit).
- Consider **unit tests** for fingerprint map key `host:port` edge cases (IPv6, bracket notation).
- Consider **single module** for app-lock constants (max password length shared main/renderer).

---

## Areas Requiring Feature Flags

- **None** for 01–02.
- **03** rollout could use a flag for “delayed migration” in high-risk fleets; **not implemented** — acceptable if release audience is controlled.

---

## Areas Requiring Staged Rollout

- **Electron auto-update cohorts** if migrating large userbases — operational, not coded.
- **`safeStorage` platform quirks** — watch Windows/macOS support tickets after first release with app-lock hash path.

---

## Areas Requiring Rollback Support

- **Migration:** plaintext retained until successful Electron migrate (per sub-plan risk table).
- **Rollback release:** Users who migrated off plaintext cannot downgrade to plaintext format without resetting app lock — document in release notes.

---

## Testing Requirements

| Layer | Needed |
|--------|--------|
| **Unit** | Fingerprint derivation consistency; timing-safe compares; envelope parse/migrate predicates |
| **Integration** | IPC set/verify/clear app lock (Electron harness or e2e) |
| **Manual** | Dev SSH first connect warning + mismatch block; onboarding password + unlock post-migration |

Sub-plan **04** remains the umbrella for formalizing automated coverage.

---

## Final Risk Assessment

**Overall:** Sub-plans **01–03** are **implemented in code** consistently with documented constraints (dev vs prod SSH trust, Electron vs browser app lock). Residual risks are mainly **dual crypto paths**, **secure-store monolith**, and **scope** left to **04–06**; CI now also rejects trivial multiline **`return true`** `hostVerifier` bodies and aligns **electron-builder** with WAL/SHM ignores.

**Recommendation:** Proceed with formal QA checklist from sub-plans, prioritize **04** tests next, then **06** when dev-threat model tightening is scheduled.
