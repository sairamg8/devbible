---
title: "Every cache method takes the same filter object, and the key half of it — queryKey and exact — decides which queries you hit before any other field is consulted"
sidebar_label: "01b · Query filters: the key axis"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🎯 Query Filters: The One Argument Shape Behind Every Cache Method

**`invalidateQueries`, `refetchQueries`, `cancelQueries`, `removeQueries`, `resetQueries`, `getQueriesData`, `setQueriesData` and `useIsFetching` do not each have their own argument grammar — they all take the same object, and the docs give it a name: *"A query filter is an object with certain conditions to match a query with."* Learn the six fields once and every one of those methods becomes precise instead of approximate. This page covers the two fields that select by identity; [01c](./01c-filtering-by-state-type-stale-predicate.md) covers the four that select by state.**

## 1. The six fields, verbatim

From the Filters guide, in the guide's own words:

> *"**queryKey**: Set this property to define a query key to match on."*
> *"**exact**: If you don't want to search queries inclusively by query key, you can pass the `exact: true` option to return only the query with the exact query key you have passed."*
> *"**type**: … When set to `active` it will match active queries. When set to `inactive` it will match inactive queries."* — the guide states it *"Defaults to `all`"*.
> *"**stale**: When set to `true` it will match stale queries. When set to `false` it will match fresh queries."*
> *"**fetchStatus**: … When set to `fetching` it will match queries that are currently fetching. When set to `paused` it will match queries that wanted to fetch, but have been `paused`. When set to `idle` it will match queries that are not fetching."*
> *"**predicate**: This predicate function will be used as a final filter on all matching queries."*

Two things fall straight out of that last sentence and they are the ones people get wrong.
**Fields combine as AND**, not OR — every condition you name has to hold. And **`predicate` runs
*last*, on what the cheap structural fields already narrowed** — so a `predicate` paired with a
`queryKey` never sees the queries the key excluded, and a `predicate` on its own is asked about
every query in the cache.

```ts
// AND, not OR: active queries under ['todos'] that are ALSO currently stale.
queryClient.invalidateQueries({ queryKey: ['todos'], type: 'active', stale: true });
```

## 2. `queryKey` is a prefix, and prefixes are positional

The default match is *inclusive*: `{ queryKey: ['todos'] }` matches `['todos']`,
`['todos', 'list', { status: 'active' }]` and `['todos', 'detail', '123']`, because each of those
arrays *starts with* `'todos'`. That is the whole reason a hierarchical key pays off — one call
after a mutation refreshes every view built on that entity, including views that did not exist when
the mutation was written.

Inside the key, the two halves of the equality rule are asymmetric and the docs say both out loud:

> *"no matter the order of keys in objects, all of the following queries are considered equal"*
> *"Array item order matters!"*

So `{ status: 'done', page: 2 }` and `{ page: 2, status: 'done' }` are the same query — keys are
*"hashed deterministically!"* — but `['todos', 'list']` and `['list', 'todos']` are two unrelated
queries that no single prefix can reach together. Segment order is a schema decision, which is why
**key factories** *(not written yet)* exist.

The serialisation rule bounds what may appear in a key at all:

> *"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use it!"*

Both halves are requirements. A `Date` serialises, so it is legal — but two `Date` objects a
millisecond apart produce different keys and therefore different cache entries, which is usually not
what the caller meant. A `Map`, a `Set` or a class instance stringifies to `{}`, so every distinct
value collapses onto the *same* key and two different queries quietly share one cache entry.

## 3. `exact: true` — matching one query and nothing under it

`exact: true` turns the prefix into an equality test on the whole key. `['todos', 'list']` with
`exact: true` no longer matches `['todos', 'list', { page: 2 }]`; the invalidation guide describes
the same option as matching *"only queries with no additional subkeys"*.

```ts
// Refresh ONLY the unfiltered list. Page 2, page 3 and every filtered variant keep their data.
queryClient.invalidateQueries({ queryKey: ['todos', 'list'], exact: true });

// Without exact, this is the broad form — every paged and filtered list under the prefix.
queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
```

Use `exact` when the extra segments identify *genuinely different server resources* that your
mutation did not touch — a per-user settings blob under `['settings', userId]`, say, where
invalidating one user's entry must not disturb another's in a support tool that has several loaded.

Do not reach for it to "avoid extra requests". Invalidating an unobserved match costs nothing at
the moment it is issued (see [01d](./01d-invalidate-refetch-reset-remove.md)), so `exact: true`
more often buys you a stale screen behind a tab than a saved round trip.

## 4. `exact` is also what makes a direct write addressable

The key-and-exact pair is not only for invalidation. It is the difference between the singular and
plural cache accessors:

```ts
// Singular: an EXACT key, always. There is no prefix semantics here — this is one entry.
queryClient.setQueryData(['todos', 'detail', id], next);

// Plural: a FILTER. Every entry the filter matches is rewritten, and you get back
// [queryKey, data] pairs for each one.
queryClient.setQueriesData({ queryKey: ['todos', 'list'] }, (old) => /* … */ old);
```

`setQueryData` and `getQueryData` take a *query key*, not a filter — passing them
`{ queryKey: [...] }` is a type error in TypeScript and a silent miss in JavaScript, because the
object gets hashed as a key and matches nothing you own. `getQueriesData` and `setQueriesData` are
the ones that take the filter object described on this page. That surface is covered in
[01e](./01e-direct-cache-access.md).

## Gotchas

**★ Prefix matching is positional, and that makes key shape a design decision.** `['todos']` matches
`['todos', 'list', {…}]` and `['todos', 'detail', '123']` because it is a *prefix of the array*. It
does not match `['list', 'todos']`, and it cannot reach a discriminator you buried at index 2 while
skipping index 1. The docs note the asymmetry that makes this bite — object property order is
irrelevant (*"no matter the order of keys in objects, all of the following queries are considered
equal"*) but *"Array item order matters!"*. Put the coarsest segment first, always, and generate keys
from one factory so no call site can invent a different order.

**★ Symptom: `invalidateQueries()` with no argument at all "fixed" the bug, and the app now storms
the network after every mutation.** Cause: an omitted `queryKey` is not "no filter, do nothing" — it
matches *everything*, and with the default `type: 'all'` that means every mounted query in the
application refetches at once. Fix: name the prefix. If you genuinely want a global reset — after a
logout, a tenant switch, an impersonation start — say so deliberately with `queryClient.clear()` or
a scoped `removeQueries`, so the intent is legible at the call site instead of hiding in an empty
argument list.

**★ Symptom: `exact: true` "does not work" on a key containing an object.** Cause: you are comparing
the object literally in your head; the library is not. Keys are *"hashed deterministically!"* and
*"no matter the order of keys in objects, all of the following queries are considered equal"*, so
`{ page: 1, status: 'x' }` and `{ status: 'x', page: 1 }` are the *same* key and `exact: true`
matches both. Fix: if the two really are different queries, they need different key *content*, not a
different property order.

**★ Symptom: two different filters return the same cache entry, or a key you passed matches
nothing.** Cause: a value in the key does not round-trip through `JSON.stringify`. The rule is
*"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data,
you can use it!"* — a `Map`, a `Set` or a class instance stringifies to `{}`, so every value of it
hashes identically and two queries silently share one entry; `undefined` inside an object
disappears entirely, so `{ page: 1, cursor: undefined }` and `{ page: 1 }` are one query. Fix:
normalise at the factory — spread only defined values into the params object, and put IDs and
enums in the key rather than the objects they came from.

**★ Symptom: a filter matched fewer queries than the devtools showed.** Cause: filters are evaluated
against the cache *at the moment of the call*. `invalidateQueries` is not a subscription — a query
created one tick later by a component that has not mounted yet was never a candidate. Fix: sequence
the call after the thing that creates the query, or express the requirement as a `staleTime` /
`refetchOnMount` policy on that query rather than as a one-shot invalidation.

**★ Symptom: `setQueryData({ queryKey: ['todos'] }, updater)` compiles in JavaScript and updates
nothing.** Cause: the singular accessors take a key, not a filter. The object you passed was hashed
*as a key*, so you created — or updated — a cache entry literally keyed by that wrapper object, and
nothing observes it. Fix: `setQueryData(['todos'], updater)` for one entry, or
`setQueriesData({ queryKey: ['todos'] }, updater)` when you meant the filter. TypeScript catches
this; a `.js` codebase will not.

## Interview questions

**★ How does key matching work, and how do you invalidate exactly one query?**
By default it is a prefix match over the key array, so `['todos']` catches `['todos', 'list', filters]`
and `['todos', 'detail', id]` alike. For a single query, name the full key and add `exact: true`,
which matches *"only queries with no additional subkeys"*. Between the two there is the predicate
form, which receives each `Query` from the cache and returns a boolean — the tool for conditions that
are not expressible as a prefix, such as "every cached page of any list whose filter references this
project". Because matching is positional, the array's shape is load-bearing: coarsest segment first,
and one key factory rather than hand-written keys at call sites.

**★ Name every field of a query filter and say what each one is for.**
`queryKey` (prefix match by default), `exact` (turn the prefix into equality), `type`
(`'active' | 'inactive' | 'all'`, defaulting to `all`), `stale` (`true` matches stale, `false`
matches fresh), `fetchStatus` (`'fetching' | 'paused' | 'idle'` — the queryFn axis, not the data
axis), and `predicate`, described by the docs as *"a final filter on all matching queries"*. The
two structural points worth saying out loud: the fields combine with AND, and `predicate` runs after
the others, so it is cheap when paired with a key and expensive when used alone.

**★ Which methods take a filter object, and which take a bare key?**
The invalidation, refetch, cancellation and removal family — `invalidateQueries`, `refetchQueries`,
`cancelQueries`, `removeQueries`, `resetQueries` — plus the bulk accessors `getQueriesData` and
`setQueriesData`, the `useIsFetching` / `useIsMutating` hooks, and `QueryCache#findAll`. The
singular accessors `getQueryData`, `setQueryData` and `getQueryState` take a *key*, because they
address exactly one entry. The point of the question is not the list, it is that the filter family
shares one grammar: once you can express "active, stale, under this prefix" you can hand that same
object to any of them and the only thing that changes is the verb.

**★ Why can a key contain an object but not a `Map`?**
Because matching is defined on the hash, not on the value: keys are *"hashed deterministically!"*,
and the documented constraint is serialisability under `JSON.stringify` plus uniqueness to the
query's data. An object satisfies both, and the hash normalises property order so `{ a, b }` and
`{ b, a }` are the same query — which is what you want, since the caller did not mean two. A `Map`
satisfies neither: it stringifies to `{}` regardless of contents, so uniqueness is gone and every
`Map`-keyed query in that position aliases onto one cache entry. The same trap catches `Set`, class
instances with private fields, and anything carrying a `toJSON` that drops the discriminating part.

---

← [Cache management APIs](./01-cache-management-apis.md) · [Topic index](../README.md) · Next → [Filtering by state](./01c-filtering-by-state-type-stale-predicate.md)
