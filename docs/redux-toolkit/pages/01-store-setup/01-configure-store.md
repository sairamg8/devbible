---
title: "`configureStore`: Store Assembly & Default Middleware Stack"
sidebar_label: "`configureStore`"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`configureStore`](https://redux-toolkit.js.org/api/configureStore),
> [`getDefaultMiddleware`](https://redux-toolkit.js.org/api/getDefaultMiddleware),
> [RTK 2.0 migration](https://redux-toolkit.js.org/usage/migrating-rtk-2).
> Documentation-validated; **no sandbox run** — `@reduxjs/toolkit` is not installed in this
> checkout, so every claim here is a doc quote, not a probe.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

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

## Gotchas

### Replacing the default middleware instead of extending it
**Symptom.** Thunks stop dispatching — `dispatch(someAsyncThunk())` throws *"Actions must be plain
objects"* — or, on RTK 2, the store simply will not type-check.
**Cause.** Passing `middleware` as an array replaces the whole stack. Under RTK 1.x that was silent;
the app booted and failed later, far from the cause.
**Fix.** Always start from the callback parameter and extend it.
```typescript
// ❌ WRONG: under RTK 1.x this silently replaced the entire default stack — losing thunk support
// and every dev safety check, with no warning. RTK 2.0 closed the footgun by removing the array
// form: `middleware` MUST now be a callback, so on the pinned version this no longer type-checks.
middleware: [myLoggerMiddleware],

// ✅ CORRECT: always start from getDefaultMiddleware() and .concat()/.prepend()
middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(myLoggerMiddleware),
```
Worth knowing *why* the callback became mandatory rather than merely recommended: passing an array
was the single most common way to lose the default stack by accident, and the symptom surfaced far
from the cause. RTK 2.0 moved that failure from a silent runtime regression to a compile-time error.
The same reasoning removed the standalone `getDefaultMiddleware` export — the only supported way to
reach it is the callback parameter.

### `enhancers` has the same rule, and people miss it
**Symptom.** You add one store enhancer and the DevTools connection or `autoBatchEnhancer` quietly
disappears.
**Cause.** `enhancers` is a callback too, for exactly the same reason as `middleware`. An array
replaces the defaults rather than adding to them.
**Fix.**
```typescript
// ❌ drops autoBatchEnhancer and anything else RTK installs by default
enhancers: [myEnhancer],

// ✅ extend the defaults
enhancers: (getDefaultEnhancers) => getDefaultEnhancers().concat(myEnhancer),
```

### Silencing the serializability warning instead of fixing its cause
**Symptom.** A console warning names a path like `cart.pendingRequestController`, and someone adds
`serializableCheck: false` to make it stop.
**Cause.** The warning is almost always right: a `File`, a `Promise`, an `AbortController` or a class
instance has leaked into the store. That breaks DevTools time-travel and any persistence layer that
round-trips through JSON.
**Fix.** Scope the exemption to the exact action and path, so the check keeps guarding everything else.
```typescript
getDefaultMiddleware({
  serializableCheck: {
    ignoredActions: ['cart/checkoutStarted'],
    ignoredPaths: ['cart.pendingRequestController'],
  },
})
```

### Building the store at module scope on an SSR server
**Symptom.** One user sees another user's cart. Intermittent, impossible to reproduce locally with
one browser tab.
**Cause.** `export const store = configureStore(...)` at module scope on Node means **every
concurrent request shares one store instance**. The module is evaluated once per process, not once
per request.
**Fix.** A factory, called fresh per request — `makeStore()` in the example above. The client calls
it once; the server calls it for every request.

### "The app is slow, but only in development"
**Symptom.** Dispatches take tens of milliseconds in dev and are instant in the production build.
**Cause.** `immutableStateInvariant` and `serializableStateInvariant` each walk the **entire** state
tree on every dispatch. On a large normalised store that cost is real, and it is dev-only by design.
**Fix.** Do not reach for `false` first. Narrow the traversal, and keep the check:
```typescript
getDefaultMiddleware({
  // both accept the same options — ignore the big, known-good subtrees
  immutableCheck: { ignoredPaths: ['catalog.searchIndex'] },
  serializableCheck: { ignoredPaths: ['catalog.searchIndex'] },
})
```
🔴 **Never conclude "the invariant checks are slowing production down."** They are not in production —
`getDefaultMiddleware()` returns `[thunk]` there.

### Forgetting the RTK Query middleware
**Symptom.** Hooks return `isLoading: true` forever, or caching, invalidation, polling and
`refetchOnFocus` all do nothing while the initial fetch still works.
**Cause.** `createApi` produces a reducer **and** a middleware. Adding `[api.reducerPath]: api.reducer`
without `.concat(api.middleware)` installs the cache but not the machinery that drives it.
**Fix.**
```typescript
middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
```

### `preloadedState` keys that no reducer owns
**Symptom.** A key you carefully serialised on the server is simply absent from `getState()` on the
client, with a console warning about unexpected keys.
**Cause.** `configureStore` hands `preloadedState` to `combineReducers`, which drops keys that no
reducer claims — it cannot know what to do with them.
**Fix.** The preloaded shape must be a subset of the reducer map's shape. If you rename a slice, the
persisted payload from the previous deploy silently stops loading — version your persisted state and
migrate it explicitly rather than trusting the shapes to stay aligned.

## Interview questions

**★ `createStore` already worked. What does `configureStore` actually buy you?**
Three things, and none of them is new capability. It calls `combineReducers` for you when you pass a
reducer *object*; it installs a default middleware stack instead of making you assemble
`applyMiddleware(thunk)` by hand; and it wires the DevTools extension without the
`__REDUX_DEVTOOLS_EXTENSION_COMPOSE__` incantation. The store it produces is an ordinary Redux store —
same `dispatch`, same `subscribe`, same reducer contract — which is precisely why migration from
classic Redux can be incremental rather than a rewrite.

**★ What is in the default middleware stack, in what order, and what survives a production build?**
In development, in order: `actionCreatorInvariant`, `immutableStateInvariant`, `thunk`,
`serializableStateInvariant`. In production the array is just `[thunk]` — all three checks are
stripped on `process.env.NODE_ENV === 'production'`. The ordering detail people get wrong is that
thunk is **third**, not first: the two checks ahead of it are deliberately unshifted to the front so
they observe the action before a thunk can turn one dispatch into several.

**★ Does the immutability check freeze your state?**
No, and this is the most common wrong answer. It *deeply compares* state values to detect mutations —
the docs say it "can detect mutations in reducers during a dispatch, and also mutations that occur
between dispatches (such as in a component or a selector)". State in an RTK app usually *is* frozen,
but that is Immer's `autoFreeze` inside `createSlice`, a completely separate mechanism. The two have
different failure modes: Immer's freeze throws at the moment you write, the invariant middleware
reports after the fact on the next dispatch.

**★ Someone dispatches a thunk and nothing happens. Walk me through the diagnosis.**
Start at the middleware, not the thunk. Either the stack was replaced with an array (RTK 1.x) so
thunk was never installed, or `{ thunk: false }` was passed to `getDefaultMiddleware`, or — if it is
an RTK Query hook rather than a thunk — `api.middleware` was never concatenated, so the reducer is
present but nothing drives it. Only after that would I look at `condition` short-circuiting the thunk
before `pending`.

**Why did RTK 2.0 make `middleware` a callback rather than merely documenting the array as risky?**
Because the failure was silent and remote from its cause. An array replaced the whole stack, the app
still booted, and the symptom appeared later as an unrelated-looking error. Making the callback
mandatory converts a runtime regression into a compile-time error. `enhancers` changed for the same
reason, and the standalone `getDefaultMiddleware` export was removed so there is exactly one way to
reach it.

**What is `preloadedState` for, and what is the classic way to get it wrong?**
It hydrates the root reducer with a snapshot — typically state rendered on a server and serialised
into the HTML — so the first client render matches the server DOM. The classic mistake is not the
option but where you call `configureStore`: at module scope on a Node server every concurrent request
shares one store, and one user's state leaks into another's response. Wrap it in a per-request
factory.

**What does the serializability check actually protect?**
Two capabilities that stop working the moment a non-serializable value enters the store: DevTools
time-travel (it must be able to snapshot and replay state) and any persistence that round-trips
through JSON. It walks both the dispatched action and the resulting state tree. The right response to
a warning is a narrow `ignoredActions`/`ignoredPaths` pair, not `false`.

**RTK Query needs two things added to the store. What are they, and what breaks if you add only one?**
`[api.reducerPath]: api.reducer` and `.concat(api.middleware)`. With only the reducer, the cache slice
exists and an initial fetch can still populate it, but the middleware is what implements subscription
reference-counting, cache lifetime, tag invalidation, polling and the focus/reconnect listeners — so
everything that makes RTK Query worth using silently does nothing.

---

← [Topic index](../README.md) · Next → [`createSlice`](../02-slices-and-actions/01-create-slice.md)
