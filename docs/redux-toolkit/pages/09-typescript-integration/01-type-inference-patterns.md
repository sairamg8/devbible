---
title: "TypeScript Integration: `RootState`, `AppDispatch` & Typed Thunks"
sidebar_label: "TypeScript Integration"
sidebar_position: 1
---

# 📦 TypeScript Integration: `RootState`, `AppDispatch` & Typed Thunks

## 1. Under-The-Hood Mechanics

RTK's TypeScript story is built entirely on **inference from the store you already built**, rather than hand-written interface duplication. Two derived types anchor everything else:

```typescript
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- `RootState` is inferred from `store.getState()`'s actual return type — which itself comes from whatever reducer object was passed to `configureStore`. Add a new slice to the reducer map, and `RootState` picks up the new key automatically, with zero manual type maintenance.
- `AppDispatch` matters specifically because the *default* `Dispatch` type from plain Redux only knows about plain action objects — it doesn't know your store's middleware (thunk) lets you dispatch **functions** (thunks) too. `typeof store.dispatch` captures the store's actual, middleware-extended dispatch signature, including thunk support.

### `PayloadAction<T>`
Every `createSlice` reducer's `action` parameter should be typed `PayloadAction<T>` (or the shorthand is inferred automatically when using the `reducers: { name: (state, action: PayloadAction<T>) => ... }` form) — this is a thin wrapper type: `{ type: string; payload: T }`.

### Typed `createAsyncThunk` Generics
`createAsyncThunk<Returned, ThunkArg, ThunkApiConfig>` takes three generic slots:
1. `Returned` — the resolved type of the payload creator's Promise.
2. `ThunkArg` — the type of the single argument passed to the thunk when dispatched.
3. `ThunkApiConfig` — an object type with optional `state`, `dispatch`, `rejectValue`, `extra` keys, used to type `thunkAPI.getState()`, `rejectWithValue()`, and `thunkAPI.extra` correctly.

---

## 2. Real-World Engineering Scenario

**Scenario**: Large Codebase, Many Contributors, Zero Tolerance for `any`.
A team of 20 engineers works across 30+ feature slices. Without a single centralized `RootState`/`AppDispatch` pair, each engineer would hand-roll (and inevitably let drift) their own type annotations for `useSelector`/`useDispatch` calls. By deriving both types once from the actual store, and exposing pre-typed `useAppSelector`/`useAppDispatch` hooks (see [React-Redux integration](../07-react-redux-integration/01-hooks-api.md)), a change to any slice's shape immediately surfaces as compile errors at every call site that reads the now-changed field — genuine type safety, not just annotation theater.

---

## 3. Production-Grade Code Example

```typescript
// app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { cartReducer } from '../features/cart/cartSlice';
import { usersReducer } from '../features/users/usersSlice';

export const store = configureStore({
  reducer: { cart: cartReducer, users: usersReducer },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
```

```typescript
// features/orders/ordersThunks.ts — fully typed createAsyncThunk
import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '../../app/store';

interface Order { id: string; total: number; }
interface SubmitOrderError { code: 'PAYMENT_DECLINED' | 'OUT_OF_STOCK'; message: string; }

export const submitOrder = createAsyncThunk<
  Order,                     // Returned
  { cartId: string },         // ThunkArg
  {
    state: RootState;             // typed thunkAPI.getState()
    dispatch: AppDispatch;         // typed thunkAPI.dispatch (needed to dispatch other thunks from inside this one)
    rejectValue: SubmitOrderError;   // typed thunkAPI.rejectWithValue() argument AND action.payload on rejected
  }
>('orders/submit', async ({ cartId }, { getState, rejectWithValue }) => {
  const state = getState(); // fully typed as RootState — state.cart, state.users all autocomplete
  const cart = state.cart;

  if (cart.items.length === 0) {
    return rejectWithValue({ code: 'OUT_OF_STOCK', message: 'Cart is empty.' });
  }

  const response = await fetch(`/api/orders`, { method: 'POST', body: JSON.stringify({ cartId }) });
  if (!response.ok) {
    return rejectWithValue({ code: 'PAYMENT_DECLINED', message: 'Payment failed.' });
  }
  return (await response.json()) as Order;
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Hand-Writing `RootState` Instead of Deriving It
```typescript
// ❌ WRONG: manually duplicated interface drifts out of sync the moment a slice's shape changes
interface RootState {
  cart: { items: CartItem[] };
  users: { byId: Record<string, User> };
}

// ✅ CORRECT: always derive from the actual store
export type RootState = ReturnType<typeof store.getState>;
```

### ⚠️ Pitfall 2: Using Plain `Dispatch` Instead of `AppDispatch` for Thunks
```typescript
// ❌ WRONG: plain redux Dispatch type doesn't know about thunk middleware —
// TypeScript will reject `dispatch(someAsyncThunk())` as a type error
import type { Dispatch } from 'redux';
function useMyHook(dispatch: Dispatch) { dispatch(submitOrder({ cartId: '1' })); } // ❌ type error

// ✅ CORRECT: AppDispatch is inferred from the store WITH middleware applied, so thunks type-check
import type { AppDispatch } from '../../app/store';
function useMyHook(dispatch: AppDispatch) { dispatch(submitOrder({ cartId: '1' })); } // ✅
```

### ⚠️ Pitfall 3: Forgetting `rejectValue` in the Generic Config
Without declaring `{ rejectValue: SubmitOrderError }` in `createAsyncThunk`'s third generic argument, `action.payload` on the `rejected` case types as `unknown`, forcing awkward casts everywhere the rejection is handled — always fill in `rejectValue` whenever `rejectWithValue()` is used inside the thunk body.
