---
title: "type, stale, fetchStatus and predicate select queries by their state rather than their identity, and type is the field that decides what happens to the queries nobody is watching"
sidebar_label: "01c · Filtering by state"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🔎 Filtering by State: `type`, `stale`, `fetchStatus` and `predicate`

**The key half of a filter says *which data*; this half says *which situation*. `type` is the one that decides whether a call touches the screen the user is looking at, the screens behind it, or both — and it is the difference between an invalidation that costs one request and one that costs forty.**

## 1. `type: 'active' | 'inactive' | 'all'`

`type` filters on whether a query currently has an observer — whether some mounted component is
subscribed to it through `useQuery` or a related hook. The invalidation guide's description of the
refetch half of invalidation is the load-bearing quote:

> *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*

⚠️ The Filters guide says only *"When set to `active` it will match active queries"* and *"When set
to `inactive` it will match inactive queries"*; it does not print a definition of "active". "Has at
least one mounted observer" is the standard reading and is consistent with the sentence above and
with Important Defaults' *"By default, 'inactive' queries are garbage collected after 5 minutes"*,
but it is **derived, not quoted** — do not offer it to an interviewer as a documentation quote.

The three settings buy three different behaviours:

```ts
// 'all' (the default): mark everything todo-related stale; refetch the mounted ones now.
queryClient.invalidateQueries({ queryKey: ['todos'] });

// 'active': touch only what is on screen. Backgrounded routes keep their cached data
// AND their fresh/stale flag — they will NOT refetch on their next mount.
queryClient.invalidateQueries({ queryKey: ['todos'], type: 'active' });

// 'inactive': the opposite — leave the visible screen completely alone, and pre-stale
// everything behind it so the next mount refetches. No request is issued now.
queryClient.invalidateQueries({ queryKey: ['todos'], type: 'inactive' });
```

`type: 'inactive'` is the honest way to express "the user will see this later, and it must be
correct when they do" without paying for a request while they are elsewhere. It is also the safe
filter for `removeQueries` — dropping an *active* query's entry yanks data out from under a mounted
component (see [01d](./01d-invalidate-refetch-reset-remove.md)).

`type: 'active'` has a narrower but real use: a poll or a focus handler that must not touch the
long tail of the cache. Combine it with `stale: true` and you have "refresh what is on screen and
overdue", which is the cheapest correct refresh in the library.

## 2. `stale` and `fetchStatus` — two different axes, routinely conflated

`stale: true` matches only queries the client already considers out of date; `stale: false` matches
only fresh ones. `fetchStatus` matches on the *other* axis the Queries guide draws:

> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*

and the guide adds why the two must be independent:

> *"Background refetches and stale-while-revalidate logic make all combinations"*

```ts
// A "Refresh" control that only re-requests what is genuinely out of date.
queryClient.refetchQueries({ type: 'active', stale: true });

// A global spinner, driven by the same filter grammar.
const backgroundFetches = useIsFetching({ queryKey: ['reports'] });

// Everything that wanted to run but is parked because the app is offline.
const paused = queryClient.getQueryCache().findAll({ fetchStatus: 'paused' });
```

`fetchStatus: 'paused'` deserves a note. The docs describe `paused` as matching *"queries that
wanted to fetch, but have been `paused`"* — a query can want to fetch and be unable to, and that
state is invisible to `status`, which still reports `success` with the old data. Filtering on it is
how you build a "waiting for network" banner without tracking connectivity yourself, and how you
find the queries that will stampede the moment the connection returns.

`fetchStatus: 'fetching'` combined with `cancelQueries` is the precise form of "stop what is in
flight for this entity and nothing else" — it skips the queries that are idle, which
`cancelQueries` would otherwise walk and no-op on.

## 3. `predicate` — the escape hatch, and its type

`predicate` receives each `Query` instance and returns a boolean. The invalidation guide describes
the same mechanism from the other side:

> *"you can pass a predicate function to the `invalidateQueries` method. This function will receive each `Query` instance from the query cache and allow you to return `true` or `false` for whether you want to invalidate that query"*

and the Filters guide fixes its position in the pipeline:

> *"This predicate function will be used as a final filter on all matching queries."*

It is the only filter that can look *inside* the key at an arbitrary position, or at the cached
value itself:

```ts
// "Every cached todo list whose filters mention this project" — no prefix expresses this,
// because projectId lives at index 2 behind a discriminator we do not want to pin.
queryClient.invalidateQueries({
  queryKey: ['todos'],
  predicate: (query) => {
    const [, scope, params] = query.queryKey as [string, string, { projectId?: string }?];
    return scope === 'list' && params?.projectId === projectId;
  },
});

// Looking at the DATA, not the key. query.state.data is `unknown` — narrow it yourself.
queryClient.removeQueries({
  queryKey: ['todos', 'detail'],
  predicate: (query) => (query.state.data as Todo | undefined)?.archived === true,
});
```

The cost is that a bare `predicate` with no `queryKey` is evaluated against every query in the
cache on every call, and that it has no static relationship to your key schema — rename a segment
and a prefix filter breaks loudly at the call site while a positional predicate silently matches
nothing.

## 4. Mutation filters are the same idea with four fields

> *"A mutation filter is an object with certain conditions to match a mutation with."*
> *"**mutationKey**: Set this property to define a mutation key to match on."*
> *"**exact**: If you don't want to search mutations inclusively by mutation key, you can pass the `exact: true` option to return only the mutation with the exact mutation key you have passed."*
> *"**status**: Allows for filtering mutations according to their status."*
> *"**predicate**: This predicate function will be used as a final filter on all matching mutations."*

That is what `useIsMutating({ mutationKey: ['todos'] })` and
`queryClient.getMutationCache().findAll({ status: 'pending' })` are parsing. Note the fields that
are *missing*: there is no `type` and no `stale`, because a mutation has no observer-vs-cache-entry
distinction and no freshness — it runs once and settles. `status` is the mutation's own
`'idle' | 'pending' | 'error' | 'success'`, not a query status.

The practical use is gating: a save button that is disabled while any mutation under
`['invoice', invoiceId]` is pending, or a navigation guard that refuses to leave while
`useIsMutating() > 0`.

## Gotchas

**★ When a prefix is too broad and an exact key is too narrow, the answer is `predicate`.** The guide
documents all three levels: prefix by default, `exact: true` to *"match only queries with no
additional subkeys"*, and — *"you can pass a predicate function to the `invalidateQueries` method.
This function will receive each `Query` instance from the query cache and allow you to return `true`
or `false` for whether you want to invalidate that query"*. Use the predicate for "every todo list
whose filter mentions this project", which no prefix can express.

**★ Symptom: you passed `queryKey` *and* `predicate` and the predicate never sees the query you were
debugging.** Cause: the fields are ANDed and the predicate is *"a final filter on all matching
queries"* — it runs on the survivors of the key filter, not on the cache. Fix: while debugging, drop
the `queryKey` and log from inside the predicate to see the real candidate set; put the key back
afterwards, because a bare predicate is evaluated against every query in the cache on every call.

**★ Symptom: `type: 'active'` skipped a component that was definitely rendered.** Cause: "active"
tracks *observers*, not pixels. A query whose hook is mounted but disabled has no fetch to trigger;
a query whose component unmounted one frame ago has already dropped its observer even though the
DOM has not settled; a suspended tree has not mounted its hooks yet at all. Fix: do not use
`type: 'active'` as a proxy for visibility. If the requirement is "correct when they come back",
`type: 'inactive'` or the default `'all'` expresses it exactly, and the mount-time refetch of a
stale query does the work for free.

**★ Symptom: a `predicate` reading `query.state.data.items` throws.** Cause: `state.data` is
`unknown` at that boundary, and it is also `undefined` for every query in the cache that has not
resolved yet — including ones your key filter happily matched. Fix: narrow with a cast *and* an
optional chain: `(query.state.data as Todo[] | undefined)?.length`. A predicate that throws takes
the whole `invalidateQueries` call down with it, so every query after the bad one is silently
skipped and you get a partial invalidation that looks like a matching bug.

**★ Symptom: you filtered `stale: true` to avoid extra requests and the refresh button stopped
working.** Cause: `stale: false` matches *fresh* queries, and with a generous `staleTime` almost
everything is fresh — so `refetchQueries({ stale: true })` after a mutation refetches nothing.
Fix: for "the server changed, I know it", use `invalidateQueries`, whose stale marking
*"overrides any `staleTime` configurations being used in `useQuery` or related hooks"*. Reserve
`stale: true` for opportunistic sweeps, such as a focus handler that refreshes only what has
already expired.

**★ Symptom: `fetchStatus: 'fetching'` matches nothing while the UI clearly shows a spinner.**
Cause: your spinner is driven by `isPending` — the *data* axis — and the query has no data because
it has never resolved, while its `queryFn` is genuinely not running: it is `paused` because the app
is offline, or the query is disabled. The guide keeps the axes apart on purpose — *"The status
gives information about the data… The fetchStatus gives information about the queryFn"* — and notes
that *"Background refetches and stale-while-revalidate logic make all combinations"* reachable.
Fix: match `fetchStatus: 'paused'` for the offline case, and drive "is anything in flight" UI from
`useIsFetching` rather than from any single query's `isPending`.

**★ Symptom: `type: 'active'` invalidation left a route permanently stale-free, so returning to it
shows month-old data.** Cause: `type: 'active'` does not just skip the refetch for inactive
matches, it skips the *stale marking* too. Those queries keep whatever freshness they had, so the
mount that would normally refetch a stale query finds a fresh one and does nothing. Fix: use the
default `type: 'all'` unless you have a specific reason not to. `'active'` is an optimisation for
polls and focus handlers, not a general-purpose "be gentle" flag.

**★ Symptom: `useIsMutating()` never returns to zero.** Cause: it counts every mutation in the
mutation cache matching the filter, and a mutation observer that is still mounted holds its
`error` or `success` result; a stuck `pending` usually means a `mutationFn` whose promise never
settles — an `await` on a request with no timeout, or a `mutateAsync` rejection nobody caught that
left the component unmounted mid-flight. Fix: filter it — `useIsMutating({ status: 'pending' })`
plus a `mutationKey` — and put a timeout in the mutation function. A navigation guard wired to an
unfiltered `useIsMutating()` locks the user in the page.

## Interview questions

**★ You want a mutation to refresh a background tab without issuing a request now. Which filter?**
`type: 'inactive'`. Invalidation of an inactive match marks it stale and stops there — no observer
means nothing to refetch into — and the mount that happens when the user returns to that tab is
itself a refetch trigger for a stale query. The result is exactly the wanted behaviour: zero network
cost while the tab is hidden, guaranteed-fresh data the instant it is visible. Reaching for
`refetchQueries` here would fetch data for a screen nobody is looking at, and reaching for
`removeQueries` would replace a fast stale-while-revalidate render with a loading spinner.

**★ What is the difference between `type: 'inactive'` and `stale: true`?**
They filter on different axes and are routinely confused because both correlate with "not currently
being looked at". `type` is about *observers*: does a mounted hook subscribe to this query right
now? `stale` is about *freshness*: has this query's data passed its `staleTime`? An active query can
be stale (it is on screen and overdue for a refetch) and an inactive query can be fresh (nobody is
watching, but it was fetched two seconds ago). Filtering `{ type: 'inactive', stale: true }` means
"unobserved *and* already expired", which is a much smaller set than either field alone.

**★ Why does `predicate` exist when you can already match by prefix and by exact key?**
Because both of those are constrained to the *front* of the key array, and real invalidation
requirements are not. "Every cached page of every list whose filter object mentions project 42"
involves a value at index 2 behind a discriminator at index 1, which no prefix reaches. `predicate`
also gets the whole `Query` instance, so it can filter on cached content or on state that is not in
the key at all. The trade is static safety: a prefix filter is checked against your key factory at
compile time if you type it, while a positional predicate reading `query.queryKey[2]` silently
matches nothing the day someone inserts a segment.

**★ `status` and `fetchStatus` — why are there two, and how does that show up in a filter?**
Because they answer questions that are genuinely independent: *"The status gives information about
the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running
or not?"*, and *"Background refetches and stale-while-revalidate logic make all combinations"*. A
query showing cached data while refetching is `status: 'success'` and `fetchStatus: 'fetching'`; a
first load with no network is `status: 'pending'` and `fetchStatus: 'paused'`. In a filter that
means `stale` and `fetchStatus` are not substitutes — `stale: true` finds what *should* refetch,
`fetchStatus: 'fetching'` finds what *is* refetching, and `fetchStatus: 'paused'` finds what
*cannot*.

**★ How would you build a "you have unsaved changes" navigation guard with the mutation filter API?**
`useIsMutating({ mutationKey: ['draft', draftId], status: 'pending' })`, and block navigation while
it is above zero. The mutation filter grammar is deliberately smaller than the query one —
`mutationKey`, `exact`, `status`, `predicate` — because mutations have no observers and no
freshness. The two mistakes are leaving the filter off, which counts every mutation in the app and
can trap the user behind an unrelated in-flight request, and leaving `status` off, which counts
settled mutations that are still held by a mounted observer and therefore never returns to zero.

---

← [Query filters: the key axis](./01b-query-filters-the-matching-surface.md) · [Topic index](../README.md) · Next → [Invalidate vs refetch vs reset vs remove](./01d-invalidate-refetch-reset-remove.md)
