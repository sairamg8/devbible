---
title: "CI/CD Pipeline Design: Stage Ordering, Preview Deployments & Progressive Rollout"
sidebar_label: "CI/CD Pipeline Design"
sidebar_position: 1
---

# 🏛️ CI/CD Pipeline Design: Stage Ordering, Preview Deployments & Progressive Rollout

## 1. The Decision Framework

A CI/CD pipeline's stage ORDER is itself a real design decision — it determines how quickly a broken PR fails, and therefore how much CI compute (and engineer waiting time) gets wasted on PRs that were always going to fail anyway.

```
Fail-fast ordering (cheapest checks FIRST):        Naive ordering (expensive checks first):
  lint (seconds) ──► typecheck (seconds) ──►         E2E tests (minutes) ──► build (minutes) ──►
  unit/component tests (under a minute) ──►            typecheck (seconds) ──► lint (seconds)
  build (minutes) ──► E2E (minutes) ──► deploy       ── a LINT ERROR still waits through several
  ── a lint error fails in SECONDS,                     MINUTES of expensive E2E/build work before
     not after minutes of wasted E2E run time             the pipeline gets around to catching it
```

### Preview Deployments: Ephemeral, Per-PR Environments
An ephemeral deployment per PR (a genuinely live, reviewable environment, not just a code diff) lets reviewers/stakeholders verify the ACTUAL running behavior of a change before merging — the same underlying value proposition as Chromatic's per-PR Storybook links (covered in the [Storybook publishing doc](../../../storybook/pages/14-publishing-and-deployment/01-shipping-a-static-storybook.md)), applied to the whole application rather than just its component library.

### Performance Gating: Making Regressions a Merge-Blocking Concern
Wiring Lighthouse CI / bundle-size checks (covered in the [Web Vitals performance budgets doc](../../../web-vitals-performance/pages/10-budgets-and-advanced-diagnostics/01-performance-budgets-and-deep-profiling.md)) as a REQUIRED status check turns "don't regress performance" from an easily-ignored aspiration into an enforced gate — the same principle underlying every merge-blocking check in a mature pipeline.

### Progressive Rollout: Canaries, Staged Percentages & Fast Rollback
Deploying a change to 100% of production traffic instantly means a subtle bug affects EVERY user simultaneously, the moment it ships. A canary release (deploying to a small percentage first, monitoring key metrics, then progressively increasing) contains a bad deploy's blast radius to a small fraction of users — combined with monitoring-triggered automatic rollback (a canary's error rate spiking automatically halts further rollout and reverts), this turns "we shipped a bug to everyone" into "we shipped a bug to 5% of users for a few minutes."

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team's CI Pipeline Wasting 8 Minutes Per PR on Failures That Could Have Been Caught in 15 Seconds.
A team's pipeline ran E2E tests (8 minutes) BEFORE running lint/typecheck (15 seconds combined) — meaning a PR with a simple typo (caught instantly by the linter) still had to wait through the full 8-minute E2E suite before the pipeline got around to reporting the trivial lint failure, since stages ran in that order regardless of earlier failures being possible to detect much faster. Reordering the pipeline to run cheapest-first (lint → typecheck → unit tests → build → E2E) meant the SAME typo now failed in 15 seconds instead of 8+ minutes — a simple reordering, zero new tooling, that dramatically improved the team's actual feedback loop speed for the (very common) case of a PR failing on something trivial.

---

## 3. Reference Implementation

```yaml
# .github/workflows/ci.yml — fail-fast stage ordering
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [{ run: npm run lint }] # seconds — fails FAST for trivial issues

  typecheck:
    needs: lint
    steps: [{ run: npm run typecheck }] # seconds

  unit-tests:
    needs: typecheck
    steps: [{ run: npm run test }] # under a minute

  build:
    needs: unit-tests
    steps: [{ run: npm run build }] # minutes — only runs if everything CHEAPER already passed

  e2e:
    needs: build
    steps: [{ run: npm run test:e2e }] # the MOST expensive stage, run LAST

  deploy-preview:
    needs: build
    steps: [{ run: deploy-ephemeral-environment }] # a reviewable, live PR-specific environment
```

```yaml
# Performance gating as a REQUIRED, merge-blocking check
  lighthouse-ci:
    needs: build
    steps:
      - run: npx lhci autorun # fails the PR if Core Web Vitals regress past the configured budget
```

```yaml
# Progressive rollout — canary percentage, monitored, with automatic rollback on regression
- run: deploy --canary-percentage=5   # 5% of production traffic
- run: monitor-error-rate --duration=10m --threshold=0.1%
- run: deploy --canary-percentage=100  # ONLY proceeds if the canary's error rate stayed healthy
# (a monitoring-triggered automatic rollback step would revert if the threshold was exceeded)
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Expensive Stages Running Before Cheap Ones
As the scenario demonstrates, this wastes real CI compute and engineer waiting time on failures that could have been caught in seconds — always order pipeline stages from cheapest/fastest to most expensive/slowest, so the pipeline fails at the earliest possible point for any given class of issue.

### ⚠️ Anti-Pattern 2: Deploying Directly to 100% of Production Traffic With No Staged Rollout
Skipping canary/staged rollout for anything beyond a trivial, low-risk change means a subtle bug (one that passed all automated tests but manifests only under specific real production conditions) affects the ENTIRE user base simultaneously, the moment it ships — with no contained blast radius and no automatic early-warning signal before full exposure.

### ⚠️ Anti-Pattern 3: Performance/Quality Gates Configured as Informational Only, Never Actually Blocking
Running Lighthouse CI or bundle-size checks that merely REPORT a regression (without being configured as a required, merge-blocking status check) provides visibility but no actual enforcement — a team under deadline pressure will very reasonably merge past a mere warning, which over time erodes the gate's entire purpose. If a check exists specifically to prevent regressions, it needs to actually be capable of blocking a merge, not just informing about one.
