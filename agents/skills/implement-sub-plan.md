# Sub-Plan Implementation Skill

The purpose of this skill is to execute implementation work from an existing sub-plan folder safely and incrementally.

The AI must treat the repository as the source of truth.

The AI must NOT blindly execute tasks from markdown files without validating:
- current implementation state
- architectural consistency
- dependency impact
- runtime implications
- security implications

This skill exists to:
- safely implement engineering work
- reduce regression risk
- preserve architectural integrity
- avoid unsafe autonomous refactors

---

# Primary Objective

Given a sub-plan folder:

/plans/sub-plans/[plan-name]/

The AI must:

1. analyze all sub-plan files
2. determine implementation ordering
3. validate repository compatibility
4. detect dependencies between sub-plans
5. detect already-completed work
6. identify blockers
7. safely execute implementation tasks
8. continuously validate architecture integrity
9. continuously validate security boundaries
10. keep implementation aligned with the real repository

---

# Repository First Rules

The repository is the source of truth.

The AI must NEVER assume:
- the plan is fully accurate
- the task is still required
- the architecture still matches the plan
- the repository structure matches historical assumptions

The AI must:
- inspect current implementation first
- inspect actual runtime boundaries
- inspect current abstractions
- inspect dependency usage
- inspect current patterns before modifying code

---

# Required Pre-Implementation Analysis

Before modifying code, the AI must analyze:

- relevant directories
- affected systems
- related services
- dependency chains
- shared utilities
- security-sensitive surfaces
- runtime boundaries
- state management flow
- persistence flow
- IPC boundaries
- network boundaries
- terminal execution flow
- authentication flow

---

# Sub-Plan Execution Rules

The AI must:

## 1. Determine Safe Ordering

The AI must identify:
- prerequisite tasks
- migration dependencies
- blocking systems
- high blast radius areas

The AI must execute:
- foundational work first
- migrations before enforcement
- compatibility layers before removal
- feature flags before rollout

---

## 2. Validate Existing Code

The AI must detect:
- partially implemented systems
- duplicated implementations
- dead code
- conflicting abstractions
- legacy patterns
- unsafe assumptions

The AI must avoid:
- duplicate implementations
- parallel systems
- architecture fragmentation

---

## 3. Preserve Architectural Integrity

The AI must preserve:
- runtime boundaries
- IPC contracts
- API contracts
- service ownership
- security boundaries
- deployment assumptions
- compatibility guarantees

The AI must avoid:
- unnecessary rewrites
- hidden coupling
- architecture drift
- unstable abstractions

---

# Security Rules

The AI must treat the following as high-risk systems:

- credential storage
- token handling
- SSH execution
- Electron IPC
- shell execution
- AI execution systems
- websocket auth
- encryption systems
- persistence layers
- session restoration

For high-risk systems the AI must:
- minimize blast radius
- avoid large refactors
- prefer incremental migration
- preserve rollback paths
- add validation layers
- add telemetry where appropriate

---

# Migration Rules

The AI must detect when changes require:

- storage migrations
- schema migrations
- credential migrations
- encryption migrations
- cache invalidation
- session invalidation

The AI must implement:
- backward compatibility where required
- rollback mechanisms
- corruption recovery paths
- migration validation
- idempotent migrations

---

# Implementation Constraints

The AI must prefer:

- incremental changes
- isolated commits
- modular refactors
- compatibility layers
- feature-gated rollouts
- testable abstractions

The AI must avoid:

- giant rewrites
- cross-system refactors without justification
- changing stable interfaces unnecessarily
- hidden side effects
- modifying unrelated systems

---

# Testing Requirements

The AI must determine required testing levels:

## Unit Tests

Required for:
- utilities
- validation
- encryption logic
- parsers

## Integration Tests

Required for:
- IPC systems
- auth systems
- websocket systems
- persistence systems
- SSH systems

## Security Tests

Required for:
- credential handling
- encryption
- token validation
- command execution
- IPC boundaries

## Regression Tests

Required for:
- session restoration
- reconnect flow
- terminal persistence
- AI execution systems

---

# Operational Safety Rules

The AI must identify areas requiring:

- feature flags
- staged rollout
- telemetry
- monitoring
- rollback support
- migration tooling
- incident recovery support

---

# Progress Tracking Rules

The AI must maintain:

## Implementation Status

- not started
- in progress
- blocked
- completed
- partially implemented

## Blocker Tracking

The AI must identify:
- architecture blockers
- migration blockers
- dependency blockers
- operational blockers
- security blockers

---

# Required Outputs

The AI must update:

- implementation progress
- completed tasks
- discovered blockers
- architecture concerns
- migration concerns
- rollback concerns

The AI should create supporting implementation notes where complexity is high.

Example:

/plans/sub-plans/security-improvements/
  - implementation-status.md
  - migration-notes.md
  - rollback-plan.md
  - dependency-analysis.md

---

# Critical Thinking Requirements

The AI must continuously reason about:

- what can break
- hidden dependency chains
- runtime side effects
- operational impact
- migration safety
- rollback safety
- security implications
- long-term maintainability

The AI must think like:
- a senior engineer
- a security engineer
- a systems architect
- a production SRE

The AI must NOT:
- blindly follow markdown tasks
- trust outdated plans
- ignore repository reality
- skip migration safety
- skip rollback analysis
- perform unsafe broad refactors
- introduce architectural drift