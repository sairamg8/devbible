---
title: "staleTime and gcTime answer two unrelated questions — is this data still worth reusing, and is this entry still worth keeping — and gcTime does nothing at all while anything is observing the query"
sidebar_label: "01f · staleTime vs gcTime"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) — plus the `gcTime` sentence banked from the [`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient) on 2026-09-06. Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# ⏱️ `staleTime` vs `gcTime`: Two Timers That Are Not About The Same Thing

**`staleTime` governs *freshness*: how long a cached value may be handed to a component without going back to the server. `gcTime` governs *residency*: how long an entry stays in memory after nothing is observing it any more. They are measured from different moments, they start and stop under different conditions, and the library's own migration guide opens the topic by saying that almost nobody gets the second one right.**

## 1. The two questions

```text
component mounts, reads ['todos']
        │
        ▼
is the cached value younger than staleTime? ──yes──► use it, NO request
        │no
        ▼
use it anyway (stale-while-revalidate) AND fetch in the background
        │
        ▼
… later, the component unmounts. Observer count for ['todos'] hits 0.
        │
        ▼
gcTime countdown STARTS  ──────► elapses ──► the entry is deleted
        │
        └── another component mounts first ──► countdown cancelled, entry survives
```

`staleTime` is consulted while the query is *in use*. `gcTime` only starts mattering when it is
*not*. That is the sentence the migration guide leads with, in the section justifying the rename:

> *"Almost everyone gets `cacheTime` wrong…"*
> *"`cacheTime` does nothing as long as a query is still in use. It only kicks in as soon as the query becomes unused."*

The rename `cacheTime` → `gcTime` exists precisely because the old name suggested "how long the
cache lasts", which is what everybody assumed and what it never meant.

## 2. `staleTime` defaults to zero, and the consequences are everywhere

Important Defaults states the default in terms of behaviour rather than a number:

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*

So out of the box every cached value is stale the instant it lands, and the refetch triggers apply
to all of it:

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

🔴 Read that list for what it does **not** contain: there is no "when `staleTime` elapses". Nothing
fires a request because a timer expired. Staleness is a *flag consulted at those trigger points* —
a query sitting on screen with nobody switching tabs, mounting anything or losing the network will
happily display an hour-old value, however small `staleTime` is. If you need time-driven refreshing
you want `refetchInterval`, which is a different mechanism entirely (see
[06 · Background Refetching](../06-background-refetching/01c-polling-and-refetch-interval.md)).

## 3. `gcTime` defaults to five minutes, measured from the last unmount

Two statements, one from each page:

> *"By default, 'inactive' queries are garbage collected after 5 minutes."*
> *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."*

The second is the one that describes seeding: an entry created by `setQueryData` for a component
that never mounts is *never utilized by a query hook*, so the five minutes runs from the write and
the entry disappears.

While a query has an observer, `gcTime` is irrelevant — a screen left open for six hours does not
lose its data at the five-minute mark. The countdown starts at the transition to zero observers and
is cancelled if an observer reappears before it elapses, which is why navigating away and straight
back is instant.

## 4. Setting them, and the three places that argue

```ts
// Global default, for everything.
new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 10 * 60_000 } } });

// Per key prefix — the right granularity for "reference data is stable, feed data is not".
queryClient.setQueryDefaults(['countries'], { staleTime: Infinity, gcTime: Infinity });

// Per call site, which wins.
useQuery({ queryKey: ['todos'], queryFn, staleTime: 5_000 });
```

⚠️ `setQueryDefaults` changed behaviour in v5 in a way that affects overlapping registrations:
*"`queryClient.getQueryDefaults` will now merge together all matching registrations instead of
returning only the first"*. Two registrations whose prefixes both match a key now contribute, so a
broad `['todos']` default and a narrow `['todos','detail']` default combine rather than the first
one winning outright.

For server-rendered apps the advanced-SSR guide gives a direct instruction about the first of the
two timers:

> *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*

The reason is exactly §2: the client hydrates and mounts, mounting is a refetch trigger for a stale
query, and with the default `staleTime` of zero everything the server just rendered is stale on
arrival.

## 5. The combinations worth knowing

| `staleTime` | `gcTime` | behaviour |
|---|---|---|
| `0` (default) | `5min` (default) | refetch on every mount/focus/reconnect; entry survives 5 min of disuse |
| `Infinity` | `5min` | never refetches on its own — but unmount for 5 minutes and the entry is gone, so the next mount is a *cold* load |
| `5min` | `0` | every unmount discards the data; every remount is a full loading state, never stale-while-revalidate |
| `Infinity` | `Infinity` | fetched once per session, kept forever — correct for genuinely immutable reference data, a leak for anything else |

The second row is the one that surprises people: `staleTime: Infinity` is not "cache forever". It
promises never to *revalidate*; it promises nothing about *residency*. If the entry has been
collected there is no data to consider fresh.

The third row is the one that quietly ruins a UX: `gcTime` below `staleTime` means the freshness
window can never be used, because the entry never survives long enough for a second mount to find
it. As a rule, `gcTime` should be greater than or equal to `staleTime` for any query whose value is
"the back button is instant".

## Gotchas

**★ Warming the cache with `setQueryData` starts a five-minute countdown.** The reference is explicit:
*"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage
collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."* Seeding a
detail entry from a list response is a good pattern, but if the user does not open that detail view
within five minutes the seeded entry is gone and the fetch happens anyway.

**★ Symptom: `staleTime: Infinity` and the query still refetched from scratch.** Cause: two
different mechanisms, and it was not staleness. Either the entry was garbage collected during an
unmount — `gcTime` is a separate five-minute timer that `staleTime` does not influence — or
something invalidated it, and invalidation's stale marking *"overrides any `staleTime`
configurations being used in `useQuery` or related hooks"*. Fix: raise `gcTime` alongside
`staleTime` when the intent is "keep this", and check the devtools for an invalidation you forgot
was wired to a mutation.

**★ Symptom: a dashboard left open all afternoon shows stale numbers despite `staleTime: 30_000`.**
Cause: `staleTime` expiring does not fetch anything. The documented triggers are *"New instances of
the query mount, The window is refocused, The network is reconnected"* — a tab that is never
blurred and never remounts hits none of them. Fix: `refetchInterval` for time-driven refreshing.
`staleTime` decides whether a *triggered* refetch is skipped; it never causes one.

**★ Symptom: after upgrading to v5, a carefully tuned `cacheTime` has no effect.** Cause: it was
renamed. The migration guide lists `cacheTime` → `gcTime` among the mechanical renames, and an
unknown option in a plain-JavaScript codebase is not an error — it is silently ignored, so every
query fell back to the five-minute default. Fix: rename it. TypeScript catches this on the option
object; a `.js` project will not, and the symptom is a memory profile and a request count that both
changed for no visible reason.

**★ Symptom: navigating away and back always shows a spinner, even after two seconds.** Cause:
`gcTime` is set below `staleTime`, or to zero. The entry is deleted on unmount, so the remount has
no cached value to display while it revalidates and falls into the `pending` branch. Fix: make
`gcTime` comfortably larger than `staleTime` — the whole stale-while-revalidate experience depends
on the entry outliving the absence of its observer.

**★ Symptom: memory grows across a long session with `gcTime: Infinity`.** Cause: that is what it
asks for. Nothing is ever collected, including every paged variant of every infinite list and every
per-ID detail entry the user has ever opened. Fix: reserve `Infinity` for a small, enumerable set
of reference queries registered through `setQueryDefaults` on their own prefix, and leave the
default in place for anything keyed by a user-supplied ID.

**★ Symptom: `staleTime` set on one component seems not to apply in another.** Cause: `staleTime`
is an *observer* option, not a property of the cache entry, so two `useQuery` calls on the same key
can disagree about whether the shared value is stale, and each decides independently whether its own
mount should trigger a refetch. Fix: put shared policy in `setQueryDefaults` for the key prefix, or
behind a custom hook that every call site uses, rather than repeating literals at call sites — the
version that omits it silently reverts that observer to the zero default.

**★ Symptom: hydrated server data refetches immediately on the client.** Cause: the default
`staleTime` of zero. The SSR guide says it plainly — *"With SSR, we usually want to set some default
staleTime above 0 to avoid refetching immediately on the client"* — because hydration mounts the
hooks, and *"New instances of the query mount"* is a refetch trigger for a stale query. Fix: a
non-zero default `staleTime` on the client's `QueryClient`, long enough to cover the gap between
render on the server and hydration in the browser.

## Interview questions

**★ You seed a detail query with `setQueryData` from a list response and nothing ever mounts it. How
long does it live?**
Five minutes by default, then it is garbage collected — *"If the query is not utilized by a query hook
within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been
configured, it defaults to 5 minutes."* The seeding pattern is still worth it, because the payoff case
is a click that happens seconds later, but it is not a way to preload data for a session. If you need
the entry to outlive that window, raise `gcTime` for that key via `setQueryDefaults` rather than
hoping.

**★ Explain `staleTime` and `gcTime` to someone who thinks `gcTime` is "how long the cache lasts".**
That belief is common enough that the library renamed the option to fight it — v4 called it
`cacheTime`, and the migration guide's justification begins *"Almost everyone gets `cacheTime`
wrong…"* before stating the rule: *"`cacheTime` does nothing as long as a query is still in use. It
only kicks in as soon as the query becomes unused."* So `gcTime` is not a lifetime, it is a grace
period after the last observer goes away. The timer that decides whether a mounted component gets a
cached value or a request is `staleTime`, and it is consulted while the query is very much in use.
One is about reuse, the other about eviction.

**★ `staleTime: Infinity, gcTime: 0` — describe what the user experiences.**
A guaranteed loading spinner on every visit, and never a background refetch. The data is never
considered stale, so nothing ever revalidates it — but the entry is destroyed the moment the last
component unmounts, so there is nothing left to be fresh. Every navigation to that screen is a cold
fetch with a `pending` state. It is the worst of both settings, and it is a surprisingly easy
configuration to arrive at by tuning the two options in separate pull requests.

**★ Why doesn't a query refetch the moment its `staleTime` expires?**
Because staleness is a flag, not a schedule. The documented triggers are mounting a new instance,
window refocus and network reconnect; expiry itself fires nothing. Design-wise that is the right
default — a background tab with a two-second `staleTime` would otherwise poll forever — but it means
`staleTime` alone can never guarantee data younger than N seconds on a screen the user is already
looking at. That requirement needs `refetchInterval`, or an explicit `refetchQueries` driven by
something outside the query, such as a websocket message.

**★ A v4 codebase sets `cacheTime: 1000 * 60 * 30`. What happens after the upgrade, and how would
you find it?**
In TypeScript it fails to compile, because `cacheTime` no longer exists on the options type. In
JavaScript nothing happens at all: the property is ignored, `gcTime` falls back to five minutes, and
the application starts collecting entries six times sooner than it used to — showing up as extra
requests and unexpected loading states on back-navigation rather than as an error. Finding it is a
grep for `cacheTime` across the repo, which is worth doing even after running the codemod, because
the migration guide is candid that *"The codemod is a best efforts attempt"* and that *"there are
edge cases that cannot be found by the code mod"*.

**★ Where would you set each of these in a real application?**
`gcTime` almost always globally, because it is a memory policy and there is rarely a reason for it to
differ per screen — with the exception of a small set of reference queries pinned via
`setQueryDefaults`. `staleTime` belongs with the data's actual volatility, and the cleanest place to
express that is a key prefix: `setQueryDefaults(['countries'], { staleTime: Infinity })` next to
`setQueryDefaults(['prices'], { staleTime: 5_000 })`. Scattering `staleTime` literals across call
sites is how one component ends up refetching on every mount while its neighbour, reading the same
key, does not — because `staleTime` is per-observer and the call site that omitted it silently gets
the zero default.

---

← [Direct cache access](./01e-direct-cache-access.md) · [Topic index](../README.md) · Next → [Structural sharing](./01g-structural-sharing.md)
