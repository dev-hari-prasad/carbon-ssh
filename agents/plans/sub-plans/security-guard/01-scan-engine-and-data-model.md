# Scan Engine And Data Model

## Goal

Build the deterministic read-only foundation for Security Guard: command execution, host capability detection, scanner module registration, normalized findings, scoring, and audit-safe scan history.

## Architectural Analysis

The scan engine is the root dependency for nearly every other initiative. If scan data is inconsistent, remediation will target the wrong files, AI will explain the wrong risk, and the UI will earn user distrust. The engine must normalize messy Linux reality without pretending it is cleaner than it is.

The hidden complexity is not running commands over SSH; Carbon already has SSH primitives. The hard part is making command execution safe, bounded, parseable, and repeatable across distros and privilege levels. Every scanner should declare what it needs, what commands it runs, expected output size, timeout, whether sudo is required, and what evidence can be shown to the user.

The MVP should avoid remote agent installation. It should execute small command batches, parse locally, and treat unsupported or ambiguous states as explicit findings rather than silent pass/fail results.

## Dependencies

- Existing Carbon SSH session and command execution capabilities.
- Local persistence for scan history and audit records.
- TypeScript domain models shared by scanner, UI, report generation, and remediation.
- Redaction utilities for command output and evidence.
- Distro/capability probe that runs before feature-specific scanners.

## Risks

- Unbounded command output can freeze the UI or leak sensitive data into local logs.
- Scanner modules can become ad hoc scripts unless a strict interface is enforced early.
- Ambiguous parsing can generate false confidence, especially for `sshd_config` includes and firewall backends.
- Running commands with sudo can trigger prompts or policy failures that look like scanner bugs.
- Scan results may contain usernames, IP addresses, package versions, and firewall rules that require careful storage and AI-consent handling.

## Epics

### Epic: Define Core Domain Model

#### Tasks

- [ ] Define `SecurityScan` with scan ID, connection ID, target fingerprint, start/end timestamps, status, scan version, and module results.
- [ ] Define `HostCapabilities`.
  - [ ] Distro family and version.
  - [ ] Init system.
  - [ ] Package manager.
  - [ ] Current user and privilege status.
  - [ ] Sudo availability and whether passwordless sudo is available.
  - [ ] Firewall backend candidates.
  - [ ] Docker availability.
- [ ] Define `SecurityFinding`.
  - [ ] Stable finding ID.
  - [ ] Module ID.
  - [ ] Severity.
  - [ ] Title and user-facing summary.
  - [ ] Machine-readable evidence.
  - [ ] Redacted display evidence.
  - [ ] Confidence.
  - [ ] Remediation availability.
  - [ ] Related rollback requirements.
- [ ] Define `ScannerModule`.
  - [ ] Module ID and version.
  - [ ] Supported host capabilities.
  - [ ] Required commands.
  - [ ] Required privileges.
  - [ ] Parser and normalization function.
  - [ ] Timeout and output limits.
- [ ] Define score input/output models separate from raw findings.

#### Acceptance Criteria

- Every scanner result can be rendered in the UI, exported to markdown, and passed to remediation planning without module-specific type casts.
- Findings distinguish `pass`, `fail`, `warning`, `not_applicable`, and `unknown`.
- Evidence is stored in redacted form by default, with raw output either not stored or stored only under explicit diagnostic mode.

#### Rollback Plan

- Keep data model changes additive until the first scanner set is stable.
- Version scan result schemas and write migration functions before storing persistent history.

#### Testing Requirements

- Unit tests for schema validation and invalid scanner output.
- Snapshot tests for finding serialization.
- Redaction tests with usernames, IP addresses, hostnames, package versions, API-looking tokens, and private-key-like text.

### Epic: Implement Bounded SSH Command Runner

#### Tasks

- [ ] Build a Security Guard command runner wrapper around existing SSH execution.
  - [ ] Enforce command allowlist by scanner module.
  - [ ] Apply per-command timeout.
  - [ ] Apply max stdout/stderr byte limits.
  - [ ] Capture exit code, stdout, stderr, duration, and timeout state.
  - [ ] Support cancellation when the user stops a scan.
- [ ] Add command batching for read-only probes where safe.
- [ ] Add sudo handling.
  - [ ] Detect sudo requirements before scanner execution.
  - [ ] Avoid hanging on password prompts.
  - [ ] Report privilege-limited findings clearly.
- [ ] Add output redaction before local logging.
- [ ] Add a command classification system.
  - [ ] Read-only.
  - [ ] Preflight.
  - [ ] Mutating.
  - [ ] Forbidden.

#### Acceptance Criteria

- Scanner modules cannot run arbitrary commands outside their declared command set.
- A hung remote command cannot hang the entire scan.
- Large output is truncated safely with a visible evidence note.
- Sudo prompts are detected and surfaced as capability limitations.

#### Rollback Plan

- Keep the command runner read-only until remediation and rollback design is complete.
- Feature-flag command batching so it can be disabled if parsing or timeout behavior is unstable.

#### Testing Requirements

- Fake SSH executor tests for timeout, cancellation, truncation, non-zero exit, and sudo prompt output.
- Integration test with a local or fixture shell adapter if available.

### Epic: Host Capability Probe

#### Tasks

- [ ] Implement a minimal first-pass probe.
  - [ ] `uname -a`
  - [ ] `/etc/os-release`
  - [ ] `id`
  - [ ] `command -v sudo systemctl ss ufw iptables nft docker fail2ban-client`
  - [ ] Non-mutating checks for package manager availability.
- [ ] Normalize supported distro families.
  - [ ] Ubuntu/Debian as supported MVP.
  - [ ] Other Linux as best-effort scan only.
  - [ ] Non-Linux as unsupported.
- [ ] Detect command availability and service manager.
- [ ] Detect whether the session user can run sudo non-interactively.
- [ ] Detect if the host appears containerized or minimal.

#### Acceptance Criteria

- Unsupported systems fail gracefully with actionable explanation.
- Scanner modules can skip themselves based on host capabilities instead of failing at runtime.
- The UI can tell the user why a check could not run.

#### Rollback Plan

- Keep capability detection conservative. Unknown should disable risky scanners/remediation rather than guessing.

#### Testing Requirements

- Fixture tests for Ubuntu, Debian, Rocky, Alpine, container-minimal, and non-root/no-sudo outputs.
- Parser tests for malformed or missing `/etc/os-release`.

### Epic: Scanner Registry And Execution Pipeline

#### Tasks

- [ ] Implement scanner registration.
  - [ ] Static module registry for MVP.
  - [ ] No dynamic remote module loading.
  - [ ] Module version included in results.
- [ ] Implement pipeline phases.
  - [ ] Capability probe.
  - [ ] Module eligibility.
  - [ ] Command execution.
  - [ ] Parsing and finding normalization.
  - [ ] Scoring.
  - [ ] Persistence/report generation.
- [ ] Add module-level error isolation so one parser failure does not fail the full scan.
- [ ] Add scan progress events for UI.
- [ ] Add retry rules only for transient SSH/session failures, not parser failures.

#### Acceptance Criteria

- A failed scanner module produces an `unknown` module result and does not abort unrelated checks.
- Progress events can power a meaningful first-scan experience.
- Scan output includes scanner versions for future drift and regression analysis.

#### Rollback Plan

- Keep the registry static and code-reviewed; avoid plugin extensibility until the trust model is mature.

#### Testing Requirements

- Pipeline tests with successful, skipped, failed, and timed-out modules.
- Regression tests that assert scanner errors do not mutate host state.

### Epic: Security Score Calculation

#### Tasks

- [ ] Implement scoring separate from scanner modules.
- [ ] Define initial weights for Critical, High, Medium, Low, and Info.
- [ ] Avoid double-penalizing the same root cause.
  - [ ] Example: root password auth enabled can produce multiple findings but should have a clear score impact.
- [ ] Include confidence and unknown checks in the displayed score explanation.
- [ ] Add grade mapping and trend-ready score metadata.

#### Acceptance Criteria

- Score is deterministic for a given finding set.
- The UI can explain which findings cost the most points.
- Unknown/skipped findings do not inflate the score into false confidence.

#### Rollback Plan

- Version scoring rules independently from scanner modules.
- Preserve raw finding history so scores can be recalculated after rule changes.

#### Testing Requirements

- Unit tests for severity weights, duplicate/root-cause grouping, unknown findings, and grade boundaries.

