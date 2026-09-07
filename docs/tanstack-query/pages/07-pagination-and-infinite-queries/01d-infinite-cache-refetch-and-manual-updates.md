---
title: "One cache entry, every page: what a refetch of an infinite query actually costs, and how to bound it with `maxPages`"
sidebar_label: "01d · Infinite cache & refetch"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Paginated / Lagged Queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 One cache entry, every page: refetching, bounding and hand-editing an infinite query

**An infinite query is one cache entry, so every rule you know about a single query applies to the entire accumulated list at once — including the one that surprises people: when it goes stale, *every page you have ever loaded is refetched, sequentially, starting from the first.*** A user who scrolled forty pages and then switched browser tabs comes back to forty sequential requests. That is not a bug, it is the only way to avoid stale cursors, and `maxPages` is the option that exists to bound its cost.

## 1. Under-The-Hood Mechanics

### What a refetch of an infinite query does
The guide gives this its own heading, and the answer is unambiguous:

> *"When an infinite query becomes `stale` and needs to be refetched, each group is fetched `sequentially`, starting from the first one. This ensures that even if the underlying data is mutated, we're not using stale cursors and potentially getting duplicates or skipping records. If an infinite query's results are ever removed from the queryCache, the pagination restarts at the initial state with only the initial group being requested."*

Three separate facts are packed in there:

1. **All pages, not the last one.** A refetch is the whole accumulated list.
2. **Sequentially, from the first.** Not in parallel — page *n*'s request cannot be built until page *n−1*'s response supplies its cursor, which is the same derivation `getNextPageParam` does during scrolling.
3. **Removal is not the same as staleness.** A stale query refetches everything it had; a *removed* query starts over with one page. Removal is what `gcTime` does after five minutes with no observer, and what `queryClient.removeQueries` does immediately.

And every one of the ordinary refetch triggers applies, because this is an ordinary query with an unusual shape:

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

So a tab switch on a forty-page feed is forty sequential requests. That is the cost the next section is about.

### `maxPages` — the option that replaced `refetchPage`
v4 let you name which pages to refetch. v5 removed that and bounded the list instead:

> *"In v4, we introduced the possibility to define the pages to refetch for infinite queries with the `refetchPage` function. However, refetching all pages might lead to UI inconsistencies. Also, this option is available on e.g. `queryClient.refetchQueries`, but it only does something for infinite queries, not "normal" queries."*

> *"Version 5 has a new `maxPages` option for infinite queries, which allows developers to limit the number of pages that are stored in the query data and subsequently refetched."*

The guide states the two problems it solves and the hard prerequisite:

> *"when the user can load a large number of pages (memory usage) · when you have to refetch an infinite query that contains dozens of pages (network usage: all the pages are sequentially fetched)"*

> *"Note that the infinite list must be bi-directional, which requires both `getNextPageParam` and `getPreviousPageParam` to be defined."*

The bi-directional requirement is not arbitrary: once `maxPages` starts dropping pages off the front as you scroll down, the only way to get them back when you scroll up is `getPreviousPageParam`. Set `maxPages` without it and the list becomes one-way.

> *"In the following example only 3 pages are kept in the query data pages array. If a refetch is needed, only 3 pages will be refetched sequentially."*

### Hand-editing the cache: `{ pages, pageParams }` must survive intact
Everything in [`04 · Caching & Invalidation`](../04-caching-and-invalidation/01-cache-management-apis.md) applies, with one extra constraint the guide states in an exclamation mark: *"Make sure to always keep the same data structure of pages and pageParams!"* Both arrays are part of the contract — `pageParams` is what a later refetch replays, so an edit that drops a page from `pages` without dropping its param leaves the two arrays out of step.

🔴 **The guide's own snippets dereference `data` unguarded.** This is the docs' example for removing the first page, verbatim:

> ```tsx
> queryClient.setQueryData(['projects'], (data) => ({
>   pages: data.pages.slice(1),
>   pageParams: data.pageParams.slice(1),
> }))
> ```

Against the `QueryClient` reference for the same method — *"If the query does not exist, it will be created"* — that updater is handed `undefined` whenever the entry is absent, and `undefined.pages` throws. Illustrative code in a guide can assume the query exists; a mutation callback in your app cannot.

### `select`, and what it is documented to do
The one documented use is reversing display order without touching the cache:

> *"Sometimes you may want to show the pages in reversed order. If this is case, you can use the `select` option"* — with `select: (data) => ({ pages: [...data.pages].reverse(), pageParams: [...data.pageParams].reverse() })`.

Note both arrays are reversed together, and both are copied before reversing — `Array.prototype.reverse` mutates, and mutating the cached arrays in a `select` would corrupt the entry it is reading from. ⚠️ **The documentation does not state whether `select` may return a shape other than `{ pages, pageParams }`** on an infinite query; the shape-preserving form is the only one shown, and it is the only one this page will claim.

The related constraint *is* stated, for the seeding options:

> *"Note: Options `initialData` or `placeholderData` need to conform to the same structure of an object with `data.pages` and `data.pageParams` properties."*

### Prefetching more than the first page
`prefetchInfiniteQuery` does not appear in the current `QueryClient` reference; `queryClient.infiniteQuery` does, described as *"functions similarly to `query` but handles infinite query fetching and caching"*, and it takes a `pages` option:

> *"Infinite queries can be prefetched similarly to regular queries. By default, only the first page gets prefetched. To prefetch multiple pages, use the `pages` option along with a `getNextPageParam` function"*

---

## 2. Real-World Engineering Scenario

**Scenario**: A Feed That Hammered the API Every Time the User Came Back to the Tab.
A logs viewer let operators scroll to hundreds of pages during an incident. Each time they alt-tabbed to a dashboard and back, window-focus refetching marked the query stale and the library refetched **every accumulated page in sequence** — the correct behaviour, since replaying old cursors against a live log stream is how you get duplicates, but ruinous at that page count. Two changes fixed it without changing the UX: `maxPages: 5` with `getPreviousPageParam` defined, so only five pages are ever stored and refetched, and a non-zero `staleTime` so a tab switch inside the freshness window does not trigger a refetch at all. The scroll-up path kept working because the previous-direction param was now defined.

---

## 3. Production-Grade Code Example

```typescript
// Bounded infinite query: at most 3 pages stored, so at most 3 sequential refetches.
// maxPages REQUIRES both directions — without getPreviousPageParam, scrolling back up
// after a page has been dropped off the front has no way to refetch it.
function useLogPages(streamId: string) {
  return useInfiniteQuery({
    queryKey: ['logs', streamId],
    queryFn: ({ pageParam }) => fetchLogPage(streamId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.prevCursor,
    maxPages: 3,
    staleTime: 30_000, // a tab switch inside 30s does not trigger the sequential refetch
  });
}
```

```typescript
// Manual cache surgery: guarded, and keeping BOTH arrays in step.
// `old` is InfiniteData | undefined — setQueryData creates the entry if it is missing.
// cursors are numbers here, matching `initialPageParam: 0` above — the page-param type
// is one type across initialPageParam, getNextPageParam and InfiniteData's second slot
type LogPage = { entries: LogEntry[]; nextCursor?: number; prevCursor?: number };
type LogData = InfiniteData<LogPage, number>;

function useDeleteLogEntry(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api.delete(`/logs/${entryId}`),
    onMutate: async (entryId) => {
      await queryClient.cancelQueries({ queryKey: ['logs', streamId] });
      const previous = queryClient.getQueryData<LogData>(['logs', streamId]);

      queryClient.setQueryData<LogData>(['logs', streamId], (old) => {
        if (!old) return old;               // nothing cached — do not create a malformed entry
        return {
          pages: old.pages.map((page) => ({
            ...page,
            entries: page.entries.filter((e) => e.id !== entryId),
          })),
          pageParams: old.pageParams,       // untouched: the pages themselves still exist
        };
      });

      return { previous };
    },
    onError: (err, entryId, onMutateResult) => {
      if (!onMutateResult) return;
      queryClient.setQueryData(['logs', streamId], onMutateResult.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['logs', streamId] }),
  });
}
```

```typescript
// Dropping the first page entirely: BOTH arrays are sliced, or a later refetch
// replays the wrong param for the wrong page.
queryClient.setQueryData<LogData>(['logs', streamId], (old) =>
  old
    ? { pages: old.pages.slice(1), pageParams: old.pageParams.slice(1) }
    : old,
);
```

```typescript
// select: reverse for display only. Copy before reversing — reverse() mutates in place,
// and these arrays belong to the cache entry.
useInfiniteQuery({
  queryKey: ['logs', streamId],
  queryFn: ({ pageParam }) => fetchLogPage(streamId, pageParam),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  select: (data) => ({
    pages: [...data.pages].reverse(),
    pageParams: [...data.pageParams].reverse(),
  }),
});
```

```typescript
// Prefetching: queryClient.infiniteQuery, NOT the removed prefetchInfiniteQuery.
// Default is ONE page; `pages: 3` warms three, sequentially, via getNextPageParam.
import { noop } from '@tanstack/react-query';

async function warmLogs(queryClient: QueryClient, streamId: string) {
  await queryClient
    .infiniteQuery({
      queryKey: ['logs', streamId],
      queryFn: ({ pageParam }) => fetchLogPage(streamId, pageParam),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      pages: 3,
    })
    .catch(noop); // infiniteQuery REJECTS on error, like query does
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: `maxPages` Without a Previous-Page Param
```typescript
// ❌ ONE-WAY LIST: pages drop off the front as the user scrolls down, and there is
// no derivation that can fetch them back when the user scrolls up
useInfiniteQuery({
  queryKey: ['logs'], queryFn, initialPageParam: 0,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  maxPages: 3, // requires bi-directional, per the migration guide
});

// ✅ CORRECT: define the previous direction too
useInfiniteQuery({
  queryKey: ['logs'], queryFn, initialPageParam: 0,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  getPreviousPageParam: (firstPage) => firstPage.prevCursor,
  maxPages: 3,
});
```

### ⚠️ Pitfall 2: Editing `pages` and Leaving `pageParams` Behind
```typescript
// ❌ OUT OF STEP: three pages, four params. A later refetch replays a param sequence
// that no longer corresponds to the stored pages.
queryClient.setQueryData<LogData>(key, (old) => (old ? { ...old, pages: old.pages.slice(1) } : old));

// ✅ CORRECT: slice both, together
queryClient.setQueryData<LogData>(key, (old) =>
  old ? { pages: old.pages.slice(1), pageParams: old.pageParams.slice(1) } : old,
);
```

### ⚠️ Pitfall 3: Reversing the Cached Arrays in Place
```typescript
// ❌ MUTATES THE CACHE: reverse() is in-place, so this reorders the entry that select
// is reading from — every observer of the query now sees reordered pages
select: (data) => ({ pages: data.pages.reverse(), pageParams: data.pageParams.reverse() }),

// ✅ CORRECT: copy first, exactly as the guide's example does
select: (data) => ({ pages: [...data.pages].reverse(), pageParams: [...data.pageParams].reverse() }),
```

---

## Gotchas

**★ 🔴 A refetch refetches every page you have loaded, one after another.** *"When an infinite query becomes `stale` and needs to be refetched, each group is fetched `sequentially`, starting from the first one."* Not the last page, not the visible page — all of them, in order, because page *n*'s cursor comes from page *n−1*'s response. The stated reason is correctness: *"This ensures that even if the underlying data is mutated, we're not using stale cursors and potentially getting duplicates or skipping records."* The cost is linear in how far the user scrolled, and it is paid on every ordinary refetch trigger.

**★ The refetch triggers you forgot about all apply to the whole list.** *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale"*, and *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected."* So a tab switch, a route that remounts the feed, or a dropped wifi connection each cost one sequential replay of the entire accumulated list. `staleTime` is the cheapest mitigation and `maxPages` is the structural one.

**★ Being garbage-collected is worse than going stale — it resets the scroll.** *"If an infinite query's results are ever removed from the queryCache, the pagination restarts at the initial state with only the initial group being requested."* Removal happens after `gcTime` with no observer, which *"defaults to 5 minutes"*. A user who opens a full-screen detail view that unmounts the feed, reads for six minutes and hits Back does not get a slow refetch — they get page one, and their position in a forty-page list is gone.

**★ `maxPages` requires a bi-directional list, and the docs say so explicitly.** *"Note that the infinite list must be bi-directional, which requires both `getNextPageParam` and `getPreviousPageParam` to be defined."* Once the option starts trimming the front of `pages` as the user scrolls down, the only mechanism that can restore those pages on the way back up is the previous-direction derivation. Setting `maxPages` on a next-only list gives you a list that can be scrolled down and never back.

**★ ⚠ Deprecated: `refetchPage` is gone, and `maxPages` is its successor.** v4's `refetchPage` let you choose which pages to refresh; v5 removed it because *"refetching all pages might lead to UI inconsistencies"* and because the option existed on `queryClient.refetchQueries` where *"it only does something for infinite queries, not 'normal' queries."* If you are porting code that reaches for `refetchPage` to cut refetch cost, the replacement is to store fewer pages, not to refresh fewer of the ones you stored.

**★ 🔴 The `setQueryData` updater is handed `InfiniteData | undefined`, and the guide's own examples ignore that.** The reference is explicit — *"If the query does not exist, it will be created"* — so `(data) => ({ pages: data.pages.slice(1), … })`, which is verbatim from the infinite-queries guide, throws whenever the entry is absent. In a guide that is fine; inside `onMutate` it is a production crash on the first mutation after a cold start, a deep link that never rendered the feed, or a garbage collection that happened while a dialog was open. Return `old` unchanged when it is falsy.

**★ Editing `pages` without editing `pageParams` corrupts the replay.** *"Make sure to always keep the same data structure of pages and pageParams!"* The two arrays are positionally paired: `pageParams[i]` is the param that produced `pages[i]`, and a refetch replays that sequence. Drop a page from one array only and the next refetch requests the wrong cursor for the wrong slot. Removing rows *within* a page is the exception — the pages themselves still exist, so `pageParams` is untouched.

**★ `reverse()` in a `select` mutates the cache entry.** `Array.prototype.reverse` reorders in place. The guide's example spreads first — `[...data.pages].reverse()` — and that spread is the entire safety of the pattern. Written without it, the `select` reorders the arrays it was given, which are the cached arrays, so every other observer of that query sees the reordering too and a second `select` call reverses it back.

**★ `placeholderData` works on an infinite query too — and must be the full two-array shape.** It is the answer to "the feed blanks out when the user changes the filter", because a filter change is a key change and a key change is a new, empty query: *"While not as common, the `placeholderData` option also works flawlessly with the `useInfiniteQuery` hook, so you can seamlessly allow your users to continue to see cached data while infinite query keys change over time."* The constraint is the shape — *"Note: Options `initialData` or `placeholderData` need to conform to the same structure of an object with `data.pages` and `data.pageParams` properties."* The identity form, `placeholderData: keepPreviousData`, satisfies that for free because the previous value already has the shape; anything hand-built has to supply **both** arrays, and handing either option a flat array of rows — the shape you would use for a plain `useQuery` — produces an entry that renders wrongly and refetches wrongly because `pageParams` is missing entirely.

**★ ⚠ Deprecated: `prefetchInfiniteQuery` — and the replacement rejects.** Neither `prefetchInfiniteQuery` nor `fetchInfiniteQuery` appears in the current `QueryClient` reference; `queryClient.infiniteQuery` does, and it *"functions similarly to `query`"*, which *"will either resolve with the data or throw with an error."* The prefetching guide's own example imports `noop` from the package purely to attach a `.catch`. An unhandled prefetch failure is a rejected promise in a route loader or an effect, not a silently skipped warm-up.

**★ Prefetching warms exactly one page unless you ask for more.** *"By default, only the first page gets prefetched. To prefetch multiple pages, use the `pages` option along with a `getNextPageParam` function."* And `pages: 3` is itself three sequential requests, because each page's param is derived from the previous response — prefetching does not parallelise what scrolling could not.

**★ Invalidating an infinite query invalidates the whole list, which is the same sequential replay.** `invalidateQueries({ queryKey: ['logs'] })` marks the single entry stale, and *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"* — for an infinite query, that background refetch is every stored page in order. After a mutation on a deep list this is often the single most expensive thing your app does, and it is another argument for `maxPages`.

## Interview questions

**★ A user has scrolled an infinite feed to forty pages, switches browser tabs, and comes back. What does the library do?**
It refetches all forty pages, sequentially, starting from the first — assuming the query is stale, which by default it is, and assuming window-focus refetching is on, which by default it is. *"Each group is fetched sequentially, starting from the first one."* The pages cannot go in parallel because page *n*'s request needs page *n−1*'s cursor, so the wall-clock cost is roughly forty round trips. The two levers are `staleTime`, which stops the refetch happening at all inside the freshness window, and `maxPages`, which caps how many pages exist to refetch. This is the single best reason to think about `maxPages` before a feed ships rather than after.

**★ Why does it refetch from the first page rather than just the ones on screen?**
Because cursors are only valid relative to the response that produced them. If rows were inserted or deleted since you fetched page 12, replaying page 12's stored cursor against the new data can hand you records you already have or skip records you never saw — the guide names both failure modes: *"we're not using stale cursors and potentially getting duplicates or skipping records."* Rebuilding the chain from the first page is the only way to guarantee the accumulated list is internally consistent. v4 offered `refetchPage` to refresh a subset and v5 removed it precisely because *"refetching all pages might lead to UI inconsistencies."*

**★ What does `maxPages` actually do, and what does it require?**
It caps how many pages are kept in `data.pages`, and therefore how many are refetched: *"only 3 pages are kept in the query data pages array. If a refetch is needed, only 3 pages will be refetched sequentially."* It requires a bi-directional list — both `getNextPageParam` and `getPreviousPageParam` — because pages dropped off one end have to be re-obtainable from the other when the user scrolls back. It also changes what the user sees: rows scrolled far past are genuinely no longer in memory, so a virtualised list is usually part of the same design decision.

**★ Your `onMutate` edits an infinite query's cache and it throws in production but never in review. Why?**
Because the updater's argument is `InfiniteData | undefined` and every path you tested had the entry present. *"If the query does not exist, it will be created"* — so `setQueryData` calls the updater with `undefined` on a cold start, on a deep link that never mounted the feed, and after garbage collection, which happens after five minutes with no observer. The infinite case makes the crash more likely to be missed, because the guide's own examples for editing infinite data dereference `data.pages` unguarded and are widely copied. Return `old` untouched when it is falsy, then build the new `{ pages, pageParams }`.

**★ What is the rule about `pages` and `pageParams` when you hand-edit the cache?**
They stay positionally paired and the same length: *"Make sure to always keep the same data structure of pages and pageParams!"* `pageParams[i]` is the param that produced `pages[i]`, and it is replayed on refetch. So removing a whole page means slicing both arrays; removing a *row* from within a page means mapping over `pages` and leaving `pageParams` completely alone, because the page still exists. Getting this wrong does not fail immediately — it fails at the next refetch, which is what makes it hard to attribute.

**★ How do you prefetch an infinite query in v5, and how many pages do you get?**
`queryClient.infiniteQuery({ queryKey, queryFn, initialPageParam, getNextPageParam, pages: n })`. `prefetchInfiniteQuery` no longer appears in the `QueryClient` reference at all, alongside `prefetchQuery`, `fetchQuery` and `ensureQueryData`, whose deprecation the prefetching guide states directly. Without `pages` you get one page: *"By default, only the first page gets prefetched."* And the method rejects rather than swallowing errors, so it needs a `.catch` — the docs' example imports `noop` for exactly that.

**★ Can `select` flatten an infinite query into a plain array of rows?**
The documentation does not say. The only `select` example the infinite-queries guide gives returns the same `{ pages, pageParams }` shape, for reversing display order, and the explicit "must conform to this structure" statement is written about `initialData` and `placeholderData` rather than about `select`. So the shape-preserving form is the one to rely on; flattening is better done in a `useMemo` over `data.pages` in the component, which is also where memoising it does the most good. If you do use `select`, copy the arrays before reordering them — `reverse()` mutates, and those arrays are the cache's.

**★ What is the difference, for an infinite query, between going stale and being removed from the cache?**
Stale means the data is still there and will be refreshed: all stored pages, sequentially, from the first. Removed means there is no data at all, and *"the pagination restarts at the initial state with only the initial group being requested"* — one page, scroll position lost. Staleness is the default state of every query immediately; removal is what `gcTime` does after five minutes without an observer, or what `removeQueries` does on demand. The practical consequence is that a feed which unmounts while the user reads something else for six minutes does not resume, it restarts — which is an argument for keeping the query mounted, or raising `gcTime` for that key.

---

← [Rendering & concurrency](./01c-rendering-and-concurrency.md) · [Topic index](../README.md) · Next → [Dependent & Parallel Queries](../08-dependent-and-parallel-queries/01-query-composition.md)
