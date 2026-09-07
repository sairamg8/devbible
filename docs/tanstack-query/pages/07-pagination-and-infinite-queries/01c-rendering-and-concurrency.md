---
title: "Infinite lists at runtime: one in-flight fetch, the two fetching flags, and the shape of `data`"
sidebar_label: "01c · Rendering & concurrency"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries), [`useInfiniteQuery` reference](https://tanstack.com/query/latest/docs/framework/react/reference/useInfiniteQuery), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 Infinite lists at runtime: one fetch, two flags, and a `data` that is not an array

**[`01b`](./01b-infinite-queries.md) covers the options you pass in. This page covers what happens once the list is on screen** — and that is where infinite queries actually break. Three facts do most of the damage: an infinite query is **one** cache entry that permits **one** in-flight fetch, `isFetching` is not `isFetchingNextPage`, and `data` is an object rather than the array every render body wants it to be.

## 1. Under-The-Hood Mechanics

### `hasNextPage` and `isFetchingNextPage` vs `isFetching`
`hasNextPage` is derived, not stored — it is whatever `getNextPageParam` last returned, tested against `null` and `undefined`. The two fetching flags exist for a reason the guide states plainly:

> *"The `isFetchingNextPage` and `isFetchingPreviousPage` booleans are now available to distinguish between a background refresh state and a loading more state"*

The guide's own component renders the background indicator as `isFetching && !isFetchingNextPage`, which is only meaningful because **`isFetching` is also true while the next page is loading**. `isFetchingNextPage` is the narrower flag; `isFetching` is the union of "loading more" and "refetching what we already have".

### 🔴 One entry, one fetch at a time
This is the rule that produces the worst bugs, and it is three sentences in the guide:

> *"It's essential to understand that calling `fetchNextPage` while an ongoing fetch is in progress runs the risk of overwriting data refreshes happening in the background. This situation becomes particularly critical when rendering a list and triggering `fetchNextPage` simultaneously."*

> *"Remember, there can only be a single ongoing fetch for an InfiniteQuery. A single cache entry is shared for all pages, attempting to fetch twice simultaneously might lead to data overwrites."*

> *"If you intend to enable simultaneous fetching, you can utilize the `{ cancelRefetch: false }` option (default: true) within `fetchNextPage`."*

The default `cancelRefetch: true` means a second `fetchNextPage` **cancels** the first. That is the right default for a button and the wrong shape for a scroll handler that fires on every frame, which is why the guide's recommendation is a guard rather than an option:

> *"To ensure a seamless querying process without conflicts, it's highly recommended to verify that the query is not in an `isFetching` state, especially if the user won't directly control that call."*

The reference repeats it for imperative callers: *"Keep in mind that imperative fetch calls, such as `fetchNextPage`, may interfere with the default refetch behavior, resulting in outdated data. Make sure to call these functions only in response to user actions, or add conditions like `hasNextPage && !isFetching`."*

---

---

## 2. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 2: Guarding the Sentinel on `isFetchingNextPage` Instead of `isFetching`
```tsx
// ❌ WRONG: a background refetch (window focus, reconnect, invalidation) is NOT
// isFetchingNextPage, so the sentinel fires into an already-running fetch and the
// two collide on the single cache entry
if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();

// ✅ CORRECT: the reference's own wording — `hasNextPage && !isFetching`
if (entries[0].isIntersecting && hasNextPage && !isFetching) fetchNextPage();
```

### ⚠️ Pitfall 3: Flattening in the Render Body
```tsx
// ❌ A NEW ARRAY EVERY RENDER: React.memo on the list child never hits, and any
// effect depending on this value re-runs on every parent render
const projects = data?.pages.flatMap((page) => page.data) ?? [];

// ✅ Memoise on `data`, which only changes when the query's data actually changes —
// structural sharing means an unchanged refetch keeps the same reference
const projects = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
```

### ⚠️ Pitfall 4: Reading `data` as if It Were a Flat Array
```tsx
// ❌ TypeError: data.map is not a function — data is `{ pages, pageParams }`
{data?.map((project) => <ProjectRow key={project.id} project={project} />)}

// ✅ pages first, then the field your API nests rows under
{data?.pages.flatMap((page) => page.data).map((p) => <ProjectRow key={p.id} project={p} />)}
```

---

## Gotchas

**★ 🔴 There is one in-flight fetch per infinite query, and the second one wins by cancelling the first.** *"Remember, there can only be a single ongoing fetch for an InfiniteQuery. A single cache entry is shared for all pages, attempting to fetch twice simultaneously might lead to data overwrites."* `fetchNextPage` defaults to `cancelRefetch: true`, so an unguarded scroll sentinel firing during a background refetch cancels that refetch. The symptom is intermittent duplicate or missing rows on fast scroll, which reads in a bug report as a backend problem.

**★ `isFetching` is true while the next page loads, so guarding on `isFetchingNextPage` guards nothing useful.** The guide's own example renders the background indicator as `isFetching && !isFetchingNextPage`, a construction that only makes sense if `isFetching` covers both. A sentinel guarded on `!isFetchingNextPage` therefore still fires during a window-focus refetch, an invalidation-triggered refetch, or a reconnect — exactly the cases where the collision costs you data. The reference spells the correct guard out: *"add conditions like `hasNextPage && !isFetching`."*

**★ `data` is not an array and never was.** It is `{ pages, pageParams }`. `data.map(...)` throws, and the TypeScript error for it names `InfiniteData`, which is the fastest way to recognise what happened. Rows come from `data.pages.flatMap(page => page.<yourField>)`, and what `yourField` is depends entirely on your API's envelope — the guide's example nests them under `data`, so its render reads `group.data.map(...)`.

**★ Flattening in the render body defeats every memoisation below it.** `data.pages.flatMap(...)` builds a new array on every render, so a `React.memo` list child re-renders on any parent state change, and an effect with that array in its dependency list re-runs forever. Wrap it in `useMemo` keyed on `data`. This works because query results *"are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"*, so a refetch that returns identical pages does not invalidate the memo.

**★ An error while loading page four does not throw away pages one to three.** `status` describes the query, and the query already has data, so it stays `'success'` — the failure surfaces through `error` and the fetch flags rather than by blanking the list. Practically this means a "Load more" affordance needs its own retry path; rendering `status === 'error'` as a full-page error panel, as the initial-load branch does, will never fire once a first page has landed.

**★ `cancelRefetch: true` is the default, and it is the right default for a button and the wrong one for a sentinel.** The option exists — *"If you intend to enable simultaneous fetching, you can utilize the `{ cancelRefetch: false }` option (default: true) within `fetchNextPage`"* — and reaching for it looks like the fix when a scroll handler collides with a refetch. It is not: setting it to `false` permits the simultaneous fetch the guide warns *"might lead to data overwrites"*. The documented answer is the guard, `hasNextPage && !isFetching`, because the goal is to not start the second fetch at all rather than to let both run.

**★ The correct guard differs depending on who triggers the fetch.** The reference draws the line at user intent: *"Make sure to call these functions only in response to user actions, or add conditions like `hasNextPage && !isFetching`."* A "Load more" button the user clicks is already rate-limited by a human, so `hasNextPage` alone is usually enough and disabling it on `isFetchingNextPage` is a UI nicety. An `IntersectionObserver` fires on layout, repeatedly, with no human pacing — that is the case the guide singles out as needing the full condition, *"especially if the user won't directly control that call"*.

## Interview questions

**★ A scroll-triggered infinite list occasionally duplicates or drops a page. Where do you look first?**
At the guard on the fetch trigger. An infinite query has one cache entry and permits one in-flight fetch — *"attempting to fetch twice simultaneously might lead to data overwrites"* — and `fetchNextPage` defaults to `cancelRefetch: true`, so a sentinel that fires during a background refetch cancels it. The fix is the documented condition, `hasNextPage && !isFetching`, not `!isFetchingNextPage`: the collision you are trying to avoid is with the *background* fetch, which `isFetchingNextPage` does not report. The docs recommend the guard specifically *"if the user won't directly control that call"*, which is exactly the IntersectionObserver case.

**★ What is the difference between `isFetching` and `isFetchingNextPage`, and when does the difference matter?**
`isFetchingNextPage` is true only while a next-page request is running; `isFetching` is true for that *and* for every background refetch of the pages you already have. The flags exist *"to distinguish between a background refresh state and a loading more state"*, and the guide's own component uses both at once — a "Loading more…" indicator on `isFetchingNextPage`, a "Refreshing" indicator on `isFetching && !isFetchingNextPage`. The difference matters twice: in the UI, where the two states deserve different affordances, and in the fetch guard, where only `isFetching` is safe.

**★ Page four of an infinite list fails to load. What does the user see, and what does `status` say?**
`status` stays `'success'` — the query has data, and the first three pages are still on screen. The failure appears through `error` and through the fetch flags, not by clearing the list, which is the behaviour you want: an infinite feed that blanked itself because the fifth page timed out would be unusable. The consequence for your code is that the top-level `status === 'error'` branch only ever handles the *initial* load. A "load more" control needs its own error affordance and its own retry, usually a `refetch` or another `fetchNextPage` behind a button.

**★ Would `cancelRefetch: false` fix a colliding scroll sentinel?**
No — it removes the cancellation, not the collision, and the collision is the actual hazard. The default `cancelRefetch: true` at least resolves a double-trigger deterministically by cancelling the earlier fetch; setting it to `false` lets both run against the single shared cache entry, which is precisely what the guide describes as risking data overwrites. The option is there for cases where you genuinely want concurrent fetches and have reasoned about the write ordering. For a sentinel, the fix is upstream: do not fire while `isFetching`.

**★ Why does `useMemo` over `data.pages` actually work, given that a refetch replaces the pages?**
Because a refetch does not necessarily replace them. Query results *"are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"*, so a background refetch that returns identical pages leaves `data` referentially identical and the memo holds. That is what makes `[data]` a correct dependency rather than a fragile one — it changes when the content changes and not merely when a request completes, which is the property you want and the one a hand-rolled flatten in the render body throws away.

---

← [`useInfiniteQuery`](./01b-infinite-queries.md) · [Topic index](../README.md) · Next → [Infinite cache & refetch](./01d-infinite-cache-refetch-and-manual-updates.md)
