---
title: "Every row in the panel carries two independent state machines — status answers whether the cache holds data, fetchStatus answers whether the queryFn is running, and every confusing reading you will ever get is one of the nine cells they make together"
sidebar_label: "01b · status × fetchStatus"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) (fetched 2026-09-08), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5). Documentation-validated, **no sandbox run**, and **no reproduction of the panel's own wording, colours or layout** — every claim below is about the cache state the panel renders. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**A query does not have "a state". It has two, they move independently, and the panel shows you both because neither one is enough on its own. `status` is a statement about the *cache*: is there data for this key? `fetchStatus` is a statement about the *function*: is `queryFn` running right now? Once you internalise that they are orthogonal, the readings that look like bugs — a query that says `success` while it is fetching, a query stuck at `pending` that is not fetching at all — stop being mysteries and become a two-coordinate lookup. This page walks all nine cells, because the two that people misdiagnose (`pending` + `paused` and `pending` + `idle`) look identical to "the request is hanging" and neither one is.**

## Two axes, and the sentence that separates them

The Queries guide states the split in one line, and it is the single most useful sentence in the whole library's documentation:

> *"The `status` gives information about the `data`: Do we have any or not? The `fetchStatus` gives information about the `queryFn`: Is it running or not?"*

The values, verbatim from the same page:

> *"`isPending` or `status === 'pending'` - The query has no data yet"*
> *"`isError` or `status === 'error'` - The query encountered an error"*
> *"`isSuccess` or `status === 'success'` - The query was successful and data is available"*

> *"`fetchStatus === 'fetching'` - The query is currently fetching."*
> *"`fetchStatus === 'paused'` - The query wanted to fetch, but it is paused. Read more about this in the [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) guide."*
> *"`fetchStatus === 'idle'` - The query is not doing anything at the moment."*

And, crucially, that they are not a single ladder:

> *"Background refetches and stale-while-revalidate logic make all combinations for `status` and `fetchStatus` possible."*

⚠️ **In v4 there was effectively one axis.** The migration guide records the rename:

> *"`status: loading` has been changed to `status: pending` and `isLoading` has been changed to `isPending`"*

If you still read `pending` as "a request is in flight", you are reading a v4 word with v4 semantics into a v5 field. `pending` means *the cache is empty for this key*. It says nothing at all about whether anything is happening.

## The nine cells

| | `fetchStatus: 'fetching'` | `fetchStatus: 'paused'` | `fetchStatus: 'idle'` |
|---|---|---|---|
| **`status: 'pending'`** | cold load, working as intended | 🔴 **offline** — nothing is wrong with your code | 🔴 **nothing will ever happen** — disabled query |
| **`status: 'success'`** | background refetch — not a bug | offline background refetch; UI is fine | settled, the resting state |
| **`status: 'error'`** | a retry is in flight | a retry is waiting for the network | failed and finished retrying |

Every one of those nine is reachable. Read the row first (do I have data?), then the column (is anything running?), and the diagnosis falls out.

## Cell by cell — what you are staring at

**`pending` + `fetching` — the cold load.** No cached data for this key and `queryFn` is executing. This is what a first mount looks like and it is the *only* cell that deserves a full-page spinner. It resolves to `success` + `idle` or, after the documented retries, to `error`.

**`pending` + `paused` — 🔴 the reading people misdiagnose most.** The query *wanted* to run and the library declined to start it, because the network is reported as offline. Nothing is hanging: there is no request outstanding, no timer to wait on, and no error to catch. Your `queryFn` was never called, so no amount of logging inside it will show anything. The docs' own phrasing is exact — *"The query wanted to fetch, but it is paused"* — and they hand the mechanism to the [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) guide. The fix is never in your data layer. It is: restore connectivity, or decide that this query should run regardless of the online signal (that is a `networkMode` decision, made on the query, not in the panel). This cell is also why the panel's offline simulation matters — it is how you *produce* this reading deliberately instead of discovering it in a tunnel; see [01e](./01e-panel-actions-and-cache-effects.md).

**`pending` + `idle` — the query that will never resolve on its own.** The cache is empty and nothing is running *and nothing is scheduled*. There is exactly one family of causes: the query is not allowed to run. `enabled: false`, `enabled: someUndefinedId != null` where the id is still undefined, or a `queryFn` replaced by `skipToken`. The reason this cell hurts is that `status` is `pending`, so a component that renders its spinner from `isPending` renders a spinner **forever** and looks exactly like a hung request. It is the reason `isLoading` exists as a separate boolean — see below.

**`success` + `fetching` — a background refetch, and it is supposed to happen.** You have data, it is on screen, and a fresh copy is being fetched underneath it. This is stale-while-revalidate, and it is the default posture of the library, because:

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

So a row flicking into `fetching` every time you alt-tab back to the browser is the documented behaviour, not a runaway loop. The bug-shaped version of this cell is a row that is *permanently* fetching — that is a genuine loop, and the usual cause is a `queryKey` that is rebuilt to a new value on every render, which is [01c](./01c-reading-a-query-key.md)'s subject.

**`success` + `paused` — you have data, the refresh is waiting for the network.** Benign by construction: the user sees the last good data and nothing is broken. This is the cell that justifies caching at all. Do not render an error for it; if you want to tell the user their data may be old, that is a `dataUpdatedAt` decision, not an error state.

**`success` + `idle` — settled.** Data present, nothing running. Whether it is *fresh* or *stale* is a third, separate property that this axis does not show at all — a stale-and-idle query is completely normal and simply means nothing has triggered a refetch yet. That distinction is [01d](./01d-stale-fresh-inactive-and-eviction.md).

**`error` + `fetching` — a retry is in flight.** Reaching `status: 'error'` at all already means the retries were exhausted once:

> *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."*

So this cell is usually a *manual* `refetch()`, a remount, or a window refocus kicking the failed query again. The important consequence: while it reads `fetching`, `error` is still populated. If you render your error banner from `isError` alone, the banner and your spinner are on screen at the same time.

**`error` + `paused` — a retry that cannot start.** The failure already happened, the library wants to try again, and the network says no. Distinguishing this from `error` + `idle` matters for what you offer the user: a "Try again" button here is going to do nothing until connectivity returns.

**`error` + `idle` — failed and finished.** Retries exhausted, nothing scheduled. This is the only cell where "the request failed and the library has given up" is an accurate summary, and it is the only one where a retry button is unambiguously the right UI.

## The booleans, and why `isLoading` is not `isPending`

The migration guide names the derivation exactly:

> *"`isInitialLoading` has now been renamed to `isLoading`"*, *"implemented as `isPending && isFetching`"*

Read that against the matrix and its purpose is obvious: `isLoading` is true in exactly **one** cell — `pending` + `fetching`, the cold load. It is deliberately false for `pending` + `idle` (the disabled query) and false for `pending` + `paused` (offline). `isPending` is true for all three.

```tsx
// src/components/UserProfile.tsx
import { useQuery } from '@tanstack/react-query'

export function UserProfile({ userId }: { userId?: string }) {
  const { data, error, isLoading, isPending, isError, isFetching, fetchStatus } =
    useQuery({
      queryKey: ['user', userId],
      queryFn: ({ signal }) => fetchUser(userId!, signal),
      enabled: userId != null,
    })

  // pending + fetching only. A disabled query never reaches this branch.
  if (isLoading) return <ProfileSkeleton />

  // pending + paused: no request was ever started. Say so honestly.
  if (isPending && fetchStatus === 'paused') return <OfflineNotice />

  // pending + idle: we are waiting on the caller, not on the network.
  if (isPending) return <SelectAUserPrompt />

  if (isError) return <ErrorPanel error={error} retrying={isFetching} />

  return <Profile user={data} refreshing={isFetching} />
}
```

The ordering of those branches is the whole point. `isLoading` first, then the two `isPending` cells split by `fetchStatus`, then `isError` — which is still reachable while `isFetching` is true, so the error panel gets told about the retry rather than being replaced by a spinner.

## Gotchas

**★ A row sits at `pending` forever and your `queryFn` never logs a thing.** Cause: `fetchStatus` is `paused`, not `fetching` — the query wanted to run and was held back by the offline signal, so `queryFn` was never invoked. Adding logging inside `queryFn`, wrapping it in a try/catch, or bumping a timeout all investigate a function that never ran. Fix: read the `fetchStatus` on that row before touching the data layer. If it says `paused`, the question is connectivity or `networkMode`, and you can confirm it in seconds with the panel's offline toggle.

**★ A spinner that never stops, on a query that is behaving perfectly.** Cause: the component renders on `isPending`, and the query is `enabled: false` (or its key still contains `undefined`), so it sits at `pending` + `idle` indefinitely. Fix: render the cold-load spinner from `isLoading` — documented as `isPending && isFetching` — and give the disabled case its own branch. `isPending` alone is a statement about the cache, not about work in progress.

**★ You render `isError ? <Error /> : <Data />` and the user sees the error banner replaced by nothing during a retry.** Cause: `error` + `fetching` is a real cell; `error` remains set while the retry runs. If your branch order puts a `isFetching` spinner above `isError`, the banner disappears and reappears on every retry, which looks like flicker. Fix: branch on `isError` first and pass `isFetching` *into* the error UI as a "retrying" flag.

**★ "The devtools say the query succeeded but it is fetching again — something is looping."** Cause: usually nothing. `success` + `fetching` is stale-while-revalidate, triggered on mount, window refocus or reconnect, all of which are documented defaults. Fix: before hunting a loop, alt-tab away and back and see whether the refetch correlates with focus. A genuine loop refetches with no such trigger — and its cause is almost always an unstable `queryKey`, not the refetch defaults.

**★ You disabled a query to "stop it loading" and now a downstream component crashes on `data.something`.** Cause: `enabled: false` puts the query at `pending` + `idle`, and `pending` means `data` is `undefined`. Disabling does not freeze the last value; for a key that was never fetched there is no last value. Fix: keep the `isPending` branch, or supply `placeholderData`/`initialData` if the component genuinely cannot handle `undefined`.

**★ A failing endpoint looks exactly like a slow one for the whole retry window.** Cause: failures are not surfaced immediately — *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."* Until those retries are exhausted the row stays `pending` + `fetching`, because there is still no data and the `queryFn` is still being run. Fix: expect a first load against a broken endpoint to sit in the cold-load cell for the length of the backoff before it ever reaches `error`, and check the network tab for the repeated requests rather than concluding the server is merely slow. If that window is unacceptable for a particular query, `retry` is the option to lower — not anything on the status axis.

**★ Your offline UX was built against `isError` and never fires.** Cause: being offline does not produce an error. It produces `paused`, with no error object, no rejected promise and no `onError` call. Fix: drive the offline banner from `fetchStatus === 'paused'`, which is the only signal the library gives you for it.

**★ A "Try again" button appears to do nothing at all.** Cause: the row is `error` + `paused`, so your `refetch()` marks the query as wanting to fetch and it immediately pauses again — no request, no error, no visible change. Fix: disable or relabel the retry affordance when `fetchStatus === 'paused'`; the meaningful action there is restoring connectivity, and the retry will typically fire on reconnect anyway.

**★ You ported a v4 component and its loading state inverted.** Cause: `status: 'loading'` became `status: 'pending'`, and `isLoading` was reused for a *different* meaning — v4's `isInitialLoading`. A v4 `isLoading` (true whenever there was no data) is v5's `isPending`. Fix: mechanical rename `isLoading` → `isPending` when porting, then reintroduce `isLoading` only where you specifically want "cold load in progress".

**★ Two rows for what you believe is one query, one `success` and one `pending`.** Cause: this is not a status problem at all — they are two cache entries under two different hashed keys. `status` cannot tell you that; the key can. Fix: compare the serialised keys, and read [01c](./01c-reading-a-query-key.md), because a key that *looks* right can still hash differently.

## Interview questions

**★ What is the difference between `status` and `fetchStatus`, and why does the library need both?**
`status` describes the cache entry — do we have data for this key, did the last attempt fail, or is there nothing yet — and its values are `pending`, `error`, `success`. `fetchStatus` describes the `queryFn` — is it running, is it paused, or is it doing nothing — with values `fetching`, `paused`, `idle`. The docs put it as *"The `status` gives information about the `data`: Do we have any or not? The `fetchStatus` gives information about the `queryFn`: Is it running or not?"* One axis cannot express both because they genuinely vary independently: stale-while-revalidate means a query can hold perfectly good data *and* be fetching, and network pausing means a query can have no data *and* not be fetching. Collapsing them into one enum forces you to choose which fact to lose, and either choice produces a wrong UI in a common case.

**★ A query is at `status: 'pending'`. What can you conclude about whether a network request is in flight?**
Nothing whatsoever. `pending` says only that the cache holds no data for that key. The request may be running (`fetching`), may have been declined because the client is offline (`paused`), or may be impossible because the query is disabled (`idle`). Those three demand three completely different responses — wait, tell the user they are offline, and wait for the caller to supply an id — so the correct move is always to read `fetchStatus` alongside it. This is also exactly why `isLoading` exists as `isPending && isFetching`: it is the narrow boolean that really does mean "a first load is in progress".

**★ Walk me through diagnosing a query that has been `pending` for thirty seconds.**
First read its `fetchStatus`. If `idle`, the query is disabled or its key is incomplete — check `enabled` and look for `undefined` inside the serialised key; nothing will ever change on its own, so no amount of waiting helps. If `paused`, the client believes it is offline; `queryFn` was never called, so instrumenting it is wasted effort, and the question is connectivity or the query's `networkMode`. Only if it is `fetching` is there an actual outstanding request, and only then is it worth looking at the network tab, the server, or an `AbortSignal` that never resolves. Three readings, three unrelated investigations — which is why the reflex of "add a `console.log` in the query function" is wrong two times out of three.

**★ Is `status: 'success'` with `fetchStatus: 'fetching'` a bug?**
No — it is the default behaviour of the library. Queries consider cached data stale by default, and stale queries refetch in the background on mount, window refocus and reconnect. The point of the design is that the user keeps seeing the previous data while the refresh happens, so the cell means "showing you something valid, checking for something newer". It becomes a bug only when it never stops, and the cause of *that* is almost never the refetch triggers; it is a `queryKey` that is a new value on every render, so every render creates a fresh cache entry and mounts a fresh observer.

**★ Your product wants an "offline" banner. Which query field do you drive it from, and why not `isError`?**
`fetchStatus === 'paused'`. Being offline is not modelled as a failure: no request is attempted, so there is no rejection, no error object, and `status` stays wherever it was — `pending` if the key was never fetched, `success` if it holds data. An `isError`-driven banner therefore never appears, and worse, the `success` + `paused` case means a user with cached data would see nothing at all when they actually are offline. Driving it from `fetchStatus` catches both, and it lets you word the two cases differently: "you are offline and we have nothing to show" versus "you are offline; this data may be out of date".

**★ How would you reproduce the `paused` state on demand in development?**
Use the panel's offline simulation and watch the rows change. That is the practical reason it exists: `paused` is otherwise only reachable by genuinely disconnecting, which is awkward to do repeatedly and impossible to do in a test you want to keep. Because the panel acts on the real `QueryClient`, the toggle produces the real state your components will see, so you can build and check the offline branch of your UI without unplugging anything. The mechanics of the panel's actions, and which `QueryClient` method each corresponds to, are covered in [01e](./01e-panel-actions-and-cache-effects.md).

---

← [Mounting the devtools](./01-react-query-devtools.md) · [Topic index](../README.md) · Next → [Reading a query key](./01c-reading-a-query-key.md)
