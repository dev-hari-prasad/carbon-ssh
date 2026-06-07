# Implementation Review Skill

The purpose of this skill is to analyze the REAL implementation state of the repository BEFORE generating sub-plans.

This skill exists to prevent:

- invalid implementation sequencing
- architecture drift
- unsafe refactors
- broken dependency assumptions
- migration disasters
- shallow planning disconnected from reality

The AI must treat the repository as the source of truth.

The original plan document may be:

- outdated
- partially implemented
- architecturally incorrect
- inconsistent with the current repository

The AI must validate all assumptions against the actual codebase.

---

# Primary Objective

Before generating implementation sub-plans, the AI must:

1. analyze the repository structure
2. understand runtime architecture
3. identify implementation boundaries
4. detect already-implemented systems
5. detect partial implementations
6. detect coupling between systems
7. detect migration risks
8. detect security-sensitive surfaces
9. detect rollout complexity
10. identify architectural inconsistencies

The AI must produce an implementation review document.

Sub-plan generation MUST happen only AFTER this review.

---

# Repository Analysis Requirements

The AI must inspect:

- folder structure
- application boundaries
- frontend/backend separation
- Electron/Tauri/native boundaries
- shared libraries
- IPC architecture
- websocket architecture
- auth systems
- credential storage
- encryption utilities
- persistence layers
- caching layers
- session handling
- state management
- logging systems
- AI runtime systems
- terminal execution boundaries
- SSH execution flow
- database/storage layers
- environment configuration
- secrets handling
- telemetry systems
- testing infrastructure
- CI/CD configuration

---

# Architecture Mapping Requirements

The AI must identify:

## Runtime Boundaries

Examples:

- renderer process
- main Electron process
- backend API
- websocket server
- SSH execution layer
- AI execution layer

## Trust Boundaries

Examples:

- renderer ↔ main
- frontend ↔ backend
- local machine ↔ remote SSH host
- AI agent ↔ shell execution

## Security-Critical Systems

Examples:

- credential storage
- private key handling
- token management
- IPC bridges
- command execution
- session restoration

---

# Implementation State Detection

The AI must determine:

- what is fully implemented
- what is partially implemented
- what is stubbed
- what is dead code
- what is legacy
- what is duplicated
- what is deprecated
- what conflicts with the plan

The AI must NOT assume the plan reflects reality.

---

# Dependency Analysis Requirements

The AI must identify:

## Direct Dependencies

Example:
credential storage depends on:

- storage layer
- encryption utilities
- session manager

## Transitive Dependencies

Example:
credential storage changes may impact:

- websocket reconnect
- terminal restore
- AI memory systems
- SSH pooling
- telemetry

The AI must detect hidden coupling.

---

# Migration Analysis Requirements

The AI must identify:

- schema migrations
- storage migrations
- credential migrations
- encryption migrations
- config migrations
- cache invalidation risks
- backward compatibility requirements

The AI must identify:

- rollback difficulty
- corruption risk
- partial migration failure scenarios

---

# Risk Analysis Requirements

The AI must identify:

## High Blast Radius Areas

Examples:

- auth systems
- IPC systems
- SSH execution
- session restoration
- websocket auth

## Unsafe Refactor Risks

Examples:

- tight coupling
- circular dependencies
- duplicated logic
- hidden side effects

## Operational Risks

Examples:

- rollout failures
- session invalidation
- credential corruption
- remote lockouts

---

# Code Quality Review

The AI must identify:

- architectural inconsistencies
- security anti-patterns
- unsafe abstractions
- missing validation
- missing isolation
- improper trust boundaries
- missing monitoring
- missing rollback support
- missing feature flags

---

# Output Rules

The AI must generate:

/plans/reviews/[plan-name]-implementation-review.md

Example:

/plans/reviews/security-improvements-implementation-review.md

---

# Output Structure

# Implementation Review

## Repository Architecture Summary

## Runtime Boundaries

## Security Boundaries

## Existing Implementation State

## Plan Mismatches

## Dependency Graph Analysis

## Migration Risk Analysis

## Blast Radius Analysis

## Rollout Complexity

## Operational Concerns

## Missing Infrastructure

## Missing Security Controls

## Architectural Weaknesses

## Recommended Implementation Ordering

## Blockers

## Safe Refactor Recommendations

## Areas Requiring Feature Flags

## Areas Requiring Staged Rollout

## Areas Requiring Rollback Support

## Testing Requirements

## Final Risk Assessment

---

# Critical Rules

The AI must:

- prioritize repository reality over plan assumptions
- avoid architectural drift
- avoid unnecessary rewrites
- preserve stable boundaries
- preserve backward compatibility where required
- identify unsafe implementation sequencing
- identify hidden complexity
- identify operational hazards

The AI must think like:

- a staff engineer
- a security engineer
- a systems architect
- a production SRE

The AI must NOT:

- generate shallow summaries
- blindly trust the plan
- ignore existing implementation constraints
- ignore migration complexity
- ignore operational ownership
- ignore rollout safety
