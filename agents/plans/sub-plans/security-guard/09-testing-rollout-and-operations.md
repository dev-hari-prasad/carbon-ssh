# Testing, Rollout, And Operations

## Goal

Ship Security Guard safely through feature flags, fixture-heavy scanner tests, disposable-host QA, staged rollout, support diagnostics, incident response preparation, and explicit open-question resolution.

## Architectural Analysis

Security Guard cannot rely on ordinary unit tests alone because the riskiest behavior occurs at the boundary between Carbon, SSH, Linux services, firewalls, and user consent. The test strategy needs layers: pure parser fixtures, fake SSH executor tests, disposable VM integration tests, manual QA for lockout paths, and release gates that block dangerous remediations until rollback is proven.

Rollout should be incremental. First ship read-only scanning behind a feature flag. Then ship low-risk fixes. Then ship SSH/firewall fixes only after watchdog recovery works. Protocols and fleet actions come last. This order preserves trust and gives the team time to learn from real-world scan diversity without putting servers at risk.

Operations matter because failures will happen. The product needs support diagnostics, recoverable error messages, audit exports, and a documented incident playbook before one-click remediation is broadly available.

## Dependencies

- All implementation sub-plans.
- Test framework and fixture organization.
- Disposable VPS or local VM environment for Ubuntu/Debian QA.
- Release/feature-flag system.
- Support diagnostics channel.
- Product/legal review for liability and consent copy.

## Risks

- Parser tests can pass while real servers fail due to distro variance.
- Manual QA can miss timeout/connectivity edge cases.
- Feature flags can leave insecure or inconsistent states if migration logic is not versioned.
- Support logs can accidentally request sensitive server data.
- Overbroad marketing claims can create false expectations.

## Epics

### Epic: Test Fixture Strategy

#### Tasks

- [ ] Create scanner fixture directory.
  - [ ] SSH configs.
  - [ ] `sshd -T` outputs.
  - [ ] UFW outputs.
  - [ ] iptables/nftables outputs.
  - [ ] `ss` listener outputs.
  - [ ] fail2ban configs/status outputs.
  - [ ] Docker daemon/container outputs.
  - [ ] package manager outputs.
- [ ] Add golden finding snapshots.
- [ ] Add malformed/permission-denied fixtures.
- [ ] Add parser coverage for Ubuntu and Debian versions selected for MVP.
- [ ] Add regression fixtures for bugs found in manual QA.

#### Acceptance Criteria

- Each scanner has representative pass, fail, unknown, unsupported, and malformed cases.
- Golden snapshots make finding shape changes explicit in PRs.

#### Rollback Plan

- Scanner modules with weak fixture coverage stay disabled in production builds.

#### Testing Requirements

- Unit tests run locally and in CI without needing real SSH access.

### Epic: Fake SSH Executor And Remediation Tests

#### Tasks

- [ ] Build fake SSH executor.
  - [ ] Script command responses.
  - [ ] Simulate timeout.
  - [ ] Simulate disconnect.
  - [ ] Simulate sudo prompt.
  - [ ] Simulate partial command failure.
- [ ] Test scan pipeline with fake executor.
- [ ] Test remediation pipeline.
  - [ ] Preflight failure.
  - [ ] Snapshot failure.
  - [ ] Execution failure.
  - [ ] Validation failure.
  - [ ] Rollback success.
  - [ ] Rollback failure.
- [ ] Test watchdog success and timeout paths.

#### Acceptance Criteria

- Dangerous remediation behavior is testable without real servers.
- Tests prove no mutating command runs before snapshot and consent.

#### Rollback Plan

- Disable mutating actions if fake executor coverage is incomplete.

#### Testing Requirements

- CI tests for every action state transition and rollback branch.

### Epic: Disposable Host Integration QA

#### Tasks

- [ ] Define supported QA environments.
  - [ ] Fresh Ubuntu LTS VPS or VM.
  - [ ] Fresh Debian stable VPS or VM.
  - [ ] Docker host fixture VM.
  - [ ] Production-like web server fixture.
- [ ] Create manual QA checklist.
  - [ ] Scan completes.
  - [ ] Findings match expected insecure baseline.
  - [ ] Low-risk fix succeeds.
  - [ ] SSH auth fix validates second session.
  - [ ] Firewall enablement preserves SSH.
  - [ ] Watchdog reverts failed validation.
  - [ ] Rollback restores config.
- [ ] Create destructive-test snapshots.
  - [ ] Bad SSH config path.
  - [ ] Wrong firewall port path.
  - [ ] Package manager lock path.
- [ ] Record QA evidence in release checklist.

#### Acceptance Criteria

- No high-risk remediation ships without passing disposable-host QA.
- QA includes at least one intentionally failed lockout-prevention path.

#### Rollback Plan

- Feature flag off for high-risk remediation until QA passes.

#### Testing Requirements

- Manual QA artifacts linked from release/PR notes.

### Epic: Feature Flags And Rollout Phases

#### Tasks

- [ ] Add feature flags.
  - [ ] Security Guard entry point.
  - [ ] Read-only scanning.
  - [ ] AI explanations.
  - [ ] Low-risk remediations.
  - [ ] SSH remediations.
  - [ ] Firewall remediations.
  - [ ] Lockdown protocols.
  - [ ] Fleet scanning.
- [ ] Roll out phases.
  - [ ] Phase 0: internal parser/scanner tests.
  - [ ] Phase 1: internal read-only scans.
  - [ ] Phase 2: beta read-only scans and reports.
  - [ ] Phase 3: low-risk individual fixes.
  - [ ] Phase 4: high-risk fixes with watchdog.
  - [ ] Phase 5: protocols.
  - [ ] Phase 6: fleet/drift.
- [ ] Add kill switch for all mutating actions.
- [ ] Add versioning for scanner, scoring, and remediation action rules.

#### Acceptance Criteria

- Mutating actions can be disabled without removing read-only scan value.
- Users never see unavailable protocol buttons that can execute partial work.
- Scan history records rule versions.

#### Rollback Plan

- Use feature flags to revert to scan-only mode if remediation incidents occur.

#### Testing Requirements

- Tests for feature-flag combinations and disabled-state UI.

### Epic: Support Diagnostics And Incident Response

#### Tasks

- [ ] Add support diagnostics export.
  - [ ] App version.
  - [ ] Security Guard feature flags.
  - [ ] Scan/remediation rule versions.
  - [ ] Redacted action history.
  - [ ] Rollback manifest references.
  - [ ] No credentials, private keys, tokens, or raw terminal logs.
- [ ] Add user-facing error catalog.
  - [ ] Unsupported distro.
  - [ ] Sudo unavailable.
  - [ ] SSH key verification failed.
  - [ ] Firewall preflight failed.
  - [ ] Package manager locked.
  - [ ] Rollback attempted.
  - [ ] Manual recovery required.
- [ ] Write internal incident playbook.
  - [ ] SSH lockout report.
  - [ ] Firewall outage report.
  - [ ] Incorrect CVE finding report.
  - [ ] AI data consent/privacy report.
- [ ] Add public limitation copy.
  - [ ] Security Guard reduces common misconfiguration risk.
  - [ ] It does not guarantee the server is uncompromised.
  - [ ] It is not compliance certification.

#### Acceptance Criteria

- Support can triage failures without asking users for sensitive raw logs.
- Users get clear recovery steps during dangerous failure modes.
- Legal/product limitation language appears in relevant flows and reports.

#### Rollback Plan

- If diagnostics are incomplete, do not enable mutating actions broadly.

#### Testing Requirements

- Redaction tests for diagnostics export.
- Manual review of every high-risk error copy.

### Epic: Open Questions To Resolve

#### Tasks

- [ ] Decide if MVP installs packages or only guides installation.
- [ ] Decide whether remediation is orchestrated in Electron main, shared app services, or terminal/session layer.
- [ ] Decide scan history retention and redaction defaults.
- [ ] Decide how AI data consent is stored and revoked.
- [ ] Decide if cloud firewall context is user-declared in MVP.
- [ ] Decide whether package advisory data is bundled, cached, or fetched on demand.
- [ ] Decide first QA distro versions.
- [ ] Decide monetization gates without compromising safety.

#### Acceptance Criteria

- Each decision has an owner, date, and recorded rationale before implementation depends on it.

#### Rollback Plan

- If a decision remains unresolved, related implementation remains feature-flagged or out of MVP.

#### Testing Requirements

- Release checklist verifies all MVP-blocking decisions are resolved.

