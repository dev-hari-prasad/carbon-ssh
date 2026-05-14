# UI, Consent, And Terminal Integration

## Goal

Create the Security Guard user experience: onboarding, scan progress, dashboard, findings, fix flows, protocol consent, rollback UI, terminal warnings, and trust-preserving messaging.

## Architectural Analysis

The UI has to do more than look polished. It is part of the safety system. Users are being asked to let Carbon modify production machines, so the interface must show exactly what will happen, what could go wrong, how rollback works, and what will remain unresolved.

The biggest UX trap is one-click language. "One-click lockdown" is compelling marketing, but real execution requires preflight checks, choices, and confirmations. The UI can still feel fast if it stages the work clearly: scan, explain, preview, confirm, execute, validate, rollback if needed.

Terminal integration should feel native to Carbon, but it must not bypass consent. Inline warnings can nudge users when they connect to a risky server, but remediation still needs the same deterministic action flow.

## Dependencies

- Scanner progress events and normalized findings.
- Security score output.
- Remediation action previews.
- Rollback status model.
- AI consent and report generation.
- Existing Carbon layout, terminal, connection, and settings components.

## Risks

- Hiding command details reduces trust and increases liability.
- Showing too many raw commands overwhelms non-security users.
- Protocol confirmation can become click-through theater unless friction matches risk.
- AI explanations may be mistaken for guarantees.
- Terminal inline warnings can annoy users if they cannot be dismissed or configured.

## Epics

### Epic: Onboarding And Scan Consent

#### Tasks

- [ ] Add Security Guard entry point from connected terminal/session.
- [ ] Show scan consent before first scan per connection.
  - [ ] Read-only checks only.
  - [ ] No changes will be made.
  - [ ] Data stays local unless AI is enabled.
  - [ ] Some checks may require sudo.
- [ ] Add supported-platform messaging.
  - [ ] Ubuntu/Debian supported for MVP.
  - [ ] Other Linux best-effort.
  - [ ] Non-Linux unsupported.
- [ ] Add first-scan progress UI.
  - [ ] Capability probe.
  - [ ] SSH checks.
  - [ ] Firewall/network checks.
  - [ ] Docker/fail2ban checks.
  - [ ] Score/report generation.
- [ ] Add permission-limited scan state for non-root/no-sudo sessions.

#### Acceptance Criteria

- User understands scan is read-only before starting.
- Scan progress maps to real scanner phases.
- Unsupported or privilege-limited hosts produce clear next steps.

#### Rollback Plan

- Entry point can be hidden behind a feature flag until scanner quality is stable.

#### Testing Requirements

- Component tests for consent accepted/declined, unsupported host, sudo-limited host, and cancelled scan.

### Epic: Security Dashboard

#### Tasks

- [ ] Build score panel.
  - [ ] Numeric score.
  - [ ] Grade.
  - [ ] Top score penalties.
  - [ ] Unknown checks caveat.
- [ ] Build findings list.
  - [ ] Severity filters.
  - [ ] Category filters.
  - [ ] Remediation availability.
  - [ ] Evidence preview.
  - [ ] AI explanation toggle if enabled.
- [ ] Build risk heatmap.
  - [ ] SSH.
  - [ ] Firewall/network.
  - [ ] Docker.
  - [ ] Packages.
  - [ ] Users/sudo.
- [ ] Add last scan timestamp and scan version.
- [ ] Add markdown export action.

#### Acceptance Criteria

- Users can identify the top three risks within seconds.
- Findings expose enough evidence to be auditable without dumping raw command output by default.
- Unknown/skipped checks are visible and not buried.

#### Rollback Plan

- If full heatmap takes too long, ship score + findings first and add heatmap later.

#### Testing Requirements

- Component tests for severity grouping, score explanation, unknown checks, and export button state.

### Epic: Individual Fix Flow

#### Tasks

- [ ] Add remediation availability states.
  - [ ] Fix available.
  - [ ] Requires preflight.
  - [ ] Blocked with reason.
  - [ ] Manual guidance only.
- [ ] Build fix preview modal.
  - [ ] Human summary.
  - [ ] Exact commands/file changes.
  - [ ] Risk level.
  - [ ] Rollback availability.
  - [ ] Expected downtime or service impact.
  - [ ] Validation checks.
- [ ] Add consent friction by risk.
  - [ ] Low: confirm button.
  - [ ] Medium: confirm plus explicit warning.
  - [ ] High: typed confirmation or equivalent.
- [ ] Add execution progress.
  - [ ] Preflight.
  - [ ] Snapshot.
  - [ ] Apply.
  - [ ] Validate.
  - [ ] Rollback if needed.
- [ ] Add post-fix rescan option.

#### Acceptance Criteria

- No fix executes without preview and consent.
- Blocked fixes explain exactly what prerequisite is missing.
- High-risk fixes require stronger confirmation.

#### Rollback Plan

- Fix buttons stay disabled until backend action model declares rollback support.

#### Testing Requirements

- Component tests for low/medium/high consent flows, blocked remediation, failed validation, and rollback available states.

### Epic: Protocol And Fix-All Flow

#### Tasks

- [ ] Add protocol cards.
  - [ ] Personal VPS.
  - [ ] Production Server.
  - [ ] Docker Host.
  - [ ] Deferred protocols hidden or disabled with clear label.
- [ ] Build protocol planner UI.
  - [ ] Included actions.
  - [ ] Skipped actions.
  - [ ] User decisions.
  - [ ] Detected open ports.
  - [ ] Rollback summary.
- [ ] Add high-friction confirmation.
  - [ ] Require explicit typed confirmation for protocol execution.
  - [ ] Show count of changes and risk categories.
- [ ] Add staged execution UI and child action results.
- [ ] Add before/after score comparison.

#### Acceptance Criteria

- Users cannot accidentally execute a protocol from a single ambiguous click.
- The planned action list is inspectable before execution.
- Partial failure shows which stage failed and how to recover.

#### Rollback Plan

- Hide protocol execution until individual remediations are proven.

#### Testing Requirements

- Component tests for protocol eligibility, user choices, typed confirmation, partial failure, and aggregate rollback.

### Epic: Rollback And Recovery UI

#### Tasks

- [ ] Build remediation history panel.
  - [ ] Action/protocol name.
  - [ ] Timestamp.
  - [ ] Result.
  - [ ] Rollback availability.
  - [ ] Target manifest reference.
- [ ] Build rollback preview.
  - [ ] What will be restored.
  - [ ] Commands to run.
  - [ ] Risks.
  - [ ] Current-state conflict warnings.
- [ ] Build failed-lockdown recovery screen.
  - [ ] Manual recovery script path.
  - [ ] Last known action.
  - [ ] Suggested next steps.
- [ ] Add audit export from UI.

#### Acceptance Criteria

- Users can find rollback controls without hunting through logs.
- Rollback itself has preview and consent.
- Failed dangerous actions show recovery instructions immediately.

#### Rollback Plan

- If automatic rollback UI is not ready, show manifest path and manual recovery instructions while blocking high-risk actions.

#### Testing Requirements

- Tests for rollback available/unavailable, current-state conflict, and manual recovery display.

### Epic: Terminal Inline Warnings

#### Tasks

- [ ] Add optional terminal banner after connecting to a host with known stale scan.
- [ ] Add warning badges for critical findings in session header.
- [ ] Add "Run Security Guard scan" action from terminal.
- [ ] Add setting to disable inline warnings.
- [ ] Avoid interrupting active terminal input or command output.

#### Acceptance Criteria

- Terminal warnings are helpful, dismissible, and do not execute remediations directly.
- Warnings reflect latest scan state and stale-state caveat.

#### Rollback Plan

- Keep terminal integration disabled until dashboard and scan flow are stable.

#### Testing Requirements

- UI tests for stale scan, critical findings, dismissed banner, and disabled setting.

