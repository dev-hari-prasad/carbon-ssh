# Lockdown Protocols

## Goal

Implement one-click lockdown protocols as safe bundles of deterministic remediation actions with explicit role assumptions, preflight gates, staged execution, rollback manifests, and high-friction consent.

## Architectural Analysis

Lockdown protocols are product-defining, but they should not be implemented as "run all fixes." A protocol is a policy-backed action plan for a known server role. Each protocol must declare assumptions, required checks, included actions, excluded actions, danger rating, and rollback strategy.

The plan lists Personal VPS, Production Server, AI GPU Machine, Docker Host, and Startup SaaS Server. MVP should resist implementing all of them at once. Personal VPS is the safest first protocol if individual SSH/firewall/fail2ban remediations already work. Production Server and Docker Host add enough operational risk that they should ship only after telemetry, manual QA, and rollback prove reliable.

The hidden trap is service availability. A Personal VPS can tolerate stricter defaults. A production server may need ports, Docker behavior, monitoring agents, CI deploy users, and provider firewalls preserved. Protocol execution must detect the live system and ask before closing anything.

## Dependencies

- Remediation action registry.
- Rollback/watchdog system.
- SSH scanners.
- Firewall/fail2ban/Docker scanners.
- UI consent flow that supports typed confirmation for protocol execution.
- Scan freshness and host fingerprint verification.

## Risks

- Bundling actions increases blast radius and makes failure attribution harder.
- Protocol defaults may not match the user's actual server role.
- Package installation and service reloads can disrupt workloads.
- Docker protocol changes can restart or break containers.
- Users may treat lockdown as a security guarantee.

## Epics

### Epic: Protocol Engine

#### Tasks

- [ ] Define `LockdownProtocol`.
  - [ ] Protocol ID and version.
  - [ ] Target server role.
  - [ ] Included remediation actions.
  - [ ] Excluded actions.
  - [ ] Danger level.
  - [ ] Required scan modules.
  - [ ] Required host capabilities.
  - [ ] Preflight blockers.
  - [ ] Rollback aggregation strategy.
  - [ ] User-facing change summary.
- [ ] Implement protocol planner.
  - [ ] Validate scan freshness.
  - [ ] Match protocol assumptions to host state.
  - [ ] Convert findings to ordered actions.
  - [ ] Identify actions that need user choices.
  - [ ] Produce final execution plan.
- [ ] Implement staged execution.
  - [ ] Run lower-risk package/config actions before high-risk SSH/firewall changes when appropriate.
  - [ ] Validate between stages.
  - [ ] Stop on first critical failure.
- [ ] Implement aggregate rollback.
  - [ ] Roll back only completed stages.
  - [ ] Preserve manifest links for each child action.

#### Acceptance Criteria

- Protocol execution cannot start from stale or incomplete scan data.
- Users see the exact action list and affected ports/config files before confirmation.
- Failure in one stage does not hide which actions succeeded or failed.

#### Rollback Plan

- Protocols should execute as child remediations with individual rollback manifests, plus a parent protocol manifest.

#### Testing Requirements

- Planner tests for supported/unsupported hosts, missing prerequisites, mixed action availability, and staged failure.

### Epic: Personal VPS Protocol

#### Tasks

- [ ] Implement protocol assumptions.
  - [ ] Ubuntu/Debian.
  - [ ] Single-host VPS.
  - [ ] User wants SSH + HTTP/HTTPS open by default.
  - [ ] No complex custom firewall detected.
- [ ] Include actions.
  - [ ] Disable root SSH login after sudo user/key verification.
  - [ ] Disable password authentication after key verification.
  - [ ] Install/configure UFW with SSH, HTTP, HTTPS.
  - [ ] Install/configure fail2ban for sshd.
  - [ ] Enable unattended security upgrades if package policy is approved.
  - [ ] Disable X11 forwarding.
  - [ ] Optionally change SSH port only as a separate high-risk step.
- [ ] Add decisions for user.
  - [ ] Keep port 22 or move to suggested high port.
  - [ ] Open HTTP/HTTPS.
  - [ ] Create non-root deploy user if only root exists.
- [ ] Add post-protocol scan and score comparison.

#### Acceptance Criteria

- Protocol blocks if key login cannot be verified.
- Protocol preserves current SSH access throughout.
- User receives before/after findings and rollback availability.

#### Rollback Plan

- Parent rollback restores SSH config, UFW state, fail2ban config, and unattended-upgrades config from child manifests.

#### Testing Requirements

- Manual QA on fresh Ubuntu VPS snapshot.
- Tests for root-only host, non-root sudo host, custom SSH port, UFW already active, and fail2ban already customized.

### Epic: Production Server Protocol

#### Tasks

- [ ] Define stricter preflight than Personal VPS.
  - [ ] Detect public listeners and ask which should remain open.
  - [ ] Detect database ports and require explicit selection before exposure remains.
  - [ ] Detect monitoring/deploy users.
  - [ ] Detect Docker and defer Docker-specific actions to Docker Host protocol when needed.
- [ ] Include actions.
  - [ ] Personal VPS baseline except optional SSH port change defaults to off.
  - [ ] SSH crypto hardening.
  - [ ] Sysctl security parameters after compatibility review.
  - [ ] Sudo/NOPASSWD review.
  - [ ] Unattended security updates with conservative reboot behavior.
- [ ] Add maintenance-window warning.
- [ ] Add application reachability checklist after firewall changes.

#### Acceptance Criteria

- Protocol does not close detected public application ports without explicit user choice.
- Auto-reboot for unattended upgrades is disabled by default for production.
- User can export the proposed plan before executing.

#### Rollback Plan

- Same as Personal VPS plus sysctl and sudoers backup/restore.

#### Testing Requirements

- Fixture planner tests for common SaaS host layouts: nginx reverse proxy, direct Node port, PostgreSQL local-only, Redis accidentally public.
- Manual production-like staging VM QA.

### Epic: Docker Host Protocol

#### Tasks

- [ ] Define Docker-specific preflight.
  - [ ] Docker daemon active.
  - [ ] Running containers detected.
  - [ ] Published ports listed.
  - [ ] Docker daemon config ownership understood.
- [ ] Include read-only-first actions.
  - [ ] Flag exposed Docker TCP daemon.
  - [ ] Flag docker group users.
  - [ ] Flag privileged/host-network/socket-mounted containers.
  - [ ] Flag UFW bypass.
- [ ] Implement safe remediations cautiously.
  - [ ] Close Docker TCP daemon only with daemon restart warning and rollback.
  - [ ] Recommend container changes rather than auto-changing running containers in MVP.
  - [ ] Add UFW/Docker hardening as guided advanced flow.
- [ ] Add container impact warning.

#### Acceptance Criteria

- Protocol never restarts Docker without explicit high-danger consent.
- UFW bypass is displayed even if UFW status is otherwise healthy.
- Remediation availability distinguishes host-level fixes from container redesign guidance.

#### Rollback Plan

- Docker daemon config changes require backup, daemon validation, restart plan, and rollback restart.

#### Testing Requirements

- Docker fixture tests and manual QA on a disposable Docker host with published ports and privileged container cases.

### Epic: Deferred Protocols

#### Tasks

- [ ] Keep AI GPU Machine protocol as post-MVP.
  - [ ] Requires GPU process/driver awareness.
  - [ ] Requires Jupyter/TensorBoard detection.
  - [ ] Requires expensive-workload disruption warnings.
- [ ] Keep Startup SaaS Server protocol as post-Production hardening.
  - [ ] Requires stronger app-service discovery.
  - [ ] Requires team/audit/compliance assumptions.
- [ ] Add clear roadmap markers without stubbing fake buttons in UI.

#### Acceptance Criteria

- Deferred protocols are documented but not selectable until scanner/remediation support is real.

#### Rollback Plan

- None; avoid shipping placeholder protocols.

#### Testing Requirements

- Product tests verify unavailable protocols are hidden or labeled "coming later" without executing.

