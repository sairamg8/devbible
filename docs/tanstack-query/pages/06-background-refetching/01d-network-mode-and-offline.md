---
title: "`networkMode`, `fetchStatus: 'paused'` and Why the Browser's Idea of \"Online\" Should Not Be Trusted"
sidebar_label: "01d · Network mode & offline"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Polling](https://tanstack.com/query/latest/docs/framework/react/guides/polling), [`onlineManager`](https://tanstack.com/query/latest/docs/reference/onlineManager) — plus [`onlineManager.ts`](https://github.com/TanStack/query/blob/a1119e5a3ffa52534de7390f17c7183d17658051/packages/query-core/src/onlineManager.ts) and the option TSDoc in [`types.ts`](https://github.com/TanStack/query/blob/a1119e5a3ffa52534de7390f17c7183d17658051/packages/query-core/src/types.ts) (`query-core` reads **5.102.8** at that commit), and MDN [`Navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 `networkMode`: What a Refetch Does When the Network Is Gone

## 1. Under-The-Hood Mechanics

Every automatic refetch described in [01](01-automatic-freshness.md) and [01c](01c-polling-and-refetch-interval.md) ends at the same last gate: **is there a network?** The answer changes not the query's `status` but a second, independent field — and code that has never met that field shows a spinner which can never resolve.

```text
a refetch is triggered (mount / focus / reconnect / interval / refetch())
                          │
                          ▼
              networkMode === 'online'  (the default)
                          │
        ┌─────────────────┴─────────────────┐
   onlineManager.isOnline()            not online
        │                                   │
        ▼                                   ▼
  fetchStatus: 'fetching'            fetchStatus: 'paused'
  status unchanged                   status UNCHANGED — still 'pending' if there was no data
                                            │
                                     connection returns
                                            │
                                            ▼
                                   the fetch CONTINUES (not a refetch)
```

### `status` and `fetchStatus` are two different questions

> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*

Network Mode enumerates the second one:

> *"`fetching`: The `queryFn` is really executing - a request is in-flight."*
> *"`paused`: The query is not executing - it is `paused` until you have connection again"*
> *"`idle`: The query is not fetching and not paused"*

and adds the warning that catches every offline-capable app exactly once:

> *"Keep in mind that it might not be enough to check for `pending` state to show a loading spinner. Queries can be in `state: 'pending'`, but `fetchStatus: 'paused'` if they are mounting for the first time, and you have no network connection."*

`isFetching` and `isPaused` are the derived booleans — *"The flags `isFetching` and `isPaused` are derived from this state and exposed for convenience."*

### The three modes

> *"Since TanStack Query is most often used for data fetching in combination with data fetching libraries, the default network mode is online."*

**`'online'`** — *"In this mode, Queries and Mutations will not fire unless you have network connection… If a fetch is initiated for a query, it will always stay in the `state` (`pending`, `error`, `success`) it is in if the fetch cannot be made because there is no network connection."*

**`'always'`** — *"TanStack Query will always fetch and ignore the online / offline state. This is likely the mode you want to choose if you use TanStack Query in an environment where you don't need an active network connection for your Queries to work - e.g. if you just read from `AsyncStorage`, or if you just want to return `Promise.resolve(5)` from your `queryFn`."* Three consequences, all documented together: *"Queries will never be `paused` because you have no network connection. Retries will also not pause - your Query will go to `error` state if it fails. `refetchOnReconnect` defaults to `false` in this mode, because reconnecting to the network is not a good indicator anymore that stale queries should be refetched."*

**`'offlineFirst'`** — *"the middle ground between the first two options, where TanStack Query will run the `queryFn` once, but then pause retries. This is very handy if you have a serviceWorker that intercepts a request for caching… However, if there is a cache miss, the network request will go out and fail, in which case this mode behaves like an `online` query - pausing retries."*

The signature, verbatim: *"`networkMode: 'online' | 'always' | 'offlineFirst'` — optional — defaults to `'online'`"*.

### Pause-and-continue is not a refetch

> *"If a query runs because you are online, but you go offline while the fetch is still happening, TanStack Query will also pause the retry mechanism. Paused queries will then continue to run once you re-gain network connection. This is independent of `refetchOnReconnect` (which also defaults to `true` in this mode), because it is not a `refetch`, but rather a `continue`. If the query has been cancelled in the meantime, it will not continue."*

That last sentence is the only documented way to stop a paused fetch from eventually landing.

### How "online" is decided, and why it is not trustworthy

`onlineManager` listens to two DOM events and nothing else, and initialises its state to `true`:

```typescript
// query-core/src/onlineManager.ts — the default setup, 5.102.8
window.addEventListener('online', onlineListener, false)
window.addEventListener('offline', offlineListener, false)
```

The Polling guide says the same in prose: *"TanStack Query detects connectivity by listening to the browser's `online` and `offline` events."* Those events are driven by `navigator.onLine`, and MDN is blunt about what that value means:

> *"In general, connection to LAN is considered online, even though the LAN may not have Internet access. For example, the computer may be running a virtualization software that has virtual ethernet adapters that are always "connected". On Windows, the online status is determined by whether it can reach a Microsoft home server, which may be blocked by firewalls or VPNs, even if the computer has Internet access."*
> *"Therefore, this property is inherently unreliable, and you should not disable features based on the online status, only provide hints when the user may seem offline."*

Captive-portal wifi, a dropped VPN and a dead backend all leave the browser "online". `networkMode: 'always'` is the documented escape hatch where the events are simply wrong: *"In environments where those events don't fire reliably (Electron, some embedded WebViews), set `networkMode: 'always'` to skip the connectivity check."*

---

## 2. Real-World Engineering Scenario

**Scenario**: A Field-Service App Whose Loading Spinner Ran Forever in a Basement.
Technicians opened a job list on arrival, often in a plant room with no signal. The list showed a spinner that never resolved and no error, because the query was `status: 'pending'` with `fetchStatus: 'paused'` — no data, and no request either, exactly the combination the Network Mode guide warns about. The team's first fix was a timeout that showed an error after fifteen seconds, which was worse: it reported a failure that had not happened, and the real fetch then completed silently when the technician walked back into signal, leaving an error screen sitting on top of good data. The correct fix was two lines of branching — check `isPaused` before `isPending` and render an explicit offline state — because the library had been reporting the situation accurately the whole time in a field nobody was reading.

---

## 3. Production-Grade Code Example

```tsx
// Offline-aware UI. `status` answers "do we have data"; `fetchStatus` answers "is a request running".
// A first mount with no network is status 'pending' AND fetchStatus 'paused' — a spinner
// keyed on isPending alone would spin forever with no request in flight.
function OrdersPanel() {
  const { data, status, fetchStatus, isPaused } = useOrders();

  if (isPaused && status === 'pending') return <OfflineNotice />;   // waiting for a connection
  if (status === 'pending') return <OrdersSkeleton />;              // genuinely loading
  if (status === 'error') return <OrdersError />;

  return (
    <>
      {fetchStatus === 'paused' && <StaleWhileOfflineBanner />}
      <OrdersTable orders={data} />
    </>
  );
}
```

```typescript
// Per-query network modes. The mode is a property of what the queryFn TALKS TO,
// so it belongs on the query, not usually on the global default.
function useLocalDraft(draftId: string) {
  return useQuery({
    queryKey: ['draft', draftId],
    queryFn: () => readDraftFromIndexedDb(draftId),
    networkMode: 'always', // never touches the network; must not be paused when offline
  });
}

function useCachedCatalogue() {
  return useQuery({
    queryKey: ['catalogue'],
    queryFn: fetchCatalogue,          // a service worker can answer this from cache
    networkMode: 'offlineFirst',      // try once, then pause retries instead of burning them
  });
}
```

```typescript
// Replacing connectivity detection when the browser's events are wrong for your environment.
// The manager is global: set this once at startup, before any query mounts.
import { onlineManager } from '@tanstack/react-query';

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = subscribeToRealConnectivity((reachable: boolean) => setOnline(reachable));
  return () => unsubscribe(); // returning the cleanup is required — the manager calls it on replacement
});
```

```typescript
// A global default that is honest about its own side effect. Setting networkMode: 'always'
// also flips refetchOnReconnect's default to false, so state it rather than inherit it.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',     // Electron build: the online/offline events are unreliable here
      refetchOnReconnect: true,  // 🔴 without this line the default is now false
      retry: 3,                  // retries no longer pause, so they burn immediately on failure
    },
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: A Spinner That Never Resolves Because the Query Is `paused`
```tsx
// ❌ WRONG: on a first mount with no connection the query is status 'pending' with
// fetchStatus 'paused' — nothing is in flight, so this spinner never goes away
if (isPending) return <Spinner />;

// ✅ CORRECT: separate "no data" from "no request", exactly as the guide warns
if (isPaused) return <OfflineNotice />;      // isPaused === (fetchStatus === 'paused')
if (isPending) return <Spinner />;
```

### ⚠️ Pitfall 2: Setting `networkMode: 'always'` Globally and Losing Reconnect Refetching
```typescript
// ❌ SILENT: one line at the root turns off refetchOnReconnect for EVERY query in the app,
// because its default is "true unless networkMode is 'always'"
new QueryClient({ defaultOptions: { queries: { networkMode: 'always' } } });

// ✅ CORRECT: say what you mean, both halves of it
new QueryClient({
  defaultOptions: { queries: { networkMode: 'always', refetchOnReconnect: true } },
});
```

### ⚠️ Pitfall 3: Treating `offlineFirst` as a Caching Strategy
```typescript
// ❌ MISREADING: 'offlineFirst' does not read a cache. It changes the RETRY policy —
// "run the queryFn once, but then pause retries" — and expects something BELOW it
// (a service worker, an HTTP cache) to be able to answer that first attempt.
useQuery({ queryKey: ['catalogue'], queryFn: fetchCatalogue, networkMode: 'offlineFirst' });
// with no service worker and no Cache-Control, this behaves like 'online' after the first failure

// ✅ CORRECT: pair it with the layer that actually serves the cached response
// (registering a service worker / setting Cache-Control is outside TanStack Query)
```

### ⚠️ Pitfall 4: Cancelling a Query to "Stop It Retrying" While Offline
```typescript
// A paused fetch WILL continue when the connection returns — "Paused queries will then
// continue to run once you re-gain network connection… it is not a `refetch`, but rather
// a `continue`" — and turning refetchOnReconnect off does NOT prevent that.

// ✅ The one documented way to stop it: "If the query has been cancelled in the meantime,
// it will not continue."
await queryClient.cancelQueries({ queryKey: ['orders'] });
```

### ⚠️ Pitfall 5: Building an Offline Indicator on `navigator.onLine`
```typescript
// ❌ UNRELIABLE: MDN — "this property is inherently unreliable, and you should not disable
// features based on the online status, only provide hints when the user may seem offline"
if (!navigator.onLine) return <YouAreOffline />;

// ✅ CORRECT: measure reachability of the thing you actually depend on, and feed the
// SAME signal into the library so its pausing agrees with your UI
onlineManager.setEventListener((setOnline) => {
  const stop = pollHealthEndpoint((reachable) => setOnline(reachable));
  return () => stop();
});
```

---

## Gotchas

**★ 🔴 `status: 'pending'` plus `fetchStatus: 'paused'` is a real state, and a spinner keyed on `isPending` hangs in it.** The guide flags it outright: *"Queries can be in `state: 'pending'`, but `fetchStatus: 'paused'` if they are mounting for the first time, and you have no network connection."* Nothing is in flight and nothing will be until connectivity returns, so the spinner is a lie about work that is not happening. Check `isPaused` before `isPending`. This is the single most common offline bug in TanStack Query apps, and it is invisible in every environment where the developer has a network.

**★ Resuming after an offline gap is a *continue*, not a refetch — and `refetchOnReconnect` has nothing to do with it.** *"Paused queries will then continue to run once you re-gain network connection. This is independent of `refetchOnReconnect`… because it is not a `refetch`, but rather a `continue`."* So a team that deliberately set `refetchOnReconnect: false` will still see that paused fetch complete when the network returns — correctly, because the user asked for it and never got an answer. The only documented way to stop it: *"If the query has been cancelled in the meantime, it will not continue."*

**★ 🔴 Setting `networkMode: 'always'` silently disables reconnect refetching.** The mode's own documentation says so — *"`refetchOnReconnect` defaults to `false` in this mode, because reconnecting to the network is not a good indicator anymore that stale queries should be refetched"* — and the option's TSDoc agrees: *"Defaults to `true` unless `networkMode` is `'always'`."* This is usually set once, globally, to make an Electron or React Native build behave, and its effect on every query in the app is nowhere visible in the code that caused it. Write `refetchOnReconnect` explicitly on the same object.

**★ `'always'` also stops retries pausing, which changes what a flaky connection looks like.** *"Retries will also not pause - your Query will go to `error` state if it fails."* In `'online'` mode a query that loses the network mid-retry waits and resumes; in `'always'` it burns its three retries against a dead connection and lands in `error`. If you chose `'always'` because your `queryFn` reads local storage, that is fine — nothing can fail for network reasons. If you chose it because the browser's events were unreliable, you have also opted every network query into fast, silent failure.

**★ The browser's idea of "online" is close to worthless.** `onlineManager` listens only to the `online` and `offline` events, and MDN's summary of what backs them is *"this property is inherently unreliable, and you should not disable features based on the online status, only provide hints when the user may seem offline"* — a machine on a LAN with no internet reports online, and *"On Windows, the online status is determined by whether it can reach a Microsoft home server, which may be blocked by firewalls or VPNs"*. If your app must distinguish "connected" from "the API is reachable", replace the detection with `onlineManager.setEventListener` rather than trusting the default.

**★ `onlineManager` starts optimistic.** Its internal state initialises to `true` and only changes when an event fires. On a page loaded while genuinely offline, the first query attempt is therefore made rather than paused — the manager has not been told otherwise yet. That is a reasonable default for a signal the library cannot trust, but "the query pauses immediately on a cold offline load" is not something to build on.

**★ `offlineFirst` is not "try the cache first" — it is "try once, then stop retrying".** *"TanStack Query will run the `queryFn` once, but then pause retries."* It assumes something below you (a service worker, an HTTP cache) may answer that first attempt without the network. If nothing does, *"the network request will go out and fail, in which case this mode behaves like an `online` query - pausing retries"*. It is not a caching strategy in itself; it is the retry policy that makes one usable.

**★ `networkMode` is a property of the `queryFn`, not of the app.** A query that reads `AsyncStorage` or resolves a constant should be `'always'`; a query that hits your API should usually stay `'online'`; a query fronted by a service worker wants `'offlineFirst'`. Setting one mode globally forces the same answer on all three, and the global choice is almost always made for the one query that misbehaved. Per-query is the idiomatic placement, and the guide says the mode *"can be set for each Query / Mutation individually, or globally via the query / mutation defaults."*

**★ The devtools "Mock offline behavior" toggle does not touch your network.** *"Please note that this button will not actually mess with your network connection (you can do that in the browser devtools), but it will set the OnlineManager in an offline state."* That is exactly what you want for reproducing a `paused` state, and exactly the wrong tool for testing a request that fails mid-flight — the toggle changes the library's belief, the browser devtools' offline mode changes reality, and they exercise different code paths.

**★ `setEventListener` must return its cleanup.** The manager stores the returned function and calls it when a new listener replaces the current one. A setup function that registers a subscription and returns nothing leaves the old subscription live, so a hot-reload or a second call to `setEventListener` accumulates listeners that all push conflicting values into the same manager. The same rule applies to `focusManager.setEventListener`.

## Interview questions

**★ A query shows a spinner forever on a phone with no signal. What state is it actually in?**
`status: 'pending'` with `fetchStatus: 'paused'` — the exact combination the guide warns about: *"Queries can be in `state: 'pending'`, but `fetchStatus: 'paused'` if they are mounting for the first time, and you have no network connection."* There is no data, so `status` is `pending`; there is no request, so `fetchStatus` is `paused`. Any UI treating `isPending` as "a request is running" shows a spinner that can never resolve. The correct shape checks `isPaused` first and renders an offline state, then falls through to the loading state. It is also the clearest illustration of why the two fields exist separately: *"The status gives information about the data… The fetchStatus gives information about the queryFn."*

**★ The user goes offline mid-request and comes back. Is that a refetch?**
No, it is a *continue*, and the distinction has a practical consequence. The guide: *"Paused queries will then continue to run once you re-gain network connection. This is independent of `refetchOnReconnect` … because it is not a `refetch`, but rather a `continue`."* So a team that has deliberately set `refetchOnReconnect: false` will still see that in-flight fetch complete when connectivity returns — which is correct, since the user asked for it and never got an answer. The only thing that stops it is cancellation: *"If the query has been cancelled in the meantime, it will not continue."*

**★ When would you set `networkMode: 'always'`, and what does it cost you?**
When the browser's connectivity signal is meaningless for your runtime — an Electron app, an embedded WebView, or a `queryFn` that reads from local storage and never touches the network. The guide names that case, and the Polling guide repeats it for environments *"where those events don't fire reliably"*. The cost is that three behaviours change together. Queries are never `paused`, so you lose pause-and-continue. Retries no longer pause, so a failure during a network blip goes straight to `error`. And `refetchOnReconnect` flips to defaulting `false`, so stale data no longer refreshes when the network returns. Set it per-query where you can, and if it must be global, write `refetchOnReconnect` explicitly beside it.

**★ How does the library know it is offline, and how much would you trust that?**
It listens to the browser's `online` and `offline` events through `onlineManager`, and nothing else. Those are backed by `navigator.onLine`, which MDN describes as *"inherently unreliable"* — *"In general, connection to LAN is considered online, even though the LAN may not have Internet access."* Captive-portal wifi, a dropped VPN and a dead backend all read as online, and the library will happily fire requests that fail. For an app where this matters, `onlineManager.setEventListener` replaces the detection with a real reachability check; for one where it does not, the honest position is that `paused` means "the browser thinks there is no network", not "there is no network".

**★ What is the difference between `status` and `fetchStatus`, and why are there two?**
Because "do we have data" and "is a request running" are genuinely independent, and every combination occurs. The guide's own framing: *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"* `success` + `fetching` is a background refetch over existing data. `pending` + `idle` is a disabled or lazy query. `pending` + `paused` is a first load with no network. `success` + `paused` is a refetch that could not start. A single enum could not express any of those, which is why v4's `isLoading` had to be split in v5 — the flag was answering both questions at once and could only be right about one.

**★ Would you choose `offlineFirst` for an app that needs to work on a train?**
Only as part of something larger. `offlineFirst` changes the retry policy — *"run the `queryFn` once, but then pause retries"* — on the assumption that a service worker or an HTTP cache can satisfy that single attempt. On its own it caches nothing and stores nothing; with no such layer, *"the network request will go out and fail, in which case this mode behaves like an `online` query"*. A genuine offline app needs a persistence layer for the query cache and a strategy for queued writes; `offlineFirst` is the retry setting that makes those pleasant rather than the feature that provides them.

**★ You want to test the offline path. What do the devtools actually give you?**
The library's belief, not the browser's. *"There is also a toggle button to Mock offline behavior. Please note that this button will not actually mess with your network connection… but it will set the OnlineManager in an offline state."* That is precisely right for reproducing `fetchStatus: 'paused'` and checking that your UI branches on `isPaused`. It is wrong for testing a request that dies in flight, a slow connection, or a service worker cache hit — for those you need the browser's own network throttling, which exercises a different path through the same code.

---

← [Polling](./01c-polling-and-refetch-interval.md) · [Topic index](../README.md) · Next → [Pagination & Infinite Queries](../07-pagination-and-infinite-queries/01-paged-data-patterns.md)
