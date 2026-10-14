---
title: "Link map · TanStack Query · Part 1 (all sections)"
sidebar_label: "01 · tanstack query"
sidebar_position: 1
---

# Link map · TanStack Query · Part 1 (all sections)

Covers all 16 sections of `docs/tanstack-query/pages/`: 69 chunk files in 16 topic groups, written up as 43 blocks (large groups are split into clusters of related chunks, each block naming its first chunk file). Every block has a written page of ours. This track has no syllabus, so topics come from the page tree.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Official links point at `tanstack.com/query/latest` (v5) and were live on 2026-10-14. TkDodo posts carry their own dates; many were last updated 2023-10-21 and predate v5 naming, which each block flags where it matters. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages were verified against **@tanstack/react-query 5.102.8** (September 2026). The live Prefetching guide and Migrating to v5 now call `prefetchQuery` deprecated in favour of `queryClient.query`, which matches our section 9 and 16 pages. Redux Toolkit docs moved to `redux.js.org/toolkit`, so the RTK links use that host.
## Section 01 — Core concepts

### T01-01 · The server-state model and QueryClient — Topic · ✅ written `docs/tanstack-query/pages/01-core-concepts/01-the-server-state-model.md`
- **Read this:** [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) · TanStack Query docs · the shortest official statement of the model: cached data is stale at once, refetches on mount, focus and reconnect, inactive entries are collected after 5 minutes (*read*) · covers our angle: **partial** — lists the defaults but does not argue why server state differs from client state · fetched 2026-10-14
- **Also good:** [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) · TanStack Query docs · the three pieces a query needs (key, function, status) and the status and fetchStatus split (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-08-20 · argues that the library is an async state manager, not a fetcher, and that you hold a snapshot of data you do not own · fetched 2026-10-14 (*read*)
- **Our delta:** `QueryClient` as the container for both caches, and the cost of copying server data into a second store.

## Section 02 — useQuery deep dive

### T02-01a · Core options: queryKey, staleTime, gcTime, select — Topic · ✅ written `docs/tanstack-query/pages/02-usequery-deep-dive/01-core-options.md`
- **Read this:** [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) · TanStack Query docs · the defaults behind every option on our page (*read*) · covers our angle: **partial** — no per-option reasoning · fetched 2026-10-14
- **Also good:** [useQuery reference](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery) · TanStack Query API reference · every option and result field with its default (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Practical React Query](https://tkdodo.eu/blog/practical-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2020-11-16, updated 2023-10-21 · the staleTime vs gcTime split and why he tunes staleTime and rarely gcTime · fetched 2026-10-14 (*read*)
- **Our delta:** the four-way option map (identity, freshness, retention, projection) in one place.

### T02-01b · enabled and skipToken — Topic · ✅ written `docs/tanstack-query/pages/02-usequery-deep-dive/01b-enabled-and-skiptoken.md`
- **Read this:** [Disabling/Pausing Queries](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries) · TanStack Query docs · what `enabled: false` opts out of (mount fetch, background refetch, invalidation) and the `skipToken` limitation: `refetch()` throws Missing queryFn (*read*) · covers our angle: **full** — states both the opt-out and the skipToken refetch trap · fetched 2026-10-14
- **Beyond the docs:** [React Query and TypeScript](https://tkdodo.eu/blog/react-query-and-type-script) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-05-16, updated 2023-10-21 · why `enabled` does not narrow a possibly-undefined id inside `queryFn` and how `skipToken` (from v5.25) fixes it · fetched 2026-10-14 (*read*)
- **Our delta:** the typed-narrowing trade: `skipToken` gives up `refetch` to get it.

### T02-01c · staleTime, refetchOn flags, retry and throwOnError — Topic · ✅ written `docs/tanstack-query/pages/02-usequery-deep-dive/01c-staletime-and-the-refetchon-family.md`
- **Read this:** [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) · TanStack Query docs · staleTime 0, the three refetch triggers, retry 3 with backoff (*read*) · covers our angle: **partial** — does not say staleTime gates every trigger or cover throwOnError · fetched 2026-10-14
- **Also good:** [Query Retries](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries) · TanStack Query docs · default 3 retries, exponential delay from 1s capped at 30s, off on the server; does not cover throwOnError (*read*) · fetched 2026-10-14
- **Beyond the docs:** [React Query Error Handling](https://tkdodo.eu/blog/react-query-error-handling) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-09-10, updated 2023-10-21 · `throwOnError` as true or a predicate (send 5xx to the boundary, handle 4xx locally); written when it was `useErrorBoundary` · fetched 2026-10-14 (*read*)
- **Our delta:** that `staleTime` decides whether any trigger acts, and the default predicate letting background failures pass.

### T02-01d · initialData vs placeholderData and seeding — Topic · ✅ written `docs/tanstack-query/pages/02-usequery-deep-dive/01e-initialdata-vs-placeholderdata.md`
- **Read this:** [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data) · TanStack Query docs · `initialData` is persisted to the cache, `initialDataUpdatedAt`, and seeding a detail query from a list (*read*) · covers our angle: **full** — covers the cache-write side and the list-to-detail seed · fetched 2026-10-14
- **Also good:** [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data) · TanStack Query docs · the observer-level counterpart and `isPlaceholderData` (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Placeholder and Initial Data in React Query](https://tkdodo.eu/blog/placeholder-and-initial-data-in-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-08-09 · cache level vs observer level, and how each behaves on a failed refetch · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Seeding the Query Cache](https://tkdodo.eu/blog/seeding-the-query-cache) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2022-10-22, updated 2023-10-21 · pull (`initialData`) vs push (`setQueryData`) seeding and the staleness trap · fetched 2026-10-14 (*read*)
- **Our delta:** hydration, `dataUpdatedAt` and suspense each breaking the pair differently.

### T02-01e · select as a per-observer projection — Topic · ✅ written `docs/tanstack-query/pages/02-usequery-deep-dive/01f-select.md`
- **Read this:** [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations) · TanStack Query docs · `select` re-runs only when its reference or the data changes, so an inline arrow runs every render; structural sharing applies to its result (*read*) · covers our angle: **full** — states the referential rule directly · fetched 2026-10-14
- **Beyond the docs:** [React Query Selectors, Supercharged](https://tkdodo.eu/blog/react-query-selectors-supercharged) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2025-08-04 · why the inline-function behaviour is useful, and when to stabilise with `useCallback` or a module-level function · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [React Query Data Transformations](https://tkdodo.eu/blog/react-query-data-transformations) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-03-10, updated 2023-10-21 · transform in `queryFn` vs `select`, with the trade-offs · fetched 2026-10-14 (*read*)
- **Our delta:** select as per-observer projection over one shared entry, not memoisation.

### T02-01f · queryOptions factories and type inference — Topic · ✅ written `docs/tanstack-query/pages/02-usequery-deep-dive/01g-queryoptions-factories-and-type-inference.md`
- **Read this:** [Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) · TanStack Query docs · `queryOptions` shared across `useQuery`, `useSuspenseQuery`, `useQueries` and `setQueryData`; does not mention `skipToken` (*read*) · covers our angle: **partial** — a one-parameter factory only; none of the four design decisions · fetched 2026-10-14
- **Beyond the docs:** [The Query Options API](https://tkdodo.eu/blog/the-query-options-api) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2024-01-17 · `queryOptions` tags the key with the data type so `getQueryData` infers instead of casting · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Leveraging the Query Function Context](https://tkdodo.eu/blog/leveraging-the-query-function-context) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-10-26, updated 2023-01-03 · reading arguments from the key vs a closure, and a typed key factory · fetched 2026-10-14 (*read*)
- **Our delta:** parameterised factories, spread overrides, and `skipToken` inside a shared definition.

## Section 03 — Query states

### T03-01 · status vs fetchStatus and the loading flags — Topic · ✅ written `docs/tanstack-query/pages/03-query-states/01-status-flags.md`
- **Read this:** [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) · TanStack Query docs · status is about `data`, fetchStatus is about the `queryFn`; check pending, then error, then success (*headings only*) · covers our angle: **partial** — no flag-family table · fetched 2026-10-14
- **Also good:** [Background Fetching Indicators](https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators) · TanStack Query docs · `isFetching` vs `isPending` for a global or per-query spinner (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Status Checks in React Query](https://tkdodo.eu/blog/status-checks-in-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-03-27, updated 2023-10-21 · status as the state machine, `isFetching` as derived; check data before error so stale data survives a failed refetch · fetched 2026-10-14 (*read*)
- **Our delta:** the whole flag family, with the v5 meaning of `isLoading`.

## Section 04 — Caching and invalidation

### T04-01a · Cache management APIs and query filters — Topic · ✅ written `docs/tanstack-query/pages/04-caching-and-invalidation/01-cache-management-apis.md`
- **Read this:** [Query Filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters) · TanStack Query docs · queryKey, exact, type, stale, fetchStatus and predicate, each defined (*read*) · covers our angle: **full** — the filter fields on our b and c chunks · fetched 2026-10-14
- **Read this:** [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) · TanStack Query docs · prefix matching by default, `exact`, `predicate` (*read*) · covers our angle: **partial** — invalidation only · fetched 2026-10-14
- **Also good:** [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient) · TanStack Query API reference · method signatures for invalidateQueries, refetchQueries, resetQueries, removeQueries, setQueryData and getQueryData (*headings only*) · fetched 2026-10-14
- **Our delta:** which field decides first, and what `type` does to unobserved queries.

### T04-01b · invalidate, refetch, reset, remove — Topic · ✅ written `docs/tanstack-query/pages/04-caching-and-invalidation/01d-invalidate-refetch-reset-remove.md`
- **Read this:** [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) · TanStack Query docs · marks matches stale (overriding staleTime) and refetches the observed ones; the page never mentions `resetQueries` and names `removeQueries` once (*read*) · covers our angle: **partial** — one of the four methods · fetched 2026-10-14
- **Also good:** [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient) · TanStack Query API reference · method signatures for invalidateQueries, refetchQueries, resetQueries, removeQueries, setQueryData and getQueryData (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Automatic Query Invalidation after Mutations](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2024-05-25, updated 2025-11-25 · invalidation refetches only active queries and marks the rest stale, so over-invalidating is cheap · fetched 2026-10-14 (*read*)
- **Our delta:** the four-way comparison: data, observers and next frame.

### T04-01c · setQueryData and direct cache access — Topic · ✅ written `docs/tanstack-query/pages/04-caching-and-invalidation/01e-direct-cache-access.md`
- **Read this:** [Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses) · TanStack Query docs · writing a mutation's response straight into the cache with `setQueryData` (*headings only*) · covers our angle: **partial** — no undefined-updater warning · fetched 2026-10-14
- **Also good:** [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient) · TanStack Query API reference · method signatures for invalidateQueries, refetchQueries, resetQueries, removeQueries, setQueryData and getQueryData (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Using WebSockets with React Query](https://tkdodo.eu/blog/using-web-sockets-with-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-06-06 · invalidate by default, `setQueryData` or `setQueriesData` for small partial updates, and why partial writes miss additions and deletions · fetched 2026-10-14 (*read*)
- **Our delta:** the updater receiving undefined on a cold cache.

### T04-01d · staleTime vs gcTime — Topic · ✅ written `docs/tanstack-query/pages/04-caching-and-invalidation/01f-staletime-vs-gctime.md`
- **Read this:** [Caching](https://tanstack.com/query/latest/docs/framework/react/guides/caching) · TanStack Query docs · the five-step lifecycle: first mount, extra mounts, all unmount (inactive), remount within gcTime, then collection (*read*) · covers our angle: **full** — the lifecycle behind both timers · fetched 2026-10-14
- **Also good:** [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) · TanStack Query docs · staleTime 0 and gcTime 5 minutes stated as defaults (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Practical React Query](https://tkdodo.eu/blog/practical-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2020-11-16, updated 2023-10-21 · a fresh query reads only from the cache; inactive means no observers · fetched 2026-10-14 (*read*)
- **Our delta:** gcTime doing nothing while anything observes the query.

### T04-01e · Structural sharing and the option — Topic · ✅ written `docs/tanstack-query/pages/04-caching-and-invalidation/01g-structural-sharing.md`
- **Read this:** [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations) · TanStack Query docs · structural sharing keeps unchanged references, JSON-compatible data only; `structuralSharing: false` or a custom function; tracked-properties proxy (*read*) · covers our angle: **full** — states the option's three forms · fetched 2026-10-14
- **Beyond the docs:** [React Query Render Optimizations](https://tkdodo.eu/blog/react-query-render-optimizations) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-03-20, updated 2023-10-21 · the todo walk-through where the unchanged object keeps its reference across a refetch · fetched 2026-10-14 (*read*)
- **Our delta:** node-by-node comparison and what a comparator gives back.

### T04-01f · Query key factories and what belongs in a key — Topic · ✅ written `docs/tanstack-query/pages/04-caching-and-invalidation/01h-query-key-factories.md`
- **Read this:** [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) · TanStack Query docs · arrays, hashing, order of array items matters and object property order does not (*headings only*) · covers our angle: **partial** — the rules, not the factory pattern · fetched 2026-10-14
- **Beyond the docs:** [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-06-13, updated 2022-04-23 · one factory per feature, generic to specific, so invalidation can target lists or details · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Leveraging the Query Function Context](https://tkdodo.eu/blog/leveraging-the-query-function-context) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-10-26, updated 2023-01-03 · every dependency belongs in the key; a closure lets key and function drift apart · fetched 2026-10-14 (*read*)
- **Our delta:** both silent failures: collapsed entries and a fresh entry per render.

## Section 05 — useMutation

### T05-01 · Mutation lifecycle, optimistic updates, mutate vs mutateAsync — Topic · ✅ written `docs/tanstack-query/pages/05-usemutation/01-mutation-lifecycle.md`
- **Read this:** [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) · TanStack Query docs · onMutate, onError, onSuccess, onSettled order, the onMutate result passed on, mutate vs mutateAsync, and per-call callbacks skipped on unmount (*read*) · covers our angle: **full** — the callback chain and the unmount caveat · fetched 2026-10-14
- **Also good:** [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) · TanStack Query docs · the variables approach and the onMutate cache approach (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Mastering Mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-10-09, updated 2023-10-21 · prefer `mutate`; data logic in `useMutation` callbacks, UI actions in `mutate` callbacks · fetched 2026-10-14 (*read*)
- **Our delta:** the v5 argument order (third is the onMutate result) and rollback.

## Section 06 — Background refetching

### T06-01a · Window focus, reconnect and the staleness gate — Topic · ✅ written `docs/tanstack-query/pages/06-background-refetching/01-automatic-freshness.md`
- **Read this:** [Window Focus Refetching](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching) · TanStack Query docs · focus refetch on by default for stale data; `focusManager` and the visibilitychange default; reconnect is not covered (*read*) · covers our angle: **partial** — focus only; the shared gate is not stated · fetched 2026-10-14
- **Also good:** [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) · TanStack Query docs · the three triggers listed together, all gated by stale data (*read*) · fetched 2026-10-14
- **Beyond the docs:** [React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-08-20 · stale-while-revalidate and why a zero default staleTime refetches on every mount · fetched 2026-10-14 (*read*)
- **Our delta:** all three triggers through one gate, plus the tracked-properties render cost.

### T06-01b · Polling with refetchInterval — Topic · ✅ written `docs/tanstack-query/pages/06-background-refetching/01c-polling-and-refetch-interval.md`
- **Read this:** [Polling](https://tanstack.com/query/latest/docs/framework/react/guides/polling) · TanStack Query docs · `refetchInterval` as a number or a function returning a number or false, paused in hidden tabs unless `refetchIntervalInBackground` (*read*) · covers our angle: **partial** — no per-observer timer detail · fetched 2026-10-14
- **Our delta:** why two components make two timers.

### T06-01c · networkMode and paused fetchStatus — Topic · ✅ written `docs/tanstack-query/pages/06-background-refetching/01d-network-mode-and-offline.md`
- **Read this:** [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) · TanStack Query docs · online, always and offlineFirst; a query can be pending and paused at once; mentions onlineManager only for the devtools toggle (*read*) · covers our angle: **full** — the three modes and the paused state · fetched 2026-10-14
- **Also good:** [Navigator: onLine property](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) · MDN · what the browser's online flag means and why it is not proof of reachability (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Offline React Query](https://tkdodo.eu/blog/offline-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2022-02-05 · introduces networkMode and the paused fetchStatus; written for v4 · fetched 2026-10-14 (*read*)
- **Our delta:** why the browser's idea of online should not be trusted.

## Section 07 — Pagination and infinite queries

### T07-01a · Paged data and useInfiniteQuery in v5 — Topic · ✅ written `docs/tanstack-query/pages/07-pagination-and-infinite-queries/01-paged-data-patterns.md`
- **Read this:** [Paginated Queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries) · TanStack Query docs · `placeholderData: keepPreviousData` and `isPlaceholderData` for page-number UIs (*read*) · covers our angle: **full** — the page-number half · fetched 2026-10-14
- **Also good:** [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) · TanStack Query docs · required `initialPageParam`, `getNextPageParam` returning null or undefined to stop, `hasNextPage` (*read*) · fetched 2026-10-14
- **Our delta:** the v5 migration points: required params and null ending the list.

### T07-01b · Infinite runtime, concurrency and refetch cost — Topic · ✅ written `docs/tanstack-query/pages/07-pagination-and-infinite-queries/01c-rendering-and-concurrency.md`
- **Read this:** [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) · TanStack Query docs · pages refetch sequentially from the first; `maxPages` caps stored pages and refetch cost; `isFetchingNextPage` vs background refresh (*read*) · covers our angle: **full** — refetch cost and maxPages · fetched 2026-10-14
- **Also good:** [useInfiniteQuery reference](https://tanstack.com/query/latest/docs/framework/react/reference/useInfiniteQuery) · TanStack Query API reference · result fields and options for fetchNextPage and fetchPreviousPage (*headings only*) · fetched 2026-10-14
- **Our delta:** one in-flight fetch and the exact shape of `data`.

## Section 08 — Dependent and parallel queries

### T08-01a · enabled chaining, parallel queries and useQueries — Topic · ✅ written `docs/tanstack-query/pages/08-dependent-and-parallel-queries/01-query-composition.md`
- **Read this:** [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries) · TanStack Query docs · `enabled: !!userId` chaining (pending, fetchStatus idle), dependent `useQueries`, and the waterfall caveat (*read*) · covers our angle: **full** — the chain and its latency cost · fetched 2026-10-14
- **Also good:** [Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries) · TanStack Query docs · manual parallel calls, and `useQueries` for a variable count because of the Rules of Hooks (*read*) · fetched 2026-10-14
- **Our delta:** when fan-out beats a chain.

### T08-01b · Combining useQueries results — Topic · ✅ written `docs/tanstack-query/pages/08-dependent-and-parallel-queries/01c-combining-usequeries-results.md`
- **Read this:** [useQueries reference](https://tanstack.com/query/latest/docs/framework/react/reference/useQueries) · TanStack Query API reference · the `combine` option and result shape (*headings only*) · covers our angle: **partial** — no inline-combine memoisation warning · fetched 2026-10-14
- **Also good:** [Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries) · TanStack Query docs · `useQueries` basics; the page does not mention `combine` (*read*) · fetched 2026-10-14
- **Our delta:** inline `combine` memoising nothing, and empty-array aggregates saying done.

### T08-01c · Gates, skipToken and the cost of composition — Topic · ✅ written `docs/tanstack-query/pages/08-dependent-and-parallel-queries/01d-what-query-composition-costs.md`
- **Read this:** [Disabling/Pausing Queries](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries) · TanStack Query docs · a disabled query ignores invalidation and refetch triggers; `skipToken` loses `refetch` (*read*) · covers our angle: **partial** — the gate half · fetched 2026-10-14
- **Also good:** [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries) · TanStack Query docs · serial queries roughly double wait time; flatten on the backend if possible (*read*) · fetched 2026-10-14
- **Our delta:** a gated query never following its parent's refetch.

### T08-01d · initialData and placeholderData in a chain — Topic · ✅ written `docs/tanstack-query/pages/08-dependent-and-parallel-queries/01f-placeholder-and-initial-data-in-a-chain.md`
- **Read this:** [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data) · TanStack Query docs · initialData counts as fresh within `staleTime`, `initialDataUpdatedAt` (*read*) · covers our angle: **partial** — no chain behaviour · fetched 2026-10-14
- **Also good:** [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data) · TanStack Query docs · placeholder data stays at observer level (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Placeholder and Initial Data in React Query](https://tkdodo.eu/blog/placeholder-and-initial-data-in-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-08-09 · initialData skips the refetch within staleTime, placeholderData always refetches on mount · fetched 2026-10-14 (*read*)
- **Our delta:** what each does to a dependent query's status.

## Section 09 — Prefetching and SSR

### T09-01 · Server-rendered data flow, dehydrate and HydrationBoundary — Topic · ✅ written `docs/tanstack-query/pages/09-prefetching-and-ssr/01-server-rendered-data-flow.md`
- **Read this:** [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) · TanStack Query docs · server prefetch into a per-request client, `dehydrate`, `HydrationBoundary`, staleTime above 0, streaming pending queries (5.40+), waterfalls from sequential awaits (*read*) · covers our angle: **full** — the Next.js app-router flow · fetched 2026-10-14
- **Also good:** [Prefetching and Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching) · TanStack Query docs · event prefetching and router integration; says `query` replaces the now-deprecated `prefetchQuery` (*read*) · fetched 2026-10-14
- **Also good:** [Server Rendering and Hydration](https://tanstack.com/query/latest/docs/framework/react/guides/ssr) · TanStack Query docs · the shorter Pages Router era guide (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [React Query meets React Router](https://tkdodo.eu/blog/react-query-meets-react-router) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2022-08-28, updated 2022-12-11 · loaders fill the cache while components still call `useQuery`; fetchQuery vs prefetchQuery in a loader (v4 era) · fetched 2026-10-14 (*read*)
- **Our delta:** the `queryClient.query()` replacement and the Next.js specifics.

## Section 10 — Suspense integration

### T10-01a · useSuspenseQuery and what suspense mode removes — Topic · ✅ written `docs/tanstack-query/pages/10-suspense-integration/01-suspense-driven-fetching.md`
- **Read this:** [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense) · TanStack Query docs · `data` always defined, loading and error handled by Suspense and error boundaries, `enabled` not allowed, queries in one component fetch serially (*read*) · covers our angle: **full** — the removed options · fetched 2026-10-14
- **Also good:** [useSuspenseQuery reference](https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQuery) · TanStack Query API reference · signature and return type (*headings only*) · fetched 2026-10-14
- **Our delta:** trading three flags for two boundaries; placeholderData also gone.

### T10-01b · Suspense errors, boundaries and reset — Topic · ✅ written `docs/tanstack-query/pages/10-suspense-integration/01c-errors-boundaries-and-reset.md`
- **Read this:** [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense) · TanStack Query docs · errors reach the nearest boundary only when no cached data exists; `QueryErrorResetBoundary` and `useQueryErrorResetBoundary` (*read*) · covers our angle: **full** — default throw behaviour and reset · fetched 2026-10-14
- **Also good:** [QueryErrorResetBoundary reference](https://tanstack.com/query/latest/docs/framework/react/reference/QueryErrorResetBoundary) · TanStack Query API reference · the component and its reset function (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [React Query Error Handling](https://tkdodo.eu/blog/react-query-error-handling) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-09-10, updated 2023-10-21 · error boundaries and `throwOnError` as a predicate; pre-v5 naming · fetched 2026-10-14 (*read*)
- **Our delta:** why the default is a predicate, not true.

### T10-01c · Fetch-on-render vs render-as-you-fetch — Topic · ✅ written `docs/tanstack-query/pages/10-suspense-integration/01d-fetch-on-render-and-streaming.md`
- **Read this:** [Prefetching and Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching) · TanStack Query docs · start the request on the route or event before the component mounts (*read*) · covers our angle: **partial** — no suspense timing detail · fetched 2026-10-14
- **Also good:** [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) · TanStack Query docs · streaming a pending query into `useSuspenseQuery` (*read*) · fetched 2026-10-14
- **Also good:** [Suspense](https://react.dev/reference/react/Suspense) · React docs · what a Suspense boundary shows and when it triggers (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [React Query meets React Router](https://tkdodo.eu/blog/react-query-meets-react-router) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2022-08-28, updated 2022-12-11 · the loader as the place that starts the request early · fetched 2026-10-14 (*read*)
- **Our delta:** a suspense page is only fast if something started the request before render.

## Section 11 — Devtools

### T11-01a · Devtools mounting and the status matrix — Topic · ✅ written `docs/tanstack-query/pages/11-devtools/01-react-query-devtools.md`
- **Read this:** [Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools) · TanStack Query docs · install, render inside `QueryClientProvider` near the root, `initialIsOpen` (*read*) · covers our angle: **full** — mounting and placement · fetched 2026-10-14
- **Beyond the docs:** [Status Checks in React Query](https://tkdodo.eu/blog/status-checks-in-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-03-27, updated 2023-10-21 · status and fetchStatus as two axes, which is the panel's matrix · fetched 2026-10-14 (*read*)
- **Our delta:** the nine-cell status and fetchStatus matrix.

### T11-01b · Reading a key, stale vs inactive and eviction — Topic · ✅ written `docs/tanstack-query/pages/11-devtools/01c-reading-a-query-key.md`
- **Read this:** [Caching](https://tanstack.com/query/latest/docs/framework/react/guides/caching) · TanStack Query docs · inactive after the last unmount, deleted after gcTime (*read*) · covers our angle: **partial** — the countdown · fetched 2026-10-14
- **Also good:** [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) · TanStack Query docs · how keys are hashed (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Inside React Query](https://tkdodo.eu/blog/inside-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2022-12-03 · QueryCache keyed by hashed key, a Query with observers, an observer per `useQuery` · fetched 2026-10-14 (*read*)
- **Our delta:** duplicate rows from array item order.

### T11-01c · Panel actions and keeping devtools out of production — Topic · ✅ written `docs/tanstack-query/pages/11-devtools/01e-panel-actions-and-cache-effects.md`
- **Read this:** [Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools) · TanStack Query docs · bundles include the devtools only when `process.env.NODE_ENV` is development (*read*) · covers our angle: **partial** — no panel actions · fetched 2026-10-14
- **Also good:** [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient) · TanStack Query API reference · method signatures for invalidateQueries, refetchQueries, resetQueries, removeQueries, setQueryData and getQueryData (*headings only*) · fetched 2026-10-14
- **Our delta:** refetch, invalidate, reset and remove on the real client; the exact NODE_ENV comparison.

## Section 12 — Query cancellation

### T12-01 · AbortSignal integration — Topic · ✅ written `docs/tanstack-query/pages/12-query-cancellation/01-abortsignal-integration.md`
- **Read this:** [Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) · TanStack Query docs · signal aborts when a query is outdated or inactive; unmount does not cancel unless the signal is consumed; `cancelQueries` options silent and revert; not for suspense hooks (*read*) · covers our angle: **full** — automatic vs not · fetched 2026-10-14
- **Also good:** [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) · MDN · the signal itself and `abort` semantics (*headings only*) · fetched 2026-10-14
- **Our delta:** what stays automatic and what you must wire.

## Section 13 — Global configuration

### T13-01 · QueryClient defaults and per-query overrides — Topic · ✅ written `docs/tanstack-query/pages/13-global-configuration/01-defaultoptions.md`
- **Read this:** [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient) · TanStack Query API reference · the `defaultOptions` constructor argument and `setQueryDefaults` (*headings only*) · covers our angle: **partial** — options list, no override order · fetched 2026-10-14
- **Also good:** [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) · TanStack Query docs · the out-of-the-box values being overridden (*read*) · fetched 2026-10-14
- **Beyond the docs:** [React Query Error Handling](https://tkdodo.eu/blog/react-query-error-handling) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-09-10, updated 2023-10-21 · global `QueryCache` onError runs once per request and cannot be overwritten like `defaultOptions` · fetched 2026-10-14 (*read*)
- **Our delta:** the override order and the defaults that multiply requests.

## Section 14 — Optimistic update patterns

### T14-01a · Rollback contract and concurrent mutations — Topic · ✅ written `docs/tanstack-query/pages/14-optimistic-updates-patterns/01-advanced-rollback-strategies.md`
- **Read this:** [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) · TanStack Query docs · cancel outgoing refetches, snapshot with `getQueryData`, write with `setQueryData`, return the snapshot for rollback (*read*) · covers our angle: **partial** — single-writer only · fetched 2026-10-14
- **Also good:** [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) · TanStack Query docs · onMutate result passed to onError and onSettled (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Concurrent Optimistic Updates in React Query](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2025-04-28 · a fast refetch overwriting the second mutation's update; skip invalidation while `isMutating()`; leaves rollback out on purpose · fetched 2026-10-14 (*read*)
- **Our delta:** rollback inside the error handler and two mutations on one key.

### T14-01b · In-flight state with useMutationState — Topic · ✅ written `docs/tanstack-query/pages/14-optimistic-updates-patterns/01c-in-flight-state-and-ui-variables.md`
- **Read this:** [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) · TanStack Query docs · render `variables` while pending, no cache write; `useMutationState` filtered by mutationKey and status pending (*read*) · covers our angle: **full** — the no-rollback variant · fetched 2026-10-14
- **Also good:** [useMutationState reference](https://tanstack.com/query/latest/docs/framework/react/reference/useMutationState) · TanStack Query API reference · filters and select (*headings only*) · fetched 2026-10-14
- **Our delta:** reading variables from anywhere and keeping them on error.

### T14-01c · Optimistic writes on infinite queries — Topic · ✅ written `docs/tanstack-query/pages/14-optimistic-updates-patterns/01d-optimistic-writes-on-infinite-queries.md`
- **Read this:** [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) · TanStack Query docs · does not cover infinite queries (*read*) · covers our angle: **partial** — flat-array recipe only · fetched 2026-10-14
- **Also good:** [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) · TanStack Query docs · data is an object with pages and pageParams (*read*) · fetched 2026-10-14
- **Our delta:** an updater that preserves the pages and pageParams shape.

## Section 15 — Testing TanStack Query

### T15-01a · Isolated test client and integration setup — Topic · ✅ written `docs/tanstack-query/pages/15-testing-tanstack-query/01-isolated-and-integration-testing.md`
- **Read this:** [Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing) · TanStack Query docs · `retry: false` in defaults, a wrapper giving each test a fresh client, `renderHook`, `waitFor` isSuccess, gcTime Infinity for Jest (*read*) · covers our angle: **full** — isolation · fetched 2026-10-14
- **Beyond the docs:** [Testing React Query](https://tkdodo.eu/blog/testing-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-04-04, updated 2023-10-21 · a client per test and `retry: false`; explicit retry wins, so use `setQueryDefaults` · fetched 2026-10-14 (*read*)
- **Our delta:** asserting on query flags, not timers.

### T15-01b · Mocking at the network layer — Topic · ✅ written `docs/tanstack-query/pages/15-testing-tanstack-query/01b-mocking-at-the-network-layer.md`
- **Read this:** [Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing) · TanStack Query docs · mocks with nock; MSW only as a link (*read*) · covers our angle: **partial** — interception level is not argued · fetched 2026-10-14
- **Also good:** [Mock Service Worker docs](https://mswjs.io/docs/) · MSW · request handlers that intercept at the network layer (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Testing React Query](https://tkdodo.eu/blog/testing-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-04-04, updated 2023-10-21 · MSW as the single source of truth for mocking; with a companion repo · fetched 2026-10-14 (*read*)
- **Our delta:** mocking the queryFn tests the mock; mocking the network tests the cache.

### T15-01c · Testing mutations, suspense and harness hazards — Topic · ✅ written `docs/tanstack-query/pages/15-testing-tanstack-query/01c-testing-mutations.md`
- **Read this:** [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) · TanStack Query docs · per-call callbacks do not run after unmount; hook-level ones do (*read*) · covers our angle: **partial** — the semantics under test · fetched 2026-10-14
- **Read this:** [Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing) · TanStack Query docs · wrapper and `waitFor`; no suspense-specific advice (*read*) · covers our angle: **partial** — wrapper only · fetched 2026-10-14
- **Also good:** [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) · Testing Library · render, queries and async utilities (*headings only*) · fetched 2026-10-14
- **Our delta:** act, the renamed third argument, and a wrapper that is the test for suspense.

## Section 16 — Migration recipes

### T16-01a · RTK Query to TanStack Query: map and endpoints — Topic · ✅ written `docs/tanstack-query/pages/16-migration-recipes/01-rtk-query-to-tanstack-query.md`
- **Read this:** [RTK Query Overview](https://redux.js.org/toolkit/rtk-query/overview) · Redux Toolkit docs · endpoints declared in `createApi`, hooks generated from them, cache entry lifecycle; no comparison table (*read*) · covers our angle: **partial** — the source side only · fetched 2026-10-14
- **Also good:** [Cache Behavior](https://redux.js.org/toolkit/rtk-query/usage/cache-behavior) · Redux Toolkit docs · `keepUnusedDataFor` default 60 seconds, `refetchOnMountOrArgChange`, `refetchOnFocus` needing `setupListeners` (*read*) · fetched 2026-10-14
- **Also good:** [Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) · TanStack Query docs · the target-side unit: a key plus a function in one factory (*read*) · fetched 2026-10-14
- **Also good:** [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) · TanStack Query docs · prefix matching, which is what makes tag-to-key over-invalidate (*read*) · fetched 2026-10-14
- **Our delta:** the four defaults that multiply request volume.

### T16-01b · RTK mutations, rollback and running both caches — Topic · ✅ written `docs/tanstack-query/pages/16-migration-recipes/01d-rtk-query-mutations-and-rollback.md`
- **Read this:** [Manual Cache Updates](https://redux.js.org/toolkit/rtk-query/usage/manual-cache-updates) · Redux Toolkit docs · `updateQueryData` plus `.undo` in `onQueryStarted`; warns that overlapping mutations make undo race and suggests invalidating tags (*read*) · covers our angle: **full** — the RTK half of the rollback contrast · fetched 2026-10-14
- **Also good:** [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) · TanStack Query docs · the snapshot-and-restore side (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Concurrent Optimistic Updates in React Query](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2025-04-28 · what goes wrong when writes overlap · fetched 2026-10-14 (*read*)
- **Our delta:** migration order as a partition of resources living in both caches.

### T16-01c · v4 to v5: mechanical vs semantic and the isLoading rotation — Topic · ✅ written `docs/tanstack-query/pages/16-migration-recipes/01f-v4-to-v5-mechanical-versus-semantic.md`
- **Read this:** [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) · TanStack Query docs · single-object signature, `isLoading` renamed `isPending` and new `isLoading` is isPending and isFetching, `isInitialLoading` deprecated, codemod is best-effort (*read*) · covers our angle: **full** — the change list and the rotation · fetched 2026-10-14
- **Also good:** [Migrating to v4](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-react-query-4) · TanStack Query docs · earlier step for older codebases (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Status Checks in React Query](https://tkdodo.eu/blog/status-checks-in-react-query) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2021-03-27, updated 2023-10-21 · the pending state was called loading before v5 · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Breaking React Query's API on Purpose](https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2023-04-16 · why query `onSuccess`, `onError` and `onSettled` went; says nothing of the isLoading rotation · fetched 2026-10-14 (*read*)
- **Our delta:** three classes, and auditing wrapper hooks that re-export flags.

### T16-01d · prefetchQuery to queryClient.query — Topic · ✅ written `docs/tanstack-query/pages/16-migration-recipes/01n-prefetchquery-to-queryclient-query.md`
- **Read this:** [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) · TanStack Query docs · `prefetchQuery` and `prefetchInfiniteQuery` deprecated for `queryClient.query` and `infiniteQuery`; add `.catch(noop)` to keep prefetch behaviour (*read*) · covers our angle: **partial** — states the rename, not the unhandled-rejection trap · fetched 2026-10-14
- **Also good:** [Prefetching and Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching) · TanStack Query docs · staleTime on a prefetch call; matches our v5.102.8 target (*read*) · fetched 2026-10-14
- **Also good:** [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient) · TanStack Query API reference · method signatures for invalidateQueries, refetchQueries, resetQueries, removeQueries, setQueryData and getQueryData (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [React Query meets React Router](https://tkdodo.eu/blog/react-query-meets-react-router) · TkDodo (Dominik Dorfmeister), tkdodo.eu, 2022-08-28, updated 2022-12-11 · fetchQuery returns data and surfaces errors, prefetchQuery swallows them; v4 names · fetched 2026-10-14 (*read*)
- **Our delta:** four call-site shapes behind one method name, and the prefetch that still shows a spinner.

