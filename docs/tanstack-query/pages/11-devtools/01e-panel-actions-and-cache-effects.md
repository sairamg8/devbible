---
title: "Refetch, invalidate, reset and remove are four different operations that people click as if they were one — each leaves the cache in a different state, and the panel performs them on your real QueryClient, not on a copy"
sidebar_label: "01e · Panel actions"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools). 🔴 **`https://tanstack.com/query/latest/docs/reference/QueryClient` and its `/v5/` equivalent both returned `{"isNotFound":true}` when fetched on 2026-09-08**, so the per-method reference wording could not be re-quoted; claims sourced only from that page are marked below as unconfirmed rather than asserted. **No sandbox run**, and **no panel labels, colours or control positions** — the devtools documentation does not enumerate them. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**The panel's actions are the part of the devtools with the least documentation and the most consequence. Chunk 1 established the rule they all inherit: there is no separate copy of the cache, so every action is a real mutation of the `QueryClient` your components read from. What nobody tells you is that the four common actions are genuinely different operations — one asks for data, one changes a flag, one rewinds an entry, one deletes it — and picking the wrong one turns a five-second diagnosis into a false conclusion. This page maps each action onto the `QueryClient` method it corresponds to, states plainly which parts are documented and which are not, and ends with the thing the actions are actually for: proving where a missing cache update belongs in your code.**

## The one claim that governs all of them

You are not simulating anything. A panel action calls into the same `QueryClient` your app uses, so the effect on your running UI is immediate and real: components re-render, requests leave the browser, and if the app is pointed at a real backend, that request hits it. Treat the panel exactly as you would treat typing a `queryClient` call into the console — because that is what it is.

## Four operations, four end states

Read this as *what the cache entry looks like afterwards*, which is also what you will see on the row.

| | Data after | Stale marking | Entry still exists | A fetch happens |
|---|---|---|---|---|
| **Refetch** | replaced when it resolves | unchanged by the act itself | yes | yes, immediately |
| **Invalidate** | kept until new data arrives | 🔴 **marked stale, overriding `staleTime`** | yes | yes **if the query is currently rendered** |
| **Reset** | returns to the entry's initial state | — *(unconfirmed, see below)* | yes | on remount at minimum |
| **Remove** | gone | n/a | 🔴 **no** | no |

**Invalidate is the one with quoted semantics**, and they are worth having exactly:

> *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*

> *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*

Two separate effects, and the second is conditional on the query being *observed*. That is what makes invalidate the safe default: for an active query it behaves like a refetch, and for an inactive one it leaves a durable note that the data is not to be trusted, which the documented mount trigger will cash in the next time the component appears. A refetch, by contrast, is a one-shot request; it does not leave a mark behind for entries nobody is watching.

⚠️ **Reset and remove are described here from their observable cache effects, not from a quotable sentence** — the `QueryClient` reference page would not load on the date this was written. What is safe: after a remove, the entry is absent, which is the same end state the garbage collector produces (*"By default, 'inactive' queries are garbage collected after 5 minutes."*), and a subsequent write recreates it — *"If the query does not exist, it will be created."* Beyond that, watch the row rather than trusting a recollection, including mine.

## Which one you actually want

- **Refetch** when you want to see the request go out *now* and you do not care about the cache's opinion of freshness. It is the right action for "is the endpoint returning what I think it is".
- **Invalidate** when you are reproducing what your mutation *should* be doing. This is the action that matters most for debugging, because your mutation's `onSettled` almost certainly calls `invalidateQueries`, and clicking invalidate on the same key reproduces it exactly.
- **Reset** when you want the screen to behave like a first visit without a full reload — useful for checking a cold-load branch you can otherwise only reach by hard-refreshing.
- **Remove** when you want to prove what happens after eviction. Removing an inactive entry is the manual version of `gcTime` expiring, so it is how you test a back-navigation that has been away too long without waiting five minutes.

🔴 **Remove is the destructive one.** There is no undo, and if the entry held data that arrived from a mutation response rather than from a fetch — a server-generated id, a merged optimistic result — removing it means the only way back is another request, if one exists at all.

## The offline simulation, and why it is the most useful control in the panel

The panel can put the client into a simulated offline state. ⚠️ **The devtools documentation does not enumerate the panel's controls, so treat the control's name and position as unspecified** — what is documented is the state it produces, and that state is the one from [01b](./01b-status-and-fetchstatus-matrix.md):

> *"`fetchStatus === 'paused'` - The query wanted to fetch, but it is paused."*

This matters because `paused` is otherwise expensive to reach. Actually disconnecting a laptop is disruptive, browser-level throttling affects the whole page including your dev server and hot reload, and neither is repeatable. Flipping the client's own online signal reaches the exact state the library uses to decide whether to start a fetch, so:

- a cold query becomes `pending` + `paused` — build and check your "offline, nothing to show" branch;
- a warm query becomes `success` + `paused` on its next refetch attempt — check the "offline, this may be out of date" branch;
- a failed query becomes `error` + `paused` — check that your retry button is not lying to the user.

Then toggle back and watch the reconnect trigger fire, which is documented: *"Stale queries are refetched automatically in the background when: … The network is reconnected"*.

## Triggering an error on purpose

The error path is the least-exercised branch in most apps, and the devtools have a documented hook for it — the `errorTypes` option from chunk 1's table:

> *"Use this to predefine some errors that can be triggered on your queries."*

```tsx
// src/devtools.tsx — make failure a one-click state, not a network-tab exercise
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

class UnauthorizedError extends Error {
  status = 401
}

export function Devtools() {
  return (
    <ReactQueryDevtools
      errorTypes={[
        { name: 'Unauthorized', initializer: () => new UnauthorizedError('401') },
        { name: 'Server error', initializer: () => new Error('500') },
      ]}
    />
  )
}
```

The value is that the error object is *yours*, so error UI that branches on `error.status` or on `instanceof` is exercised properly rather than being handed a generic `Error` that takes the fallback path.

## The real purpose: locating a missing cache update

Here is the workflow the actions exist for, and it is worth more than any individual button.

1. Perform the action in your app that should update a screen — save the form, submit the mutation.
2. The screen does not update.
3. Find the row for the key that screen reads, and click **invalidate**.
4. **If the screen now updates, you have located the bug precisely**: the data layer is correct, the key is correct, and what is missing is the invalidation at the mutation site. The fix is an `invalidateQueries` in `onSettled`, not a change to any query.
5. **If the screen does not update, the key is wrong** — your component is subscribed to a different entry from the one you just invalidated. Go to [01c](./01c-reading-a-query-key.md).

That is a genuine binary search over the two things that usually break, and it takes seconds. 🔴 **Step 4 is a diagnosis, not a fix.** Clicking invalidate makes the symptom disappear, which is exactly what makes it tempting to move on — and the bug ships.

## Gotchas

**★ You spent twenty minutes debugging an app that had gone completely dead, and the offline simulation was still on.** Cause: the toggle is a client-wide switch and nothing in your app's UI reflects it; every query sits at `paused`, no requests are made, and no errors are thrown. Fix: when queries stop for no reason, check the offline state *first*. The signature is unmistakable once you know it — every row `paused`, nothing `fetching`, no errors anywhere.

**★ You clicked refetch and the row's data did not change, so you concluded the action did nothing.** Cause: most likely the response was identical and structural sharing kept the same reference — *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"*. Fix: judge by the entry's fetch activity and its `dataUpdatedAt`, not by whether the rendered value moved.

**★ Clicking invalidate on a top-level key kicked off dozens of requests.** Cause: filters match by prefix, so invalidating `['todos']` marks every descendant stale and refetches every observed one. It is a real cache operation on a real client, not a scoped preview. Fix: invalidate the narrowest key that reproduces what your mutation does; if a wide invalidation is what your mutation actually performs, this was a useful warning about production traffic.

**★ Invalidate did nothing visible for a query that is not on screen.** Cause: correct behaviour. The refetch half is conditional — *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"* — and an unobserved entry only gets the stale marking. Fix: none needed; the mark is durable and the documented mount trigger will refetch it when the component appears.

**★ Clicking refetch on a `paused` row appears to do nothing at all.** Cause: the client believes it is offline, so the request is not started; you get another pause, no error, no change. Fix: turn the offline simulation off, or accept that this is the correct preview of what your user's retry button will do while they are on a train.

**★ You removed a query to "force a refresh" and a component crashed.** Cause: remove deletes the entry outright. An observing component drops to no data, and anything reading `data.something` without an `isPending` branch throws. Fix: use invalidate or refetch to refresh; keep remove for deliberately testing the post-eviction cold path, and make sure the component has a real pending branch — which it needs anyway, because `gcTime` will do the same thing on its own eventually.

**★ You clicked actions during a demo against the staging API and changed real state.** Cause: the panel is not a sandbox; refetches hit the network and any cache write is observable to every subscriber. Fix: keep the panel closed in shared sessions, and if the app is pointed at anything shared, treat the actions with the caution you would give a console session against the same environment.

**★ Nothing in the panel triggers an error, so you conclude the feature is missing.** Cause: `errorTypes` defines the errors available — *"Use this to predefine some errors that can be triggered on your queries."* Without it configured, there is nothing predefined to trigger. Fix: pass `errorTypes` with the shapes your error UI actually branches on, including the custom class or the status field.

**★ "Invalidating from the panel fixes it" became the fix.** Cause: step 4 above, treated as a resolution rather than a bisection result. Fix: the outcome of that experiment is an instruction — put `invalidateQueries` with that key in the mutation's `onSettled`. The optimistic-updates guide's own example ends exactly that way, and it notes you should *"make sure to _return_ the Promise from the query invalidation"* so the mutation stays pending until the refetch settles.

**★ Reset behaved differently from what you expected on a query with `initialData`.** Cause: reset returns an entry towards its initial state, and what "initial" means depends on whether that query was configured with `initialData` — and the precise wording lives on the `QueryClient` reference page, which would not load on the date this page was written. Fix: 🔴 do not take a remembered definition, mine included. Click it and watch the row; that single observation is more reliable than any recollection, and it is the whole reason this panel exists.

## Interview questions

**★ What is the difference between invalidating a query and refetching it?**
Refetching asks for data now; invalidating changes the entry's state and *then* refetches conditionally. The documented semantics of invalidation are two separate effects: the query *"is marked as stale"*, and that *"stale state overrides any `staleTime` configurations"*, and separately, *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*. The practical difference shows up for queries nobody is watching. A refetch on an unobserved entry is a request whose result is written to a cache no one reads; an invalidation leaves a durable mark, so the next time a component mounts and subscribes, the documented mount trigger refetches it. That is why cache updates after a mutation are written as invalidations: they express "this is no longer trustworthy" rather than "fetch this immediately", and correctness does not then depend on what happens to be mounted.

**★ Why is "I clicked invalidate in the devtools and the screen updated" a diagnosis rather than a fix?**
Because it tells you the failure is in the *trigger*, not in the data path. If invalidating the key makes the screen correct, then the query function works, the key the component reads is the key you invalidated, and the render is fine — the only missing piece is that nothing in your code performed the invalidation after the mutation. The fix is an `invalidateQueries` call in the mutation's `onSettled` with that key. The failure mode is stopping at the symptom disappearing, which is easy because the app looks right at that moment and you did nothing to your source. It is exactly the same trap as fixing a bug by refreshing the page.

**★ When would you use remove instead of invalidate, and what do you risk?**
Remove when you want to observe the post-eviction cold path deliberately: it produces the same end state as `gcTime` expiring on an inactive entry, so it lets you check in seconds what a user who came back after ten minutes would see, instead of waiting out the timer. The risk is that it is destructive and unconditional. Data that came from a mutation response rather than a fetch — a generated id, a merged result — is simply gone, and an observing component drops from `success` to `pending`, so any code reading `data` without a pending branch throws. Invalidation never loses data: the old value stays on screen until the replacement arrives.

**★ Why is the panel's offline simulation more useful than turning off your Wi-Fi?**
Because it targets the exact signal the library makes its decision from, and only that. It produces the documented `paused` state — *"The query wanted to fetch, but it is paused"* — without disturbing your dev server, hot reload, source maps or anything else your machine is doing over the network, and it is instantly reversible, so you can flip back and forth while iterating on the offline branch of a component. It also lets you check the reconnect behaviour, since stale queries are documented to refetch when *"The network is reconnected"*. Testing offline UX at the OS level tends to break the tooling you need in order to see the result.

**★ Are the devtools' actions safe to run against a production build pointed at production data?**
They are as safe as running the equivalent `QueryClient` calls in the console against that environment, which is to say: reads are cheap and writes are not reversible from the panel. Refetching and invalidating cause real requests, which on an expensive or rate-limited endpoint is a genuine cost, and a wide invalidation can fan out to every query sharing the prefix. Removing an entry can lose data that was never fetched and cannot be re-fetched. The panel does not mutate your server on its own — it has no way to issue writes — so the real risks are traffic and local data loss, plus the plain fact that anyone watching your screen can now read every response body in the cache. That last point is the strongest argument for keeping the production build's devtools behind a deliberate opt-in, which is [01f](./01f-keeping-devtools-out-of-production.md).

---

← [Stale, fresh, inactive](./01d-stale-fresh-inactive-and-eviction.md) · [Topic index](../README.md) · Next → [Keeping devtools out of production](./01f-keeping-devtools-out-of-production.md)
