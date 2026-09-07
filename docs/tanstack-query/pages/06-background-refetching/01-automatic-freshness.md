---
title: "Background Refetching: Window Focus, Reconnect & the One Staleness Gate All Three Triggers Pass Through"
sidebar_label: "Background Refetching"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Window Focus Refetching](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching), [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations), [Caching](https://tanstack.com/query/latest/docs/framework/react/guides/caching), [`focusManager`](https://tanstack.com/query/latest/docs/reference/focusManager) — plus the option TSDoc in [`query-core/src/types.ts`](https://github.com/TanStack/query/blob/a1119e5a3ffa52534de7390f17c7183d17658051/packages/query-core/src/types.ts) and the trigger logic in [`queryObserver.ts`](https://github.com/TanStack/query/blob/a1119e5a3ffa52534de7390f17c7183d17658051/packages/query-core/src/queryObserver.ts) (`query-core` reads **5.102.8** at that commit), and MDN [`Document.visibilityState`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 Background Refetching: Window Focus, Reconnect & the Staleness Gate

## 1. Under-The-Hood Mechanics

TanStack Query automatically keeps cached data fresh through several **event-triggered** refetch mechanisms, layered on top of the `staleTime`-based freshness model — each responding to a specific real-world signal that data might have changed. The three event triggers are not three independent features: they are three call sites into **one** predicate, and knowing that predicate is the difference between tuning refetching and guessing at it.

```text
refetchOnMount         ──► a NEW observer subscribes ─┐
refetchOnWindowFocus   ──► document becomes visible ──┼──► shouldFetchOn(query, options, field)
refetchOnReconnect     ──► the `online` event fires ──┘             │
                                                                    ▼
                             enabled !== false  AND  staleTime !== 'static'
                                                                    │
                                              ┌─────────────────────┴──────────────────┐
                                     field === 'always'                    field !== false AND query is STALE
                                              └─────────────────────┬──────────────────┘
                                                                    ▼
                                                            background refetch
```

Important Defaults states the triggers plainly:

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

and the observer source shows they share one gate (`queryObserver.ts`, `shouldFetchOn`): the option is read, `'always'` short-circuits the staleness test, and anything other than `false` still has to clear `isStale`. `refetchInterval` is deliberately **not** on this list — it is a separate clock with separate rules, covered in [01c](01c-polling-and-refetch-interval.md). What a refetch then costs you in re-renders is [01b](01b-refetch-render-cost.md), and what any of them do when the network is gone is [01d](01d-network-mode-and-offline.md).

### Why Refetch-on-Focus Is the Default
A user switching back to a tab after being away for a while is a strong, common-sense signal that cached data might now be stale — refetching at that moment (if the data has actually passed its `staleTime`) keeps the UI honest without requiring a manual refresh, at essentially zero cost for data that's still fresh (the staleTime check means an focus-triggered refetch is a no-op for data that hasn't gone stale yet).

### 🔴 "Window focus" is really document *visibility*

The option is named for focus; the implementation listens for visibility. The Window Focus Refetching guide prints its own default handler:

> ```tsx
> focusManager.setEventListener((handleFocus) => {
>   // Listen to visibilitychange
>   if (typeof window !== 'undefined' && window.addEventListener) {
>     const visibilitychangeHandler = () => {
>       handleFocus(document.visibilityState === 'visible')
>     }
>     window.addEventListener('visibilitychange', visibilitychangeHandler, false)
>   }
> })
> ```

and `focusManager.isFocused()` in `query-core` falls back to `globalThis.document?.visibilityState !== 'hidden'`. MDN defines those two states precisely:

> *"visible: The page content may be at least partially visible. In practice this means that the page is the foreground tab of a non-minimized window."*
> *"hidden: The page content is not visible to the user. In practice this means that the document is either a background tab or part of a minimized window, or the OS screen lock is active."*

So switching to your editor and back — same tab, same un-minimised window — fires no `visibilitychange` and triggers **no refetch**. Switching browser tabs, minimising, and unlocking the screen do.

### `refetchOnReconnect` has a *conditional* default

`refetchOnMount` and `refetchOnWindowFocus` are documented *"Defaults to `true`."* `refetchOnReconnect` is not:

> *"Defaults to `true` unless `networkMode` is `'always'`."*

The Network Mode guide gives the reason for the exception: *"`refetchOnReconnect` defaults to `false` in this mode, because reconnecting to the network is not a good indicator anymore that stale queries should be refetched."* Set `networkMode: 'always'` globally — a common move in Electron and React Native — and you have silently turned reconnect refetching off for the whole app.

### Two clocks, two subjects: `staleTime` and `gcTime`

They are constantly confused because both are durations in milliseconds. They measure different things about different objects.

| | `staleTime` | `gcTime` |
|---|---|---|
| Subject | data that is being observed | a query with **no** observers |
| Question | may I serve this without refetching? | how long do I keep this around? |
| Documented default | *"Defaults to `0`."* | *"defaults to **5 minutes**"* |
| At `Infinity` | never becomes stale on its own | garbage collection disabled |
| Starts counting | when `dataUpdatedAt` is written | when the last observer unmounts |

The TSDoc for `gcTime` is explicit that the clock only runs when nothing is watching: *"The time in milliseconds that unused/inactive cache data remains in memory. When a query's cache becomes unused or inactive, that cache data will be garbage collected after this duration. When different garbage collection times are specified, the longest one will be used."* A long `staleTime` therefore does nothing to keep an unmounted query alive, and a long `gcTime` does nothing to stop a mounted one refetching.

### `staleTime: 'static'` — the one setting invalidation cannot beat

`staleTime` in v5 is typed `number | 'static'`, and Important Defaults draws the line between `'static'` and `Infinity` in one paragraph:

> *"`'static'` and `Infinity` both prevent staleness-based refetches, but `'static'` is stricter: `queryClient.invalidateQueries()` can invalidate a query with `staleTime: Infinity`, but has no effect on `staleTime: 'static'`. `refetchOnMount`, `refetchOnWindowFocus`, and `refetchOnReconnect` set to `"always"` are also blocked by `'static'`. Use `'static'` for data that cannot change while the app is running: feature flags fetched at boot, user permissions loaded at login, static reference tables. Use `Infinity` when you still want manual invalidation to work."*

That is the answer to "what still refetches through `staleTime: Infinity`": invalidation does, and so does an `'always'` trigger. Through `'static'`, nothing does.

### A background refetch is invisible by design

It never resets `status` to `pending`, because `pending` means *no data* and there is data. The cached value stays on screen for the whole fetch and is replaced only when the new one arrives. Which flag tells you it is happening, what the refetch costs in re-renders, and how that cost is silently lost are [01b](01b-refetch-render-cost.md).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Support Queue That Went Stale Every Time an Agent Alt-Tabbed to the Phone System.
A support console showed the open-ticket queue with the library's defaults, and agents reported it "not updating" — they would take a call in a separate desktop app, come back, and act on a ticket another agent had already closed. The team's first theory was that `refetchOnWindowFocus` was broken. It was not: alt-tabbing to another *application* leaves the browser tab as the foreground tab of a non-minimised window, so `document.visibilityState` stays `'visible'`, no `visibilitychange` fires, and the library correctly does nothing. The fix was to stop treating the focus trigger as a freshness policy for a queue that changes every few seconds and give it a real one — a short poll — while keeping the focus trigger for the genuinely tab-switching case. The bug report said "refetch on focus doesn't work"; the actual defect was a freshness requirement that no event-driven trigger could satisfy.

---

## 3. Production-Grade Code Example

```typescript
// Tuning refetchOnWindowFocus/reconnect per-query, for data with genuinely different freshness needs
function useLiveStockPrice(ticker: string) {
  return useQuery({
    queryKey: ['stock', ticker],
    queryFn: () => fetchStockPrice(ticker),
    staleTime: 0, // ALWAYS considered stale — every focus/reconnect event triggers a fresh fetch
    refetchOnWindowFocus: true, // explicit, though this IS the default — documenting intent
  });
}

function useUserPreferences() {
  return useQuery({
    queryKey: ['user', 'preferences'],
    queryFn: fetchUserPreferences,
    staleTime: 60 * 60 * 1000, // rarely changes — an hour of freshness
    refetchOnWindowFocus: false, // explicitly OPT OUT — this data doesn't need focus-triggered refetching at all
  });
}
```

```typescript
// Data that cannot change while the app runs: 'static' outranks Infinity, and blocks invalidation too
function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 'static', // no mount/focus/reconnect refetch, and invalidateQueries() cannot reach it
    gcTime: Infinity,    // and never collect it — a separate decision from staleness
  });
}
```

```typescript
// One place to set the freshness policy for the whole app, then override per query.
// A global staleTime is the documented way to stop excessive refetching — not disabling the triggers.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s of freshness makes every trigger a no-op within that window
      refetchOnWindowFocus: true, // the default; stated so the next reader does not have to look it up
      refetchOnReconnect: true,   // 🔴 becomes false by default if you ever set networkMode: 'always'
      gcTime: 5 * 60 * 1000,      // the default; unused data survives 5 minutes after the last unmount
    },
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Leaving `refetchOnWindowFocus: true` for Data That Should Never Change Mid-Session
```typescript
// ❌ SUBOPTIMAL: refetching app-configuration/feature-flag data on every tab focus, when it
// genuinely never changes within a single session, adds unnecessary network requests for no benefit
useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig }); // default refetchOnWindowFocus: true

// ✅ CORRECT: explicitly disable focus-refetching for genuinely session-stable data
useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig, refetchOnWindowFocus: false, staleTime: Infinity });

// ✅ STRICTER, and the documented option for exactly this case in 5.102.8: 'static' also blocks
// invalidateQueries() and any trigger set to 'always' — no per-trigger opt-outs needed at all
useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig, staleTime: 'static' });
```

### ⚠️ Pitfall 2: Expecting a Refetch When the User Switches Applications
```typescript
// ❌ WRONG MENTAL MODEL: "the window lost focus, so returning to it refetches."
// The default listener is `visibilitychange`, and a foreground tab in a non-minimised
// window stays `visible` while another APPLICATION has OS focus — no event, no refetch.

// ✅ CORRECT: if OS-level focus really is your signal, replace the listener yourself
focusManager.setEventListener((handleFocus) => {
  const onFocus = () => handleFocus(true);
  const onBlur = () => handleFocus(false);
  window.addEventListener('focus', onFocus, false);
  window.addEventListener('blur', onBlur, false);
  return () => {
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
  };
});
```
The guide warns what this costs: *"When calling `focusManager.setEventListener`, the previously set handler is removed (which in most cases will be the default handler) and your new handler is used instead."* You have replaced visibility handling, not added to it.

### ⚠️ Pitfall 3: `refetchOnMount: 'always'` Used as a Cache Buster
```typescript
// ❌ EXPENSIVE: 'always' skips the staleness check entirely, so EVERY mount of EVERY
// component using this hook fires a request — including remounts from a route change,
// a tab switch in a tab component, or a list item scrolling back into a virtualised window
useQuery({ queryKey: ['todos'], queryFn: fetchTodos, refetchOnMount: 'always' });

// ✅ CORRECT: express the requirement as a freshness window; the gate then does the work
useQuery({ queryKey: ['todos'], queryFn: fetchTodos, staleTime: 10_000 }); // at most one fetch per 10s
```

### ⚠️ Pitfall 4: Disabling a Trigger Instead of Setting a Freshness Window
```typescript
// ❌ WHACK-A-MOLE: three options turned off one at a time, each after its own bug report,
// and the query is now genuinely stale forever because nothing is allowed to refresh it
useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

// ✅ CORRECT: one number governs all three, because all three share the staleness gate —
// "Setting staleTime is the recommended way to avoid excessive refetches"
useQuery({ queryKey: ['todos'], queryFn: fetchTodos, staleTime: 60_000 });
```

---

## Gotchas

**★ 🔴 `refetchOnReconnect` does not have a fixed default.** Its TSDoc reads *"Defaults to `true` unless `networkMode` is `'always'`."*, and the Network Mode guide confirms the exception from the other side: *"`refetchOnReconnect` defaults to `false` in this mode, because reconnecting to the network is not a good indicator anymore that stale queries should be refetched."* Teams that set `networkMode: 'always'` once, globally, to make an Electron or React Native build behave, have also switched off reconnect refetching for every query in the app — and nothing in the code they wrote says so. If you set `networkMode: 'always'`, set `refetchOnReconnect` explicitly beside it.

**★ 🔴 The focus trigger fires on visibility, not focus.** The default handler is `window.addEventListener('visibilitychange', …)` and `focusManager.isFocused()` returns `globalThis.document?.visibilityState !== 'hidden'`. MDN: *"visible: … In practice this means that the page is the foreground tab of a non-minimized window."* Alt-tabbing to another application does not change that, so it does not refetch. This is the single most common "refetchOnWindowFocus is broken" report, and the library is behaving exactly as documented.

**★ A focus refetch on fresh data is a no-op, and that is the whole design.** `shouldFetchOn` requires `isStale` unless the option is `'always'`, so with `staleTime: 5 * 60 * 1000` a user who tabs away and back four times in a minute costs zero requests. This is why the guide's advice is *"Setting `staleTime` is the recommended way to avoid excessive refetches"* rather than disabling triggers: `staleTime` is one number that correctly governs all three, while `refetchOnWindowFocus: false` fixes exactly one and leaves mount and reconnect firing.

**★ `staleTime: Infinity` is not a lock — `invalidateQueries` walks straight through it.** Invalidation *"overrides any `staleTime` configurations"*, and an `'always'` trigger ignores staleness by construction. If you genuinely need data that nothing can refetch, the value is `'static'`: *"`queryClient.invalidateQueries()` can invalidate a query with `staleTime: Infinity`, but has no effect on `staleTime: 'static'`."*

**★ `staleTime: 'static'` also blocks `'always'`, which is easy to miss.** The gate checks `staleTime !== 'static'` *before* it looks at the option value, so `refetchOnMount: 'always'` on a `'static'` query does nothing at all. Important Defaults says so directly: *"`refetchOnMount`, `refetchOnWindowFocus`, and `refetchOnReconnect` set to `"always"` are also blocked by `'static'`."* That is a feature when it is deliberate and a silent dead end when someone later adds `'always'` to fix a staleness complaint.

**★ `refetchOnMount` only applies when there is already data.** In `queryObserver.ts`, `shouldFetchOnMount` is `shouldLoadOnMount(...) || (query.state.data !== undefined && shouldFetchOn(..., options.refetchOnMount))`. So `refetchOnMount: false` does not prevent the *initial* load of a query that has never fetched — the TSDoc phrases it as *"will disable additional instances of a query to trigger background refetch."* People set it to `false` expecting a lazy query and get a normal one; `enabled: false` is the option they wanted.

**★ A long `gcTime` does not keep data fresh, and a long `staleTime` does not keep it cached.** `gcTime`'s clock starts *when the last observer unmounts* — *"When a query's cache becomes unused or inactive, that cache data will be garbage collected after this duration"* — and `staleTime`'s clock starts when data is written. Setting `staleTime: Infinity` on a query nobody is mounting still loses the data five minutes after the last unmount, and setting `gcTime: Infinity` on a mounted query still refetches it on every focus.

**★ "When different garbage collection times are specified, the longest one will be used."** Two components observing the same key with different `gcTime` values do not get two behaviours — the query keeps the longest. This bites when a debugging hook with `gcTime: Infinity` is left in a rarely-rendered component: the entry it touched never leaves memory, and the leak is invisible because the option that caused it is in a file nobody associates with the growing cache.

**★ Nothing in this file applies to a query with `enabled: false`.** The gate's first condition is `enabled !== false`, so a disabled query does not refetch on mount, on focus, or on reconnect — and the Disabling/Pausing guide adds one more that surprises people: *"The query will ignore query client `invalidateQueries` and `refetchQueries` calls that would normally result in the query refetching."* A disabled query is not "paused with the triggers still armed"; it is inert until `enabled` flips or you call `refetch()` yourself.

## Interview questions

**★ A user alt-tabs to Slack and comes back. Does the query refetch?**
No — and this is the answer that separates people who have read the implementation from people who have read the option name. `refetchOnWindowFocus` is wired to `visibilitychange`, and `focusManager.isFocused()` is `document.visibilityState !== 'hidden'`. MDN defines `visible` as *"the foreground tab of a non-minimized window"*, so switching to another application leaves the document visible, fires no event, and triggers nothing. Switching to a different browser tab, minimising the window, or locking the screen all do change visibility and will trigger a refetch — provided the data is stale. If OS-level focus really is the signal you need, `focusManager.setEventListener` lets you listen to `focus`/`blur` instead, at the cost of replacing the visibility handler rather than adding to it.

**★ What is the difference between `staleTime` and `gcTime`?**
They answer different questions about different objects. `staleTime` applies to data that something is observing and decides whether a trigger is allowed to refetch it; its documented default is `0`, which is why the library feels eager out of the box. `gcTime` applies to a query with *no* observers and decides how long its data survives before being deleted, defaulting to five minutes. The clocks even start at different moments: `staleTime` from when the data was written, `gcTime` from when the last component unmounted. The practical consequence is that they cannot substitute for one another — `staleTime: Infinity` will not stop an unmounted query being collected, and `gcTime: Infinity` will not stop a mounted one refetching on focus.

**★ Your team wants to stop "too many requests". Do you turn off `refetchOnWindowFocus`?**
Usually not. The three event triggers share one gate that requires the query to be stale, so a `staleTime` of even a few seconds makes all three cheap at once, and the docs recommend exactly that: *"Setting `staleTime` is the recommended way to avoid excessive refetches."* Disabling `refetchOnWindowFocus` fixes one third of the problem, leaves mount and reconnect firing, and — worse — removes the mechanism that keeps a long-lived tab honest, so the app now shows data that is genuinely wrong rather than merely re-fetched. Turn a trigger off when that specific trigger is wrong for that specific data, not as a global throttle.

**★ What still refetches a query with `staleTime: Infinity`?**
Invalidation does, because invalidation *"overrides any `staleTime` configurations being used in `useQuery` or related hooks"*. So does any trigger set to `'always'`, since `'always'` short-circuits the staleness test. And a manual `refetch()` always does. `Infinity` says "this never *goes* stale on its own"; it does not say "nobody may mark it stale". If you need the stronger statement, `staleTime: 'static'` is it — the docs draw the line explicitly, and add that `'static'` blocks the `'always'` triggers too.

**★ When would you choose `'static'` over `Infinity`?**
When the data physically cannot change for the lifetime of the page, and you want that to be enforced rather than merely intended. The guide names the cases: *"feature flags fetched at boot, user permissions loaded at login, static reference tables. Use `Infinity` when you still want manual invalidation to work."* The distinction matters in a large app because `invalidateQueries` is often called with a broad prefix from a mutation somewhere else entirely; `Infinity` will be caught by that prefix and refetch, `'static'` will not. Choosing `'static'` is a decision that a future broad invalidation must not reach this query.

**★ You set `refetchOnMount: false` to make a query lazy. It fetched anyway. Why?**
Because `refetchOnMount` governs *re*fetching, not the initial load. The observer's mount check is *"shouldLoadOnMount(...) || (query.state.data !== undefined && shouldFetchOn(..., refetchOnMount))"* — the option is only consulted when the query already has data, and the TSDoc says as much: *"If set to `false`, will disable additional instances of a query to trigger background refetch."* A query that has never fetched has no data, so the first branch runs and it loads. The option that prevents any automatic fetch is `enabled: false`, which the docs describe as making the query *"not automatically fetch on mount"* and *"not automatically refetch in the background"*.

**★ Two components use the same query key with different options. Whose `gcTime` wins?**
The longest. The TSDoc states it as a rule of the cache, not of the observer: *"When different garbage collection times are specified, the longest one will be used."* That is the safe merge — no observer can shorten another's retention — but it means a single `gcTime: Infinity` anywhere in the app pins that key in memory forever, and the option responsible may live in a component that is almost never rendered. When a cache grows without bound, grep for `gcTime` before you suspect a leak in your own code.

---

← [`useMutation`](../05-usemutation/01-mutation-lifecycle.md) · [Topic index](../README.md) · Next → [Refetch render cost](./01b-refetch-render-cost.md)
