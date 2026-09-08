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
| 10 | [Suspense Integration](./10-suspense-integration/01-suspense-driven-fetching.md) | Master | ✅ |
| 11 | [DevTools](./11-devtools/01-react-query-devtools.md) | Master | ✅ |
| 12 | [Query Cancellation](./12-query-cancellation/01-abortsignal-integration.md) | Master | ✅ |
| 13 | [Global Configuration](./13-global-configuration/01-defaultoptions.md) | Master | ✅ |
| 14 | [Optimistic Updates Patterns](./14-optimistic-updates-patterns/01-advanced-rollback-strategies.md) | Master | ✅ |
| 15 | [Testing TanStack Query](./15-testing-tanstack-query/01-isolated-and-integration-testing.md) | Master | ✅ |
| 16 | [Migration Recipe](./16-migration-recipes/01-rtk-query-to-tanstack-query.md) | Master | ✅ |

### Continuation chunks

Topics that outgrew the 300-line file cap were split on a concept boundary; the parent page
links on to its continuation.

| Chunk | Belongs to |
|---|---|
| [01b · `enabled` & `skipToken`](./02-usequery-deep-dive/01b-enabled-and-skiptoken.md) | under **`useQuery` Deep Dive** |
| [01c · `staleTime` & `refetchOn*`](./02-usequery-deep-dive/01c-staletime-and-the-refetchon-family.md) | under **`useQuery` Deep Dive** |
| [01d · `retry` & `throwOnError`](./02-usequery-deep-dive/01d-retry-retrydelay-and-throwonerror.md) | under **`useQuery` Deep Dive** |
| [01b · Query filters: the key axis](./04-caching-and-invalidation/01b-query-filters-the-matching-surface.md) | under **Caching & Invalidation** |
| [01c · Filtering by state](./04-caching-and-invalidation/01c-filtering-by-state-type-stale-predicate.md) | under **Caching & Invalidation** |
| [01d · Invalidate vs refetch vs reset vs remove](./04-caching-and-invalidation/01d-invalidate-refetch-reset-remove.md) | under **Caching & Invalidation** |
| [01e · Direct cache access](./04-caching-and-invalidation/01e-direct-cache-access.md) | under **Caching & Invalidation** |
| [01f · staleTime vs gcTime](./04-caching-and-invalidation/01f-staletime-vs-gctime.md) | under **Caching & Invalidation** |
| [01j · Auditing for the rotation](./16-migration-recipes/01j-auditing-a-codebase-for-the-rotation.md) | under **Migration Recipe** |
| [01p · Prefetch timing & `staleTime`](./16-migration-recipes/01p-prefetch-scheduling-and-staletime.md) | under **Migration Recipe** |
| [01b · Refetch render cost](./06-background-refetching/01b-refetch-render-cost.md) | under **Background Refetching** |
| [01c · Polling](./06-background-refetching/01c-polling-and-refetch-interval.md) | under **Background Refetching** |
| [01d · Network mode & offline](./06-background-refetching/01d-network-mode-and-offline.md) | under **Background Refetching** |
| [01b · useInfiniteQuery](./07-pagination-and-infinite-queries/01b-infinite-queries.md) | under **Pagination & Infinite Queries** |
| [01c · Rendering & concurrency](./07-pagination-and-infinite-queries/01c-rendering-and-concurrency.md) | under **Pagination & Infinite Queries** |
| [01d · Infinite cache & refetch](./07-pagination-and-infinite-queries/01d-infinite-cache-refetch-and-manual-updates.md) | under **Pagination & Infinite Queries** |
| [Parallel Queries & `useQueries`](./08-dependent-and-parallel-queries/01b-parallel-queries-and-usequeries.md) | under **Dependent & Parallel Queries** |
| [Combining `useQueries` Results](./08-dependent-and-parallel-queries/01c-combining-usequeries-results.md) | under **Dependent & Parallel Queries** |
| [What Composition Costs](./08-dependent-and-parallel-queries/01d-what-query-composition-costs.md) | under **Dependent & Parallel Queries** |
| [The Gate in Full · `skipToken`](./08-dependent-and-parallel-queries/01e-the-gate-in-full-skiptoken-and-placeholder-chains.md) | under **Dependent & Parallel Queries** |
| [01f · initialData in a chain](./08-dependent-and-parallel-queries/01f-placeholder-and-initial-data-in-a-chain.md) | under **Dependent & Parallel Queries** |
| [01g · placeholderData in a chain](./08-dependent-and-parallel-queries/01g-placeholderdata-in-a-chain.md) | under **Dependent & Parallel Queries** |
| [01b · What suspense removes](./10-suspense-integration/01b-what-suspense-mode-removes.md) | under **Suspense Integration** |
| [01c · Errors and reset](./10-suspense-integration/01c-errors-boundaries-and-reset.md) | under **Suspense Integration** |
| [01d · Fetch timing and streaming](./10-suspense-integration/01d-fetch-on-render-and-streaming.md) | under **Suspense Integration** |
| [01b · status × fetchStatus](./11-devtools/01b-status-and-fetchstatus-matrix.md) | under **DevTools** |
| [01c · Reading a query key](./11-devtools/01c-reading-a-query-key.md) | under **DevTools** |
| [01d · Stale, fresh, inactive](./11-devtools/01d-stale-fresh-inactive-and-eviction.md) | under **DevTools** |
| [01e · Panel actions](./11-devtools/01e-panel-actions-and-cache-effects.md) | under **DevTools** |
| [01f · Devtools in production](./11-devtools/01f-keeping-devtools-out-of-production.md) | under **DevTools** |
| [01b · Concurrent mutations on one key](./14-optimistic-updates-patterns/01b-concurrent-mutations-on-one-key.md) | under **Optimistic Updates Patterns** |
| [01c · In-flight state and UI variables](./14-optimistic-updates-patterns/01c-in-flight-state-and-ui-variables.md) | under **Optimistic Updates Patterns** |
| [01d · Optimistic writes on infinite queries](./14-optimistic-updates-patterns/01d-optimistic-writes-on-infinite-queries.md) | under **Optimistic Updates Patterns** |
| [01b · Mocking at the network layer](./15-testing-tanstack-query/01b-mocking-at-the-network-layer.md) | under **Testing TanStack Query** |
| [01c · Testing mutations](./15-testing-tanstack-query/01c-testing-mutations.md) | under **Testing TanStack Query** |
| [01d · Suspense and harness hazards](./15-testing-tanstack-query/01d-suspense-and-harness-hazards.md) | under **Testing TanStack Query** |
| [01b · The option map & the defaults](./16-migration-recipes/01b-rtk-query-the-option-by-option-map.md) | under **Migration Recipe** |
| [01c · Endpoints → queryOptions](./16-migration-recipes/01c-rtk-query-endpoints-to-query-options.md) | under **Migration Recipe** |
| [01d · Mutations & rollback](./16-migration-recipes/01d-rtk-query-mutations-and-rollback.md) | under **Migration Recipe** |
| [01e · Running both caches at once](./16-migration-recipes/01e-running-both-caches-at-once.md) | under **Migration Recipe** |
| [01f · Mechanical vs semantic](./16-migration-recipes/01f-v4-to-v5-mechanical-versus-semantic.md) | under **Migration Recipe** |
| [01h · The status rename](./16-migration-recipes/01h-the-status-rename-and-the-isloading-trap.md) | under **Migration Recipe** |
| [01n · Prefetch → `query()`](./16-migration-recipes/01n-prefetchquery-to-queryclient-query.md) | under **Migration Recipe** |

---

← [Track overview](../README.md) · Start → [Core Concepts](./01-core-concepts/01-the-server-state-model.md)
