---
title: "Pagination & Infinite Queries: `useInfiniteQuery` & `keepPreviousData`"
sidebar_label: "Pagination & Infinite Queries"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Paginated / Lagged Queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries), [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data), [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 Pagination & Infinite Queries: `useInfiniteQuery` & `keepPreviousData`

## 1. Under-The-Hood Mechanics

Paginated data has two genuinely different UI patterns — "load more, accumulating pages" (infinite scroll) and "jump between discrete pages" (traditional pagination) — each with its own dedicated TanStack Query mechanism.

```
useInfiniteQuery — ACCUMULATES pages into one growing array
        │
        ├── getNextPageParam(lastPage, allPages, lastPageParam)  ──► derives the NEXT cursor/page
        │                                                 number from the last response
        ├── fetchNextPage()                            ──► fetches and APPENDS the next page to `data.pages`
        └── hasNextPage                                   ──► derived boolean: is getNextPageParam's
                                                               return value something other than
                                                               null or undefined?

useQuery + placeholderData: keepPreviousData — DISCRETE page jumps, no accumulation
        │
        ▼
Changing the page-number queryKey normally shows a LOADING state for the new page —
keepPreviousData instead shows the PREVIOUS page's data (marked isPlaceholderData: true)
WHILE the new page loads, avoiding a jarring loading-flicker between page clicks
```

### `getNextPageParam`: Deriving the Next Request From the Last Response
Rather than the consuming code manually tracking "what page am I on," `getNextPageParam` receives the **last fetched page's data**, all pages so far, and the page param that produced the last page, and returns whatever value the next `queryFn` call should use as its cursor/page parameter. 🔴 **In v5 the stop signal is `null` *or* `undefined`** — the guide states that a *"`hasNextPage` boolean is now available and is `true` if `getNextPageParam` returns a value other than `null` or `undefined`"*, and the migration guide records the widening explicitly: *"In v4, you needed to explicitly return `undefined` to indicate that there is no further page available. We've widened this check to include `null`."* The full mechanics — `initialPageParam`, bi-directional lists, `maxPages`, and what a refetch does to an accumulated list — are in [`01b`](01b-infinite-queries.md).

### `keepPreviousData`: Eliminating Loading Flicker Between Pages
Without it, clicking "next page" on a traditional paginated table would briefly show a loading spinner (since the new page number's query key has no cached data yet) even though the user just wants to see the next set of rows — `placeholderData: keepPreviousData` keeps the **previous** page's data visible (clearly marked via `isPlaceholderData: true` so the UI can dim it or show a subtle loading indicator) until the new page's real data arrives, producing a much smoother pagination experience.

The docs name the symptom in bold before offering the cure:

> *"**The UI jumps in and out of the `success` and `pending` states because each new page is treated like a brand new query.**"*

And the three things you get back by opting in:

> *"**The data from the last successful fetch is available while new data is being requested, even though the query key has changed**. When the new data arrives, the previous `data` is seamlessly swapped to show the new data. `isPlaceholderData` is made available to know what data the query is currently providing you"*

⚠ **Deprecated: the v4 boolean.** `keepPreviousData: true` no longer exists — *"We have removed the `keepPreviousData` option and `isPreviousData` flag as they were doing mostly the same thing as `placeholderData` and `isPlaceholderData` flag."* Its successor is the **exported function** of the same name, passed as the value of `placeholderData`. `placeholderData: (previousData, previousQuery) => previousData` is the identical thing written by hand.

### Offset Pagination vs Cursor Pagination — and which hook each wants
Page-number (offset/`LIMIT … OFFSET`) APIs let a user jump straight to page 7; cursor APIs only let you ask for "the next N after this token". That difference decides the hook, not your preference:

| | Offset / page number | Cursor / keyset |
|---|---|---|
| Request | `?page=7&size=20` | `?cursor=abc&limit=20` |
| Can jump to an arbitrary page | yes | no |
| Stable under concurrent inserts | **no** — a row inserted at the top shifts every later page by one, so the reader sees a duplicate row and skips one | yes — the cursor names a position in the data, not a count |
| Total count available | usually | usually not |
| Natural fit | `useQuery` with the page number in the key, plus `placeholderData` | `useInfiniteQuery` |

`useInfiniteQuery` is *shaped* for cursors: the whole point of `getNextPageParam` is that the next request is derived from the previous **response**, which is exactly what a cursor is. It works with page numbers too — the guide shows `lastPageParam + 1` for APIs that return no cursor — but a numbered API driving an accumulating list inherits the shifting-window problem above, on a list the user is actively scrolling.

### One key per page: what the cache actually holds
With `useQuery({ queryKey: ['projects', page] })` **every page is its own cache entry**, with its own `staleTime`, its own `gcTime` countdown and its own entry in the devtools. That is why the naive version flickers — page 8 is a brand-new query with no data — and it is also why prefix invalidation works so well here: `invalidateQueries({ queryKey: ['projects'] })` marks every cached page stale in one call. `useInfiniteQuery` is the opposite arrangement, and the guide says so: *"A single cache entry is shared for all pages"*.

---

## 2. Real-World Engineering Scenario

**Scenario**: An Infinite-Scrolling Comment Feed Correctly Stopping "Load More" Once All Comments Are Loaded.
A comment feed needed infinite-scroll behavior — loading more comments as the user scrolls, accumulating them into one continuous list. `useInfiniteQuery` with `getNextPageParam` reading the API response's `nextCursor` field (returning `undefined` once the API indicated no more comments existed) meant `hasNextPage` automatically became `false` at exactly the right moment — the "Load More" button correctly disabled/hid itself once every comment had been loaded, without any manual tracking of "how many comments are there total" needed anywhere in the component.

**Scenario**: An Admin Table Whose "Next Page" Button Stopped Feeling Broken.
A 40-column admin table on a slow endpoint blanked to a spinner on every page click, so operators clicked twice, landed on page 3, and reported the pagination as buggy. Switching the query to `placeholderData: keepPreviousData` kept page 4's rows on screen — dimmed via `isPlaceholderData` — while page 5 loaded, and disabling the Next button on the same flag removed the double-click entirely. Nothing about the request changed; only whether the previous render survived the key change.

---

## 3. Production-Grade Code Example

```typescript
// useInfiniteQuery — accumulating pages, with automatic hasNextPage derivation
function useComments(postId: string) {
  return useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: ({ pageParam }) => fetchComments(postId, pageParam),
    initialPageParam: 0,          // REQUIRED in v5 — it is the pageParam for the first page
    getNextPageParam: (lastPage) => lastPage.nextCursor, // null OR undefined ⇒ no more pages
  });
}
```

```tsx
// CommentFeed.tsx — consuming the infinite query
function CommentFeed({ postId }: { postId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } = useComments(postId);

  return (
    <div>
      {data?.pages.flatMap((page) => page.comments).map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
      {hasNextPage && (
        // guard on isFetching too: only ONE fetch can be in flight for an infinite query
        <button onClick={() => fetchNextPage()} disabled={isFetching}>
          {isFetchingNextPage ? 'Loading…' : 'Load More'}
        </button>
      )}
      {/* a background refresh, as distinct from loading one more page */}
      {isFetching && !isFetchingNextPage ? <Spinner /> : null}
    </div>
  );
}
```

```typescript
// keepPreviousData — smooth, flicker-free traditional pagination
import { keepPreviousData } from '@tanstack/react-query';

function useProductPage(pageNumber: number) {
  return useQuery({
    queryKey: ['products', 'page', pageNumber], // the page number MUST be in the key
    queryFn: () => fetchProductsPage(pageNumber),
    placeholderData: keepPreviousData, // shows the PREVIOUS page while the new one loads
  });
}
```

```tsx
// ProductTable.tsx — using isPlaceholderData to subtly indicate the transitional state
function ProductTable() {
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useProductPage(page);

  return (
    <div style={{ opacity: isPlaceholderData ? 0.6 : 1 }}> {/* subtle dim, not a jarring spinner */}
      <ProductList products={data?.products} />
      <button onClick={() => setPage((p) => p + 1)} disabled={isPlaceholderData}>Next Page</button>
    </div>
  );
}
```

```typescript
// Warming the NEXT page while the user reads the current one.
// v5: queryClient.query(), NOT the deprecated prefetchQuery/ensureQueryData.
function usePrefetchNextProductPage(pageNumber: number) {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient
      .query({
        queryKey: ['products', 'page', pageNumber + 1],
        queryFn: () => fetchProductsPage(pageNumber + 1),
      })
      .catch(() => {
        // queryClient.query() REJECTS on error — an unhandled rejection otherwise
      });
  }, [queryClient, pageNumber]);
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Coercing a Valid Falsy Cursor Into a Stop Signal
```typescript
// ❌ WRONG: `||` converts a LEGITIMATE falsy cursor — page index 0, an empty-string
// token — into null, so pagination stops one page early and hasNextPage goes false
// while the API still has data. In v5 BOTH null and undefined mean "no next page".
getNextPageParam: (lastPage) => lastPage.nextCursor || null,

// ✅ CORRECT: return the cursor untouched, exactly as the guide's own example does.
// When the API omits the field the value is already undefined, which stops pagination.
getNextPageParam: (lastPage) => lastPage.nextCursor,
```

### ⚠️ Pitfall 2: Not Checking `isPlaceholderData` Before Treating Displayed Data as Final/Real
```tsx
// ❌ RISKY: acting on displayed data as if it's the CURRENT page's real, confirmed data,
// when it might still be the PREVIOUS page's placeholder data shown during a transition
function handleExport() {
  exportToCSV(data.products); // might export the WRONG (previous) page's data if still a placeholder
}

// ✅ CORRECT: check isPlaceholderData before treating data as genuinely current/final
function handleExport() {
  if (isPlaceholderData) return; // wait for the REAL data before allowing an export action
  exportToCSV(data.products);
}
```

### ⚠️ Pitfall 3: Using `useInfiniteQuery` for Simple, Discrete Pagination (or Vice Versa)
```typescript
// ❌ MISMATCHED TOOL: useInfiniteQuery ACCUMULATES pages into one growing array — using it
// for a traditional "jump to page 5" pagination UI means unnecessarily managing an
// ever-growing pages array when only ONE page's data should ever be shown at a time,
// and there is no supported way to jump: v5 removed manual pageParam passing entirely.
useInfiniteQuery({
  queryKey: ['products'],
  queryFn: ({ pageParam }) => fetchProductsPage(pageParam),
  initialPageParam: 1,
  getNextPageParam: (lastPage, allPages, lastPageParam) => lastPageParam + 1,
});

// ✅ CORRECT: use plain useQuery + keepPreviousData for discrete, jump-to-any-page pagination;
// reserve useInfiniteQuery specifically for genuinely ACCUMULATING, scroll-based feeds
useQuery({ queryKey: ['products', 'page', pageNumber], queryFn: fetchPage, placeholderData: keepPreviousData });
```

### ⚠️ Pitfall 4: Leaving the Page Number Out of the Query Key
```typescript
// ❌ BROKEN: one cache entry for every page. Changing `page` re-renders the component
// but the key is unchanged, so nothing refetches and page 1 is shown forever.
useQuery({ queryKey: ['products'], queryFn: () => fetchProductsPage(page) });

// ✅ CORRECT: the key is the identity of the data. Different page ⇒ different key.
useQuery({ queryKey: ['products', 'page', page], queryFn: () => fetchProductsPage(page) });
```

---

## Gotchas

**★ 🔴 `keepPreviousData: true` does not exist in v5, and the replacement is a function you import.** The migration guide is explicit: *"We have removed the `keepPreviousData` option and `isPreviousData` flag as they were doing mostly the same thing as `placeholderData` and `isPlaceholderData` flag."* What replaced it is `placeholderData: keepPreviousData`, where `keepPreviousData` is imported from `@tanstack/react-query` and is *"an identity function"* — equivalent to writing `placeholderData: (previousData, previousQuery) => previousData` yourself. Nothing throws if you write the v4 boolean: it is simply a property the library no longer reads, so in plain JavaScript, or anywhere the options object is assembled before being passed, the flicker just never goes away and no error points at why.

**★ `placeholderData` puts the query in `success`, so `isPending` never fires again after the first page.** *"`placeholderData` will always put you into `success` state, while `keepPreviousData` gave you the status of the previous query."* Any loading UI keyed off `isPending` renders exactly once, on the very first page, and never again — including on a page whose fetch is genuinely slow. The flags that still move are `isFetching` (a request is in flight) and `isPlaceholderData` (what you are looking at is not this key's data). Build the transition affordance out of those two.

**★ `dataUpdatedAt` freezes at `0` while placeholder data is showing.** *"`keepPreviousData` gave you the `dataUpdatedAt` timestamp of the previous data, while with `placeholderData`, `dataUpdatedAt` will stay at `0`."* A "last updated 2 minutes ago" caption computed from `dataUpdatedAt` therefore reads as the epoch during every page transition. Render that caption only when `isPlaceholderData` is false.

**★ Placeholder data is never written to the cache.** *"Placeholder data allows a query to behave as if it already has data, similar to the `initialData` option, but **the data is not persisted to the cache**."* So `getQueryData(['products', 'page', 8])` returns `undefined` while page 8 is displaying page 7's rows, and a second component mounting on the same key gets a `pending` query rather than the placeholder. Placeholder data is a *view* concern, per observer; `initialData` is the option that seeds the cache.

**★ `isPlaceholderData` guards actions, not just opacity.** Dimming the table is the visible half. The half that ships bugs is every action that reads `data` — export to CSV, "select all on this page", a Next button that reads `data.hasMore`. The docs' own example disables the Next control on it and checks it again inside the handler: `disabled={isPlaceholderData || !data?.hasMore}` alongside `if (!isPlaceholderData && data.hasMore) { setPage((old) => old + 1) }`. Two checks for one condition, because the click can land in the same tick the flag flips.

**★ Offset pagination over a table that is still being written to duplicates and skips rows.** `LIMIT 20 OFFSET 40` counts rows; if two rows are inserted above the window between the page-3 and page-4 requests, two rows the user already saw reappear at the top of page 4 and two they have not seen are pushed past it. No client library can fix this — it is a property of counting into a moving list. Cursor/keyset pagination names a *position* instead of a count, which is why `useInfiniteQuery` is built around a token derived from the previous response.

**★ Every page number is its own cache entry, with its own five-minute clock.** Under `useQuery` the key `['products', 'page', 7]` is a distinct query, so a user who paged to 40 has forty entries, each independently garbage-collected: *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."* That is usually what you want — a prefix invalidation reaches all of them at once — but it means "go back to page 1" after a long detour is a fresh network request, not a cache hit.

**★ The page number belongs in the query key, not only in the closure.** `queryKey: ['products']` with `queryFn: () => fetch(page)` compiles, renders, and shows page 1 forever: the key never changes, so the library sees no new query to fetch. This is the same rule as everywhere else in the library — the key is the identity of the data, and anything the `queryFn` reads must appear in it.

**★ Prefetching the next page uses `queryClient.query()`, not `prefetchQuery`.** The prefetching guide opens with the deprecation: *"These tips replace the use of the now deprecated `prefetchQuery` and `ensureQueryData` methods"* and *"those methods will be removed in the next major version of TanStack Query."* `queryClient.query` is described as *"an asynchronous method that can be used to fetch and cache a query. It will either resolve with the data or throw with an error"* — **it throws**, so an un-`catch`ed prefetch of a page the user never reaches turns a harmless warm-up into an unhandled promise rejection.

**★ `placeholderData` is per-observer, so two components on the same key can disagree.** Two sourced facts force this: the placeholder is *"not persisted to the cache"*, and the function form gets *"access to the data and Query meta information of a 'previous' successful Query."* A component that has been paging has such a previous query; a component mounting fresh on `['products', 'page', 8]` does not, so it has nothing to keep and renders `pending` while the first still shows page 7 dimmed. If both must agree, the shared state has to come from the cache — `initialData`, or seeding with `setQueryData` — not from a placeholder.

**★ 🔴 `keepPreviousData` keeps the previous *anything*, including the previous filter's rows.** The behaviour is *"the data from the last successful fetch is available while new data is being requested, **even though the query key has changed**"* — and it does not care *which part* of the key changed. Change the page and you see the previous page, which is what you asked for. Change the filter, the sort or the page size and you see the previous **filter's** rows, rendered under the new filter's controls, indistinguishable from a correct render except that the numbers are wrong. The function form exists for exactly this, because it receives the previous query as well as its data: `placeholderData: (previousData, previousQuery) => previousQuery?.queryKey[1] === filter ? previousData : undefined` declines the placeholder whenever the part of the key that changes the *meaning* of the rows has changed, and keeps it for a plain page step.

**★ Using `useInfiniteQuery` for a numbered pager leaves you with no way to jump.** v5 removed the escape hatch: *"Previously, we've allowed to overwrite the `pageParams` that would be returned from `getNextPageParam` or `getPreviousPageParam` by passing a `pageParam` value directly to `fetchNextPage` or `fetchPreviousPage`… This feature didn't work at all with refetches."* So "go to page 7" on an infinite query means fetching pages 1 through 7, or a second query with a different key. Pick the hook from the UI you are actually building.

## Interview questions

**★ A paginated table flickers to a spinner on every page click. What is happening, and what is the v5 fix?**
Each page number is part of the query key, so page 8 is a different query from page 7 with nothing cached — the observer starts in `pending` and the component renders its loading branch. The docs describe exactly this: *"The UI jumps in and out of the `success` and `pending` states because each new page is treated like a brand new query."* The fix is `placeholderData: keepPreviousData`, importing `keepPreviousData` as a function from `@tanstack/react-query`. The previous page's data stays on screen while the new key fetches, `isPlaceholderData` tells you which you are looking at, and the swap happens when the real data arrives. In v4 this was the boolean option `keepPreviousData: true`; that option was removed, and someone reaching for it from memory gets no error and no behaviour change.

**★ With `placeholderData` in play, which loading flag should the UI use, and why not `isPending`?**
`isFetching` and `isPlaceholderData`. `isPending` is dead after the first successful page, because *"`placeholderData` will always put you into `success` state"* — the query is never pending again, no matter how slow the next page is. `isFetching` still flips true for the in-flight request, and `isPlaceholderData` tells you the rendered rows belong to the previous key. The idiomatic transition UI is a subtle dim driven by `isPlaceholderData` plus a disabled Next control, not a spinner, because a spinner is precisely the thing you removed.

**★ Offset pagination or cursor pagination — how do you choose, and what does it cost you?**
Choose offset when the user must be able to jump to an arbitrary page and the underlying list is not being written to concurrently; choose a cursor when the list is a feed. Offset counts rows, so inserts above the current window shift everything below it: the reader sees a row twice and never sees another. Cursors name a position, so the window is stable, but you give up jumping and usually the total count. That choice then picks the hook — offset with the page number in the key and `placeholderData` for the table, `useInfiniteQuery` for the feed, since `getNextPageParam` exists precisely to derive the next request from the previous response.

**★ Is `placeholderData` written to the cache? What follows from the answer?**
No — *"the data is not persisted to the cache."* Three things follow. `getQueryData` on the new key returns `undefined` while the placeholder is on screen, so any code that reads the cache directly must not assume the visible rows are there. A second observer mounting on the same key does not inherit the placeholder, so two components can legitimately show different things at the same instant. And `dataUpdatedAt` stays at `0`, so a freshness caption computed from it is wrong for the whole transition. If you need any of those to behave otherwise, you want `initialData` — which *is* persisted — or an explicit `setQueryData`.

**★ Why does the docs' Next-page button check `isPlaceholderData` in two places?**
Because the flag governs both what the control looks like and what the handler is allowed to do, and those are evaluated at different moments. The example disables the button — `disabled={isPlaceholderData || !data?.hasMore}` — *and* re-checks inside the click handler — `if (!isPlaceholderData && data.hasMore)`. The `data.hasMore` being read comes from whichever page is currently rendered; if that is the placeholder, it is the *previous* page's answer to "is there more", and acting on it can advance past the end of the list. Every read of `data` during a transition carries the same caveat, which is why exports, bulk-selects and "select all on this page" need the guard too.

**★ You need to warm the next page while the user reads the current one. What is the v5 call, and what is the trap?**
`queryClient.query({ queryKey, queryFn })`. `prefetchQuery` and `ensureQueryData` are deprecated — *"those methods will be removed in the next major version of TanStack Query"* — and neither appears in the current `QueryClient` reference at all. The trap is the return contract: `query` *"will either resolve with the data or throw with an error"*, where the old `prefetchQuery` swallowed failures by design. Prefetching page 41 of a list the user closes at page 40 now produces an unhandled rejection unless you attach a `catch`. The prefetching guide's own examples do exactly that, importing `noop` from the package for the purpose.

**★ Why is the page number in the query key rather than just in the fetch function?**
Because the key *is* the cache identity. TanStack Query has no visibility into what your `queryFn` closes over; it decides whether to fetch, what to dedupe against, what to invalidate and what to garbage-collect purely from the hashed key. A `queryFn` that reads `page` from a closure while the key stays `['products']` gives every page the same cache entry, so changing the page re-renders and fetches nothing. The same rule is what makes `invalidateQueries({ queryKey: ['products'] })` reach every page at once — prefix matching only works if the discriminator is *in* the array.

**★ Can you use `useInfiniteQuery` for a numbered pager if the API only takes `?page=n`?**
You can make it fetch — the guide shows the shape for cursorless APIs, deriving the next param with `lastPageParam + 1` — but you should not, because the hook accumulates. `data.pages` grows without bound, a refetch re-requests every accumulated page sequentially, and there is no supported way to jump: v5 removed manual `pageParam` passing to `fetchNextPage` because *"this feature didn't work at all with refetches."* A numbered pager wants one page in memory at a time, which is `useQuery` with the number in the key. The reverse mistake — a `useQuery` per page behind an infinite-scroll UI — costs you the single accumulated array and the automatic end-of-list signal.

---

← [Network mode & offline](../06-background-refetching/01d-network-mode-and-offline.md) · [Topic index](../README.md) · Next → [`useInfiniteQuery`](./01b-infinite-queries.md)
