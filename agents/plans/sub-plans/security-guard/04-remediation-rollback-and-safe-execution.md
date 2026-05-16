# Remediation, Rollback, And Safe Execution

## Goal

Build the write-capable safety architecture for Security Guard: remediation planning, command preview, preflight validation, target-side backups, rollback manifests, watchdog recovery, and audit logs.

## Architectural Analysis

This is the highest-risk system in the plan. The feature should not ship any one-click fix before this layer exists because the same primitive that installs fail2ban will eventually edit SSH and firewall state. A remediation action is not "run these commands"; it is a transaction-like operation with prerequisites, evidence, file backups, inverse actions, validation, and recovery.

Linux configuration changes are not truly transactional. The rollback design must therefore be pragmatic: snapshot touched files, record package/service state where possible, run small ordered steps, validate after each risk boundary, and leave a target-side recovery script the user can run manually if Carbon loses connectivity.

The remediation engine should only execute deterministic, code-reviewed actions. AI must not author commands. The command runner should treat mutating commands as a separate allowlist from scan commands.

## Dependencies

- Scan engine and normalized findings.
- SSH/firewall scanners for safety prerequisites.
- Local audit log storage.
- Target-side directory policy for `/var/lib/carbon/`.
- UI confirmation flows.
- Command allowlist/blocklist.

## Risks

- Partial failure can leave configs changed but services not reloaded.
- Rollback scripts can be wrong or unavailable if not generated before mutation.
- Package installation can fail mid-action due to locks or network errors.
- Background watchdogs can outlive the intended operation and revert valid changes.
- Backup files on target can expose sensitive config if permissions are loose.

## Epics

### Epic: Remediation Action Model

#### Tasks

- [ ] Define `RemediationAction`.
  - [ ] Stable action ID and version.
  - [ ] Related finding IDs.
  - [ ] Danger level.
  - [ ] Supported host capabilities.
  - [ ] Required privileges.
  - [ ] Preflight checks.
  - [ ] Planned file writes and commands.
  - [ ] Rollback steps.
  - [ ] Validation checks.
  - [ ] User-visible summary and command preview.
- [ ] Define action states.
  - [ ] Planned.
  - [ ] Preflight failed.
  - [ ] Waiting for consent.
  - [ ] Snapshot created.
  - [ ] Executing.
  - [ ] Validating.
  - [ ] Succeeded.
  - [ ] Rolled back.
  - [ ] Failed manual recovery required.
- [ ] Add danger levels that map to UX friction.
  - [ ] Low: package install or scoped config addition.
  - [ ] Medium: service reloads or firewall additions.
  - [ ] High: SSH auth/port changes, firewall enablement, Docker daemon changes.
- [ ] Implement action registry with static code-reviewed actions only.

#### Acceptance Criteria

- No remediation can execute without declared rollback and validation sections.
- The UI can render the exact command/file plan before execution.
- Action IDs and versions are stored in audit logs for support and rollback.

#### Rollback Plan

- Keep all mutating actions behind feature flags until the model supports end-to-end rollback.

#### Testing Requirements

- Unit tests that reject malformed actions, missing rollback plans, unsupported host capabilities, and commands outside the mutating allowlist.

### Epic: Target-Side Snapshot And Manifest

#### Tasks

- [ ] Create `/var/lib/carbon/` with restrictive permissions before first mutation.
- [ ] Define rollback manifest schema.
  - [ ] Manifest ID.
  - [ ] Target host fingerprint.
  - [ ] User/session metadata without secrets.
  - [ ] Action ID/version.
  - [ ] Touched files.
  - [ ] Original checksums.
  - [ ] Backup paths.
  - [ ] Commands executed.
  - [ ] Inverse commands.
  - [ ] Validation results.
  - [ ] Manual recovery instructions.
- [ ] Implement file backup helper.
  - [ ] Copy before write.
  - [ ] Preserve permissions and ownership.
  - [ ] Store checksum.
  - [ ] Avoid backing up private key material unless absolutely required.
- [ ] Define backup **retention** under `/var/lib/carbon/` (default window, max size, pruning strategy).
  - [ ] Document disk-space expectations and behavior when the volume is full.
  - [ ] Surface non-secret warnings in UX when target retention cannot be enforced.
- [ ] Add user-facing note on backup confidentiality (disk images, provider snapshots, third-party access).
- [ ] Implement package/service state capture where practical.
  - [ ] Package installed before action.
  - [ ] Service enabled/active before action.
  - [ ] Firewall state before action.
- [ ] Generate rollback shell script before mutation.

#### Acceptance Criteria

- Every mutation has a target-side manifest and rollback script created first.
- Backups are root-readable only.
- Rollback manifest can be displayed locally without exposing secrets.

#### Rollback Plan

- If snapshot creation fails, remediation aborts before making changes.

#### Testing Requirements

- Fake filesystem tests for missing files, permission preservation, checksum mismatch, and manifest serialization.
- Integration-style tests against a temp directory command adapter.

### Epic: Safe Execution Pipeline

#### Tasks

- [ ] Implement remediation execution phases.
  - [ ] Validate scan freshness and host fingerprint.
  - [ ] Run preflight checks.
  - [ ] Generate user preview.
  - [ ] Collect consent.
  - [ ] Create snapshot and rollback script.
  - [ ] Execute ordered steps.
  - [ ] Validate state.
  - [ ] Mark manifest result.
- [ ] Enforce command allowlist for mutating commands.
- [ ] Enforce forbidden command blocklist.
- [ ] Add service reload helpers.
  - [ ] Prefer reload over restart where safe.
  - [ ] Validate config before reload.
  - [ ] Avoid reboot/shutdown actions in MVP.
- [ ] Add package-manager lock detection and retry guidance.

#### Acceptance Criteria

- Mutating commands cannot be run through the read-only scanner path.
- Failed validation triggers rollback or clear manual recovery instructions.
- Package-manager lock failure is reported safely without retry storms.

#### Rollback Plan

- If execution fails after snapshot, attempt rollback automatically only when rollback itself has lower or equal risk than leaving the change in place.

#### Testing Requirements

- Tests for each execution phase and state transition.
- Tests for forbidden commands including destructive examples from the plan.

### Epic: Lockout Watchdog

#### Tasks

- [ ] Implement watchdog for SSH and firewall changes.
  - [ ] Start before risky mutation.
  - [ ] Wait for explicit success callback from Carbon after parallel connection validation.
  - [ ] Revert backed-up config if callback is not received.
  - [ ] Reload affected service after rollback.
  - [ ] Self-delete or deactivate after success.
- [ ] Define watchdog storage and process model.
  - [ ] Shell script plus `nohup`/background job for MVP.
  - [ ] Avoid requiring a persistent remote agent.
- [ ] Add watchdog status to audit log.
- [ ] Add manual recovery command shown in UI before mutation.

#### Acceptance Criteria

- SSH auth, SSH port, and firewall enablement actions cannot execute without watchdog support.
- If Carbon loses connectivity during a dangerous action, the host attempts automatic rollback.
- User receives manual recovery instructions even if automatic rollback fails.

#### Rollback Plan

- Keep dangerous remediations disabled until watchdog behavior is verified on supported distros.

#### Testing Requirements

- Simulated timeout tests where success callback is not sent.
- Simulated success tests where watchdog is cancelled.
- Manual QA on Ubuntu/Debian VPS snapshots before release.

### Epic: Audit Logging And Recovery UI Data

#### Tasks

- [ ] Store local audit records for scans and remediations.
  - [ ] Connection ID.
  - [ ] Target fingerprint.
  - [ ] Action ID/version.
  - [ ] Redacted command preview.
  - [ ] Consent timestamp.
  - [ ] Result and rollback status.
- [ ] Store target manifest references locally.
- [ ] Add audit export for support without secrets.
- [ ] Add recovery status model for UI.
  - [ ] Rollback available.
  - [ ] Rollback attempted.
  - [ ] Manual recovery required.
  - [ ] Recovery verified.

#### Acceptance Criteria

- Users can see what changed, when, and how to undo it.
- Support can inspect action state without raw credentials or private server data.
- Audit logs include enough detail to investigate failures.

#### Rollback Plan

- If local audit persistence fails, block mutating remediation rather than proceeding invisibly.

#### Testing Requirements

- Redaction tests for audit logs.
- Tests for interrupted remediation restart and recovery-state rendering.

