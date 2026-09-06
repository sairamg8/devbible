---
title: "Testing the async layer: thunk action sequences and RTK Query endpoints"
sidebar_label: "Testing thunks & RTK Query"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against [Redux's official testing guide](https://redux.js.org/usage/writing-tests)
> and the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0**.
> Documentation-validated; **no sandbox run** — no test suite was executed to produce this page.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 Testing Thunks & RTK Query Endpoints

**[The previous page](./01-testing-redux-logic.md) argued for integration tests as the default.** This
one covers the cases where the thing under test genuinely *is* the Redux layer: a thunk whose entire job
is to produce a sequence of actions, and an RTK Query endpoint whose behaviour is caching, keys and
invalidation rather than anything the user can see directly. Both are still tested against a real store
with the network mocked — what changes is what you assert on.

## 1. Under-The-Hood Mechanics

### A thunk's contract is its action sequence
A `createAsyncThunk` has no return value worth asserting in isolation: its output *is*
`pending` → (`fulfilled` | `rejected`), plus whatever it wrote to the store. So it is tested by
dispatching it against a real, minimal store and asserting on the resulting action or state — not by
calling the payload creator directly, which skips the entire mechanism.

Remember that dispatching resolves with the **action object** and does not throw. That makes the
assertion straightforward:

```typescript
const result = await store.dispatch(submitOrder({ cartId: 'cart_1' }));
expect(result.type).toBe('orders/submit/rejected');
expect(result.payload).toEqual({ code: 'OUT_OF_STOCK', message: 'Cart is empty.' });
```
If you would rather assert with exceptions, `.unwrap()` re-throws — but for a test asserting the
*sequence*, the action object is the more direct object of study.

### An RTK Query endpoint can be driven without React
`api.endpoints.<name>.initiate(arg)` is the thunk behind the generated hook. Dispatching it exercises the
whole pipeline — cache key computation, `fetchBaseQuery`, `transformResponse`, tag registration — with no
component and no renderer:

```typescript
const result = await store.dispatch(apiSlice.endpoints.getPostById.initiate('1'));
expect(result.data).toEqual({ id: '1', title: 'Hello' });
```
🔴 **The test store needs the middleware, not just the reducer.** This is the same omission that breaks
RTK Query in an application, and it presents in tests as a promise that never settles.

## 2. Real-World Engineering Scenario

**Scenario**: A Coupon Endpoint Whose Bug Is Entirely in the Cache.
A discount service returns the right JSON every time — verified by hand, verified in staging. In the app,
applying a coupon updates the totals panel but not the line-item table, and only when the user arrived via
a particular route. Nothing about that failure is visible in a component test with a mocked hook, and
nothing is visible in a reducer test either: the defect is that the mutation invalidates
`{ type: 'Cart', id }` while the line-item query provides only `{ type: 'Cart', id: 'LIST' }`. It is a
test at this level — real store, real middleware, MSW at the socket — that fails when the tags do not
overlap.

## 3. Production-Grade Code Example

```typescript
// ordersThunks.test.ts — testing a createAsyncThunk's dispatched action sequence
import { configureStore } from '@reduxjs/toolkit';
import { submitOrder } from './ordersThunks';

describe('submitOrder thunk', () => {
  it('dispatches pending then rejected with a typed payload on empty cart', async () => {
    const store = configureStore({
      reducer: { cart: () => ({ items: [] }), users: () => ({}) },
    });

    const result = await store.dispatch(submitOrder({ cartId: 'cart_1' }));

    expect(result.type).toBe('orders/submit/rejected');
    expect(result.payload).toEqual({ code: 'OUT_OF_STOCK', message: 'Cart is empty.' });
  });
});
```

```typescript
// apiSlice.test.ts — MSW-backed integration test of an RTK Query endpoint
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { apiSlice } from './apiSlice';
import { configureStore } from '@reduxjs/toolkit';

const server = setupServer(
  http.get('/api/posts/:id', () => HttpResponse.json({ id: '1', title: 'Hello' }))
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('fetches and caches a post by id', async () => {
  const store = configureStore({
    reducer: { [apiSlice.reducerPath]: apiSlice.reducer },
    middleware: (gdm) => gdm().concat(apiSlice.middleware),
  });

  const result = await store.dispatch(apiSlice.endpoints.getPostById.initiate('1'));
  expect(result.data).toEqual({ id: '1', title: 'Hello' });
});
```

## Gotchas

### Hand-rolling `global.fetch = jest.fn()`
**Symptom.** Tests that keep passing after the backend contract changes, and `fetchBaseQuery` logic that
is never exercised.
**Cause.** A `fetch` stub bypasses header preparation, error normalisation, and everything RTK Query
does around the request.
**Fix.** MSW intercepts at the network boundary, so the same code path runs in tests as in production and
a contract mismatch actually surfaces.

### Forgetting the RTK Query middleware in a test store
**Symptom.** An endpoint test hangs, or `isLoading` never resolves.
**Cause.** The same omission as in the app: a store with the API reducer but not its middleware.
**Fix.** `middleware: (gdm) => gdm().concat(apiSlice.middleware)` in the test store too — one more reason
to share a single `setupStore` factory between the app and the tests.

### Calling the payload creator directly instead of dispatching
**Symptom.** A green test over a thunk that is broken in the app.
**Cause.** `await myThunk.payloadCreator(arg, fakeThunkApi)` skips the wrapper that dispatches `pending`,
catches rejections, applies `condition` and attaches `meta`. You have tested a plain async function and
learned nothing about the thunk.
**Fix.** Dispatch it against a real store. If the store needs to be minimal, it can be: stub reducers are
fine, the middleware is the part that matters.

### Asserting on the number of dispatched actions
**Symptom.** A test that breaks when RTK adds an internal action, or when RTK Query is introduced
elsewhere in the app.
**Cause.** Counting actions couples the test to the framework's internals rather than to your sequence.
**Fix.** Assert on the specific actions you care about — by type, or via the `.match()` predicates — and
let anything else pass unremarked.

### Forgetting to reset MSW handlers between tests
**Symptom.** A handler overridden with `server.use(...)` in one test silently changes another.
**Cause.** `server.use` is additive for the lifetime of the server.
**Fix.** The documented trio: `server.listen()` in `beforeAll`, `server.resetHandlers()` in `afterEach`,
`server.close()` in `afterAll`. The middle one is the one people omit.

### A cache that survives between tests
**Symptom.** A second test sees data fetched by the first, and its "loading" assertion never holds.
**Cause.** A shared store means a shared RTK Query cache, and cached entries are exactly what the library
is designed to reuse.
**Fix.** A fresh store per test — the same rule as everywhere else, and the reason it matters more here is
that the cache makes the leakage invisible rather than merely stateful.

## Interview questions

**★ How do you test a `createAsyncThunk`?**
Dispatch it against a real store with the network mocked, and assert on the action it resolves with or on
the state it produced. Its contract is the `pending` → `fulfilled`/`rejected` sequence, so calling the
payload creator directly tests a plain async function and skips everything that makes it a thunk —
`pending`, rejection handling, `condition`, `meta.requestId`.

**How would you test an RTK Query endpoint properly?**
Build a store with the API reducer and its middleware, put MSW in front of the network, and either dispatch
`api.endpoints.getThing.initiate(arg)` for the cache-level behaviour or render a component using the
generated hook for the integration-level behaviour. Because nothing is mocked above the socket,
`fetchBaseQuery`'s headers, `transformResponse`, cache keys and tag invalidation all execute for real —
which is the entire point, since those are where the bugs live.

**★ Why does an RTK Query test need the middleware and not just the reducer?**
Because the middleware *is* the implementation. The reducer holds the cache slice; the middleware performs
subscription reference-counting, cache lifetime, tag invalidation, polling and the focus listeners. A test
store with only the reducer typically hangs — the request is never driven — which is the same failure mode
as forgetting it in the application, only harder to spot because a hanging promise reads as a slow test.

**When would you dispatch `initiate()` rather than rendering a component?**
When the behaviour under test is the cache rather than the UI — whether tags overlap, whether a second
subscriber reuses an entry, what `transformResponse` produced. Driving the endpoint directly removes the
renderer from the picture and makes the assertion about the thing that is actually in question. For
anything the user perceives, render the component instead.

**Why is asserting the exact list of dispatched actions a bad idea?**
It couples the test to framework internals. RTK and RTK Query dispatch their own actions, and the set
changes between versions and as unrelated features are added. Assert that the actions you care about
occurred, in the order that matters, using the generated `.match()` predicates — and stay indifferent to
everything else in the log.

---

← [Testing Redux logic](./01-testing-redux-logic.md) · [Topic index](../README.md) · Next → [Migrating from classic Redux](../13-migration/01-from-classic-redux.md)
