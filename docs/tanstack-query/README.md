---
title: "TanStack Query — Overview"
sidebar_label: "Overview"
sidebar_position: 0
---

:::caution Imported corpus — not yet validated

These pages were **moved in from the separate `frontend-bible` repo as-is**, on
2026-08-14. They are complete, readable and were written to a four-section
standard: *Under-The-Hood Mechanics → Real-World Scenario → Production-Grade Code
→ Senior Edge Cases*.

They do **not yet** meet this bible's page contract. Still outstanding:

- **no `> Verified:` line** — nothing here has been re-checked against current
  documentation, and some of it targets older major versions
- **no tier badge** — every topic still needs a Master / Understand / Know / When
  Needed judgement
- **no Interview questions section**
- a few cross-technology references were **de-linked** during the move because
  their targets are not part of this import

Treat the content as a strong draft, not as verified reference.

:::

**16 topics** across 16 sections.

| # | Section | Topics |
|---|---|---|
| 01 | [Core concepts](pages/01-core-concepts/01-the-server-state-model.md) | 1 |
| 02 | [Usequery deep dive](pages/02-usequery-deep-dive/01-core-options.md) | 1 |
| 03 | [Query states](pages/03-query-states/01-status-flags.md) | 1 |
| 04 | [Caching and invalidation](pages/04-caching-and-invalidation/01-cache-management-apis.md) | 1 |
| 05 | [Usemutation](pages/05-usemutation/01-mutation-lifecycle.md) | 1 |
| 06 | [Background refetching](pages/06-background-refetching/01-automatic-freshness.md) | 1 |
| 07 | [Pagination and infinite queries](pages/07-pagination-and-infinite-queries/01-paged-data-patterns.md) | 1 |
| 08 | [Dependent and parallel queries](pages/08-dependent-and-parallel-queries/01-query-composition.md) | 1 |
| 09 | [Prefetching and ssr](pages/09-prefetching-and-ssr/01-server-rendered-data-flow.md) | 1 |
| 10 | [Suspense integration](pages/10-suspense-integration/01-suspense-driven-fetching.md) | 1 |
| 11 | [Devtools](pages/11-devtools/01-react-query-devtools.md) | 1 |
| 12 | [Query cancellation](pages/12-query-cancellation/01-abortsignal-integration.md) | 1 |
| 13 | [Global configuration](pages/13-global-configuration/01-defaultoptions.md) | 1 |
| 14 | [Optimistic updates patterns](pages/14-optimistic-updates-patterns/01-advanced-rollback-strategies.md) | 1 |
| 15 | [Testing tanstack query](pages/15-testing-tanstack-query/01-isolated-and-integration-testing.md) | 1 |
| 16 | [Migration recipes](pages/16-migration-recipes/01-rtk-query-to-tanstack-query.md) | 1 |

import Progress from '@site/src/components/Progress';

<Progress lang="tanstack-query" compact />
