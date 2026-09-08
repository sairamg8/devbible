---
title: "Mocking the queryFn tests your mock; mocking the network tests your cache — why the interception point decides what the test is actually worth"
sidebar_label: "01b · Mocking at the network layer"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query *Testing* guide ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/testing)), *Important Defaults* ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)) and *Query Invalidation* ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)). Target: **@tanstack/react-query 5.102.8** · React 19.2.8 · Vitest 5.0.0 · documentation-validated, **no sandbox run, no timings**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**There are exactly two places to substitute a fake response into a TanStack Query test: at the `queryFn` boundary, by replacing the function; or at the network boundary, by intercepting the HTTP request the real `queryFn` makes. They look interchangeable in a green test run and they are not. Replacing the `queryFn` deletes the code you shipped — the URL, the params, the auth header, the status check, the JSON parse, the error mapping — and asserts that a function returning a literal returns that literal. Intercepting the network keeps all of it and only substitutes the bytes coming back. The second is a test; the first is a tautology with a render in the middle.**

## What a mocked `queryFn` actually deletes

Take a realistic fetcher and count what a `vi.mock` of it removes from the test's reach:

```ts
// api/products.ts
export async function fetchProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    signal,
    headers: { accept: 'application/json' },
  })

  // 🔴 fetch does NOT reject on 4xx/5xx — without this line the query "succeeds"
  // with an error page body and your error UI never renders in production either.
  if (!res.ok) {
    throw new Error(`Failed to load product ${id}: ${res.status}`)
  }

  return (await res.json()) as Product
}
```

`vi.mock('../api/products')` removes, in one line: the URL shape, the `encodeURIComponent` call that makes ids with slashes work, the `accept` header, **the `res.ok` check that is the entire reason your error state exists**, the JSON parse, and the `signal` plumbing that makes cancellation work. Every one of those has shipped broken at least once in every codebase. A test built on the mock is green through all of them.

The specific one worth stopping on is `res.ok`. `fetch` resolves for a 500 — the promise fulfils with a `Response` whose `ok` is `false`. If your `queryFn` forgets to throw, TanStack Query sees a resolved promise, stores whatever `res.json()` produced (or throws a parse error naming JSON, not HTTP), and reports `status: 'success'`. A network-layer test that returns a 500 catches this immediately. A `queryFn` mock configured with `mockRejectedValue(new Error('boom'))` asserts that when your fetcher throws, your error UI renders — which was never the doubtful part.

**When mocking the `queryFn` is legitimate:** when the unit under test is the *cache wiring* and not the transport — a `select` transform, a `queryKey` factory, an `enabled` condition, a retry policy. Then say so in the test name, and keep one integration test per feature that goes through the network layer. The rule is not "never mock a function"; it is "do not let the only test of a feature be one that deleted the feature's I/O."

## The interception tools, and what the guide actually shows

🔴 **The guide's own network examples use `nock`.** It shows mocking API responses with `nock` to validate that the network calls happen, and for an infinite query it uses `.persist()` so a single interceptor answers an endpoint called more than once. **I did not find MSW named on that page**, so this page does not claim the docs recommend it — MSW is simply the same *class* of tool (intercept at the network boundary, leave the fetcher intact) and is the usual choice when the tests run in jsdom against `fetch`. Either tool satisfies the argument above; the argument is about the *layer*, not the package.

An MSW harness, written out in full:

```ts
// mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/products/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, name: 'Wireless Mouse', price: 24.99 }),
  ),
]
```

```ts
// mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```ts
// vitest.setup.ts  — referenced from `test.setupFiles` in vitest.config.ts
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'

// 🔴 'error' is the setting that turns a typo'd URL into a failed test instead of
// a hanging one. Without it an unmatched request falls through to the real network.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// 🔴 the mirror of "a fresh QueryClient per test": handler overrides are state too.
afterEach(() => server.resetHandlers())

afterAll(() => server.close())
```

`resetHandlers()` in `afterEach` is the same isolation rule as the per-test `QueryClient` from [01](01-isolated-and-integration-testing.md), applied to the other piece of shared state. A `server.use(...)` inside a test that is never reset leaks a 500 into the next test, which then fails in its *success* path — and, because retries are off, fails fast and confusingly.

### The error path, end to end

```tsx
// ProductDetail.test.tsx
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { server } from '../mocks/server'
import { renderWithClient } from './test-utils'
import { ProductDetail } from './ProductDetail'

test('renders the product on success', async () => {
  renderWithClient(<ProductDetail productId="1" />)
  expect(await screen.findByText('Wireless Mouse')).toBeInTheDocument()
})

test('renders the error state when the API returns 500', async () => {
  server.use(
    http.get('/api/products/:id', () => new HttpResponse(null, { status: 500 })),
  )

  renderWithClient(<ProductDetail productId="1" />)

  // Resolves after ONE failed attempt because the test client sets retry: false.
  // With the default policy this line waits out three exponential backoffs first.
  expect(await screen.findByText(/failed to load product/i)).toBeInTheDocument()
})
```

The two halves of the discipline are visible in one file: the network layer decides *what came back*, and the test `QueryClient` decides *how fast the failure surfaces*. Remove either and the error test stops being useful — without the interception you are asserting on a mock, without `retry: false` you are asserting on a stopwatch.

## Asserting a request happened — and asserting one did not

Network-layer mocking gives you something a `queryFn` mock cannot: a truthful record of the HTTP traffic. That is what makes cache assertions checkable.

```tsx
test('a second mount of the same key does not hit the network again', async () => {
  let calls = 0
  server.use(
    http.get('/api/products/:id', ({ params }) => {
      calls += 1
      return HttpResponse.json({ id: params.id, name: 'Wireless Mouse', price: 24.99 })
    }),
  )

  const queryClient = createTestQueryClient()
  // staleTime keeps the second mount from refetching in the background
  queryClient.setQueryDefaults(['product'], { staleTime: 60_000 })

  const { unmount } = renderWithClient(<ProductDetail productId="1" />, { queryClient })
  expect(await screen.findByText('Wireless Mouse')).toBeInTheDocument()
  unmount()

  renderWithClient(<ProductDetail productId="1" />, { queryClient })
  expect(await screen.findByText('Wireless Mouse')).toBeInTheDocument()
  expect(calls).toBe(1)
})
```

⚠️ **Note what this test had to be explicit about.** *Important Defaults* says:

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*

and

> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

So with the default `staleTime`, remounting the same key **does** issue a second request — the cached data is served instantly *and* a background refetch runs. A test asserting `calls === 1` without raising `staleTime` is asserting the opposite of the documented behaviour and will fail. Reusing the same `queryClient` across the two mounts is also deliberate here: it is the one case where sharing a client is the *subject* of the test rather than a leak.

### Invalidation is observed at the network, not at the spy

The temptation is `vi.spyOn(queryClient, 'invalidateQueries')`. Resist it: it asserts that you called a function, not that anything refetched, and it passes when the key you invalidated does not match the key you rendered. *Query Invalidation* describes the two consequences worth asserting:

> *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*

> *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*

The observable form of that second sentence is a second request and new data in the DOM. Assert those.

## Infinite queries

The guide's infinite-query example uses `nock` with `.persist()`, because the same endpoint is requested once per page and a one-shot interceptor answers only the first. The MSW equivalent needs no `.persist()` — a handler answers every matching request until it is reset — but it does need to vary the response by cursor, or the second page returns the first page's items and the "load more" assertion passes against duplicated data:

```ts
server.use(
  http.get('/api/products', ({ request }) => {
    const cursor = Number(new URL(request.url).searchParams.get('cursor') ?? 0)
    return HttpResponse.json({
      items: [{ id: `${cursor}-a` }, { id: `${cursor}-b` }],
      nextCursor: cursor < 2 ? cursor + 1 : null,
    })
  }),
)
```

Then await the first page's items before triggering `fetchNextPage`, exactly as the guide instructs for its `nock` version — awaiting the data assertion before progressing. Firing "load more" before page one has settled tests a race, not pagination.

## Gotchas

**★ Every test passes and production returns an error page as if it were data.** Cause: the `queryFn` has no `res.ok` check, and every test mocked the `queryFn` itself, so the missing check was never exercised. `fetch` does not reject on a 4xx or 5xx — it fulfils. Fix: intercept at the network layer and add a test that returns `new HttpResponse(null, { status: 500 })`; it fails until the fetcher throws.

**★ A test hangs and eventually times out with no failing assertion, only in CI.** Cause: an unmatched request escaped the interceptor and went to the real network, where nothing answers. Fix: `server.listen({ onUnhandledRequest: 'error' })`. Unmatched requests then fail loudly and name the URL, which is also how you discover that your handler path and your fetcher path disagree by one segment.

**★ A `server.use()` override poisons the next test.** Cause: handler overrides are per-server state, and the server outlives the test. Fix: `afterEach(() => server.resetHandlers())` in the setup file. This is the same failure mode as a shared `QueryClient`, on a different object.

**★ The "does not refetch on remount" test fails, and the code is correct.** Cause: TanStack Query considers cached data stale by default, and *"Stale queries are refetched automatically in the background when: New instances of the query mount"*. The second mount serves cache **and** refetches. Fix: set a `staleTime` in the test that makes the intent explicit — `queryClient.setQueryDefaults(['product'], { staleTime: 60_000 })` — or assert on what you actually meant, which is usually "the UI showed data immediately", not "no request was made".

**★ Asserting invalidation with `vi.spyOn(queryClient, 'invalidateQueries')`.** Cause: the spy proves a call, not an effect, and it is blind to a key mismatch — `invalidateQueries({ queryKey: ['products'] })` against a component rendering `['product', id]` matches nothing and the spy is still green. Fix: count requests in the handler and assert the DOM updated; that is what the docs' *"it will also be refetched in the background"* actually means.

**★ Infinite-query tests where page two contains page one's rows.** Cause: a handler that ignores the cursor query param, or a `nock` interceptor without `.persist()` answering only the first request. Fix: read the cursor off `request.url` and return distinct pages; with `nock`, `.persist()` as the guide shows.

**★ The mock's data drifts from the real API's shape and nothing notices.** Cause: handwritten literals in handlers with no type on them. Fix: type the handler's response as the domain type — `HttpResponse.json<Product>(...)` or a `satisfies Product` on the literal — so a field rename in the type breaks the mock at compile time instead of shipping.

**★ `vi.mock` of the API module is hoisted above your fixture and the mock returns `undefined`.** Cause: Vitest hoists `vi.mock` calls to the top of the file, above `const fixture = {...}`, so a factory closing over `fixture` reads a temporal-dead-zone binding. Fix: define fixtures inside the factory, or use `vi.hoisted`. Better fix: stop mocking the module and intercept the network, which has no hoisting semantics at all.

**★ Two tests in the same file disagree about the mock and the second one wins.** Cause: `vi.mock` is file-scoped, so per-test behaviour has to be expressed as `mockResolvedValueOnce` chains that silently run out. Fix: network handlers are per-request functions and can branch on the request, so the "which response is this call getting" question stops being positional.

## Interview questions

**★ Why is mocking the `queryFn` a weaker test than mocking the network, when both make the component render fake data?**
Because they substitute at different depths and the difference is exactly the code you are paid to get right. Mocking the `queryFn` removes the URL construction, the params encoding, the headers, the HTTP status check, the response parsing and the error mapping from the test's reach — and then asserts that a function returning a literal causes the component to render that literal. Mocking the network keeps every one of those lines executing and substitutes only the response bytes. The clearest example is `fetch`'s behaviour on a 500: it fulfils rather than rejects, so a fetcher missing its `res.ok` check reports success with garbage data. A network-level test returning a 500 fails on that immediately; a `queryFn` mock configured to reject asserts that a throwing function produces an error state, which was never in question.

**★ When is mocking the `queryFn` the right choice?**
When the subject of the test is the cache wiring rather than the transport: whether `select` maps correctly, whether the `queryKey` factory produces the key you think, whether `enabled: false` really suppresses a fetch, whether a `retry` policy behaves. In those tests the fetcher is scenery and stubbing it removes noise. The condition is that the feature must still have *at least one* test that runs the real fetcher against an intercepted network — otherwise the transport has no coverage anywhere and the suite's green is about itself.

**★ What does `onUnhandledRequest: 'error'` buy you, and why is the default insufficient?**
It converts a request that matched no handler into an immediate, named failure. Without it the request falls through toward the real network, where in a jsdom test nothing answers — so the query sits in `fetchStatus: 'fetching'`, the component never leaves its pending branch, and the test dies by timeout with a message about your selector. The underlying mistake is usually a one-character path mismatch between the handler and the fetcher, which is invisible in a timeout and obvious in an "unhandled request: GET /api/product/1" failure. It is the single highest-value line in an MSW setup file after `resetHandlers`.

**★ How do you prove, in a test, that invalidating a query actually refetched it?**
By observing the network and the DOM, not by spying on `invalidateQueries`. Count invocations inside the MSW handler, perform the action that triggers invalidation, and then assert both that the count increased and that the newly rendered content reflects the second response. The docs describe invalidation as marking the query stale — overriding any `staleTime` — and, if it is currently rendered, refetching it in the background; those are the two observable effects. A spy on the method is blind to the most common bug in this area, which is invalidating a key that does not match the key the component subscribed to: the call happens, the spy passes, nothing refetches.

**★ Why does `resetHandlers()` belong in `afterEach` and not `afterAll`?**
Because `server.use()` mutates shared state for the remainder of the server's life. A test that overrides the product endpoint with a 500 to exercise the error branch leaves that 500 in place for every subsequent test in the file, which then fails on its success path — and, because the test client disables retries, fails fast and in a way that looks like a broken component rather than a leaked handler. It is the same class of defect as a shared `QueryClient`: state that outlives the test that created it, producing order-dependent failures that do not reproduce in isolation.

**★ Your suite mocks every API module with `vi.mock`, is fast, and is green. What is the concrete argument for changing it, and what do you give up?**
The argument is that the suite currently has zero coverage of the transport layer, and the transport layer is where the recurring production bugs live: a missing `res.ok` check that turns a 500 into "success", a query param that is not encoded, an auth header dropped in a refactor, a response shape that changed on the server. None of those can fail a test that replaced the fetcher with a literal. What you give up moving to network interception is real but small: a setup file, a small amount of per-test time, and the discipline of keeping handlers in sync with the API — which is itself a feature, because a handler that drifts is a visible artefact whereas a stale `mockResolvedValue` is invisible. The pragmatic position is not "delete all module mocks" but "no feature's only test is one that deleted its I/O."

**★ How does the choice of mocking layer affect testing query cancellation?**
Decisively, because the whole mechanism travels through the `queryFn`'s `signal`. TanStack Query hands an `AbortSignal` to the `queryFn`; a fetcher that forwards it to `fetch` gets its in-flight request aborted when the query is cancelled, and a fetcher that ignores it does not. A mocked `queryFn` never receives, forwards or reacts to that signal, so a suite built on module mocks cannot tell the two implementations apart — cancellation appears to work because the fake resolves and nobody is listening. With network interception the real `fetch` runs and the abort is observable: the handler sees the request go away, or the fetcher's promise rejects with an abort error. That makes the layer choice a correctness question for cancellation, not a style question.

**★ Two mounts of the same query key: how many requests should a test expect, and why is the naive answer wrong?**
Two, under default options. The docs say cached data is considered stale by default and that stale queries refetch when new instances mount, so the second mount renders the cached value immediately *and* fires a background refetch. Engineers write this test expecting one request because they are thinking of the cache as a request cache; it is a stale-while-revalidate cache. If the intent is genuinely "no second request", the test has to set a `staleTime` that covers the window and say so — at which point the test is documenting a real configuration decision rather than asserting a default it guessed at.

---

← [The test QueryClient](01-isolated-and-integration-testing.md) · [Topic index](../README.md) · Next → [Testing mutations](01c-testing-mutations.md)
