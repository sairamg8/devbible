---
title: "Monorepo & Multi-App Strategy: When to Monorepo, Tooling & Build Caching"
sidebar_label: "Monorepo & Multi-App Strategy"
sidebar_position: 1
---

# 🏛️ Monorepo & Multi-App Strategy: When to Monorepo, Tooling & Build Caching

## 1. The Decision Framework

A monorepo is a genuine architectural commitment with real tooling requirements — appropriate for a specific organizational shape, not a default "best practice" for every project.

```
WHEN a monorepo genuinely helps:                    WHEN it doesn't (single app, single team):
  - multiple apps SHARE UI/types/config                - one app, one team ──► a single repo with
    (a design system consumed by 3+ products)             normal folder structure has NONE of a
  - changes spanning "frontend + shared package"           monorepo's coordination overhead, and
    need to be reviewed/merged/tested ATOMICALLY,           gains none of its cross-package benefits
    not across separate repos with separate PRs
```

### Tooling: Task Orchestration + Dependency Linking Are Separate Concerns
- **Turborepo/Nx** — task orchestration: running `build`/`test`/`lint` across many packages, understanding the dependency graph between them (package A must build before package B, which depends on it), and **remote build caching** (a task's output is cached and reused across CI runs/machines if its inputs haven't changed).
- **pnpm/yarn workspaces** — dependency linking: letting `packages/ui` be `import`-able from `apps/web` as if it were a published npm package, without actually publishing it, symlinked locally instead.

These solve genuinely different problems — a monorepo typically needs both, but conflating them (assuming one tool handles everything) leads to incomplete setups.

### Build Caching: The Actual Payoff at Scale
Content-hash-based task caching (a core Turborepo/Nx feature) means a CI run only rebuilds/retests packages whose actual inputs (source files, dependencies) changed since the last cached run — a monorepo with 15 packages where a PR only touches one of them can skip rebuilding/retesting the other 14 entirely, turning CI time from "proportional to total monorepo size" into "proportional to the size of the actual change" (the same underlying idea as Chromatic's TurboSnap, covered in the [Storybook visual testing doc](../../../storybook/pages/06-visual-testing/01-chromatic-integration.md)).

---

## 2. Real-World Engineering Scenario

**Scenario**: Three Product Teams Independently Maintaining Divergent Copies of the Same Button Component, Unified by a Monorepo Migration.
Three separate product teams, each in their own repository, had each independently built (and slowly diverged) their own version of a `<Button>` component — subtly different padding, slightly different disabled-state handling, inconsistent accessibility attributes across the three copies. Consolidating into a monorepo with a single `packages/ui` (workspace-linked into all three apps via pnpm workspaces) meant a single, shared `<Button>` implementation, with a fix or improvement made once benefiting all three apps simultaneously — and Turborepo's build caching meant that CI for App A's PRs didn't need to rebuild/retest Apps B and C's unrelated code, keeping per-PR CI time reasonable despite the monorepo now containing three full applications plus shared packages.

---

## 3. Reference Implementation

```
# Monorepo structure
apps/
  web/              # workspace-linked, depends on packages/ui and packages/types
  admin/            # ALSO depends on packages/ui — same shared components, same fixes benefit both
packages/
  ui/               # the shared design system — @acme/ui
  config/           # shared eslint/tsconfig config — @acme/config
  types/            # shared TypeScript types generated from the backend schema — @acme/types
```

```json
// package.json (workspace root) — pnpm workspaces for dependency linking
{
  "workspaces": ["apps/*", "packages/*"]
}
```

```json
// turbo.json — task orchestration + content-hash-based caching
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["build"], "outputs": [] }
  }
}
```

```json
// apps/web/package.json — depends on the shared package via workspace protocol, not a published version
{
  "dependencies": { "@acme/ui": "workspace:*" }
}
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Adopting a Monorepo for a Single App With No Shared-Package Need
A monorepo's tooling (Turborepo/Nx configuration, workspace linking setup) adds real setup and ongoing maintenance overhead — adopting it for a single app, single team, with no actual shared packages, pays that cost for zero corresponding benefit. A monorepo's value is specifically in coordinating MULTIPLE packages/apps; absent that, a normal single-repo structure is simpler and equally effective.

### ⚠️ Anti-Pattern 2: A Monorepo Without Build Caching Configured, Rebuilding Everything on Every CI Run
Setting up the workspace/folder structure of a monorepo without actually configuring Turborepo/Nx's caching means CI still rebuilds/retests every package on every single PR, regardless of what actually changed — capturing the monorepo's coordination benefit (shared code) while missing its most significant CI-time-saving benefit (caching), often making CI SLOWER than separate repos would have been, since it now builds everything in one pipeline with no caching to skip unaffected work.

### ⚠️ Anti-Pattern 3: Publishing Shared Packages to a Real Registry When Workspace Linking Would Suffice
For packages only ever consumed by apps within the SAME monorepo, publishing them to an internal/public npm registry (requiring a version bump + publish step before consuming apps can pick up a change) adds unnecessary process overhead compared to workspace-linked packages, where a change to `packages/ui` is immediately available to every consuming app in the same repo without any publish step at all. Reserve actual publishing for packages genuinely consumed OUTSIDE the monorepo (a public open-source package, or a package consumed by a separate, unrelated repository).
