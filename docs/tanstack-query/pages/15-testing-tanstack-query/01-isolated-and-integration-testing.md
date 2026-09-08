---
title: "A test QueryClient is a different object from your app's: retries off, a fresh instance per test, and assertions on the query's own flags rather than a timer"
sidebar_label: "01 · The test QueryClient"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query *Testing* guide ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/testing)) and *Important Defaults* ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)); mutation defaults from the *Mutations* guide ([tanstack.com](https://tanstack.com/query/v5/docs/framework/react/guides/mutations)). Target: **@tanstack/react-query 5.102.8** · React 19.2.8 · Vitest 5.0.0 · documentation-validated, **no sandbox run, no timings**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**Almost every "TanStack Query is hard to test" complaint reduces to one default that is right in production and wrong in a test: a failing query is retried three times with exponential backoff before the error ever reaches your component. Your error-state test does not fail — it hangs, then times out, and the failure message points at your assertion instead of at the retry policy. The fix is four words of configuration, `retry: false`, applied to a `QueryClient` you construct fresh inside every single test. Everything else on this page — the wrapper helper, `waitFor` on the query's own flags, turning off focus refetching — exists to keep the test harness from disagreeing with the app in some *second* way you have not noticed yet.**

## The default that eats your test suite

*Important Defaults* states the retry policy without qualification:

> *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."*

Read that as a test author and the consequence is immediate. A query whose `queryFn` rejects does **not** enter `status: 'error'` on the first rejection. It enters `fetchStatus: 'fetching'` again, waits, rejects again, waits longer, rejects a third time, waits longer still, and only after the fourth total attempt does `status` flip to `'error'`. Until then the component under test is rendering its pending branch — which is exactly the branch your `findByText(/something went wrong/i)` is not looking for.

Two failure shapes come out of this, and they look nothing alike:

- **The test times out.** Testing Library's async utilities have their own timeout. If the backoff sequence outlasts it, you get a timeout naming your query selector, and the obvious (wrong) conclusion is that your error UI never renders.
- **The test passes, slowly, for the wrong reason.** If the backoff happens to fit inside the timeout, the assertion eventually succeeds. Nothing is red. You have simply bought a test that spends seconds sitting in `setTimeout`, and you will buy one per error-state test, forever.

The guide's own framing is that retries cause tests to *time out*, and its prescription is exactly this object:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})
```

🔴 **`defaultOptions` is a default, and a per-query `retry` beats it.** The guide is explicit that an explicit retry setting on an individual query overrides the default. So a hook written as `useQuery({ queryKey, queryFn, retry: 2 })` still retries twice inside a test client configured with `retry: false` — the test client never sees that option, because the hook set it. If a hook hard-codes `retry`, either make the number a prop/parameter the test can pass, or accept that this one test is slow and say so in a comment. There is no "force off" switch above the hook.

### Mutations are the asymmetric case

The *Mutations* guide is equally blunt in the other direction:

> *"By default, TanStack Query will not retry a mutation on error"*

So `mutations: { retry: false }` in a test client changes nothing by default — it is a **defensive** line, worth writing because it neutralises an app-wide `mutations: { retry: 3 }` that someone adds to the real client six months from now and that a test helper copying production defaults would then inherit. Write it; do not believe it is doing work today.

## A fresh `QueryClient` per test, and why "per file" is not enough

A `QueryClient` owns a cache. A cache is state. State shared across tests is order-dependent behaviour, and order-dependent behaviour is what people call flakiness when they have not found it yet.

Concretely: test A fetches `['product', '1']` and the query lands in the cache as fresh data. Test B renders the same component expecting a loading state — and does not get one, because `useQuery` mounted against a cache entry that already has data and served it synchronously on the first render. Test B fails. Run test B alone and it passes. Run the file in a different order and it passes. Nothing in the failure message mentions test A.

The guide acknowledges the shared-client shortcut and immediately fences it:

> *"It is possible to write this wrapper only once, but if so we need to ensure that the `QueryClient` gets cleared before every test, and that tests don't run in parallel."*

Both halves of that sentence are load-bearing, and the second one is the killer. Vitest runs test **files** in parallel workers by default, and within a file it can run concurrent tests when you ask for them. A module-level `const queryClient = new QueryClient()` inside a shared `test-utils` module is instantiated once per worker, not once per process — so the leak is per-file, silent, and does not reproduce when you re-run the single failing test in isolation.

**Construct the client inside the factory.** That is the whole discipline:

```tsx
// test-utils.tsx
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 🔴 the one that matters: an error test must not wait out 3 backoffs
        retry: false,
        // a test window never gains or loses focus; a focus refetch here is noise
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        // defensive: mutations already default to no retry
        retry: false,
      },
    },
  })
}

export function renderWithClient(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient } = {},
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return {
    queryClient, // hand it back so a test can seed or inspect the cache
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  }
}
```

This is the generic custom-render pattern from [Jest/RTL · provider wrapping](../../../jest-rtl/pages/11-custom-render/01-provider-wrapping.md), specialised to the one provider whose state survives a render. And it is deliberately **not** the app's client: the options it sets are the mirror image of the production defaults discussed in [13 · defaultOptions](../13-global-configuration/01-defaultoptions.md).

Returning the client is not decoration. It is how a test seeds a cache deliberately (`queryClient.setQueryData(['product', '1'], fixture)`) instead of seeding it by accident from a previous test, and how it asserts on cache state after a mutation. Both appear in [01b](01b-mocking-at-the-network-layer.md).

### The `renderHook` variant

For a custom hook there is no component to render, so the wrapper is the entire harness. The guide's shape, adapted to the factory above:

```tsx
// useProduct.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from './test-utils'
import { useProduct } from './useProduct'
import type { ReactNode } from 'react'

function createWrapper() {
  const queryClient = createTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

test('useProduct resolves to the product', async () => {
  const { result } = renderHook(() => useProduct('1'), { wrapper: createWrapper() })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.name).toBe('Wireless Mouse')
})
```

⚠️ `renderHook` and `waitFor` are imported from `@testing-library/react`. The guide notes that the separate `@testing-library/react-hooks` package is only needed on **React 17 and earlier**; on React 19 it is the wrong import and does not exist in your dependency tree.

## `waitFor` the flag, never the clock

The query's own state is the only honest synchronisation point. `status`, `fetchStatus`, `isSuccess`, `isPending`, `isError` are derived from the query's actual lifecycle; a `setTimeout(50)` is a guess about how long a mock takes to resolve on the CI box that is busiest today.

The guide's assertion form is the one to copy:

```tsx
await waitFor(() => expect(result.current.isSuccess).toBe(true))
```

For a rendered component, Testing Library's `find*` queries are `waitFor` with a query baked in, and they are the same discipline expressed against the DOM:

```tsx
test('renders the product once it loads', async () => {
  renderWithClient(<ProductDetail productId="1" />)
  expect(await screen.findByText('Wireless Mouse')).toBeInTheDocument()
})
```

**Which flag to wait on depends on what you are testing**, and the *Queries* guide draws the line you need:

> *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"*

- Testing **the rendered result** → wait on `isSuccess` / `isError`, or just use `findBy*`.
- Testing a **background refetch** (data already present, request in flight) → `status` is already `'success'` and will never change. Wait on `fetchStatus === 'fetching'` and then on `fetchStatus === 'idle'`, or you are waiting on a flag that already has its final value.
- Testing that something **did not** fetch (a disabled query) → there is no transition to wait for. Assert `result.current.fetchStatus` is `'idle'` and that your network mock recorded zero calls. `waitFor` cannot prove a negative; it just returns immediately.

## Turning off focus and reconnect refetching

*Important Defaults* describes when a stale query refetches on its own:

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

⚠️ **The guide names `refetchOnWindowFocus` and `refetchOnReconnect` but does not print their default values on that page**, so this page does not assert a default number — it asserts the *behaviour* quoted above and the fix. In jsdom a `focus` event is something your own test can fire (Testing Library's `userEvent` does tab/focus work, and any `fireEvent.focus(window)` counts), and a refetch triggered mid-assertion produces a second `queryFn` call your MSW handler happily answers, a re-render you did not schedule, and an `act` warning that names a component instead of the event. Setting both to `false` in the test client removes an entire class of "why did my handler run twice" investigations.

**Do not turn them off globally and then write a test *about* focus refetching.** That test should build its own client with the option on, which the `queryClient` parameter on `renderWithClient` already allows:

```tsx
const focusClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } },
})
renderWithClient(<ProductDetail productId="1" />, { queryClient: focusClient })
```

## Gotchas

**★ Your error-state test times out and the message blames your selector.** Cause: the default is three silent retries with exponential backoff, so `status` is still `'pending'` when Testing Library gives up. Fix: `new QueryClient({ defaultOptions: { queries: { retry: false } } })`, constructed per test. If the test still times out after that, the problem is genuinely your selector or your mock — which is the point: `retry: false` makes the failure message mean what it says.

**★ `retry: false` in the test client does nothing because the hook sets `retry` itself.** Cause: an option passed to `useQuery` overrides `defaultOptions`; the guide says so explicitly. Fix: lift the value out of the hook so a test can control it — `useQuery({ queryKey, queryFn, retry: options?.retry ?? 3 })` — or test that hook through a slower path and comment why. There is no client-level override that wins over a per-query option.

**★ A test passes alone and fails in the suite.** Cause: a module-level `QueryClient` shared across the file, seeded by whichever test ran first. Fix: move `new QueryClient()` inside the render/wrapper factory so each test gets its own cache. If you must keep one, the guide's own condition applies — clear it before every test *and* forbid parallel runs — which costs you more than the factory does.

**★ The loading state never appears, and only in a suite run.** Cause: same leak, different symptom. `useQuery` mounting against a cache entry that already holds data renders `status: 'success'` on the very first commit; there is no pending frame to assert on. Fix: fresh client. Do not "fix" it by asserting on `isFetching` instead — that hides the leak and the next test inherits it.

**★ You disabled retries but the suite is still slow.** Cause: `retry: false` removes the backoff, not the delay you wrote. Check for `setTimeout` in a mock `queryFn`, an artificial latency in an MSW handler, or `retryDelay` set at the app level and copied into the test helper. Fix: mocks resolve immediately unless the test is specifically about a slow response.

**★ A refetch fires in the middle of your assertions and your handler is called twice.** Cause: a stale query refetching on window refocus — and a jsdom `focus` event is trivially produced by `userEvent` interactions. Fix: `refetchOnWindowFocus: false` and `refetchOnReconnect: false` in the test client; opt back in per-test for the one test that is about that behaviour.

**★ Waiting on `isSuccess` for a background refetch never resolves — or resolves instantly and asserts nothing.** Cause: `status` is already `'success'`; only `fetchStatus` moves during a background refetch. Fix: `await waitFor(() => expect(result.current.fetchStatus).toBe('fetching'))` then `await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))`, or assert on the new data directly.

**★ `waitFor` used to prove a query did *not* run.** Cause: `waitFor` resolves as soon as its callback stops throwing, so a callback asserting `isPending === true` succeeds on the first tick and proves nothing about the next hundred. Fix: assert the synchronous flag (`expect(result.current.fetchStatus).toBe('idle')`) and assert on your network mock's call count — the mock is the only thing that can testify that no request was made.

**★ `import { renderHook } from '@testing-library/react-hooks'` fails to resolve.** Cause: that package is the React 17-and-earlier path; the guide names it only for that case. Fix: on React 19, `renderHook` and `waitFor` both come from `@testing-library/react`.

**★ A `queryClient` returned from the render helper is used to assert cache state, but the assertion runs before the query settles.** Cause: `queryClient.getQueryData(key)` is a synchronous read of whatever is there right now. Fix: `await` a DOM or flag assertion first, then read the cache — or wrap the cache read itself in `waitFor`.

## Interview questions

**★ Why is `retry: false` the first line of every TanStack Query test setup?**
Because the library's documented default is that failing queries are *"silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."* Until the fourth attempt fails, the query's `status` is still `'pending'`, so a component rendering an error branch has not rendered it yet. A test asserting on error UI therefore either exceeds Testing Library's async timeout — producing a message that blames the selector rather than the retry policy — or, if the backoff happens to fit inside the timeout, passes while burning seconds. `retry: false` makes the first rejection the final rejection, which is the behaviour the test is actually describing. The correct place for it is `defaultOptions.queries.retry` on a `QueryClient` built for the test, never a change to the app's client.

**★ Why is a module-level `QueryClient` in `test-utils.tsx` a bug rather than an optimisation?**
Because a `QueryClient` owns the cache, and a module-level instance is created once per worker and shared by every test in that file. Data written by one test is visible to the next: a test expecting a loading state gets a synchronous success, a test expecting a fetch gets a cache hit and zero network calls, and a test asserting an error state can inherit a cached error it did not cause. All three failures are order-dependent, none of them reproduce when you re-run the single test, and none of the failure messages mention the test that actually caused them. The docs allow a single shared wrapper only under two conditions — clear the client before every test *and* do not run tests in parallel — and the second condition means giving up Vitest's default file-level concurrency. A factory function costs one line and gives up nothing.

**★ What is the difference between waiting on `status` and waiting on `fetchStatus`, and when does it decide whether your test works?**
The docs draw it as: *"The status gives information about the data: Do we have any or not? The fetchStatus gives information about the queryFn: Is it running or not?"* For a cold load they move together, so either works. For a **background refetch** they diverge and only `fetchStatus` moves — the query already has data, so `status` sits at `'success'` from before the refetch until after it. A test that waits for `isSuccess` to become true in order to detect a refetch is waiting for a transition that already happened; it resolves immediately and asserts on the old data. The correct probe is `fetchStatus` going `'fetching'` and back to `'idle'`, or an assertion on the new data itself.

**★ Your teammate makes the test suite faster by giving every test a client with `staleTime: Infinity`. What breaks?**
Refetch behaviour stops being testable. `staleTime: Infinity` means data is never stale, and *Important Defaults* ties every automatic refetch — mount, window focus, reconnect — to the query being stale. So invalidation tests, refetch-on-mount tests and "does the list update after the mutation" tests all silently assert nothing: the query serves cache and no request is made, so the network mock is never hit and the DOM never changes. It also masks genuine cache-key bugs, because two different keys both resolve from whatever was seeded. Speed in a query test suite comes from `retry: false` plus mocks that resolve immediately, not from suppressing the cache lifecycle you are trying to exercise.

**★ Why does the test wrapper turn off `refetchOnWindowFocus` when jsdom has no real window focus?**
Because jsdom has a `window` that dispatches `focus` and `visibilitychange` events, and your own test produces them — `userEvent` moves focus between elements as part of typing and clicking, and any explicit `fireEvent.focus(window)` counts. TanStack Query's documented behaviour is that *stale* queries refetch when the window is refocused, so an interaction test on a component with stale data can fire an extra `queryFn` call halfway through your assertions. The visible symptoms are a mock handler asserted to be called once that was called twice, a re-render outside `act`, and non-deterministic ordering. Turning the option off in the test client removes the whole class; the one test that is *about* focus refetching builds its own client with the option on.

**★ How do you test a query that is supposed to *not* run — `enabled: false`, or a dependent query whose key is not ready yet?**
Not with `waitFor`, which resolves the instant its callback stops throwing and therefore proves nothing about the next tick. There is no transition to await, so the assertions are synchronous and external: `expect(result.current.fetchStatus).toBe('idle')` — the *fetch* status, because `status` on a never-run query is `'pending'` and reads confusingly like "it is loading" — and, decisively, a call count on the network mock that is still zero. Then flip the condition (rerender the hook with the dependency satisfied) and assert that the count went to one. The first half proves the guard exists; the second half proves the guard *releases*, and a suite that only writes the first half passes against a query that is permanently disabled by a typo in the enabling condition.

**★ Why does the render helper return the `QueryClient` it created?**
Because the two most useful things a query test does need a handle on the cache. Seeding — `queryClient.setQueryData(['product', '1'], fixture)` — lets a test start from a warm cache deliberately, which is how you set up a background-refetch scenario or an optimistic-rollback baseline; without a handle the only way to warm the cache is to render something first and hope, which is the accidental version of the same thing and is indistinguishable from a leak. Inspecting — `queryClient.getQueryData(key)` after an action — lets a test assert that a mutation wrote where it claimed to. Returning the client also makes the *override* path natural: a test that needs a production-like option builds its own client and passes it in, instead of someone weakening the shared factory for everyone.

**★ Should the test `QueryClient` just reuse the app's `defaultOptions`?**
No, and this is the most common well-intentioned mistake. The app's defaults encode production trade-offs — retries for flaky networks, `staleTime` for bandwidth, `refetchOnWindowFocus` for freshness — and each of them is a source of nondeterminism or delay in a test. Copying them means every error test pays the backoff, every focus event fires a request, and a `staleTime` bump in production silently changes what the test suite is asserting. The test client should be built by a dedicated factory that states its own options explicitly, so that reading the factory tells you exactly which behaviours the suite has neutralised. Where a specific test needs a production-like option, it passes its own client rather than moving the global.

---

← [Advanced rollback strategies](../14-optimistic-updates-patterns/01-advanced-rollback-strategies.md) · [Topic index](../README.md) · Next → [Mocking at the network layer](01b-mocking-at-the-network-layer.md)
