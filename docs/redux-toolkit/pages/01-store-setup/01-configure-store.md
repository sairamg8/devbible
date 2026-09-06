---
title: "`configureStore`: Store Assembly & Default Middleware Stack"
sidebar_label: "`configureStore`"
sidebar_position: 1
---

# 📦 `configureStore`: Store Assembly & Default Middleware Stack

## 1. Under-The-Hood Mechanics

`configureStore` is a thin, opinionated wrapper around the classic Redux `createStore` + `applyMiddleware` + `combineReducers` trio. It exists to remove the boilerplate (and footguns) of hand-assembling a store.

```
configureStore({ reducer, middleware, devTools, preloadedState })
        │
        ├── reducer object ──► combineReducers() ──► single root reducer
        ├── middleware ──► getDefaultMiddleware() ──► [actionCreatorCheck, immutableCheck, thunk, serializableCheck, ...custom]
        ├── devTools ──► composeWithDevTools() (only when Redux DevTools extension is present)
        └── preloadedState ──► hydrates the root reducer's initial state (e.g. from SSR HTML payload)
```

### Reducer Normalization
If `reducer` is passed as a plain object (`{ users: usersReducer, cart: cartReducer }`), RTK internally calls `combineReducers()` for you, producing the familiar `{ users: {...}, cart: {...} }` shape. If `reducer` is already a single function, it is used as the root reducer verbatim — this is how `combineSlices()` dynamic injection (see [code splitting](../11-code-splitting/01-dynamic-reducer-injection.md)) plugs in.

### Default Middleware Stack (Dev vs Prod)
`configureStore` calls `getDefaultMiddleware()` internally unless you override it. In development the returned array is, **in this exact order**:

1. `actionCreatorInvariantMiddleware` (dev only) — catches an action *creator* dispatched without being called: `dispatch(addItem)` instead of `dispatch(addItem())`. A silent no-op otherwise, because a function is a perfectly valid thing to dispatch once thunk is in the chain.
2. `immutableStateInvariantMiddleware` (dev only) — **deeply compares** state values to detect mutations. It catches them both inside reducers during a dispatch *and* between dispatches, "such as in a component or a selector".
3. `redux-thunk` — lets action creators return functions instead of plain objects.
4. `serializableStateInvariantMiddleware` (dev only) — walks every dispatched action and the resulting state tree, warning on non-serializable values (functions, Promises, class instances, `Map`/`Set`).

🔴 **The immutability check does not freeze anything.** It takes a copy and compares — a common
misreading, because state in an RTK app *is* usually frozen, by Immer's own `autoFreeze` inside
`createSlice`. Two separate mechanisms with two separate failure modes: Immer's freeze throws on the
mutation attempt, the invariant middleware reports it after the fact on the next dispatch.

In a production build the array is just `[thunk]` — all three dev-only checks are **stripped**
(`process.env.NODE_ENV === 'production'`), because each one costs a full state traversal per
dispatch.

---

## 2. Real-World Engineering Scenario

**Scenario**: Server-Side Rendered E-Commerce App with Store Hydration.
A Next.js/Express SSR app fetches the initial cart and user session on the server, renders HTML, and serializes that state into a `<script>` tag. On the client, `configureStore({ reducer, preloadedState })` boots the store with that exact snapshot so the first client render matches the server-rendered DOM byte-for-byte (avoiding hydration mismatches).

---

## 3. Production-Grade Code Example

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { usersReducer } from '../features/users/usersSlice';
import { cartReducer } from '../features/cart/cartSlice';
import { apiSlice } from '../features/api/apiSlice';

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: {
      users: usersReducer,
      cart: cartReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    // Extend, don't replace, the default middleware stack
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // Cart may briefly hold a non-serializable AbortController during checkout
        serializableCheck: {
          ignoredActions: ['cart/checkoutStarted'],
          ignoredPaths: ['cart.pendingRequestController'],
        },
      }).concat(apiSlice.middleware),
    devTools: process.env.NODE_ENV !== 'production' && {
      trace: true,
      traceLimit: 25,
    },
    preloadedState,
  });
}

export const store = makeStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```typescript
// server.tsx — hydrating the client store from SSR-fetched data
const serverStore = makeStore({
  users: { entities: { 'u_1': { id: 'u_1', name: 'Alex' } }, ids: ['u_1'] },
  cart: { items: [], total: 0 },
});
const html = renderToString(<App store={serverStore} />);
const dehydratedState = JSON.stringify(serverStore.getState()).replace(/</g, '\\u003c');
// Embed `dehydratedState` in a <script> tag; client calls makeStore(JSON.parse(dehydratedState))
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Overwriting the Default Middleware Instead of Extending It
```typescript
// ❌ WRONG: under RTK 1.x this silently replaced the entire default stack — losing thunk support
// and every dev safety check, with no warning. RTK 2.0 closed the footgun by removing the array
// form: `middleware` MUST now be a callback, so on the pinned version this no longer type-checks.
middleware: [myLoggerMiddleware],

// ✅ CORRECT: always start from getDefaultMiddleware() and .concat()/.prepend()
middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(myLoggerMiddleware),
```
Worth knowing *why* the callback became mandatory rather than merely recommended: passing an array
was the single most common way to lose the default stack by accident, and the symptom — thunks
mysteriously not dispatching — surfaced far from the cause. RTK 2.0 moved that failure from a silent
runtime regression to a compile-time error. The same reasoning removed the standalone
`getDefaultMiddleware` export: the only supported way to reach it is the callback parameter.

### ⚠️ Pitfall 2: Ignoring Serializability Warnings Instead of Fixing the Root Cause
Blanket-disabling `serializableCheck: false` silences a real signal — it usually means something non-serializable (a `File`, a `Promise`, a class instance) leaked into the store, which will break Redux DevTools persistence and time-travel. Prefer scoping `ignoredActions`/`ignoredPaths` narrowly over disabling the check entirely.

### ⚠️ Pitfall 3: Rebuilding the Store Object Per-Render in SSR
Calling `configureStore()` at module scope (not inside a per-request factory function) on a Node SSR server means **all concurrent requests share one store instance**, leaking one user's cart into another user's response. Always wrap SSR store creation in a factory function (`makeStore()`) invoked fresh per request.
