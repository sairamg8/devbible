---
name: link-map-redux-toolkit-02
description: Link map, Redux Toolkit topics T07–T10 (RTK Query — createApi and endpoints, queryFn/transforms/infinite queries, cache and invalidation, optimistic and manual updates) — the best explanation per topic, fetched and read 2026-10-05
metadata:
  type: reference
---

# Link map · Redux Toolkit · T07–T10 (section 04 — RTK Query)

All 4 topics are ✅ written. Topic numbers follow `docs/redux-toolkit/pages/README.md`. Canonical `redux.js.org` addresses.
Legend and rules: [01-store-slices-thunks.md](01-store-slices-thunks.md) · [../../CURSOR-LINK-MAP.md](../../CURSOR-LINK-MAP.md).

---

### T07 · RTK Query — `createApi` and the endpoint types — Master · ✅ `docs/redux-toolkit/pages/04-rtk-query/01-api-slice-and-endpoints.md`
- **Read this:** [Redux Essentials, Part 7 — RTK Query basics](https://redux.js.org/tutorials/essentials/part-7-rtk-query-basics) · redux.js.org · the narrative route in (≈7.8k words): the motivation, "thinking in RTK Query caching", defining an API slice and wiring it into the store, query hooks and their result objects, query arguments as cache keys, mutation endpoints, refreshing cached data with tags · covers our angle: **partial** — queries and mutations only; the third endpoint type, the infinite query, is on the page linked at T08 · fetched 2026-10-05
- **Also good:** [createApi](https://redux.js.org/toolkit/rtk-query/api/createApi) · redux.js.org · the reference for every `createApi` option (`baseQuery`, `endpoints`, `tagTypes`, `keepUnusedDataFor`, the refetch options, rehydration) and every endpoint option, all three endpoint types included (`query`, `mutation`, `infiniteQuery`) · fetched 2026-10-05
- *Checked, not chosen:* DEV "RTK Query Tutorial (CRUD)" (≈4k words) — a CRUD tutorial, but no `queryFn`, `transformResponse` or infinite queries anywhere in the text.

### T08 · `queryFn`, response transforms and infinite queries — Understand · ✅ `docs/redux-toolkit/pages/04-rtk-query/01b-queryfn-transforms-and-infinite-queries.md`
- **Read this (1/2):** [Customizing Queries](https://redux.js.org/toolkit/rtk-query/usage/customizing-queries) · redux.js.org · `baseQuery`, `transformResponse`, `transformErrorResponse` and `queryFn`, with worked examples: an Axios base query, a GraphQL base query, automatic re-authorization, retries, a third-party SDK, a no-op `queryFn` · covers our angle: full · fetched 2026-10-05
- **Read this (2/2):** [Infinite Queries](https://redux.js.org/toolkit/rtk-query/usage/infinite-queries) · redux.js.org · page params vs query args, defining the endpoint (`initialPageParam`, `getNextPageParam`, `getPreviousPageParam`, `maxPages`), the hooks, overlapping page fetches, refetching, bidirectional cursors · covers our angle: full · fetched 2026-10-05
- **Also good:** [Redux Essentials, Part 8 → manipulating response data](https://redux.js.org/tutorials/essentials/part-8-rtk-query-advanced#manipulating-response-data) · redux.js.org · transforming responses inside a running app, normalized vs document caches, `selectFromResult`, and a comparison of the transformation approaches · fetched 2026-10-05
- *Checked, not chosen:* nothing third-party on infinite queries — search returned only the official page, GitHub design threads and TanStack's own (different library) guide.

### T09 · RTK Query cache lifetimes and tag invalidation — Understand · ✅ `docs/redux-toolkit/pages/04-rtk-query/02-cache-management-and-invalidation.md`
- **Read this (1/2):** [Cache Behavior](https://redux.js.org/toolkit/rtk-query/usage/cache-behavior) · redux.js.org · the default behavior (subscription reference counting), `keepUnusedDataFor`, `refetchOnMountOrArgChange`, refetch on focus and reconnect, invalidating by tag, and the stated tradeoffs (no normalized or de-duplicated cache) · covers our angle: full · fetched 2026-10-05
- **Read this (2/2):** [Automated Re-fetching](https://redux.js.org/toolkit/rtk-query/usage/automated-refetching) · redux.js.org · tags, `providesTags`, `invalidatesTags`, general vs specific tag behavior, and recipes (abstract tag IDs, providing errors to the cache, abstracting common provides/invalidates code) · covers our angle: full · fetched 2026-10-05
- **Also good:** [Redux Essentials, Part 8 → editing posts](https://redux.js.org/tutorials/essentials/part-8-rtk-query-advanced#editing-posts) · redux.js.org · the same ideas as a story: cache subscription lifetimes, then invalidating one specific item rather than the whole list · fetched 2026-10-05
- *Checked, not chosen:* three short introductions (Raihaan Development 2025, 200OK Solutions 2024/edited 2026, DEV CRUD tutorial; ≈1–4k words, 2–4 mentions of the tag options) — fine first passes, a fraction of the official pair. One Medium post on `providesTags` returned HTTP 403 (not fetchable — unverified, so not listed).

### T10 · Optimistic and manual cache updates — Understand · ✅ `docs/redux-toolkit/pages/04-rtk-query/02b-optimistic-and-manual-cache-updates.md`
- **Read this:** [Manual Cache Updates](https://redux.js.org/toolkit/rtk-query/usage/manual-cache-updates) · redux.js.org · `updateQueryData` and `upsertQueryData`, then the optimistic, pessimistic and general-update recipes built on `onQueryStarted`, including undoing a patch when the request fails · covers our angle: full · fetched 2026-10-05
- **Also good:** [Redux Essentials, Part 8 → optimistic updates for reactions](https://redux.js.org/tutorials/essentials/part-8-rtk-query-advanced#optimistic-updates-for-reactions) · redux.js.org · the same pattern inside a running app, followed by streaming updates with `onCacheEntryAdded` · fetched 2026-10-05
- *Checked, not chosen:* OpenReplay "Mutations and Caching with Redux-Toolkit-Query" (≈2.4k words; `onQueryStarted` and `updateQueryData`, no `upsertQueryData`); DEV "Optimistic Updates with RTK Query" (≈640 words); "Optimistic and pessimistic manual cache update" (2023, ≈490 words) — shorter, and none mentions `upsertQueryData`; the official page covers the optimistic, pessimistic and general recipes in one place. One Medium post on transforms and optimistic updates returned HTTP 403 (not fetchable — unverified, so not listed).
