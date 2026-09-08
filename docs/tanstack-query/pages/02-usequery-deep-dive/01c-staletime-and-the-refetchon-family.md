---
title: "`staleTime` is the option that decides whether a refetch trigger does anything at all, and the three `refetchOn*` flags only choose which triggers are wired up"
sidebar_label: "01c · `staleTime` & `refetchOn*`"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Caching](https://tanstack.com/query/latest/docs/framework/react/guides/caching), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode). The `refetchOn*` **default values** are not printed on Important Defaults; they are quoted from the option TSDoc via the validated sibling page [06/01](../06-background-refetching/01-automatic-freshness.md). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# ⏱️ `staleTime` and the `refetchOn*` Family: One Gate and Three Switches

**Four options look like four ways to control refetching. They are not peers.** `staleTime` is a gate every automatic refetch has to pass; the three `refetchOn*` flags only decide which *events* are allowed to knock on that gate. Turning a flag off removes one trigger and leaves the other two; setting `staleTime` correctly makes all three no-ops for exactly as long as the data is genuinely valid. That is why "we turned off refetch-on-focus and it still refetches constantly" is such a common report — the wrong layer was configured.

## 1. The two layers, in order

An automatic refetch happens when **an event fires** *and* **the data is stale**.

```
  mount ─┐
  focus ─┼─► is this trigger enabled? ──► is the data stale? ──► fetch
reconnect┘   (refetchOnMount /              (staleTime)
              refetchOnWindowFocus /
              refetchOnReconnect)
```

Important Defaults states both halves. The default staleness:

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*

so `staleTime` is `0` and everything is stale the instant it arrives. And the triggers:

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

Note the first word of that sentence: **stale** queries. With a non-zero `staleTime`, all three events still fire and all three are cheap no-ops. That is the whole design — you are not meant to disable the triggers, you are meant to tell the library how long the data is good for.

`refetchInterval` is deliberately **not** on that list. Polling is a separate clock with separate rules — [06/01c](../06-background-refetching/01c-polling-and-refetch-interval.md).

## 2. `staleTime`: `number | 'static'`, and what each end means

| Value | Meaning | Still refetches on… |
|---|---|---|
| `0` (default) | stale immediately | mount, focus, reconnect, invalidation, `refetch()` |
| `n` ms | fresh for `n` ms after `dataUpdatedAt` | the same triggers, once `n` has passed |
| `Infinity` | never becomes stale on its own | invalidation, `'always'` triggers, `refetch()` |
| `'static'` | never stale, and invalidation cannot override it | `refetch()` only |

The line between the last two is drawn on Important Defaults itself:

> *"`'static'` and `Infinity` both prevent staleness-based refetches, but `'static'` is stricter: `queryClient.invalidateQueries()` can invalidate a query with `staleTime: Infinity`, but has no effect on `staleTime: 'static'`. `refetchOnMount`, `refetchOnWindowFocus`, and `refetchOnReconnect` set to `"always"` are also blocked by `'static'`. Use `'static'` for data that cannot change while the app is running: feature flags fetched at boot, user permissions loaded at login, static reference tables. Use `Infinity` when you still want manual invalidation to work."*

That paragraph answers the question people ask about `Infinity` — *what still gets through?* — with a list: invalidation does, and so does any trigger set to `'always'`. Invalidation wins because the stale mark is not a time comparison: *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*.

🔴 **`staleTime` is a per-query decision, not a global preference.** The right value is a fact about the data, not about the app: a metrics rollup recomputed hourly is valid for minutes, a chat thread for seconds, a currency list for a session. A single global `staleTime` is a statement that every endpoint in your product changes at the same rate, which is never true.

## 3. The three flags: `true | false | 'always'`

Each of `refetchOnMount`, `refetchOnWindowFocus` and `refetchOnReconnect` takes `true`, `false` or `'always'`, and the semantics are uniform:

- **`true`** — the event fires a refetch **if the data is stale**.
- **`false`** — the event is ignored entirely.
- **`'always'`** — the event fires a refetch **regardless of staleness** (and is itself blocked by `staleTime: 'static'`, per the quote above).

⚠️ **Provenance matters here.** The Important Defaults page *names* these three options but does not print their default values. The option TSDoc does, and the validated [06/01](../06-background-refetching/01-automatic-freshness.md) quotes it: `refetchOnMount` and `refetchOnWindowFocus` are documented *"Defaults to `true`."*, while `refetchOnReconnect` is documented *"Defaults to `true` unless `networkMode` is `'always'`."* — the Network Mode guide giving the reason: *"`refetchOnReconnect` defaults to `false` in this mode, because reconnecting to the network is not a good indicator anymore that stale queries should be refetched."*

That exception is a live trap: setting `networkMode: 'always'` globally — routine in Electron and React Native — silently turns reconnect refetching off for the entire app, and nothing in the code you wrote says so.

Two more facts worth having before you touch these flags:

- **"Window focus" is really document *visibility*.** The implementation listens for `visibilitychange`, so alt-tabbing to your editor and back does **not** refetch, while switching browser tabs, minimising and unlocking the screen do. Worked through with the handler source in [06/01](../06-background-refetching/01-automatic-freshness.md).
- **A background refetch never resets `status` to `pending`.** There is data, so the cached value stays on screen for the whole fetch. What it costs you in re-renders is [06/01b](../06-background-refetching/01b-refetch-render-cost.md).

## 4. Choosing between them, with code

```tsx
// ✅ The data's own validity period, expressed once, in the hook that owns it.
export function useExchangeRates() {
  return useQuery({
    queryKey: ['rates'],
    queryFn: fetchRates,
    staleTime: 15 * 60_000,   // the provider publishes every 15 minutes; anything sooner is noise
    gcTime: 60 * 60_000,      // outlive the staleTime so navigating back is instant, not a cold fetch
  });
}

// ✅ A dashboard tile that must be correct the moment the operator looks at it,
// even though it is otherwise cheap to leave alone.
export function useIncidentCount() {
  return useQuery({
    queryKey: ['incidents', 'count'],
    queryFn: fetchIncidentCount,
    staleTime: 60_000,
    refetchOnWindowFocus: 'always',   // returning to the tab is exactly when correctness matters
  });
}

// ⚠️ The shape to be suspicious of: three switches off, staleTime untouched.
export function useSomething() {
  return useQuery({
    queryKey: ['thing'],
    queryFn: fetchThing,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,        // the data is still stale-immediately; every invalidation,
  });                                 // every refetch() and every new key still hits the network
}
```

The third block is not wrong so much as *misaimed*. It expresses "stop making requests" by removing triggers, which leaves the data permanently marked stale and leaves every other path to the network open. `staleTime` expresses the actual belief — "this is good for N minutes" — and suppresses all three triggers at once.

### When flags *are* the right tool

- **`refetchOnWindowFocus: false` for a form-heavy screen** where a mid-edit background update would replace fields the user is typing into. Here the objection is not to the request but to the data changing at that moment.
- **`refetchOnMount: false` for a widget mounted many times per screen** where the mount storm, not the staleness, is the problem.
- **`'always'` for something safety-relevant** — an incident count, a balance before a transfer — where a stale-but-fresh-by-the-clock value is worse than a redundant request.

### SSR flips the default the other way

> *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*

With the default `staleTime: 0`, data you rendered on the server is stale before hydration finishes, so the very first client mount refetches everything you just paid to render. See [prefetching & SSR](../09-prefetching-and-ssr/01-server-rendered-data-flow.md).

## Gotchas

**★ Symptom: `refetchOnWindowFocus: false` did not stop the refetching.** Cause: the flag removes one of three triggers. Remount (route changes, tab components, list virtualisation) and reconnect are still wired, and the data is still stale-immediately, so anything that mounts a new observer fetches. Fix: set `staleTime` to the data's real validity period — it neutralises all three triggers at once and leaves the events in place for when the data genuinely is old.

**★ Symptom: setting `networkMode: 'always'` globally quietly disabled reconnect refetching.** Cause: `refetchOnReconnect` is documented *"Defaults to `true` unless `networkMode` is `'always'`."* and the Network Mode guide states the reason outright. Fix: if you set `networkMode: 'always'` (Electron, React Native, a custom transport) and still want reconnect behaviour, set `refetchOnReconnect: true` explicitly. Nothing warns you.

**★ Symptom: `staleTime: Infinity` still refetched.** Cause: `Infinity` only blocks *staleness-based* refetches. `invalidateQueries` overrides it — *"This stale state overrides any `staleTime` configurations"* — and any trigger set to `'always'` bypasses it too. Fix: if the data genuinely cannot change while the app runs, `staleTime: 'static'` is the setting that also blocks those; if it can change, `Infinity` plus targeted invalidation is correct and the refetch you saw was the system working.

**★ Symptom: `staleTime: 'static'` made a page impossible to refresh.** Cause: that is precisely what it is for — invalidation has no effect and `'always'` triggers are blocked. Fix: only `refetch()` (and a fresh page load) will move it. Use `'static'` for boot-time facts — feature flags, permissions, reference tables — and `Infinity` for anything a mutation might legitimately need to invalidate.

**★ Symptom: a long `staleTime` did not make back-navigation instant.** Cause: freshness and existence are different clocks. If `gcTime` is shorter than `staleTime`, the entry is evicted while unobserved and the return trip is a cold `pending` fetch — the `staleTime` bought nothing. Fix: whenever you raise `staleTime`, raise `gcTime` to at least match it. The two-clock model is in [`01`](./01-core-options.md).

**★ Symptom: after the SSR pages went live, the browser refetched everything on first paint.** Cause: the default `staleTime: 0` marks server-rendered data stale before hydration completes, and the first mount is one of the three documented triggers. Fix: the docs' own advice — *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"* — set it in `defaultOptions` on the client and per-query where the data warrants more.

**★ Symptom: a global `staleTime: 5 * 60_000` fixed the request volume and introduced a data-freshness bug.** Cause: one number was applied to endpoints with wildly different change rates; the chat unread badge is now five minutes behind. Fix: keep the global default conservative and set `staleTime` per query, next to the `queryFn` that owns the endpoint. Where a global is genuinely wanted, `queryClient.setQueryDefaults` with a key prefix is the middle ground — and note that in v5 *"`queryClient.getQueryDefaults` will now merge together all matching registrations instead of returning only the first"*, so register from most generic key to least.

**★ Symptom: `refetchOnMount: 'always'` produced a request storm on a list screen.** Cause: `'always'` bypasses the staleness check, and a virtualised or paginated list mounts the same hook many times as rows enter the viewport — every mount is a new observer, and every observer's mount is a trigger. Fix: `'always'` belongs on a small number of high-stakes queries, never as a default; use a short `staleTime` instead when the goal is "reasonably current".

**★ Symptom: alt-tabbing between the browser and an editor never triggers the "focus" refetch that the docs promise.** Cause: the option is named for focus but the implementation listens for `visibilitychange`, which does not fire when the same tab in the same un-minimised window merely loses OS focus. Fix: nothing to fix — but test the behaviour by switching *tabs* or minimising, otherwise you will conclude the option is broken. Details and the handler source: [06/01](../06-background-refetching/01-automatic-freshness.md).

**★ Symptom: a query with `staleTime` set still refetches every time a mutation runs.** Cause: the mutation's `onSettled` invalidates the key, and invalidation ignores `staleTime` by design — *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*. Fix: this is usually correct; if the invalidation is too broad, narrow the key it targets rather than raising `staleTime`, because raising `staleTime` cannot stop it anyway.

**★ Symptom: `staleTime` set on one component had no effect, because another component set a shorter one.** Cause: one cache entry, many observers, each with its own options. The entry refetches when *any* observer's rules say it should, so the shortest `staleTime` among the observers effectively wins. Fix: never configure the same key in two places. Put the options in one custom hook (or one `queryOptions()` factory — **`01g`** *(not written yet)*) and import it everywhere.

## Interview questions

**★ A page refetches on every tab switch. Do you set `refetchOnWindowFocus: false` or a `staleTime`?**
`staleTime`, almost always. The flag treats a symptom on one of three triggers and leaves the data marked permanently stale, so remounts and reconnects keep fetching. `staleTime` encodes the actual claim — this data is valid for N — and makes all three triggers cheap no-ops for that period. Reach for `refetchOnWindowFocus: false` only when the objection is to the *update itself* rather than to the request: a form the user is typing into, a virtualised table whose scroll position would jump.

**★ What is the difference between `staleTime: Infinity` and `staleTime: 'static'`?**
Both stop staleness-based refetching. `'static'` additionally cannot be overridden: *"`queryClient.invalidateQueries()` can invalidate a query with `staleTime: Infinity`, but has no effect on `staleTime: 'static'`"*, and `'always'` triggers are blocked by it too. So `Infinity` means "do not go looking, but I may tell you it changed"; `'static'` means "this cannot change while the app is running". Feature flags read at boot and permissions loaded at login are the canonical `'static'` cases; a rarely-changing settings object that an admin screen can edit is an `Infinity` case, because the edit needs to be able to invalidate it.

**★ What does `'always'` mean on the three flags, and when is it justified?**
It skips the staleness check: the event refetches unconditionally. It is justified when a stale-but-technically-fresh value is worse than a redundant request — an account balance shown before a transfer, an incident count an operator returns to the tab to read. It is not justified as a default, because every mount of every observer becomes a request, which on a virtualised list is a storm. And it does not survive `staleTime: 'static'`, which blocks it explicitly.

**★ Why does the reconnect flag have a conditional default when the other two do not?**
Because `networkMode: 'always'` declares that the browser's online status is irrelevant to whether your queries can run — an Electron app talking to a local service, a React Native app with a custom transport. In that world a reconnect event is not evidence that anything went stale, so the library turns the trigger off: *"reconnecting to the network is not a good indicator anymore that stale queries should be refetched."* The trap is that the two options are usually set in different places, months apart, so the coupling is invisible at the call site.

**★ Two components use the same key with different `staleTime` values. What happens?**
There is one cache entry and several observers, each evaluating its own options. The entry refetches whenever any observer's rules call for it, so in practice the shortest `staleTime` decides the refresh rate for everyone, and the component that carefully set five minutes gets thirty-second data. The fix is structural rather than numerical: one key, one place that configures it — a custom hook or a shared `queryOptions()` object — and call sites that never restate cache policy.

**★ You have a page that must render instantly on back-navigation and must never show data older than a minute. Which options, and in what order do they apply?**
`staleTime: 60_000` so a return within the minute is a pure cache hit, `gcTime` well above that (say fifteen minutes) so the entry actually survives the round trip, and the default `refetchOnMount: true` left alone so a return *after* the minute shows the cached value immediately and refreshes it behind a subtle indicator. The order that matters is the gate order: the mount event fires first, the staleness check decides whether it becomes a request, and `gcTime` decides whether there was anything to show while that request ran.

---

← [`enabled` & `skipToken`](./01b-enabled-and-skiptoken.md) · [Topic index](../README.md) · Next → [`retry`, `retryDelay` & `throwOnError`](./01d-retry-retrydelay-and-throwonerror.md)
