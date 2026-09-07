---
title: "TanStack Query — Explanations"
sidebar_label: "Explanations"
sidebar_position: 0
---

The 16 explanation topics for TanStack Query, in reading order. Each page carries its own tier
badge, its sources, a `## Gotchas` section and a `## Interview questions` section. Start at
[Core Concepts](./01-core-concepts/01-the-server-state-model.md) and follow the footers — the
`Next →` link at the bottom of every page is the reading order.

See the [track overview](../README.md) for the state of the imported corpus. The **Validated**
column is the live one: ✅ means the page has been re-checked against the pinned
`@tanstack/react-query 5.102.8` documentation and carries a `> Validated:` stamp; ⬜ means it is
still the imported text.

## Topics

| # | Topic | Tier | Validated |
|---|---|---|---|
| 01 | [Core Concepts](./01-core-concepts/01-the-server-state-model.md) | Master | ✅ |
| 02 | [`useQuery` Deep Dive](./02-usequery-deep-dive/01-core-options.md) | Master | ✅ |
| 03 | [Query States](./03-query-states/01-status-flags.md) | Understand | ✅ |
| 04 | [Caching & Invalidation](./04-caching-and-invalidation/01-cache-management-apis.md) | Master | ✅ |
| 05 | [`useMutation`](./05-usemutation/01-mutation-lifecycle.md) | Master | ✅ |
| 06 | [Background Refetching](./06-background-refetching/01-automatic-freshness.md) | Master | ✅ |
| 07 | [Pagination & Infinite Queries](./07-pagination-and-infinite-queries/01-paged-data-patterns.md) | Master | ✅ |
| 08 | [Dependent & Parallel Queries](./08-dependent-and-parallel-queries/01-query-composition.md) | Master | ✅ |
| 09 | [Prefetching & SSR](./09-prefetching-and-ssr/01-server-rendered-data-flow.md) | Understand | ✅ |
| 10 | [Suspense Integration](./10-suspense-integration/01-suspense-driven-fetching.md) | — | ⬜ |
| 11 | [DevTools](./11-devtools/01-react-query-devtools.md) | — | ⬜ |
| 12 | [Query Cancellation](./12-query-cancellation/01-abortsignal-integration.md) | Master | ✅ |
| 13 | [Global Configuration](./13-global-configuration/01-defaultoptions.md) | Master | ✅ |
| 14 | [Optimistic Updates Patterns](./14-optimistic-updates-patterns/01-advanced-rollback-strategies.md) | — | ⬜ |
| 15 | [Testing TanStack Query](./15-testing-tanstack-query/01-isolated-and-integration-testing.md) | — | ⬜ |
| 16 | [Migration Recipe](./16-migration-recipes/01-rtk-query-to-tanstack-query.md) | — | ⬜ |

### Continuation chunks

Topics that outgrew the 300-line file cap were split on a concept boundary; the parent page
links on to its continuation.

| Chunk | Belongs to |
|---|---|
| [01b · Refetch render cost](./06-background-refetching/01b-refetch-render-cost.md) | under **Background Refetching** |
| [01b · useInfiniteQuery](./07-pagination-and-infinite-queries/01b-infinite-queries.md) | under **Pagination & Infinite Queries** |
| [01c · Infinite cache & refetch](./07-pagination-and-infinite-queries/01c-infinite-cache-refetch-and-manual-updates.md) | under **Pagination & Infinite Queries** |

---

← [Track overview](../README.md) · Start → [Core Concepts](./01-core-concepts/01-the-server-state-model.md)
