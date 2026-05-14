# SSH Security Scanners

## Goal

Implement the SSH-focused scanners and related remediation prerequisites for root login, password authentication, SSH port exposure, weak algorithms, config parsing, and lockout prevention.

## Architectural Analysis

SSH is both the product transport and the target being hardened, so mistakes here can sever the user's active session. The scanner can be read-only, but its outputs will drive the highest-risk remediation actions. The parsing layer must therefore be better than simple `grep`.

OpenSSH configuration semantics include defaults, duplicate directives, `Include` files, and `Match` blocks. Some settings are not equivalent globally and per-user. The safest approach is to parse the effective configuration with a combination of file parsing and `sshd -T` when available. File parsing is still necessary to generate precise diffs and backups.

Port changes and password-auth disablement must never be treated as ordinary text edits. They require preflight checks, firewall sequencing, parallel connection validation, and rollback watchdogs from `04-remediation-rollback-and-safe-execution.md`.

## Dependencies

- Scan engine and command runner.
- SSH config parser with include and match awareness.
- Remote command allowlist for `sshd -T`, `ss`, `getent`, and safe file reads.
- Remediation engine before any SSH config mutation ships.
- UI consent and command-preview flows.

## Risks

- Disabling password authentication without verifying key access can lock out the user.
- Changing the SSH port before firewall/cloud firewall readiness can lock out the user.
- `Match` blocks can make global findings misleading.
- `sshd -T` may require root or may not be available on older systems.
- Cloud-init, Ansible, or other config managers can overwrite local changes after reboot.

## Epics

### Epic: SSH Config Parser

#### Tasks

- [ ] Build an `sshd_config` parser for scanner use.
  - [ ] Parse key/value directives case-insensitively.
  - [ ] Preserve file path and line number where available.
  - [ ] Resolve `Include` directives for common OpenSSH versions.
  - [ ] Represent `Match` blocks separately from global defaults.
  - [ ] Track duplicate directives and final effective value order.
- [ ] Add optional `sshd -T` effective config collector.
  - [ ] Use it to validate parser output when available.
  - [ ] Mark settings as `unknown` if parser and effective output conflict.
- [ ] Detect config management hints.
  - [ ] Cloud-init comments.
  - [ ] Ansible/Puppet/Chef markers.
  - [ ] Distro-managed include directories.
- [ ] Produce diff-ready config locations for remediation planning.

#### Acceptance Criteria

- Parser handles default file, include directories, comments, duplicate directives, and match blocks.
- Findings identify whether they are based on global config, effective config, or both.
- Remediation planner can locate the safest file to edit or decide that manual review is required.

#### Rollback Plan

- If parser confidence is low, mark related findings as review-required and disable one-click remediation.

#### Testing Requirements

- Fixture tests for Ubuntu/Debian sshd configs, include files, match blocks, duplicate directives, missing files, and malformed lines.
- Comparison tests using captured `sshd -T` output.

### Epic: Root Login And Password Authentication Checks

#### Tasks

- [ ] Implement `ssh.root_login` scanner.
  - [ ] Parse `PermitRootLogin`.
  - [ ] Detect root password lock state via `getent shadow root` when privileges allow.
  - [ ] Detect `/root/.ssh/authorized_keys` presence without reading key material where possible.
  - [ ] Distinguish root password login from root key-only login.
- [ ] Implement `ssh.password_auth` scanner.
  - [ ] Parse `PasswordAuthentication`.
  - [ ] Parse `ChallengeResponseAuthentication`.
  - [ ] Parse `KbdInteractiveAuthentication`.
  - [ ] Parse `UsePAM` and mark contextual ambiguity.
  - [ ] Check at least one non-root user has an SSH key before remediation is offered.
- [ ] Add safety prerequisites to findings.
  - [ ] Current session auth method known.
  - [ ] Key-based login verified.
  - [ ] Non-root sudo user available if root login will be disabled.

#### Acceptance Criteria

- Root login + password auth enabled produces a Critical finding.
- Password auth enabled with key access available produces a High finding with remediation available.
- Password auth enabled without verified key access produces a High finding with remediation blocked until verification.
- Findings explain when settings may differ under `Match` blocks.

#### Rollback Plan

- SSH auth remediation remains disabled unless the rollback watchdog and parallel connection test exist.

#### Testing Requirements

- Parser and scanner fixtures for root login `yes`, `no`, `prohibit-password`, `without-password`, and unset.
- Tests for password auth settings across old and new OpenSSH names.
- Tests for key verification gating.

### Epic: SSH Port Analysis

#### Tasks

- [ ] Implement `ssh.port` scanner.
  - [ ] Parse configured `Port` values.
  - [ ] Verify actual listeners with `ss -tlnp` or fallback command.
  - [ ] Detect port 22 and label it as noise-reduction recommendation, not a primary security boundary.
  - [ ] Detect multiple listening ports.
  - [ ] Detect whether the active session port matches scanned config.
- [ ] Add firewall dependency checks.
  - [ ] Current SSH port allowed.
  - [ ] Candidate new port available.
  - [ ] UFW/iptables/nft backend understood before remediation.
- [ ] Add SELinux/AppArmor note as future/non-MVP for non-Debian systems.

#### Acceptance Criteria

- Scanner reports configured port, active listening port, and current session port separately.
- Remediation is blocked unless firewall sequencing can be planned.
- The UI copy does not overclaim that changing ports is strong security.

#### Rollback Plan

- Port-change remediation must keep old port open until new connection validation succeeds.

#### Testing Requirements

- Fixtures for default port, custom port, multiple ports, listener mismatch, and no permission to inspect process names.

### Epic: SSH Crypto And Session Hardening Checks

#### Tasks

- [ ] Implement weak algorithm scanners.
  - [ ] KexAlgorithms.
  - [ ] Ciphers.
  - [ ] MACs.
  - [ ] Legacy protocol directive where present.
- [ ] Implement session hardening checks.
  - [ ] `MaxAuthTries`.
  - [ ] `LoginGraceTime`.
  - [ ] `PermitEmptyPasswords`.
  - [ ] `X11Forwarding`.
  - [ ] `ClientAliveInterval`.
  - [ ] `ClientAliveCountMax`.
  - [ ] `AllowTcpForwarding` as context-dependent audit-only.
- [ ] Maintain a versioned weak-algorithm list.
- [ ] Keep recommendations compatible with supported Ubuntu/Debian OpenSSH versions.

#### Acceptance Criteria

- Weak crypto findings include the exact algorithm names detected.
- Hardening findings distinguish security-critical issues from preference/context items.
- Remediation proposals never remove all supported algorithms from older systems.

#### Rollback Plan

- Crypto remediation should be staged behind config validation using `sshd -t` before reload.

#### Testing Requirements

- Unit tests for weak algorithm detection.
- Fixtures for older OpenSSH servers where some modern algorithms are unavailable.
- Tests that generated hardening config passes a fixture validation path.

### Epic: SSH Remediation Preconditions

#### Tasks

- [ ] Implement key-based login verification flow.
  - [ ] Confirm current or selected credential can open a second session.
  - [ ] Keep original session alive.
  - [ ] Record verification result only for the current host fingerprint and user.
- [ ] Implement `sshd -t` validation before reload.
- [ ] Implement reload-not-restart behavior for supported systems.
- [ ] Define when remediation must be blocked.
  - [ ] No verified key login.
  - [ ] No rollback manifest created.
  - [ ] Parser confidence low.
  - [ ] Config manager ownership detected.
  - [ ] Firewall backend unknown for port changes.

#### Acceptance Criteria

- Every SSH write action has explicit preconditions.
- Users see why a fix is unavailable instead of receiving a dangerous button.
- Reload failure triggers rollback rather than leaving config partially applied.

#### Rollback Plan

- Background watchdog restores backed-up SSH config and reloads sshd if validation callback fails.

#### Testing Requirements

- Fake executor tests for `sshd -t` failure, reload failure, second-session failure, and watchdog rollback.

