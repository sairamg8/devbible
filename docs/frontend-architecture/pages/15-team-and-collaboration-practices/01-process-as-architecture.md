---
title: "Team & Collaboration Practices: Governance, Review Conventions & ADRs"
sidebar_label: "Team & Collaboration Practices"
sidebar_position: 1
---

# 🏛️ Team & Collaboration Practices: Governance, Review Conventions & ADRs

## 1. The Decision Framework

Process decisions are architectural decisions — how a team reviews code, documents decisions, and governs shared components directly shapes whether a codebase stays coherent as more people touch it, independent of any specific technical choice.

```
No design system governance:                    Clear governance:
  ANY engineer can modify a shared                  A shared component's PUBLIC API is
  component's public API directly,                    owned by a specific team/reviewer;
  breaking OTHER teams' usage                          breaking changes go through a
  unknowingly, discovered only when                    deliberate deprecation window,
  those teams' builds break downstream                  not a surprise breaking change

No PR review conventions (ad hoc):               Documented conventions:
  every reviewer applies their OWN                  a clear, SHARED understanding of what
  bar for what blocks a merge —                       BLOCKS a merge (failing tests, missing
  inconsistent, contributor-dependent                  types, a11y violations) vs what's a
  friction                                              non-blocking follow-up comment
```

### Documentation-as-Code: Keeping Docs From Rotting
Documentation living in a separate wiki/Confluence, disconnected from the actual code, reliably drifts out of sync (exactly the same problem covered for component-level docs in the [Storybook documentation doc](../../../storybook/pages/08-documentation/01-docs-generation.md)) — documentation-as-code means Storybook/MDX docs, package READMEs, and inline TSDoc comments live directly in the repository, updated in the SAME PR as the code change they document, making "the docs are wrong" structurally harder to happen (a reviewer can catch a code change with no corresponding doc update in the same diff).

### ADRs: Preventing Decisions From Being Silently Re-Litigated
An Architecture Decision Record — a short, dated document capturing WHY a non-obvious technical choice was made (not just what was chosen) — prevents a common, genuinely costly pattern: a new team member (or the same engineer, a year later) re-questioning a decision whose original reasoning was never written down, potentially reversing it and reintroducing a problem the original decision was specifically made to avoid, simply because nobody remembered (or could find) why it was made that way.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Shared Button Component's Breaking Change Silently Breaking Three Downstream Teams, Prevented Going Forward by Governance.
A design system's `<Button>` component had its `variant` prop's default value changed by an engineer making an unrelated fix, without realizing this was a breaking, cross-team-affecting change — three different product teams' apps silently rendered with the wrong default button styling after their next dependency update, discovered only when each team independently noticed visual regressions and spent time individually tracing them back to the same root cause. Establishing design system governance (a required review from the design system's own team for any change to a shared component's public API/defaults, plus a deliberate deprecation-window process for genuinely breaking changes) meant the NEXT similar change would be caught during review — before merging, not after three teams independently discovered breakage in production.

---

## 3. Reference Implementation

```markdown
<!-- docs/adr/0004-choose-tanstack-query-over-redux-for-server-state.md -->
# ADR 0004: Use TanStack Query for Server State, Not Redux

## Status: Accepted (2026-03-15)

## Context
We were duplicating server-fetched data into Redux slices, requiring manual cache
invalidation logic that repeatedly drifted out of sync, causing stale-data bugs
(see incident INC-2026-0341).

## Decision
Server state (anything fetched from an API) uses TanStack Query exclusively.
Redux is reserved for genuine cross-cutting CLIENT state only (see the state
management decision tree doc).

## Consequences
- New features fetching server data MUST use useQuery/useMutation, not dispatch
  fetched data into a Redux slice.
- Existing Redux slices holding server-fetched data should be migrated
  opportunistically, not as a dedicated big-bang project.

## Why this matters if reconsidered later
If someone proposes moving server state back into Redux "for consistency,"
re-read INC-2026-0341 first — this decision was made SPECIFICALLY to prevent
that exact class of bug from recurring.
```

```yaml
# CODEOWNERS — enforcing design system governance via required review
packages/ui/**  @acme/design-system-team
```

```markdown
<!-- CONTRIBUTING.md — documented PR review conventions -->
## What blocks a merge
- Failing tests, type errors, lint errors
- Missing a11y attributes on new interactive elements
- A breaking change to a shared package's public API without a CODEOWNERS-approved plan

## What's a non-blocking follow-up comment
- Stylistic preferences already covered by the linter/formatter
- "Nice to have" suggestions not related to correctness
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: No Ownership Model for Shared Design System Components
As the scenario demonstrates, allowing ANY engineer to modify a shared component's public API without a review process scoped to that component's actual owners means breaking changes ship silently, discovered downstream rather than caught at review time — a `CODEOWNERS`-style enforced review is a cheap, high-leverage guardrail against this exact failure mode.

### ⚠️ Anti-Pattern 2: Undocumented, Reviewer-Dependent PR Standards
Without a written, shared understanding of what blocks a merge, review rigor becomes a function of WHICH reviewer happens to review a given PR — inconsistent, and a source of friction/frustration when different PRs are held to visibly different standards for no documented reason.

### ⚠️ Anti-Pattern 3: Making Non-Obvious Architectural Decisions Without Recording Why
A decision made for a specific, real reason (avoiding a past incident, a measured tradeoff) that's never written down is at genuine risk of being silently reversed later by someone who never knew the original reasoning — costing the team a second occurrence of whatever problem the original decision was protecting against. An ADR costs a few minutes to write and can save a repeated incident entirely.
