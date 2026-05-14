# Sub-plan Skill

For the given plan file, break the plan into execution-ready sub-plans.

The goal of this skill is NOT to rewrite the plan.  
The goal is to transform high-level strategy into implementation-ready engineering work.

---

# Output Rules

All generated sub-plans MUST be written to:

/plans/sub-plans/[plan-name]/

The AI must:

- create a dedicated folder for the plan
- place all generated sub-plans inside that folder
- organize files logically by initiative or system
- avoid placing everything into one giant file

Example:

/plans/sub-plans/security-guard/
  - credential-hardening.md
  - websocket-security.md
  - electron-hardening.md
  - rollout-strategy.md
  - migration-plan.md
  - testing-strategy.md

The AI should create:
- one file per major initiative/system
- additional supporting files where needed
- implementation ordering documentation if complexity is high

The AI must ensure:
- filenames are predictable
- filenames are human-readable
- files are scoped properly
- related work stays grouped together

---

# Deep Thinking Requirements

The AI agent must deeply analyze the plan before generating tasks.

The AI must spend significant effort understanding:
- the architecture
- intent behind decisions
- hidden complexity
- operational implications
- migration risks
- infrastructure impact
- security implications
- rollout sequencing
- long-term maintainability

The AI must think through:
- what can break
- what depends on what
- what assumptions the original author made
- what is missing from the plan
- what work is implied but not written
- what edge cases exist
- what production risks exist
- what implementation traps engineers may hit

The AI must NOT immediately generate tasks after reading headings.  
It must first reason about the system as a whole.

The AI should think like:
- a staff engineer
- a security architect
- a systems designer
- a production SRE
- and a technical project planner simultaneously.

The AI must:
- reason step-by-step internally before outputting
- prioritize correctness over speed
- avoid shallow decomposition
- avoid blindly trusting the original plan
- challenge unrealistic assumptions
- identify architectural weaknesses
- identify missing operational details
- identify scaling concerns
- identify security gaps
- identify migration dangers
- identify future maintenance burden

---

# Task Generation Rules

The AI agent must:

1. Read the full plan carefully
2. Identify:
   - initiatives
   - systems
   - epics
   - dependencies
   - risk areas
   - migrations
   - infrastructure requirements
   - rollout requirements
3. Convert large abstract sections into smaller executable units
4. Create a hierarchy:
   - Initiative
     - Epic
       - Task
         - Sub-task
5. Ensure each task is implementation-oriented and engineer-actionable
6. Detect hidden work not explicitly mentioned in the original plan
7. Detect risky areas that require:
   - feature flags
   - staged rollout
   - rollback support
   - telemetry
   - monitoring
   - testing
8. Detect cross-team dependencies:
   - frontend
   - backend
   - infra
   - security
   - DevOps
   - AI systems
9. Generate acceptance criteria for major tasks
10. Generate implementation ordering based on:
    - security impact
    - dependency chain
    - blast radius
    - migration complexity
    - regression risk
11. Highlight blockers before implementation begins
12. Separate:
    - MVP work
    - hardening work
    - scaling work
    - future improvements

---

# Anti-Patterns To Avoid

The AI must avoid:
- vague tasks
- management fluff
- generic agile filler
- duplicate work items
- giant undefined epics
- shallow analysis
- obvious decompositions without reasoning
- blindly copying sections into tasks

The AI must NOT:
- create meaningless placeholder tasks
- create impossible parallel workstreams
- ignore migration complexity
- ignore operational ownership
- ignore deployment risks
- ignore rollback complexity

---

# Task Quality Standard

Every task should be:
- concrete
- testable
- scoped
- executable by an engineer
- measurable
- operationally realistic

Tasks should contain:
- implementation details
- affected systems
- risk notes
- testing requirements
- rollout considerations
- migration requirements if applicable

---

# Recommended File Structure

Example:

/plans/sub-plans/security-guard/
  - 00-overview.md
  - 01-electron-hardening.md
  - 02-websocket-auth.md
  - 03-keychain-migration.md
  - 04-network-egress-filtering.md
  - 05-rollout-and-migration.md
  - 06-testing-and-validation.md
  - 07-incident-response.md

---

# Sub-plan File Format

# Initiative

## Goal

Short explanation.

## Architectural Analysis

Deep reasoning about:
- why this exists
- system implications
- operational impact
- hidden complexity
- implementation traps

## Dependencies

- Dependency

## Risks

- Risk

## Epics

### Epic: Name

#### Tasks

- [ ] Task
  - [ ] Sub-task
  - [ ] Sub-task

#### Acceptance Criteria

- Requirement

#### Rollback Plan

- Rollback step

#### Testing Requirements

- Unit tests
- Integration tests
- Security tests

---

# Optimization Goals

The AI should optimize for:
- safe execution
- low regression risk
- maintainability
- realistic implementation sequencing
- production readiness
- operational safety
- long-term scalability
- security correctness