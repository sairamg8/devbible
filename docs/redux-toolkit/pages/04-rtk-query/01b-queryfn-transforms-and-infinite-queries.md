---
title: "Beyond `query` and `mutation`: `queryFn`, response transforms and infinite queries"
sidebar_label: "`queryFn`, transforms & infinite queries"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`createApi`](https://redux-toolkit.js.org/rtk-query/api/createApi),
> [infinite queries](https://redux-toolkit.js.org/rtk-query/usage/infinite-queries).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 `queryFn`, Response Transforms & Infinite Queries

**[The previous page](./01-api-slice-and-endpoints.md) covered the shape every RTK Query tutorial
covers: a `baseQuery`, a `query` returning a URL, a generated hook.** Three parts of the API sit
outside that shape, and each exists because the simple form runs out: data that does not come from
`fetch` at all, responses whose wire format is not the shape you want to cache, and pagination that has
to live in one cache entry rather than one per page.

## 1. Under-The-Hood Mechanics

### `queryFn` — the escape hatch from `baseQuery`

`query` says *"build me a request and hand it to `baseQuery`"*. `queryFn` replaces that entirely with
your own async function. It receives the endpoint argument, the `BaseQueryApi` object (`signal`,
`dispatch`, `getState`, `extra`), `extraOptions`, and the `baseQuery` function itself — and it must
return an object with **either** `data` **or** `error`. Never a thrown exception, never a bare value.

```typescript
// Data that isn't HTTP at all — a Firebase/WebSocket/SDK read, cached like any other endpoint
getUserDoc: builder.query<UserDoc, string>({
  queryFn: async (uid) => {
    try {
      const snapshot = await firestore.collection('users').doc(uid).get();
      return { data: snapshot.data() as UserDoc };
    } catch (e) {
      return { error: { status: 'CUSTOM_ERROR', error: String(e) } };
    }
  },
}),

// Or: several requests that should be ONE cache entry, using the injected baseQuery
getDashboard: builder.query<Dashboard, void>({
  queryFn: async (_arg, _api, _extraOptions, baseQuery) => {
    const [profile, invoices] = await Promise.all([
      baseQuery('/profile'),
      baseQuery('/invoices'),
    ]);
    if (profile.error) return { error: profile.error };
    if (invoices.error) return { error: invoices.error };
    return { data: { profile: profile.data, invoices: invoices.data } as Dashboard };
  },
}),
```

🔴 **`queryFn` and `query` are mutually exclusive on one endpoint**, and choosing `queryFn` **disables
`transformResponse` and `transformErrorResponse`** — the docs state both are "not applicable when using
`queryFn`". That is not an oversight: the transforms exist to reshape what `baseQuery` returned, and
with `queryFn` you *are* the thing that returned it, so you reshape it yourself before returning.

### `transformResponse` and `transformErrorResponse`

Both receive `(value, meta, arg)` and both run **once per actual network fetch**, not per render or per
subscriber. Their output is what gets cached, so they are the right place to normalise a wire format
into the shape your components want — and the wrong place for anything non-deterministic.

```typescript
getPosts: builder.query<Post[], void>({
  query: () => '/posts',
  // The API wraps everything in an envelope; the cache should not have to know that
  transformResponse: (response: { data: Post[]; meta: unknown }) => response.data,
  // Turn a backend error envelope into something the UI can branch on
  transformErrorResponse: (error) => ({
    status: error.status,
    code: (error.data as { code?: string })?.code ?? 'UNKNOWN',
  }),
}),
```

### Infinite queries

`builder.infiniteQuery()` holds **many pages in one cache entry**, rather than one entry per page — the
difference between "load more" accumulating a list and a paginated table replacing it. It takes an
`infiniteQueryOptions` object:

| Option | Role |
|---|---|
| `initialPageParam` | the page param used for the first request |
| `getNextPageParam` | **required** — derives the next page param from the last page, all pages, the last param, all params and the arg. Return `undefined` to signal there is no next page |
| `getPreviousPageParam` | optional, same signature, for backwards pagination |
| `maxPages` | optional cap on how many pages stay cached at once |

The generated hook is `use<EndpointName>InfiniteQuery`. Its `data` is **not** a flat array — it is
`{ pages, pageParams }` — and alongside the usual status flags it returns `hasNextPage` /
`hasPreviousPage` and `fetchNextPage` / `fetchPreviousPage`.

```typescript
getPokemon: builder.infiniteQuery<PokemonPage, string, number>({
  query: ({ queryArg, pageParam }) => `/pokemon?type=${queryArg}&offset=${pageParam}`,
  infiniteQueryOptions: {
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + lastPage.items.length : undefined,
  },
}),
```

```tsx
function PokemonList({ type }: { type: string }) {
  const { data, fetchNextPage, hasNextPage, isFetching } = useGetPokemonInfiniteQuery(type);
  const items = data?.pages.flatMap((p) => p.items) ?? [];   // flatten at read time
  return (
    <>
      {items.map((p) => <Row key={p.id} pokemon={p} />)}
      {hasNextPage && (
        <button disabled={isFetching} onClick={() => fetchNextPage()}>Load more</button>
      )}
    </>
  );
}
```

⚠️ **The documentation does not state which RTK version introduced `infiniteQuery`.** It is present in
the current docs for the pinned **2.12.0**; if you are on an older 2.x and the builder method is
missing, check your installed version rather than assuming the API changed.

## 2. Real-World Engineering Scenario

**Scenario**: A Feed Backed by Two Incompatible Sources.
A product feed comes from a REST service, but a per-item "in stock" flag lives behind a vendor SDK with
no HTTP surface. Modelling that as two endpoints means every component composes two loading states, two
error states and two cache lifetimes. A single `queryFn` endpoint calls `baseQuery` for the REST half,
awaits the SDK for the other, and returns one merged object — so consumers see one entry, one
`isLoading`, one tag to invalidate. Meanwhile the feed itself is an `infiniteQuery`, so "load more"
appends pages into the same entry instead of creating an entry per page that the tag system would then
have to invalidate individually.

## Gotchas

### `queryFn` that throws instead of returning `{ error }`
**Symptom.** An unhandled rejection in the console, and a cache entry stuck in a fetching state.
**Cause.** RTK Query expects a resolved object with `data` or `error`. A thrown exception is not part
of the contract.
**Fix.** Wrap the body in `try`/`catch` and return an error object — as in the Firestore example above.
Every path out of a `queryFn` must be a `return`.

### Expecting `transformResponse` to run with `queryFn`
**Symptom.** The transform is simply never called; the raw shape lands in the cache.
**Cause.** Both transforms are documented as "not applicable when using `queryFn`".
**Fix.** Do the reshaping inside the `queryFn` before returning `{ data }`. If you want the transform,
you want `query`.

### Non-deterministic work inside `transformResponse`
**Symptom.** A "last updated" timestamp that is wrong by minutes, and identical for every reader.
**Cause.** The transform runs once per fetch and its output *is* the cached value. A `Date.now()`
computed there is frozen into the cache for the whole `keepUnusedDataFor` window.
**Fix.** Cache the server's own timestamp and derive relative time at render, or read
`meta`'s response headers. Never mint "now" into cached data.

### Treating an infinite query's `data` as an array
**Symptom.** `data.map is not a function`, or a list that renders nothing.
**Cause.** `data` is `{ pages, pageParams }`. The pages are the unit RTK Query caches; flattening is
your job.
**Fix.** `data?.pages.flatMap(p => p.items) ?? []` at the point of render — and do it in a `useMemo` if
the list is large enough for the allocation to matter.

### `getNextPageParam` that never returns `undefined`
**Symptom.** `hasNextPage` stays `true` forever and "load more" keeps firing requests past the end,
appending empty pages.
**Cause.** `undefined` is the **only** signal for "there is no next page". Returning `lastPageParam + 1`
unconditionally always looks like more.
**Fix.** Derive the end condition from the response — a `hasMore` flag, a `next` cursor being null, or a
short final page — and return `undefined` there.

### Reaching for an infinite query for an ordinary paginated table
**Symptom.** Page 7 forces pages 1–6 to be held and refetched; jumping straight to a page is awkward.
**Cause.** Infinite queries accumulate; they model "load more", not "go to page N".
**Fix.** A plain `builder.query` keyed by `{ page }` is the right model for a table with page controls —
each page is its own entry, independently cacheable and invalidatable. Use `maxPages` only when you
genuinely want accumulation with a bound.

## Interview questions

**★ When would you use `queryFn` instead of `query`?**
When the data does not come from `baseQuery`'s request model at all — an SDK, a WebSocket read, a value
computed locally — or when several requests must resolve into a single cache entry. It hands you the
whole fetch step: you return `{ data }` or `{ error }` and RTK Query does everything else, so you still
get caching, deduplication, tags and generated hooks for a source that has no URL.

**★ What do you lose by choosing `queryFn`?**
`transformResponse` and `transformErrorResponse`, which the docs state are not applicable with it. That
is coherent rather than arbitrary — the transforms reshape what `baseQuery` returned, and with `queryFn`
you are that step, so you reshape before returning. You also take on error normalisation by hand,
including never throwing.

**★ How often does `transformResponse` run, and why does that matter?**
Once per actual network fetch, not per render or per subscriber — its return value is the cached data.
That makes it the correct place for envelope-unwrapping and field renaming, and the wrong place for
anything time- or random-dependent, because whatever it computes is frozen into the cache for the entry's
whole lifetime.

**What shape is an infinite query's `data`, and why isn't it just an array?**
`{ pages, pageParams }`. Keeping pages discrete is what lets RTK Query append a page without refetching
the others, bound retention with `maxPages`, and hand `getNextPageParam` the previous page and param to
compute the next one. Flattening is a read-time concern, so the cache keeps the structure the machinery
needs.

**How does an infinite query know it has reached the end?**
`getNextPageParam` returns `undefined`, and that is the only signal — `hasNextPage` is derived from it.
The common bug is an implementation that unconditionally increments an offset, which leaves `hasNextPage`
permanently true and lets the UI request pages past the end.

**Infinite query or paginated query for a table with numbered pages?**
Paginated `builder.query` keyed by `{ page }`. Infinite queries model accumulation — "load more" — and
holding pages 1–6 to display page 7 is cost with no benefit when the user can jump directly. Separate
entries per page are also individually cacheable and individually invalidatable, which numbered
pagination wants and a feed does not.

---

← [RTK Query](./01-api-slice-and-endpoints.md) · [Topic index](../README.md) · Next → [RTK Query Cache](./02-cache-management-and-invalidation.md)
