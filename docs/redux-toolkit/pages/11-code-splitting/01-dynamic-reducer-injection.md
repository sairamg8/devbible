---
title: "Code Splitting: `combineSlices` & `injectEndpoints`"
sidebar_label: "Code Splitting"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`combineSlices`](https://redux-toolkit.js.org/api/combineSlices),
> [code splitting](https://redux-toolkit.js.org/rtk-query/usage/code-splitting).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 Code Splitting: `combineSlices` & `injectEndpoints`

## 1. Under-The-Hood Mechanics

A store built with a static `reducer: { a, b, c }` object requires every slice's code to be bundled and loaded upfront — fine for small apps, wasteful for large ones with route-based code splitting where most users never visit most routes. RTK supports **dynamic reducer injection**: adding a slice's reducer to the live store only once its owning route/feature actually loads.

```
Initial store: const rootReducer = combineSlices(coreSlice)
        │
        ▼ (user navigates to /settings, triggering a dynamic import)
settingsSlice module loads ──► rootReducer.inject(settingsSlice)
        │                      (equivalently: settingsSlice.injectInto(rootReducer))
        ▼
settingsSlice is added to the combined reducer's internal map of reducers, under its `name` key.
No action is dispatched, and store.replaceReducer() is NOT called — the root reducer function the
store holds is the same object it always was, so every existing subscriber is undisturbed.
```

### `combineSlices()`
RTK 2.x's `combineSlices(...slices)` (passed as the `reducer` argument to `configureStore`) returns a
combined reducer that also carries an `.inject(slice)` method. Calling it at any point after store
creation adds that slice's reducer to the combined reducer's map under its `name` key.

🔴 **Two details that decide whether your code works, both easy to get backwards:**

- **`inject` is called on the reducer, not on the store.** There is no `store.inject`. It is
  `rootReducer.inject(slice)`, or the equivalent `slice.injectInto(rootReducer)` — slices created by
  `createSlice` carry an `injectInto` method for exactly this, and it takes an optional config
  object if the slice should live under a different `reducerPath`.
- **`inject` does not dispatch, so the state is not there yet.** Per the API docs it "adds the slice
  to the map of reducers in your original reducer, but doesn't dispatch an action. This means that
  the added reducer state will not show up in your store until the next action is dispatched." No
  `replaceReducer()` is involved at any point.

`inject` returns an updated version of the reducer with the slice included — useful because that
return value is what carries the *type* of the newly-present slice, even though the injection itself
has already mutated the original reducer's map.

### `withLazyLoadedSlices` — how the types know about a slice that is not there yet
Injection is a runtime mechanism, and `RootState` is a compile-time one. `ReturnType<typeof rootReducer>`
describes only the slices present at construction, so a lazily injected slice is simply absent from the
type — and `state.billing` is a type error even though it will exist at runtime.

`combineSlices` solves this with a declaration of what *may* arrive:

```typescript
import { combineSlices } from '@reduxjs/toolkit';
import type { BillingSlice } from '../features/billing/billingSlice';
import type { ReportsSlice } from '../features/reports/reportsSlice';

// Everything listed here is typed as POSSIBLY present — optional, not missing
type LazyLoadedSlices = BillingSlice & ReportsSlice;

export const rootReducer = combineSlices(authSlice, {
  [baseApi.reducerPath]: baseApi.reducer,
}).withLazyLoadedSlices<LazyLoadedSlices>();

export type RootState = ReturnType<typeof rootReducer>;
// state.billing is now `BillingState | undefined` — present in the type, optional in practice
```
🔴 **This is what makes the `state.billing?.invoices ?? []` guard below type-check rather than merely
look defensive.** Without it you are choosing between a type error and an `as any`, and the second is how
a lazily-injected slice ends up silently untyped.

### `injectEndpoints()` for RTK Query
Since a single `createApi()` instance is meant to be shared across the whole app (see [RTK Query endpoints](../04-rtk-query/01-api-slice-and-endpoints.md)), feature code doesn't create new `createApi()` calls — it calls `baseApi.injectEndpoints({ endpoints: (builder) => ({...}) })` from within its own feature folder, adding new query/mutation endpoints to the shared API slice without the base API module needing to know about every feature in advance.

---

## 2. Real-World Engineering Scenario

**Scenario**: Large Admin Panel With 40 Rarely-Visited Settings Pages.
Most users of an admin panel touch 3-4 of its 40 settings pages in a given session. Bundling all 40 settings slices + their RTK Query endpoints into the initial JS bundle would meaningfully hurt first-load performance for the 95% of users who never open most pages. Route-level code splitting (`React.lazy(() => import('./BillingSettingsPage'))`) paired with `rootReducer.inject(billingSlice)` and `baseApi.injectEndpoints(...)` inside that same lazy-loaded module means the settings page's Redux logic only ever downloads and registers itself when a user actually navigates there.

---

## 3. Production-Grade Code Example

```typescript
// app/store.ts — core store with only always-needed slices upfront
import { configureStore, combineSlices } from '@reduxjs/toolkit';
import { authSlice } from '../features/auth/authSlice';
import { baseApi } from '../features/api/baseApi';

// Exported, because the lazy feature modules inject into THIS object, not into the store
export const rootReducer = combineSlices(authSlice, {
  [baseApi.reducerPath]: baseApi.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
```

```typescript
// features/billing/billingSlice.ts — loaded only when the billing route is visited
import { createSlice } from '@reduxjs/toolkit';
import { rootReducer } from '../../app/store';

export const billingSlice = createSlice({
  name: 'billing',
  initialState: { invoices: [] as string[] },
  reducers: {
    invoicesLoaded: (state, action) => { state.invoices = action.payload; },
  },
});

// Register this slice's reducer the moment this module is imported. Note it is the ROOT REDUCER
// being injected into, not the store — and `state.billing` only materialises on the NEXT dispatch.
rootReducer.inject(billingSlice);

// Equivalent, and the form to prefer when you want the typed handle back:
// const injectedBillingSlice = billingSlice.injectInto(rootReducer);
```

```typescript
// features/billing/billingApi.ts — extending the shared baseApi, not creating a new createApi()
import { baseApi } from '../api/baseApi';

export const billingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvoices: builder.query<string[], void>({ query: () => '/billing/invoices' }),
  }),
});

export const { useGetInvoicesQuery } = billingApi;
```

```tsx
// routes.tsx — the dynamic import is what actually triggers billingSlice/billingApi registration
const BillingPage = React.lazy(() => import('../features/billing/BillingPage'));
```

---

## Gotchas

### Calling `inject` on the store
**Symptom.** `store.inject is not a function`.
**Cause.** Injection belongs to the combined reducer, not the store. There is no `store.inject`.
**Fix.** `rootReducer.inject(slice)`, or `slice.injectInto(rootReducer)` — export the root reducer from
`store.ts` so feature modules can reach it.

### Reading injected state before the next dispatch
**Symptom.** A component injects its slice on import and reads `undefined` on first render.
**Cause.** `inject` "adds the slice to the map of reducers in your original reducer, but doesn't dispatch
an action", so the state does not appear until something else is dispatched.
**Fix.** Guard the read, and let the first real action materialise the slice.
```typescript
// ❌ WRONG: if BillingPage hasn't been visited yet this session, state.billing is undefined —
// a selector written assuming it always exists will throw or silently misbehave
const invoices = useSelector((state: RootState) => state.billing.invoices);

// ✅ CORRECT: guard for the not-yet-injected case — and use withLazyLoadedSlices so this type-checks
const invoices = useSelector((state: RootState) => state.billing?.invoices ?? []);
```

### Injecting a *different* reducer at a path that is already injected
**Symptom.** A console warning in development; in a hot-reload loop, state that stops updating.
**Cause.** "By default, replacing a reducer is not allowed." Re-injecting the **same** instance is
silent; a new instance at the same `reducerPath` is what RTK objects to.
**Fix.** `rootReducer.inject(slice, { overrideExisting: true })` when the replacement is deliberate —
which is what HMR needs and almost nothing else does.

### A second `createApi` instead of `injectEndpoints`
**Symptom.** A feature's mutations never invalidate the shared cache.
**Cause.** Tag invalidation works only within one API slice. A new `createApi` is a second, isolated
cache with its own middleware.
**Fix.** `baseApi.injectEndpoints({ endpoints: (builder) => ({ … }) })` from the feature folder — see
[RTK Query](../04-rtk-query/01-api-slice-and-endpoints.md).

### Splitting the store while the reducers stay in the main bundle
**Symptom.** Route-level code splitting is in place and the initial bundle barely shrinks.
**Cause.** `store.ts` still imports every slice to build the reducer map, so every slice is a static
dependency of the entry point no matter how the routes are split.
**Fix.** The slice must be imported **only** from inside the lazily-loaded module. If the root reducer
names it, it ships — injection buys nothing.

### Injecting from module scope and relying on import order
**Symptom.** Works in development, fails in a production build, or breaks when the bundler reorders
chunks.
**Cause.** A top-level `rootReducer.inject(...)` runs as a side effect of importing the module, which
couples correctness to module evaluation order.
**Fix.** It is the common pattern and usually fine — but prefer the typed handle
(`const injected = slice.injectInto(rootReducer)`) and import *that* where the slice is used, so the
dependency is explicit rather than incidental.

### Assuming injected state is cleaned up when the feature unmounts
**Symptom.** Memory that never comes back after visiting a heavy feature once.
**Cause.** There is no `eject`. A reducer added to the map stays for the life of the store, and so does
its state.
**Fix.** Treat injection as one-way. If a feature holds a lot of data, give it an explicit "clear"
action it dispatches on teardown rather than expecting removal.

## Interview questions

**★ What problem does dynamic reducer injection solve, and when is it worth the complexity?**
A store with a static reducer map makes every slice a static dependency of the entry bundle, so an admin
panel with forty settings pages ships all forty regardless of what a user opens. Injection lets a slice's
reducer register when its route actually loads. It is worth it when a substantial fraction of the app is
rarely visited; for a typical CRUD application it is complexity without a payoff, which is why this page
is tiered *When Needed*.

**★ Where does `inject` live, and what does it not do?**
On the combined reducer returned by `combineSlices` — `rootReducer.inject(slice)` — or as
`slice.injectInto(rootReducer)`. It does **not** live on the store, and it does **not** call
`store.replaceReducer()`. It adds the slice to the reducer's internal map, the root reducer's identity
never changes, and because it dispatches nothing, the new state does not appear until the next action.

**★ How do you type state that might not be injected yet?**
`combineSlices(...).withLazyLoadedSlices<LazyLoadedSlices>()`, where the type parameter is an
intersection of the slice types that may arrive later. Every listed slice becomes optional in `RootState`,
so `state.billing?.invoices` type-checks and the guard is enforced rather than merely conventional.
Without it the choice is a type error or an `as any`, and the second is how injected slices lose their
types entirely.

**How does an injected slice differ from an injected RTK Query endpoint?**
`rootReducer.inject` adds a reducer to the root reducer's map. `baseApi.injectEndpoints` adds endpoints
to an API slice that is already mounted — the reducer and middleware were installed at store creation and
do not change. The shared motivation is the same: features extend a central thing from their own folder
without the centre importing every feature.

**Can you remove an injected slice?**
No — there is no eject. The reducer stays in the map for the life of the store, and so does its state.
Design accordingly: if a feature accumulates significant data, give it an explicit clear action to
dispatch on teardown rather than expecting the slice to disappear.

**You added injection and the bundle did not shrink. Why?**
Almost certainly because `store.ts` still imports the slice to build the reducer map, which makes it a
static dependency of the entry point no matter how the routes are code-split. Injection only pays off if
the slice module is reachable *exclusively* from the lazily-imported feature.

---

← [Redux DevTools](../10-devtools-and-debugging/01-redux-devtools.md) · [Topic index](../README.md) · Next → [Testing Redux logic](../12-testing/01-testing-redux-logic.md)
