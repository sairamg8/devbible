---
title: "The option-by-option map from RTK Query to TanStack Query — and the four defaults that quietly multiply your request volume"
sidebar_label: "01b · The option map & the defaults"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations) — and this corpus's validated Redux Toolkit pages for the RTK side. Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8** · **@reduxjs/toolkit 2.12.0**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

# 🔁 The Option Map, and the Defaults Nobody Ports

**The options translate almost one-for-one. The *defaults* do not, and that is what people actually report after this migration: "we migrated one screen and our API traffic went up several times over."** Nothing is broken — TanStack Query is doing exactly what its documentation says it does by default, and RTK Query's defaults were quieter. This page is the mapping table, and then the four default changes that produce the traffic, each with the line of configuration that restores the old behaviour.

## 1. The mapping table

| RTK Query | TanStack Query | Same thing? |
|---|---|---|
| `createApi({ endpoints })` | `queryOptions()` factories, or inline `useQuery` | no codegen — see [`01c`](./01c-rtk-query-endpoints-to-query-options.md) |
| `reducerPath` + `api.middleware` in `configureStore` | `new QueryClient()` + `QueryClientProvider` | ✅ |
| `fetchBaseQuery({ baseUrl, prepareHeaders })` | your own `queryFn` — nothing equivalent ships | 🔴 **no** |
| `providesTags` / `invalidatesTags` | key prefixes + `invalidateQueries` filters | 🔴 **no** — see [`01`](./01-rtk-query-to-tanstack-query.md) §3 |
| `keepUnusedDataFor` (default **60s**) | `gcTime` (default **5 minutes**) | same idea, 5× the window |
| `refetchOnMountOrArgChange: N` (seconds) | `staleTime: N * 1000` (ms) + `refetchOnMount` | ⚠️ inverted default |
| `refetchOnFocus` (off; needs `setupListeners`) | `refetchOnWindowFocus` (**on**, no setup call) | ⚠️ inverted default |
| `refetchOnReconnect` (off; needs `setupListeners`) | `refetchOnReconnect` (**on**, no setup call) | ⚠️ inverted default |
| `pollingInterval: 15000` | `refetchInterval: 15000` | ✅ |
| `skipPollingIfUnfocused: true` | `refetchIntervalInBackground` — **the inverse option** | 🔴 inverted *name* |
| `skip: true` | `enabled: false`, or `skipToken` | ✅ — see [`01e` of topic 08](../08-dependent-and-parallel-queries/01e-the-gate-in-full-skiptoken-and-placeholder-chains.md) |
| `api.usePrefetch('endpoint')` | `queryClient.query({ queryKey, queryFn })` | 🔴 **throws** — see [`01n`](./01n-prefetchquery-to-queryclient-query.md) |
| `transformResponse` | transform inside `queryFn` (cached) or `select` (not cached) | 🔴 two different things |
| `selectFromResult` | `select` | ✅ |
| `onQueryStarted` + `queryFulfilled` | `onMutate` / `onError` / `onSettled` | see [`01d`](./01d-rtk-query-mutations-and-rollback.md) |
| `api.util.updateQueryData` | `queryClient.setQueryData` | 🔴 no `undo()` handle |
| `api.util.upsertQueryData` | `queryClient.setQueryData` — *"If the query does not exist, it will be created."* | ✅ one method does both |
| `api.util.invalidateTags([...])` | `queryClient.invalidateQueries({ queryKey })` | ✅ |
| `api.util.resetApiState()` | `queryClient.clear()` | ✅ |
| `isLoading` / `isFetching` | `isPending` / `isFetching` | 🔴🔴 **read the next section** |
| `error: FetchBaseQueryError \| SerializedError` | `error: Error` (whatever `queryFn` threw) | 🔴 different shape |
| retries: opt-in `retry(baseQuery, { maxRetries })` | **3 retries by default**, exponential backoff | 🔴 inverted default |

## 2. 🔴 `isLoading` means three different things across these two libraries

This is the highest-value paragraph on the page, because the name survives the port and nothing warns you.

| | Meaning |
|---|---|
| **RTK Query `isLoading`** | first load of *this cache entry* — no cached data yet |
| **TanStack Query v4 `isLoading`** | `status === 'loading'` — no data yet, **including a query that is disabled and has never run** |
| **TanStack Query v5 `isLoading`** | `isPending && isFetching` — no data yet **and a request is actually in flight** |

A straight port of `const { data, isLoading } = useGetUserQuery(id)` to `const { data, isLoading } = useQuery(...)` lands you on the *third* meaning. For a plain always-enabled query the three coincide and everything looks fine. They diverge exactly where a query is **not fetching**: `enabled: false`, `skipToken`, or paused because the browser is offline. There, v5's `isLoading` is `false` while `data` is still `undefined` — so `if (isLoading) return <Spinner />; return <h1>{data.name}</h1>` reads a property of `undefined`.

**The correct port of RTK Query's `isLoading` is TanStack Query v5's `isPending`.**

```tsx
// ❌ WRONG: the name ported cleanly and the meaning did not.
//    With enabled:false — or simply offline — isLoading is false and data is undefined.
const { data, isLoading } = useQuery({ queryKey: ['users', 'detail', id], queryFn, enabled: !!id });
if (isLoading) return <Spinner />;
return <h1>{data.name}</h1>;            // 💥 undefined when the query never ran

// ✅ CORRECT: isPending is "there is no data for this key", which is what RTK's isLoading meant.
//    isLoading is then available for the narrower question: "is a first fetch in flight right now?"
const { data, isPending, isLoading, isError } = useQuery({
  queryKey: ['users', 'detail', id],
  queryFn,
  enabled: !!id,
});
if (isError) return <ErrorBanner />;
if (isPending) return isLoading ? <Spinner /> : <WaitingForInput />;
return <h1>{data.name}</h1>;            // data is narrowed to defined here
```

The status vocabulary itself is worth internalising once, because it is the thing the whole library is built on:

> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*

[Query States](../03-query-states/01-status-flags.md) is the full treatment. The v4 → v5 half of this same trap — the *upgrade* rather than the port — is [`01h`](./01h-the-status-rename-and-the-isloading-trap.md).

## 3. The four defaults that produce the traffic

### 3a. Data is stale the instant it arrives

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*
> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

RTK Query's `refetchOnMountOrArgChange` defaults to *not* refetching when a cache entry exists. TanStack Query's `staleTime` defaults to `0`, so **every mount of every component that calls `useQuery` issues a request**. A table of 30 rows where each row calls `useQuery` for a badge is 30 requests on mount, then 30 more the next time the user navigates back.

### 3b. Window focus and reconnect refetch without any setup

In RTK Query those two are opt-in twice over: set the option, *and* call `setupListeners(store.dispatch)`. Miss the second and nothing happens — a well-known silent no-op. TanStack Query has no `setupListeners`; focus and reconnect refetching are on. Combined with 3a, alt-tabbing back to the app refetches **everything currently mounted**.

### 3c. Failed queries retry three times

> *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."*

If your RTK Query base query was never wrapped in RTK Query's `retry()` utility, you had no retries at all. A 404 that used to be one request and an instant error state is now four requests and a visibly delayed error. Note the asymmetry, which matches RTK Query's: *"By default, TanStack Query will not retry a mutation on error"*.

### 3d. Unused data survives five minutes, not sixty seconds

> *"By default, 'inactive' queries are garbage collected after 5 minutes."*

`keepUnusedDataFor` defaults to 60 seconds. `gcTime` defaults to 300. That is not a traffic change, it is a *memory* and *freshness* change: a back-navigation four minutes later renders four-minute-old data instantly where RTK Query would have shown a spinner and refetched.

### The one configuration block that reconciles all four

Put it on the client, not on 200 call sites — [Global Configuration](../13-global-configuration/01-defaultoptions.md) is the page for the mechanics.

```typescript
import { QueryClient } from '@tanstack/react-query';

// Defaults chosen to approximate what RTK Query was doing before the migration,
// so the port is behaviour-neutral and you can then tune deliberately, per query.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,            // RTK: refetchOnMountOrArgChange was off by default
      gcTime: 60_000,               // RTK: keepUnusedDataFor default is 60s, not 300s
      refetchOnWindowFocus: false,  // RTK: needed setupListeners + the option
      refetchOnReconnect: false,    // same
      retry: 0,                     // RTK: retries were an explicit retry() wrapper
    },
  },
});
```

🔴 **Ship that block, then remove the lines one at a time on purpose.** Every one of those defaults is a good default; the mistake is meeting all four of them on the same afternoon as a rewrite, so you cannot tell which change caused what.

## Gotchas

**★ Symptom: API request volume jumps sharply after migrating a single screen.** Cause: `staleTime: 0` plus focus and reconnect refetching, both on by default, where RTK Query had all three effectively off. Fix: the `defaultOptions` block above, then relax it per query. Do not diagnose this by reading component code — the change is in the client's defaults, which is a file nobody looked at during the port.

**★ Symptom: `skipPollingIfUnfocused: true` has no counterpart and you write a Page Visibility listener.** Cause: the counterpart exists with the opposite polarity. `refetchIntervalInBackground` asks whether polling should *continue* when the window is unfocused; `skipPollingIfUnfocused` asks whether it should *stop*. Fix: leave `refetchIntervalInBackground` unset — background polling is not the default — and delete the listener. Polling detail lives in [`01c` of topic 06](../06-background-refetching/01c-polling-and-refetch-interval.md).

**★ Symptom: `error` renders as `[object Object]` or as the wrong message after the port.** Cause: RTK Query *returns* errors as a `FetchBaseQueryError | SerializedError` union with a `status` and `data`; TanStack Query surfaces whatever your `queryFn` **threw**. `String(error)` over an RTK error object was already poor, and over a thrown `Error` it now produces `Error: …`. Fix: throw a typed error from `queryFn` and read `error.message`; the shape is yours to define, which is the point. Worked in [`01c`](./01c-rtk-query-endpoints-to-query-options.md).

**★ Symptom: a fetch that used to fail immediately now takes several seconds to show an error.** Cause: three silent retries with exponential backoff, on by default. Fix: `retry: 0` globally while you migrate, or `retry: (count, error) => count < 3 && !isClientError(error)` so 4xx fails fast and 5xx retries — which is what most teams actually want and neither library gives you out of the box.

**★ Symptom: tests that passed under RTK Query hang or time out under TanStack Query.** Cause: the same three retries, in a test that asserts an error state. Fix: `retry: false` in the test client. That, and a fresh client per test, is [Testing TanStack Query](../15-testing-tanstack-query/01-isolated-and-integration-testing.md).

**★ Symptom: `useQuery` fires on mount even though you just prefetched it.** Cause: `staleTime: 0` means the prefetched entry is already stale when the component mounts, so the mount refetch is not skipped. Fix: give prefetched keys a non-zero `staleTime`; a prefetch only pays for itself if the data is still considered fresh when the component arrives.

**★ Symptom: you set `keepUnusedDataFor: 60`'s equivalent as `gcTime: 60` and cache entries vanish immediately.** Cause: RTK Query's option is in **seconds**; every TanStack Query duration is in **milliseconds**. `gcTime: 60` is 60ms. Fix: `gcTime: 60_000`. The same unit trap applies to `refetchOnMountOrArgChange: 30` → `staleTime: 30_000`.

## Interview questions

**★ A team migrates one screen from RTK Query to TanStack Query and their backend sees several times the request volume. Diagnose it.**
Defaults, not code. TanStack Query considers cached data stale immediately, and refetches stale queries when a new instance mounts, when the window is refocused and when the network reconnects — all three on by default. RTK Query's equivalents were off: `refetchOnMountOrArgChange` defaults to not refetching over an existing entry, and `refetchOnFocus`/`refetchOnReconnect` need both the option *and* a `setupListeners` call. Add three silent retries per failure and a screen with twenty `useQuery` calls generates an order of magnitude more traffic without a single line of component code being wrong. The fix is a `defaultOptions` block on the `QueryClient`, then relaxing it deliberately.

**★ What is the correct TanStack Query v5 flag to replace RTK Query's `isLoading`, and why is it not `isLoading`?**
`isPending`. RTK Query's `isLoading` means "no cached data for this entry yet". TanStack Query v5's `isLoading` is defined as `isPending && isFetching` — no data *and* a request currently in flight. They agree for a plain always-enabled query and diverge wherever the query is not fetching: disabled by `enabled: false`, gated by `skipToken`, or paused offline. In those cases v5's `isLoading` is `false` while `data` is `undefined`, so an `isLoading` guard falls through to code that dereferences undefined data.

**★ RTK Query needed `setupListeners`. What is the equivalent call in TanStack Query?**
There isn't one, and that is the interesting part. Focus and reconnect refetching are built in and enabled by default, so the RTK Query failure mode — options set, listeners never installed, nothing ever refetches — is impossible. The mirrored failure mode replaces it: refetching you never asked for and did not notice you enabled, on every tab switch.

**Why is `transformResponse` not simply `select`?**
Because they run at different places and cache differently. RTK Query's `transformResponse` runs once, before the value is stored, so the cache holds the transformed shape. TanStack Query's `select` runs per observer over the cached raw data, so the cache holds the response and each component can derive a different view of it. If you want RTK Query's behaviour — one transform, cached — do it inside `queryFn`. If you want per-component derivation with structural-sharing-based render skipping, use `select`. Porting a `transformResponse` into `select` gives you a transform that runs more often than it used to and a cache full of untransformed data, which matters the moment something calls `getQueryData` expecting the transformed shape.

**How do the two libraries' retry philosophies differ, and does it matter?**
RTK Query ships no retries unless you wrap the base query in its `retry()` utility. TanStack Query retries queries three times with exponential backoff by default, and — the symmetry people miss — does **not** retry mutations by default. It matters twice: an error state that used to appear instantly now appears after the backoff, and a test asserting that error state waits through the full sequence unless the test client sets `retry: false`.

---

← [RTK Query → TanStack Query](./01-rtk-query-to-tanstack-query.md) · [Topic index](../README.md) · Next → [Endpoints → `queryOptions`](./01c-rtk-query-endpoints-to-query-options.md)
