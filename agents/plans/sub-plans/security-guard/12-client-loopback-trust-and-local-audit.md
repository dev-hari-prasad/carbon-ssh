# Client Loopback Trust And Local Audit

## Goal

Document and implement the **local trust boundary** for Security Guard: same-user attackers on the workstation, Electron + embedded HTTP/WebSocket surfaces, and **client-side audit** so remediations are attributable and supportable without trusting obscurity alone.

This sub-plan exists because `agents/plans/security-guard.md` **Appendix D** calls out risks that are not fully covered by SSH host trust (`10-strict-host-key-validation.md`) or remote parameterized execution (`11-parameterized-shell-execution.md`).

## Architectural Analysis

Security Guard’s worst-case failures include **remote lockout**, but a separate class of failures is **local abuse**: malware or tooling on the same OS user account can speak to `127.0.0.1` services, replay tokens visible to the renderer, or fuzz internal APIs. No desktop app can fully defeat a compromised same-user process; the goal is to **align blast radius with a clear threat model** and to **avoid accidental “security by header name”** for high-impact actions.

Remediation orchestration should **prefer the Electron main process** (or an equivalent trusted broker) for: invoking mutating pipelines, reading stored credentials, and attesting that a given remediation was user-consented in the active session. The renderer remains responsible for UX, but should not be the only gate for “internal” calls that can change production servers.

The **client audit log** (complementing target-side manifests in `04-remediation-rollback-and-safe-execution.md`) must record enough to debug incidents **without** storing secrets or full terminal transcripts: who confirmed (user gesture), when, which connection/fingerprint, action ID/version, feature flags, and outcome.

## Dependencies

- `01-scan-engine-and-data-model.md` (scan IDs, finding IDs, versioning).
- `04-remediation-rollback-and-safe-execution.md` (snapshots, manifests, local audit sketch).
- `07-ui-consent-and-terminal-integration.md` (consent UX, previews).
- `09-testing-rollout-and-operations.md` (diagnostics export, release gates).
- `10-strict-host-key-validation.md` (session identity binding).

## Risks

- Treating static HTTP headers or predictable loopback ports as **authentication** for mutating operations.
- Split-brain orchestration where half the pipeline runs in renderer and half in main, enabling confused-deputy flows.
- Audit logs that accidentally retain raw command output, tokens, or scan evidence at overly sensitive fidelity.
- Over-promising protection against same-user malware.

## Epics

### Epic: Threat Model And Documentation

#### Tasks

- [ ] Document **same-user local attacker** scope for Carbon + Security Guard (desktop baseline).
- [ ] Document what is **out of scope** (other OS users without escalation, remote attackers without local code — covered by SSH/TLS and host keys).
- [ ] Cross-link `security-guard.md` Appendix D from internal security docs or `00-overview.md`.

#### Acceptance Criteria

- Engineering and support share one canonical threat-model paragraph for local trust.
- Release notes for Security Guard mention local-trust assumptions where relevant.

#### Rollback Plan

- Documentation-only; no feature rollback.

#### Testing Requirements

- N/A (documentation review).

### Epic: Orchestration Boundary (Main vs Renderer)

#### Tasks

- [ ] Route **mutating remediation** initiation through a **single trusted path** (Electron main or dedicated trusted service), not ad hoc renderer `fetch` to privileged routes.
- [ ] Replace or harden “internal only” markers (e.g. header-based) with **session-issued, unguessable secrets** where feasible for loopback APIs used by Security Guard.
- [ ] Ensure connection secrets used for remediation are **not** re-exposed to the renderer beyond what UI already needs.
- [ ] Add defense-in-depth: rate limits or debounce on sensitive loopback endpoints where applicable.

#### Acceptance Criteria

- Security review can trace one linear path from “user clicked Apply” to “SSH mutating command” with explicit checks.
- Spoofing internal calls from arbitrary renderer contexts is blocked or materially harder than adding a static header.

#### Rollback Plan

- Feature-flag trusted-path orchestration; fall back only to non-mutating scan mode.

#### Testing Requirements

- Automated tests that attempt unauthorized initiation (wrong secret, wrong sender, missing consent record).
- Manual test checklist for packaged vs dev builds.

### Epic: Client-Side Audit Log (Security Guard)

#### Tasks

- [ ] Extend local audit records for Security Guard events.
  - [ ] Scan start/complete with scan rule version.
  - [ ] Remediation: action ID/version, target fingerprint, consent timestamp, operator surface (`renderer` vs `main`).
  - [ ] Rollback and watchdog outcomes.
  - [ ] Feature flag snapshot.
- [ ] Define **retention** and export redaction rules consistent with `04` and `09`.
- [ ] Store **manifest reference IDs** linking to target-side rollback artifacts without copying secrets.

#### Acceptance Criteria

- Support can answer “what did the app think it executed, and under which version?” without SSH passwords or private keys.
- Audit DB/file permissions match Carbon’s existing userData hardening stance.

#### Rollback Plan

- If persistence fails, block mutating remediation (per `04` epic guidance).

#### Testing Requirements

- Redaction tests; corrupted audit store recovery; multi-step partial failure scenarios.

### Epic: Dev / Prod Parity Notes

#### Tasks

- [ ] Ensure Security Guard engineering does not **routinely** test mutating remediations against servers while SSH host verification is disabled in dev-only paths.
- [ ] Document required QA matrix: packaged app + verified host keys for any high-risk remediation QA.

#### Acceptance Criteria

- Internal runbooks state when dev shortcuts are forbidden for Security Guard QA.

#### Rollback Plan

- N/A.

#### Testing Requirements

- CI or checklist gate for release candidates.

---

## Relation To Other Sub-Plans

- **10:** Host identity on the wire.
- **11:** Input safety on remote shell construction.
- **12:** Identity and trust **on the workstation** between components and for auditability.
- **04 / 09:** Target snapshots + operational release hygiene; **12** does not duplicate rollback file formats.
