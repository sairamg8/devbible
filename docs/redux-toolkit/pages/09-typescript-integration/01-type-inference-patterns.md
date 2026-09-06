---
title: "TypeScript Integration: `RootState`, `AppDispatch` & Typed Thunks"
sidebar_label: "TypeScript Integration"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [usage with TypeScript](https://redux-toolkit.js.org/usage/usage-with-typescript),
> [`createAsyncThunk`](https://redux-toolkit.js.org/api/createAsyncThunk).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

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

### `withTypes` — pre-binding the generics once
RTK and React-Redux both expose a `withTypes` helper whose only job is to bind the store's types once so
call sites stop repeating them. It exists on `useDispatch`, `useSelector`, `useStore`,
`createAsyncThunk` and `createSelector`:

```typescript
// app/hooks.ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

// app/createAppAsyncThunk.ts — "set up those types once, so you don't have to repeat them each time"
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: ApiError;
}>();

// features/orders/thunks.ts — the config generic is now implicit
export const submitOrder = createAppAsyncThunk<Order, { cartId: string }>(
  'orders/submit',
  async ({ cartId }, { getState, rejectWithValue }) => { /* getState() is RootState */ },
);
```

### `Tuple` — the one place you must not use a plain array
If you build `middleware` or `enhancers` **without** starting from the default callback, RTK requires
its `Tuple` class rather than a plain array: *"you are required to use `Tuple` for type-safe creation of
your `middleware` array"*. It extends `Array` with typings that preserve each element's type in order,
which is what makes the resulting `dispatch` type know about every middleware you added.

```typescript
import { configureStore, Tuple } from '@reduxjs/toolkit';

configureStore({
  reducer: rootReducer,
  middleware: () => new Tuple(myMiddleware, myOtherMiddleware),   // not [myMiddleware, …]
});
```
In practice this is rare, because the recommended path — `getDefaultMiddleware().concat(…)` — already
returns a `Tuple`.

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

## Gotchas

### Hand-writing `RootState` instead of deriving it
**Symptom.** A slice's shape changes and nothing fails to compile; the mismatch surfaces at runtime as
`undefined`.
**Cause.** A hand-written interface is a second source of truth with nothing keeping it aligned.
**Fix.**
```typescript
// ❌ WRONG: manually duplicated interface drifts out of sync the moment a slice's shape changes
interface RootState {
  cart: { items: CartItem[] };
  users: { byId: Record<string, User> };
}

// ✅ CORRECT: always derive from the actual store
export type RootState = ReturnType<typeof store.getState>;
```

### Plain `Dispatch` where `AppDispatch` was needed
**Symptom.** `dispatch(someAsyncThunk())` is a type error saying a thunk is not assignable to
`AnyAction`.
**Cause.** Redux's base `Dispatch` describes a store with no middleware. Thunk support is added *by*
middleware, so only the store's own dispatch type knows about it.
**Fix.**
```typescript
// ❌ WRONG: plain redux Dispatch type doesn't know about thunk middleware
import type { Dispatch } from 'redux';
function useMyHook(dispatch: Dispatch) { dispatch(submitOrder({ cartId: '1' })); } // ❌ type error

// ✅ CORRECT: AppDispatch is inferred from the store WITH middleware applied
import type { AppDispatch } from '../../app/store';
function useMyHook(dispatch: AppDispatch) { dispatch(submitOrder({ cartId: '1' })); } // ✅
```

### Omitting `rejectValue` from the thunk config
**Symptom.** `action.payload` is `unknown` in every `rejected` handler, and the codebase fills with
casts.
**Cause.** The third generic is what tells TypeScript the type `rejectWithValue` was called with.
**Fix.** Fill it in whenever `rejectWithValue` is used at all — or bind it once with
`createAsyncThunk.withTypes` so it cannot be forgotten.

### A circular import between the store and a slice
**Symptom.** `RootState` resolves to `any`, or a runtime `Cannot access before initialization`.
**Cause.** `store.ts` imports every slice to build the reducer, so a slice importing `RootState` from
`store.ts` closes a cycle. TypeScript often tolerates it and silently widens; the bundler may not.
**Fix.** Import the type with `import type`, which is erased at compile time and cannot create a runtime
cycle — and prefer deriving `RootState` from the **root reducer** rather than the store:
```typescript
export type RootState = ReturnType<typeof rootReducer>;   // no store instance involved
```

### Typing `initialState` too loosely and losing it
**Symptom.** `state.status` is `string` rather than the union you declared, and comparisons against a
typo compile.
**Cause.** `initialState: { status: 'idle' }` infers `string`, not `'idle' | 'loading'`.
**Fix.** Annotate the state interface explicitly — `const initialState: CartState = { … }` or
`{ … } as CartState` — so the reducers infer from the interface rather than from the literal.

### Reaching for `PayloadAction` when there is no payload
**Symptom.** `PayloadAction<void>` scattered through a slice, and calls that must pass `undefined`.
**Cause.** Over-application of the pattern. A reducer that takes no payload simply omits the second
parameter.
**Fix.** `logout: (state) => initialState` — the generated creator then takes no argument at all.

### A plain array for `middleware` when not starting from the defaults
**Symptom.** `dispatch` loses knowledge of the middleware you added; thunks stop type-checking.
**Cause.** A plain array widens to a single element type and loses the per-position types RTK needs.
**Fix.** `new Tuple(a, b)` — or, far better, `getDefaultMiddleware().concat(a, b)`, which already returns
a `Tuple`.

## Interview questions

**★ Why are `RootState` and `AppDispatch` derived rather than declared?**
Because both are consequences of a value you already built. `RootState` is
`ReturnType<typeof store.getState>`, so adding a slice to the reducer map updates it with no manual
edit. `AppDispatch` is `typeof store.dispatch`, which matters because Redux's base `Dispatch` only knows
about plain action objects — thunk support comes from middleware, so only the store's own dispatch type
knows thunks are dispatchable. Declaring either by hand creates a second source of truth that drifts.

**★ What is `withTypes`, and what problem does it solve?**
It pre-binds a generic once so call sites stop repeating it — the docs describe it as setting up the
types once so you do not repeat them each time. It exists on `useDispatch`, `useSelector`, `useStore`,
`createAsyncThunk` and `createSelector`. The payoff is not keystrokes but consistency: with
`createAppAsyncThunk` there is no way to forget `rejectValue` and end up with `unknown` payloads in a
handler.

**★ What are `createAsyncThunk`'s three generics?**
`Returned`, `ThunkArg`, and `ThunkApiConfig`. The third is an object with optional `state`, `dispatch`,
`extra` and `rejectValue` keys, and it is the one people leave empty. Without `state`,
`thunkAPI.getState()` is `unknown`; without `rejectValue`, `action.payload` on the `rejected` case is
`unknown` and every handler needs a cast.

**Your slice imports `RootState` from the store and the store imports the slice. What breaks?**
A circular dependency. TypeScript frequently tolerates it by widening `RootState` toward `any`, which is
worse than an error because everything still compiles while inference is silently gone; at runtime the
bundler may throw on access before initialisation. Two fixes, both worth naming: use `import type` so the
import is erased, and derive `RootState` from the root reducer rather than the store instance so no value
import is needed.

**When is `Tuple` required?**
Only when you construct `middleware` or `enhancers` without starting from the default callback. A plain
array loses the per-position element types, so the resulting `dispatch` type no longer reflects what you
added. `getDefaultMiddleware().concat(…)` already returns a `Tuple`, which is why most codebases never
encounter it.

**How does `PayloadAction<T>` earn its place given it is a two-field type?**
It is the seam that makes everything downstream infer. Annotating the reducer's action parameter as
`PayloadAction<CartItem>` is what gives the generated action creator its argument type and what lets
`builder.addCase` narrow the action inside the handler. It is deliberately thin — the value is in where
it is applied, not in what it contains.

---

← [Immer internals](../08-immutability-and-immer/01-immer-internals.md) · [Topic index](../README.md) · Next → [Redux DevTools](../10-devtools-and-debugging/01-redux-devtools.md)
