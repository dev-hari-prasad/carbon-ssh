# Fleet, Drift, And Policy

## Goal

Design post-MVP multi-machine support, drift detection, grouped security policies, scheduled scans, compliance comparisons, and fleet-wide actions on top of the single-host scanner/remediation primitives.

## Architectural Analysis

Fleet support should not be built as a separate product hidden inside the first release. It should reuse the same scan result schema, finding IDs, remediation action IDs, and rollback model. The new complexity is orchestration: scheduling, concurrency, stale data, grouping, policy evaluation, and blast-radius control.

The biggest risk is batch remediation. A single-host firewall mistake is bad; a fleet-wide firewall mistake is an outage. Fleet actions need extra guardrails: canaries, staged batches, per-host preflight, stop-on-failure, and policy previews. Scheduled scans are safe earlier because they are read-only, but even they need rate limits and credential availability handling.

Compliance comparison is valuable for teams, but MVP should avoid formal compliance claims. The first version should say "baseline policy comparison" rather than "SOC 2 compliant" or "PCI compliant."

## Dependencies

- Stable single-host scan schema.
- Persistent scan history.
- Connection grouping metadata.
- Scheduler/automation architecture inside Carbon or app-level background process.
- Team/audit authorization model if used in collaborative environments.
- Remediation engine with per-host rollback.

## Risks

- Scheduled scans can fail silently if credentials are unavailable or app is closed.
- Fleet dashboards can show stale data as current if timestamps are not prominent.
- Batch remediation can multiply a single bug across many hosts.
- Policy groups can drift from real server roles.
- Compliance language can create legal/product risk.

## Epics

### Epic: Multi-Machine Scan Orchestration

#### Tasks

- [ ] Define fleet scan job model.
  - [ ] Job ID.
  - [ ] Target connection IDs.
  - [ ] Requested scanner modules.
  - [ ] Concurrency limit.
  - [ ] Per-host status.
  - [ ] Aggregate status.
- [ ] Implement orchestration using existing single-host scanner.
- [ ] Add concurrency limits and cancellation.
- [ ] Add per-host timeout and partial-result handling.
- [ ] Add stale credential/missing connection handling.
- [ ] Store fleet scan results as links to individual scan records.

#### Acceptance Criteria

- One failed host does not fail the entire fleet scan.
- Fleet UI can distinguish completed, failed, skipped, and cancelled hosts.
- Scan timestamps are visible per host.

#### Rollback Plan

- Fleet scanning is read-only; disable scheduler/orchestration without affecting single-host scans.

#### Testing Requirements

- Tests for concurrency, cancellation, partial failure, missing credentials, and aggregate status.

### Epic: Fleet Dashboard

#### Tasks

- [ ] Build fleet summary.
  - [ ] Hosts by grade.
  - [ ] Critical/high finding counts.
  - [ ] Stale scan count.
  - [ ] Unsupported host count.
- [ ] Build host table.
  - [ ] Host display name.
  - [ ] Last scan.
  - [ ] Score.
  - [ ] Top risks.
  - [ ] Policy group.
  - [ ] Remediation status.
- [ ] Build risk matrix by category.
- [ ] Add filters for group, severity, stale scan, and unsupported host.
- [ ] Add drill-down to single-host dashboard.

#### Acceptance Criteria

- Stale or missing scans cannot be mistaken for healthy hosts.
- Users can identify which machines need action first.
- Host details reuse single-host finding views.

#### Rollback Plan

- Ship read-only dashboard before any fleet actions.

#### Testing Requirements

- Component tests for stale states, grouping, sorting, and drill-down links.

### Epic: Grouped Security Policies

#### Tasks

- [ ] Define baseline policy model.
  - [ ] Policy ID/version.
  - [ ] Server role.
  - [ ] Required findings pass.
  - [ ] Allowed exceptions.
  - [ ] Required remediation availability.
- [ ] Implement initial policies.
  - [ ] Personal VPS baseline.
  - [ ] Production web server baseline.
  - [ ] Docker host baseline.
- [ ] Add policy assignment to connection groups.
- [ ] Add exception workflow.
  - [ ] Reason.
  - [ ] Expiration.
  - [ ] Finding/action ID.
  - [ ] Local audit entry.
- [ ] Add policy comparison output separate from score.

#### Acceptance Criteria

- Policy compliance is calculated deterministically from findings.
- Exceptions are explicit, time-bounded, and visible.
- UI does not imply formal regulatory compliance.

#### Rollback Plan

- Policies remain advisory until team authorization and remediation maturity exist.

#### Testing Requirements

- Policy engine tests for pass/fail, exceptions, expired exceptions, and unknown findings.

### Epic: Drift Detection

#### Tasks

- [ ] Define drift events.
  - [ ] Finding severity increased.
  - [ ] Previously fixed finding reappeared.
  - [ ] New public listener.
  - [ ] Firewall state changed.
  - [ ] SSH auth state changed.
  - [ ] Docker exposure changed.
- [ ] Compare current scan to prior baseline.
- [ ] Add baseline selection.
  - [ ] Last clean scan.
  - [ ] Last user-approved scan.
  - [ ] Policy baseline.
- [ ] Add drift notification UI.
- [ ] Add scheduled rescan hooks.

#### Acceptance Criteria

- Drift detection uses stable finding IDs and evidence, not fragile text comparisons.
- Users can see what changed and since when.
- Unknown scans do not overwrite a known-good baseline automatically.

#### Rollback Plan

- Disable scheduled drift notifications while preserving manual scan comparison.

#### Testing Requirements

- Tests for new finding, resolved finding, severity change, evidence-only change, and unknown current scan.

### Epic: Fleet-Wide Remediation

#### Tasks

- [ ] Design batch remediation planner.
  - [ ] Group hosts by identical action plan.
  - [ ] Run per-host preflight.
  - [ ] Select canary hosts.
  - [ ] Define batch size and stop thresholds.
- [ ] Add high-friction consent.
  - [ ] Show affected hosts.
  - [ ] Show per-host risks.
  - [ ] Require typed confirmation.
- [ ] Execute in stages.
  - [ ] Canary.
  - [ ] Small batch.
  - [ ] Remaining batches.
  - [ ] Stop on failure threshold.
- [ ] Add per-host rollback tracking.

#### Acceptance Criteria

- Batch remediation cannot run without canary or explicit override.
- Failure on one host does not hide required recovery steps for that host.
- SSH/firewall high-risk actions require extra confirmation at fleet scale.

#### Rollback Plan

- Keep fleet remediation disabled until single-host remediation has production mileage.

#### Testing Requirements

- Planner tests for batching, canary failure, partial rollback, and stop thresholds.

### Epic: Scheduled Scans

#### Tasks

- [ ] Define scheduler requirements based on Carbon runtime model.
  - [ ] App open only vs background helper.
  - [ ] Credential availability.
  - [ ] Network availability.
  - [ ] User notification preferences.
- [ ] Implement schedule metadata.
  - [ ] Interval.
  - [ ] Target group.
  - [ ] Last run.
  - [ ] Next run.
  - [ ] Failure count.
- [ ] Add safe retry/backoff.
- [ ] Add notification for new critical/high findings.

#### Acceptance Criteria

- Users understand whether scans run only while Carbon is open.
- Failed scheduled scans are visible.
- Scheduled scans are read-only by default.

#### Rollback Plan

- Scheduler can be disabled globally without deleting scan history.

#### Testing Requirements

- Tests for schedule calculation, missed runs, retry/backoff, and credential-unavailable state.

