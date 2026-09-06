---
title: "Query States: `status` vs `fetchStatus` & the Loading Flag Family"
sidebar_label: "Query States"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the TanStack Query docs — [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) (the `status` / `fetchStatus` definitions are quoted verbatim below), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🔄 Query States: `status` vs `fetchStatus` & the Loading Flag Family

## 1. Under-The-Hood Mechanics

TanStack Query tracks **two independent state dimensions** simultaneously — whether data is available at all, and whether a network request is currently active — a distinction that resolves most confusion about which loading flag to actually check.

```
status: 'pending' | 'error' | 'success'      ──► DATA AVAILABILITY: do we have usable data (or an error) at all?
fetchStatus: 'fetching' | 'paused' | 'idle'     ──► NETWORK ACTIVITY: is a request CURRENTLY in flight right now?

These are INDEPENDENT axes — all four combinations are meaningful:
  status: 'success', fetchStatus: 'idle'       ──► have data, nothing currently fetching (the common resting state)
  status: 'success', fetchStatus: 'fetching'      ──► have (POSSIBLY STALE) data, a BACKGROUND refetch is in progress
  status: 'pending', fetchStatus: 'fetching'         ──► the FIRST-EVER load — no data yet, actively fetching
  status: 'pending', fetchStatus: 'paused'              ──► no data yet, fetch is PAUSED (e.g. offline, no network)
```

### The Derived Boolean Flags: Each Answers a Different Question
- **`isPending`** — `status === 'pending'` — true only when there's genuinely no data yet (first load, or a reset cache).
- **`isFetching`** — `fetchStatus === 'fetching'` — true for ANY active fetch, including background refetches of already-cached data.
- **`isLoading`** — a convenience combination: `isPending && isFetching` — specifically "the FIRST load, actively in flight" — the correct flag for "show a full-page loading spinner," since it excludes background refetches of data already being displayed.
- **`isPlaceholderData`** — true when currently-displayed data is placeholder/previous data shown while the REAL data for a new query key is being fetched (see the [pagination doc](../07-pagination-and-infinite-queries/01-paged-data-patterns.md)). 🔴 In v5 the way you ask for this is `placeholderData: keepPreviousData`, importing `keepPreviousData` as a **function** — the v4 boolean option `keepPreviousData: true` was removed.
- **`isStale`** — whether the current data has passed its `staleTime` window — informational, rarely needed directly in UI logic, but useful for debugging/devtools inspection.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Full-Page Loading Spinner Flashing Unnecessarily on Every Background Refetch.
A page checked `isFetching` to decide whether to show a full-page loading spinner — but `isFetching` is `true` for **any** active fetch, including routine background refetches triggered by window-focus refetching of data the page was already displaying correctly. Every time a user switched back to the tab, the page would flash its loading spinner over perfectly good, already-visible data, purely because a background refresh had started. Switching the spinner's condition to `isLoading` (which specifically means "no data yet AND actively fetching") fixed this — background refetches of already-cached data no longer triggered the disruptive full-page spinner, since `isPending` was correctly `false` once initial data existed.

---

## 3. Production-Grade Code Example

```tsx
// Correctly distinguishing "first load" from "background refetch" for UI treatment
function ProductList() {
  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (isLoading) return <FullPageSpinner />; // ONLY the genuine first-load case — no data exists yet at all
  if (isError) return <ErrorBanner message={error.message} />;

  return (
    <div>
      {isFetching && <RefreshIndicator />} {/* a SMALL, non-disruptive indicator for background refetches */}
      <ul>{data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
    </div>
  );
}
```

```tsx
// Distinguishing status from fetchStatus explicitly, for a nuanced offline-aware UI
function OfflineAwareWidget() {
  const { status, fetchStatus, data } = useQuery({ queryKey: ['metrics'], queryFn: fetchMetrics });

  if (status === 'pending' && fetchStatus === 'paused') {
    return <OfflineMessage />; // no data yet, AND the fetch itself is paused (offline) — a distinct state from "loading"
  }
  if (status === 'pending') return <Spinner />;
  if (status === 'error') return <ErrorMessage />;

  return <MetricsView data={data} isRefreshing={fetchStatus === 'fetching'} />;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `isFetching` Where `isLoading` Was Actually Needed
```tsx
// ❌ WRONG: isFetching is true for background refetches TOO — shows a disruptive full-page
// spinner even when perfectly good data is already being displayed to the user
if (isFetching) return <FullPageSpinner />; // flashes on EVERY background refetch

// ✅ CORRECT: isLoading specifically means "no data yet, first load in progress"
if (isLoading) return <FullPageSpinner />;
```

### ⚠️ Pitfall 2: Assuming `status: 'success'` Means "Definitely Fresh, Just-Fetched Data"
```tsx
// ❌ MISUNDERSTANDING: status 'success' just means DATA EXISTS in the cache — it says
// NOTHING about freshness; the data could be minutes/hours stale, still sitting in cache
// waiting for its next background refetch trigger
if (status === 'success') { /* assumes this is CURRENT — not necessarily true */ }

// ✅ CORRECT: check isStale (or staleTime configuration) if freshness specifically matters
// to a decision, rather than assuming 'success' implies "just fetched"
```

### ⚠️ Pitfall 3: Not Handling the `pending` + `paused` (Offline) Combination Distinctly
```tsx
// ❌ INCOMPLETE: treating ALL pending states as "loading" conflates a genuinely offline user
// (fetch paused, waiting for connectivity) with an active, in-progress fetch — a confusing
// experience if the loading spinner spins indefinitely with no indication of WHY
if (status === 'pending') return <Spinner />; // spins forever if actually offline, no distinct messaging

// ✅ CORRECT: distinguish the offline/paused case for a more honest, actionable UI state
if (status === 'pending' && fetchStatus === 'paused') return <OfflineMessage />;
if (status === 'pending') return <Spinner />;
```

---

## Gotchas

**★ The two axes answer two different questions, and the docs put it in one sentence.** *"The status
gives information about the data: Do we have any or not? The fetchStatus gives information about the
queryFn: Is it running or not?"* Every flag on the result object is a projection of one of those two
axes or a conjunction of both. When you cannot decide which flag to check, restate your UI condition
as one of those two questions and the flag falls out.

**★ 🔴 `isLoading` in v5 is not `isLoading` from v4, and a copied snippet changes meaning
silently.** The migration guide made two moves at once: *"`status: loading` has been changed to
`status: pending` and `isLoading` has been changed to `isPending`"*, and then *"`isInitialLoading`
has now been renamed to `isLoading`"*, now *"implemented as `isPending && isFetching`"*. So v4's
`isLoading` is v5's `isPending`; v5's `isLoading` is a strictly narrower flag that also requires a
request to be in flight. A v4 snippet pasted into a v5 codebase compiles, type-checks, and quietly
stops rendering the loading branch for disabled and paused queries.

**★ `isPending` is true for a query that is not doing anything and never will.** With
`enabled: false`, or while a dependent query waits on its precondition, `status` is `'pending'`
forever and `fetchStatus` is `'idle'`. A spinner gated on `isPending` spins until the page is
reloaded. `isLoading` is the flag that excludes this case, precisely because it also requires
`isFetching`.

**★ `isFetching` is true for background refetches, which is the whole reason it exists.** *"fetchStatus
=== 'fetching'"* means *"The query is currently fetching"* — first load or twentieth refresh, it does
not distinguish. Use it for a small, non-blocking indicator; using it for a blocking one produces a
spinner that covers perfectly good data every time the user tabs back to the window.

**★ `status: 'success'` is a statement about availability, never about freshness.** It means the
cache has a value. Given that the library *"by default consider[s] cached data as stale"*, the value
behind a `'success'` status may be arbitrarily old. If a decision genuinely depends on recency, it has
to consult `isStale` or the `staleTime` you configured — reading `'success'` as "just fetched" is the
same error as reading a 200 response as "current".

**★ 🔴 An error appears seconds after the request failed, because of the retry default.** *"Queries
that fail are silently retried 3 times, with exponential backoff delay before capturing and
displaying an error to the UI."* Four attempts with growing gaps run before `status` ever becomes
`'error'`, so the observable symptom of a hard 500 is a spinner that hangs, not a red banner. Any bug
report of the form "it just spins" on a broken endpoint is this. Set `retry: false` for endpoints
whose failure is meaningful (a 404 on a detail route), and keep retries for genuinely transient ones.

**★ `fetchStatus: 'paused'` means the library wanted to run and chose not to.** *"The query wanted to
fetch, but it is paused."* Nothing is in flight and nothing is going to be until connectivity
returns, so a spinner here is a lie — it tells the user to wait for something that is not happening.
This is the one combination that deserves its own branch in the UI, and it is the combination almost
every codebase forgets.

**★ `isStale` and `fetchStatus` are unrelated, and invalidation ignores your `staleTime`.** A query
can be stale and idle at the same time — that is the normal resting state of anything past its
freshness window with no trigger yet. And `invalidateQueries` marks a query stale regardless of
configuration: *"This stale state overrides any `staleTime` configurations being used in `useQuery` or
related hooks."* So `isStale` is not derivable from elapsed time alone.

**★ The three-branch guard in the example above is only exhaustive while the query is enabled.**
`if (isLoading) … if (isError) … then render data` is correct for an always-on query, but it has a
fourth path: `isPending && !isFetching` — a disabled or paused query — falls through both guards with
`data` still `undefined`, and the render crashes on the first property access. Either narrow on
`isSuccess` before touching `data`, or return early on the precondition that disabled the query in the
first place.

## Interview questions

**★ Why does TanStack Query expose two state fields instead of one, and what does each answer?**
Because the two questions a UI needs to ask about a query come apart. *"The status gives information
about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it
running or not?"* A single enum cannot represent "I have data from ten minutes ago and I am currently
refreshing it", which is the most common state in a stale-while-revalidate cache and the state that
most one-dimensional loading models render wrong. The docs give the reason for the split explicitly:
*"Background refetches and stale-while-revalidate logic make all combinations"* of the two possible.

**★ Someone upgrades a codebase from v4 to v5 and the loading states start behaving oddly. What is
the most likely single cause?**
`isLoading` changed meaning. In v4, `isLoading` meant "there is no data" — the flag that v5 calls
`isPending`. In v5, `isLoading` is the old `isInitialLoading`, *"implemented as `isPending &&
isFetching`"*. Untouched v4 code therefore keeps compiling but now renders its loading branch only
when a request is actually in flight, so any query that is disabled, waiting on a dependency, or
paused offline falls straight through to the success branch with `data` undefined. The fix is
mechanical but must be done per call site with intent: if you meant "no data yet", the v5 name is
`isPending`; if you meant "first load in flight", keep `isLoading`.

**★ Which flag drives a full-page skeleton, and which drives a small corner spinner?**
The skeleton is gated on `isLoading` — no data exists *and* the first request is in flight, so there
is nothing to show and something is coming. The corner indicator is gated on `isFetching`, which is
true for every fetch including background ones, so it lights up during refreshes of data already on
screen without disturbing it. Swapping them is the single most common query-state bug: `isFetching`
on the skeleton makes the page blink on every window focus, and `isLoading` on the corner indicator
means it never appears when you actually want it.

**★ A user is offline. What do `status` and `fetchStatus` read, and what should the component
render?**
`status` is `'pending'` if nothing was cached, and `fetchStatus` is `'paused'` — *"The query wanted
to fetch, but it is paused"*. Rendering a spinner is wrong, because nothing is in flight and no
amount of waiting changes that; render an offline state with an explanation and, if you have one, a
manual retry. If data *was* cached, `status` is `'success'` with `fetchStatus: 'paused'` — show the
cached data with a "not up to date" marker rather than blocking on it.

**★ An endpoint is returning 500 and the UI just spins for several seconds before showing an error.
Is this a bug?**
It is the documented default doing its job: *"Queries that fail are silently retried 3 times, with
exponential backoff delay before capturing and displaying an error to the UI."* Four attempts must
fail before `status` becomes `'error'`, and the backoff makes the last gaps the longest. It is a
product bug rather than a library bug, and the fix is to make the retry policy match the semantics of
the failure — no retries for a 4xx that will never succeed, retries for a timeout or a 502 — usually
via a `retry` predicate that inspects the error's status code rather than a flat number.

**★ Can a query be `success`, `stale` and `idle` simultaneously? What is that state?**
Yes, and it is the most common state in the whole system: data is present, its freshness window has
elapsed, and no refetch trigger has fired yet. That is exactly what a stale-while-revalidate cache
looks like at rest. It is also why `status === 'success'` cannot be read as "current" and why
`isStale` is informational rather than something to branch a spinner on — the next mount, focus or
reconnect will move it to `fetching` while still reading `success`.

**★ A colleague gates their render on `isLoading` and `isError` and then reads `data.items`. When
does that crash?**
When the query is not enabled — or is paused — at the moment of render. Both guards are false
(`isLoading` requires `isFetching`; `isError` requires a settled failure) while `status` is still
`'pending'` and `data` is `undefined`. The safe shapes are to narrow positively on `isSuccess` before
touching `data`, or to return early on whatever precondition set `enabled` to false, so the query's
own states are only consulted once the query is actually allowed to run.
