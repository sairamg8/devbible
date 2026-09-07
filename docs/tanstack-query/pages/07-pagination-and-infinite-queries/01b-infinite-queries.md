---
title: "`useInfiniteQuery` in v5: `initialPageParam` and `getNextPageParam` are both required, and `null` now ends the list"
sidebar_label: "01b · useInfiniteQuery"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [`useInfiniteQuery` reference](https://tanstack.com/query/latest/docs/framework/react/reference/useInfiniteQuery), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 `useInfiniteQuery` in v5: the two required options and the stop signal that changed

**Three things about `useInfiniteQuery` changed in v5 and every one of them silently breaks v4-shaped code: `initialPageParam` became a required option, `getNextPageParam` became required, and the "no more pages" signal widened from `undefined` alone to `null` or `undefined`.** On top of that sits a rule most people never read at all — an infinite query is **one** cache entry with **one** allowed in-flight fetch — which is why "load more" lists corrupt themselves the moment a scroll handler and a background refetch overlap.

## 1. Under-The-Hood Mechanics

`useInfiniteQuery` is `useQuery` with an accumulator bolted on. The cache holds not the last response but a pair of parallel arrays: every page you have fetched, and every param that produced one.

```
useInfiniteQuery({ queryKey: ['projects'], queryFn, initialPageParam: 0, getNextPageParam })
        │
        ▼
first fetch ──► queryFn({ pageParam: initialPageParam })
        │                                    ▲
        │                                    └── v5: REQUIRED. v4 passed `undefined` here.
        ▼
data = { pages: [p0],        pageParams: [0]        }
        │
fetchNextPage() ──► getNextPageParam(lastPage, allPages, lastPageParam)
        │                │
        │                ├── returns a value  ──► hasNextPage === true, fetch, APPEND
        │                └── returns null OR undefined ──► hasNextPage === false, no fetch
        ▼
data = { pages: [p0, p1, p2], pageParams: [0, 3, 6] }   ← ONE cache entry, one key
```

The guide lists the differences from `useQuery` verbatim:

> *"`data` is now an object containing infinite query data: `data.pages` array containing the fetched pages, `data.pageParams` array containing the page params used to fetch the pages"*

> *"The `initialPageParam` option is now available (and required) to specify the initial page param"*

> *"A `hasNextPage` boolean is now available and is `true` if `getNextPageParam` returns a value other than `null` or `undefined`"*

### Why `initialPageParam` became required
It is not tidying-up. The migration guide gives the mechanical reason:

> *"Previously, we've passed `undefined` to the `queryFn` as `pageParam`, and you could assign a default value to the `pageParam` parameter in the `queryFn` function signature. This had the drawback of storing `undefined` in the `queryCache`, which is not serializable."*

`pageParams` is part of the cached value, and the cached value has to survive `dehydrate` for SSR and for any persister. A leading `undefined` does not round-trip through JSON, so the default moved out of your function signature and into an option the library controls. The v4 form — `queryFn: ({ pageParam = 0 }) => …` — still *compiles*; it just leaves `initialPageParam` unset, which v5 does not accept.

### `getNextPageParam` is now required too
The same release removed the manual escape hatch and made the derivation mandatory:

> *"Previously, we've allowed to overwrite the `pageParams` that would be returned from `getNextPageParam` or `getPreviousPageParam` by passing a `pageParam` value directly to `fetchNextPage` or `fetchPreviousPage`. This feature didn't work at all with refetches and wasn't widely known or used. This also means that `getNextPageParam` is now required for infinite queries."*

So there is exactly one place that decides what the next request looks like, and it is a pure function of what came back last. That is what makes a refetch reconstructible.

### The three arguments, and the cursorless case
`getNextPageParam` receives the last page, all pages, and **the param that produced the last page** — which is what you use when the API hands back no cursor at all:

> *"If your API doesn't return a cursor, you can use the `pageParam` as a cursor. Because `getNextPageParam` and `getPreviousPageParam` also get the `pageParam` of the current page, you can use it to calculate the next / previous page param."*

⚠️ The guide's examples show three positional arguments (`lastPage, allPages, lastPageParam`) and three for the previous direction (`firstPage, allPages, firstPageParam`). **The documentation does not enumerate a fourth argument**; if your editor shows one, treat it as a typings detail this page cannot source.

## 2. Real-World Engineering Scenario

**Scenario**: An Activity Feed That Duplicated Rows on Fast Scroll and Nowhere Else.
An infinite feed used an `IntersectionObserver` sentinel calling `fetchNextPage()` unconditionally. On a slow connection, or when the window regained focus and a stale-triggered background refetch was already running, the sentinel fired again before the previous fetch settled — one in-flight fetch per infinite query, so the second call cancelled the first and the accumulated `pages` array ended up with a page appended out of order relative to the cursors that produced it. It reproduced only on fast scroll, only sometimes, which made it look like a backend problem. Adding the guard the docs prescribe — `hasNextPage && !isFetching` — removed it entirely, because the sentinel now declines to fire while any fetch, next-page or background, is running.

---

## 3. Production-Grade Code Example

```typescript
// The v5 shape: object form, initialPageParam REQUIRED, getNextPageParam REQUIRED.
// Bi-directional, because maxPages (see 01c) requires both directions to be defined.
type ProjectsPage = {
  data: Project[];
  nextCursor?: number;
  prevCursor?: number;
};

function useProjects() {
  return useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: ({ pageParam }): Promise<ProjectsPage> => fetchProjects(pageParam),
    initialPageParam: 0,
    // returned as-is: when the API omits nextCursor the value is undefined, which stops
    // pagination. Returning null does the same — v5 widened the check to include it.
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.prevCursor,
  });
}
```

```typescript
// A cursorless API: derive the next param from the LAST PARAM, and stop on an empty page.
function useSearchResults(term: string) {
  return useInfiniteQuery({
    queryKey: ['search', term],
    queryFn: ({ pageParam }) => fetchSearchPage(term, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.length === 0) return undefined; // no rows came back ⇒ end of list
      return lastPageParam + 1;
    },
    getPreviousPageParam: (firstPage, allPages, firstPageParam) => {
      if (firstPageParam <= 1) return undefined; // already at the first page
      return firstPageParam - 1;
    },
  });
}
```

```tsx
// Feed.tsx — the guarded sentinel. The guard is the whole point of this file.
function Feed() {
  const {
    data, status, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage,
  } = useProjects();

  // ONE flat array, memoised: data.pages is a new array identity on every fetch, and
  // flatMap in the render body hands a brand-new array to every memoised child.
  const projects = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      // the documented guard: never fire while ANY fetch for this query is running
      if (entries[0].isIntersecting && hasNextPage && !isFetching) {
        fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage]);

  if (status === 'pending') return <Spinner />;
  if (status === 'error') return <ErrorPanel message={error.message} />;

  return (
    <div>
      {projects.map((project) => (
        <ProjectRow key={project.id} project={project} />
      ))}
      <div ref={sentinelRef} />
      {isFetchingNextPage ? <Spinner label="Loading more…" /> : null}
      {isFetching && !isFetchingNextPage ? <Badge>Refreshing</Badge> : null}
      {!hasNextPage ? <p>Nothing more to load</p> : null}
    </div>
  );
}
```

```tsx
// A user-driven button can be simpler, but still guards on isFetching rather than
// isFetchingNextPage — a background refetch is also a fetch, and only one may run.
<button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetching}>
  {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load More' : 'Nothing more to load'}
</button>
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: The v4 Default-Parameter Idiom
```typescript
// ❌ v4: the default lived in the queryFn signature, and `undefined` went into the cache
useInfiniteQuery({
  queryKey: ['projects'],
  queryFn: ({ pageParam = 0 }) => fetchProjects(pageParam), // default here
  getNextPageParam: (lastPage) => lastPage.next,
});

// ✅ v5: the default is an option, so pageParams is serializable and refetches reconstruct
useInfiniteQuery({
  queryKey: ['projects'],
  queryFn: ({ pageParam }) => fetchProjects(pageParam),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => lastPage.next,
});
```

## Gotchas

**★ 🔴 `initialPageParam` is required, and the v4 idiom it replaced still compiles.** *"The `initialPageParam` option is now available (and required) to specify the initial page param."* The code it replaced — a default in the destructuring, `queryFn: ({ pageParam = 0 }) => …` — is ordinary JavaScript, so nothing in your editor objects to it; you have simply not supplied the option the library now needs. The stated reason is serialization: *"This had the drawback of storing `undefined` in the `queryCache`, which is not serializable"* — `pageParams` is part of the cached value and has to survive dehydration for SSR and for any persister.

**★ 🔴 `null` now stops pagination, and the `?? undefined` habit is v4 residue.** *"In v4, you needed to explicitly return `undefined` to indicate that there is no further page available. We've widened this check to include `null`."* Any code writing `lastPage.nextCursor ?? undefined` is converting a stop signal into a different stop signal, which is harmless but signals the author was working from v4 material. The genuinely harmful version is `lastPage.nextCursor || null`, which converts a **valid falsy cursor** — page index `0`, an empty-string token — into a stop, ending the list one page early with no error anywhere.

**★ `getNextPageParam` is required, not optional.** *"This also means that `getNextPageParam` is now required for infinite queries."* It became mandatory when v5 removed the ability to pass a `pageParam` directly to `fetchNextPage`, because that was the only other way the library could learn what to request next. There is now exactly one derivation, and it must be a pure function of the previous response.

**★ `hasNextPage` is derived from the last `getNextPageParam` call, not from a count.** Nothing in the library knows how many pages exist. If your API signals the end by returning an empty array rather than by dropping the cursor field, you must say so — `if (lastPage.length === 0) return undefined` — or `getNextPageParam` keeps producing params and `hasNextPage` stays true forever, fetching empty pages for as long as the user scrolls.

**★ Bi-directional lists need `getPreviousPageParam`, and so does `maxPages`.** *"Bi-directional lists can be implemented by using the `getPreviousPageParam`, `fetchPreviousPage`, `hasPreviousPage` and `isFetchingPreviousPage` properties and functions."* The same option is a hard prerequisite for bounding memory: *"Note that the infinite list must be bi-directional, which requires both `getNextPageParam` and `getPreviousPageParam` to be defined."* Details of what that bound does are in [`01d`](01d-infinite-cache-refetch-and-manual-updates.md).

**★ `fetchNextPage()` takes no page argument in v5.** Passing one used to override the derived param; that path is gone — *"This feature didn't work at all with refetches and wasn't widely known or used."* If you find yourself wanting it, the requirement is a jump, and a jump belongs to a keyed `useQuery` rather than to an accumulating list.

**★ The query key contains no page information, and must not.** All pages live under one key, so the key identifies the *list*, not a position in it. That is what makes `invalidateQueries({ queryKey: ['projects'] })` refresh the whole accumulated list in one call — and it is also why any filter or search term the list depends on must be in the key, since changing it means a different list, not a different page.

## Interview questions

**★ What changed about `useInfiniteQuery` between v4 and v5, and which of those changes fail loudly?**
Four things. `initialPageParam` became required, `getNextPageParam` became required, `null` joined `undefined` as the stop signal, and passing a `pageParam` directly to `fetchNextPage` was removed. Only the two required options fail in a way you notice; the other two are quiet. The `null` widening is quiet because it made previously-broken code work, and the removed override is quiet because the argument is simply ignored. Meanwhile the option that changed shape most visibly is not on this hook at all — `keepPreviousData: true` became `placeholderData: keepPreviousData`, covered in [`01`](01-paged-data-patterns.md).

**★ Why did `initialPageParam` have to become an option instead of a default parameter?**
Because `pageParams` is cached, and the cache has to serialize. The migration guide says it directly: passing `undefined` as the first `pageParam` *"had the drawback of storing `undefined` in the `queryCache`, which is not serializable."* A default in the `queryFn` signature is invisible to the library — it is applied inside your function, after the library has already recorded what it passed. Moving it to an option means the recorded param is the real one, which is what lets a dehydrated cache round-trip through SSR and lets a refetch reconstruct the same sequence of requests.

**★ How does `hasNextPage` decide it is false?**
It tests what `getNextPageParam` returned against `null` and `undefined` — *"`hasNextPage` … is `true` if `getNextPageParam` returns a value other than `null` or `undefined`."* Nothing else participates: there is no total count, no page limit, no server-side "isLast" convention the library understands. So if your API signals the end by returning an empty array while still echoing a cursor, `getNextPageParam` has to encode that itself. And because the test is against exactly those two values, `0` and `''` are perfectly valid page params — which is why `lastPage.nextCursor || null` is a bug and `lastPage.nextCursor` is not.

**★ Why does an infinite query use one key for all pages when a paginated `useQuery` uses one key per page?**
Because the unit of caching follows the unit of display. An infinite list shows every page it has fetched simultaneously, so the cached value is the whole accumulated list — *"A single cache entry is shared for all pages"* — and one invalidation refreshes all of it. A numbered pager shows exactly one page, so each page is its own entry with its own freshness and its own garbage-collection clock. That difference is also the source of each hook's characteristic failure: the infinite query serialises all its fetches through one entry, and the paginated query flickers because each page starts life empty.

**★ Your API paginates by page number and returns no cursor. Can `useInfiniteQuery` still drive the feed?**
Yes, and the guide shows the shape: `getNextPageParam` also receives the param that produced the last page, so you return `lastPageParam + 1` and stop when a page comes back empty. The caveat is not mechanical but semantic — a page number counts rows, so any insert above the current window shifts everything below it, and a user scrolling a live feed will see a row twice. That is a property of offset pagination, not of the hook, and no client-side option removes it; the fix is a keyset cursor on the server. See [`01`](01-paged-data-patterns.md) for the offset-versus-cursor trade-off in full.

---

← [Pagination & Infinite Queries](./01-paged-data-patterns.md) · [Topic index](../README.md) · Next → [Rendering & concurrency](./01c-rendering-and-concurrency.md)
