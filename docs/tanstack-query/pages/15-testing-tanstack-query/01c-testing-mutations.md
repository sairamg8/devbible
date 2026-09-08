---
title: "Testing a mutation means testing its callbacks, and the callbacks are where the test harness and the component disagree — unmounts, act, the renamed third argument and the rollback you never actually observed"
sidebar_label: "01c · Testing mutations"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query *Mutations* guide ([tanstack.com](https://tanstack.com/query/v5/docs/framework/react/guides/mutations)), *Optimistic Updates* ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)), *Query Invalidation* ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)) and the *Testing* guide ([tanstack.com](https://tanstack.com/query/latest/docs/framework/react/guides/testing)). Target: **@tanstack/react-query 5.102.8** · React 19.2.8 · Vitest 5.0.0 · documentation-validated, **no sandbox run, no timings**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**A query test has one moving part: a request goes out, data comes back, the component re-renders. A mutation test has five — `onMutate`, the request, `onError` or `onSuccess`, `onSettled`, and whatever invalidation those trigger — and three of them run at moments when the component may already have unmounted, may be mid-transition, or may never have committed the state you are trying to assert on. This page is about testing the callbacks, because the callbacks are where the bugs are: an optimistic update that never rolls back, an invalidation aimed at the wrong key, a success toast that silently stops firing the day someone adds a redirect.**

## Retry: the asymmetry you inherit from the defaults

Queries and mutations do not share a retry default. *Important Defaults* says queries are *"silently retried 3 times, with exponential backoff"*; the *Mutations* guide says the opposite for mutations:

> *"By default, TanStack Query will not retry a mutation on error"*

That is why a mutation error test is fast even without configuration — and why `mutations: { retry: false }` in the test client from [01](01-isolated-and-integration-testing.md) is insurance against an app-level `mutations: { retry: 3 }` leaking into a helper that copies production defaults, not a fix for anything today.

## `mutate` versus `mutateAsync` in a test

The guide states the difference plainly:

> *"Use `mutateAsync` instead of `mutate` to get a promise which will resolve on success or throw on an error"*

In a test that difference decides your synchronisation strategy.

- **`mutate`** returns nothing. You fire it and then `waitFor` the hook's own flags — `isPending`, `isSuccess`, `isError`. This is the shape that matches how a component uses it, so it is the shape most tests should use.
- **`mutateAsync`** gives you a promise to `await`, which is convenient — and it **throws on error**, so an error-path test using it must wrap the call in `expect(...).rejects` or a `try/catch`, or the rejection fails the test as an unhandled error rather than as the assertion you wrote.

```tsx
// useCreateTodo.test.tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { createTestQueryClient } from './test-utils'
import { useCreateTodo } from './useCreateTodo'
import type { ReactNode } from 'react'

function createWrapper() {
  const queryClient = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { wrapper, queryClient }
}

test('mutate transitions the hook to success', async () => {
  const { wrapper } = createWrapper()
  const { result } = renderHook(() => useCreateTodo(), { wrapper })

  act(() => {
    result.current.mutate({ title: 'Buy milk' })
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toMatchObject({ title: 'Buy milk' })
})
```

⚠️ **Calling `result.current.mutate(...)` from test code is a state update originating outside React's own event handling**, which is exactly the situation `act` exists for. Wrapping the call keeps React's warning machinery quiet and, more importantly, guarantees the render caused by the status transition has been flushed before your next line reads `result.current`. Do not reach for `await act(async () => ...)` around the whole mutation — that swallows the intermediate `isPending` state you may want to assert on.

## Testing the callbacks — and the renamed argument

🔴 **The v5 callback signatures have a fourth parameter and a renamed third one.** From the *Mutations* guide:

```
onMutate: (variables, context) => { ... }
onError: (error, variables, onMutateResult, context) => { ... }
onSuccess: (data, variables, onMutateResult, context) => { ... }
onSettled: (data, error, variables, onMutateResult, context) => { ... }
```

The third positional argument is **`onMutateResult`** — whatever `onMutate` returned — and `context` is now a *fourth* parameter carrying `context.client`, the `QueryClient`, reachable without `useQueryClient`. Position is unchanged from the old API, so old code still runs; the *name* now means something else.

This matters in a test in two ways. First, if you are testing a hook that reads `context.previousTodos` in `onError`, that hook is written against the old naming and is now reading the `MutationFunctionContext`, not the rollback snapshot — a real bug that a test with a mocked callback would never catch, because the mock does not care what the parameter is called. Second, `onMutateResult` is **optional**: the typed signature is `onMutateResult: TOnMutateResult | undefined`. If `onMutate` throws before returning — which a test can force by making `cancelQueries` or `getQueryData` blow up — then `onError` receives `undefined` there, and an unguarded `onMutateResult.previousTodos` throws *inside the error handler*. That is worth an explicit test:

```tsx
test('rollback does not explode when onMutate never returned a snapshot', async () => {
  // force the failure path with no snapshot: the handler 500s AND onMutate bailed
  // early, so onError's third argument is undefined.
  // The assertion is simply that the hook reaches isError instead of throwing.
  const { wrapper } = createWrapper()
  const { result } = renderHook(() => useCreateTodo(), { wrapper })

  act(() => {
    result.current.mutate({ title: 'Buy milk' })
  })

  await waitFor(() => expect(result.current.isError).toBe(true))
})
```

## Two places callbacks live, and one of them can silently not run

Callbacks can be declared on `useMutation` *or* passed to `mutate()` at the call site. The guide's warning about the second form is the single most testable footgun in the mutation API:

> *"those additional callbacks won't run if your component unmounts _before_ the mutation finishes"*

In production that is a navigate-on-submit: the user clicks Save, the route changes, the component unmounts, and the success toast declared inside `mutate({ ... }, { onSuccess })` never fires. In a test it is `unmount()` — which is how you reproduce it:

```tsx
test('a mutate()-level onSuccess does not fire if the component unmounts first', async () => {
  const onSuccess = vi.fn()
  const { wrapper } = createWrapper()
  const { result, unmount } = renderHook(() => useCreateTodo(), { wrapper })

  act(() => {
    result.current.mutate({ title: 'Buy milk' }, { onSuccess })
  })
  unmount() // the mutation is still in flight

  // The hook-level onSuccess (declared inside useCreateTodo) still runs; this one
  // does not, per the docs' unmount caveat.
  await waitFor(() => expect(onSuccess).not.toHaveBeenCalled())
})
```

**The design lesson the test encodes:** anything that must happen regardless of the component's fate — cache invalidation, cache writes, rollback — belongs on the `useMutation` declaration. Anything tied to *this* component's UI — a toast, a form reset, a focus move — is fine at the call site. A test suite that only ever exercises call-site callbacks will pass through a refactor that adds a redirect and breaks every one of them in production.

⚠️ **Unsettled, and stated as such:** when both a hook-level and a `mutate()`-level callback exist, both fire, but the *relative order* is not stated on the guide. Do not write a test asserting one runs before the other — you would be pinning an unspecified behaviour.

## Testing an optimistic update, including the rollback

The interesting assertions in an optimistic flow happen *while the request is in flight*, which means the test needs to control when the response arrives. A deferred promise in the handler gives you that control without a timer:

```ts
// a tiny deferred — the test decides when the server "responds"
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
```

```tsx
test('optimistically appends, then rolls back on failure', async () => {
  const gate = deferred<Response>()
  server.use(http.post('/api/todos', async () => gate.promise))

  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['todos'], [{ id: '1', title: 'Existing' }])

  renderWithClient(<TodoList />, { queryClient })
  await userEvent.type(screen.getByLabelText('New todo'), 'Buy milk')
  await userEvent.click(screen.getByRole('button', { name: /add/i }))

  // in flight: the optimistic row is present
  expect(await screen.findByText('Buy milk')).toBeInTheDocument()

  gate.resolve(new HttpResponse(null, { status: 500 }))

  // after the failure: onError restored the snapshot
  await waitFor(() => expect(screen.queryByText('Buy milk')).not.toBeInTheDocument())
  expect(screen.getByText('Existing')).toBeInTheDocument()
})
```

Two details are doing real work. Seeding the cache with `setQueryData` before rendering is what gives `onMutate` a snapshot to capture — the docs' own example does `const previousTodos = context.client.getQueryData(['todos'])`, and against an empty cache that is `undefined`, so the "rollback" restores nothing and the test proves nothing. And the deferred is what makes the mid-flight assertion possible at all; without it the response may resolve before your first `findByText` runs, and you assert on the settled state while believing you asserted on the optimistic one. The rollback mechanics themselves live in [advanced rollback strategies](../14-optimistic-updates-patterns/01-advanced-rollback-strategies.md); the lifecycle they hang off is [05 · mutation lifecycle](../05-usemutation/01-mutation-lifecycle.md).

## Testing the invalidation a mutation triggers

The docs' optimistic example ends with:

```
onSettled: (data, error, variables, onMutateResult, context) =>
  context.client.invalidateQueries({ queryKey: ['todos'] })
```

and notes that you should *"make sure to _return_ the Promise from the query invalidation"* to keep the mutation `pending` until the refetch completes. That return is directly testable and frequently missing: without it, `isPending` flips to false while the list is still refetching, so a form that re-enables its submit button on `!isPending` re-enables it over stale rows.

Assert it the way [01b](01b-mocking-at-the-network-layer.md) argues — at the network:

```tsx
test('creating a todo refetches the list before the mutation settles', async () => {
  let listCalls = 0
  server.use(
    http.get('/api/todos', () => {
      listCalls += 1
      return HttpResponse.json([{ id: '1', title: 'Existing' }])
    }),
    http.post('/api/todos', () => HttpResponse.json({ id: '2', title: 'Buy milk' })),
  )

  renderWithClient(<TodoList />)
  await screen.findByText('Existing')
  expect(listCalls).toBe(1)

  await userEvent.click(screen.getByRole('button', { name: /add/i }))

  await waitFor(() => expect(listCalls).toBe(2))
})
```

Counting requests also catches the mismatched-key bug that a spy on `invalidateQueries` cannot see: invalidating `['todo']` when the list subscribes to `['todos']` calls the method, satisfies the spy, and refetches nothing.

## Mutation scopes

If a test fires the same mutation twice and expects two concurrent requests, check for a `scope`:

> *"Per default, all mutations run in parallel - even if you invoke `.mutate()` of the same mutation multiple times. Mutations can be given a `scope` with an `id` to avoid that. All mutations with the same `scope.id` will run in serial"*

A scoped mutation queues, so the second request does not leave until the first settles. A test written against the parallel assumption — two clicks, then `expect(postCalls).toBe(2)` immediately — sees one call and looks like a dropped event.

## Gotchas

**★ `mutateAsync` rejects and the test fails as an unhandled rejection instead of as your assertion.** Cause: `mutateAsync` *"will resolve on success or throw on an error"*, and an un-awaited rejection escapes. Fix: `await expect(result.current.mutateAsync(vars)).rejects.toThrow()`, or use `mutate` and wait on `isError`.

**★ Calling `result.current.mutate()` produces React `act` warnings and the next line reads a stale `result.current`.** Cause: the state update originates outside React's event system, so the render has not been flushed when your assertion runs. Fix: `act(() => { result.current.mutate(vars) })`. Do not wrap the whole flow in `await act(async () => ...)`; that flushes past the `isPending` frame you may need.

**★ The optimistic-state assertion passes even when the component has no optimistic update.** Cause: the mocked response resolves in the same microtask flush as the click, so by the time `findByText` runs the *server's* data is already rendered and looks identical to the optimistic row. Fix: gate the response on a deferred the test resolves explicitly, and assert the optimistic row **before** resolving it.

**★ The rollback test passes against a component with no rollback at all.** Cause: the cache was empty, so `onMutate`'s snapshot was `undefined` and "restoring" it produced the same empty list the failure would have produced anyway. Fix: seed with `queryClient.setQueryData(['todos'], [...])` before rendering and assert the *seeded* row is back, not merely that the optimistic row is gone.

**★ `onError` throws while handling an error, and the real error is buried.** Cause: `onMutateResult` is optional; if `onMutate` threw before returning, the third argument is `undefined` and `onMutateResult.previousTodos` throws inside the handler. Fix: guard it — `if (onMutateResult?.previousTodos) { ... }` — and add a test that forces `onMutate` to fail.

**★ A hook reads `context.previousTodos` in `onError` and the rollback silently stops working.** Cause: in v5 the third argument is `onMutateResult` and `context` is the fourth parameter (`MutationFunctionContext`, carrying `context.client`). Code written against the old naming now reads the wrong object. Fix: rename to the documented positions; a test that asserts the *restored data* — rather than mocking the callback — catches this, which is the argument for testing effects instead of calls.

**★ A `mutate()`-level `onSuccess` never runs and only in the app, never in tests.** Cause: the docs' caveat — *"those additional callbacks won't run if your component unmounts before the mutation finishes"* — and the app navigates on submit while the test does not. Fix: move anything that must survive unmount onto `useMutation`, and write the `unmount()` test above so the constraint is encoded.

**★ A test asserts that a hook-level callback runs before a call-site one.** Cause: both fire, but the guide does not state their relative order. Fix: delete the ordering assertion. Assert that each observable effect happened; ordering here is unspecified and pinning it makes the suite fail on a patch release for no defect.

**★ Two `mutate()` calls produce one request.** Cause: the mutation has a `scope.id`, and *"All mutations with the same `scope.id` will run in serial"* — the second is queued, not dropped. Fix: `await waitFor` the second request rather than asserting the count synchronously, or drop the scope if serialisation was not intended.

**★ The submit button re-enables while the list is still refetching.** Cause: `onSettled` invalidates but does not **return** the invalidation promise, so the mutation leaves `pending` before the refetch finishes — the docs call this out explicitly. Fix: `return context.client.invalidateQueries({ queryKey: ['todos'] })`, and test it by asserting `isPending` is still true after the POST resolves but before the GET does.

## Interview questions

**★ Why do queries and mutations need different retry configuration in a test client?**
Because their defaults are opposites. *Important Defaults* says failing queries are retried three times with exponential backoff, which is what makes an unconfigured error-state query test hang. The *Mutations* guide says *"By default, TanStack Query will not retry a mutation on error"*, so a mutation error test is already fast. Setting `mutations: { retry: false }` in the test client is therefore defensive rather than corrective: it protects the suite from an application-level mutation retry policy being copied into the test helper later. Understanding which of the two lines is load-bearing is the difference between configuring deliberately and cargo-culting a snippet.

**★ A `mutate()`-level `onSuccess` works in every test and fails in production. What is the mechanism?**
The docs state that callbacks passed to `mutate()` itself *"won't run if your component unmounts before the mutation finishes"*. Production submits typically navigate — the route changes the instant the promise resolves, or optimistically even before — so the component that owns the call site is gone by the time the callback would fire. Tests rarely unmount mid-flight, so they never reproduce it. The fix is architectural, not test-side: callbacks with consequences that outlive the component (invalidation, cache writes, rollback) belong on the `useMutation` declaration, which survives unmount; call-site callbacks are for this component's own UI. The test that encodes it renders the hook, fires `mutate` with a call-site callback, calls `unmount()` while the request is in flight, and asserts the callback was not invoked.

**★ How would you test an optimistic update *and* its rollback, given a mocked network that resolves instantly?**
Instantly is the problem: the optimistic frame and the settled frame collapse into one and any assertion passes for the wrong reason. Replace the instant response with a deferred promise the test resolves by hand, so the request stays in flight for exactly as long as you want. Seed the cache with `setQueryData` first, because `onMutate` snapshots via `getQueryData` and an empty cache yields an `undefined` snapshot that makes a rollback indistinguishable from doing nothing. Then: render, act, assert the optimistic row is on screen while the gate is still closed, resolve the gate with a 500, and assert both that the optimistic row is gone *and* that the seeded row is back. Asserting only the first half passes against a component that has no rollback.

**★ Why assert on a request count rather than on a spy over `invalidateQueries`?**
Because the spy proves that a method was called, and the bug in this area is almost always that it was called with a key that matches nothing. `invalidateQueries({ queryKey: ['todo'] })` against a list subscribed to `['todos']` satisfies the spy perfectly and refetches nothing. The documentation describes invalidation's observable consequences — the query is marked stale, overriding any `staleTime`, and if it is currently rendered it is refetched in the background — so the honest assertions are a second request at the network layer and updated content in the DOM. Those also survive a refactor from `invalidateQueries` to `refetch` or to a `setQueryData` write, which a spy does not.

**★ What is `onMutateResult`, why did the name change, and how does it break a test suite that mocks callbacks?**
In v5 the mutation callbacks take `(data, variables, onMutateResult, context)`; the third positional argument is whatever `onMutate` returned, and `context` moved to fourth, carrying `context.client` — the `QueryClient`, without needing `useQueryClient`. Code written against the older naming that destructures `context.previousTodos` in the third slot is now reading a `MutationFunctionContext` and gets `undefined`, so the rollback silently no-ops. A suite that tests callbacks by mocking them and asserting they were called is blind to this, because a mock does not care what its parameters mean. A suite that asserts on the *restored cache state* catches it on the first run. It is a concrete case of the general rule: assert effects, not invocations.

**★ Why is `act()` needed around `result.current.mutate(...)` but not around a `userEvent.click` that triggers the same mutation?**
`userEvent` dispatches a real DOM event, so React owns the update and batches and flushes it through its own event handling; Testing Library also wraps its interactions appropriately. Calling `mutate` straight off `result.current` originates the state change from outside React entirely — it is a plain function call in test code — so React has no opportunity to schedule and flush the resulting render before your next statement executes. Wrapping in `act` gives it that opportunity and removes the warning. The trap is over-correcting into `await act(async () => { ... })` around the whole mutation, which flushes all pending work and destroys any chance of asserting the intermediate `isPending` or optimistic state.

---

← [Mocking at the network layer](01b-mocking-at-the-network-layer.md) · [Topic index](../README.md) · Next → [Suspense and harness hazards](01d-suspense-and-harness-hazards.md)
