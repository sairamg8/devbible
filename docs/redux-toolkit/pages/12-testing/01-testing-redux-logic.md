---
title: "Testing Redux Logic: Reducers, Thunks & RTK Query"
sidebar_label: "Testing Redux Logic"
sidebar_position: 1
---

# 📦 Testing Redux Logic: Reducers, Thunks & RTK Query

## 1. Under-The-Hood Mechanics

Redux's core design principle — reducers are pure functions, actions are plain objects — is what makes Redux logic exceptionally cheap to unit test compared to typical UI code: no rendering, no DOM, no mocking a framework runtime is required for the reducer/thunk layer itself.

### Testing Slice Reducers Directly
A slice's exported `reducer` is just a function `(state, action) => newState`. Calling it directly with a hand-built action object, and asserting on the returned state, requires no store, no middleware, no React at all:

```typescript
expect(cartReducer(initialState, addItem({ productId: '1', quantity: 1 }))).toEqual({
  items: [{ productId: '1', quantity: 1 }],
});
```

### Testing Thunks: Mock `dispatch`/`getState`, Assert the Action Sequence
A `createAsyncThunk` is tested by dispatching it against a **real, minimal store** (or a mock dispatch/getState pair) and asserting the sequence of `pending`/`fulfilled`/`rejected` actions — not by trying to unit-test the thunk function's internals in isolation, since its whole job is producing that action sequence via side effects.

### Testing RTK Query: MSW vs Mocking Generated Hooks
Two valid strategies, at different levels of the pyramid:
- **MSW (Mock Service Worker)** intercepts the actual `fetch()` call at the network layer, so the entire real RTK Query pipeline (cache keys, tag invalidation, `fetchBaseQuery` header logic) runs for real — an integration test, higher confidence, slightly slower.
- **Mocking the generated hooks directly** (e.g. `jest.mock('../api/apiSlice')`) isolates a component from RTK Query entirely — a pure unit test of the component's rendering logic, faster, but doesn't verify cache/tag behavior at all.

### Testing Connected Components
A component using `useAppSelector`/`useAppDispatch` needs a real (or realistically-shaped) `<Provider store={...}>` wrapper to render at all — the standard pattern is a custom `render()` helper that wraps React Testing Library's `render` with a fresh store per test.

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

```tsx
// test-utils.tsx — reusable render helper for connected components
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../app/rootReducer';
import type { RootState } from '../app/store';

export function renderWithStore(ui: React.ReactElement, preloadedState?: Partial<RootState>) {
  const store = configureStore({ reducer: rootReducer, preloadedState });
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}
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

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Testing Reducers Through `dispatch` on a Full App Store
```typescript
// ❌ OVERKILL: pulls in the entire app's middleware stack, all slices, and RTK Query setup
// just to test one reducer's pure logic — slow, and failures are hard to localize
import { store } from '../../app/store';
store.dispatch(addItem('sku_1', 1000, 1));
expect(store.getState().cart.items).toEqual([...]);

// ✅ CORRECT: call the reducer function directly — no store needed at all
const state = cartReducer(undefined, addItem('sku_1', 1000, 1));
```

### ⚠️ Pitfall 2: Mocking `fetch` Globally Instead of Using MSW
Hand-rolled `global.fetch = jest.fn()` mocks tend to drift from the real API's response shape over time (nobody updates the mock when the backend contract changes) and bypass `fetchBaseQuery`'s actual header/error-handling logic entirely. MSW intercepts at the network boundary, so the exact same `fetchBaseQuery` code path executes in tests as in production — a contract mismatch is far more likely to surface.

### ⚠️ Pitfall 3: Sharing One Store Instance Across Multiple Tests
Reusing a single `configureStore()` instance across `it()` blocks (instead of a fresh store per test) leaks state between tests — a coupon applied in test 1 can silently affect the initial conditions of test 2, producing order-dependent test flakiness. Always construct a fresh store (or use `beforeEach`) per test case.
