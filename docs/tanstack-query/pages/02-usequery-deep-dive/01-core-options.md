---
title: "`useQuery` Deep Dive: `queryKey`, `staleTime` vs `gcTime`, `enabled` & `select`"
sidebar_label: "`useQuery` Deep Dive"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the TanStack Query docs — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🔄 `useQuery` Deep Dive: `queryKey`, `staleTime` vs `gcTime`, `enabled` & `select`

## 1. Under-The-Hood Mechanics

`useQuery`'s handful of core options each control a genuinely distinct aspect of caching behavior — conflating them (especially `staleTime` and `gcTime`) is the single most common source of "why isn't my data refetching/why did my data disappear" confusion.

```typescript
useQuery({
  queryKey: ['todos', { status: 'active' }],   // the CACHE IDENTITY — must be unique, serializable, hierarchical
  queryFn: () => fetchTodos({ status: 'active' }), // the actual async data-fetching function
  enabled: !!userId,                              // conditionally/lazily trigger — skip entirely if false
  staleTime: 60_000,                                // how long data is considered FRESH (no auto-refetch) after fetching
  gcTime: 5 * 60_000,                                 // how long UNUSED cache entries persist before being GARBAGE COLLECTED
  select: (data) => data.filter((t) => !t.archived),    // TRANSFORM cached data for THIS hook call, cache itself untouched
});
```

### `staleTime` vs `gcTime`: Two Independent Timers, Not One
- **`staleTime`** — how long fetched data is considered "fresh." While fresh, TanStack Query **won't** automatically refetch it (on mount, window focus, reconnect) — it serves the cached data immediately, no network call. Once stale, the data is still shown immediately (never a blocking loading state for already-cached data) but a background refetch is triggered.
- **`gcTime`** (formerly `cacheTime`) — how long a query's cached data persists in memory **after it has no active observers** (no mounted component using that query key) before being garbage collected entirely. This is about **cache retention**, not staleness — a query can be simultaneously "stale" (past its staleTime) yet still fully present in the cache (within its gcTime window).

### `queryKey`: Hierarchical, Serializable Cache Identity
Array-based keys support **partial matching** for cache operations — `invalidateQueries({ queryKey: ['todos'] })` invalidates every query whose key starts with `'todos'`, regardless of what filter/pagination parameters follow it in the array. This hierarchical structure is what makes broad ("invalidate everything todo-related") vs narrow ("invalidate only this specific filtered view") invalidation both possible from the same key structure.

### `select`: Transforming Without Mutating the Cache
`select` derives a transformed view of the cached data **without** altering what's actually stored in the cache — useful when different components need different projections of the same underlying cached data (one needs the full list, another needs just a count) without each maintaining its own separate cache entry. ⚠️ **How often `select` re-runs is not stated on any documentation page checked for this validation pass** — treat it as potentially running on every render of every consumer, keep it pure and cheap, and never put a fetch, a `Date.now()`, or anything order-dependent inside it.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Dashboard Widget Refetching Far More Often Than Necessary, Fixed by Correctly Distinguishing `staleTime` From `gcTime`.
A dashboard widget was refetching its data on every single window focus, even though the underlying data only changed a few times per day — the team had left `staleTime` at its default of `0` (meaning data is considered stale immediately after fetching), triggering a background refetch on every focus event even though nothing had actually changed. Setting a `staleTime` of several minutes (matching how often the underlying data genuinely updated) eliminated the unnecessary refetches, while `gcTime` (left at its default) continued to govern how long unused data stayed cached — the two settings addressed two genuinely different concerns, and conflating them had led to tuning the wrong knob entirely at first.

---

## 3. Production-Grade Code Example

```typescript
// Hierarchical query keys enabling both broad and narrow invalidation
function useTodos(filters: { status: string }) {
  return useQuery({
    queryKey: ['todos', 'list', filters], // hierarchical: ['todos'] → ['todos', 'list'] → ['todos', 'list', filters]
    queryFn: () => fetchTodos(filters),
    staleTime: 30_000, // fresh for 30s — no refetch on focus/mount within that window
  });
}

function useTodoDetail(id: string) {
  return useQuery({
    queryKey: ['todos', 'detail', id],
    queryFn: () => fetchTodoById(id),
    enabled: !!id, // skip entirely if id isn't available yet — a genuinely lazy/conditional query
  });
}
```

```typescript
// select — deriving different projections of the SAME cached data, without separate cache entries
function useTodoCount() {
  return useQuery({
    queryKey: ['todos', 'list', {}],
    queryFn: () => fetchTodos({}),
    select: (data) => data.length, // this hook only cares about the COUNT, not the full list
  });
}

function useActiveTodos() {
  return useQuery({
    queryKey: ['todos', 'list', {}], // SAME queryKey — shares the underlying cache entry with useTodoCount
    queryFn: () => fetchTodos({}),
    select: (data) => data.filter((t) => !t.completed),
  });
}
```

```typescript
// staleTime tuned to match how often the underlying data ACTUALLY changes
function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: fetchDashboardMetrics,
    staleTime: 5 * 60 * 1000, // this data updates a few times/day — 5 minutes of freshness avoids over-fetching
    gcTime: 30 * 60 * 1000, // keep it cached for 30 min after last use, even if unmounted temporarily
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Confusing `staleTime` and `gcTime` as the Same Concept
```typescript
// ❌ WRONG MENTAL MODEL: "increasing gcTime will stop it from refetching so often" —
// gcTime controls CACHE RETENTION after unmount, NOT refetch frequency
useQuery({ queryKey: ['data'], queryFn: fetchData, gcTime: 60 * 60 * 1000 }); // doesn't affect refetch-on-focus AT ALL

// ✅ CORRECT: staleTime is what actually controls "how often does this refetch automatically"
useQuery({ queryKey: ['data'], queryFn: fetchData, staleTime: 60 * 1000 });
```

### ⚠️ Pitfall 2: Using an Unserializable or Unstable `queryKey`
```typescript
// ❌ WRONG: the docs require a key that is serializable with JSON.stringify — and a function
// is not. JSON.stringify DROPS function-valued properties, so this key does NOT change every
// render; it hashes as if you had written ['todos', {}]. The failure is silent COLLISION, not
// a refetch loop: every variant of this key lands on ONE cache entry, and the parameter you
// believed you were keying on is invisible to the cache.
useQuery({ queryKey: ['todos', { onLoad: () => console.log('loaded') }], queryFn: fetchTodos });

// ❌ SAME CLASS, easier to hit: an undefined-valued field is also dropped by JSON.stringify,
// so this collides with ['todos', {}] too — a filter that is not yet chosen silently shares
// a cache entry with "no filter at all"
useQuery({ queryKey: ['todos', { status: undefined }], queryFn: fetchTodos });

// ✅ CORRECT: queryKey holds ONLY JSON-serializable data parameters
useQuery({ queryKey: ['todos', { status: 'active' }], queryFn: fetchTodos });
// Recreating that object literal on every render is FINE — keys are hashed by value, never
// compared by reference. This is one of the few places in React where a fresh literal is safe.
```

### ⚠️ Pitfall 3: Forgetting `enabled: false` Still Returns a Query Object, Just Without Fetching
```typescript
// ❌ MISUNDERSTANDING: enabled: false doesn't mean "this hook returns nothing" — it still
// returns the FULL query result object (status, data, etc.), just with NO fetch ever triggered
// and status typically remaining 'pending' indefinitely until enabled becomes true
const { data, status } = useQuery({ queryKey: ['user', userId], queryFn: fetchUser, enabled: !!userId });
// if userId is initially undefined, status is 'pending' but NO actual loading is happening —
// don't show a loading SPINNER based on status alone without also checking `enabled`'s condition

// ✅ CORRECT: distinguish "genuinely loading" from "disabled and waiting for a precondition"
if (!userId) return null; // don't render a loading state for a query that isn't even enabled yet
if (status === 'pending') return <Spinner />;
```

---

## Gotchas

**★ `staleTime` and `gcTime` are two clocks measuring two different things, and only one of them
answers "why does this keep refetching".** `staleTime` is about *freshness* — how long the library
will serve the cached value without going back to the network. `gcTime` is about *existence* — how
long the entry survives after nothing is observing it. Raising `gcTime` to stop refetching does
nothing at all, because a cached-and-stale query is still a cached query and still refetches on its
next trigger.

**★ The default is stale-immediately.** *"Query instances via `useQuery` or `useInfiniteQuery` by
default consider cached data as stale."* Which means the default `staleTime` is `0`, and the Advanced
Server Rendering guide says as much from the other direction: *"With SSR, we usually want to set some
default staleTime above 0 to avoid refetching immediately on the client"*. Out of the box, every
mount, every window focus and every reconnect fires a request: *"Stale queries are refetched
automatically in the background when: New instances of the query mount, The window is refocused, The
network is reconnected"*.

**★ `gcTime` defaults to five minutes and does not start counting until the query is unused.** The
migration guide is explicit about the semantics the old name hid: *"`cacheTime` does nothing as long
as a query is still in use. It only kicks in as soon as the query becomes unused."* Keep a component
mounted for an hour and nothing is collected. Unmount the last observer and you have five minutes —
*"By default, 'inactive' queries are garbage collected after 5 minutes"* — before the next visit is a
cold fetch.

**★ `gcTime` shorter than `staleTime` mostly cancels itself.** If data is fresh for ten minutes but
evicted two minutes after unmount, then a user who navigates away and back at minute three gets a
hard `pending` state with a spinner, and the generous `staleTime` bought nothing. When you raise
`staleTime` to make navigation feel instant, raise `gcTime` to at least match it.

**★ `staleTime: Infinity` is not "cache forever".** It only means "never refetch on the usual
triggers". The entry is still garbage-collected once unused, still evicted by `removeQueries`, still
replaced by an explicit `invalidateQueries` — the invalidation guide notes that the stale mark *"overrides
any `staleTime` configurations"*. `staleTime: Infinity` plus a short `gcTime` is a query that never
refreshes while you look at it and always refetches when you come back.

**★ A query key must survive `JSON.stringify`, and the docs say so in one sentence.** *"As long as
the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use
it!"* Functions, class instances, `Map`, `Set` and `undefined`-valued properties all vanish or mangle
under that rule, and the result is never an error — it is two logically different queries quietly
sharing one entry.

**★ Object property order in a key is irrelevant; array position is not.** *"no matter the order of
keys in objects, all of the following queries are considered equal"* — so `{ status, page }` and
`{ page, status }` are the same query. But *"Array item order matters!"*: `['todos', status, page]`
and `['todos', page, status]` are two different queries and, worse, two different *prefixes*, so a
partial invalidation aimed at one will miss the other. Fix the array shape once, in a key factory, and
never hand-write a key at a call site.

**★ The `queryFn` is not part of the query's identity — the key is.** The docs require the key to be
*"unique to the query's data"* and say nothing about the function, because the function is not part
of what identifies the entry. Two hooks with the same key and different fetchers therefore share one
cache entry, and which fetcher populated it is decided by whichever mounted first. This is not
detectable by TypeScript and produces a bug that only appears in the mount order of one route.

**★ `enabled: false` does not mean "no query" — it means a query in `pending` that will never
resolve.** The hook still returns a full result object, `status` is `'pending'`, and `data` is
`undefined` indefinitely. What tells the two apart is `fetchStatus`: a disabled query is `'idle'`, a
genuinely loading one is `'fetching'`. That is why `isLoading` — defined in v5 as *"`isPending &&
isFetching`"* — is the flag to gate a spinner on, and `isPending` is not.

**★ `select` gives you a projection, not a second cache entry.** Two hooks on the same key with
different `select` functions still share one entry and one network request; the transform runs on the
way out. The corollary is the constraint: `select` must be a pure function of `data`, because the
library may call it whenever it likes and the result is not stored anywhere you can inspect.

**★ Setting `enabled` from a value that starts `undefined` gives you a spinner with nothing behind
it.** `enabled: !!userId` is correct, but a component that renders a spinner on `isPending` will spin
forever while `userId` is still resolving. Gate the render on the precondition first, and only then
on the query's own state.

## Interview questions

**★ Explain `staleTime` and `gcTime` to someone who thinks both mean "how long data is cached".**
They are not two settings for the same thing; they answer different questions about different phases
of an entry's life. `staleTime` answers "for how long will you serve this without asking the server
again?" — while it is fresh, a mount or a window focus is a cache hit with no network call at all;
once it is stale, the same triggers show the cached value *and* fire a background refetch. `gcTime`
answers "once nothing on screen is using this any more, how long before you throw it away?" — it does
not start until the last observer unmounts, and it has no effect whatsoever while a component is
mounted. So a query can be stale and cached (past `staleTime`, still in memory), fresh and evicted is
impossible, and the setting you reach for when something refetches too often is always `staleTime`.

**★ Why did v5 rename `cacheTime` to `gcTime`?**
Because the old name described the wrong thing and everyone read it the wrong way. The migration
guide says so directly: *"Almost everyone gets `cacheTime` wrong. It sounds like 'the amount of time
that data is cached for', but that is not correct."* The value never governs how long data is cached
while in use — *"`cacheTime` does nothing as long as a query is still in use. It only kicks in as
soon as the query becomes unused."* `gcTime` names the actual mechanism, garbage collection of
inactive entries, and stops people from reaching for it when they mean `staleTime`.

**★ Your query key is `['todos', { page, status }]` and that object literal is rebuilt on every
render. Is the query stable?**
Yes. Keys are hashed, not compared by reference — *"Query Keys are hashed deterministically!"* — so a
structurally identical object produces an identical hash however many times you construct it. The
property order inside the object does not matter either. What would break stability is a value that
does not survive `JSON.stringify`, or a change in the *array's* item order, since *"Array item order
matters!"*.

**★ What actually goes wrong if you put a callback in a query key?**
Not what most people expect. `JSON.stringify` omits function-valued properties, so the function is
simply erased from the hash: the key is not unstable, it is *under-specified*. Every call site that
differs only in that function collapses onto one cache entry, one component's data is served to
another, and nothing anywhere throws. The rule in the docs — the key must be *"serializable using
`JSON.stringify`, and unique to the query's data"* — is doing two jobs in one sentence, and this is
the failure of the second half.

**★ A query has `enabled: false`. What does each flag read, and which one should gate the spinner?**
`status` is `'pending'` and `isPending` is `true`, because there is no data. `fetchStatus` is
`'idle'` and `isFetching` is `false`, because nothing is running. `isLoading`, which v5 defines as
`isPending && isFetching`, is therefore `false` — and that is the flag you want, because it is the
only one that distinguishes "no data and working on it" from "no data and not even trying". Gating a
full-page spinner on `isPending` gives you a spinner that never stops on any disabled query.

**★ Two components need the same list — one renders it filtered, the other renders only its length.
How many cache entries, how many requests, and how do you write it?**
One entry and one request, provided both use the same `queryKey`. Give each hook its own `select` —
one returning `data.filter(...)`, the other returning `data.length` — and the transform happens per
consumer while the cached array stays untouched. The mistake to avoid is giving the count its own key
like `['todos', 'count']`, which buys a second entry, a second request and two things that can now
disagree with each other.

**★ When would you set `staleTime: Infinity`, and what still expires?**
For data that genuinely cannot change for the lifetime of the session — a currency list, a country
list, a feature-flag snapshot taken at login, an immutable versioned document. What still expires is
existence: `gcTime` still evicts the entry once no component observes it, so on returning to the
screen you refetch anyway unless you raise `gcTime` to match. An explicit `invalidateQueries` also
still wins, because the stale mark *"overrides any `staleTime` configurations"*.

**★ You inherit a page that refetches on every tab focus and the API owner is complaining. Walk
through the diagnosis.**
Start from the default, because the default is the cause: cached data is considered stale
immediately, and a window refocus is one of the three documented refetch triggers. So the question is
not "how do I turn refetching off" but "how long is this data actually valid for?" — answer that from
the domain (a metrics rollup recomputed hourly is valid for minutes; a chat thread is valid for
seconds) and set `staleTime` to it. Only if the data is genuinely never worth refreshing on focus do
you reach for `refetchOnWindowFocus: false`, and you should prefer `staleTime` because it also
suppresses the redundant refetch on remount and reconnect, which the focus flag does not.
