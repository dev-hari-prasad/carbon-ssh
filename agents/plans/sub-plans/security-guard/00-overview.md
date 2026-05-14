# Security Guard Sub-Plan Overview

## Goal

Convert `agents/plans/security-guard.md` into execution-ready engineering work for Carbon's Security Guard feature. Security Guard is an agentless SSH-based scanner, remediation, and rollback system for hardening Linux VPS machines from inside Carbon.

## Architectural Analysis

Security Guard has a much higher blast radius than ordinary product features because it will read from and modify customer-owned production servers over SSH. The original plan is directionally strong: deterministic scanners gather facts, AI explains facts only after collection, and every write action must be reversible. The engineering challenge is turning that philosophy into hard boundaries.

The feature should be treated as several cooperating systems rather than one scanner:

- A read-only scan engine that runs bounded SSH command batches, parses command output, and returns normalized findings.
- A remote host capability model that understands distro, privilege level, init system, package manager, firewall backend, Docker state, and cloud limitations.
- A remediation planner that converts findings into preflighted, user-visible, reversible action plans.
- A rollback system that stores target-side backups, manifests, inverse commands, and recovery scripts before any change.
- A UI and consent model that makes dangerous actions understandable without hiding exact commands.
- An optional AI layer that receives redacted scan facts only with explicit consent and never produces executable commands.
- A fleet layer, deferred from MVP, that reuses scan/remediation primitives but adds policy, scheduling, drift, and batch-risk controls.

The most important implementation boundary is this: scan modules can collect data, remediation modules can propose deterministic operations, and AI can explain. Those layers should not be allowed to blur. If a future shortcut lets AI produce shell commands or lets a scanner mutate state, the product's trust model collapses.

## Implementation Order

1. `01-scan-engine-and-data-model.md`
2. `02-ssh-security-scanners.md`
3. `03-network-firewall-and-docker.md`
4. `04-remediation-rollback-and-safe-execution.md`
5. `05-lockdown-protocols.md`
6. `06-ai-cve-and-reporting.md`
7. `07-ui-consent-and-terminal-integration.md`
8. `08-fleet-drift-and-policy.md`
9. `09-testing-rollout-and-operations.md`

## Cross-Cutting Dependencies

- Existing Carbon SSH connection/session layer.
- Electron main process for trusted local orchestration and credential access.
- Renderer UI for scan dashboards, confirmation dialogs, and rollback controls.
- A durable local store for scan history, audit logs, rollback metadata references, and user consent state.
- Target-side storage under `/var/lib/carbon/` for rollback manifests and backups.
- Remote command runner with timeouts, output limits, redaction, and cancellation.
- Product/legal decisions for AI data consent, liability language, and monetization boundaries.

## Blockers Before Implementation

- Define the first supported distro matrix. The plan implies Ubuntu/Debian MVP; engineering should not accidentally design unsupported RHEL/Alpine behavior into P0.
- Decide where scan history and audit logs live locally, how long they are retained, and what redaction rules apply.
- Decide whether remediation execution is owned by Electron main, a shared TypeScript service, or the existing terminal/session layer.
- Define how Security Guard detects sudo availability and handles non-root users.
- Define the command allowlist and blocklist before implementing any write-capable remediation code.
- Choose a rollback manifest schema before writing individual fix actions.
- Decide whether MVP includes package installation during remediation, since installing `ufw`, `fail2ban`, and `unattended-upgrades` introduces package-manager and network failure modes.
- Define the consent copy and command-preview UX before exposing one-click fixes.

## MVP Scope

- Agentless scan over an existing SSH connection.
- Ubuntu/Debian support only.
- Read-only scan framework with normalized findings, severity, evidence, remediation availability, and confidence.
- SSH checks for root login, password auth, port, weak algorithms, and safety prerequisites.
- Firewall/fail2ban/Docker exposure checks.
- Security score and markdown report export.
- Individual remediation for a small set of high-value findings only after rollback system exists.
- Rollback snapshots, manifests, command previews, and SSH/firewall lockout protection.

## Hardening Scope

- Lockdown protocols for Personal VPS, Production Server, and Docker Host.
- Package vulnerability and unattended-upgrades checks.
- User/sudo account scanner.
- AI explanations and risk prioritization behind separate opt-in.
- Better Docker/UFW interaction handling.
- Drift detection and scheduled scans.

## Future Improvements

- Fleet dashboard and batch remediation.
- Cloud firewall integrations.
- Optional lightweight target agent for continuous monitoring.
- Kubernetes and container image scanning.
- CIS benchmark mapping and compliance evidence collection.
- Autonomous remediation in tightly constrained, policy-approved environments.

