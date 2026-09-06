---
title: "Code Splitting: `combineSlices` & `injectEndpoints`"
sidebar_label: "Code Splitting"
sidebar_position: 1
---

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reading Injected Slice State Before It's Injected
```typescript
// ❌ WRONG: if BillingPage hasn't been visited yet this session, state.billing is undefined —
// a selector written assuming it always exists will throw or silently misbehave
const invoices = useSelector((state: RootState) => state.billing.invoices);

// ✅ CORRECT: guard for the not-yet-injected case, or only read this selector from within
// components that are themselves inside the lazy-loaded feature (guaranteeing injection already ran)
const invoices = useSelector((state: RootState) => state.billing?.invoices ?? []);
```

### ⚠️ Pitfall 2: Creating a Second `createApi()` Instead of `injectEndpoints`
As covered in the [RTK Query endpoints](../04-rtk-query/01-api-slice-and-endpoints.md) section, a feature module calling its own `createApi()` fragments the cache and duplicates middleware registration — dynamic code splitting is exactly the scenario `injectEndpoints()` was designed for for this reason.

### ⚠️ Pitfall 3: Expecting Injected State to Exist Before the Next Dispatch
Injection is cheaper than it looks, and it lands later than you expect. There is no `replaceReducer()`
call and the root reducer's identity never changes, so there is no reducer-replacement churn to guard
against — the thing to guard against is **reading the slice too early**. `inject` does not dispatch,
so `state.billing` is genuinely absent until some action goes through the store. A component that
injects on mount and reads its own slice in the same tick reads `undefined`.

Re-injecting the **same** reducer instance at the same path is silent and safe, and ES module caching
usually means the top-level call runs once anyway. What RTK objects to is a **different** reducer
instance arriving at a path that is already injected: by default replacing a reducer is not allowed,
and in development a warning is logged. Pass `{ overrideExisting: true }` to mean it deliberately —
which is exactly what a hot-module-reload setup needs, and nothing else should.
