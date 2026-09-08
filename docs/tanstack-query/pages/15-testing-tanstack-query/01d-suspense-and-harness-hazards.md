---
title: "A suspense query has no status branch to assert on, so the wrapper becomes the test — plus the harness-level hazards that make a correct suite hang, warn, or refuse to exit"
sidebar_label: "01d · Suspense and harness hazards"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query *Suspense* guide ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)), the *Testing* guide ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/testing)), *Important Defaults* ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)) and the `QueryClient` reference ([tanstack.com](https://tanstack.com/query/latest/docs/reference/QueryClient)). Target: **@tanstack/react-query 5.102.8** · React 19.2.8 · Vitest 5.0.0 · documentation-validated, **no sandbox run, no timings**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**Suspense removes the two things a query test normally asserts on. There is no `isPending` to wait for, because the component never renders while pending, and there is no `isError` branch to look for, because the error was thrown past you. Everything you would have asserted has moved into the tree *around* the component — the `<Suspense>` fallback and the error boundary — which means the wrapper stops being boilerplate and becomes the thing under test. On top of that sit four harness-level hazards that are not about TanStack Query at all but will make a perfectly correct suite hang, warn, or refuse to exit: garbage-collection timers, fake timers, structural sharing, and work still in flight when a test ends.**

## The suspense wrapper needs two boundaries, not one

The *Suspense* guide states what the mode replaces:

> *"When using suspense mode, `status` states and `error` objects are not needed and are then replaced by usage of the `React.Suspense` component."*

So a wrapper that only provides `QueryClientProvider` is incomplete: the first `useSuspenseQuery` suspends, React looks upward for a boundary, finds none, and the render fails outright. The test harness for suspense is three nested providers:

```tsx
// test-utils-suspense.tsx
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import { Suspense, type ReactElement, type ReactNode } from 'react'
import { createTestQueryClient } from './test-utils'

export function renderSuspense(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient } = {},
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary fallback={<p>Something went wrong</p>}>
          <Suspense fallback={<p>Loading…</p>}>{children}</Suspense>
        </ErrorBoundary>
      </QueryClientProvider>
    )
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}
```

The fallbacks carry text on purpose. `Loading…` is the only observable pending state a suspense component has, so `expect(screen.getByText('Loading…')).toBeInTheDocument()` immediately after render is the suspense equivalent of asserting `isPending`. The mechanics of what suspense mode removes are in [10 · suspense-driven fetching](../10-suspense-integration/01-suspense-driven-fetching.md).

### The error test that quietly asserts nothing

🔴 **This is the trap that costs an afternoon.** The guide is explicit that suspense does not send every error to the boundary:

> *"Not all errors are thrown to the nearest Error Boundary per default - we're only throwing errors if there is no other data to show."*

with the printed default:

```ts
throwOnError: (error, query) => typeof query.state.data === 'undefined'
```

The testing consequence is direct: **a suspense error test must start from a cold cache for that key.** If the test seeded data with `setQueryData`, or reused a `queryClient` from a previous render, or the same key was fetched earlier in the file, then `query.state.data` is defined, the failure is treated as a background-refetch failure, nothing is thrown, no boundary renders — and your `findByText('Something went wrong')` times out against a component that is behaving exactly as documented. The fix is the per-test client from [01](01-isolated-and-integration-testing.md), and it is load-bearing here in a way it is not elsewhere.

If the component under test *does* throw manually to force all errors to a boundary, the guide's snippet is:

```tsx
const { data, error, isFetching } = useSuspenseQuery({ queryKey, queryFn })
if (error && !isFetching) {
  throw error
}
```

Note that this proves `error` and `isFetching` are present on the suspense result — the mode removes the *need* to branch, not the fields — so a test can still read them through `renderHook`. The `!isFetching` guard matters to your test too: without it the component throws while the retry sequence is still running, so a test with retries enabled sees the boundary render mid-backoff, and a test with `retry: false` sees it immediately. Two different behaviours from the same code, decided by the test client.

### Retries still apply, and now they are invisible

Nothing in the suspense guide mentions `retry`; the policy comes from *Important Defaults* — *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."* Under suspense that means the fallback stays on screen through the whole backoff sequence, and the fallback looks identical whether the query is on attempt one or attempt four. In a status-based test you could at least inspect `failureCount`; here the DOM shows `Loading…` either way. `retry: false` is not an optimisation for suspense error tests, it is what makes them terminate.

### `renderHook` with a suspending hook

`renderHook(() => useSuspenseQuery(...))` suspends on the first render, so the hook's function body never completes and `result.current` is not yet populated. Provide the `Suspense` wrapper and wait before reading:

```tsx
const { result } = renderHook(() => useProductSuspense('1'), {
  wrapper: SuspenseWrapper,
})

await waitFor(() => expect(result.current).not.toBeNull())
expect(result.current.data.name).toBe('Wireless Mouse')
```

Reading `result.current.data` on the line after `renderHook` is the most common suspense-test mistake, and its failure — a property read on a null-ish value — points at your test rather than at the suspension that caused it.

### Testing "Try again"

A boundary's own `resetErrorBoundary()` resets the boundary but not the cached query error, so the remount re-throws and the fallback comes straight back. That is what `QueryErrorResetBoundary` / `useQueryErrorResetBoundary` exist for:

> *"When using the component it will reset any query errors within the boundaries of the component"*

> *"When using the hook it will reset any query errors within the closest QueryErrorResetBoundary."*

⚠️ *Closest*, not global — so a test that wires the reset at a different level than the component's boundary will see "Try again" do nothing, and the defect is placement, not logic. The end-to-end test is: 500 the endpoint, assert the fallback, swap the handler to a 200, click Try again, assert the content. If the reset boundary is missing or misplaced the fallback simply persists. The full wiring is in [10 · errors, boundaries and reset](../10-suspense-integration/01c-errors-boundaries-and-reset.md).

## Harness hazard 1 — garbage collection keeps the runner alive

The `QueryClient` reference states the lifetime:

> *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."*

That five-minute schedule is a real pending timer. The *Testing* guide's advice for Jest is to set `gcTime` to `Infinity` to avoid the *"Jest did not exit one second after the test run completed"* message when garbage-collection time is explicitly configured. The mechanism generalises to any runner that detects open handles: a scheduled collection outlives the test that created it.

⚠️ **`gcTime: Infinity` is a trade, not a free win.** It means nothing in that client is ever collected — which is harmless for a client discarded at the end of the test, and a genuine leak for a client shared across a file. It is one more reason the per-test factory is the right shape: with a fresh client per test, the cache is unreachable the moment the test ends regardless of what `gcTime` says.

## Harness hazard 2 — fake timers

Fake timers and async query tests interact badly, because `waitFor` polls on real time while your mocked clock is frozen, and a query that resolves via a scheduled callback never gets its callback run.

⚠️ **Stated as uncertain:** the exact configuration each tool needs — `waitFor`'s timer handling and `userEvent`'s `advanceTimers` option — is Testing Library and `user-event` behaviour, not TanStack Query behaviour, and **I did not verify it against those projects' documentation in this pass.** What is safe to say is the shape of the problem and the shape of the escape:

- Prefer **not** to use fake timers in query tests. Almost everything people reach for them for — skipping a retry backoff, skipping a `refetchInterval` — is better expressed by configuring the query: `retry: false`, or a short explicit interval, or a deferred promise the test resolves by hand as in [01c](01c-testing-mutations.md).
- If you must fake timers (testing a `refetchInterval`, say), enable them for that one test, and expect to configure both `userEvent` and `waitFor` to advance the fake clock rather than assuming they will.
- The same applies to `retryDelay` if you are testing retry behaviour on purpose: turning the delay down is more predictable than freezing time. **The exact accepted forms of `retryDelay` are unverified here** — the `useQuery` reference page currently returns not-found on the docs site (recorded in this track's research bank), so source it from the options reference before relying on a specific signature.

## Harness hazard 3 — structural sharing makes an identity assertion lie

*Important Defaults*:

> *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"*

So after a refetch that returns byte-identical JSON, `result.current.data` is **the same object reference as before**. Two testing consequences:

- A test asserting `expect(dataAfter).not.toBe(dataBefore)` to prove "a refetch happened" fails against correct code. Prove the refetch at the network layer instead — count requests, as [01b](01b-mocking-at-the-network-layer.md) argues.
- A test asserting a re-render occurred (a render spy, a `toHaveBeenCalledTimes` on a child) can also fail, because a stable reference is precisely what lets the library skip the re-render. Structural sharing is a feature; a test that treats it as a bug will be "fixed" by disabling it, and then the app re-renders on every poll.

Conversely, `toEqual` is almost always the assertion you want on query data, and identity comparisons should be reserved for tests that are specifically *about* structural sharing.

## Harness hazard 4 — work still in flight when the test ends

A test that unmounts (or simply ends) while a request is outstanding leaves a promise that will resolve into a torn-down tree. Depending on the runner this surfaces as a warning attributed to a later test, an "after test finished" error, or nothing at all until CI is slow enough for the ordering to change.

The mitigations, in order of preference:

1. **Await the settle.** If the test fired it, the test should wait for it — `await waitFor(...)` on the flag or the DOM. Most in-flight-at-teardown problems are a missing `await`.
2. **Fresh client per test**, so nothing that resolves late can write into a cache a later test reads.
3. **Reset handlers** (`server.resetHandlers()`), so a late response is not answered by an override the next test does not expect.

`queryClient.clear()` in an `afterEach` is sometimes suggested; with a per-test client it is redundant, and it does not cancel anything already in flight. It is not a substitute for awaiting.

## Gotchas

**★ A suspense component's render throws immediately with no useful message.** Cause: the wrapper provided `QueryClientProvider` but no `<Suspense>` boundary, so the first suspension has nowhere to land. Fix: wrap with `<ErrorBoundary><Suspense fallback={…}>` inside the provider, as a dedicated `renderSuspense` helper.

**★ The suspense error test times out and the error boundary never renders.** Cause: the key already had data — seeded by `setQueryData`, or left by an earlier test on a shared client — so the documented default `throwOnError: (error, query) => typeof query.state.data === 'undefined'` treated the failure as a background-refetch failure and swallowed it. Fix: a genuinely cold client per test, and if the component *should* surface refetch failures too, test that it throws manually with the `!isFetching` guard.

**★ A suspense error test hangs even with a cold cache.** Cause: the three default retries with exponential backoff run before the error is thrown, and the fallback looks identical throughout, so there is no visible difference between "retrying" and "stuck". Fix: `retry: false` in the test client. This is more important under suspense than anywhere else, because the DOM gives you no `failureCount` to inspect.

**★ `result.current` is null right after `renderHook` on a suspense hook.** Cause: the hook suspended, so its body never returned a value on the first render. Fix: `await waitFor(() => expect(result.current).not.toBeNull())` before reading `data`.

**★ "Try again" does nothing in the test, and the component is correct.** Cause: `resetErrorBoundary()` resets the boundary but not the query's cached error, so the remount re-throws — you need `QueryErrorResetBoundary`, and the hook resets only *"within the closest QueryErrorResetBoundary"*. Fix: place the reset boundary around the same subtree as the error boundary in the test wrapper, and wire `onReset={reset}`.

**★ The runner completes the tests and then refuses to exit, or warns about open handles.** Cause: the default `gcTime` schedules a collection five minutes out, per the `QueryClient` reference; that timer outlives the test. Fix: set `gcTime: Infinity` in the test client, which is what the *Testing* guide advises for Jest's *"Jest did not exit one second after the test run completed"* case. Do not do this on a client shared across a file — nothing will ever be collected.

**★ Enabling fake timers makes every query test hang.** Cause: the query resolves through scheduled work that a frozen clock never runs, while `waitFor` polls on real time. Fix: do not use fake timers for query tests; express the intent with query options or a deferred promise the test resolves. If a `refetchInterval` genuinely must be tested, scope fake timers to that one test and configure `userEvent`/`waitFor` to advance them — the exact configuration belongs to those libraries and is not asserted here.

**★ A test proves a refetch happened by asserting the data reference changed, and fails.** Cause: structural sharing — *"if not, the data reference remains unchanged"* — so identical JSON yields the identical object. Fix: count requests at the network layer, or assert on data that actually differs between the two responses.

**★ A render-count assertion fails after adding a poll, and the "fix" is to disable structural sharing.** Cause: the same mechanism, seen from the render side — a stable reference is why the re-render was skipped. Fix: assert on rendered output rather than render counts; disabling structural sharing to satisfy a test makes the real app re-render on every poll.

**★ A failure is attributed to a test that cannot have caused it.** Cause: a request from an earlier test resolved after that test ended, into a torn-down tree or a cache a later test is reading. Fix: `await` every operation the test starts, use a fresh client per test, and reset network handlers in `afterEach`. `queryClient.clear()` does not cancel in-flight work and is not the fix.

**★ Devtools rendered inside the test wrapper.** Cause: copying the app's provider tree wholesale into `test-utils`. Fix: leave them out — they add a subscription, DOM and state to every test for no assertion. The test wrapper should be the *minimum* tree the component needs, not a copy of `App.tsx`.

## Interview questions

**★ Why does a suspense query need a different test wrapper, and what exactly are you asserting on?**
Because suspense moves both of the states you would normally assert on out of the component. The docs put it as: with suspense mode, *"`status` states and `error` objects are not needed and are then replaced by usage of the `React.Suspense` component."* There is no `isPending` render to catch — while pending, the component does not render at all — and an error is thrown past the component rather than returned to it. So the pending assertion becomes "the `<Suspense>` fallback text is on screen" and the error assertion becomes "the error boundary's fallback is on screen". The wrapper supplies both, which makes it part of the test rather than boilerplate: a wrapper with no boundary does not merely fail to assert, it makes the render throw.

**★ A suspense error test times out with a cold-looking component. What is the first thing you check?**
Whether the cache was actually cold for that key. TanStack Query's documented default is *"Not all errors are thrown to the nearest Error Boundary per default - we're only throwing errors if there is no other data to show"*, implemented as `throwOnError: (error, query) => typeof query.state.data === 'undefined'`. So if anything put data at that key first — a `setQueryData` seed, a shared client, an earlier render in the same test — the failure is classified as a background-refetch failure and is deliberately silent. The boundary never renders, and it is correct not to. This is the single strongest argument for the fresh-client-per-test rule: elsewhere it prevents flakiness, here it decides whether the feature under test is reachable at all.

**★ Why is `retry: false` even more important for suspense tests than for status-based ones?**
Because suspense removes your ability to see that a retry is happening. In a status-based test the query exposes `fetchStatus` and `failureCount`, so a hanging test can be diagnosed by inspecting the hook. Under suspense the only thing on screen is the fallback, and the fallback is byte-identical on attempt one and attempt four; the documented three retries with exponential backoff therefore present as an indefinite loading state with no diagnostic surface. Disabling retries makes the first rejection reach the boundary, which is the behaviour the test is describing anyway.

**★ Why does setting `gcTime: Infinity` in tests fix a runner that will not exit, and when is it the wrong fix?**
The `QueryClient` reference says an unused query is garbage collected after `gcTime`, defaulting to five minutes. That schedule is a live timer, and a runner that checks for open handles sees it still pending after the test finished — which is what produces the "did not exit" complaint the *Testing* guide addresses. `Infinity` removes the schedule entirely. It is the wrong fix when the `QueryClient` is shared across many tests, because then nothing is ever released and the cache grows for the life of the file; the right structure is a client per test, at which point the whole cache becomes unreachable at teardown and `gcTime` stops mattering for memory at all.

**★ You want to prove a background refetch actually re-fetched. Why is comparing data references the wrong probe?**
Because TanStack Query structurally shares results: *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged."* A refetch returning identical JSON therefore yields the identical object, so `not.toBe` fails against completely correct code, and a render-count assertion fails too — the stable reference is exactly what allows the re-render to be skipped. The refetch is an event at the network boundary, so count it there: increment a counter inside the handler and assert it went up. If you want to assert on data, make the second response genuinely different and use `toEqual`.

**★ Why are fake timers a bad default for a query test suite?**
Because a query's completion depends on scheduled work, and freezing the clock stops that work while `waitFor` continues polling on real time — so the test cannot progress and cannot fail informatively either. Nearly every motivation for reaching for fake timers in this domain has a better expression in query configuration: retry backoff is removed by `retry: false`, a poll is tested with a short explicit interval, and "hold the response open so I can assert the in-flight state" is a deferred promise the test resolves by hand, which is deterministic and needs no clock at all. Fake timers should be scoped to the single test that genuinely needs them, with both `userEvent` and `waitFor` configured to advance them.

---

← [Testing mutations](01c-testing-mutations.md) · [Topic index](../README.md) · Next → [RTK Query to TanStack Query](../16-migration-recipes/01-rtk-query-to-tanstack-query.md)
