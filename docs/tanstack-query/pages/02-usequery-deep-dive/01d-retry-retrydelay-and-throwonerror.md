---
title: "Queries retry three times with backoff before the UI ever hears about the failure, and `throwOnError` — the v5 rename of `useErrorBoundary` — takes a predicate whose default lets background failures pass silently"
sidebar_label: "01d · `retry` & `throwOnError`"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense), [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode), [Mutations (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/mutations). ⚠️ The Query Retries guide was **not** fetched in this pass (one-fetch budget); the exact default `retryDelay` formula is therefore stated as unverified below rather than quoted. Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 💥 `retry`, `retryDelay` and `throwOnError`: Failure Is Delayed, Then Conditional

**A failing query does not become an error in your component — it becomes an error some seconds later, after the library has quietly tried three more times.** And whether that error reaches an error boundary is decided by a predicate, not a boolean, whose default deliberately lets a *background* failure pass without a sound. Both behaviours are correct and both are invisible in the code you wrote, which is why error handling in TanStack Query is so often described as "sometimes it shows the error and sometimes it doesn't".

## 1. The default is three silent retries with backoff

> *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."*

Three things live in that one sentence, and each has consequences:

- **`retry` defaults to `3`.** Four attempts in total, not three.
- **The retries are *silent*.** Throughout them the query is still `status: 'pending'` (no data) with `fetchStatus: 'fetching'`. Nothing in the result object says "attempt 3 of 4" unless you go looking; your loading state simply stays on screen.
- **The error is displayed only after the last attempt fails.** So the time between "the API is down" and "the user sees an error" is the sum of the backoff delays, not one request timeout. A user who clicks away during that window never sees the error at all.

⚠️ **The exact default `retryDelay` formula is not asserted on this page.** Important Defaults settles the *shape* — exponential backoff — and that is all this chunk claims; the formula is printed on the Query Retries guide, which was not fetched in this pass. Do not copy a formula out of memory into a code review comment; read the guide.

🔴 **On the server, the default is different.** The migration guide: *"`retry` now defaults to `0` instead of `3`"* on the server. A prefetch inside a server render fails fast rather than holding the response open through a backoff sequence — which also means a flaky upstream produces a *client*-side retry story and a *server*-side immediate failure from identical code.

And the asymmetry that catches everyone coming from mutations: *"By default, TanStack Query will not retry a mutation on error"*. Reads retry, writes do not — because retrying a non-idempotent write is a correctness decision only you can make.

## 2. `retry` is a number, a boolean, or a predicate

```tsx
useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
  // A 404 is an answer, not a failure. Retrying it wastes four requests and four
  // backoff intervals before showing the user the "not found" they could have had at once.
  retry: (failureCount, error) => {
    if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
    return failureCount < 3;
  },
});
```

The predicate form is the one that belongs in most production apps, because the built-in default treats every rejection identically. A 401, a 403, a 404 and a validation 422 are all *decisions* the server has made; repeating the request cannot change any of them. Only 5xx, network faults and timeouts are worth another attempt.

`retryDelay` accepts a number (fixed delay) or a function of the attempt index:

```tsx
useQuery({
  queryKey: ['report'],
  queryFn: fetchReport,
  retry: 2,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
});
```

That function is **example code, not the documented default** — it is a reasonable capped-exponential policy you might write. If you need to know what the library does when you leave `retryDelay` alone, read the Query Retries guide; the accepted forms are also recorded as unverified in [15/01d](../15-testing-tanstack-query/01d-suspense-and-harness-hazards.md).

There is also a `retryOnMount` option governing whether a query that is already in an error state retries when a new observer mounts. **I could not confirm its default from a primary source in this pass** — treat it as something to look up rather than something to assume.

### Retries pause when you go offline

> *"If a query runs because you are online, but you go offline while the fetch is still happening, TanStack Query will also pause the retry mechanism. Paused queries will then continue to run once you re-gain network connection. This is independent of `refetchOnReconnect` (which also defaults to `true` in this mode), because it is not a `refetch`, but rather a `continue`. If the query has been cancelled in the meantime, it will not continue."*

So a retry sequence interrupted by a lost connection does not burn its remaining attempts against a dead network — it stops at `fetchStatus: 'paused'` and resumes. The offline surface in full: [06/01d](../06-background-refetching/01d-network-mode-and-offline.md).

## 3. `throwOnError` is a predicate, and its default is the load-bearing part

The v5 rename is mechanical — *"`useErrorBoundary` → `throwOnError`"* — but the option was never a plain boolean, and under suspense the default is a function:

```ts
throwOnError: (error, query) => typeof query.state.data === 'undefined'
```

The suspense guide states what that means in prose:

> *"Not all errors are thrown to the nearest Error Boundary per default - we're only throwing errors if there is no other data to show."*

Read the predicate carefully, because it splits your failures in two:

- **Cold failure** — nothing cached for this key, `query.state.data` is `undefined`, the error is thrown and the boundary renders.
- **Background failure** — a refetch of a key that already has data fails. `query.state.data` is defined, the predicate returns `false`, and **nothing is thrown**. The stale data stays on screen and the user is told nothing.

That is a deliberate and usually correct trade: replacing a working screen with a full-page error because a background refresh 502'd would be worse. But it means "we put an error boundary around it" is not a claim that failures are visible. Under the suspense hooks it is sharper still, because those hooks removed the `isError` branch you would otherwise have rendered a banner from.

If you want everything at the boundary, the guide gives the manual throw:

```tsx
const { data, error, isFetching } = useSuspenseQuery({ queryKey, queryFn })
if (error && !isFetching) { throw error }
```

🔴 **The `!isFetching` guard is load-bearing.** Without it you throw *during* the retry window and defeat the three retries you were relying on. Note also that this snippet proves `error` and `isFetching` are still on the suspense result — suspense removes the *need* to branch, not the fields.

On a regular `useQuery`, the predicate is where policy belongs:

```tsx
useQuery({
  queryKey: ['invoice', id],
  queryFn: () => fetchInvoice(id),
  // expected failures stay inline (render a "not found" panel); the unexpected ones escalate
  throwOnError: (error) => !(error instanceof HttpError) || error.status >= 500,
});
```

The full boundary story — why a plain "Try again" button does nothing without `QueryErrorResetBoundary`, and where placement decides which region a reset clears — is [10/01c](../10-suspense-integration/01c-errors-boundaries-and-reset.md).

## 4. How the three options compose

The order of events for a failing query is fixed, and every option acts at one point in it:

```
queryFn rejects
   └─► retry predicate? ──yes──► wait retryDelay ──► queryFn again  (status stays 'pending')
        │no / attempts exhausted
        ▼
   status: 'error', error populated
        └─► throwOnError predicate? ──true──► thrown to the nearest Error Boundary
                                     └─false─► stays in the result; you render it inline
```

Two consequences fall straight out of that diagram. A boundary that renders after a five-second delay is not slow — it is waiting for the retries, and `retry: false` (or a predicate that rejects 4xx immediately) is the fix, not anything about the boundary. And a query that shows stale data with no error at all has not swallowed the failure: `status` is `'error'`, `error` is populated, and the `throwOnError` predicate simply said no.

## Gotchas

**★ Symptom: an obviously-broken endpoint takes several seconds to show an error.** Cause: the default is *"silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI"* — four attempts and the delays between them all happen before your error branch renders once. Fix: a `retry` predicate that refuses to retry 4xx responses. A 404 becomes visible on the first attempt, and genuine 5xx flakiness keeps its retries.

**★ Symptom: an error boundary never fires even though the request is failing.** Cause: the default `throwOnError` predicate is `typeof query.state.data === 'undefined'`, and this key already has cached data, so nothing is thrown. Fix: decide deliberately. If a stale screen is acceptable, add a visible "could not refresh" indicator driven off `isError`; if it is not, pass your own predicate. Do not conclude the boundary is misconfigured.

**★ Symptom: a 401 triggers four requests and four audit-log entries per page load.** Cause: the default retry treats an authorisation decision as a transient fault. Fix: `retry: (count, error) => !isAuthError(error) && count < 3`, and handle the 401 where it belongs — a global handler that redirects to login, not a retry loop that hammers an endpoint which has already said no.

**★ Symptom: server-rendered pages fail instantly while the same code retries in the browser.** Cause: *"`retry` now defaults to `0` instead of `3`"* on the server. Fix: nothing, usually — failing fast on the server is the right default for a request that is holding a response open. But do not diagnose a flaky upstream from server logs alone; the client is quietly absorbing three attempts the server never made.

**★ Symptom: retries are configured on a mutation and never happen.** Cause: *"By default, TanStack Query will not retry a mutation on error"* — the option exists but the default is off, the opposite of queries. Fix: set `retry` explicitly on the mutation, and only after deciding the operation is idempotent or the server deduplicates it. A retried POST that creates two orders is a worse outcome than the error you were avoiding.

**★ Symptom: the test suite is slow and flaky because of retries.** Cause: a failing request in a test still runs the full retry-and-backoff sequence, so a "this errors" test waits out real timers. Fix: `retry: false` in the test `QueryClient` defaults. Note that this removes the backoff only — a `setTimeout` in your mock or MSW handler is a separate delay, as [15/01](../15-testing-tanstack-query/01-isolated-and-integration-testing.md) records.

**★ Symptom: `throwOnError: true` was switched on globally and unrelated screens became brittle.** Cause: the blanket boolean escalates *every* failure to a boundary, including background-refetch failures on screens that were rendering perfectly well from cache. Fix: use the predicate. Escalate what is genuinely unexpected — 5xx, non-HTTP exceptions — and keep expected, addressable failures inline where the component can explain them.

**★ Symptom: a manual `throw error` under suspense defeats the retries.** Cause: throwing on the first render where `error` is set happens *during* the retry window, so the boundary renders before the second attempt has run. Fix: the guide's own guard — `if (error && !isFetching) { throw error }` — so the throw waits until nothing is in flight.

**★ Symptom: losing Wi-Fi mid-request burns all remaining retry attempts.** Cause: it does not, and expecting it to is the actual bug in the mental model. The retry mechanism pauses — *"Paused queries will then continue to run once you re-gain network connection… it is not a `refetch`, but rather a `continue`"* — so the query sits in `fetchStatus: 'paused'`. Fix: render for `paused`, not just `fetching`; a spinner with no network behind it is indistinguishable from a slow request unless you check `fetchStatus`.

**★ Symptom: `failureCount` was used to render "retrying 2 of 3" and the numbers looked wrong.** Cause: the result does expose retry progress, but the exact semantics of the counter (when it resets, whether it counts the initial attempt) are **not confirmed by any primary source read in this pass**. Fix: verify against the options/result reference before shipping a user-visible counter driven off it; a wrong number in a retry indicator is worse than no indicator.

## Interview questions

**★ An endpoint is down. Walk me through what the user sees, second by second, with default options.**
The first request fails and nothing changes on screen — `status` stays `'pending'`, `fetchStatus` stays `'fetching'`, and the skeleton or spinner remains. The library retries three more times with exponential backoff, still silently. Only when the fourth attempt fails does `status` become `'error'` and your error branch render for the first time: *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."* So the user experiences a long load followed by an error, and if they navigate away in the meantime they experience only a long load.

**★ Why should a 404 not be retried, and how do you express that?**
Because a 404 is a completed, authoritative answer: the resource does not exist, and asking again cannot change it. Retrying costs four requests, four log lines, and several seconds of the user staring at a spinner before being told something the first response already knew. Express it with the predicate form of `retry` — return `false` for 4xx (or for a specific list of statuses your API uses meaningfully) and fall back to a failure-count limit for everything else. The same argument applies to 401 and 403, with the extra sting that repeated auth failures may trip rate limits or security alerting.

**★ `throwOnError` — what changed in v5 and what is its default?**
The name changed: *"`useErrorBoundary` → `throwOnError`"*. The behaviour that matters did not, and it is not a boolean by nature — it is a predicate `(error, query) => boolean`. Under suspense the default is `(error, query) => typeof query.state.data === 'undefined'`, described in prose as *"we're only throwing errors if there is no other data to show."* So a cold-load failure reaches the nearest boundary and a background-refetch failure does not. Any statement that "with `throwOnError` every error goes to the boundary" is describing the blanket `true` you would have to opt into.

**★ A screen shows stale data and no error while the API is returning 500s. Is that a bug?**
Not necessarily — it is the documented default doing its job, because there is data to show and replacing a working screen with an error page is usually the worse outcome. The failure is not hidden from *you*: `status` is `'error'` and `error` is populated on the result. What is missing is a UI decision. Render something off `isError` — a "last updated at, could not refresh" line — so the user knows the numbers are frozen. Escalating to the boundary instead is a choice you can make with a custom predicate, and it should be a deliberate one.

**★ Why do queries retry by default and mutations not?**
Because a read is idempotent by construction and a write is not. Repeating a GET that failed on a flaky connection costs nothing but a request; repeating a POST may create a second order, send a second email, or charge a second time. The docs state both sides — queries are *"silently retried 3 times"*, while *"By default, TanStack Query will not retry a mutation on error"* — and the asymmetry is a deliberate refusal to guess about your write semantics. Turning mutation retries on is legitimate when the endpoint is idempotent or deduplicates on a client-supplied key.

**★ Your error boundary takes five seconds to appear and product says it feels broken. What do you change?**
Not the boundary — the retry policy, because the boundary cannot render until the error exists and the error does not exist until the retries are exhausted. Classify the failure: if it is a 4xx, refuse to retry it and the boundary appears on the first response. If it is a genuine 5xx and retrying is worthwhile, the honest fix is a visible "retrying" state rather than a silent one, so the delay reads as work instead of as a hang. Lowering `retryDelay` is the tempting middle option and mostly just hammers a struggling server harder.

**★ How do `retry` and `throwOnError` interact?**
Sequentially, and only in one direction. `retry` decides how many times the `queryFn` runs and how long the query stays in `pending`; nothing is thrown and nothing is rendered as an error during that period. `throwOnError` is consulted only once the retries are exhausted and the query has actually entered the error state. So `throwOnError` can never shorten the delay, and `retry: false` never bypasses the predicate — it just gets you to it sooner. Under suspense, the manual-throw pattern is where the two collide, which is exactly why the guide's snippet guards on `!isFetching`.

---

← [`staleTime` & `refetchOn*`](./01c-staletime-and-the-refetchon-family.md) · [Topic index](../README.md) · Next → **`initialData` vs `placeholderData`** *(not written yet)*
