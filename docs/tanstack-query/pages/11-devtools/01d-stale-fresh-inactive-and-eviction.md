---
title: "Fresh versus stale and active versus inactive are two more independent axes, and the second one is a countdown — an inactive row is a cache entry with no subscribers that will be deleted five minutes from now unless something mounts it"
sidebar_label: "01d · Stale, fresh, inactive"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr). Documentation-validated, **no sandbox run and no timings** — the durations below are documented defaults, not measurements. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**`status` and `fetchStatus` told you about this instant. Fresh/stale and active/inactive tell you about the entry's future: whether it will refetch when something touches it, and whether it will still exist when something does. They are governed by two different options that people routinely swap — `staleTime` decides how long data is trusted, `gcTime` decides how long an *unused* entry survives — and the reason to read them off the panel is that the second one is invisible in code. A row marked inactive is not idle; it is on a timer, and when the timer expires the row disappears and the next mount cold-loads.**

## Fresh vs stale is a property of the data

An entry is **fresh** while less time has passed since its last successful fetch than its `staleTime`, and **stale** afterwards. The default is the one everybody trips over:

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*

Immediately. `staleTime` defaults to zero, so a query is stale the instant its data arrives. That is a deliberate choice — the library optimises for correctness first, and pays for it with refetches — and it means **most rows in your panel being stale is the default state of a healthy app, not a symptom**.

Being stale does nothing on its own. It is a *permission*, cashed in only when a documented trigger fires:

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

That is the mechanism behind the `success` + `fetching` cell in [01b](./01b-status-and-fetchstatus-matrix.md). It also explains a reading that alarms people the first time: alt-tab away, alt-tab back, and a batch of rows fetch at once. Every one of them was stale and the window regained focus.

⚠️ **This page can quote the triggers but not their default values.** The Important Defaults page names `refetchOnMount`, `refetchOnWindowFocus` and `refetchOnReconnect` without printing what they default to, so the honest statement is the behavioural one above. Do not assert `refetchOnWindowFocus: true` from this page; assert that stale queries refetch on refocus, which is what it says.

Invalidation is the other route to stale, and it is stronger than the clock:

> *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*

## Active vs inactive is a property of the subscribers

A cache entry keeps a list of **observers** — the mounted hooks reading it. One or more observers and the entry is *active*; zero and it is *inactive*. That is the whole definition. Nothing about the data changes when a component unmounts; what changes is that there is no longer anyone to refetch *for*.

This axis is the one you genuinely cannot see from source, because it depends on what is mounted right now. It is also the axis the panel is uniquely good at: unmount a component and watch its row flip.

The two consequences that matter:

1. **An inactive stale query does not refetch.** The triggers above are all observer-driven — a mount, a focus with observers present, a reconnect. With nobody watching, stale is a note for later.
2. **An inactive query is on a deletion timer.**

## `gcTime` — the countdown attached to every inactive row

> *"By default, 'inactive' queries are garbage collected after 5 minutes."*

The `QueryClient` reference says the same thing from the other direction, and this phrasing is the precise one:

> *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."*

🔴 **The timer only runs while the entry is unused.** The v5 migration guide is unusually blunt about how often this is misunderstood — it is the reason the option was renamed from `cacheTime` to `gcTime` in the first place:

> *"Almost everyone gets `cacheTime` wrong…"*

> *"`cacheTime` does nothing as long as a query is still in use. It only kicks in as soon as the query becomes unused."*

So `gcTime` is not "how long data is cached". A query observed continuously for eight hours is never garbage collected regardless of `gcTime`. The timer starts at the moment the last observer unmounts, and it is cancelled if a new observer mounts before it fires.

**What that means when you are staring at the panel:** an inactive row is a five-minute countdown you cannot see the digits of. Come back later and the row is simply gone — no error, no log, nothing to grep for. The next time that component mounts it will cold-load (`pending` + `fetching`) instead of showing cached data with a background refresh, and to a user that is the difference between an instant screen and a spinner.

## The two options do not overlap, and mixing them up is the classic bug

| | `staleTime` | `gcTime` |
|---|---|---|
| Governs | how long data is **trusted** | how long an **unused** entry survives |
| Default | `0` — stale immediately | 5 minutes |
| Clock starts | at the last successful fetch | when the **last observer unmounts** |
| Effect while observed | controls background refetching | **none at all** |
| Effect when it expires | the entry becomes eligible to refetch | the entry is **deleted** |

```ts
// src/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Trust data for a minute: fewer refetches on remount and refocus.
      staleTime: 60_000,
      // Keep unused entries around long enough that a back-navigation is instant.
      gcTime: 10 * 60_000,
    },
  },
})
```

🔴 **Keep `gcTime` at least as large as `staleTime`.** They are independent options with independent timers, so nothing stops you setting `staleTime: 60 * 60_000` and leaving `gcTime` at its 5-minute default — and then a route you leave for six minutes has its entry deleted while the data was still, by your own configuration, considered fresh. The long `staleTime` you configured for instant back-navigation buys you nothing, because there is no entry left to be fresh.

## Why a fetch can happen and nothing re-renders

One more documented behaviour, because it produces a reading that looks like a broken component:

> *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"*

A background refetch that returns byte-identical data leaves the `data` reference untouched, so consumers do not re-render. In the panel you will see the entry go fetching and settle; in the UI, nothing moves — because nothing needed to. This is a feature (it is what stops a 30-second poll from re-rendering a large table forever) and it is a trap only if you were using a re-render as your evidence that the fetch happened. Use the panel for that evidence instead; that is what it is for.

## Gotchas

**★ A row you were watching disappeared from the panel entirely.** Cause: it went inactive when its last observer unmounted, and the documented default garbage-collects inactive queries after five minutes. Fix: nothing is wrong. If you need the entry to survive a longer detour — a wizard step, a modal, a route the user leaves and returns to — raise `gcTime` on that query. If you need it to survive forever, `gcTime: Infinity`, and accept that you now own the memory.

**★ Back-navigation to a screen you visited a minute ago shows a full-page spinner.** Cause: either the entry was evicted (inactive longer than `gcTime`) or the component renders its spinner from `isPending`. The panel distinguishes them instantly: if the row is absent, it was evicted; if the row is present with data, your component is branching wrongly. Fix: raise `gcTime` for the first, and branch on `isLoading` for the second — see [01b](./01b-status-and-fetchstatus-matrix.md).

**★ You set `gcTime` to get fresher data and got more spinners instead.** Cause: wrong knob. `gcTime` does not affect refetching at all while a query is observed — *"it only kicks in as soon as the query becomes unused"*. Lowering it just deletes unused entries sooner, so returning users cold-load. Fix: freshness is `staleTime`. Lower it (or leave it at the default `0`) to refetch more; raise it to refetch less.

**★ You set `staleTime: Infinity` and the data still refetched.** Cause: invalidation overrides it — *"This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*. Some mutation's `onSettled` invalidated a prefix that covers your key. Fix: this is working as designed; if a query genuinely must never refetch on invalidation, it should not share a prefix with the mutating resource. Confirm the prefix relationship in the panel before changing anything.

**★ Every query in the app fetches at once, repeatedly, and you cannot find the trigger.** Cause: with the default `staleTime` of zero everything is permanently stale, so every window refocus refetches everything observed. On a dashboard with twenty queries and a user who alt-tabs constantly, that is a lot of traffic that no code of yours initiated. Fix: give read-mostly queries a real `staleTime`. The default is correctness-first, not traffic-first, and it is meant to be tuned.

**★ On a server-rendered page, every row fetches immediately after hydration.** Cause: hydrated data lands with `staleTime: 0`, so it is stale on arrival and the mount trigger fires. The SSR guide states the remedy directly — *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*. Fix: set a default `staleTime` above zero, sized to how stale you are willing for the first paint to be.

**★ A long `staleTime` appears to be ignored after a short absence.** Cause: `gcTime` is shorter than `staleTime`, so the entry was deleted while unobserved and the next mount is a cold load with no data to be fresh or stale. Fix: raise `gcTime` to at least `staleTime`. The two timers are independent and nothing warns you when they are contradictory.

**★ You lowered `staleTime` globally so that a screen would update after a mutation.** Cause: you are paying for a missing invalidation with traffic on every query in the app. A shorter `staleTime` only makes the refetch happen sooner on the *next* trigger — a mount or a focus — so the screen still does not update until the user does something, and meanwhile every unrelated query refetches more often. Fix: invalidate the affected key at the mutation site. Invalidation is immediate for observed queries and, being a stale marking that *"overrides any `staleTime` configurations"*, it does not need `staleTime` tuned to work. Reproduce the intended behaviour in the panel first — [01e](./01e-panel-actions-and-cache-effects.md) shows how that experiment localises the bug.

**★ The panel shows the query fetched but your component never re-rendered, so you conclude the refetch failed.** Cause: structural sharing — identical results keep the same `data` reference, and an unchanged reference does not re-render subscribers. Fix: stop using a re-render as proof of a fetch. The row's own fetch activity is the evidence, and if you need the timestamp, `dataUpdatedAt` moves whether or not the reference did.

**★ You expected an inactive row to refetch when you invalidated it, and you are not sure whether it did.** Cause: the documentation quotes the two halves separately — every match *"is marked as stale"*, and a match *"currently being rendered via `useQuery` or related hooks"* is also refetched in the background — but it does not state in one sentence what happens to an inactive match beyond being marked stale. Fix: 🔴 I could not confirm this from the documentation, so do not assert it. Observe the row in the panel: watch whether it goes fetching while nothing is mounted, and design for the guaranteed part — it is stale, so it will refetch on the next mount.

**★ `gcTime: 0` looks like a clean way to avoid stale data and quietly breaks placeholder patterns.** Cause: with a zero timer the entry is dropped the moment the last observer unmounts, so anything that reads previous data from the cache — a list-to-detail transition, `getQueryData`, a placeholder derived from a cached list — finds nothing. Fix: use `staleTime: 0` (the default) for freshness and leave `gcTime` alone. `gcTime: 0` is for genuinely sensitive data you want out of memory promptly, and it is a privacy decision rather than a correctness one.

## Interview questions

**★ What is the difference between `staleTime` and `gcTime`, and why was `cacheTime` renamed?**
`staleTime` is how long fetched data is considered trustworthy; while fresh, mounting, refocusing and reconnecting will not refetch it. `gcTime` is how long a cache entry is kept **after it stops being used** — it does nothing at all while a query is observed. The rename happened because the old name invited exactly the wrong reading; the migration guide says *"Almost everyone gets `cacheTime` wrong"* and clarifies that it *"does nothing as long as a query is still in use. It only kicks in as soon as the query becomes unused."* "Cache time" sounds like the lifetime of cached data, which is `staleTime`'s job; "garbage collection time" says what it is, a deletion timer for unreferenced entries.

**★ What makes a query "inactive", and what happens to it next?**
It has zero observers — no mounted hook is reading that key. Nothing about its data changes at that moment; what changes is that the automatic refetch triggers no longer apply to it, because they are all observer-driven, and a garbage-collection timer starts. Documented default: *"By default, 'inactive' queries are garbage collected after 5 minutes."* If a component mounts and subscribes before the timer fires, the entry becomes active again with its data intact and the timer is cancelled. If not, the entry is removed and the next mount is a cold load. That is the whole reason to look at the active/inactive state in the panel — it is a prediction about how the next navigation will feel.

**★ Why is nearly every query in a healthy app showing as stale?**
Because `staleTime` defaults to zero: *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."* Stale is not an error state, it is a permission to refetch when a trigger arrives — a new mount, a window refocus, a reconnect. The default reflects a deliberate stance that data on a screen is guesswork until re-verified, and it is the correct default for correctness but frequently the wrong one for traffic. Tuning it per query is the single highest-leverage configuration change in most apps: a reference list that changes daily has no business refetching every time the user alt-tabs.

**★ You want a back-navigation to feel instant. Which options do you set, and what is the trap?**
Raise `staleTime` so the remount does not immediately refetch, and raise `gcTime` so the entry still exists when the user comes back. The trap is setting only the first: the timers are independent, so a generous `staleTime` with the default five-minute `gcTime` means a six-minute detour deletes the entry outright and the "fresh" window you configured never gets consulted. The rule of thumb is `gcTime >= staleTime`, and the way to check it is behavioural — leave the screen, wait past the interval, and see whether the row is still in the panel.

**★ The panel shows a query fetched, but the component did not re-render. Is that a bug?**
Almost certainly not: it is structural sharing. The docs state that *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"* — so a refetch returning identical data hands back the same reference, and consumers relying on referential comparison have nothing to react to. It is the behaviour that makes frequent polling affordable. The lesson for debugging is that a re-render is a bad proxy for a fetch; look at the query's own activity and its `dataUpdatedAt`, both of which move regardless.

---

← [Reading a query key](./01c-reading-a-query-key.md) · [Topic index](../README.md) · Next → [Panel actions](./01e-panel-actions-and-cache-effects.md)
