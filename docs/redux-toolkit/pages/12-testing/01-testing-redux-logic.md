---
title: "Testing Redux Logic: Reducers, Thunks & RTK Query"
sidebar_label: "Testing Redux Logic"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against [Redux's official testing guide](https://redux.js.org/usage/writing-tests)
> and the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0**.
> Documentation-validated; **no sandbox run** — no test suite was executed to produce this page.
> 🔴 This page was **corrected** on 2026-09-06: its previous advice inverted the official
> recommendation on both mocking hooks and preferring isolated reducer tests.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 Testing Redux Logic: Reducers, Thunks & RTK Query

## 1. Under-The-Hood Mechanics

🔴 **Start here, because it is the opposite of what most Redux test suites do.** Redux's own testing
guide does not recommend unit-testing reducers, actions and selectors as the default. It recommends the
reverse:

> *"Prefer writing integration tests with everything working together. For a React app using Redux,
> render a `<Provider>` with a real store instance wrapping the components being tested. Interactions
> with the page being tested should use real Redux logic, with API calls mocked out so app code doesn't
> have to change, and assert that the UI is updated appropriately."*

And on isolated unit tests:

> *"If needed, use basic unit tests for pure functions such as particularly complex reducers or
> selectors. However, in many cases, these are just implementation details that are covered by
> integration tests instead."*

The reasoning is that Redux is an implementation detail: *"the end-user does not know, and does not care
whether Redux is used within the application at all."* A test asserting that `cartReducer` returned a
particular object proves the implementation matches itself; it does not prove the cart works.

### The one prohibition worth memorising

> 🔴 *"Do **not** try to mock selector functions or the React-Redux hooks! Mocking imports from
> libraries is fragile, and doesn't give you confidence that your actual app code is working."*

This rules out `jest.mock('../api/apiSlice')` and mocking `useSelector` — a common shortcut for
"unit-testing a connected component". What you get is a test that passes when the component is broken,
because the thing you replaced is the thing that would have failed.

### So what does the pyramid look like?

| Level | What it does | When |
|---|---|---|
| **Integration (default)** | Render the component tree inside `<Provider>` with a **real** store, mock only the network | Almost always |
| **Reducer unit test** | Call `slice.reducer(state, action)` directly | A genuinely complex reducer — discount stacking, state machines — where enumerating cases through the UI would be absurd |
| **Thunk / RTK Query** | Dispatch against a real store with the network mocked | Logic that is about the sequence of actions, not the pixels |

### Getting initial state, without the `@@INIT` trick
`slice.getInitialState()` returns it directly. Passing a fake action type to coax a reducer into
returning its default works, but it relies on the reducer's fall-through rather than asking it a
question:

```typescript
const initial = cartSlice.getInitialState();          // ✅ explicit
const initial = cartReducer(undefined, { type: '@@INIT' });   // ⚠️ works, but indirect
```

### Mocking the network, not the code
Redux recommends **MSW**: *"mock async requests at the `fetch/xhr` level using tools like `msw`. By
mocking requests at this level, none of the thunk logic has to change in a test — the thunk still tries
to make a 'real' async request, it just gets intercepted."* Every layer under test — `fetchBaseQuery`'s
header logic, cache keys, tag invalidation, `transformResponse` — executes exactly as it does in
production.

### A fresh store per test, always
> *"the test code should create a separate Redux store instance for every test, rather than reusing the
> same store instance and resetting its state."*

That is what the `renderWithProviders` helper below is for.

---

## 2. Real-World Engineering Scenario

**Scenario**: CI Pipeline Catching a Regression in Coupon Discount Logic Before It Reaches Production.
A reducer computing cart totals with coupon discounts has non-obvious edge cases (stacking rules, minimum order thresholds, expired coupons). Unit tests directly against `cartReducer` — feeding in a sequence of `addItem`/`applyCoupon` actions and asserting the final `total` — run in milliseconds in CI and catch a regression in discount math the moment a refactor breaks it, long before it would surface in a slower end-to-end test or, worse, in production.

---

## 3. Production-Grade Code Example

```typescript
// cartSlice.test.ts — pure reducer test, no store, no React
import { cartReducer, addItem, applyCoupon } from './cartSlice';

describe('cartReducer', () => {
  it('accumulates quantity when the same product is added twice', () => {
    let state = cartReducer(undefined, { type: '@@INIT' }); // get initialState via any unmatched action
    state = cartReducer(state, addItem('sku_1', 1000, 1));
    state = cartReducer(state, addItem('sku_1', 1000, 2));

    expect(state.items).toEqual([{ productId: 'sku_1', priceCents: 1000, quantity: 3 }]);
  });

  it('applies a coupon code to state', () => {
    const state = cartReducer(undefined, applyCoupon('SAVE10'));
    expect(state.couponCode).toBe('SAVE10');
  });
});
```

```tsx
// test-utils.tsx — the helper Redux's own guide documents: a NEW store for every test
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../app/rootReducer';
import type { RootState, AppStore } from '../app/store';

export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({ reducer: rootReducer, preloadedState });
}

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries' | 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedState = {}, store = setupStore(preloadedState), ...renderOptions }: ExtendedRenderOptions = {},
) {
  const Wrapper = ({ children }: React.PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
```

```tsx
// CartPage.test.tsx — the DEFAULT shape: real store, real reducers, only the network mocked
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';

const server = setupServer(
  http.post('/api/cart/items', () => HttpResponse.json({ items: [{ productId: 'sku_1', quantity: 1 }] })),
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('adds an item to the cart and shows it', async () => {
  const { user } = renderWithProviders(<CartPage />);

  await user.click(screen.getByRole('button', { name: /add to cart/i }));

  // Asserting on what the user sees — not on store.getState()
  expect(await screen.findByText(/1 item in your cart/i)).toBeInTheDocument();
});
```

---

## Gotchas

### Mocking `useSelector`, `useDispatch` or a generated RTK Query hook
**Symptom.** A green suite over a broken feature. The mock returns what the test expects regardless of
whether the real selector, endpoint or cache logic works.
**Cause.** Replacing the library boundary removes the code under test. Redux's guide is unambiguous:
*"Do not try to mock selector functions or the React-Redux hooks! Mocking imports from libraries is
fragile, and doesn't give you confidence that your actual app code is working."*
**Fix.** Render with a real store and mock the **network** instead.
```typescript
// ❌ WRONG: the thing you replaced is the thing that would have failed
jest.mock('../api/apiSlice');

// ✅ CORRECT: real store, real hooks, intercepted at fetch
server.use(http.get('/api/posts/:id', () => HttpResponse.json({ id: '1', title: 'Hello' })));
renderWithProviders(<PostDetail postId="1" />);
```

### Reusing one store across tests
**Symptom.** Tests pass alone and fail in a suite, or in a different order.
**Cause.** State leaks between cases — a coupon applied in one test is still applied in the next. The
guide asks for "a separate Redux store instance for every test, rather than reusing the same store
instance and resetting its state", because resetting is something you can forget and constructing is not.
**Fix.** A fresh `setupStore()` per test, which `renderWithProviders` does by default.

### Importing the app's singleton store into a test
**Symptom.** As above, plus tests that accidentally depend on the app's real middleware, RTK Query
listeners and persisted state.
**Cause.** `import { store } from '../../app/store'` is the module-scope instance the whole app shares.
**Fix.** Import the **root reducer** and build a store per test. This is the real content of the old
"don't test through a store" advice: the problem is the *singleton*, not the store.
```typescript
// ❌ pulls in the entire app's middleware stack and shares state across every test
import { store } from '../../app/store';
store.dispatch(addItem('sku_1', 1000, 1));

// ✅ a store scoped to this test — or no store at all, for a pure reducer check
const state = cartReducer(cartSlice.getInitialState(), addItem('sku_1', 1000, 1));
```

### Asserting on `store.getState()` in a component test
**Symptom.** A test that breaks whenever state is reshaped, even though the UI is unchanged.
**Cause.** It asserts an implementation detail. The store shape is not the contract; the rendered output
is.
**Fix.** Assert on what the user sees. Keep `store.getState()` assertions for thunk and reducer tests,
where the action sequence genuinely *is* the thing under test.

### Unit-testing every reducer on principle
**Symptom.** A large, slow-to-maintain suite that mirrors the implementation and catches nothing.
**Cause.** Treating reducer tests as the default rather than the exception. The guide's position is that
in many cases these "are just implementation details that are covered by integration tests instead".
**Fix.** Reserve them for reducers whose logic is genuinely intricate — discount stacking, state machines,
anything with many cases — where enumerating through the UI would be absurd.

## Interview questions

**★ What does Redux's own testing guide recommend, and why does it surprise people?**
It recommends integration tests as the default — render the component tree inside a `<Provider>` with a
real store, mock only the network, and assert on the UI. It surprises people because Redux's purity makes
reducers so easy to unit-test that testing them feels obligatory. The guide's argument is that Redux is
an implementation detail the end user never sees, so a test that asserts a reducer returned a particular
object proves the implementation matches itself rather than that the feature works.

**★ Why must you not mock `useSelector` or a generated RTK Query hook?**
Because the mock replaces exactly the code that would have failed. Redux states it directly: mocking
imports from libraries is fragile and gives no confidence the real app code works. A component test with
mocked hooks passes when the selector is wrong, the endpoint is misconfigured, or the cache key is
mismatched. Mock the network instead and let every real layer run.

**★ Where do isolated reducer tests still earn their place?**
Where the logic is genuinely intricate and the case space is large — coupon stacking with minimum-order
thresholds and expiry, or a state machine with many transitions. Enumerating those through the UI would be
absurdly slow and unreadable, and the reducer is a pure function, so the test is cheap and precise. That is
the exception the guide allows, not the default it recommends.

**★ Why a new store per test rather than resetting one?**
Because resetting is a thing you can forget, and forgetting produces order-dependent failures that are
painful to diagnose — a coupon applied in one test silently changing another's starting conditions. The
guide asks for a separate instance per test for exactly this reason, which is why the documented
`renderWithProviders` constructs one by default and returns it for the cases that need access.

**Is testing "through a store" wrong, then?**
No — and this is worth untangling, because the common advice conflates two different things. Importing the
**app's singleton** store into a test is wrong: it shares state across cases and drags in the whole
middleware stack. Building a **fresh** store per test is the recommended default. The pure-reducer call is
the narrow optimisation for when you want one function's behaviour and nothing else.


---

← [Code splitting](../11-code-splitting/01-dynamic-reducer-injection.md) · [Topic index](../README.md) · Next → [Testing thunks & RTK Query](./01b-testing-thunks-and-rtk-query.md)
